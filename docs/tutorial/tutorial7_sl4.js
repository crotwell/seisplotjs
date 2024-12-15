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
  if (seedlink) {
    seedlink.close();
  }
  addToDebug( "Error: " + error);
};

// snip start handle
const packetHandler = function (packet) {
  console.log(`in packetHandler: ${packet}`)
  if (packet.isMiniseed() || packet.isMiniseed3()) {
    let seisSegment;
    if (packet.isMiniseed()) {
      const mseed = packet.asMiniseed();
      console.log(`isMiniseed: ${mseed.header}`)

      seisSegment = sp.miniseed.createSeismogramSegment(mseed);
    } else if (packet.isMiniseed3()) {
      const mseed = packet.asMiniseed3();
      console.log(`isMiniseed3: ${mseed.header}`)

      seisSegment = sp.miniseed3.createSeismogramSegment(mseed);
    }
    numPackets++;
    document.querySelector("span#numPackets").textContent = numPackets;
    const codes = seisSegment.codes();
    let seisPlot = graphList.get(codes);
    if (!seisPlot) {
      let seismogram = new sp.seismogram.Seismogram([seisSegment]);
      let seisData =
        sp.seismogram.SeismogramDisplayData.fromSeismogram(seismogram);
      seisData.alignmentTime = sp.util.utcnow();
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
let requestConfig = ["STATION CO_JSC", "SELECT 00_H_H_?"];
let endCommand = "END";
const LOCAL_SEEDLINK_V4 = "wss://eeyore.seis.sc.edu/testringserver/seedlink";

document.querySelector("span#channel").textContent = requestConfig.join(" ");

// snip start seedlink
const seedlink = new sp.seedlink4.SeedlinkConnection(
  LOCAL_SEEDLINK_V4,
  requestConfig,
  packetHandler,
  errorFn,
);
seedlink.endCommand = endCommand;

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
        .connect()
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
