# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.

import gzip
import json
import logging
import os
import re
import threading
import urllib

from collections import defaultdict

import logparser
from pulsebuildmonitor import start_pulse_monitor


class Collector(object):

    def __init__(self, results_filename):
        self.logs_dir = 'logs'
        self.l = threading.RLock()
        self.lp = logparser.LogParser(results_filename)
        try:
            os.mkdir(self.logs_dir)
        except OSError:
            pass

    def cb(self, data):
        self.l.acquire()
        buildid = data['buildid']
        buildos = data['os']
        test = data['test']
        print 'test completed: %s on build %s, os %s' % (test, buildid, buildos)
        if test == 'peptest':
            url = data['logurl']
            print 'downloading %s' % url
            filename = os.path.basename(url)
            log_path = os.path.join(self.logs_dir, os.path.basename(url))
            urllib.urlretrieve(url, log_path)
            self.lp.parse_log(log_path, buildid)
            os.unlink(log_path)
        self.l.release()


def main():
    from optparse import OptionParser
    parser = OptionParser()
    parser.add_option('-v', '--verbose', action='count', dest='verbosity',
                      default=0,
                      help='verbosity level; can be given multiple times')
    parser.add_option('--results', type='string', dest='results', default='',
                      help='path to JSON results file')
    opts, args = parser.parse_args()
    if opts.verbosity == 0:
        loglvl = logging.WARNING
    elif opts.verbosity == 1:
        loglvl = logging.INFO
    else:
        loglvl = logging.DEBUG
    logging.basicConfig(level=loglvl)
    
    logging.info('Starting collector.')
    collector = Collector(opts.results)
    m = start_pulse_monitor(testCallback=collector.cb, trees=['try'],
                            logger=logging.getLogger(), buildtypes=['opt'])
    while True:
        try:
            i = raw_input()
        except KeyboardInterrupt:
            break
        

if __name__ == '__main__':
    main()
