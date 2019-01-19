
//let seedlink = require('seisplotjs-seedlink');
// this global comes from the seisplotjs_seedlink standalone js
let seedlink = seisplotjs.seedlink
let moment = seisplotjs.moment;

//let wp = require('seisplotjs-waveformplot');
// this global comes from the seisplotjs_waveformplot standalone js
let wp = seisplotjs.waveformplot;
let d3 = seisplotjs.d3;

let staList = ['BIRD', 'C1SC', 'CASEE', 'CSB', 'HAW', 'HODGE', 'JSC', 'PAULI', 'SUMMV', 'TEEBA'];
let netCode = 'CO';
let locCode = '00';

let divClass = "heli";
let clockOffset = 0; // should get from server somehow
let duration = 24*60*60;
let overlap = 0.75;
let instCode = "H";
let orientationCode = 'Z';
let altOrientationCode = null;
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
let currentOrient = "Z";
let heli = null;
let quakes = [];

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
wp.d3.select("button#loadZ").on("click", function(d) {
  orientationCode = "Z";
  altOrientationCode = null;
  load(currentEndTime);
});
wp.d3.select("button#loadN").on("click", function(d) {
  orientationCode = "N";
  altOrientationCode = "1";
  load(currentEndTime);
});
wp.d3.select("button#loadE").on("click", function(d) {
  orientationCode = "E";
  altOrientationCode = "2";
  load(currentEndTime);
});
wp.d3.select("button#loadSM").on("click", function(d) {
  instCode = "N";
  load(currentEndTime);
});
wp.d3.select("button#loadVel").on("click", function(d) {
  instCode = "H";
  load(currentEndTime);
});

let load = function(endTime) {
  var selectEl = document.getElementById("stationChoice");
  var selectedIndex = selectEl.selectedIndex;
  var staCode = selectEl.options[selectedIndex].value;

  console.log("Load..."+staCode);
  doplot(staCode, endTime).then(hash => {heli = hash.heli;});
}

