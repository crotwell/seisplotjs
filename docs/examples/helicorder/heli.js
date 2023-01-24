import * as seisplotjs from '../../seisplotjs_3.0.0-alpha.4_standalone.mjs';
import {HOURS_PER_LINE, doPlot, queryEarthquakes, redrawHeli, getNowTime, drawSeismograph} from './doplot.js';
import {updatePageForConfig, setupEventHandlers, enableFiltering} from './controls.js';

const d3 = seisplotjs.d3;
const luxon = seisplotjs.luxon;

const staList = ['BARN', 'BIRD', 'C1SC', 'CASEE', 'CSB', 'HAW', 'HODGE', 'JKYD', 'JSC', 'PAULI', 'SUMMV', 'TEEBA'];
const DEFAULT_FIXED_AMP = 10000;

// state preserved for browser history
// also see near bottom where we check if page history has state obj and use that
let state = {
  netCodeList: ['CO','N4'],
  stationList: staList,
  bandCodeList: ['H', 'L'],
  instCodeList: ['H', 'N'],
  orientationCodeList: ['Z','N','E','1','2'],
  netCode: 'CO',
  station: null,
  locCode: '00',
  bandCode: "H",
  instCode: "H",
  orientationCode: 'Z',
  altOrientationCode: "",
  endTime: "now",
  duration: 'P1D',
  dominmax: true,
  amp: "max",
  rmean: false,
  filter: {
    type: "allpass",
    lowcut: '1.0',
    highcut: '10.0',
  },
};

let savedData = {
  config: state,

};

function loadAndPlot(config) {
  updatePageForConfig(config);
  doPlot(config).then(hash => {
    if (hash) {
      savedData = hash;
    }
  });
};

function redraw() {
    if (window.getComputedStyle(document.querySelector('#heli')).display === "none") {
      drawSeismograph(savedData);
    } else {
      if (savedData && savedData.seisData ) {
        // already have data
      redrawHeli(savedData);
    } else {
      loadAndPlot(state);
    }
  }
}


// Check browser state, in case of back or forward buttons
let currentState = window.history.state;

if (currentState) {
  updatePageForConfig(currentState);
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
    updatePageForConfig(state);
    loadAndPlot(state);
  }
};



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


setupEventHandlers(state, loadAndPlot, redraw);



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
  timeRange = luxon.Interval.before(nowHour, luxDur);
  console.log("reset time window for "+timeRange.start+" "+timeRange.end );

  heli.config.fixedTimeScale = timeRange;
  heli.draw();
}, timerInterval);

let errorFn = function(error) {
  console.log("error: "+error);
  svgParent.select("p").text("Error: "+error);
};
