// snip start window
const plotEnd = seisplotjs.moment.utc().endOf('hour').add(1, 'millisecond');
if (plotEnd.hour() % 2 === 1) {plotEnd.add(1, 'hour');}
const timeWindow = new seisplotjs.util.StartEndDuration(null, plotEnd, seisplotjs.moment.duration(1, 'day'));
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
    seisplotjs.d3.select("span#starttime").text(timeWindow.start.format('YYYY-MM-DD HH:mm')+"Z");
    seisplotjs.d3.select("span#endtime").text(timeWindow.end.format('YYYY-MM-DD HH:mm')+"Z");
    let heliConfig = new seisplotjs.helicorder.HelicorderConfig(timeWindow);

    heliConfig.title = `Helicorder for ${seisArray[0].codes()}`;
    let seisData = seisplotjs.seismogram.SeismogramDisplayData.fromSeismogram(seisArray[0]);
    seisData.addMarkers([ { markertype: 'predicted', name: "now", time: seisplotjs.moment.utc() } ]);
    let helicorder = new seisplotjs.helicorder.Helicorder("div#helicorder",
                                  heliConfig,
                                  seisData);
    helicorder.draw();
  }).catch( function(error) {
    seisplotjs.d3.select("div#helicorder").append('p').html("Error loading data." +error);
    console.assert(false, error);
  });
