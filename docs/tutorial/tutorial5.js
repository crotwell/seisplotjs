let queryTimeWindow = new seisplotjs.util.StartEndDuration('2019-07-01', '2019-07-31');
let eventQuery = new seisplotjs.fdsnevent.EventQuery()
  .timeWindow(queryTimeWindow)
  .minMag(7)
  .latitude(35).longitude(-118)
  .maxRadius(3);
// snip start station
let stationQuery = new seisplotjs.fdsnstation.StationQuery()
  .networkCode('CO')
  .stationCode('HODGE')
  .locationCode('00')
  .channelCode('HH?')
  .timeWindow(queryTimeWindow);
Promise.all( [ eventQuery.query(), stationQuery.queryResponses() ] )
// snip end
  .then( ( [ quakeList, networks ] ) => {
    let taupQuery = new seisplotjs.traveltime.TraveltimeQuery()
      .latLonFromStation(networks[0].stations[0])
      .latLonFromQuake(quakeList[0])
      .phases("P,S");
    return Promise.all( [ quakeList, networks, taupQuery.queryJson() ] );
  }).then( ( [ quakeList, networks, ttimes ] ) => {
    let phaseMarkers = seisplotjs.seismograph.createMarkersForTravelTimes(quakeList[0], ttimes);
    phaseMarkers.push({
      markertype: 'predicted',
      name: "origin",
      time: seisplotjs.moment.utc(quakeList[0].time)
    });
    let allChannels = Array.from(seisplotjs.stationxml.allChannels(networks));
    let firstP = ttimes.arrivals.find(a => a.phase.startsWith('P'));
    let startTime = seisplotjs.moment.utc(quakeList[0].time)
      .add(firstP.time, 'seconds').subtract(30, 'seconds');
// snip start window
    let timeWindow = new seisplotjs.util.StartEndDuration(startTime, null, 300);
// snip end
    let chanTRList = allChannels.map(c => {
      let sdd = seisplotjs.seismogram.SeismogramDisplayData.fromChannelAndTimeWindow(c, timeWindow);
      sdd.addQuake(quakeList);
      sdd.addMarkers(phaseMarkers);
      return sdd;
    });
    let dsQuery = new seisplotjs.fdsndataselect.DataSelectQuery();
    return Promise.all( [ quakeList, networks, ttimes, dsQuery.postQuerySeismograms(chanTRList) ] );
// snip start filter
  }).then( ( [ quakeList, networks, ttimes, seismogramDataList ] ) => {
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
    return Promise.all( [ quakeList, networks, ttimes, seismogramDataList ] );
// snip end
  }).then( ( [ quakeList, networks, ttimes, seismogramDataList ] ) => {
    let div = seisplotjs.d3.select('div#myseismograph');
    for( let sdd of seismogramDataList) {
      let seisConfig = new seisplotjs.seismographconfig.SeismographConfig();
      seisConfig.linkedAmplitudeScale = new seisplotjs.seismograph.LinkedAmpScale();
      seisConfig.wheelZoom = false;
// snip start gain
      seisConfig.doGain = false;
// snip end
      seisConfig.doRMean = false;
      let subdiv = div.append('div').classed('seismograph', true);
      let graph = new seisplotjs.seismograph.Seismograph(subdiv,
                                                         seisConfig,
                                                         sdd);
      graph.draw();
    }
    seisplotjs.d3.select('span#stationCode').text(networks[0].stations[0].codes());
    seisplotjs.d3.select('span#earthquakeDescription').text(quakeList[0].description);
    return Promise.all( [ quakeList, networks, ttimes, seismogramDataList ] );
// snip start fft
  }).then( ( [ quakeList, networks, ttimes, seismogramDataList ] ) => {
    let div = seisplotjs.d3.select('div#fftplot');
    let fftList = seismogramDataList.map(sdd => {
      if (sdd.seismogram.isContiguous()) {
        return seisplotjs.fft.fftForward(sdd.seismogram)
      } else {
        return null; // can't do fft for non-contiguouus
      }
    }).filter(x => x); // to remove nulls
    let seisConfig = new seisplotjs.seismographconfig.SeismographConfig();
    let fftPlot = new seisplotjs.fftplot.FFTPlot('div#fftplot', seisConfig, fftList, true);
    fftPlot.draw();
    return Promise.all( [ quakeList, networks, ttimes, seismogramDataList ] );
// snip end
  }).catch( function(error) {
    seisplotjs.d3.select("div#myseismograph").append('p').html("Error loading data." +error);
    console.assert(false, error);
  });
