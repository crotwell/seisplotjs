// snip start querystation
import {
  fdsndataselect,
  seismogram, seismograph,
  seismographconfig, util, luxon
} from '../seisplotjs_3.0.0-alpha.3_standalone.mjs';

let timeWindow = luxon.Interval.after(util.isoToDateTime('2019-07-06T03:19:53Z'), luxon.Duration.fromMillis(1000*1800));
let dsQuery = new fdsndataselect.DataSelectQuery();
console.log(`miniseed3: ${fdsndataselect.FORMAT_MINISEED_THREE}`);
dsQuery.networkCode('CO')
  .stationCode('HODGE')
  .locationCode('00')
  .channelCode('LH?')
  .format(fdsndataselect.FORMAT_MINISEED_THREE)
  .timeWindow(timeWindow);
// snip start queryseis
dsQuery.querySeismograms().then(seisArray => {
    // only plot the first 3 seismograms
    const div = document.querySelector('div#myseismograph');
    let seisConfig = new seismographconfig.SeismographConfig();
    let seisData = [];
    seisData.push(seismogram.SeismogramDisplayData.fromSeismogram(seisArray[0]));
    seisData.push(seismogram.SeismogramDisplayData.fromSeismogram(seisArray[1]));
    seisData.push(seismogram.SeismogramDisplayData.fromSeismogram(seisArray[2]));
    let graph = new seismograph.Seismograph(seisData, seisConfig);

    div.appendChild(graph);
  }).catch( function(error) {
    const div = document.querySelector('div#myseismograph');
    div.innerHTML = `
      <p>Error loading data. ${error}</p>
    `;
    console.assert(false, error);
  });
