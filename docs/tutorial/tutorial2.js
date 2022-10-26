// snip start querystation
import {
  fdsndataselect,
  seismogram, seismograph,
  seismographconfig, util, luxon
} from '../seisplotjs_3.0.0-alpha.4_standalone.mjs';

let timeWindow = util.startDuration('2019-07-06T03:19:53Z', 1800);
let dsQuery = new fdsndataselect.DataSelectQuery();
dsQuery.networkCode('CO')
  .stationCode('HODGE')
  .locationCode('00')
  .channelCode('LH?')
  .timeWindow(timeWindow);
// snip start queryseis
dsQuery.querySeismograms().then(seisArray => {
    // only plot the first 3 seismograms
    const div = document.querySelector('div#myseismograph');
    let seisConfig = new seismographconfig.SeismographConfig();
    let seisData = [];
    for (let s of seisArray) {
      seisData.push(seismogram.SeismogramDisplayData.fromSeismogram(s));
    }
    let graph = new seismograph.Seismograph(seisData, seisConfig);
    div.appendChild(graph);
  }).catch( function(error) {
    const div = document.querySelector('div#myseismograph');
    div.innerHTML = `
      <p>Error loading data. ${error}</p>
    `;
    console.assert(false, error);
  });
