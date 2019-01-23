
//let seedlink = require('seisplotjs-seedlink');
// this global comes from the seisplotjs_seedlink standalone js
let seedlink = seisplotjs.seedlink
let moment = seisplotjs.moment;

//let wp = require('seisplotjs-waveformplot');
// this global comes from the seisplotjs_waveformplot standalone js
let wp = seisplotjs.waveformplot;
let d3 = seisplotjs.d3;

let staList = ['BIRD', 'C1SC', 'CASEE', 'CSB', 'HAW', 'HODGE', 'JSC', 'PAULI', 'SUMMV', 'TEEBA'];
let netCode = 'CO';
let locCode = '00';

// also see near bottom where we check if page history has state obj and use that
let state = {
  netCode: 'CO',
  station: staList[0],
  locCode: '00',
  bandCode: "H",
  instCode: "H",
  orientationCode: 'Z',
  altOrientationCode: "",
  endTime: null
};

// Check browser state, in case of back or forward buttons

let currentState = window.history.state;
if (currentState && currentState.station) {
  console.log(`load existing state: ${JSON.stringify(currentState, null, 2)}`);
  state = currentState;
  doPlot(state);
}
// also register for events that change state
window.onpopstate = function(event) {
  if (event.state && event.state.station) {
    console.log(`onpopstate event: ${JSON.stringify(event.state, null, 2)}`);
    state = event.state;
    d3.select("#scsnStations")
      .selectAll("input")
      .property("checked", function(d, i) {return d===state.station;});
    d3.select("#orientations")
      .selectAll("input")
      .property("checked", function(d, i) {
        return d.charAt(0)===state.orientationCode;
      });
    d3.select("#instruments")
      .selectAll("input")
      .property("checked", function(d, i) {
        return d.charAt(0)===state.bandCode && d.charAt(1)===state.instCode;
      });
    doPlot(state);
  }
};

let orientList = ['Z', 'N/1', 'E/2'];
let bandInstCodeList = [ 'HN', 'HH', 'LH'];

let protocol = 'http:';
if ("https:" == document.location.protocol) {
  protocol = 'https:'
}
let wsProtocol = 'ws:';
if (protocol == 'https:') {
  wsProtocol = 'wss:';
}

let allSeisPlots = new Map();
let margin = {top: 20, right: 20, bottom: 50, left: 60};

let paused = false;
let stopped = false;
let numSteps = 0;

let heli = null;
let quakes = [];
let station = null;

let staButtonSpan = d3.select("#scsnStations")
  .selectAll("span")
  .data(staList)
  .enter()
  .append("span");
  staButtonSpan
    .append("label")
    .text(function(d) {return d;});
  staButtonSpan.insert("input", ":first-child")
    .attr("type", "radio")
    .attr("class", "shape")
    .attr("name", "mode")
    .attr("value", function(d, i) {return i;})
    .property("checked", function(d, i) {return d===state.station;})
    .on("click", function(d) {
      state.station = d3.select(this).text();
      console.log(`click ${station}`);
      doPlot(state);
    })
    .text(function(d) {return d;});
  d3.select("#scsnStations").selectAll("input").on("change", function(){
      console.log(this.value)
  });

wp.d3.select("button#loadNow").on("click", function(d) {
  state.endTime = moment.utc().endOf('hour').add(1, 'millisecond');
  doPlot(state);
});

wp.d3.select("button#loadToday").on("click", function(d) {
  state.endTime = moment.utc().endOf('day').add(1, 'millisecond');
  doPlot(state);
});

wp.d3.select("button#loadPrev").on("click", function(d) {
  state.endTime = moment.utc(state.endTime).subtract(1, 'day');
  doPlot(state);
});

wp.d3.select("button#loadNext").on("click", function(d) {
  state.endTime = moment.utc(state.endTime).add(1, 'day');
  doPlot(state);
});