doplot = function(staCode, endTime) {
  svgParent.selectAll("*").remove(); // remove old data
  let timeWindow = seisplotjs.fdsndataselect.calcStartEndDates(null, endTime, duration, clockOffset);
  let netCodeQuery = netCode;
  let locCodeQuery = locCode;
  let chanCodeQuery = `H${instCode}${orientationCode}`;
  if (altOrientationCode) {chanCodeQuery = `${chanCodeQuery},H${instCode}${altOrientationCode}`;}
  d3.selectAll("span.textNetCode").text(netCodeQuery);
  d3.selectAll("span.textStaCode").text(staCode);
  d3.selectAll("span.textLocCode").text(locCodeQuery);
  d3.selectAll("span.textChanCode").text(chanCodeQuery);
  d3.selectAll("span.startTime").text(timeWindow.start.format('ddd, MMM D, YYYY HH:mm [GMT]'));
  d3.selectAll("span.endTime").text(timeWindow.end.format('ddd, MMM D, YYYY HH:mm [GMT]'));
  let channelQuery = new seisplotjs.fdsnstation.StationQuery()
    .nodata(404)
    .networkCode(netCodeQuery)
    .stationCode(staCode)
    .locationCode(locCodeQuery)
    .channelCode(chanCodeQuery)
    .startTime(timeWindow.start)
    .endTime(timeWindow.end);
  let hash = {
    timeWindow: timeWindow,
    staCode: staCode,
    chanOrient: orientationCode,
    altChanOrient: altOrientationCode,
    instCode: instCode,
    minMaxInstCode: instCode === 'H' ? 'X' : 'Y'
  };
  return channelQuery.queryChannels()
  .catch(e => {
      svgParent.append("h3").text("Error Loading Data, retrying... ").style("color", "red");
      svgParent.append("p").text(`e`);
      return new Promise(resolve => setTimeout(resolve, 2000, channelQuery.queryChannels()));
  })
  .then(netArray => {
    let chanTR = [];
    hash.chanTR = chanTR;
    hash.netArray = netArray;
    netArray.map( n => {
      n.stations.map( s => {
        s.channels.filter( c => c.channelCode.endsWith(hash.chanOrient) || c.channelCode.endsWith(hash.altChanOrient))
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
      let chanCode = "L"+hash.minMaxInstCode+ct.channel.channelCode.charAt(2);
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
      svgParent.append("p").text("No Data Found").style("color", "red");
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
      let heliConfig = new wp.HelicorderConfig();
      heliConfig.overlap = overlap;
      heliConfig.lineSeisConfig.margin.left = 22;
      let minMaxTrace = null;
      traceMap.forEach((value, key) => {
        if (key.endsWith(`L${hash.minMaxInstCode}${hash.chanOrient}`) || key.endsWith(`L${hash.minMaxInstCode}${hash.altChanOrient}`)) {
          minMaxTrace = value;
        } else {
          console.log(`does not match: ${key}`);
        }
      });
      if (! minMaxTrace) {
        throw new Error(`Cannot find trace ends with L${hash.minMaxInstCode}${hash.chanOrient} or L${hash.minMaxInstCode}${hash.altChanOrient}`);
      }
      hash.minMaxTrace = minMaxTrace;
      hash.traceMap = null;
      console.log(`before break: ${minMaxTrace.numPoints}`)
      console.log(`trace type: ${(typeof minMaxTrace)} ${minMaxTrace.constructor.name} ${minMaxTrace.numPoints}`);
      hash.heli = new wp.Helicorder(svgParent,
                                    heliConfig,
                                    minMaxTrace,
                                    hash.timeWindow.start,hash.timeWindow.end);
      svgParent.selectAll("*").remove(); // remove old data
      hash.heli.draw();
    } else {
      svgParent.append("p").text("No Data.")
    }
    return hash;
  }).then(hash => {
    let localQuakesQuery = new seisplotjs.fdsnevent.EventQuery();
    localQuakesQuery
      .startTime(hash.timeWindow.start)
      .endTime(hash.timeWindow.end)
      .minLat(31.75)
      .maxLat(35.5)
      .minLon(-84)
      .maxLon(-78);
    hash.localQuakes = localQuakesQuery.query();
    return seisplotjs.RSVP.hash(hash);
  }).then(hash => {
    let regionalQuakesQuery = new seisplotjs.fdsnevent.EventQuery();
    regionalQuakesQuery
      .startTime(hash.timeWindow.start)
      .endTime(hash.timeWindow.end)
      .latitude(33)
      .longitude(-81)
      .maxRadius(10)
      .minMag(4);
    hash.regionalQuakes = regionalQuakesQuery.query();
    return seisplotjs.RSVP.hash(hash);
  }).then(hash => {
    let globalQuakesQuery = new seisplotjs.fdsnevent.EventQuery();
    globalQuakesQuery
      .startTime(hash.timeWindow.start)
      .endTime(hash.timeWindow.end)
      .minMag(6);
    hash.globalQuakes = globalQuakesQuery.query();
    return seisplotjs.RSVP.hash(hash);
  }).catch(e => {
      svgParent.append("h3").text("Error Loading Data").style("color", "red");
      svgParent.append("p").text(`e`);
      throw e;
  }).then(hash => {
    console.log(`num quakes ${hash.localQuakes.length}  ${hash.regionalQuakes.length}  ${hash.globalQuakes.length}`)
    hash.quakes = [];
    if (hash.localQuakes.length > 0)hash.quakes = hash.localQuakes;
    if (hash.regionalQuakes.length > 0)hash.quakes = hash.quakes.concat(hash.regionalQuakes);
    if (hash.globalQuakes.length > 0)hash.quakes = hash.quakes.concat(hash.globalQuakes);

    return seisplotjs.RSVP.hash(hash);
  }).then(hash => {
    let traveltimes = [];
    let mystation = hash.chanTR[0].channel.station;
    hash.quakes.forEach(quake => {
      let ttresult = new seisplotjs.traveltime.TraveltimeQuery()
        .protocol(protocol)
        .evdepth( quake.depth > 0 ? quake.depth/1000 : 0)
        .evlat(quake.latitude).evlon(quake.longitude)
        .stalat(mystation.latitude).stalon(mystation.longitude)
        .phases('p,P,PKP,PKIKP,Pdiff,s,S,Sdiff,PKP,SKS,SKIKS')
        .query()
        .then(function(ttimes) {
          let firstP = null;
          let firstS = null;
          for (let p=0; p<ttimes.arrivals.length; p++) {
            if ((ttimes.arrivals[p].phase.startsWith('P') || ttimes.arrivals[p].phase.startsWith('p')) && ( ! firstP || firstP.time > ttimes.arrivals[p])) {
              firstP = ttimes.arrivals[p];
            }
            if ((ttimes.arrivals[p].phase.startsWith('S') || ttimes.arrivals[p].phase.startsWith('s')) && ( ! firstS || firstS.time > ttimes.arrivals[p])) {
              firstS = ttimes.arrivals[p];
            }
          }
          return {
            firstP: firstP,
            firstPTime: moment(quake.time).add(firstP.time, 'seconds'),
            firstS: firstS,
            firstSTime: moment(quake.time).add(firstS.time, 'seconds'),
            ttimes: ttimes
          };
        });
      traveltimes.push(ttresult);
    });
    hash.traveltimes = seisplotjs.RSVP.all(traveltimes);
    return seisplotjs.RSVP.hash(hash);
  }).then(hash => {
    let markers = [];
    hash.quakes.forEach(quake => {
      console.log(`q uake: ${quake.time} ${quake.mag}`);
      markers.push({ markertype: 'predicted', name: `${quake.magnitude} ${quake.time.format('HH:mm:ss')}`, time: quake.time });
      if (quake.arrivals) {
        quake.arrivals.forEach(arrival => {
          console.log(`arrival ${arrival} ${arrival.pick.stationCode}`);
          if (arrival && arrival.pick.stationCode == hash.staCode) {
          markers.push({ markertype: 'pick', name: arrival.phase, time: arrival.pick.time });
          console.log("markers.push({ markertype: 'pick', name: "+arrival.phase+", time: "+arrival.pick.time );
          }
        });
      }
    });

    hash.traveltimes.forEach(tt => {
      markers.push({ markertype: 'predicted', name: tt.firstP.phase, time: tt.firstPTime });
      markers.push({ markertype: 'predicted', name: tt.firstS.phase, time: tt.firstSTime });
    });
    hash.heli.appendMarkers(markers);
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

console.log(' ##### DISABLE autoupdate ####')
paused=true;
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
