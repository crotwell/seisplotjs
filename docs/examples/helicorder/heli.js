import * as seisplotjs from './seisplotjs_3.0.0-alpha.1_standalone.mjs';
import {HOURS_PER_LINE, doPlot, queryEarthquakes, redrawHeli, getNowTime} from './doplot.js';

const d3 = seisplotjs.d3;
const luxon = seisplotjs.luxon;

const staList = ['BARN', 'BIRD', 'C1SC', 'CASEE', 'CSB', 'HAW', 'HODGE', 'JSC', 'PAULI', 'SUMMV', 'TEEBA'];
const locCodeList = ['00', '01'];
const orientList = ['Z', 'N/1', 'E/2'];
const bandInstCodeList = [ 'HN', 'HH', 'LH'];
const DEFAULT_FIXED_AMP = 10000;

// state preserved for browser history
// also see near bottom where we check if page history has state obj and use that
let state = {
  netCode: 'CO',
  station: null,
  locCode: '00',
  bandCode: "H",
  instCode: "H",
  orientationCode: 'Z',
  altOrientationCode: "",
  endTime: "now",
  duration: 'P1D',
  amp: "max"
};

let heliHash = null;

let loadAndPlot = function(state) {
  updateAmpRadioButtons(state);
  doPlot(state).then(hash => heliHash = hash);
};

let updateAmpRadioButtons = function(currentState) {
  d3.select("#amp")
    .select("input#maxAmp").property("checked", "false");
  d3.select("#amp")
    .select("input#fixedAmp").property("checked", "false");
  d3.select("#amp")
    .select("input#percentAmp").property("checked", "false");
  if (currentState) {
    if (typeof currentState.amp === 'string' && currentState.amp.endsWith('%')) {
      let percent = Number(currentState.amp.substring(0, currentState.amp.length-1));
      d3.select("input#percentAmpSlider").property("value", percent);
      d3.select("#amp")
        .select("input#percentAmp").property("checked", "true");
    } else if (currentState.amp === "max") {
      d3.select("#amp")
        .select("input#maxAmp").property("checked", "true");
      currentState.amp = "max";
    } else if ( Number.isFinite(Number(currentState.amp))) {
      d3.select("#amp")
        .select("input#fixedAmp").property("checked", "true");
      d3.select("#amp")
        .select("input#fixedAmpText").property("value", currentState.amp);
      d3.select("#amp")
        .select("input#fixedAmpText").text(currentState.amp);
    } else {
      // default to max?
        d3.select("#amp")
          .select("input#maxAmp").property("checked", "true");
        currentState.amp = "max";
    }

  } else {
    // default to max?
      d3.select("#amp")
        .select("input#maxAmp").property("checked", "true");
      currentState.amp = "max";
  }

  // earthquake query params
  updateEarthquakeQueryParam(currentState, 'localMinLat', 31.75);
  updateEarthquakeQueryParam(currentState, 'localMaxLat', 35.5);
  updateEarthquakeQueryParam(currentState, 'localMinLon', -84);
  updateEarthquakeQueryParam(currentState, 'localMaxLon', -78);
  updateEarthquakeQueryParam(currentState, 'regionalMaxRadius', 10);
  updateEarthquakeQueryParam(currentState, 'regionalMinMag', 4.5);
  updateEarthquakeQueryParam(currentState, 'globalMinMag', 6);
  loadAllEarthquakeQueryParams(currentState);
  console.log(`currentState: ${JSON.stringify(currentState)}`);
};

const updateEarthquakeQueryParam = function(currentState, id, defaultValue) {
  let region = 'global';
  if (id.startsWith('local')) {
    region = 'local';
  } else if (id.startsWith('regional')) {
    region = 'regional';
  } else if (id.startsWith('global')) {
    region = 'global';
  } else {
    throw new Error(`Unknown region for ${id}`);
  }
  if ( ! Number.isFinite(Number(currentState[id]))) {
    currentState[id] = defaultValue;
  }
  if (typeof currentState[id] !== 'number') {
    currentState[id] = parseFloat(currentState[id]);
  }
  d3.select("div#"+region)
    .select("input#"+id).property("value", currentState[id]);
};

