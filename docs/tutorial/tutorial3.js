// snip start map
import {
  fdsndataselect, fdsnevent, fdsnstation,
  seismogram, seismograph,
  seismographconfig,
  stationxml,
  util, luxon} from './seisplotjs_3.0.0-alpha.2_standalone.mjs';

const mymap = document.querySelector('sp-station-event-map');
//mymap.scrollWheelZoom.disable();


// snip start quakechan
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
// snip start promise
let stationsPromise = stationQuery.queryChannels();
let quakePromise = eventQuery.query();
// snip start seismogramload
Promise.all( [ quakePromise, stationsPromise ] )
.then( ( [ quakeList, networkList ] ) => {
  let seismogramDataList = [];
  for (const q of quakeList) {
    let timeWindow = luxon.Interval.after(q.time, luxon.Duration.fromMillis(1000*2400));
    for (const c of stationxml.allChannels(networkList)) {
      let sdd = seismogram.SeismogramDisplayData.fromChannelAndTimeWindow(c, timeWindow);
      sdd.addQuake(q);
      seismogramDataList.push(sdd);
    }
  }
  mymap.seisData = seismogramDataList;
  mymap.seisData.forEach(sdd => {
    console.log(`${sdd.quakeList.length}  ${sdd.quake}`);
  })
  let dsQuery = new fdsndataselect.DataSelectQuery();
  let sddPromise = dsQuery.postQuerySeismograms(seismogramDataList);
  return Promise.all( [ quakePromise, stationsPromise, sddPromise ] );
// snip start seismogramplot
}).then( ( [ quakeList, networkList, seismogramDataList ] ) => {
    let div = document.querySelector('div#myseismograph');
    let seisConfig = new seismographconfig.SeismographConfig();
    seisConfig.doGain = false;
    seisConfig.centeredAmp = true;
    let graphCount = new seismograph.Seismograph(seismogramDataList, seisConfig);
    div.appendChild(graphCount);

    let seisConfigGain = new seismographconfig.SeismographConfig();
    seisConfigGain.doGain = true;
    seisConfigGain.centeredAmp = true;
    let graphGain = new seismograph.Seismograph(seismogramDataList, seisConfigGain);
    div.appendChild(graphGain);
    return seismogramDataList;
}).catch( function(error) {
  const div = document.querySelector('div#myseismograph');
  div.innerHTML = `
    <p>Error loading data. ${error}</p>
  `;
  console.assert(false, error);
});
