// snip start map
const centerLat = 35;
const centerLon = -100;
const mapZoomLevel = 4;
const quakeMagScaleFactor = 5; // radius in pixels per unit magnitude
const mymap = seisplotjs.leaflet.map('mapid').setView([ centerLat, centerLon], mapZoomLevel);
let topoMap = seisplotjs.leaflet.tileLayer('http://services.arcgisonline.com/arcgis/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 17,
  attribution: 'Map data: <a href="https://services.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer">Esri, Garmin, GEBCO, NOAA NGDC, and other contributors</a>)'
});
topoMap.addTo(mymap);
// snip start quakechan
let queryTimeWindow = new seisplotjs.util.StartEndDuration('2019-07-01', '2019-07-31');
let eventQuery = new seisplotjs.fdsnevent.EventQuery()
  .timeWindow(queryTimeWindow)
  .minMag(7)
  .latitude(35).longitude(-118)
  .maxRadius(3);
let stationQuery = new seisplotjs.fdsnstation.StationQuery()
  .networkCode('CO')
  .stationCode('HODGE')
  .locationCode('00')
  .channelCode('LH?')
  .timeWindow(queryTimeWindow);
// snip start promise
let stationsPromise = stationQuery.queryChannels().then(networkList => {
  for (let s of seisplotjs.stationxml.allStations(networkList)) {
    let m = seisplotjs.leafletutil.createStationMarker(s);
    m.addTo(mymap);
  }
  seisplotjs.d3.select('span#stationCode').text(networkList[0].stations[0].codes());
  return networkList;
});
let quakePromise = eventQuery.query().then( quakeList => {
  for (const q of quakeList) {
    let circle = seisplotjs.leafletutil.createQuakeMarker(q, quakeMagScaleFactor);
    circle.addTo(mymap);
  }
  seisplotjs.d3.select('span#earthquakeDescription').text(quakeList[0].description);
  return quakeList;
});
// snip start traveltime
Promise.all( [ quakePromise, stationsPromise ] )
.then( ( [ quakeList, networkList ] ) => {
    let taupQuery = new seisplotjs.traveltime.TraveltimeQuery()
      .latLonFromStation(networkList[0].stations[0])
      .latLonFromQuake(quakeList[0])
      .phases("P,S");
    return Promise.all( [ quakeList, networkList, taupQuery.queryJson() ] );
// snip start seismogramload
}).then( ( [ quakeList, networkList, ttimes ] ) => {
  let seismogramDataList = [];
  for (const q of quakeList) {
    let firstP = ttimes.arrivals.find(a => a.phase.startsWith('P'));
    let startTime = seisplotjs.moment.utc(q.time)
      .add(firstP.time, 'seconds').subtract(300, 'seconds');
    let timeWindow = new seisplotjs.util.StartEndDuration(startTime, null, 1800);
    let phaseMarkers = seisplotjs.seismograph.createMarkersForTravelTimes(q, ttimes);
    phaseMarkers.push({
      markertype: 'predicted',
      name: "origin",
      time: seisplotjs.moment.utc(q.time)
    });
    for (const c of seisplotjs.stationxml.allChannels(networkList)) {
      let sdd = seisplotjs.seismogram.SeismogramDisplayData.fromChannelAndTimeWindow(c, timeWindow);
      sdd.addQuake(q);
      sdd.addMarkers(phaseMarkers);
      seismogramDataList.push(sdd);
    }
  }
  let dsQuery = new seisplotjs.fdsndataselect.DataSelectQuery();
  let sddPromise = dsQuery.postQuerySeismograms(seismogramDataList);
  return Promise.all( [ quakePromise, stationsPromise, ttimes, sddPromise ] );
// snip start seismograph
}).then( ( [ quakeList, networkList, ttimes, seismogramDataList ] ) => {
  let div = seisplotjs.d3.select('div#myseismograph');
  let graphList = [];
  let commonSeisConfig = new seisplotjs.seismographconfig.SeismographConfig();
  commonSeisConfig.linkedAmpScale = new seisplotjs.seismographconfig.LinkedAmpScale();
  commonSeisConfig.linkedTimeScale = new seisplotjs.seismographconfig.LinkedTimeScale();
  commonSeisConfig.wheelZoom = false;
  commonSeisConfig.doGain = true;
  for( let sdd of seismogramDataList) {
    let seisConfig = commonSeisConfig.clone();
    let subdiv = div.append('div').classed('seismograph', true);
    let graph = new seisplotjs.seismograph.Seismograph(subdiv,
                                                       seisConfig,
                                                       sdd);
    graphList.push(graph);
    graph.draw();
  }
  return Promise.all([ quakeList, networkList, ttimes, seismogramDataList, graphList ]);
// snip start particlemotion
}).then( ( [ quakeList, networkList, ttimes, seismogramDataList, graphList ] ) => {
  let div = seisplotjs.d3.select("div#myparticlemotion");
  let firstS = ttimes.arrivals.find(a => a.phase.startsWith("S"));
  let windowDuration = 60;
  let firstSTimeWindow = new seisplotjs.util.StartEndDuration(
    seisplotjs.moment.utc(quakeList[0].time).add(firstS.time, "seconds").subtract(windowDuration/4, "seconds"),
    null,
    windowDuration);
  seismogramDataList.forEach(sdd => sdd.addMarkers({
    name: "pm start",
    time: firstSTimeWindow.startTime,
    type: "other",
    description: "pm start"}));
  seismogramDataList.forEach(sdd => sdd.addMarkers({
    name: "pm end",
    time: firstSTimeWindow.endTime,
    type: "other",
    description: "pm end"}));
  graphList.forEach(g => g.drawMarkers());
  let xSeisData = seismogramDataList[0].cut(firstSTimeWindow);
  let ySeisData = seismogramDataList[1].cut(firstSTimeWindow);
  let zSeisData = seismogramDataList[2].cut(firstSTimeWindow);
  let spanA = div.append("div").classed("particlemotionContainer", true);
  let spanB = div.append("div").classed("particlemotionContainer", true);
  let spanC = div.append("div").classed("particlemotionContainer", true);

  let minMax = seisplotjs.seismogram.findMinMax([ xSeisData, ySeisData, zSeisData]);
  let seisConfig = new seisplotjs.particlemotion.createParticleMotionConfig(firstSTimeWindow);
  seisConfig.fixedYScale = minMax;
  let pmpA = new seisplotjs.particlemotion.ParticleMotion(spanA, seisConfig, xSeisData, ySeisData);
  pmpA.draw();
  let pmpB = new seisplotjs.particlemotion.ParticleMotion(spanB, seisConfig, xSeisData, zSeisData);
  pmpB.draw();
  let pmpC = new seisplotjs.particlemotion.ParticleMotion(spanC, seisConfig, ySeisData, zSeisData);
  pmpC.draw();

  return Promise.all([ quakeList, networkList, ttimes, seismogramDataList, graphList ]);
}).catch( function(error) {
  seisplotjs.d3.select("div#myseismograph").append('p').html("Error loading data." +error);
  console.assert(false, error);
});
