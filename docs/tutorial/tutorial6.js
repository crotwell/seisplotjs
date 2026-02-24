import * as sp from "../seisplotjs_3.2.0_standalone.mjs";
sp.util.updateVersionText(".sp_version");

// snip start window
const plotEnd = sp.luxon.DateTime.utc().endOf("hour").plus({ milliseconds: 1 });
if (plotEnd.hour % 2 === 1) {
  plotEnd.plus({ hours: 1 });
}
const oneDay = sp.luxon.Duration.fromISO("P1D");
const timeWindow = sp.util.durationEnd(oneDay, plotEnd);
const luxOpts = {
  suppressMilliseconds: true,
  suppressSeconds: true,
};
document.querySelector("span#starttime").textContent =
  timeWindow.start.toISO(luxOpts);
document.querySelector("span#endtime").textContent =
  timeWindow.end.toISO(luxOpts);
new sp.fdsndatacenters.DataCentersQuery()
  .findFdsnDataSelect("EarthScope")
  // snip start seismogram
  .then((dataSelectArray) => {
    return dataSelectArray[0]
      .networkCode("CO")
      .stationCode("HAW")
      .locationCode("00")
      .channelCode("LHZ")
      .timeRange(timeWindow)
      .querySeismograms();
    // snip start heli
  })
  .then((seisArray) => {
    document.querySelector("span#channel").textContent = seisArray[0].codes();
    let heliConfig = new sp.helicorder.HelicorderConfig(timeWindow);

    heliConfig.title = `Helicorder for ${seisArray[0].codes()}`;
    let seisData = sp.seismogram.SeismogramDisplayData.fromSeismogram(
      seisArray[0],
    );
    seisData.addMarkers([
      { markertype: "predicted", name: "now", time: sp.luxon.DateTime.utc() },
    ]);
    let helicorder = new sp.helicorder.Helicorder(seisData, heliConfig);
    document.querySelector("div#helicorder").append(helicorder);
    helicorder.draw();
  })
  .catch(function (error) {
    const p = document.createElement("p");
    document.querySelector("div#helicorder").appendChild(p);
    p.textContent = "Error loading data." + error;
    console.assert(false, error);
  });
