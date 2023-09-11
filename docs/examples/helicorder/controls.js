import * as sp from '../../seisplotjs_3.1.1_standalone.mjs';
import {getNowTime, loadDataReal} from './doplot.js';

const luxon = sp.luxon;

const locCodeList = ['00', '01'];
const orientList = ['Z', 'N/1', 'E/2'];
const bandInstCodeList = [ 'HN', 'HH', 'LH'];

export function updateDateChooser(config) {
  let dateChooser = document.querySelector("sp-datetime");
  if ( config.endTime && config.duration) {
    dateChooser.updateTime(sp.util.isoToDateTime(config.endTime).minus(luxon.Duration.fromISO(config.duration)));
  } else {
    throw new Error(`missing end/duration: ${config.endTime} ${config.duration}`);
  }
}


export function handleFilteringChange(config, type, lowcut, highcut, redrawFun) {
  config.filter.type = type;
  config.filter.lowcut = lowcut;
  config.filter.highcut = highcut;

  redrawFun(config);
}

export function handleAmpChange(config, value, redrawFun) {
  if (value === "max") {
    config.amp = value;
  } else if (typeof value === 'string' && value.endsWith('%')) {
    config.amp = value;
  } else if (Number.isFinite(value)) {
    config.amp = value;
  } else {
    // assume empty/bad value in text box
    console.log(`bad value in amp: ${value}`);
    config.amp = 10000;
    document.querySelector("#amp")
      .querySelector("input#fixedAmpText").value = config.amp;
  }
  updatePageForConfig(config);
  redrawFun(config);
}

