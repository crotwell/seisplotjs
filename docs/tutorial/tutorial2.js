// snip start querystation
import {
  fdsndataselect,
  seismogram, seismograph,
  seismographconfig, util} from './seisplotjs_3.0.0-alpha.0_standalone.mjs';

let timeWindow = new util.StartEndDuration('2019-07-06T03:19:53Z', null, 1800);
let dsQuery = new fdsndataselect.DataSelectQuery();
console.log(`miniseed3: ${fdsndataselect.FORMAT_MINISEED_THREE}`);
dsQuery.networkCode('CO')
  .stationCode('HODGE')
  .locationCode('00')
  .channelCode('LHZ')
  .format(fdsndataselect.FORMAT_MINISEED_THREE)
  .timeWindow(timeWindow);
// snip start queryseis
dsQuery.querySeismograms().then(seisArray => {
    // only plot the first seismogram
    const div = document.querySelector('div#myseismograph');
    let seisConfig = new seismographconfig.SeismographConfig();
    let seisData = [];
    seisData.push(seismogram.SeismogramDisplayData.fromSeismogram(seisArray[0]));
    let graph = new seismograph.Seismograph(seisData, seisConfig);
    div.appendChild(graph);
  }).catch( function(error) {
    const div = document.querySelector('div#myseismograph');
    div.innerHTML = `
      <p>Error loading data. ${error}</p>
    `;
    console.assert(false, error);
  });
