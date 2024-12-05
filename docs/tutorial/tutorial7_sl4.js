// snip start vars
import * as sp from "../seisplotjs_3.1.5-SNAPSHOT_standalone.mjs";
sp.util.updateVersionText(".sp_version");

const duration = sp.luxon.Duration.fromISO("PT5M");
const timeWindow = new sp.util.durationEnd(duration, sp.luxon.DateTime.utc());
const seisPlotConfig = new sp.seismographconfig.SeismographConfig();
seisPlotConfig.wheelZoom = false;
seisPlotConfig.isYAxisNice = false;
seisPlotConfig.linkedTimeScale.offset = sp.luxon.Duration.fromMillis(
  -1 * duration.toMillis(),
);
seisPlotConfig.linkedTimeScale.duration = duration;
seisPlotConfig.linkedAmplitudeScale = new sp.scale.IndividualAmplitudeScale();
seisPlotConfig.doGain = true;
let graphList = new Map();
let numPackets = 0;
let paused = false;
let stopped = true;
let redrawInProgress = false;
let realtimeDiv = document.querySelector("div#realtime");
let rect = realtimeDiv.getBoundingClientRect();
let timerInterval =
  duration.toMillis() /
  (rect.width - seisPlotConfig.margin.left - seisPlotConfig.margin.right);
while (timerInterval < 50) {
  timerInterval *= 2;
}
const errorFn = function (error) {
  console.assert(false, error);
  if (datalink) {
    datalink.close();
  }
  document.querySelector("p#error").textContent = "Error: " + error;
};

// snip start handle
const packetHandler = function (packet) {
  if (packet.isMiniseed()) {
    numPackets++;
    document.querySelector("span#numPackets").textContent = numPackets;
    let seisSegment = sp.miniseed.createSeismogramSegment(packet.miniseed);
    const codes = seisSegment.codes();
    let seisPlot = graphList.get(codes);
    if (!seisPlot) {
      let seismogram = new sp.seismogram.Seismogram([seisSegment]);
      let seisData =
        sp.seismogram.SeismogramDisplayData.fromSeismogram(seismogram);
      seisData.alignmentTime = sp.moment.utc();
      let plotDiv = realtimeDiv.append("div").classed("seismograph", true);
      seisPlot = new sp.seismograph.Seismograph(
        plotDiv,
        seisPlotConfig,
        seisData,
      );
      graphList.set(codes, seisPlot);
      console.log(`new plot: ${codes}`);
    } else {
      seisPlot.seisDataList[0].seismogram.append(seisSegment);
    }
    seisPlot.draw();
  } else {
    console.log(`not a mseed packet: ${packet.streamId}`);
  }
};
let requstConfig = ["STATION CO_JSC", "SELECT 00_H_H_?", "END"];
const LOCAL_SEEDLINK_V4 = "wss://eeyore.seis.sc.edu/testringserver/seedlink";

document.querySelector("span#channel").textContent = requstConfig.join(" ");

// snip start seedlink
const seedlink = new sp.seedlink4.SeedlinkConnection(
  LOCAL_SEEDLINK_V4,
  packetHandler,
  errorFn,
);

// snip start timer
let timer = window.setInterval(function (elapsed) {
  if (paused || redrawInProgress) {
    return;
  }
  redrawInProgress = true;
  window.requestAnimationFrame((timestamp) => {
    try {
      const now = sp.util.isoToDateTime("now");
      graphList.forEach(function (graph, key) {
        graph.seisDataList.forEach((sdd) => {
          sdd.alignmentTime = now;
        });
        graph.calcTimeScaleDomain();
        graph.calcAmpScaleDomain();
        graph.draw();
      });
    } catch (err) {
      console.assert(false, err);
    }
    redrawInProgress = false;
  });
}, timerInterval);

// snip start pause

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
  } else {
    document.querySelector("button#pause").textContent = "Pause";
  }
};

// snip start disconnet
document
  .querySelector("button#disconnect")
  .addEventListener("click", function (evt) {
    toggleConnect();
  });

function addToDebug(message) {
  const debugDiv = document.querySelector("div#debug");
  if (!debugDiv) {
    return;
  }
  const pre = debugDiv.appendChild(document.createElement("pre"));
  const code = pre.appendChild(document.createElement("code"));
  code.textContent = message;
}

let toggleConnect = function () {
  stopped = !stopped;
  if (stopped) {
    if (seedlink) {
      seedlink.close();
    }
    document.querySelector("button#disconnect").textContent = "Reconnect";
  } else {
    if (seedlink) {
      seedlink
        .interactiveConnect()
        .then(() => {
          return seedlink.sendHello();
        })
        .then( (lines) => {
          console.log(`got lines: ${lines[0]}`);
          if (seedlink.checkProto(lines)) {
            addToDebug("HELLO: ");
            addToDebug(" " + lines[0]);
            addToDebug(" " + lines[1]);
            return true;
          } else {
            throw new Error(
              `${sp.seedlink4.SEEDLINK4_PROTOCOL} not found in HELLO response`,
            );
          }
        }).then(() => {
          return seedlink.sendCmdArray(requstConfig);
        })
        .catch(function (error) {
          addToDebug(`Error: ${error.name} - ${error.message}`);
          console.assert(false, error);
        });
    }
    document.querySelector("button#disconnect").textContent = "Disconnect";
  }
};
// snip start go
toggleConnect();
