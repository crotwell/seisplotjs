// snip start createseis
let dataArray = new Float32Array(1000).map(function(d, i) {
  return Math.sin(2*Math.PI*i/100) * 100;
});
let sampleRate = 20;
let start = seisplotjs.moment.utc('2019-07-04T05:46:23Z');
let seismogram = seisplotjs.seismogram.Seismogram.createFromContiguousData(dataArray, sampleRate, start);
// snip start draw
let div = seisplotjs.d3.select('div#sinewave');
let seisConfig = new seisplotjs.seismographconfig.SeismographConfig();
seisConfig.title = "A sine wave!";
seisConfig.margin.top = 25;
let seisData = seisplotjs.seismogram.SeismogramDisplayData.fromSeismogram(seismogram);
let graph = new seisplotjs.seismograph.Seismograph(div, seisConfig, seisData);
graph.draw();
// snip end
