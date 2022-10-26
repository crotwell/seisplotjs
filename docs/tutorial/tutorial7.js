import * as seisplotjs from '../seisplotjs_3.0.0-alpha.4_standalone.mjs';

// snip start vars
const matchPattern = `CO_JSC_00_HH./MSEED`;
seisplotjs.d3.select('span#channel').text(matchPattern);
const duration = seisplotjs.luxon.Duration.fromISO('PT5M');
const timeWindow = new seisplotjs.util.durationEnd(duration, seisplotjs.luxon.DateTime.utc());
const seisPlotConfig = new seisplotjs.seismographconfig.SeismographConfig();
seisPlotConfig.wheelZoom = false;
seisPlotConfig.isYAxisNice = false;
seisPlotConfig.linkedTimeScale.offset = seisplotjs.luxon.Duration.fromMillis(-1*duration.toMillis());
seisPlotConfig.linkedTimeScale.duration = duration;
seisPlotConfig.linkedAmplitudeScale = new seisplotjs.scale.IndividualAmplitudeScale();
seisPlotConfig.doGain = true;
seisPlotConfig.centeredAmp = false;
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
  seisplotjs.d3.select("p#error").text("Error: "+error);
};

// snip start handle
const packetHandler = function(packet) {
  if (packet.isMiniseed()) {
    numPackets++;
    seisplotjs.d3.select("span#numPackets").text(numPackets);
    let seisSegment = seisplotjs.miniseed.createSeismogramSegment(packet.asMiniseed());
    const codes = seisSegment.codes();
    let seisPlot = graphList.get(codes);
    if ( ! seisPlot) {
        let seismogram = new seisplotjs.seismogram.Seismogram( [ seisSegment ]);
        let seisData = seisplotjs.seismogram.SeismogramDisplayData.fromSeismogram(seismogram);
        seisData.alignmentTime = seisplotjs.luxon.DateTime.utc();
        seisPlot = new seisplotjs.seismograph.Seismograph([seisData], seisPlotConfig);
        realtimeDiv.appendChild(seisPlot);
        graphList.set(codes, seisPlot);
        console.log(`new plot: ${codes}`)
      } else {
        seisPlot.seisData[0].seismogram.append(seisSegment);
        seisPlot.recheckAmpScaleDomain();
      }
      seisPlot.draw();
  } else {
    console.log(`not a mseed packet: ${packet.streamId}`)
  }
};
// snip start datalink
const datalink = new seisplotjs.datalink.DataLinkConnection(
    "ws://thecloud.seis.sc.edu/ringserver/datalink",
    packetHandler,
    errorFn);

// snip start timer
let timer = seisplotjs.d3.interval(function(elapsed) {
  if ( paused || redrawInProgress) {
    return;
  }
  redrawInProgress = true;
  window.requestAnimationFrame(timestamp => {
    try {
      const now = seisplotjs.luxon.DateTime.utc();
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
seisplotjs.d3.select("button#pause").on("click", function(d) {
  togglePause( );
});

let togglePause = function() {
  paused = ! paused;
  if (paused) {
    seisplotjs.d3.select("button#pause").text("Play");
  } else {
    seisplotjs.d3.select("button#pause").text("Pause");
  }
}

// snip start disconnet
seisplotjs.d3.select("button#disconnect").on("click", function(d) {
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
    seisplotjs.d3.select("button#disconnect").text("Reconnect");
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
        let hhzStream = response.streams.find(s=> s.name === "CO_JSC_00_HHZ/MSEED");
        return datalink.positionAfter(hhzStream.latestPacketDataEndTime.plus({second: 10}));
      }).then(response => {
        if (response.isError()) {
          addToDebug(`Oops, positionAfter response is not OK, ignore... ${response}`);
          // bail, ignore, or do something about it...
        }
        return datalink.stream();
      }).catch( function(error) {
        let errMsg = `${error}`;
        if (error.cause && error.cause instanceof seisplotjs.datalink.DataLinkResponse) {
          errMsg = `${error}, ${errMsg.cause}`;
        }
        addToDebug("Error: " +errMsg);
        console.assert(false, error);
      });
    }
    seisplotjs.d3.select("button#disconnect").text("Disconnect");
  }
}
// snip start go
toggleConnect();