let orientButtonSpan = d3.select("div#orientations")
  .select("form")
  .selectAll("span")
  .data(orientList)
  .enter()
  .append("span");
  orientButtonSpan
    .append("label")
    .text(function(d) {return d;});
  orientButtonSpan.insert("input", ":first-child")
    .attr("type", "radio")
    .attr("class", "shape")
    .attr("name", "mode")
    .attr("value", function(d, i) {return i;})
    .property("checked", function(d, i) {
      return d.charAt(0)===state.orientationCode;
    })
    .on("click", function(d) {
      let newOrientationCode = d3.select(this).text();
      if (newOrientationCode.length > 1) {
        state.altOrientationCode = newOrientationCode.slice(-1);
        state.orientationCode = newOrientationCode.charAt(0);
      } else {
        state.orientationCode = newOrientationCode;
        state.altOrientationCode = "";
      }
      console.log(`click ${state.orientationCode} ${state.altOrientationCode}`);
      doPlot(state);
    })
    .text(function(d) {return d;});
  d3.select("div.orientations").selectAll("input").on("change", function(){
      console.log(this.value)
  });


  let instButtonSpan = d3.select("div#instruments")
    .select("form")
    .selectAll("span")
    .data(bandInstCodeList)
    .enter()
    .append("span");
    instButtonSpan
      .append("label")
      .text(function(d) {
        if (d === 'HN') {
          return "Strong Motion";
        } else if (d === 'HH') {
          return "Seismometer";
        } else if (d === 'LH') {
          return "Long Period";
        } else {
          return "UNKNOWN???";
        }
      });
    instButtonSpan.insert("input", ":first-child")
      .attr("type", "radio")
      .attr("class", "shape")
      .attr("name", "mode")
      .attr("value", function(d, i) {return i;})
      .property("checked", function(d, i) {
        return d.charAt(0)===state.bandCode && d.charAt(1)===state.instCode;
      })
      .on("click", function(d) {
        let bandInst = d3.select(this).text();
        state.bandCode = bandInst.charAt(0);
        state.instCode = bandInst.charAt(1);
        console.log(`click ${state.bandCode}${state.instCode}`);
        doPlot(state);
      })
      .text(function(d) {return d;});



wp.d3.select("button#pause").on("click", function(d) {
  doPause( ! paused);
});

wp.d3.select("button#disconnect").on("click", function(d) {
  doDisconnect( ! stopped);
});

let doPause = function(value) {
  console.log("Pause..."+paused+" -> "+value);
  paused = value;
  if (paused) {
    wp.d3.select("button#pause").text("Play");
  } else {
    wp.d3.select("button#pause").text("Pause");
  }
}

let doDisconnect = function(value) {
  console.log("disconnect..."+stopped+" -> "+value);
  stopped = value;
  if (stopped) {
    if (slConn) {slConn.close();}
    wp.d3.select("button#disconnect").text("Reconnect");
  } else {
    if (slConn) {slConn.connect();}
    wp.d3.select("button#disconnect").text("Disconnect");
  }
}

console.log(' ##### DISABLE autoupdate ####')
paused=true;
let timerInterval = 300*1000;
// testing
timerInterval = 10000;
if (timerInterval < 10000) { timerInterval = 10000;}
console.log("start time with interval "+timerInterval);
let timer = wp.d3.interval(function(elapsed) {
  if ( ! heli) {return;}
  if ( paused) {
    return;
  }
  if ( allSeisPlots.size > 1) {
    numSteps++;
    if (maxSteps > 0 && numSteps > maxSteps ) {
      console.log("quit after max steps: "+maxSteps);
      timer.stop();
      slConn.close();
    }
  }
  nowHour = moment.utc().endOf('hour').add(1, 'millisecond');
  timeWindow = wp.calcStartEndDates(null, nowHour, duration, clockOffset);
  console.log("reset time window for "+timeWindow.start+" "+timeWindow.end );

  heli.setPlotStartEnd(timeWindow.start, timeWindow.end);
}, timerInterval);

let errorFn = function(error) {
  console.log("error: "+error);
  svgParent.select("p").text("Error: "+error);
};
