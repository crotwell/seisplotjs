import * as sp from '../../seisplotjs_3.1.1_standalone.mjs';

const d3 = sp.d3;
const luxon = sp.luxon;

const DEFAULT_DURATION = "P1D";
const SeismogramDisplayData = sp.seismogram.SeismogramDisplayData;
const HelicorderConfig = sp.helicorder.HelicorderConfig;
const Helicorder = sp.helicorder.Helicorder;

const MINMAX_URL = "https://eeyore.seis.sc.edu/minmax";
const MSEED_URL = "https://eeyore.seis.sc.edu/mseed";

const QUAKE_START_OFFSET = luxon.Duration.fromObject({hours: 1});

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
  let timeRange = luxon.Interval.before(plotEnd, luxDur);
  let hash = {
    config: config,
    timeRange: timeRange,
    staCode: config.station,
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
  const heliDiv = document.querySelector('#heli');
  if (config.station && (! heliDiv || window.getComputedStyle(heliDiv) === "none")) {
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

  let nowHour = sp.util.isoToDateTime("now").endOf('hour').plus({milliseconds: 1});
  let hash = createEmptySavedData(config);

  if ( ! config.station) {
    return Promise.resolve(hash);
  }
  if ( ! config.duration) {
    config.duration = DEFAULT_DURATION;
  }
  history.pushState(config, "title");

  hash.heli = document.querySelector("sp-helicorder");
  if (hash.heli) {
    // draw empty SDD so clear existing and fix labels
    hash.heli.heliConfig.fixedTimeScale = hash.timeRange;
    hash.heli.seisData = [];
    hash.heli.draw();
  }

  clearMessages();
  showMessage(`...loading ${config.netCode}.${config.station}.`);

  let netCodeQuery = config.netCodeList.join();
  let staCodeQuery = config.stationList.join();
  let locCodeQuery = config.locCode;
  let chanCodeQuery = [];
  config.bandCodeList.forEach(bc => {
    config.instCodeList.forEach(ic => chanCodeQuery.push(`${bc}${ic}?`));
  });
  chanCodeQuery = chanCodeQuery.join();
  document.querySelector("span.textNetCode").textContent = "";
  document.querySelector("span.textStaCode").textContent = "";
  document.querySelector("span.textLocCode").textContent = "";
  document.querySelector("span.textChanCode").textContent = "";
  document.querySelector("span.startTime").textContent =
    `${hash.timeRange.start.toFormat('(ooo), MMM d, yyyy HH:mm')}  [GMT]`;
  document.querySelector("span.endTime").textContent =
    `${hash.timeRange.end.toFormat('(ooo), MMM d, yyyy HH:mm')} [GMT]`;
  let channelPromise;
  if (true) {
    // default load from fdsnws
    let channelQuery = new sp.fdsnstation.StationQuery()
      .nodata(404)
      .networkCode(netCodeQuery)
      .stationCode(staCodeQuery)
      .locationCode(locCodeQuery)
      .channelCode(chanCodeQuery)
      .startTime(hash.timeRange.start)
      .endTime(hash.timeRange.start.plus(sp.luxon.Duration.fromMillis(3600*1000)));
    channelPromise = channelQuery.queryChannels();
  } else {
    // or load from local stationxml file
    const fetchInitOptions = sp.util.defaultFetchInitObj(sp.util.XML_MIME);
    const url = "metadata.staxml";
    channelPromise = sp.util.doFetchWithTimeout(url, fetchInitOptions)
      .then(function (response) {
        if (response.status === 200 || response.status === 0) {
          return response.text();
        } else {
          // no data
          throw new Error("No data");
        }
      }).then(rawXmlText => {
        const rawXml = new DOMParser().parseFromString(rawXmlText, "text/xml");
        return sp.stationxml.parseStationXml(rawXml);
      });
  }
  return channelPromise
  .catch(e => {
      showError(`Error Loading Data, retrying... ${e}`);
      return new Promise(resolve => setTimeout(resolve, 2000, channelQuery.queryChannels()));
  })
  .then(netArray => {
    if (netArray.length === 0 ) {
      showError("No channels found");
      hash.seisData = null;
      hash.origData = null;
    }
    let chanTR = [];
    hash.chanTR = chanTR;
    hash.netArray = netArray;
    const matchChannels = sp.stationxml.findChannels(netArray,
      '.*', config.station, config.locCode, `${config.bandCode}${config.instCode}[${config.orientationCode}${config.altOrientationCode}]`);
    console.log(`search sta: ${config.station}`)
    console.log(`search loc: ${config.locCode}`)
    console.log(`search channels:  ${config.bandCode}${config.instCode}[${config.orientationCode}${config.altOrientationCode}]`)
    if (matchChannels.length === 0) {
      console.log(`WARN: found no channels`);
    }
    for (let c of matchChannels) {
      if (c.channelCode.endsWith(config.orientationCode) || (config.altOrientationCode && c.channelCode.endsWith(config.altOrientationCode))) {
        chanTR.push(sp.seismogram.SeismogramDisplayData.fromChannelAndTimeWindow(c, hash.timeRange));
      }
    }
    const firstChan = chanTR[0];
    if (firstChan) {
      document.querySelector("span.textNetCode").textContent = firstChan.networkCode;
      document.querySelector("span.textStaCode").textContent = firstChan.stationCode;
      document.querySelector("span.textLocCode").textContent = firstChan.locationCode;
      document.querySelector("span.textChanCode").textContent = firstChan.channelCode;
    }
    hash.heli = document.querySelector("sp-helicorder");
    if (hash.heli) {
      // draw empty SDD so clear existing and fix labels
      hash.heli.heliConfig.fixedTimeScale = hash.timeRange;
      hash.heli.seisData = chanTR;
      hash.heli.draw();
    }
    return hash;
  }).then(hash => {
    let chantrList;
    let minMaxSddList = [];
    let rawDataList = [];
    hash.chanTR
      .filter(sdd => sdd.startTime < luxon.DateTime.utc())
      .forEach(sdd => {
        if (hash.config.dominmax && sdd.networkCode === 'CO' && sdd.sourceId.bandCode === 'H') {
          minMaxSddList.push(sdd);
        } else {
          rawDataList.push(sdd);
        }
    });
    let minMaxPromise = Promise.resolve([]);
    let rawDataPromise = Promise.resolve([]);
    if (hash.config.dominmax && minMaxSddList.length > 0) {
      let minMaxQ = new sp.mseedarchive.MSeedArchive(
        MINMAX_URL, "%n/%s/%Y/%j/%n.%s.%l.%c.%Y.%j.%H");
      minMaxSddList = minMaxSddList.map( ct => {
        let chanCode = "L"+hash.minMaxInstCode+ct.channel.channelCode.charAt(2);
        let fake = new sp.stationxml.Channel(ct.channel.station, chanCode, ct.channel.locationCode);
        fake.sampleRate = 2;
        hash.heliDataIsMinMax = true;
        return sp.seismogram.SeismogramDisplayData.fromChannelAndTimeWindow(fake, ct.timeRange);
      }).filter(sdd => !!sdd);
      minMaxPromise = minMaxQ.loadSeismograms(minMaxSddList);
    } else if (rawDataList.length > 0) {
      rawDataPromise = loadDataReal(rawDataList);
      hash.heliDataIsMinMax = false;
    } else {
      showError("No channels match selections");
    }
    return Promise.all([hash, rawDataPromise, minMaxPromise]).then(hArr => {
      hArr[0].minMaxSddList = hArr[2];
      hArr[0].chantrList = hArr[1].concat(hArr[2]);
      return hArr[0];
    });
  }).then(hash => {
    console.log(`concat hash ${hash.chantrList.length}`);
    hash.chantrList.forEach(sdd => console.log(`  ${sdd}: ${!!sdd.seismogram }`))
    let gotData = hash.minMaxSddList.reduce((acc, cur) => acc || !!cur.seismogram, false)
      || hash.chantrList.reduce((acc, cur) => acc || !!cur.seismogram, false);
    if ( ! gotData) {
      showError("No Data Found MSeedArchive");
      console.log("min max data from miniseedArchive found none");
      if (false && hash.chanTR.length > 0) {
        let dsQ = new sp.fdsndataselect.DataSelectQuery()
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
      if (ctr.channel.channelCode === `L${hash.minMaxInstCode}${hash.config.orientationCode}` || ctr.channel.channelCode === `L${hash.minMaxInstCode}${hash.config.altOrientationCode}`) {
        minMaxSeismogram = ctr.seismogram;
      } else if (ctr.channel.channelCode === `${hash.bandCode}${hash.instCode}${hash.config.orientationCode}` || ctr.channel.channelCode === `${hash.bandCode}${hash.instCode}${hash.config.altOrientationCode}`) {
        minMaxSeismogram = ctr.seismogram;
        document.querySelector("span.textChanCode").textContent = ctr.channel.channelCode;
      } else {
        throw new Error(`Cannot find trace ends with L${hash.minMaxInstCode}${hash.config.orientationCode} or L${hash.minMaxInstCode}${hash.config.altOrientationCode} or ${hash.bandCode}${hash.instCode}${hash.config.orientationCode}`);
      }
    });
    if (! minMaxSeismogram) {
      showError("No Data Found DataSelect");
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
    let quakeStart = hash.timeRange.start.minus(QUAKE_START_OFFSET);
    let localQuakesQuery = new sp.fdsnevent.EventQuery();
    localQuakesQuery
      .minMag(0)
      .startTime(quakeStart)
      .endTime(hash.timeRange.end)
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
    // replace each local quake from the big query with one queried by
    // public id, this also gets analyst "picks"
    const redoLocalQuakes = hash.localQuakes.map( q => {
      let quakeQuery = new sp.fdsnevent.EventQuery();
      quakeQuery.eventId(q.eventId);
      return quakeQuery.query().then(qlist => {
          if (qlist && qlist.length>0) {
            // assume only one, use first
            return qlist[0];
          } else {
            // server didn't find, oh well
            return q;
          }
      });
    });

    return Promise.all([hash, Promise.all(redoLocalQuakes)]).then(hArr => {
      hArr[0].localQuakes = hArr[1];
      return hArr[0];
    });
  }).then(hash => {
    let quakeStart = hash.timeRange.start.minus(QUAKE_START_OFFSET);
    let regionalQuakesQuery = new sp.fdsnevent.EventQuery();
    regionalQuakesQuery
      .startTime(quakeStart)
      .endTime(hash.timeRange.end)
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
    let quakeStart = hash.timeRange.start.minus(QUAKE_START_OFFSET);
    let globalQuakesQuery = new sp.fdsnevent.EventQuery();
    globalQuakesQuery
      .startTime(quakeStart)
      .endTime(hash.timeRange.end)
      .minMag(hash.config.globalMinMag);
    const globalQuakes = globalQuakesQuery.query();
    return Promise.all([hash, globalQuakes]).then(hArr => {
      hArr[0].globalQuakes = hArr[1];
      return hArr[0];
    });
  }).catch(e => {
      showError(`Error Loading Earthquake Data: ${e}`);
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
      let ttresult = new sp.traveltime.TraveltimeQuery()
        .evdepth( quake.depth > 0 ? quake.depth/1000 : 0)
        .evlat(quake.latitude).evlon(quake.longitude)
        .stalat(mystation.latitude).stalon(mystation.longitude)
        .phases('p,P,PKP,PKIKP,Pdiff,s,S,Sdiff,PKP,SKS,SKIKS,PP,SS')
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
            quake: quake,
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
      let distaz = sp.distaz.distaz(mystation.latitude, mystation.longitude, quake.latitude, quake.longitude);
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
  console.log(`loading real data...`)
  let mseedQ = new sp.mseedarchive.MSeedArchive(
    MSEED_URL,
    "%n/%s/%Y/%j/%n.%s.%l.%c.%Y.%j.%H");
  let beforeNowChanTR = sddList.map( ct => {
    if (ct.startTime > luxon.DateTime.utc()) {
      // seis in the future
      return null;
    }
    return ct;
  }).filter(sdd => !!sdd);
  let CO_sddList = beforeNowChanTR.filter(sdd => sdd.networkCode === 'CO');
  let other_sddList = beforeNowChanTR.filter(sdd => sdd.networkCode !== 'CO');
  const dsQuery = new sp.fdsndataselect.DataSelectQuery();
  return Promise.all([
    mseedQ.loadSeismograms(beforeNowChanTR),
    dsQuery.postQuerySeismograms(other_sddList),
  ]).then(parr => parr[0].concat(parr[1]))
  .then( sddList => {console.log(`real dta : ${sddList.length}`); return sddList;})
}

export function filterData(config, origData) {
  let inData = origData;
  let outData = inData;
  if (config.rmean) {
    let rmeanSeis = sp.filter.rMean(outData.seismogram);
    outData = outData.cloneWithNewSeismogram(rmeanSeis);
  }
  if (config.filter.type === "allpass") {
  } else {
    let butterworth;
    let filterStyle;
    if (config.filter.type == "lowpass") {
      filterStyle = sp.filter.LOW_PASS;
    } else if (config.filter.type === "bandpass") {
      filterStyle = sp.filter.BAND_PASS;
    } else if (config.filter.type === "highpass") {
      filterStyle = sp.filter.HIGH_PASS;
    }
    butterworth = sp.filter.createButterworth(
                           2, // poles
                           filterStyle,
                           Number.parseFloat(config.filter.lowcut), // low corner
                           Number.parseFloat(config.filter.highcut), // high corner not used
                           1/outData.seismogram.sampleRate // delta (period)
                  );
    const fitLine = sp.filter.lineFit(outData.seismogram);
    let filteredSeis = sp.filter.removeTrend(outData.seismogram, fitLine);
    //filteredSeis = sp.taper.taper(filteredSeis);
    filteredSeis = sp.filter.applyFilter(butterworth, filteredSeis);
    outData = outData.cloneWithNewSeismogram(filteredSeis);
  }
  return outData;
}

export function redrawHeli(hash) {
  if ( ! hash.heli ) {
    hash.heli = document.querySelector("sp-helicorder");
  }
  if ( ! hash.heliDataIsMinMax) {
    hash.seisData = filterData(hash.config, hash.origData);
  }

  if (hash.seisData) {
    hash.station = hash.seisData.stationCode;
    let heliConfig = new HelicorderConfig(hash.timeRange);
    heliConfig.markerFlagpoleBase = 'center';
    heliConfig.detrendLines = true;
    heliConfig.lineSeisConfig.markerFlagpoleBase = 'center';
    updateHeliAmpConfig(hash, heliConfig);
    clearMessages();
    hash.heli.seisData = hash.seisData;
    hash.heli.heliConfig = heliConfig;
    hash.heli.addEventListener("helimousemove", hEvent => {
      const mouseTimeSpan = document.querySelector("#mousetime")
      if (mouseTimeSpan) {
        mouseTimeSpan.textContent = `${hEvent.detail.time.toISO()}`;
      }
    });
    hash.heli.addEventListener("heliclick", hEvent => {
      hash.centerTime = hEvent.detail.time;
      const hwValue = document.querySelector("#clickinterval").value;
      let dur;
      if ( ! Number.isNaN(Number.parseFloat(hwValue))) {
        // assume seconds
        dur = luxon.Duration.fromMillis(1000*Number.parseFloat(hwValue));
      } else {
        dur = luxon.Duration.fromISO(hwValue);
      }
      if (dur.toMillis() > 0 ) {
        hash.halfWidth = luxon.Duration.fromMillis(dur.toMillis()/2);
      }
      if (hash.station) {
        drawSeismograph(hash);
      } else {
        console.log(`no station in hash: ${hash.station}`)
      }
    });
  } else {
    showMessage("No Data.")
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
}

export function drawSeismograph(hash) {
  console.log(`draw seis for ${hash.station}`);
  document.querySelector("#heli").setAttribute("style", "display: none;");
  const seismographDiv = document.querySelector("#seismograph");
  seismographDiv.setAttribute("style", "display: block;");

  // let friendChannels = Array.from(sp.stationxml.allChannels(hash.netArray));
  let friendChannels = Array.from(sp.stationxml.allChannels(hash.netArray));
  friendChannels = friendChannels.filter(ch => ch.station.stationCode === hash.station);

  // let friendChannels = [];
  // hash.stationList.forEach(sta => {
  //   let staChans = Array.from(sp.stationxml.findChannels(hash.netArray,
  //                                                 hash.chanTR[0].networkCode,
  //                                                 sta,
  //                                                 hash.chanTR[0].locationCode,
  //                                                 hash.chanTR[0].channelCode.slice(0,2)+".",
  //                                               ));
  //   friendChannels = friendChannels.concat(staChans);
  // });

  let halfWidth = hash.halfWidth;
  if (! halfWidth) { halfWidth = sp.luxon.Duration.fromISO("PT5M"); }
  const seismographDisp = seismographDiv.querySelector("sp-organized-display");
  const interval = sp.luxon.Interval.fromDateTimes(hash.centerTime.minus(halfWidth), hash.centerTime.plus(halfWidth));
  const overlapQuakes = hash.traveltimes.filter(tt => {
    const lastArrival = tt.ttimes.arrivals.reduce((acc, cur) => acc.time > cur.time ? acc : cur);
    const quakeInterval = sp.luxon.Interval.after(tt.quake.time, { seconds: lastArrival.time});
    return interval.overlaps(quakeInterval);
  }).map(tt => tt.quake);
  let sddList = friendChannels.map(channel => {
    let sdd = sp.seismogram.SeismogramDisplayData.fromChannelAndTimeWindow(channel, interval);
    sdd.addMarkers(hash.seisData.markerList);
    sdd.quakeList = overlapQuakes;
    return sdd;
  });
  let seismographConfig = new sp.seismographconfig.SeismographConfig();
  seismographConfig.linkedAmplitudeScale = new sp.scale.IndividualAmplitudeScale();

  seismographDisp.seismographConfig = seismographConfig;
  seismographDisp.seisData = sddList;
  seismographDisp.draw();

  seismographDisp.addEventListener("seismousemove", sEvt => {
      const mouseTimeSpan = document.querySelector("#mousetime")
      if (mouseTimeSpan) {
        if (sEvt.detail.time) {
          mouseTimeSpan.textContent = sEvt.detail.time.toISO();
        } else {
          mouseTimeSpan.textContent = sEvt.detail.relative_time.toISO();
        }
      }
  });

  return loadDataReal(seismographDisp.seisData).then((sddList) => {
    console.log(`data loaded, before filter: ${sddList.length}`)
    let filtSddList = sddList.map(sdd => filterData(hash.config, sdd));
    // looks dumb, but recalcs time and amp
    seismographDisp.seisData = filtSddList;
    return sddList;
  });
}

export function showError(msg) {
  showMessage(msg);
  document.querySelector("#messagesParent").setAttribute("open", true);
}
export function showMessage(msg) {
  let msgText = document.querySelector("#messages").appendChild(document.createElement("h3"));
  msgText.setAttribute("class","error");
  msgText.textContent = msg;
}
export function clearMessages() {
  document.querySelector("#messages").innerHTML = "";
  document.querySelector("#messagesParent").setAttribute("open", false);
}
