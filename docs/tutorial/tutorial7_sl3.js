import * as sp from "../seisplotjs_3.1.5-SNAPSHOT_standalone.mjs";

document.querySelector(".sp_version").textContent = sp.version;

// snip start vars

let requestConfig = [ 'STATION ADO CI',
                      'SELECT BHZ.D',
                      'STATION ARV CI',
                      'SELECT BHZ.D',
                      'STATION BAR CI',
                      'SELECT BHZ.D',
                      'STATION JSC CO',
                      'SELECT 00HHZ.D',
               ];
let stationText = "";
for (const rLine of requestConfig) {
  const items = rLine.split(/\s+/);
  if (items[0] === "STATION") {
    stationText += ` ${items[2]}.${items[1]}`;
  }
}
document.querySelector("span#station").textContent = stationText;
const duration = sp.luxon.Duration.fromISO("PT5M");

let numPackets = 0;
let paused = false;
let stopped = true;
let realtimeDiv = document.querySelector("div#realtime");

// snip start timer
const rtConfig = {
  duration: duration,
};
const rtDisp = sp.animatedseismograph.createRealtimeDisplay(rtConfig);
realtimeDiv.appendChild(rtDisp.organizedDisplay);
rtDisp.organizedDisplay.draw();
rtDisp.animationScaler.minRedrawMillis =
  sp.animatedseismograph.calcOnePixelDuration(rtDisp.organizedDisplay);

rtDisp.animationScaler.animate();

rtDisp.organizedDisplay.sortby = sp.sorting.SORT_ALPHABETICAL;

// snip start nowtime
const n_span = document.querySelector("#nt");
setInterval(() => {
  const seisConfig = rtDisp.organizedDisplay.seismographConfig;
  const lts = seisConfig.linkedTimeScale;
  n_span.textContent = sp.luxon.DateTime.utc().toISO();
}, 1000);

// snip start helpers
function updateNumPackets() {
  numPackets++;
  document.querySelector("#numPackets").textContent = numPackets;
}
function addToDebug(message) {
  const debugDiv = document.querySelector("div#debug");
  if (!debugDiv) {
    return;
  }
  const pre = debugDiv.appendChild(document.createElement("pre"));
  const code = pre.appendChild(document.createElement("code"));
  code.textContent = message;
}
function errorFn(error) {
  console.assert(false, error);
  if (seedlink) {
    seedlink.close();
  }
  addToDebug("Error: " + error);
}

// snip start seedlink
let seedlink = null;
const IRIS_SEEDLINK = "wss://rtserve.iris.washington.edu/seedlink";
const SCSN_SEEDLINK = "wss://eeyore.seis.sc.edu/ringserver/seedlink";


let toggleConnect = function () {
  stopped = !stopped;
  if (stopped) {
    document.querySelector("button#disconnect").textContent = "Reconnect";
    if (seedlink) {
      seedlink.close();
    }
  } else {
    document.querySelector("button#disconnect").textContent = "Disconnect";
    if (!seedlink) {
      seedlink = new sp.seedlink.SeedlinkConnection(
        IRIS_SEEDLINK,
        requestConfig,
        (packet) => {
          rtDisp.packetHandler(packet);
          updateNumPackets();
        },
        errorFn,
      );
    }
    if (seedlink) {
      const start = sp.luxon.DateTime.utc().minus(duration);
      seedlink.setTimeCommand(start)
      seedlink.connect();
    }
  }
};

// snip start disconnet
document
  .querySelector("button#disconnect")
  .addEventListener("click", function (evt) {
    toggleConnect();
  });

// snip start pause
document
  .querySelector("button#pause")
  .addEventListener("click", function (evt) {
    togglePause();
  });

let togglePause = function () {
  paused = !paused;
  if (paused) {
    document.querySelector("button#pause").textContent = "Play";
    rtDisp.animationScaler.pause();
  } else {
    document.querySelector("button#pause").textContent = "Pause";
    rtDisp.animationScaler.animate();
  }
};

// snip start go
toggleConnect();
