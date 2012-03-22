# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.

import datetime
import gzip
import json
import os
import re
import time
from collections import defaultdict

class LogParser(object):

    failures = {}
    passes = {}
    info = {'platform': [], 'test': []}
    results_filename = 'peptest-results.json'

    def __init__(self, results_filename):
        if results_filename:
            self.results_filename = results_filename
        if os.path.exists(self.results_filename):
            data = json.loads(file(self.results_filename, 'r').read())
            self.passes = data['passes']
            self.failures = data['failures']
            self.info = data['info']

    def timestamp_from_buildid(self, buildid):
        return int(time.mktime(datetime.datetime.strptime(buildid, '%Y%m%d%H%M%S').timetuple()))

    def parse_log(self, filename, buildid=''):
        print 'parsing %s' % filename
        m = re.match('try_([^_]+)_test', os.path.basename(filename))
        buildos = m.group(1)
        unresp_times = defaultdict(list)
        f = gzip.GzipFile(filename, 'r')
        for line in f:
            if not buildid:
                m = re.match('buildid: ([\d]+)', line)
                if m:
                    buildid = m.group(1)
            if 'PEP WARNING' in line:
                parts = [x.strip() for x in line.split('|')]
                if len(parts) < 3:
                    continue
                testname = parts[1]
                m = re.search('unresponsive time: ([\d]+) ms', parts[3])
                if not m:
                    print 'nope'
                    continue
                unresp_times[testname].append(int(m.group(1)))
            elif 'PEP ERROR' in line:
                parts = [x.strip() for x in line.split('|')]
                testname = parts[1]
                if testname in unresp_times:
                    del unresp_times[testname]
            elif 'PEP TEST-PASS' in line:
                parts = [x.strip() for x in line.split('|')]
                testname = parts[1]
                if not buildos in self.passes:
                    self.passes[buildos] = {}
                if not testname in self.passes[buildos]:
                    self.passes[buildos][testname] = []
                self.passes[buildos][testname].append(self.timestamp_from_buildid(buildid))
        for testname, times in unresp_times.iteritems():
            if not testname in self.info['test']:
                self.info['test'].append(testname)
            if not buildos in self.failures:
                self.failures[buildos] = {}
            if not testname in self.failures[buildos]:
                self.failures[buildos][testname] = []
            self.failures[buildos][testname].append([self.timestamp_from_buildid(buildid), sum([x*x/1000.0 for x in times])])
        if not buildos in self.info['platform']:
            self.info['platform'].append(buildos)
        file(self.results_filename, 'w').write(json.dumps({
                    'passes': self.passes,
                    'failures': self.failures,
                    'info': self.info }))

if __name__ == '__main__':
    logs_dir = 'logs'
    lp = LogParser()
    for f in os.listdir(logs_dir):
        filename = os.path.join(logs_dir, f) 
        lp.parse_log(filename)
