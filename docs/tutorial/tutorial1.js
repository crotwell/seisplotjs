// snip start createseis


import {seismogram, seismograph, seismographconfig, util} from './seisplotjs_3.0.0-alpha.0_standalone.mjs';

let dataArray = new Float32Array(1000).map(function(d, i) {
  return Math.sin(2*Math.PI*i/100) * 100;
});
let sampleRate = 20;
let start = util.isoToDateTime('2019-07-04T05:46:23');
let myseismogram = seismogram.Seismogram.createFromContiguousData(dataArray, sampleRate, start);
const seisData = [ seismogram.SeismogramDisplayData.fromSeismogram(myseismogram) ];
// snip start draw
const div = document.querySelector('div#sinewave');
const seisConfig = new seismographconfig.SeismographConfig();
seisConfig.title = "A sine wave!";
seisConfig.margin.top = 25;
const graph = new seismograph.Seismograph(seisData, seisConfig);
div.appendChild(graph);
// snip end
