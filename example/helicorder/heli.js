
//let seedlink = require('seisplotjs-seedlink');
// this global comes from the seisplotjs_seedlink standalone js
let seedlink = seisplotjs.seedlink
let moment = seisplotjs.moment;

// this global comes from the seisplotjs_waveformplot standalone js
let d3 = seisplotjs.d3;

let staList = ['BIRD', 'C1SC', 'CASEE', 'CSB', 'HAW', 'HODGE', 'JSC', 'PAULI', 'SUMMV', 'TEEBA'];
let netCode = 'CO';
let locCode = '00';

// also see near bottom where we check if page history has state obj and use that
let state = {
  netCode: 'CO',
  station: "",
  locCode: '00',
  bandCode: "H",
  instCode: "H",
  orientationCode: 'Z',
  altOrientationCode: "",
  endTime: "now",
  duration: 'P1D'
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

let locCodeList = ['00', '01', '99'];
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


let chooserEnd;
if ( state.end) {
  chooserEnd = moment.utc(state.end);
} else {
  chooserEnd = moment.utc();
}
const chooserStart = chooserEnd.subtract(moment.duration(state.duration))
    .endOf('hour').add(1, 'millisecond');

let dateChooserSpan = d3.select("#datechooser");
let dateChooser = new seisplotjs.datechooser.DateTimeChooser(dateChooserSpan,
    "Start Time",
    chooserStart,
    time => {
      state.endTime = time.endOf('hour').add(1, 'millisecond').add(moment.duration(state.duration));
      doPlot(state);
    });
let updateDateChooser = function(state) {
  if ( state.endTime && state.duration) {
    dateChooser.updateTime(moment.utc(state.endTime).subtract(moment.duration(state.duration)));
  } else {
    throw new Error(`missing end/duration: ${state.endTime} ${state.duration}`);
  }
}

let staButtonSpan = d3.select("#scsnStations")
  .select("form")
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

d3.select("button#loadNow").on("click", function(d) {
  state.endTime = moment.utc().endOf('hour').add(1, 'millisecond');
  console.log(`now ${state.endTime}`);
  updateDateChooser(state);
  doPlot(state);
});

d3.select("button#loadToday").on("click", function(d) {
  state.endTime = moment.utc().endOf('day').add(1, 'millisecond');
  console.log(`today ${state.endTime}`);
  updateDateChooser(state);
  doPlot(state);
});

d3.select("button#loadPrev").on("click", function(d) {
  state.endTime = moment.utc(state.endTime).subtract(1, 'day');
  console.log(`prev ${state.endTime}`);
  updateDateChooser(state);
  doPlot(state);
});

d3.select("button#loadNext").on("click", function(d) {
  state.endTime = moment.utc(state.endTime).add(1, 'day');
  console.log(`next ${state.endTime}`);
  updateDateChooser(state);
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


      let loccodeButtonSpan = d3.select("div#loccode")
        .select("form")
        .selectAll("span")
        .data(locCodeList)
        .enter()
        .append("span");
        loccodeButtonSpan
          .append("label")
          .text(d => {return d;});
        loccodeButtonSpan.insert("input", ":first-child")
          .attr("type", "radio")
          .attr("class", "shape")
          .attr("name", "mode")
          .attr("value", function(d, i) {return i;})
          .property("checked", function(d, i) {
            return d===state.locCode;
          })
          .on("click", function(d) {
            let locCode = d3.select(this).text();
            state.locCode = locCode;
            console.log(`click ${state.locCode} ${state.bandCode}${state.instCode}`);
            doPlot(state);
          })
          .text(function(d) {return d;});




d3.select("button#pause").on("click", function(d) {
  doPause( ! paused);
});

d3.select("button#disconnect").on("click", function(d) {
  doDisconnect( ! stopped);
});

let doPause = function(value) {
  console.log("Pause..."+paused+" -> "+value);
  paused = value;
  if (paused) {
    d3.select("button#pause").text("Play");
  } else {
    d3.select("button#pause").text("Pause");
  }
}

let doDisconnect = function(value) {
  console.log("disconnect..."+stopped+" -> "+value);
  stopped = value;
  if (stopped) {
    if (slConn) {slConn.close();}
    d3.select("button#disconnect").text("Reconnect");
  } else {
    if (slConn) {slConn.connect();}
    d3.select("button#disconnect").text("Disconnect");
  }
}

console.log(' ##### DISABLE autoupdate ####')
paused=true;
let timerInterval = 300*1000;
// testing
timerInterval = 10000;
if (timerInterval < 10000) { timerInterval = 10000;}
console.log("start time with interval "+timerInterval);
let timer = d3.interval(function(elapsed) {
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
  timeWindow = new seisplotjs.fdsndataselect.StartEndDuration(null, nowHour, duration, clockOffset);
  console.log("reset time window for "+timeWindow.start+" "+timeWindow.end );

  heli.setPlotStartEnd(timeWindow.start, timeWindow.end);
}, timerInterval);

let errorFn = function(error) {
  console.log("error: "+error);
  svgParent.select("p").text("Error: "+error);
};
