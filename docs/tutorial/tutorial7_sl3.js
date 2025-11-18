import * as sp from "../seisplotjs_3.2.0-SNAPSHOT_standalone.mjs";

document.querySelector(".sp_version").textContent = sp.version;

// snip start vars
let requestConfig = [
  'STATION JSC CO',
  'SELECT 00HHZ.D',
  'STATION SNZO IU',
  'SELECT 00BHZ.D',
];

let stationText = "";
let netCodeList = new Set();
let staCodeList = new Set();
let locCodeList = new Set();
let chanCodeList = new Set();
for (const rLine of requestConfig) {
  const items = rLine.split(/\s+/);
  if (items[0] === "STATION") {
    stationText += ` ${items[2]}.${items[1]}`;
    netCodeList.add(items[2]);
    staCodeList.add(items[1]);
  } else if (items[0] === "SELECT") {
    let locChan = items[1].split('.')[0];
    if (locChan.length === 5) {
      locCodeList.add(locChan.slice(0, 2));
    } else {
      locCodeList.add("--");
    }
    chanCodeList.add(locChan.slice(-3));
  }
}

let staxmlNetList = [];

// optionally load stationxml to get count to earth units conversion
// this will display seismographs in m/s instead of count
let fdsnStaQuery = new sp.fdsnstation.StationQuery();
let netStr = "";
for (const n of netCodeList.values()) { netStr += `${n},`;}
fdsnStaQuery.networkCode( netStr.slice(0, -1));
let staStr = "";
for (const s of staCodeList.values()) { staStr += `${s},`;}
fdsnStaQuery.stationCode( staStr.slice(0, -1));
let locStr = "";
for (const l of locCodeList.values()) { locStr += `${l},`;}
fdsnStaQuery.locationCode( locStr.slice(0, -1));
let chanStr = "";
for (const c of chanCodeList.values()) { chanStr += `${c},`;}
fdsnStaQuery.channelCode( chanStr.slice(0, -1));
console.log(fdsnStaQuery.formURL(sp.fdsnstation.LEVEL_CHANNEL));
staxmlNetList = await fdsnStaQuery.queryChannels();
// end load stationxml


document.querySelector("span#station").textContent = stationText;
const duration = sp.luxon.Duration.fromISO("PT5M");

let numPackets = 0;
let paused = false;
let stopped = true;
let realtimeDiv = document.querySelector("div#realtime");

// snip start timer
const rtConfig = {
  duration: duration,
  networkList: staxmlNetList,
};
const rtDisp = sp.animatedseismograph.createRealtimeDisplay(rtConfig);
// each seismograph on its own min-max amplitude scale, remove for all on same min-max
//rtDisp.organizedDisplay.seismographConfig.linkedAmplitudeScale = new sp.scale.IndividualAmplitudeScale();
rtDisp.organizedDisplay.map = "false";

realtimeDiv.appendChild(rtDisp.organizedDisplay);
rtDisp.organizedDisplay.draw();
rtDisp.animationScaler.animate();

// snip start nowtime
const n_span = document.querySelector("#nt");
setInterval(() => {
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

const SEEDLINK = IRIS_SEEDLINK;

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
        SEEDLINK,
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
      seedlink.connect().then( () => {
        addToDebug("Hello: " + seedlink.helloLines);
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
