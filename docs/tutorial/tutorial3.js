// snip start map
const centerLat = 35;
const centerLon = -100;
const mapZoomLevel = 4;
const quakeMagScaleFactor = 5; // radius in pixels per unit magnitude
const mymap = seisplotjs.leaflet.map('mapid').setView([ centerLat, centerLon], mapZoomLevel);
mymap.scrollWheelZoom.disable();
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
// snip start seismogramload
Promise.all( [ quakePromise, stationsPromise ] )
.then( ( [ quakeList, networkList ] ) => {
  let seismogramDataList = [];
  for (const q of quakeList) {
    let timeWindow = new seisplotjs.util.StartEndDuration(q.time, null, 2400);
    for (const c of seisplotjs.stationxml.allChannels(networkList)) {
      let sdd = seisplotjs.seismogram.SeismogramDisplayData.fromChannelAndTimeWindow(c, timeWindow);
      sdd.addQuake(q);
      seismogramDataList.push(sdd);
    }
  }
  let dsQuery = new seisplotjs.fdsndataselect.DataSelectQuery();
  let sddPromise = dsQuery.postQuerySeismograms(seismogramDataList);
  return Promise.all( [ quakePromise, stationsPromise, sddPromise ] );
// snip start seismogramplot
}).then( ( [ quakeList, networkList, seismogramDataList ] ) => {
    let div = seisplotjs.d3.select('div#myseismograph');
    let seisConfig = new seisplotjs.seismographconfig.SeismographConfig();
    seisConfig.doGain = true;
    let graph = new seisplotjs.seismograph.Seismograph(div,
                                                       seisConfig,
                                                       seismogramDataList);
    graph.draw();
    return seismogramDataList;
}).catch( function(error) {
  seisplotjs.d3.select("div#myseismograph").append('p').html("Error loading data." +error);
  console.assert(false, error);
});
