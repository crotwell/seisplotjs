
//let seedlink = require('seisplotjs-seedlink');
// this global comes from the seisplotjs_seedlink standalone js
let seedlink = seisplotjs.seedlink
let moment = seisplotjs.moment;

//let wp = require('seisplotjs-waveformplot');
// this global comes from the seisplotjs_waveformplot standalone js
let wp = seisplotjs.waveformplot;
let d3 = seisplotjs.d3;

let net = 'CO';
let staList = ['BIRD', 'C1SC', 'CASEE', 'CSB', 'HAW', 'HODGE', 'JSC', 'PAULI', 'SUMMV', 'TEEBA'];


let staChoice = d3.select('#stationChoice');
staChoice
  .selectAll("option")
  .data(staList)
  .enter()
    .append("option")
    .text(function(d) {return d;});
staChoice.on('change', function() {
    let sta = d3.select('#stationChoice').property('value');
    doplot(sta, currentEndTime);
  });

let divClass = "heli";
let clockOffset = 0; // should get from server somehow
let duration = 24*60*60;
let orientationCode = 'Z';
let maxSteps = -1; // max num of ticks of the timer before stopping, for debugin
let nowHour = moment.utc().endOf('hour').add(1, 'millisecond');
//nowHour = moment.utc("2019-01-11T21:58:00Z").endOf('hour').add(1, 'millisecond');
let protocol = 'http:';
if ("https:" == document.location.protocol) {
  protocol = 'https:'
}
let wsProtocol = 'ws:';
if (protocol == 'https:') {
  wsProtocol = 'wss:';
}

//
// Note: currently rtserve.iris does not support wss, and so this will
// not work from https pages as you cannot use non-encrypted (ws)
// loaded from a https web page
//
let IRIS_HOST = "rtserve.iris.washington.edu";
let EEYORE_HOST = "eeyore.seis.sc.edu";
let EEYORE_PORT = 6383;
let host = IRIS_HOST;
let port = 80;
host=EEYORE_HOST;
port=EEYORE_PORT;
let seedlinkUrl = wsProtocol+"//"+host+(port==80?'':':'+port)+'/seedlink';
console.log("URL: "+seedlinkUrl);


d3.selectAll('.textHost').text(host);

let slConn = null;
let allSeisPlots = new Map();
let svgParent = wp.d3.select(`div.${divClass}`);
let margin = {top: 20, right: 20, bottom: 50, left: 60};

let paused = false;
let stopped = false;
let numSteps = 0;

let currentEndTime = moment.utc().endOf('hour').add(1, 'millisecond');
let currentStation = null;
let heli = null;

wp.d3.select("button#loadToday").on("click", function(d) {
  currentEndTime = moment.utc().endOf('hour').add(1, 'millisecond');
  load(currentEndTime);
});

wp.d3.select("button#loadPrev").on("click", function(d) {
  currentEndTime = moment.utc(currentEndTime).subtract(1, 'day');
  load(currentEndTime);
});

wp.d3.select("button#loadNext").on("click", function(d) {
  currentEndTime = moment.utc(currentEndTime).add(1, 'day');
  load(currentEndTime);
});

let load = function(endTime) {
  var selectEl = document.getElementById("stationChoice");
  var selectedIndex = selectEl.selectedIndex;
  var staCode = selectEl.options[selectedIndex].value;

  console.log("Load..."+staCode);
  doplot(staCode, endTime).then(hash => heli = hash.heli);
}

