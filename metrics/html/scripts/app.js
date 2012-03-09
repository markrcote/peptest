/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

function loadOptions() {
  var i;
  for (option in data.info) {
    $('#controls select[name=' + option + ']').html('');
    data.info[option].sort();
    for (i = 0; i < data.info[option].length; i++) {
      $('#controls select[name=' + option + ']').append(
        ich.controlopt({ value: data.info[option][i], text: data.info[option][i] }));
    }
  }
}


function online_variance(times) {
  if (times === undefined) {
    return { times: [] };
  }
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
  var faildata = online_variance(data.failures[params.platform][params.test]);
  var passes = params.test in data.passes[params.platform] ? data.passes[params.platform][params.test].map(function(x) { return [x * 1000, 0]; }) : [];
  if (!faildata.times.length && !passes.length) {
    $('#plot').html(ich.nodata);
    return;
  }

  passes.sort(function(x, y) { return x[0] - y[0]; });

  var colour = 0;
  var series = [];
  if (faildata.times.length != 0) {
    series.push({ data: faildata.times, label: 'failures',
                  points: { show: true }, color: colour++ });
  }
  if (passes.length != 0) {
    series.push({ data: passes, label: 'passes', points: { show: true },
                  color: colour++ });
  }
  if (faildata.times.length != 0) {
    var start = faildata.times[0][0];
    if (passes.length && passes[0][0] < start) {
      start = passes[0][0];
    }
    var end = faildata.times[faildata.times.length-1][0];
    if (passes.length && passes[passes.length-1][0] > end) {
      end = passes[passes.length-1][0];
    }
    series.push({ data: [[start, faildata.mean], [end, faildata.mean]],
                  label: 'mean failure (' + Math.ceil(faildata.mean) + ')', color: colour++,
                  points: { show: false }, lines: { show: true } });
    series.push({ data: [[start, faildata.mean + faildata.stddev],
                         [end, faildata.mean + faildata.stddev]],
                  label: 'failure std dev (' + Math.ceil(faildata.stddev) + ')', color: colour,
                  points: { show: false }, lines: { show: true } });
    if ((faildata.mean - faildata.stddev) >= 0) {
      series.push({ data: [[start, faildata.mean - faildata.stddev],
                           [end, faildata.mean - faildata.stddev]],
                    color: colour,
                    points: { show: false }, lines: { show: true } });
    }
  }
  var yaxisLabel = 'sum of squares of unresponsive times in ms / 1000';
  $.plot($('#plot'), series, {
    grid: { hoverable: true },
    xaxis: { mode: 'time', axisLabel: 'build date' },
    yaxis: { min: 0,  axisLabel: yaxisLabel },
    legend: { position: 'ne' }
  });
  $('#plot').bind('plothover',
    plotHover($('#plot'), function (item) {
      var x = item.datapoint[0].toFixed(2),
          y = item.datapoint[1];
      showLineTooltip(item.pageX, item.pageY, x, y);
    })
  );

}


function loadGraph() {
  var params = {};
  $.makeArray($('#controls select').each(function(i, e) { params[e.name] = e.value; }));
  var hash = '#/' + params.platform + '/' + params.test;
  if (hash != document.location.hash) {
    document.location.hash = hash;
  }
  makePlot(params);
}


function setControls(platform, test) {
  if (platform) {
    $('#platform option[value="' + platform + '"]').attr('selected', true);
  }
  if (test) {
    $('#test option[value="' + test + '"]').attr('selected', true);
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
          on: setControls
        },
        on: setControls
      },
      on: setControls
    }).init('/');
    setControls();
  });
}
