// snip start map
const centerLat = 35;
const centerLon = -100;
const mapZoomLevel = 4;
const mymap = L.map('mapid').setView([ centerLat, centerLon], mapZoomLevel);
let OpenTopoMap = L.tileLayer('http://services.arcgisonline.com/arcgis/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 17,
  attribution: 'Map data: <a href="https://services.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer">Esri, Garmin, GEBCO, NOAA NGDC, and other contributors</a>)'
}).addTo(mymap);

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
Promise.all([ eventQuery.query(), stationQuery.queryChannels()])
.then( ( [ quakeList, networks ] ) => {
    for (const q of quakeList) {
      let circle = L.circleMarker([q.latitude, q.longitude], {
        color: 'red',
        fillColor: '#f03',
        fillOpacity: 0.15,
        radius: q.magnitude ? (q.magnitude.mag*5) : 3 // in case no mag
      }).addTo(mymap);
      circle.bindTooltip(q.time.toISOString()+" "+(q.magnitude ? (q.magnitude.mag+" "+q.magnitude.type) : "unkn"));
    }
    for (let s of seisplotjs.stationxml.allStations(networks)) {
      let m = L.marker([s.latitude, s.longitude]);
      m.addTo(mymap);
      m.bindTooltip(s.codes());
    }

    let allChannels = Array.from(seisplotjs.stationxml.allChannels(networks));
    let timeWindow = new seisplotjs.util.StartEndDuration(quakeList[0].time, null, 2400);
    let seismogramDataList = allChannels.map(c => {
      return seisplotjs.seismogram.SeismogramDisplayData.fromChannelAndTimeWindow(c, timeWindow);
    });
    let dsQuery = new seisplotjs.fdsndataselect.DataSelectQuery();
    return Promise.all([ quakeList, networks, dsQuery.postQuerySeismograms(seismogramDataList) ]);
// snip start seismograph
  }).then( ( [ quakeList, networks, seismogramDataList ] ) => {
    let div = seisplotjs.d3.select('div#myseismograph');
    let seisConfig = new seisplotjs.seismographconfig.SeismographConfig();
    seisConfig.title = seismogramDataList.map((sdd, i) => i===0?sdd.channel.codes():sdd.channel.channelCode);
    seisConfig.doGain = true;
    let graph = new seisplotjs.seismograph.Seismograph(div,
                                                       seisConfig,
                                                       seismogramDataList);
    graph.draw();
    seisplotjs.d3.select('span#stationCode').text(networks[0].stations[0].codes());
    seisplotjs.d3.select('span#earthquakeDescription').text(quakeList[0].description);
  }).catch( function(error) {
    seisplotjs.d3.select("div#myseismograph").append('p').html("Error loading data." +error);
    console.assert(false, error);
  });
