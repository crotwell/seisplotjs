// snip start map
import * as sp from '../seisplotjs_3.1.4-SNAPSHOT_standalone.mjs';
sp.util.updateVersionText('.sp_version');

// snip start mapcss
const mymap = document.querySelector('sp-station-quake-map');

mymap.addStyle(`
  div.stationMapMarker {
    color: rebeccapurple;
  }
  path.quakeMapMarker {
    fill: orange;
    stroke: yellow;
    fill-opacity: 0.25;
  }
`);

// snip start quakechan
let queryTimeWindow = sp.util.startEnd('2019-07-01', '2019-07-31');
let eventQuery = new sp.fdsnevent.EventQuery()
  .timeRange(queryTimeWindow)
  .minMag(7)
  .latitude(35).longitude(-118)
  .maxRadius(3);
let stationQuery = new sp.fdsnstation.StationQuery()
  .networkCode('CO')
  .stationCode('HODGE')
  .locationCode('00')
  .channelCode('LH?')
  .timeRange(queryTimeWindow);
// snip start promise
let stationsPromise = stationQuery.queryChannels();
let quakePromise = eventQuery.query();
// snip start seismogramload
Promise.all( [ quakePromise, stationsPromise ] )
.then( ( [ quakeList, networkList ] ) => {
  document.querySelector("span#stationCode").textContent = networkList[0].stations[0].codes();
  document.querySelector("span#earthquakeDescription").textContent = quakeList[0].description;
  let seismogramDataList = [];
  for (const q of quakeList) {
    const timeWindow = sp.util.startDuration(q.time, 2400);
    for (const c of sp.stationxml.allChannels(networkList)) {
      let sdd = sp.seismogram.SeismogramDisplayData.fromChannelAndTimeWindow(c, timeWindow);
      sdd.addQuake(q);
      seismogramDataList.push(sdd);
    }
  }
  mymap.seisData = seismogramDataList;
  let dsQuery = new sp.fdsndataselect.DataSelectQuery();
  return dsQuery.postQuerySeismograms(seismogramDataList);
// snip start seismogramplot
}).then( seismogramDataList => {
  seismogramDataList.forEach(sdd => {
    sdd.seismogram = sp.filter.rMean(sdd.seismogram);
  });
  let graph = document.querySelector('sp-seismograph');

  let seisConfigGain = new sp.seismographconfig.SeismographConfig();
  seisConfigGain.doGain = true;
  seisConfigGain.amplitudeMode = "mean";
  graph.seismographConfig = seisConfigGain;
  graph.seisData = seismogramDataList
}).catch( function(error) {
  const div = document.querySelector('div#myseismograph');
  div.innerHTML = `
    <p>Error loading data. ${error}</p>
  `;
  console.assert(false, error);
});
