// snip start map
import * as sp from "../seisplotjs_3.2.0-SNAPSHOT_standalone.mjs";
sp.util.updateVersionText(".sp_version");

const mymap = document.querySelector("sp-station-quake-map");

// snip start setup
let queryTimeWindow = sp.util.startEnd("2019-07-01", "2019-07-31");
let eventQuery = new sp.fdsnevent.EventQuery()
  .timeRange(queryTimeWindow)
  .minMag(7)
  .latitude(35)
  .longitude(-118)
  .maxRadius(3);
let stationQuery = new sp.fdsnstation.StationQuery()
  .networkCode("CO")
  .stationCode("HODGE")
  .locationCode("00")
  .channelCode("LH?")
  .timeRange(queryTimeWindow);
// snip start traveltime
let stationsPromise = stationQuery.queryChannels();
let quakePromise = eventQuery.query();
const allPhases = "P,S";
const ttimePromise = Promise.all([quakePromise, stationsPromise])
  .then(([quakeList, networkList]) => {
    document.querySelector("span#stationCode").textContent =
      networkList[0].stations[0].codes();
    document.querySelector("span#earthquakeDescription").textContent =
      quakeList[0].description;
    let quakeTTimesPromiseList = quakeList.map((q) => {
      const allDistDeg = [];
      for (const s of sp.stationxml.allStations(networkList)) {
        if (s.timeRange.contains(q.time)) {
          const daz = sp.distaz.distaz(
            s.latitude,
            s.longitude,
            q.latitude,
            q.longitude,
          );
          allDistDeg.push(daz.distanceDeg);
        }
      }
      const taupQuery = new sp.traveltime.TraveltimeQuery();
      taupQuery.distdeg(allDistDeg);
      taupQuery.evdepthInMeter(q.depth);
      taupQuery.phases(allPhases);
      return taupQuery.queryText();
    });
    return Promise.all([
      quakeList,
      networkList,
      Promise.all(quakeTTimesPromiseList),
    ]);
  })
  .then(([quakeList, networkList, quakeTTimesList]) => {
    const ttdiv = document.querySelector("#traveltimes");
    quakeTTimesList.forEach((qtt) => {
      const preEl = ttdiv.appendChild(document.createElement("pre"));
      preEl.textContent = qtt;
    });
    // snip start seismogramload
    const loader = new sp.seismogramloader.SeismogramLoader(
      networkList,
      quakeList,
    );
    loader.startOffset = -300;
    loader.endOffset = 1200;
    loader.markedPhaseList = "PcP,SS";

    return loader.load();
  })
  .then((dataset) => {
    let seismogramDataList = sp.sorting.reorderXYZ(dataset.waveforms);
    mymap.seisData = seismogramDataList;

    // snip start seismograph
    let div = document.querySelector("div#myseismograph");
    let graphList = [];
    let commonSeisConfig = new sp.seismographconfig.SeismographConfig();
    commonSeisConfig.linkedAmpScale = new sp.scale.LinkedAmplitudeScale();
    commonSeisConfig.linkedTimeScale = new sp.scale.LinkedTimeScale();
    commonSeisConfig.doGain = true;
    for (let sdd of seismogramDataList) {
      let graph = new sp.seismograph.Seismograph([sdd], commonSeisConfig);
      graphList.push(graph);
      div.appendChild(graph);
    }
    // snip start particlemotion
    let pmdiv = document.querySelector("div#myparticlemotion");
    let firstS = seismogramDataList[0].traveltimeList.find((a) =>
      a.phase.startsWith("S"),
    );
    let windowDuration = 60;
    let windowStart = seismogramDataList[0].quake.time
      .plus({ seconds: firstS.time })
      .minus({ seconds: windowDuration / 4 });
    let firstSTimeWindow = sp.util.startDuration(windowStart, windowDuration);
    seismogramDataList.forEach((sdd) => {
      sdd.addMarkers([
        {
          name: "pm start",
          time: firstSTimeWindow.start,
          type: "other",
          description: "pm start",
        },
        {
          name: "pm end",
          time: firstSTimeWindow.end,
          type: "other",
          description: "pm end",
        },
      ]);
    });
    graphList.forEach((g) => g.drawMarkers());
    let xSeisData = seismogramDataList[0].cut(firstSTimeWindow);
    let ySeisData = seismogramDataList[1].cut(firstSTimeWindow);
    let zSeisData = seismogramDataList[2].cut(firstSTimeWindow);

    const doGain = true;
    let minMax = sp.seismogram.findMinMax(
      [xSeisData, ySeisData, zSeisData],
      doGain,
    );
    let pmSeisConfig = new sp.particlemotion.createParticleMotionConfig(
      firstSTimeWindow,
    );
    pmSeisConfig.fixedYScale = minMax;
    pmSeisConfig.doGain = doGain;
    let pmpA = new sp.particlemotion.ParticleMotion(
      xSeisData,
      ySeisData,
      pmSeisConfig,
    );
    pmdiv.appendChild(pmpA);
    let pmpB = new sp.particlemotion.ParticleMotion(
      xSeisData,
      zSeisData,
      pmSeisConfig,
    );
    pmdiv.appendChild(pmpB);
    let pmpC = new sp.particlemotion.ParticleMotion(
      ySeisData,
      zSeisData,
      pmSeisConfig,
    );
    pmdiv.appendChild(pmpC);

    return Promise.all([seismogramDataList, graphList, dataset]);
  })
  .catch(function (error) {
    const div = document.querySelector("div#myseismograph");
    div.innerHTML = `<p>Error loading data. ${error}</p>`;
    console.assert(false, error);
  });
