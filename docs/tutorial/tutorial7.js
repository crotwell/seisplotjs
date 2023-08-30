import * as sp from '../seisplotjs_3.1.0-alpha2_standalone.mjs';

// snip start vars
const matchPattern = `CO_BIRD_00_HH./MSEED`;
document.querySelector('span#channel').textContent = matchPattern;
const duration = sp.luxon.Duration.fromISO('PT5M');

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
rtDisp.animationScaler.minRedrawMillis = sp.animatedseismograph.calcOnePixelDuration(rtDisp.organizedDisplay);

rtDisp.animationScaler.animate();

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
  if (!debugDiv) { return; }
  const pre = debugDiv.appendChild(document.createElement("pre"));
  const code = pre.appendChild(document.createElement("code"));
  code.textContent = message;
}
function errorFn(error) {
  console.assert(false, error);
  if (datalink) { datalink.close(); }
  addToDebug("Error: " + error);
};

// snip start datalink
let datalink = null;
const IRIS_DATALINK = "wss://rtserve.iris.washington.edu/datalink"
const SCSN_DATALINK = "wss://eeyore.seis.sc.edu/ringserver/datalink"

let toggleConnect = function() {
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
        SCSN_DATALINK,
        packet => {
          rtDisp.packetHandler(packet);
          updateNumPackets();
        },
        errorFn
      );
    }
    if (datalink) {
      datalink.connect()
        .then(serverId => {
          return datalink.match(matchPattern);
        }).then(response => {
          addToDebug(`match response: ${response}`)
          if (response.isError()) {
            addToDebug(`response is not OK, ignore... ${response}`);
          }
          const start = sp.luxon.DateTime.utc().minus(duration);
          console.log(`start datalink at : ${start}`)
          return datalink.positionAfter(start);
        }).then(response => {
          if (response.isError()) {
            addToDebug(`Oops, positionAfter response is not OK, ignore... ${response}`);
            // bail, ignore, or do something about it...
          }
          return datalink.stream();
        });
    }
  }
}

// snip start disconnet
document.querySelector("button#disconnect").addEventListener("click", function(evt) {
  toggleConnect();
});

// snip start pause
document.querySelector("button#pause").addEventListener("click", function(evt) {
  togglePause();
});

let togglePause = function() {
  paused = !paused;
  if (paused) {
    document.querySelector("button#pause").textContent = "Play";
    rtDisp.animationScaler.pause();
  } else {
    document.querySelector("button#pause").textContent = "Pause";
    rtDisp.animationScaler.animate();
  }
}

// snip start go
toggleConnect();
