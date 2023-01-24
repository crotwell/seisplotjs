// snip start vars
import * as sp from '../seisplotjs_3.0.0-alpha.4_standalone.mjs';

const stationPattern = `CO JSC`;
const selectPattern = `00.HH?`;
sp.d3.select('span#channel').text(`${stationPattern} ${selectPattern}`);
const timeWindow = new sp.util.durationEnd(5*60, 'now');
const seisPlotConfig = new sp.seismographconfig.SeismographConfig();
seisPlotConfig.wheelZoom = false;
seisPlotConfig.linkedTimeScale.duration = timeWindow.toDuration();
let graphList = new Map();
let numPackets = 0;
let paused = false;
let stopped = true;
let redrawInProgress = false;
let realtimeDiv = sp.d3.select("div#realtime");
let rect = realtimeDiv.node().getBoundingClientRect();
let timerInterval = timeWindow.toDuration().toMillis()/
                    (rect.width-seisPlotConfig.margin.left-seisPlotConfig.margin.right);
console.log("start time with interval "+timerInterval);
while (timerInterval < 100) { timerInterval *= 2;}

const errorFn = function(error) {
  console.assert(false, error);
  if (datalink) {datalink.close();}
  sp.d3.select("p#error").text("Error: "+error);
};

// snip start handle
const packetHandler = function(packet) {
  if (packet.isMiniseed()) {
    numPackets++;
    sp.d3.select("span#numPackets").text(numPackets);
    let seisSegment = sp.miniseed.createSeismogramSegment(packet.miniseed);
    const codes = seisSegment.codes();
    let seisPlot = graphList.get(codes);
    if ( ! seisPlot) {
        let seismogram = new sp.seismogram.Seismogram( [ seisSegment ]);
        let seisData = sp.seismogram.SeismogramDisplayData.fromSeismogram(seismogram);
        seisData.alignmentTime = sp.moment.utc();
        let plotDiv = realtimeDiv.append("div").classed("seismograph", true);
        seisPlot = new sp.seismograph.Seismograph(plotDiv, seisPlotConfig, seisData);
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
const seedlink = new sp.seedlink4.SeedlinkConnection(
    "ws://geofon-open2.gfz-potsdam.de:18000",
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
      const now = sp.util.isoToDateTime('now');
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
sp.d3.select("button#pause").on("click", function(d) {
  togglePause( );
});

let togglePause = function() {
  paused = ! paused;
  if (paused) {
    sp.d3.select("button#pause").text("Play");
  } else {
    sp.d3.select("button#pause").text("Pause");
  }
}

// snip start disconnet
sp.d3.select("button#disconnect").on("click", function(d) {
  toggleConnect();
});

let toggleConnect = function() {
  stopped = ! stopped;
  if (stopped) {
    if (seedlink) {
      seedlink.close();
    }
    sp.d3.select("button#disconnect").text("Reconnect");
  } else {
    if (seedlink) {
      seedlink.interactiveConnect().then(() => {
        return that.sendHello();
      }).then(function(lines) {
        console.log(`got lines: ${lines[0]}`)
        if (this.checkProto(lines)) {
          sp.d3.select("div#debug").append('p').text("HELLO: ");
          sp.d3.select("div#debug").append('p').text(" "+lines[0]);
          sp.d3.select("div#debug").append('p').text(" "+lines[1]);
          return true;
        } else {
          throw new Exception(`${SEEDLINK4_PROTOCOL} not found in HELLO response`);
        }
      }).catch( function(error) {
        sp.d3.select("div#debug").append('p').text(`Error: ${error.name} - ${error.message}`);
        console.assert(false, error);
      });
    }
    sp.d3.select("button#disconnect").text("Disconnect");
  }
}
// snip start go
toggleConnect();
