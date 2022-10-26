// snip start map
import {
  d3,
  distaz,
  dataset,
  fdsndataselect, fdsnevent, fdsnstation,
  particlemotion,
  scale,
  seismogram,
  seismogramloader,
  seismograph,
  seismographconfig,
  sorting,
  stationxml,
  traveltime,
  util, luxon} from '../seisplotjs_3.0.0-alpha.4_standalone.mjs';
const mymap = document.querySelector('sp-station-event-map');


// snip start setup
let queryTimeWindow = luxon.Interval.fromDateTimes(util.isoToDateTime('2019-07-01'), util.isoToDateTime('2019-07-31'));
let eventQuery = new fdsnevent.EventQuery()
  .timeWindow(queryTimeWindow)
  .minMag(7)
  .latitude(35).longitude(-118)
  .maxRadius(3);
let stationQuery = new fdsnstation.StationQuery()
  .networkCode('CO')
  .stationCode('HODGE')
  .locationCode('00')
  .channelCode('LH?')
  .timeWindow(queryTimeWindow);
// snip start traveltime
let stationsPromise = stationQuery.queryChannels();
let quakePromise = eventQuery.query();
const allPhases = 'P,S';
const ttimePromise = Promise.all( [ quakePromise, stationsPromise ] )
.then( ( [ quakeList, networkList ] ) => {
  let quakeTTimes = quakeList.map(q => {
    const allDistDeg = [];
    for (const s of stationxml.allStations(networkList)) {
      if (s.timeRange.contains(q.time)) {
        const daz = distaz.distaz(
          s.latitude,
          s.longitude,
          q.latitude,
          q.longitude,
        );
        allDistDeg.push(daz.distanceDeg);
      }
    }
    const taupQuery = new traveltime.TraveltimeQuery();
    taupQuery.distdeg(allDistDeg);
    taupQuery.evdepthInMeter(q.depth);
    taupQuery.phases(allPhases);
//    return taupQuery.queryJson();
    return taupQuery.queryText();
  });
  return Promise.all( [ quakePromise, stationsPromise, Promise.all( quakeTTimes ) ] );
}).then( ( [ quakeList, networkList, quakeTTimes ] ) => {
  const ttdiv = document.querySelector("#traveltimes");
  quakeTTimes.forEach(qtt => {
    const preEl = ttdiv.appendChild(document.createElement("pre"));
    preEl.textContent = qtt;
//    preEl.textContent = JSON.stringify(qtt, null, 2);
  });
});
// snip start seismogramload
const loader = new seismogramloader.SeismogramLoader(stationQuery, eventQuery);
loader.startOffset = -300;
loader.endOffset = 1200;
loader.markedPhaseList = "PcP,SS";
const loadPromise = loader.loadSeismograms();
//dataset.Dataset.fromSeismogramLoader(loader).then(dataset => dataset.saveToZipFile());

loadPromise.then(seismogramDataList => {
  seismogramDataList = sorting.reorderXYZ(seismogramDataList);
  mymap.seisData = seismogramDataList;

// snip start seismograph
  let div = document.querySelector('div#myseismograph');
  let graphList = [];
  let commonSeisConfig = new seismographconfig.SeismographConfig();
  commonSeisConfig.linkedAmpScale = new scale.LinkedAmplitudeScale();
  commonSeisConfig.linkedTimeScale = new scale.LinkedTimeScale();
  commonSeisConfig.wheelZoom = false;
  commonSeisConfig.doGain = true;
  commonSeisConfig.centeredAmp = false;
  for( let sdd of seismogramDataList) {
    let seisConfig = commonSeisConfig.clone();
    let graph = new seismograph.Seismograph([ sdd ], seisConfig);
    graphList.push(graph);
    div.appendChild(graph);
  }
  return Promise.all([ seismogramDataList, graphList ]);
// snip start particlemotion
}).then( ( [ seismogramDataList, graphList ] ) => {
  let pmdiv = document.querySelector("div#myparticlemotion");
  console.log(`pmdiv: ${pmdiv}`)
  let firstS = seismogramDataList[0].traveltimeList.find(a => a.phase.startsWith("S"));
  let windowDuration = 60;
  let firstSTimeWindow = luxon.Interval.after(
    seismogramDataList[0].quake.time.plus({seconds: firstS.time,}).minus({seconds: windowDuration/4}),
    luxon.Duration.fromMillis(1000*windowDuration));
  seismogramDataList.forEach(sdd => sdd.addMarkers({
    name: "pm start",
    time: firstSTimeWindow.start,
    type: "other",
    description: "pm start"}));
  seismogramDataList.forEach(sdd => sdd.addMarkers({
    name: "pm end",
    time: firstSTimeWindow.end,
    type: "other",
    description: "pm end"}));
  graphList.forEach(g => g.drawMarkers());
  let xSeisData = seismogramDataList[0].cut(firstSTimeWindow);
  let ySeisData = seismogramDataList[1].cut(firstSTimeWindow);
  let zSeisData = seismogramDataList[2].cut(firstSTimeWindow);

  const doGain = true;
  const centeredAmp = true;
  let minMax = seismogram.findMinMax([ xSeisData, ySeisData, zSeisData], doGain, centeredAmp);
  let pmSeisConfig = new particlemotion.createParticleMotionConfig(firstSTimeWindow);
  pmSeisConfig.fixedYScale = minMax;
  pmSeisConfig.doGain = doGain;
  pmSeisConfig.centeredAmp = centeredAmp;
  let pmpA = new particlemotion.ParticleMotion(xSeisData, ySeisData, pmSeisConfig);
  pmdiv.appendChild(pmpA);
  //pmpA.draw();
  let pmpB = new particlemotion.ParticleMotion(xSeisData, zSeisData, pmSeisConfig);
  pmdiv.appendChild(pmpB);
  //pmpB.draw();
  let pmpC = new particlemotion.ParticleMotion(ySeisData, zSeisData, pmSeisConfig);
  pmdiv.appendChild(pmpC);
  //pmpC.draw();

  return Promise.all([ seismogramDataList, graphList ]);
}).catch( function(error) {
    const div = document.querySelector('div#myseismograph');
    div.innerHTML = `
      <p>Error loading data. ${error}</p>
    `;
  console.assert(false, error);
});
