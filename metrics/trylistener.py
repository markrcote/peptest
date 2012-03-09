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

builds = {}
builds_cache_filename = 'tests_cache.json'
logs_dir = 'logs'
processed_logs_dir = 'processed_logs'
l = threading.RLock()
lp = logparser.LogParser()

def cb(data):
    l.acquire()
    global builds
    buildid = data['buildid']
    buildos = data['os']
    test = data['test']
    print 'test completed: %s on build %s, os %s' % (test, buildid, buildos)
    if not buildid in builds:
        builds[buildid] = {}
    if not buildos in builds[buildid]:
        builds[buildid][buildos] = {}
    if test == 'peptest':
        builds[buildid][buildos]['peptest'] = data['buildnumber']
        print 'peptest completed for build %s, os %s' % (buildid, buildos)
    if data.get('logurl') and not 'logurl' in builds[buildid][buildos]:
        builds[buildid][buildos]['logurl'] = os.path.dirname(data['logurl'])
        print 'found log location for build %s, os %s' % (buildid, buildos)

    if 'peptest' in builds[buildid][buildos] and 'logurl' in builds[buildid][buildos]:
        url = builds[buildid][buildos]['logurl'] + '/try_%s_test-peptest-build%s.txt.gz' % (buildos, builds[buildid][buildos]['peptest'])
        print 'downloading %s' % url
        filename = os.path.basename(url)
        log_path = os.path.join(logs_dir, os.path.basename(url))
        urllib.urlretrieve(url, log_path)
        #lp.parse_log(log_path, buildid)
        #os.rename(log_path, os.path.join(processed_logs_dir, filename))
    file(builds_cache_filename, 'w').write(json.dumps(builds))
    l.release()

def main():
    logging.basicConfig(level=logging.WARNING)
    try:
        os.mkdir(logs_dir)
    except OSError:
        pass
    try:
        os.mkdir(processed_logs_dir)
    except OSError:
        pass

    global builds
    if os.path.exists(builds_cache_filename):
        builds.update(json.loads(file(builds_cache_filename, 'r').read()))
        print 'read cache:'
        print str(builds)

    logging.info('Starting listener.')
    m = start_pulse_monitor(testCallback=cb, tree=['try'],
                            logger=logging.getLogger(), buildtype='opt')
    while True:
        try:
            i = raw_input()
        except KeyboardInterrupt:
            break
        

if __name__ == '__main__':
    main()
