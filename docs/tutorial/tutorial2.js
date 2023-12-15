// snip start querystation
import * as sp from '../seisplotjs_3.1.2_standalone.mjs';
sp.util.updateVersionText('.sp_version');

let timeWindow = sp.util.startDuration('2019-07-06T03:19:53Z', 1800);
let dsQuery = new sp.fdsndataselect.DataSelectQuery();
dsQuery.networkCode('CO')
  .stationCode('HODGE')
  .locationCode('00')
  .channelCode('LH?')
  .timeRange(timeWindow);
// snip start queryseis
dsQuery.querySeismograms().then(seisArray => {
    const div = document.querySelector('div#myseismograph');
    let seisConfig = new sp.seismographconfig.SeismographConfig();
    let seisData = [];
    for (let s of seisArray) {
      seisData.push(sp.seismogram.SeismogramDisplayData.fromSeismogram(s));
    }
    let graph = new sp.seismograph.Seismograph(seisData, seisConfig);
    div.appendChild(graph);
  }).catch( function(error) {
    const div = document.querySelector('div#myseismograph');
    div.innerHTML = `
      <p>Error loading data. ${error}</p>
    `;
    console.assert(false, error);
  });
