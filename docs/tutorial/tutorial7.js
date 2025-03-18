import * as sp from "../seisplotjs_3.1.5-SNAPSHOT_standalone.mjs";
document.querySelector(".sp_version").textContent = sp.version;

// snip start vars
// Datalink on older versions of Ringserver, DLPROTO1.0, use NSLC ids like:
const matchPatternV3 = `CO_HAW_00_HH./MSEED`;
// while datalink on version 4 of Ringserver, DLPROTO1.1, uses FDSN Source ids like:
const matchPatternV4 = `FDSN:CO_HAW_00_H_H_./MSEED`;
// this regex pattern will match both, but is a little clunky
const matchPatternBoth = `(FDSN:)?CO_HAW_00_H_?H_?./MSEED`;
// An alternative is to use a different pattern, V3 or V4, based on the
// returned DLPTOTO version from the serverId. See below for an example.

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
rtDisp.animationScaler.animate();

// snip start nowtime
const n_span = document.querySelector("#nt");
setInterval(() => {
  const now = sp.luxon.DateTime.utc().toISO();
  n_span.textContent = `Now: ${now}`;
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
  if (datalink) {
    datalink.close();
  }
  addToDebug("Error: " + error);
}

// snip start datalink
let datalink = null;
const IRIS_DATALINK = "wss://rtserve.iris.washington.edu/datalink";
const SCSN_DATALINK = "wss://eeyore.seis.sc.edu/testringserver/datalink";
const DATALINK_URL = IRIS_DATALINK;

let toggleConnect = function () {
  stopped = !stopped;
  if (stopped) {
    document.querySelector("button#disconnect").textContent = "Reconnect";
    if (datalink) {
      datalink.endStream();
      datalink.close();
    }
  } else {
    document.querySelector("button#disconnect").textContent = "Disconnect";
    if (!datalink) {
      datalink = new sp.datalink.DataLinkConnection(
        DATALINK_URL,
        (packet) => {
          rtDisp.packetHandler(packet);
          updateNumPackets();
        },
        errorFn,
      );
    }
    if (datalink) {
      datalink
        .connect()
        .then((serverId) => {

          addToDebug("ServerId: " + serverId);
          // here we use the match pattern corresponding to the version of
          // ringserver (via DLPROTO) that we are connecting to
          if (serverId.includes("DLPROTO:1.0")) {
            document.querySelector("span#channel").textContent = matchPatternV3;
            return datalink.match(matchPatternV3);
          } else {
            document.querySelector("span#channel").textContent = matchPatternV4;
            return datalink.match(matchPatternV4);
          }
        })
        .then((response) => {
          addToDebug(`match response: ${response}`);
          if (response.isError()) {
            addToDebug(`response is not OK, ignore... ${response}`);
          }
          const start = sp.luxon.DateTime.utc().minus(duration);
          console.log(`start datalink at : ${start}`);
          return datalink.positionAfter(start);
        })
        .then((response) => {
          if (response.isError()) {
            addToDebug(
              `Oops, positionAfter response is not OK, ignore... ${response}`,
            );
            // bail, ignore, or do something about it...
          }
          return datalink.stream();
        });
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
