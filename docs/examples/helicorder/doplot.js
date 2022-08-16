import * as seisplotjs from './seisplotjs_3.0.0-alpha.1_standalone.mjs';

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

export function createEmptySavedData(config) {
  const luxDur = luxon.Duration.fromISO(config.duration);

  // stringify end...
  let end = config.endTime;
  if (luxon.DateTime.isDateTime(end)) {
    config.endTime = end.toISO();
  }
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
  let timeWindow = luxon.Interval.before(plotEnd, luxDur);
  let hash = {
    config: config,
    timeWindow: timeWindow,
    staCode: config.station,
    chanOrient: config.orientationCode,
    altChanOrient: config.altOrientationCode ? config.altOrientationCode : "",
    bandCode: config.bandCode,
    instCode: config.instCode,
    minMaxInstCode: config.instCode === 'H' ? 'X' : 'Y',
    amp: config.amp ? config.amp : "max",
    netArray: [],
    chanTR: [],
    origData: null,
    seisData: null,
    centerTime: null,

  };
  return hash;
}
export function doPlot(config) {
  if (window.getComputedStyle(document.querySelector('#heli')) === "none") {
    document.querySelector("#heli").setAttribute("style", "display: none;");
    document.querySelector("#seismograph").setAttribute("style", "display: block;");
    let hash = createEmptySavedData(config);
    if (hash.chanTR.length === 0) {
      console.log("no data")
    }
    drawSeismograph(hash);
    return Promise.resolve(hash);
  } else {
    return doPlotHeli(config);
  }
}

export function doPlotHeli(config) {
  document.querySelector("#heli").setAttribute("style", "display: block;");
  document.querySelector("#seismograph").setAttribute("style", "display: none;");
  const ONE_MILLISECOND = luxon.Duration.fromMillis(1);

  let nowHour = seisplotjs.util.isoToDateTime("now").endOf('hour').plus({milliseconds: 1});
  let hash = createEmptySavedData(config);

  if ( ! config.station) {
    return Promise.resolve(hash);
  }
  if ( ! config.duration) {
    config.duration = DEFAULT_DURATION;
  }
  history.pushState(config, "title");

  let svgParent = d3.select(`div.${divClass}`);
  svgParent.selectAll("*").remove(); // remove old data

  svgParent.append("p").text(`...loading ${config.netCode}.${config.station}.`);

  let netCodeQuery = config.netCode;
  let staCodeQuery = config.station;
  let locCodeQuery = config.locCode;
  let chanCodeQuery = `${config.bandCode}${config.instCode}?`; // get all orientations
  d3.selectAll("span.textNetCode").text(netCodeQuery);
  d3.selectAll("span.textStaCode").text(staCodeQuery);
  d3.selectAll("span.textLocCode").text(locCodeQuery);
  d3.selectAll("span.textChanCode").text(chanCodeQuery);
  d3.selectAll("span.startTime").text(`${hash.timeWindow.start.toFormat('(ooo), MMM d, yyyy HH:mm')}  [GMT]`);
  d3.selectAll("span.endTime").text(`${hash.timeWindow.end.toFormat('(ooo), MMM d, yyyy HH:mm')} [GMT]`);
  let channelQuery = new seisplotjs.fdsnstation.StationQuery()
    .nodata(404)
    .networkCode(netCodeQuery)
    .stationCode(staCodeQuery)
    .locationCode(locCodeQuery)
    .channelCode(chanCodeQuery)
    .startTime(hash.timeWindow.start)
    .endTime(hash.timeWindow.end);
  return channelQuery.queryChannels()
  .catch(e => {
      svgParent.append("h3").classed("error", true).text("Error Loading Data, retrying... ").style("color", "red");
      svgParent.append("p").text(`e`);
      return new Promise(resolve => setTimeout(resolve, 2000, channelQuery.queryChannels()));
  })
  .then(netArray => {
    if (netArray.length === 0 ) {
      svgParent.append("h3").classed("error", true).text("No channels found").style("color", "red");
      hash.seisData = null;
      hash.origData = null;
    }
    let chanTR = [];
    hash.chanTR = chanTR;
    hash.netArray = netArray;
    for (let c of seisplotjs.stationxml.allChannels(netArray)) {
      if (c.channelCode.endsWith(hash.chanOrient) || (hash.altChanOrient && c.channelCode.endsWith(hash.altChanOrient))) {
        chanTR.push(seisplotjs.seismogram.SeismogramDisplayData.fromChannelAndTimeWindow(c, hash.timeWindow));
      }
    }
    return hash;
  }).then(hash => {
    let chantrList;
    if (hash.bandCode === 'H' && hash.config.dominmax) {
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
        hash.heliDataIsMinMax = true;
        return seisplotjs.seismogram.SeismogramDisplayData.fromChannelAndTimeWindow(fake, ct.timeRange);
      }).filter(sdd => !!sdd);
      chantrList = minMaxQ.loadSeismograms(minMaxChanTR);
    } else {
      chantrList = loadDataReal(hash.chanTR);
      hash.heliDataIsMinMax = false;
    }
    return Promise.all([hash, chantrList]).then(hArr => {
      hArr[0].chantrList = hArr[1];
      return hArr[0];
    });
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
    return Promise.all([hash, hash.chantrList ]).then(hArr =>{
      hArr[0].chantrList = hArr[1];
      return hArr[0];
    });
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
      hash.origData = SeismogramDisplayData.fromSeismogram(minMaxSeismogram);
      let nowMarker = { markertype: 'predicted', name: "now", time: luxon.DateTime.utc() };
      hash.origData.addMarkers(nowMarker);
      hash.seisData = hash.origData;
      redrawHeli(hash);
      return queryEarthquakes(hash);
    }
    return hash;
  }).catch(err => {
    console.log(err);
    console.assert(false, err);
  });
};