export function setupEventHandlers(config, loadAndPlotFun, redrawFun) {
  if (! loadAndPlotFun) {
    throw new Error("loadandPlotFun must be defined");
  }
    if (! redrawFun) {
      throw new Error("redrawFun must be defined");
    }
  document.querySelector("button#goheli").addEventListener("click", () => {
    document.querySelector("#heli").setAttribute("style", "display: block;");
    document.querySelector("#seismograph").setAttribute("style", "display: none;");
  });
  document.querySelector("button#reload").addEventListener("click", () => {
    const orgDisp = document.querySelector("sp-organized-display");
    const timeRangesToReload = [];
    const dispElements = orgDisp.getDisplayItems();
    dispElements.forEach(orgDispItem => {
      if (orgDispItem.plottype.startsWith(sp.organizeddisplay.SEISMOGRAPH)) {
        const seismograph = orgDispItem.getContainedPlotElements()[0];// as sp.seismograph.Seismograph;
        seismograph.seisData.forEach(sdd => {

          const dispWindow = seismograph.displayTimeRangeForSeisDisplayData(sdd);

          let start = sdd.start;
          let end = sdd.end;
          if (dispWindow.start < sdd.start) { start = dispWindow.start;}
          if (dispWindow.end > sdd.end) { end = dispWindow.end;}
          sdd.timeRange = luxon.Interval.fromDateTimes(start, end);
        });
      }
    });
    loadDataReal(orgDisp.seisData).then(sddList => {
      orgDisp.draw();
    });
  });
  const staDiv = document.querySelector("#scsnStations");
  config.stationList.forEach( sta => {
    const span = staDiv.appendChild(document.createElement("span"));
    const button = span.appendChild(document.createElement("input"));
    const label = span.appendChild(document.createElement("label"));
    label.textContent = sta;
    button.setAttribute("type", "radio");
    button.setAttribute("class", "shape");
    button.setAttribute("name", "station");
    button.textContent = sta;
    button.value = sta;
    button.checked = sta===config.station;
    button.addEventListener('click', event => {
      config.station = sta;
      loadAndPlotFun(config);
    });
  });


  const orientDiv = document.querySelector("#orientations");
  orientList.forEach( orient => {
    const span = orientDiv.appendChild(document.createElement("span"));
    const button = span.appendChild(document.createElement("input"));
    const label = span.appendChild(document.createElement("label"));
    label.textContent = orient;
    button.setAttribute("type", "radio");
    button.setAttribute("class", "shape");
    button.setAttribute("name", "orientation");
    button.textContent = orient;
    button.value = orient;
    button.checked = orient===config.orientationCode;
    button.addEventListener('click', event => {
      let newOrientationCode = orient;
      if (newOrientationCode.length > 1) {
        config.altOrientationCode = newOrientationCode.slice(-1);
        config.orientationCode = newOrientationCode.charAt(0);
      } else {
        config.orientationCode = newOrientationCode;
        config.altOrientationCode = "";
      }
      console.log(`click ${config.orientationCode} ${config.altOrientationCode}`);
      loadAndPlotFun(config);
    });
  });


    const instDiv = document.querySelector("#instruments");
    bandInstCodeList.forEach( bandinst => {
      const span = instDiv.appendChild(document.createElement("span"));
      const button = span.appendChild(document.createElement("input"));
      const label = span.appendChild(document.createElement("label"));
      button.setAttribute("type", "radio");
      button.setAttribute("class", "shape");
      button.setAttribute("name", "instrument");
      let labelName;
      if (bandinst === 'HN') {
        labelName = "Strong Motion";
      } else if (bandinst === 'HH') {
        labelName =  "Seismometer";
      } else if (bandinst === 'LH') {
        labelName =  "Long Period";
      } else {
        labelName =  "UNKNOWN???";
      }
      label.textContent = labelName;
      button.textContent = bandinst;
      button.value = bandinst;
      button.checked = bandinst.charAt(0)===config.bandCode && bandinst.charAt(1)===config.instCode;
      button.addEventListener('click', event => {
        config.bandCode = bandinst.charAt(0);
        config.instCode = bandinst.charAt(1);
        console.log(`click ${config.bandCode}${config.instCode}`);
        loadAndPlotFun(config);
      });
    });

    const locDiv = document.querySelector("#loccode");
    locCodeList.forEach( loc => {
      const span = locDiv.appendChild(document.createElement("span"));
      const button = span.appendChild(document.createElement("input"));
      const label = span.appendChild(document.createElement("label"));
      label.textContent = loc;
      button.setAttribute("type", "radio");
      button.setAttribute("class", "shape");
      button.setAttribute("name", "loccode");
      button.textContent = loc;
      button.value = loc;
      button.checked = loc===config.locCode;
      button.addEventListener('click', event => {
        config.locCode = locCode;
        console.log(`click ${config.locCode} ${config.bandCode}${config.instCode}`);
        loadAndPlotFun(config);
      });
    });

  document.querySelector("button#loadNow").addEventListener("click",  function(d) {
    config.endTime = getNowTime().toISO();
    console.log(`now ${config.endTime}`);
    updateDateChooser(config);
    loadAndPlotFun(config);
  });

  document.querySelector("button#loadToday").addEventListener("click",  function(d) {
    config.endTime = luxon.DateTime.utc().endOf('day').plus({millisecond: 1}).toISO();
    console.log(`today ${config.endTime}`);
    updateDateChooser(config);
    loadAndPlotFun(config);
  });

  document.querySelector("button#loadPrev").addEventListener("click",  function(d) {
    let e = config.endTime;
    if (  !e || e === 'now' ) {
      e = getNowTime();
    } else {
      e = luxon.DateTime.fromISO(e).toUTC();
    }
    config.endTime = e.minus({days: 1}).toISO();
    console.log(`prev ${config.endTime}`);
    updateDateChooser(config);
    loadAndPlotFun(config);
  });

  document.querySelector("button#loadNext").addEventListener("click",  function(d) {
    let e = config.endTime;
    if ( !e || e === 'now' ) {
      e = getNowTime();
    } else {
      e = luxon.DateTime.fromISO(e).toUTC();
    }
    config.endTime = e.plus({day: 1}).toISO();
    console.log(`next ${config.endTime}`);
    updateDateChooser(config);
    loadAndPlotFun(config);
  });

  document.querySelector("input#maxAmp").addEventListener("click",  function(d) {
      handleAmpChange(config, "max", redrawFun);
    });

  document.querySelector("input#fixedAmp").addEventListener("click",  function(d) {
      let value = Number(document.querySelector("input#fixedAmpText").value);
      handleAmpChange(config, value, redrawFun);
    });
  document.querySelector("input#fixedAmpText").addEventListener("keypress",  function(e) {
      if(e.keyCode === 13) {
        // return  is 13
        let value = Number(document.querySelector("input#fixedAmpText").value);
        handleAmpChange(config, value, redrawFun);
      }
  });
  document.querySelector("input#fixedAmpText").addEventListener("change",  function(e) {
    let value = Number(document.querySelector("input#fixedAmpText").value);
    handleAmpChange(config, value, redrawFun);
  });

  document.querySelector("input#percentAmp").addEventListener("click",  function(d) {
      let value = document.querySelector("input#percentAmpSlider").value;
      handleAmpChange(config, `${value}%`, redrawFun);
    });
  document.querySelector("#percentAmpSlider").addEventListener("input",  function(d) {
    let value = Number(document.querySelector("#percentAmpSlider").value);
    handleAmpChange(config, `${value}%`, redrawFun);
  });

  document.querySelector("input#minmax").addEventListener("change", () => {
    config.dominmax = document.querySelector("input#minmax").checked;
    loadAndPlotFun(config).then(() => {enableFiltering(config.heliDataIsMinMax)});
  });
  document.querySelector("input#rmean").addEventListener("change", () => {
    config.rmean = document.querySelector("input#rmean").checked;
    redrawFun(config);
  });

  document.querySelector("input#allpass").addEventListener("change", () => {
    handleFilteringChange(config, "allpass",
      document.querySelector("input#lowcut").value,
      document.querySelector("input#highcut").value,
      redrawFun
    );
  });

  document.querySelector("input#lowpass").addEventListener("change", () => {
    handleFilteringChange(config, "lowpass",
      document.querySelector("input#lowcut").value,
      document.querySelector("input#highcut").value,
      redrawFun,
    );
  });

  document.querySelector("input#bandpass").addEventListener("change", () => {
    handleFilteringChange(config, "bandpass",
      document.querySelector("input#lowcut").value,
      document.querySelector("input#highcut").value,
      redrawFun,
    );
  });

  document.querySelector("input#highpass").addEventListener("change", () => {
    handleFilteringChange(config, "highpass",
      document.querySelector("input#lowcut").value,
      document.querySelector("input#highcut").value,
      redrawFun,
    );
  });

}

