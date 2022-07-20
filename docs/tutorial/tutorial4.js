// snip start map
import {
  d3,
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
  util, luxon} from './seisplotjs_3.0.0-alpha.0_standalone.mjs';
const mymap = document.querySelector('sp-station-event-map');
//mymap.scrollWheelZoom.disable();

let loadPromise;
const loadFrom = "dataset";
if (loadFrom === "iris") {
// snip start seismogramload
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
const loader = new seismogramloader.SeismogramLoader(stationQuery, eventQuery);
loader.startOffset = -300;
loader.endOffset = 1200;
loader.markedPhaseList = "PcP,SS";
loadPromise = loader.load();
dataset.Dataset.fromSeismogramLoader(loader).then(dataset => dataset.saveToZipFile());
} else {
  loadPromise = dataset.load('tutorial4_dataset.zip').then(ds => [ ds.inventory, ds.catalog, ds.waveforms]);
}
loadPromise.then(([ networkList, quakeList, seismogramDataList]) => {
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
  return Promise.all([ quakeList, networkList, seismogramDataList, graphList ]);
// snip start particlemotion
}).then( ( [ quakeList, networkList, seismogramDataList, graphList ] ) => {
  let pmdiv = document.querySelector("div#myparticlemotion");
  console.log(`pmdiv: ${pmdiv}`)
  let firstS = seismogramDataList[0].traveltimeList.find(a => a.phase.startsWith("S"));
  let windowDuration = 60;
  let firstSTimeWindow = luxon.Interval.after(
    quakeList[0].time.plus({seconds: firstS.time,}).minus({seconds: windowDuration/4}),
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

  return Promise.all([ quakeList, networkList, seismogramDataList, graphList ]);
}).catch( function(error) {
    const div = document.querySelector('div#myseismograph');
    div.innerHTML = `
      <p>Error loading data. ${error}</p>
    `;
  console.assert(false, error);
});
