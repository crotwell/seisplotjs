// snip start map
import {
  fdsndataselect, fdsnevent, fdsnstation,
  filter,
  seismogram, seismograph,
  seismographconfig,
  stationxml,
  util, luxon} from '../seisplotjs_3.0.0-alpha.4_standalone.mjs';

// snip start mapcss
const mymap = document.querySelector('sp-station-event-map');

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
let queryTimeWindow = util.startEnd('2019-07-01', '2019-07-31');
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
    let timeWindow = util.startDuration(q.time, 2400);
    for (const c of stationxml.allChannels(networkList)) {
      let sdd = seismogram.SeismogramDisplayData.fromChannelAndTimeWindow(c, timeWindow);
      sdd.addQuake(q);
      seismogramDataList.push(sdd);
    }
  }
  mymap.seisData = seismogramDataList;
  let dsQuery = new fdsndataselect.DataSelectQuery();
  return dsQuery.postQuerySeismograms(seismogramDataList);
// snip start seismogramplot
}).then( seismogramDataList => {
  seismogramDataList.forEach(sdd => {
    sdd.seismogram = filter.rMean(sdd.seismogram);
  });
  let graph = document.querySelector('sp-seismograph');

  let seisConfigGain = new seismographconfig.SeismographConfig();
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
