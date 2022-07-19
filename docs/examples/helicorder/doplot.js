import * as seisplotjs from './seisplotjs_3.0.0-alpha.0_standalone.mjs';

const d3 = seisplotjs.d3;
const luxon = seisplotjs.luxon;

const DEFAULT_DURATION = "P1D";
const SeismogramDisplayData = seisplotjs.seismogram.SeismogramDisplayData;
const HelicorderConfig = seisplotjs.helicorder.HelicorderConfig;
const Helicorder = seisplotjs.helicorder.Helicorder;

const MINMAX_URL = "http://eeyore.seis.sc.edu/minmax";
const MSEED_URL = "http://eeyore.seis.sc.edu/mseed";

const QUAKE_START_OFFSET = luxon.Duration.fromObject({hours: 1});
const divClass = "heli";

export const HOURS_PER_LINE = 2;

export function getNowTime() {
  let e = luxon.DateTime.utc().endOf('hour').plus({milliseconds: 1});
  e.plus({hours: e.hour % HOURS_PER_LINE});
  return e;
}

export function doPlot(config) {
  const ONE_MILLISECOND = luxon.Duration.fromMillis(1);

  let nowHour = seisplotjs.util.isoToDateTime("now").endOf('hour').plus({milliseconds: 1});

  if ( ! config.station) {
    return;
  }
  if ( ! config.duration) {
    config.duration = DEFAULT_DURATION;
  }
  // stringify end...
  let end = config.endTime;
  if (luxon.DateTime.isDateTime(end)) {
    config.endTime = end.toISO();
  }
  history.pushState(config, "title");

  let plotEnd;
  if (luxon.DateTime.isDateTime(end)) {
    plotEnd = end;
  } else if( ! end || end.length === 0 || end === 'now') {
    plotEnd = getNowTime();
  } else if( end === 'today') {
    plotEnd = luxon.DateTime.utc().endOf('day').plus(ONE_MILLISECOND);
  } else {
    plotEnd = luxon.DateTime.fromISO(config.endTime).toUTC();
  }
  let svgParent = d3.select(`div.${divClass}`);
  svgParent.selectAll("*").remove(); // remove old data

  svgParent.append("p").text(`...loading ${config.netCode}.${config.station}.`);
  const luxDur = luxon.Duration.fromISO(config.duration);
  let timeWindow = luxon.Interval.before(plotEnd, luxDur);

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
  d3.selectAll("span.startTime").text(`${timeWindow.start.toFormat('(ooo), MMM d, yyyy HH:mm')}  [GMT]`);
  d3.selectAll("span.endTime").text(`${timeWindow.end.toFormat('(ooo), MMM d, yyyy HH:mm')} [GMT]`);
  let channelQuery = new seisplotjs.fdsnstation.StationQuery()
    .nodata(404)
    .networkCode(netCodeQuery)
    .stationCode(staCodeQuery)
    .locationCode(locCodeQuery)
    .channelCode(chanCodeQuery)
    .startTime(timeWindow.start)
    .endTime(timeWindow.end);
  let hash = {
    config: config,
    timeWindow: timeWindow,
    staCode: staCodeQuery,
    chanOrient: config.orientationCode,
    altChanOrient: config.altOrientationCode ? config.altOrientationCode : "",
    bandCode: config.bandCode,
    instCode: config.instCode,
    minMaxInstCode: config.instCode === 'H' ? 'X' : 'Y',
    amp: config.amp ? config.amp : "max"
  };
  return channelQuery.queryChannels()
  .catch(e => {
      svgParent.append("h3").classed("error", true).text("Error Loading Data, retrying... ").style("color", "red");
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
          chanTR.push(seisplotjs.seismogram.SeismogramDisplayData.fromChannelAndTimeWindow(c, timeWindow));
        });
      });
    });
    return seisplotjs.RSVP.hash(hash);
  }).then(hash => {
    if (hash.bandCode === 'H') {
      let minMaxQ = new seisplotjs.mseedarchive.MSeedArchive(
        MINMAX_URL,
        "%n/%s/%Y/%j/%n.%s.%l.%c.%Y.%j.%H");
      let minMaxChanTR = hash.chanTR.map( ct => {
        if (ct.startTime > luxon.DateTime.utc()) {
          // seis in the future
          return null;
        }
        let chanCode = "L"+hash.minMaxInstCode+ct.channel.channelCode.charAt(2);
        let fake = new seisplotjs.stationxml.Channel(ct.channel.station, chanCode, ct.channel.locationCode);
        fake.sampleRate = 2;
        return seisplotjs.seismogram.SeismogramDisplayData.fromChannelAndTimeWindow(fake, ct.timeRange);
      }).filter(sdd => !!sdd);
      hash.chantrList = minMaxQ.loadSeismograms(minMaxChanTR);
    } else {
      let mseedQ = new seisplotjs.mseedarchive.MSeedArchive(
        MSEED_URL,
        "%n/%s/%Y/%j/%n.%s.%l.%c.%Y.%j.%H");
      let beforeNowChanTR = hash.chanTR.map( ct => {
        if (ct.startTime > luxon.DateTime.utc()) {
          // seis in the future
          return null;
        }
        return ct;
      }).filter(sdd => !!sdd);
      hash.chantrList = mseedQ.loadSeismograms(beforeNowChanTR);
    }
    return seisplotjs.RSVP.hash(hash);
  }).then(hash => {
    let gotData = hash.chantrList.reduce((acc, cur) => acc || !!cur.seismogram, false);
    if ( ! gotData) {
      svgParent.append("p").text("No Data Found MSeedArchive").style("color", "red");
      console.log("min max data from miniseedArchive found none");
      if (hash.chanTR.length > 0) {
        let dsQ = new seisplotjs.fdsndataselect.DataSelectQuery()
          .nodata(404);
        hash.chantrList = dsQ.postQuerySeismograms(hash.chanTR);
        hash.query = dsQ;
      } else {
        hash.chantrList = [];
        hash.query = null;
      }
    }
    return seisplotjs.RSVP.hash(hash);
  }).then(hash => {
    let minMaxSeismogram = null;
    hash.chantrList.forEach(ctr => {
      if (ctr.channel.channelCode === `L${hash.minMaxInstCode}${hash.chanOrient}` || ctr.channel.channelCode === `L${hash.minMaxInstCode}${hash.altChanOrient}`) {
        minMaxSeismogram = ctr.seismogram;
      } else if (ctr.channel.channelCode === `${hash.bandCode}${hash.instCode}${hash.chanOrient}` || ctr.channel.channelCode === `${hash.bandCode}${hash.instCode}${hash.altChanOrient}`) {
        minMaxSeismogram = ctr.seismogram;
        d3.selectAll("span.textChanCode").text(ctr.channel.channelCode);
      } else {
        throw new Error(`Cannot find trace ends with L${hash.minMaxInstCode}${hash.chanOrient} or L${hash.minMaxInstCode}${hash.altChanOrient} or ${hash.bandCode}${hash.instCode}${hash.chanOrient}`);
      }
    });
    if (! minMaxSeismogram) {
      svgParent.append("p").text("No Data Found DataSelect").style("color", "red");
    } else {
      hash.seisData = SeismogramDisplayData.fromSeismogram(minMaxSeismogram);
      let nowMarker = { markertype: 'predicted', name: "now", time: luxon.DateTime.utc() };
      hash.seisData.addMarkers(nowMarker);
      redrawHeli(hash);
      return seisplotjs.RSVP.hash(queryEarthquakes(hash));
    }
    return hash;
  }).catch(err => {
    console.log(err);
    console.assert(false, err);
  });
};

