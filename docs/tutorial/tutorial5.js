import * as seisplotjs from './seisplotjs_3.0.0-alpha.0_standalone.mjs';

// snip start eventandstation
let queryTimeWindow = seisplotjs.luxon.Interval.fromDateTimes(
  seisplotjs.util.isoToDateTime('2019-07-01'),
  seisplotjs.util.isoToDateTime('2019-07-31'));
let eventQuery = new seisplotjs.fdsnevent.EventQuery()
  .timeWindow(queryTimeWindow)
  .minMag(7)
  .latitude(35).longitude(-118)
  .maxRadius(3);
let stationQuery = new seisplotjs.fdsnstation.StationQuery()
  .networkCode('CO')
  .stationCode('HODGE')
  .locationCode('00')
  .channelCode('HH?')
  .timeWindow(queryTimeWindow);
// snip start loaderinit
let loader = new seisplotjs.seismogramloader.SeismogramLoader(stationQuery, eventQuery);
loader.startOffset = -30;
loader.endOffset = 270;
loader.markedPhaseList = "origin,PP,pP";
loader.withResponse = true;
let loaderSDDPromise = loader.loadSeismograms();

// snip start map
let stationsPromise = loader.networkList.then(networkList => {
  let staText = "";
  for (let s of seisplotjs.stationxml.allStations(networkList)) {
    staText += s.codes();
  }
  seisplotjs.d3.select('span#stationCode').text(staText);
});
let quakePromise = loader.quakeList.then( quakeList => {
  let quakeText="";
  for (const q of quakeList) {
    quakeText+=quakeList[0].description+" ";
  }
  seisplotjs.d3.select('span#earthquakeDescription').text(quakeText);
});
// snip start filter
loaderSDDPromise.then((seismogramDataList) => {
    seismogramDataList.forEach(sdd => {
      let butterworth = seisplotjs.filter.createButterworth(
                             2, // poles
                             seisplotjs.filter.BAND_PASS,
                             .5, // low corner
                             10, // high corner
                             1/sdd.seismogram.sampleRate // delta (period)
                    );
      let rmeanSeis = seisplotjs.filter.rMean(sdd.seismogram);
      let filteredSeis = seisplotjs.filter.applyFilter(butterworth, rmeanSeis);
      let taperSeis = seisplotjs.taper.taper(filteredSeis);
      let correctedSeis = seisplotjs.transfer.transfer(taperSeis,
          sdd.channel.response, .001, .02, 250, 500);
      sdd.seismogram = correctedSeis;
    });
    return seismogramDataList ;
// snip start seisconfig
  }).then( seismogramDataList  => {
    let div = document.querySelector('div#myseismograph');
    let seisConfig = new seisplotjs.seismographconfig.SeismographConfig();
    seisConfig.linkedTimeScale = new seisplotjs.scale.LinkedTimeScale();
    seisConfig.linkedAmplitudeScale = new seisplotjs.scale.LinkedAmplitudeScale();
    seisConfig.wheelZoom = false;
// snip start gain
    seisConfig.doGain = false;
    seisConfig.doRMean = false;
    for( let sdd of seismogramDataList) {
      let graph = new seisplotjs.seismograph.Seismograph([sdd],
                                                         seisConfig);
      div.appendChild(graph);
    }
    return seismogramDataList;
// snip start fft
  }).then(seismogramDataList => {
    let div = seisplotjs.d3.select('div#fftplot');
    let fftList = seismogramDataList.map(sdd => {
      if (sdd.seismogram.isContiguous()) {
        return seisplotjs.fft.fftForward(sdd.seismogram)
      } else {
        return null; // can't do fft for non-contiguouus
      }
    }).filter(x => x); // to remove nulls
    let seisConfig = new seisplotjs.seismographconfig.SeismographConfig();
    let fftPlot = new seisplotjs.spectraplot.SpectraPlot(fftList, seisConfig);
    document.querySelector('div#fftplot').appendChild(fftPlot);
    return seismogramDataList;
  });

// snip start cleanup
Promise.all( [ quakePromise, stationsPromise, loaderSDDPromise ] )
.catch( function(error) {
    seisplotjs.d3.select("div#myseismograph").append('p').html("Error loading data." +error);
    console.assert(false, error);
  });
