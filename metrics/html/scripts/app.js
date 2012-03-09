function loadOptions() {
  var i;
  for (option in data.info) {
    $('#controls select[name=' + option + ']').html('');
    for (i = 0; i < data.info[option].length; i++) {
      $('#controls select[name=' + option + ']').append(
        ich.controlopt({ value: data.info[option][i], text: data.info[option][i] }));
    }
  }
}

function online_variance(times) {
  times = times.map(function(x) { return [x[0]*1000, x[1]]; });
  times.sort(function(x, y) { return x[0] - y[0]; });
  var mean = 0.0;
  var M2 = 0.0;
  var delta, variance;

  for (var i = 0; i < times.length; i++) {
    delta = times[i][1] - mean;
    mean = mean + delta/(i+1);
    if (i > 0) {
      M2 = M2 + delta*(times[i][1] - mean);
    }

    variance = M2/(i+1);
  }
  return {times: times, mean: mean, stddev: Math.sqrt(variance) };
}

function makePlot(params) {
  $('#plot').html();
  if (!(params.test in data.failures[params.metric][params.platform])) {
    $('#plot').html(ich.nodata());
    return;
  }
  var faildata = online_variance(data.failures[params.metric][params.platform][params.test]);
  
  var series = [{ data: faildata.times, label: 'metric', points: { show: true } },
                { data: [[faildata.times[0][0], faildata.mean],
                         [faildata.times[faildata.times.length-1][0], faildata.mean]],
                  label: 'mean',
                  points: { show: false }, lines: { show: true } },
                { data: [[faildata.times[0][0], faildata.mean + faildata.stddev],
                         [faildata.times[faildata.times.length-1][0], faildata.mean + faildata.stddev]],
                  label: '+stddev',
                  points: { show: false }, lines: { show: true } }];
  if ((faildata.mean - faildata.stddev) >= 0) {
    series.push({ data: [[faildata.times[0][0], faildata.mean - faildata.stddev],
                         [faildata.times[faildata.times.length-1][0], faildata.mean - faildata.stddev]],
                  label: '-stddev',
                  points: { show: false }, lines: { show: true } });
  }
  var yaxisLabel = (faildata.metric == 'sum of squares') ? 'sum of squares of unresponsive times' : 'sum of unresponsive times';
  $.plot($('#plot'), series, {
    xaxis: { mode: 'time', axisLabel: 'build date' },
    yaxis: { min: 0,  axisLabel: yaxisLabel },
    legend: { position: 'ne' }
  });
}

function loadGraph() {
  var params = {};
  $.makeArray($('#controls select').each(function(i, e) { params[e.name] = e.value; }));
  var hash = '#/' + params.platform + '/' + params.test + '/' + params.metric;
  if (hash != document.location.hash) {
    document.location.hash = hash;
  }
  makePlot(params);
}

function setControls(platform, test, metric) {
  if (platform) {
    $('#platform option[value="' + platform + '"]').attr('selected', true);
  }
  if (test) {
    $('#test option[value="' + test + '"]').attr('selected', true);
  }
  if (metric) {
    $('#metric option[value="' + metric + '"]').attr('selected', true);
  }
  loadGraph();
}

var data = {};

function main() {
  $.getJSON('peptest-results.json', function(d) {
    data = d;
    loadOptions();
    $('#controls').change(function() { loadGraph(); return false; });
    $('#controls').submit(function() { return false; });
    var router = Router({
      '/([^/]+)': {
        '/([^/]+)': {
          '/([^/]+)': {
            on: setControls
          },
          on: setControls
        },
        on: setControls
      },
      on: setControls
    }).init('/');
    setControls();
  });
}