export function updatePageForConfig(currentConfig) {
  // minmax
  document.querySelector("input#minmax").checked = currentConfig.dominmax;

  // rmean
  document.querySelector("input#rmean").checked = currentConfig.rmean;

  // filtering
  let doAllPass = false;
  let doLowPass = false;
  let doBandPass = false;
  let doHighPass = false;
  if (currentConfig && currentConfig.filter) {
    if (currentConfig.filter.type === "lowpass") {
      doLowPass = "true";
    } else if (currentConfig.filter.type === "bandpass") {
      doBandPass = "true";
    } else if (currentConfig.filter.type === "highpass") {
      doHighPass = "true";
    } else {
      // all pass
      doAllPass = "true";
    }
    document.querySelector("input#allpass").checked = doAllPass;
    document.querySelector("input#lowpass").checked = doLowPass;
    document.querySelector("input#bandpass").checked = doBandPass;
    document.querySelector("input#highpass").checked = doHighPass;

    document.querySelector("input#lowcut").value = currentConfig.filter.lowcut;
    document.querySelector("input#lowcut").textContent = currentConfig.filter.lowcut;
    document.querySelector("input#highcut").value = currentConfig.filter.highcut;
    document.querySelector("input#highcut").textContent = currentConfig.filter.highcut;
  }

  // amp
  document.querySelector("#percentAmp").checked = true;
  document.querySelector("#maxAmp").checked = false;
  document.querySelector("#fixedAmp").checked = false;
  if (currentConfig) {
    if (typeof currentConfig.amp === 'string' && currentConfig.amp.endsWith('%')) {
      let percent = Number(currentConfig.amp.substring(0, currentConfig.amp.length-1));
      document.querySelector("input#percentAmpSlider").value = percent;
      document.querySelector("#percentAmp").checked = true;
    } else if (currentConfig.amp === "max") {
      document.querySelector("#maxAmp").checked = true;
      currentConfig.amp = "max";
    } else if ( Number.isFinite(Number(currentConfig.amp))) {
      document.querySelector("#fixedAmp").checked = true;
      document.querySelector("input#fixedAmpText").value = currentConfig.amp;
      document.querySelector("input#fixedAmpText").textContent = currentConfig.amp;
    } else {
      // default to max?
      document.querySelector("#maxAmp").checked = true;
      currentConfig.amp = "max";
    }

  } else {
    // default to max?
    document.querySelector("#maxAmp").checked = true;
      currentConfig.amp = "max";
  }

  // earthquake query params
  updateEarthquakeQueryParam(currentConfig, 'localMinLat', 31.75);
  updateEarthquakeQueryParam(currentConfig, 'localMaxLat', 35.5);
  updateEarthquakeQueryParam(currentConfig, 'localMinLon', -84);
  updateEarthquakeQueryParam(currentConfig, 'localMaxLon', -78);
  updateEarthquakeQueryParam(currentConfig, 'regionalMaxRadius', 10);
  updateEarthquakeQueryParam(currentConfig, 'regionalMinMag', 4.5);
  updateEarthquakeQueryParam(currentConfig, 'globalMinMag', 6);
  loadAllEarthquakeQueryParams(currentConfig);
};

