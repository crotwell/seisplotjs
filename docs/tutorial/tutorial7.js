import * as seisplotjs from './seisplotjs_3.0.0-alpha.0_standalone.mjs';

// snip start vars
const matchPattern = `CO_JSC_00_HH./MSEED`;
seisplotjs.d3.select('span#channel').text(matchPattern);
const duration = seisplotjs.luxon.Duration.fromISO('PT5M');
const timeWindow = new seisplotjs.util.StartEndDuration(null, null, duration);
const seisPlotConfig = new seisplotjs.seismographconfig.SeismographConfig();
seisPlotConfig.wheelZoom = false;
seisPlotConfig.linkedTimeScale.offset = seisplotjs.luxon.Duration.fromMillis(-1*duration.toMillis());
seisPlotConfig.linkedTimeScale.duration = duration;
seisPlotConfig.linkedAmplitudeScale = new seisplotjs.scale.IndividualAmplitudeScale();
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
    let seisSegment = seisplotjs.miniseed.createSeismogramSegment(packet.miniseed);
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
        console.log(`id response: ${serverId}`);
        return datalink.match(matchPattern);
      }).then(response => {
        console.log(`match response: ${response}`)
        return datalink.positionAfter(timeWindow.start);
      }).then(response => {
        console.log(`positionAfter response: ${response}`)
        return datalink.stream();
      }).catch( function(error) {
        seisplotjs.d3.select("div#debug").append('p').html("Error: " +error);
        console.assert(false, error);
      });
    }
    seisplotjs.d3.select("button#disconnect").text("Disconnect");
  }
}
// snip start go
toggleConnect();
