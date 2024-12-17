import * as sp from "../seisplotjs_3.1.5-SNAPSHOT_standalone.mjs";
document.querySelector(".sp_version").textContent = sp.version;

// snip start vars
const duration = sp.luxon.Duration.fromISO("PT5M");

let numPackets = 0;
let paused = false;
let stopped = true;
let realtimeDiv = document.querySelector("div#realtime");

// snip start timer
const rtConfig = {
  duration: sp.luxon.Duration.fromISO("PT5M"),
};
const rtDisp = sp.animatedseismograph.createRealtimeDisplay(rtConfig);
realtimeDiv.appendChild(rtDisp.organizedDisplay);
rtDisp.organizedDisplay.draw();
rtDisp.animationScaler.minRedrawMillis =
  sp.animatedseismograph.calcOnePixelDuration(rtDisp.organizedDisplay);
rtDisp.animationScaler.minRedrawMillis =1000
rtDisp.animationScaler.animate();

// snip start nowtime
const n_span = document.querySelector("#nt");
setInterval(() => {
  const seisConfig = rtDisp.organizedDisplay.seismographConfig;
  const lts = seisConfig.linkedTimeScale;
  const now = sp.luxon.DateTime.utc().toISO();
  n_span.textContent = `${now} ${rtDisp.animationScaler.alignmentTime} ts:${rtDisp.animationScaler.timeScale.offset}`;
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

// snip start handle

let requestConfig = [
  "STATION CO_JSC",
  "SELECT 00_H_H_Z",
  'STATION IU_SNZO',
  'SELECT 00_B_H_Z'
];
let start = sp.luxon.DateTime.utc().minus(duration);
let dataCmd = sp.seedlink4.createDataTimeCommand(start);
let requestConfigWithData = requestConfig.concat([ dataCmd ])
let endCommand = "END";
const LOCAL_SEEDLINK_V4 = "wss://eeyore.seis.sc.edu/testringserver/seedlink";

document.querySelector("span#channel").textContent = requestConfig.join(" ");

// snip start seedlink
let seedlink = null;

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
      seedlink = new sp.seedlink4.SeedlinkConnection(
        LOCAL_SEEDLINK_V4,
        requestConfigWithData,
        (packet) => {
          rtDisp.packetHandler(packet);
          updateNumPackets();
        },
        errorFn,
      );
      seedlink.endCommand = endCommand;
    }
    if (seedlink) {
      start = sp.luxon.DateTime.utc().minus(duration);
      dataCmd = sp.seedlink4.createDataTimeCommand(start);
      requestConfigWithData = requestConfig.concat([ dataCmd ])
      seedlink.requestConfig = requestConfigWithData;
      seedlink
        .connect()
        .catch(function (error) {
          addToDebug(`Error: ${error.name} - ${error.message}`);
          console.assert(false, error);
        });    }
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
