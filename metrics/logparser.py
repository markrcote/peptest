import datetime
import gzip
import json
import os
import re
import time
from collections import defaultdict

class LogParser(object):

    failures = defaultdict(lambda: defaultdict(list))
    failures_squared = defaultdict(lambda: defaultdict(list))
    passes = defaultdict(lambda: defaultdict(list))
    info = {'platform': [], 'test': [], 'metric': ['sum', 'sum of squares']}
    results_filename = 'peptest-results.json'

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
                self.passes[buildos][testname] = buildid
        for testname, times in unresp_times.iteritems():
            if not testname in self.info['test']:
                self.info['test'].append(testname)
            d = int(time.mktime(datetime.datetime.strptime(buildid, '%Y%m%d%H%M%S').timetuple())) * 1000
            self.failures[buildos][testname].append([d, sum(times)])
            self.failures_squared[buildos][testname].append([d, sum([x*x/1000.0 for x in times])])
        if not buildos in self.info['platform']:
            self.info['platform'].append(buildos)
        file(self.results_filename, 'w').write(json.dumps({
                    'passes': self.passes,
                    'failures': { 'sum': self.failures,
                                  'sum of squares': self.failures_squared },
                    'info': self.info }))

if __name__ == '__main__':
    logs_dir = 'logs'
    lp = LogParser()
    for f in os.listdir(logs_dir):
        filename = os.path.join(logs_dir, f) 
        lp.parse_log(filename)
