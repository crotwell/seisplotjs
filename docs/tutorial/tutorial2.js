// snip start querystation
let timeWindow = new seisplotjs.util.StartEndDuration('2019-07-06T03:19:53Z', null, 1800);
let dsQuery = new seisplotjs.fdsndataselect.DataSelectQuery();
dsQuery.networkCode('CO')
  .stationCode('HODGE')
  .locationCode('00')
  .channelCode('LHZ')
  .timeWindow(timeWindow);
// snip start queryseis
dsQuery.querySeismograms().then(seisArray => {
    // only plot the first seismogram
    let seismogram = seisArray[0];
    let div = seisplotjs.d3.select('div#myseismograph');
    let seisConfig = new seisplotjs.seismographconfig.SeismographConfig();
    seisConfig.title = seismogram.codes();
    let seisData = seisplotjs.seismogram.SeismogramDisplayData.fromSeismogram(seismogram);
    let graph = new seisplotjs.seismograph.Seismograph(div, seisConfig, seisData);
    graph.draw();
  }).catch( function(error) {
    seisplotjs.d3.select("div#myseismograph").append('p').html("Error loading data." +error);
    console.assert(false, error);
  });