export function queryEarthquakes(hash) {
  return Promise.resolve(hash).then(hash => {
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
    const localQuakes = localQuakesQuery.query();
    return Promise.all([hash, localQuakes]).then(hArr => {
      hArr[0].localQuakes = hArr[1];
      return hArr[0];
    });
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
    const regionalQuakes = regionalQuakesQuery.query();
    return Promise.all([hash, regionalQuakes]).then(hArr => {
      hArr[0].regionalQuakes = hArr[1];
      return hArr[0];
    });
  }).then(hash => {
    let quakeStart = hash.timeWindow.start.minus(QUAKE_START_OFFSET);
    let globalQuakesQuery = new seisplotjs.fdsnevent.EventQuery();
    globalQuakesQuery
      .startTime(quakeStart)
      .endTime(hash.timeWindow.end)
      .minMag(hash.config.globalMinMag);
    const globalQuakes = globalQuakesQuery.query();
    return Promise.all([hash, globalQuakes]).then(hArr => {
      hArr[0].globalQuakes = hArr[1];
      return hArr[0];
    });
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
    if (hash.seisData) {
      hash.seisData.addQuake(hash.quakes);
    }
    return Promise.resolve(hash);
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
    return Promise.all([hash, Promise.all(traveltimes)]).then(hArr => {
      hArr[0].traveltimes = hArr[1];
      return hArr[0];
    });
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
    if (hash.seisData) {
      hash.seisData.addMarkers(markers);
      hash.heli.draw();
    } else {

    }
    return hash;
  });
}

export function loadDataReal(sddList) {
  let mseedQ = new seisplotjs.mseedarchive.MSeedArchive(
    MSEED_URL,
    "%n/%s/%Y/%j/%n.%s.%l.%c.%Y.%j.%H");
  let beforeNowChanTR = sddList.map( ct => {
    if (ct.startTime > luxon.DateTime.utc()) {
      // seis in the future
      return null;
    }
    return ct;
  }).filter(sdd => !!sdd);
  return mseedQ.loadSeismograms(beforeNowChanTR);
}

export function filterData(config, origData) {
  let inData = origData;
  if (config.rmean) {
    let rmeanSeis = seisplotjs.filter.rMean(inData.seismogram);
    inData = SeismogramDisplayData.fromSeismogram(rmeanSeis);
  }
  if (config.filter.type === "allpass") {
  } else {
    let butterworth;
    let filterStyle;
    if (config.filter.type == "lowpass") {
      filterStyle = seisplotjs.filter.LOW_PASS;
    } else if (config.filter.type === "bandpass") {
      filterStyle = seisplotjs.filter.BAND_PASS;
    } else if (config.filter.type === "highpass") {
      filterStyle = seisplotjs.filter.HIGH_PASS;
    }
    butterworth = seisplotjs.filter.createButterworth(
                           2, // poles
                           filterStyle,
                           Number.parseFloat(config.filter.lowcut), // low corner
                           Number.parseFloat(config.filter.highcut), // high corner not used
                           1/inData.seismogram.sampleRate // delta (period)
                  );
    let filteredSeis = seisplotjs.filter.rMean(inData.seismogram);
    filteredSeis = seisplotjs.taper.taper(filteredSeis);
    filteredSeis = seisplotjs.filter.applyFilter(butterworth, filteredSeis);
    inData = SeismogramDisplayData.fromSeismogram(filteredSeis);
  }
  return inData;
}