function loadAllEarthquakeQueryParams(currentState) {
  loadEarthquakeQueryParam(currentState, 'localMinLat');
  loadEarthquakeQueryParam(currentState, 'localMaxLat');
  loadEarthquakeQueryParam(currentState, 'localMinLon');
  loadEarthquakeQueryParam(currentState, 'localMaxLon');
  loadEarthquakeQueryParam(currentState, 'regionalMaxRadius');
  loadEarthquakeQueryParam(currentState, 'regionalMinMag');
  loadEarthquakeQueryParam(currentState, 'globalMinMag');
}

const loadEarthquakeQueryParam = function(currentState, id) {
  let region = 'global';
  if (id.startsWith('local')) {
    region = 'local';
  } else if (id.startsWith('regional')) {
    region = 'regional';
  } else if (id.startsWith('global')) {
    region = 'global';
  } else {
    throw new Error(`Unknown region for ${id}`);
  }
  let inputVal = d3.select("div#"+region)
    .select("input#"+id).property("value");
  if ( Number.isFinite(Number(inputVal))) {
    currentState[id] = parseFloat(inputVal);
  } else {
    throw new Error(`Value for input ${id} is not a valid number: ${inputVal}`);
  }
}

// Check browser state, in case of back or forward buttons
let currentState = window.history.state;

if (currentState) {
  updateAmpRadioButtons(currentState);
  if (currentState.station) {
    console.log(`load existing state: ${JSON.stringify(currentState, null, 2)}`);
    state = currentState;
    loadAndPlot(state);
  }
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
    loadAndPlot(state);
  }
};


let protocol = 'http:';
if ("https:" == document.location.protocol) {
  protocol = 'https:'
}
let wsProtocol = 'ws:';
if (protocol == 'https:') {
  wsProtocol = 'wss:';
}

let paused = false;
let stopped = false;
let numSteps = 0;

let heli = null;


let chooserEnd;
if ( state.endTime) {
  if (state.endTime === "now") {
    chooserEnd = getNowTime();
  } else {
    chooserEnd = seisplotjs.util.isoToDateTime(state.endTime);
  }
} else {
  state.endTime = "now";
  chooserEnd = luxon.DateTime.utc();
}
const chooserStart = chooserEnd.minus(luxon.Duration.fromISO(state.duration));

let throttleRedisplay = null;
let throttleRedisplayDelay = 500;

let dateChooser = document.querySelector("sp-datetime");
dateChooser.time = chooserStart;
dateChooser.updateCallback = time => {
  if (throttleRedisplay) {
    window.clearTimeout(throttleRedisplay);
  }
  throttleRedisplay = window.setTimeout(() => {
    let updatedTime = time.plus(luxon.Duration.fromISO(state.duration));
    state.endTime = updatedTime.toISO();
    loadAndPlot(state);
  }, throttleRedisplayDelay);
};
let updateDateChooser = function(state) {
  if ( state.endTime && state.duration) {
    dateChooser.updateTime(seisplotjs.util.isoToDateTime(state.endTime).minus(luxon.Duration.fromISO(state.duration)));
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
    .attr("name", "station")
    .attr("value", function(d, i) {return i;})
    .property("checked", function(d, i) {return d===state.station;})
    .on("click", function(d) {
      state.station = d3.select(this).text();
      loadAndPlot(state);
    })
    .text(function(d) {return d;});
  d3.select("#scsnStations").selectAll("input").on("change", function(){
      console.log(this.value)
  });

d3.select("button#loadNow").on("click", function(d) {
  state.endTime = getNowTime().toISO();
  console.log(`now ${state.endTime}`);
  updateDateChooser(state);
  loadAndPlot(state);
});

d3.select("button#loadToday").on("click", function(d) {
  state.endTime = luxon.DateTime.utc().endOf('day').plus({millisecond: 1}).toISO();
  console.log(`today ${state.endTime}`);
  updateDateChooser(state);
  loadAndPlot(state);
});

d3.select("button#loadPrev").on("click", function(d) {
  let e = state.endTime;
  if (  !e || e === 'now' ) {
    e = getNowTime();
  } else {
    e = luxon.DateTime.fromISO(e).toUTC();
  }
  state.endTime = e.minus({days: 1}).toISO();
  console.log(`prev ${state.endTime}`);
  updateDateChooser(state);
  loadAndPlot(state);
});

d3.select("button#loadNext").on("click", function(d) {
  let e = state.endTime;
  if ( !e || e === 'now' ) {
    e = getNowTime();
  } else {
    e = luxon.DateTime.fromISO(e).toUTC();
  }
  state.endTime = e.plus({day: 1}).toISO();
  console.log(`next ${state.endTime}`);
  updateDateChooser(state);
  loadAndPlot(state);
});

let orientButtonSpan = d3.select("#orientations")
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
    .attr("name", "orientation")
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
      loadAndPlot(state);
    })
    .text(function(d) {return d;});
  d3.select("div.orientations").selectAll("input").on("change", function(){
      console.log(this.value)
  });


  let instButtonSpan = d3.select("#instruments")
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
      .attr("name", "instrument")
      .attr("value", function(d, i) {return i;})
      .property("checked", function(d, i) {
        return d.charAt(0)===state.bandCode && d.charAt(1)===state.instCode;
      })
      .on("click", function(d) {
        let bandInst = d3.select(this).text();
        state.bandCode = bandInst.charAt(0);
        state.instCode = bandInst.charAt(1);
        console.log(`click ${state.bandCode}${state.instCode}`);
        loadAndPlot(state);
      })
      .text(function(d) {return d;});


      let loccodeButtonSpan = d3.select("#loccode")
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
          .attr("name", "loccode")
          .attr("value", function(d, i) {return i;})
          .property("checked", function(d, i) {
            return d===state.locCode;
          })
          .on("click", function(d) {
            let locCode = d3.select(this).text();
            state.locCode = locCode;
            console.log(`click ${state.locCode} ${state.bandCode}${state.instCode}`);
            loadAndPlot(state);
          })
          .text(function(d) {return d;});