doplot = function(staCode, endTime) {
  svgParent.selectAll("*").remove(); // remove old data
  let timeWindow = seisplotjs.fdsndataselect.calcStartEndDates(null, endTime, duration, clockOffset);

  let chanCodeQuery = 'HHZ,HNZ';
  if (staCode === "C1SC") {
    chanCodeQuery = "HNZ";
  } else {
    chanCodeQuery = "HHZ";
  }
  d3.selectAll("span.textNetCode").text('CO');
  d3.selectAll("span.textStaCode").text(staCode);
  d3.selectAll("span.textChanCode").text(chanCodeQuery);
  d3.selectAll("span.startTime").text(timeWindow.start.format('ddd, MMM D, YYYY HH:mm [GMT]'));
  d3.selectAll("span.endTime").text(timeWindow.end.format('ddd, MMM D, YYYY HH:mm [GMT]'));
  let channelQuery = new seisplotjs.fdsnstation.StationQuery()
    .nodata(404)
    .networkCode('CO')
    .stationCode(staCode)
    .locationCode('00')
    .channelCode(chanCodeQuery)
    .startTime(timeWindow.start)
    .endTime(timeWindow.end);
  let hash = {
    timeWindow: timeWindow,
    staCode: staCode,
    chanOrient: orientationCode
  };
  return channelQuery.queryChannels().then(netArray => {
    let chanTR = [];
    hash.chanTR = chanTR;
    hash.netArray = netArray;
    netArray.map( n => {
      n.stations.map( s => {
        s.channels.filter( c => c.channelCode.endsWith(orientationCode))
        .map(c => {
          chanTR.push({
            channel: c,
            startTime: timeWindow.start,
            endTime: timeWindow.end
          });
        });
      });
    });
    return seisplotjs.RSVP.hash(hash);
  }).then(hash => {
    let minMaxQ = new seisplotjs.seedlink.MSeedArchive(
      "http://eeyore.seis.sc.edu/minmax",
      "%n/%s/%Y/%j/%n.%s.%l.%c.%Y.%j.%H");
    let minMaxChanTR = hash.chanTR.map( ct => {
      let chanCode = "LX"+ct.channel.channelCode.charAt(2);
      let fake = new seisplotjs.model.Channel(ct.channel.station, chanCode, ct.channel.locationCode);
      fake.sampleRate = 2;
      return {
        channel: fake,
        startTime: ct.startTime,
        endTime: ct.endTime
      };
    });
    hash.traceMap = minMaxQ.loadTraces(minMaxChanTR);
    return seisplotjs.RSVP.hash(hash);
  }).then(hash => {
    if (hash.traceMap.size == 0) {
      console.log("min max data from miniseedArchive found none");
      throw new Error("min max data from miniseedArchive found none");
      let dsQ = new seisplotjs.fdsndataselect.DataSelectQuery()
        .nodata(404);
      console.log(dsQ.createPostBody(hash.chanTR));
      hash.traceMap = dsQ.postQueryTraces(hash.chanTR);
      hash.query = dsQ;
    }
    return seisplotjs.RSVP.hash(hash);
  }).then(hash => {
    let traceMap = hash.traceMap;
    console.log(`got ${traceMap.size} channel-seismograms`);
    if (traceMap.size !== 0) {
      let seisConfig = new wp.SeismographConfig();
      seisConfig.maxHeight = 600;
      seisConfig.xLabel = '';
      seisConfig.yLabel = '';
      seisConfig.xSublabel = '';
      seisConfig.ySublabel = '';
      seisConfig.isXAxis = false;
      seisConfig.isYAxis = false;
      let minMaxTrace = null;
      traceMap.forEach((value, key) => {
        if (key.endsWith("LX"+hash.chanOrient)) {
          minMaxTrace = value;
        }
      });
      hash.minMaxTrace = minMaxTrace;
      hash.traceMap = null;
      console.log(`before break: ${minMaxTrace.numPoints}`)
      console.log(`trace type: ${(typeof minMaxTrace)} ${minMaxTrace.constructor.name} ${minMaxTrace.numPoints}`);
      hash.heli = new wp.Helicorder(svgParent,
                            seisConfig,
                            minMaxTrace,
                          hash.timeWindow.start,hash.timeWindow.end);
      hash.heli.draw();
    } else {
      svgParent.append("p").text("No Data.")
    }
    return hash;
  });
}



wp.d3.select("button#pause").on("click", function(d) {
  doPause( ! paused);
});

wp.d3.select("button#disconnect").on("click", function(d) {
  doDisconnect( ! stopped);
});

let doPause = function(value) {
  console.log("Pause..."+paused+" -> "+value);
  paused = value;
  if (paused) {
    wp.d3.select("button#pause").text("Play");
  } else {
    wp.d3.select("button#pause").text("Pause");
  }
}

let doDisconnect = function(value) {
  console.log("disconnect..."+stopped+" -> "+value);
  stopped = value;
  if (stopped) {
    if (slConn) {slConn.close();}
    wp.d3.select("button#disconnect").text("Reconnect");
  } else {
    if (slConn) {slConn.connect();}
    wp.d3.select("button#disconnect").text("Disconnect");
  }
}

let timerInterval = 300*1000;
// testing
timerInterval = 10000;
if (timerInterval < 10000) { timerInterval = 10000;}
console.log("start time with interval "+timerInterval);
let timer = wp.d3.interval(function(elapsed) {
  if ( ! heli) {return;}
  if ( paused) {
    return;
  }
  if ( allSeisPlots.size > 1) {
    numSteps++;
    if (maxSteps > 0 && numSteps > maxSteps ) {
      console.log("quit after max steps: "+maxSteps);
      timer.stop();
      slConn.close();
    }
  }
  nowHour = moment.utc().endOf('hour').add(1, 'millisecond');
  timeWindow = wp.calcStartEndDates(null, nowHour, duration, clockOffset);
  console.log("reset time window for "+timeWindow.start+" "+timeWindow.end );

  heli.setPlotStartEnd(timeWindow.start, timeWindow.end);
}, timerInterval);

let errorFn = function(error) {
  console.log("error: "+error);
  svgParent.select("p").text("Error: "+error);
};