function updateEarthquakeQueryParam(currentConfig, id, defaultValue) {
  let region = 'global';
  if (id.startsWith('local')) {
    region = 'local';
  } else if (id.startsWith('regional')) {
    region = 'regional';
  } else if (id.startsWith('global')) {
    region = 'global';
  } else {
    throw new Error(`Unknown region for ${id}`);
  }
  if ( ! Number.isFinite(Number(currentConfig[id]))) {
    currentConfig[id] = defaultValue;
  }
  if (typeof currentConfig[id] !== 'number') {
    currentConfig[id] = parseFloat(currentConfig[id]);
  }
  document.querySelector("div#"+region)
    .querySelector("input#"+id).value = currentConfig[id];
};

function loadAllEarthquakeQueryParams(currentConfig) {
  loadEarthquakeQueryParam(currentConfig, 'localMinLat');
  loadEarthquakeQueryParam(currentConfig, 'localMaxLat');
  loadEarthquakeQueryParam(currentConfig, 'localMinLon');
  loadEarthquakeQueryParam(currentConfig, 'localMaxLon');
  loadEarthquakeQueryParam(currentConfig, 'regionalMaxRadius');
  loadEarthquakeQueryParam(currentConfig, 'regionalMinMag');
  loadEarthquakeQueryParam(currentConfig, 'globalMinMag');
}

function loadEarthquakeQueryParam(currentConfig, id) {
  let region = 'global';
  if (id.startsWith('local')) {
    region = 'local';
  } else if (id.startsWith('regional')) {
    region = 'regional';
  } else if (id.startsWith('global')) {
    region = 'global';
  } else {
    throw new Error(`Unknown region for ${id}`);
  }
  let inputVal = document.querySelector("div#"+region)
    .querySelector("input#"+id).value;
  if ( Number.isFinite(Number(inputVal))) {
    currentConfig[id] = parseFloat(inputVal);
  } else {
    throw new Error(`Value for input ${id} is not a valid number: ${inputVal}`);
  }
}

export function enableFiltering(heliDataIsMinMax) {
  if (heliDataIsMinMax) {
  }
  document.querySelector("#filtering")
    .querySelector("input#allpass").disabled = heliDataIsMinMax;
  document.querySelector("#filtering")
    .querySelector("input#lowpass").disabled = heliDataIsMinMax;
  document.querySelector("#filtering")
    .querySelector("input#bandpass").disabled = heliDataIsMinMax;
  document.querySelector("#filtering")
    .querySelector("input#highpass").disabled = heliDataIsMinMax;
}
