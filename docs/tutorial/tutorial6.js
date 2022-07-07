import * as seisplotjs from './seisplotjs_3.0.0-alpha.0_standalone.mjs';

// snip start window
const plotEnd = seisplotjs.luxon.DateTime.utc().endOf('hour').plus({milliseconds: 1});
if (plotEnd.hour % 2 === 1) {plotEnd.plus({hours: 1});}
const oneDay = seisplotjs.luxon.Duration.fromISO('P1D');
const timeWindow = seisplotjs.luxon.Interval.before(plotEnd, oneDay);
new seisplotjs.fdsndatacenters.DataCentersQuery().findFdsnDataSelect("IRISDMC")
// snip start seismogram
  .then(dataSelectArray => {
    return dataSelectArray[0].networkCode('CO')
      .stationCode('JSC')
      .locationCode('00')
      .channelCode('LHZ')
      .timeWindow(timeWindow)
      .querySeismograms();
// snip start heli
  }).then(seisArray => {
    seisplotjs.d3.select("span#channel").text(seisArray[0].codes());
    seisplotjs.d3.select("span#starttime").text(timeWindow.start.toFormat('yyyy-MM-DD HH:mm')+"Z");
    seisplotjs.d3.select("span#endtime").text(timeWindow.end.toFormat('yyyy-MM-DD HH:mm')+"Z");
    let heliConfig = new seisplotjs.helicorder.HelicorderConfig(timeWindow);

    heliConfig.title = `Helicorder for ${seisArray[0].codes()}`;
    let seisData = seisplotjs.seismogram.SeismogramDisplayData.fromSeismogram(seisArray[0]);
    seisData.addMarkers([ { markertype: 'predicted', name: "now", time: seisplotjs.luxon.DateTime.utc() } ]);
    let helicorder = new seisplotjs.helicorder.Helicorder("div#helicorder",
                                  heliConfig,
                                  seisData);
    helicorder.draw();
  }).catch( function(error) {
    seisplotjs.d3.select("div#helicorder").append('p').html("Error loading data." +error);
    console.assert(false, error);
  });
