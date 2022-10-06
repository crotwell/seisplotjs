// snip start querystation
import * as seisplotjs from './seisplotjs_3.0.0-alpha.3_standalone.mjs';
let timeWindow = new seisplotjs.util.startDuration('2019-07-06T03:19:53Z', 1800);
let dsQuery = new seisplotjs.fdsndataselect.DataSelectQuery();
console.log(`miniseed3: ${seisplotjs.fdsndataselect.FORMAT_MINISEED_THREE}`);
dsQuery.networkCode('CO')
  .stationCode('HODGE')
  .locationCode('00')
  .channelCode('LHZ')
  .format(seisplotjs.fdsndataselect.FORMAT_MINISEED_THREE)
  .timeWindow(timeWindow);
// snip start queryseis
// this is better way to get seismograms
//dsQuery.querySeismograms().then(seisArray => {
// but this allows us to see the individual records
dsQuery.queryMS3Records().then(ms3Records => {
    let urldiv = seisplotjs.d3.select("div#dataselecturl");
    let ds_url = dsQuery.formURL();
    urldiv.append("p").text("Dataselect URL: ").append("a").attr("href", ds_url).text(ds_url);
    let div = seisplotjs.d3.select("div#mseed3astext");
    ms3Records.forEach(ms3rec => {
      div.append("pre").text(ms3rec.toString());
    });

    return seisplotjs.mseed3.seismogramPerChannel(ms3Records);
}).then(seisArray => {
    // only plot the first seismogram
    let seismogram = seisArray[0];
    let graph = document.querySelector('sp-seismograph');
    graph.seisData = [seisplotjs.seismogram.SeismogramDisplayData.fromSeismogram(seismogram)];
  }).catch( function(error) {
    seisplotjs.d3.select("div#myseismograph").append('p').html("Error loading data." +error);
    console.assert(false, error);
  });
