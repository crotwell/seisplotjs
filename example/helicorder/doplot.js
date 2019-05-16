

doPlot = function(config) {
  //let seedlink = require('seisplotjs-seedlink');
  // this global comes from the seisplotjs_seedlink standalone js
  let seedlink = seisplotjs.seedlink
  let moment = seisplotjs.moment;

  //let wp = require('seisplotjs-waveformplot');
  // this global comes from the seisplotjs_waveformplot standalone js
  let wp = seisplotjs.waveformplot;
  let d3 = seisplotjs.d3;


  let divClass = "heli";
  let clockOffset = 0; // should get from server somehow
  let duration = 24*60*60;
  let overlap = 0.75;
  let maxSteps = -1; // max num of ticks of the timer before stopping, for debugin
  let nowHour = moment.utc().endOf('hour').add(1, 'millisecond');
  //nowHour = moment.utc("2019-01-11T21:58:00Z").endOf('hour').add(1, 'millisecond');

  // stringify moment...
  let end = config.endTime;
  if (moment.isMoment(end)) {
    config.endTime = end.toISOString();
  }
  history.pushState(config, "title");
  config.endTime = end;

  let plotEnd;
  if (moment.isMoment(end)) {
    plotEnd = end;
  } else if( ! end || end.length === 0 || end === 'now') {
    plotEnd = moment.utc().endOf('hour').add(1, 'millisecond');
  } else if( end === 'today') {
    plotEnd = moment.utc().endOf('day').add(1, 'millisecond');
  } else {
    plotEnd = config.endTime;
  }
  let svgParent = wp.d3.select(`div.${divClass}`);
  svgParent.selectAll("*").remove(); // remove old data
  let timeWindow = seisplotjs.fdsndataselect.calcStartEndDates(null, plotEnd, duration, clockOffset);

  let netCodeQuery = config.netCode;
  let staCodeQuery = config.station;
  let locCodeQuery = config.locCode;
  let chanCodeQuery = `${config.bandCode}${config.instCode}${config.orientationCode}`;
  if (config.altOrientationCode && config.altOrientationCode.length !== 0) {
    chanCodeQuery = `${chanCodeQuery},${config.bandCode}${config.instCode}${config.altOrientationCode}`;
  }
  d3.selectAll("span.textNetCode").text(netCodeQuery);
  d3.selectAll("span.textStaCode").text(staCodeQuery);
  d3.selectAll("span.textLocCode").text(locCodeQuery);
  d3.selectAll("span.textChanCode").text(chanCodeQuery);
  d3.selectAll("span.startTime").text(timeWindow.start.format('ddd, MMM D, YYYY HH:mm [GMT]'));
  d3.selectAll("span.endTime").text(timeWindow.end.format('ddd, MMM D, YYYY HH:mm [GMT]'));
  let channelQuery = new seisplotjs.fdsnstation.StationQuery()
    .nodata(404)
    .networkCode(netCodeQuery)
    .stationCode(staCodeQuery)
    .locationCode(locCodeQuery)
    .channelCode(chanCodeQuery)
    .startTime(timeWindow.start)
    .endTime(timeWindow.end);
  let hash = {
    timeWindow: timeWindow,
    staCode: staCodeQuery,
    chanOrient: config.orientationCode,
    altChanOrient: config.altOrientationCode ? config.altOrientationCode : "",
    bandCode: config.bandCode,
    instCode: config.instCode,
    minMaxInstCode: config.instCode === 'H' ? 'X' : 'Y'
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
    if (hash.bandCode == 'H') {
      let minMaxQ = new seisplotjs.seedlink.MSeedArchive(
        "http://eeyore.seis.sc.edu/minmax",
        "%n/%s/%Y/%j/%n.%s.%l.%c.%Y.%j.%H");
      let minMaxChanTR = hash.chanTR.map( ct => {
        let chanCode = "L"+hash.minMaxInstCode+ct.channel.channelCode.charAt(2);
        let fake = new seisplotjs.stationxml.Channel(ct.channel.station, chanCode, ct.channel.locationCode);
        fake.sampleRate = 2;
        return new ChannelTimeRange()
          fake,
           ct.startTime,
           ct.endTime
        );
      });
      hash.traceMap = minMaxQ.loadTraces(minMaxChanTR);
    } else {
      let mseedQ = new seisplotjs.seedlink.MSeedArchive(
        "http://eeyore.seis.sc.edu/mseed",
        "%n/%s/%Y/%j/%n.%s.%l.%c.%Y.%j.%H");
      hash.traceMap = mseedQ.loadTraces(hash.chanTR);
    }
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
      heliConfig.lineSeisConfig.margin.left = 42;
      heliConfig.lineSeisConfig.yLabelOrientation = "horizontal";
      heliConfig.markerFlagpoleBase = 'center';
      heliConfig.lineSeisConfig.markerFlagpoleBase = 'center';
      heliConfig.numLines = 12;
      let minMaxTrace = null;
      traceMap.forEach((value, key) => {
        if (key.endsWith(`L${hash.minMaxInstCode}${hash.chanOrient}`) || key.endsWith(`L${hash.minMaxInstCode}${hash.altChanOrient}`)) {
          minMaxTrace = value;
        } else if (key.endsWith(`${hash.bandCode}${hash.instCode}${hash.chanOrient}`) || key.endsWith(`${hash.bandCode}${hash.instCode}${hash.altChanOrient}`)) {
          minMaxTrace = value;
          d3.selectAll("span.textChanCode").text(key.slice(-3));
        } else {
          console.log(`does not match: ${key}`);
        }
      });
      if (! minMaxTrace) {
        throw new Error(`Cannot find trace ends with L${hash.minMaxInstCode}${hash.chanOrient} or L${hash.minMaxInstCode}${hash.altChanOrient}`);
      }
      hash.minMaxTrace = minMaxTrace;
      hash.traceMap = null;
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
      svgParent.append("p").text(`${e}`);
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
    let mystation = hash.chanTR[0].channel.station;
    let markers = [];
    hash.quakes.forEach(quake => {
      let distaz = seisplotjs.distaz.distaz(mystation.latitude, mystation.longitude, quake.latitude, quake.longitude);
      markers.push({ markertype: 'predicted',
                     name: `M${quake.magnitude.mag} ${quake.time.format('HH:mm')}`,
                     time: quake.time,
                     link: `https://earthquake.usgs.gov/earthquakes/eventpage/${quake.eventId}/executive`,
                     description: `${quake.time.toISOString()}
${quake.latitude.toFixed(2)}/${quake.longitude.toFixed(2)} ${(quake.depth/1000).toFixed(2)} km
${quake.description}
${quake.magnitude}
${distaz.delta.toFixed(2)} deg to ${mystation.stationCode}
`

                   });
      if (quake.arrivals) {
        quake.arrivals.forEach(arrival => {
          if (arrival && arrival.pick.stationCode == hash.staCode) {
            markers.push({ markertype: 'pick', name: arrival.phase, time: arrival.pick.time });
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
};
