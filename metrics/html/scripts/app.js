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
    return {};
  }
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
  return { mean: mean, stddev: Math.sqrt(variance) };
}

function getDataPoints(params) {
  var startDate = ISODate($('#startdate').attr('value')).getTime();
  var endDate = ISODate($('#enddate').attr('value')).getTime();
  var firstPoint = 0, lastPoint = 0;
  var failurePoints = [];
  if ((params.platform in data.failures) && (params.test in data.failures[params.platform])) {
    failurePoints = data.failures[params.platform][params.test].filter(function(x) {
      return x[0]*1000 >= startDate && x[0]*1000 <= endDate;
    }).map(function(x) {
      return [x[0]*1000, x[1]];
    });
  }
  var passPoints = [];
  if ((params.platform in data.passes) && (params.test in data.passes[params.platform])) {
    passPoints = data.passes[params.platform][params.test].filter(function(x) {
      return x*1000 >= startDate && x*1000 <= endDate;
    }).map(function(x) { return [x*1000, 0]; });
  }
  failurePoints.sort(function(x, y) { return x[0] - y[0]; });
  passPoints.sort(function(x, y) { return x[0] - y[0]; });

  if (failurePoints.length) {
    firstPoint = failurePoints[0][0];
    lastPoint = failurePoints[failurePoints.length-1][0];
  }
  if (passPoints.length) {
    if (firstPoint == 0 || passPoints[0][0] < firstPoint) {
      firstPoint = passPoints[0][0];
    }
    if (lastPoint == 0 || passPoints[passPoints.length-1][0] > lastPoint) {
      lastPoint = passPoints[passPoints.length-1][0];
    }
  }

  return { failures: failurePoints,
           passes: passPoints,
           firstPoint: firstPoint,
           lastPoint: lastPoint };
}

function makePlot(params) {
  $('#plot').html();
  var points = getDataPoints(params);
  if (!points.failures.length && !points.passes.length) {
    $('#plot').html(ich.nodata());
    return;
  }
  
  var colour = 0;
  var series = [];
  if (points.failures.length) {
    series.push({ data: points.failures,
                  label: 'failures',
                  color: colour,
                  points: { show: true } });
  }
  colour++;
  if (points.passes.length) {
    series.push({ data: points.passes,
                  label: 'passes',
                  color: colour,
                  points: { show: true } });
  }
  colour++;
  if (points.failures.length) {
    var faildata = online_variance(points.failures);
    series.push({ data: [[points.firstPoint, faildata.mean],
                         [points.lastPoint, faildata.mean]],
                  label: 'mean failure (' + Math.ceil(faildata.mean) + ')',
                  color: colour,
                  points: { show: false }, lines: { show: true } });
    series.push({ data: [[points.firstPoint, faildata.mean + faildata.stddev],
                         [points.lastPoint, faildata.mean + faildata.stddev]],
                  label: 'failure std dev (' + Math.ceil(faildata.stddev) + ')',
                  color: ++colour,
                  points: { show: false }, lines: { show: true } });
    if ((faildata.mean - faildata.stddev) >= 0) {
      series.push({ data: [[points.firstPoint, faildata.mean - faildata.stddev],
                           [points.lastPoint, faildata.mean - faildata.stddev]],
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
      var x = item.datapoint[0].toFixed(2);
      var y;
      if (item.seriesIndex == 0) {
        y = Math.ceil(item.datapoint[1]);
      } else if (item.seriesIndex == 1) {
        y = 'pass';
      }
      showLineTooltip(item.pageX, item.pageY, x, y);
    })
  );
}

function loadGraph() {
  var params = {};
  $.makeArray($('#controls select').each(function(i, e) { params[e.name] = e.value; }));
  var hash = '#/try/' + params.platform + '/' + params.test + '/' +
        $('#startdate').attr('value') + '/' + $('#enddate').attr('value');
  if (hash != document.location.hash) {
    document.location.hash = hash;
  }
  makePlot(params);
}

function setControls(branch, platform, test, startdate, enddate) {
  if (branch) {
    $('#branch option[value="' + branch + '"]').attr('selected', true);
  }
  if (platform) {
    $('#platform option[value="' + platform + '"]').attr('selected', true);
  }
  if (test) {
    $('#test option[value="' + test + '"]').attr('selected', true);
  }
  if (!startdate) {
    $('#period option[value="7"]').attr('selected', true);
    periodChanged();
  } else {
    $('#startdate').attr('value', startdate);
    if (enddate) {
      $('#enddate').attr('value', enddate);
    } else {
      $('#enddate').attr('value', ISODateString(new Date()));
    }
    dateChanged();
  }
  loadGraph();
}

function ISODateString(d) {
  function pad(n) { return n < 10 ? '0' + n : n; }
  return d.getUTCFullYear() + '-'
         + pad(d.getUTCMonth() + 1) + '-'
         + pad(d.getUTCDate());
}

function ISODate(dateString) {
  var parts = dateString.split('-');
  return new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]));
}

function periodChanged() {
  var endDate = new Date();
  $('#enddate').attr('value', ISODateString(endDate));
  var startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - parseInt($('#period').attr('value')));
  $('#startdate').attr('value', ISODateString(startDate));
}

function dateChanged() {
  $('#period option[value="0"]').attr('selected', true);
  if (ISODateString(new Date()) == $('#enddate').attr('value')) {
    var period = $('#period option[value="' + (new Date($('#enddate').attr('value')) - new Date($('#startdate').attr('value')))/(24*60*60*1000) + '"]');
    if (period.length) {
      period.attr('selected', true);
    }
  }
}

var data = {};

function main() {
  // Configure date controls.
  $.datepicker.setDefaults({
    showOn: "button",
    buttonImage: "images/calendar.png",
    buttonImageOnly: true,
    dateFormat: 'yy-mm-dd'
  });
  $('#startdate').datepicker();
  $('#enddate').datepicker();

  // branch hardcoded to try for now
  $('#controls select[name=branch]').html('');
  $('#controls select[name=branch]').append(ich.controlopt({ value: 'try',
                                                             text: 'try' }));

  $('#period').change(function() { periodChanged(); loadGraph(); return false; });

  $('#startdate').change(function() { dateChanged(); loadGraph(); return false; });
  $('#enddate').change(function() { dateChanged(); loadGraph(); return false; });

  $.getJSON('peptest-results.json', function(d) {
    data = d;
    loadOptions();
    $('#controls').change(function() { loadGraph(); return false; });
    $('#controls').submit(function() { return false; });
    var router = Router({
      '/([^/]*)': {
        '/([^/]*)': {
          '/([^/]*)': {
            '/([^/]*)': {
              '/([^/]*)': {
                on: setControls
              },
              on: setControls
            },
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
