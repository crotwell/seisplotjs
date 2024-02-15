import * as sp from '../seisplotjs_3.1.4-alpha.1_standalone.mjs';
sp.util.updateVersionText('.sp_version');

// snip start eventandstation
let queryTimeWindow = sp.util.startEnd('2019-07-01', '2019-07-31');
let eventQuery = new sp.fdsnevent.EventQuery()
  .timeRange(queryTimeWindow)
  .minMag(7)
  .latitude(35).longitude(-118)
  .maxRadius(3);
let stationQuery = new sp.fdsnstation.StationQuery()
  .networkCode('CO')
  .stationCode('HODGE')
  .locationCode('00')
  .channelCode('HH?')
  .timeRange(queryTimeWindow);
// snip start loaderinit
let loader = new sp.seismogramloader.SeismogramLoader(stationQuery, eventQuery);
loader.startOffset = -30;
loader.endOffset = 270;
loader.markedPhaseList = "origin,PP,pP";
loader.withResponse = true;
loader.load().then(dataset => {


// snip start map
  let staText = "";
  for (let s of sp.stationxml.allStations(dataset.inventory)) {
    staText += s.codes();
  }
  document.querySelector('span#stationCode').textContent=staText;

  let quakeText="";
  for (const q of dataset.catalog) {
    quakeText+=q.description+" ";
  }
  document.querySelector('span#earthquakeDescription').textContent =quakeText;

// snip start filter
  dataset.processedWaveforms = dataset.waveforms.map(sdd => {
    let butterworth = sp.filter.createButterworth(
                           2, // poles
                           sp.filter.BAND_PASS,
                           .5, // low corner
                           10, // high corner
                           1/sdd.seismogram.sampleRate // delta (period)
                  );
    let rmeanSeis = sp.filter.rMean(sdd.seismogram);
    let filteredSeis = sp.filter.applyFilter(butterworth, rmeanSeis);
    let taperSeis = sp.taper.taper(filteredSeis);
    let correctedSeis = sp.transfer.transfer(taperSeis,
        sdd.channel.response, .001, .02, 250, 500);
    sdd.seismogram = correctedSeis;
    return sdd;
  });
// snip start seisconfig
  let div = document.querySelector('div#myseismograph');
  let seisConfig = new sp.seismographconfig.SeismographConfig();
  seisConfig.linkedTimeScale = new sp.scale.LinkedTimeScale();
  seisConfig.linkedAmplitudeScale = new sp.scale.LinkedAmplitudeScale();
  seisConfig.wheelZoom = false;
// snip start gain
  seisConfig.doGain = false;
  for( let sdd of dataset.processedWaveforms) {
    let graph = new sp.seismograph.Seismograph([sdd], seisConfig);
    div.appendChild(graph);
  }
// snip start fft
  let fftList = dataset.processedWaveforms.map(sdd => {
    if (sdd.seismogram.isContiguous()) {
      return sp.fft.fftForward(sdd.seismogram)
    } else {
      return null; // can't do fft for non-contiguouus
    }
  }).filter(x => x); // to remove nulls
  let fftSeisConfig = new sp.seismographconfig.SeismographConfig();
  let fftPlot = new sp.spectraplot.SpectraPlot(fftList, fftSeisConfig);
  document.querySelector('div#fftplot').appendChild(fftPlot);
  return dataset;
}).catch( function(error) {
  const div = document.querySelector('div#myseismograph');
  div.innerHTML = `<p>Error loading data. ${error}</p>`;
  console.assert(false, error);
});