export function queryEarthquakes(hash) {
  return seisplotjs.RSVP.hash(hash).then(hash => {
    let quakeStart = hash.timeWindow.start.minus(QUAKE_START_OFFSET);
    let localQuakesQuery = new seisplotjs.fdsnevent.EventQuery();
    localQuakesQuery
      .minMag(0)
      .startTime(quakeStart)
      .endTime(hash.timeWindow.end)
      .minLat(hash.config.localMinLat)
      .maxLat(hash.config.localMaxLat)
      .minLon(hash.config.localMinLon)
      .maxLon(hash.config.localMaxLon);
    hash.localQuakes = localQuakesQuery.query();
    return seisplotjs.RSVP.hash(hash);
  }).then(hash => {
    let quakeStart = hash.timeWindow.start.minus(QUAKE_START_OFFSET);
    let regionalQuakesQuery = new seisplotjs.fdsnevent.EventQuery();
    regionalQuakesQuery
      .startTime(quakeStart)
      .endTime(hash.timeWindow.end)
      .latitude(33)
      .longitude(-81)
      .maxRadius(hash.config.regionalMaxRadius)
      .minMag(hash.config.regionalMinMag);
    hash.regionalQuakes = regionalQuakesQuery.query();
    return seisplotjs.RSVP.hash(hash);
  }).then(hash => {
    let quakeStart = hash.timeWindow.start.minus(QUAKE_START_OFFSET);
    let globalQuakesQuery = new seisplotjs.fdsnevent.EventQuery();
    globalQuakesQuery
      .startTime(quakeStart)
      .endTime(hash.timeWindow.end)
      .minMag(hash.config.globalMinMag);
    hash.globalQuakes = globalQuakesQuery.query();
    return seisplotjs.RSVP.hash(hash);

  }).catch(e => {
    let svgParent = seisplotjs.d3.select(`div.${divClass}`);
      svgParent.append("h3").text("Error Loading Earthquake Data").style("color", "red");
      svgParent.append("p").text(`${e}`);
      throw e;
  }).then(hash => {
    hash.quakes = [];
    if (hash.localQuakes.length > 0)hash.quakes = hash.localQuakes;
    if (hash.regionalQuakes.length > 0)hash.quakes = hash.quakes.concat(hash.regionalQuakes);
    if (hash.globalQuakes.length > 0)hash.quakes = hash.quakes.concat(hash.globalQuakes);
    hash.seisData.addQuake(hash.quakes);
    return seisplotjs.RSVP.hash(hash);
  }).then(hash => {
    let traveltimes = [];
    let mystation = hash.chanTR[0].channel.station;
    hash.quakes.forEach(quake => {
      let ttresult = new seisplotjs.traveltime.TraveltimeQuery()
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
            firstPTime: quake.time.plus({seconds: firstP.time}),
            firstS: firstS,
            firstSTime: quake.time.plus({seconds: firstS.time}),
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
                     name: `M${quake.magnitude.mag} ${quake.time.toFormat('HH:mm')}`,
                     time: quake.time,
                     link: `https://earthquake.usgs.gov/earthquakes/eventpage/${quake.eventId}/executive`,
                     description: `${quake.time.toISO()}
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
    markers.push({ markertype: 'predicted', name: "now", time: luxon.DateTime.utc() });
    hash.seisData.addMarkers(markers);
    hash.heli.draw();
    return hash;
  });
}


export function redrawHeli(hash) {
  console.log(`heli redraw... ${hash.amp}`)

  let svgParent = d3.select(`div.${divClass}`);
  svgParent.selectAll("*").remove(); // remove old data
  if (hash.seisData) {
    let heliConfig = new HelicorderConfig(hash.timeWindow);
    heliConfig.markerFlagpoleBase = 'center';
    heliConfig.lineSeisConfig.markerFlagpoleBase = 'center';
    if (hash.amp === 'max') {
      heliConfig.fixedYScale = null;
      heliConfig.maxVariation = 0;
    } else if (typeof hash.amp === 'string' && hash.amp.endsWith('%')) {
      heliConfig.fixedYScale = null;
      const precent = Number(hash.amp.substring(0, hash.amp.length-1))/100;
      heliConfig.maxVariation = precent*(hash.seisData.max-hash.seisData.mean);
    } else if (Number.isFinite(hash.amp)) {
      heliConfig.fixedYScale = null;
      heliConfig.maxVariation = hash.amp;
    } else {
      heliConfig.fixedYScale = null;
      heliConfig.maxVariation = 0;
    }
    heliConfig.centeredAmp = true;

    svgParent.selectAll("div").remove(); // remove old data
    svgParent.selectAll("p").remove(); // remove old data
    svgParent.selectAll("h3").remove(); // remove old data
    hash.heli = new Helicorder(hash.seisData,
                               heliConfig);

    svgParent.node().appendChild(hash.heli);
    d3.select("span#minAmp").text(hash.seisData.min.toFixed(0));
    d3.select("span#maxAmp").text(hash.seisData.max.toFixed(0));
    d3.select("span#meanAmp").text(hash.seisData.mean.toFixed(0));
    d3.select("span#varyAmp").text(hash.amp);
  } else {
    svgParent.append("p").text("No Data.")
  }
  console.log("end redrawHeli")
  return hash;
}