export function redrawHeli(hash) {
  if ( ! hash.heliDataIsMinMax) {
    hash.seisData = filterData(hash.config, hash.origData);
  }

  let svgParent = d3.select(`div#${divClass}`);
  svgParent.selectAll("*").remove(); // remove old data
  if (hash.seisData) {
    let heliConfig = new HelicorderConfig(hash.timeWindow);
    heliConfig.markerFlagpoleBase = 'center';
    heliConfig.lineSeisConfig.markerFlagpoleBase = 'center';
    updateHeliAmpConfig(hash, heliConfig);

    svgParent.selectAll("div").remove(); // remove old data
    svgParent.selectAll("p").remove(); // remove old data
    svgParent.selectAll("h3").remove(); // remove old data
    hash.heli = new Helicorder(hash.seisData,
                               heliConfig);
    hash.heli.addEventListener("heliclick", hEvent => {
      hash.centerTime = hEvent.detail.time;
      drawSeismograph(hash);
    });
    svgParent.node().appendChild(hash.heli);
    d3.select("span#minAmp").text(hash.seisData.min.toFixed(0));
    d3.select("span#maxAmp").text(hash.seisData.max.toFixed(0));
    d3.select("span#meanAmp").text(hash.seisData.mean.toFixed(0));
    d3.select("span#varyAmp").text(hash.amp);
  } else {
    svgParent.append("p").text("No Data.")
  }
  return hash;
}

export function updateHeliAmpConfig(hash, heliConfig) {
  if (hash.config.amp === 'max') {
    heliConfig.fixedAmplitudeScale = [0,0];
    heliConfig.maxVariation = 0;
  } else if (typeof hash.config.amp === 'string' && hash.config.amp.endsWith('%')) {
    heliConfig.fixedAmplitudeScale = [0,0];
    const percent = Number(hash.config.amp.substring(0, hash.config.amp.length-1))/100;
    heliConfig.maxVariation = percent*(hash.seisData.max-hash.seisData.mean);
  } else if (Number.isFinite(hash.config.amp)) {
    heliConfig.fixedAmplitudeScale = [0,0];
    heliConfig.maxVariation = hash.config.amp;
  } else {
    heliConfig.fixedAmplitudeScale = [0,0];
    heliConfig.maxVariation = 0;
  }
  heliConfig.centeredAmp = true;
}

export function drawSeismograph(hash) {
  let friendChannels = Array.from(seisplotjs.stationxml.findChannels(hash.netArray,
                                                                  hash.chanTR[0].networkCode,
                                                                  hash.chanTR[0].stationCode,
                                                                  hash.chanTR[0].locationCode,
                                                                  hash.chanTR[0].channelCode.slice(0,2)+".",
                                                                ));
  let halfWidth = hash.halfWidth;
  if (! halfWidth) { halfWidth = seisplotjs.luxon.Duration.fromISO("PT5M"); }
  document.querySelector("#heli").setAttribute("style", "display: none;");
  const seismographDiv = document.querySelector("#seismograph");
  seismographDiv.setAttribute("style", "display: block;");
  const seismographDisp = seismographDiv.querySelector("sp-organized-display");
  const interval = seisplotjs.luxon.Interval.fromDateTimes(hash.centerTime.minus(halfWidth), hash.centerTime.plus(halfWidth));
  let sddList = friendChannels.map(channel => {
    let sdd = seisplotjs.seismogram.SeismogramDisplayData.fromChannelAndTimeWindow(channel, interval);
    return sdd;
  });
  seismographDisp.seisData = sddList;
  let seismographConfig = new seisplotjs.seismographconfig.SeismographConfig();
  seismographConfig.centeredAmp = true;
  seismographConfig.linkedAmplitudeScale = new seisplotjs.scale.LinkedAmplitudeScale();

  if (hash.config.amp === 'max') {
  } else if (typeof hash.config.amp === 'string' && hash.config.amp.endsWith('%')) {
    const percent = Number(hash.config.amp.substring(0, hash.config.amp.length-1))/100;
    seismographConfig.linkedAmplitudeScale.halfWidth =
      percent*seismographDisp.seismographConfig.linkedAmplitudeScale.halfWidth;
  } else if (Number.isFinite(hash.config.amp)) {
    seismographConfig.linkedAmplitudeScale.halfWidth = hash.config.amp;
  } else {
  }
  seismographDisp.seismographConfig = seismographConfig;
  //seismographConfig.linkedTimeScale.recalculate();
  //seismographConfig.linkedAmplitudeScale.recalculate();
  seismographDisp.draw();

  return loadDataReal(seismographDisp.seisData).then((sddList) => {
    sddList = sddList.map(sdd => filterData(hash.config, sdd));
    // looks dumb, but recalcs time and amp
    seismographDisp.seisData = sddList;
    return sddList;
  });
}
