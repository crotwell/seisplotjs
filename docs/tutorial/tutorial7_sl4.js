// snip start vars
import * as seisplotjs from '../seisplotjs_3.0.0-alpha.4_standalone.mjs';

const stationPattern = `CO JSC`;
const selectPattern = `00.HH?`;
seisplotjs.d3.select('span#channel').text(`${stationPattern} ${selectPattern}`);
const timeWindow = new seisplotjs.util.durationEnd(5*60, 'now');
const seisPlotConfig = new seisplotjs.seismographconfig.SeismographConfig();
seisPlotConfig.wheelZoom = false;
seisPlotConfig.linkedTimeScale.duration = timeWindow.toDuration();
let graphList = new Map();
let numPackets = 0;
let paused = false;
let stopped = true;
let redrawInProgress = false;
let realtimeDiv = seisplotjs.d3.select("div#realtime");
let rect = realtimeDiv.node().getBoundingClientRect();
let timerInterval = timeWindow.toDuration().toMillis()/
                    (rect.width-seisPlotConfig.margin.left-seisPlotConfig.margin.right);
console.log("start time with interval "+timerInterval);
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
        seisData.alignmentTime = seisplotjs.moment.utc();
        let plotDiv = realtimeDiv.append("div").classed("seismograph", true);
        seisPlot = new seisplotjs.seismograph.Seismograph(plotDiv, seisPlotConfig, seisData);
        graphList.set(codes, seisPlot);
        console.log(`new plot: ${codes}`)
      } else {
        seisPlot.seisDataList[0].seismogram.append(seisSegment);
      }
      seisPlot.draw();
  } else {
    console.log(`not a mseed packet: ${packet.streamId}`)
  }
};
let requstConfig = [
  "ACCEPT 2",
  "STATION WLF GE",
  "SELECT *.BH?"
];
// snip start seedlink
const seedlink = new seisplotjs.seedlink4.SeedlinkConnection(
    "ws://geofon-open2.gfz-potsdam.de:18000",
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
      const now = seisplotjs.util.isoToDateTime('now');
      graphList.forEach(function(graph, key) {
        graph.seisDataList.forEach(sdd => {
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
    if (seedlink) {
      seedlink.close();
    }
    seisplotjs.d3.select("button#disconnect").text("Reconnect");
  } else {
    if (seedlink) {
      seedlink.interactiveConnect().then(() => {
        return that.sendHello();
      }).then(function(lines) {
        console.log(`got lines: ${lines[0]}`)
        if (this.checkProto(lines)) {
          seisplotjs.d3.select("div#debug").append('p').text("HELLO: ");
          seisplotjs.d3.select("div#debug").append('p').text(" "+lines[0]);
          seisplotjs.d3.select("div#debug").append('p').text(" "+lines[1]);
          return true;
        } else {
          throw new Exception(`${SEEDLINK4_PROTOCOL} not found in HELLO response`);
        }
      }).catch( function(error) {
        seisplotjs.d3.select("div#debug").append('p').text(`Error: ${error.name} - ${error.message}`);
        console.assert(false, error);
      });
    }
    seisplotjs.d3.select("button#disconnect").text("Disconnect");
  }
}
// snip start go
toggleConnect();