const handleAmpChange = function(value) {
  console.log(`handleAmpChange ${value}`)
  if (value === "max") {
    state.amp = value;
  } else if (typeof value === 'string' && value.endsWith('%')) {
    state.amp = value;
  } else if (Number.isFinite(value)) {
    state.amp = value;
  } else {
    // assume empty/bad value in text box
    state.amp = 10000;
    d3.select("#amp")
      .select("input#fixedAmpText").property("value", state.amp);
  }
  updateAmpRadioButtons(state);
  if (heliHash) {
    // already have data
    heliHash.amp = state.amp;
    Promise.all([heliHash, heliHash.amp]).then(hArr => redrawHeli(hArr[0]));
  } else {
    loadAndPlot(state);
  }
}
d3.select("#amp")
  .select("input#maxAmp")
  .on("click", d => {
    handleAmpChange("max");
  });

d3.select("#amp")
  .select("input#fixedAmp")
  .on("click", d => {
    let value = Number(d3.select("input#fixedAmpText").property("value"));
    handleAmpChange(value);
  });
d3.select("#amp")
  .select("input#fixedAmpText")
  .on("keypress", function(e) {
    if(e.keyCode === 13) {
      // return  is 13
      let value = Number(d3.select("input#fixedAmpText").property("value"));
      handleAmpChange(value);
    }
}).on("change", () => {
  let value = Number(d3.select("input#fixedAmpText").property("value"));
  handleAmpChange(value);
});

d3.select("#amp")
  .select("input#percentAmp")
  .on("click", d => {
    let value = d3.select("input#percentAmpSlider").property("value");
    handleAmpChange(`${value}%`);
  });
d3.select("#percentAmpSlider").on("input", function() {
  handleAmpChange(`${this.value}%`);
});


d3.select("button#refreshEarthquakes").on("click", function(d) {
  loadAllEarthquakeQueryParams(state);
  loadAndPlot(state);
});


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
  nowHour = getNowTime();
  const luxDur = luxon.Duration.fromISO(duration);
  timeWindow = luxon.Interval.before(nowHour, luxDur);
  console.log("reset time window for "+timeWindow.start+" "+timeWindow.end );

  heli.config.fixedTimeScale = timeWindow;
  heli.draw();
}, timerInterval);

let errorFn = function(error) {
  console.log("error: "+error);
  svgParent.select("p").text("Error: "+error);
};
