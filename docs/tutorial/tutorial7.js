import * as sp from '../seisplotjs_3.0.0-alpha.4_standalone.mjs';

// snip start vars
const matchPattern = `CO_JSC_00_HH./MSEED`;
sp.d3.select('span#channel').text(matchPattern);
const duration = sp.luxon.Duration.fromISO('PT5M');
const timeWindow = new sp.util.durationEnd(duration, sp.luxon.DateTime.utc());
const seisPlotConfig = new sp.seismographconfig.SeismographConfig();
seisPlotConfig.wheelZoom = false;
seisPlotConfig.isYAxisNice = false;
seisPlotConfig.linkedTimeScale.offset = sp.luxon.Duration.fromMillis(-1*duration.toMillis());
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
let timerInterval = duration.toMillis()/
                    (rect.width-seisPlotConfig.margin.left-seisPlotConfig.margin.right);
while (timerInterval < 100) { timerInterval *= 2;}

const errorFn = function(error) {
  console.assert(false, error);
  if (datalink) {datalink.close();}
  document.querySelector("p#error").textContent = "Error: "+error;
};

// snip start handle
const packetHandler = function(packet) {
  if (packet.isMiniseed()) {
    numPackets++;
    document.querySelector("span#numPackets").textContent = numPackets;
    let seisSegment = sp.miniseed.createSeismogramSegment(packet.asMiniseed());
    const codes = seisSegment.codes();
    let seisPlot = graphList.get(codes);
    if ( ! seisPlot) {
        let seismogram = new sp.seismogram.Seismogram( [ seisSegment ]);
        let seisData = sp.seismogram.SeismogramDisplayData.fromSeismogram(seismogram);
        seisData.alignmentTime = sp.luxon.DateTime.utc();
        seisPlot = new sp.seismograph.Seismograph([seisData], seisPlotConfig);
        realtimeDiv.appendChild(seisPlot);
        graphList.set(codes, seisPlot);
        console.log(`new plot: ${codes}`)
      } else {
        seisPlot.seisData[0].append(seisSegment);
        seisPlot.recheckAmpScaleDomain();
      }
      seisPlot.draw();
  } else {
    console.log(`not a mseed packet: ${packet.streamId}`)
  }
};
// snip start datalink
const datalink = new sp.datalink.DataLinkConnection(
    "ws://thecloud.seis.sc.edu/ringserver/datalink",
    packetHandler,
    errorFn);

// snip start timer
let timer = sp.d3.interval(function(elapsed) {
  if ( paused || redrawInProgress) {
    return;
  }
  redrawInProgress = true;
  window.requestAnimationFrame(timestamp => {
    try {
      const now = sp.luxon.DateTime.utc();
      graphList.forEach(function(graph, key) {
        graph.seisData.forEach(sdd => {
          sdd.alignmentTime = now;
        });
        graph.calcTimeScaleDomain();
        graph.calcAmpScaleDomain();
        graph.draw();
      });
    } catch(err) {
      console.assert(false, err);
    }
    redrawInProgress = false;
  });

  }, timerInterval);

// snip start pause
document.querySelector("button#pause").addEventListener("click", function(evt) {
  togglePause( );
});

let togglePause = function() {
  paused = ! paused;
  if (paused) {
    document.querySelector("button#pause").textContent = "Play";
  } else {
    document.querySelector("button#pause").textContent = "Pause";
  }
}

// snip start disconnet
document.querySelector("button#disconnect").addEventListener("click", function(evt) {
  toggleConnect();
});

function addToDebug(message) {
  const debugDiv = document.querySelector("div#debug");
  if (!debugDiv) { return; }
  const pre = debugDiv.appendChild(document.createElement("pre"));
  const code = pre.appendChild(document.createElement("code"));
  code.textContent = message;
}

let toggleConnect = function() {
  stopped = ! stopped;
  if (stopped) {
    if (datalink) {
      datalink.endStream();
      datalink.close();
    }
    document.querySelector("button#disconnect").textContent = "Reconnect";
  } else {
    if (datalink) {
      datalink.connect()
      .then(serverId => {
        addToDebug(`id response: ${serverId}`);
        return datalink.match(matchPattern);
      }).then(response => {
        addToDebug(`match response: ${response}`)
        if (response.isError()) {
          addToDebug(`response is not OK, ignore... ${response}`);
        }
        return datalink.infoStatus();
      }).then(response => {
        addToDebug(`info status response: ${response}`)
        return datalink.infoStreams();
      }).then(response => {
        addToDebug(`info streams response: ${response}`)
        return datalink.positionAfter(timeWindow.start);
      }).then(response => {
        if (response.isError()) {
          addToDebug(`Oops, positionAfter response is not OK, ignore... ${response}`);
          // bail, ignore, or do something about it...
        }
        return datalink.stream();
      }).catch( function(error) {
        let errMsg = `${error}`;
        if (error.cause && error.cause instanceof sp.datalink.DataLinkResponse) {
          errMsg = `${error}, ${errMsg.cause}`;
        }
        addToDebug("Error: " +errMsg);
        console.assert(false, error);
      });
    }
    document.querySelector("button#disconnect").textContent = "Disconnect";
  }
}
// snip start go
toggleConnect();
