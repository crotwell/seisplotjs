import * as seisplotjs from '../seisplotjs_3.0.0-alpha.2_standalone.mjs';

// snip start window
const plotEnd = seisplotjs.luxon.DateTime.utc().endOf('hour').plus({milliseconds: 1});
if (plotEnd.hour % 2 === 1) {plotEnd.plus({hours: 1});}
const oneDay = seisplotjs.luxon.Duration.fromISO('P1D');
const timeWindow = seisplotjs.luxon.Interval.before(plotEnd, oneDay);
const luxOpts = {
  suppressMilliseconds: true,
  suppressSeconds: true,
};
document.querySelector("span#starttime").textContent = timeWindow.start.toISO(luxOpts);
document.querySelector("span#endtime").textContent = timeWindow.end.toISO(luxOpts);
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
    document.querySelector("span#channel").textContent = seisArray[0].codes();
    let heliConfig = new seisplotjs.helicorder.HelicorderConfig(timeWindow);

    heliConfig.title = `Helicorder for ${seisArray[0].codes()}`;
    let seisData = seisplotjs.seismogram.SeismogramDisplayData.fromSeismogram(seisArray[0]);
    seisData.addMarkers([ { markertype: 'predicted', name: "now", time: seisplotjs.luxon.DateTime.utc() } ]);
    let helicorder = new seisplotjs.helicorder.Helicorder(seisData, heliConfig);
    document.querySelector("div#helicorder").append(helicorder);
    helicorder.draw();
  }).catch( function(error) {
    const p = document.createElement('p');
    document.querySelector("div#helicorder").appendChild(p)
    p.textContent = "Error loading data." +error;
    console.assert(false, error);
  });
