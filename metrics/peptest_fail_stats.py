import json
import math

def online_variance(data):
    n = 0
    mean = 0
    M2 = 0
 
    for x in data:
        n = n + 1
        delta = x - mean
        mean = mean + delta/n
        if n > 1:
            M2 = M2 + delta*(x - mean)
 
    variance_n = M2/n
    if n > 1:
        variance = M2/(n - 1)
    else:
        variance = variance_n
    return (mean, variance, variance_n)


def main(failures_cache_filename):
    failures = {}
    failures = json.loads(file(failures_cache_filename, 'r').read())

    stats = {}

    for buildos, test_dict in failures.iteritems():
        for test, metrics in test_dict.iteritems():
            if not test in stats:
                stats[test] = {}
            if not buildos in stats[test]:
                stats[test][buildos] = {}
            
            mean, var, var_n = online_variance([x[0] for x in metrics])
            stddev = math.sqrt(var_n)
            num_in_stddev = 0
            num_in_2_stddev = 0
            outliers = []
            for x, y in metrics:
                if x >= mean - stddev and x <= mean + stddev:
                    num_in_stddev += 1
                if x >= mean - 2 * stddev and x <= mean + 2 * stddev:
                    num_in_2_stddev += 1
                else:
                    outliers.append(x)
            outliers.sort(reverse=True)
            stats[test][buildos] = { 'n': len(metrics),
                                     'stddev': stddev,
                                     'mean': mean,
                                     'num_in_stddev': num_in_stddev,
                                     'num_in_2_stddev': num_in_2_stddev,
                                     'outliers': outliers }

    for test, d in stats.iteritems():
        print '%s\n%s' % (test, '-' * len(test))
        for buildos, values in d.iteritems():
            indent =  ' ' * (len(buildos) + 2)
            #print '%s: %s' % (buildos, ', '.join([str(x) for x in failures[buildos][test]]))
            print '%s:' % buildos
            print '%smean: %.1f stddev: %.1f' % (indent, values['mean'],
                                                 values['stddev'])
            print '%snum in one stddev: %d/%d (%d%%) in two: %d/%d (%d%%)' % \
                (indent, values['num_in_stddev'], values['n'],
                 float(values['num_in_stddev']) / values['n'] * 100,
                 values['num_in_2_stddev'], values['n'],
                 float(values['num_in_2_stddev']) / values['n'] * 100)
            if values['outliers']:
                print '%soutliers: %s' % \
                    (indent,
                     ', '.join(['%.3f (%.1f s.d.s)' % (x, math.fabs(values['mean'] - x)/values['stddev']) for x in values['outliers']]))
            print
        print


if __name__ == '__main__':
    import sys
    main(sys.argv[1])

