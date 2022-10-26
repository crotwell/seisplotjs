import * as seisplotjs from './seisplotjs_3.0.0-alpha.4_standalone.mjs';
import {getNowTime, loadDataReal} from './doplot.js';

const d3 = seisplotjs.d3;
const luxon = seisplotjs.luxon;

const locCodeList = ['00', '01'];
const orientList = ['Z', 'N/1', 'E/2'];
const bandInstCodeList = [ 'HN', 'HH', 'LH'];

export function updateDateChooser(config) {
  let dateChooser = document.querySelector("sp-datetime");
  if ( config.endTime && config.duration) {
    dateChooser.updateTime(seisplotjs.util.isoToDateTime(config.endTime).minus(luxon.Duration.fromISO(config.duration)));
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
    d3.select("#amp")
      .select("input#fixedAmpText").property("value", config.amp);
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
    const timeWindowsToReload = [];
    const dispElements = orgDisp.getDisplayItems();
    dispElements.forEach(orgDispItem => {
      if (orgDispItem.plottype.startsWith(seisplotjs.displayorganize.SEISMOGRAPH)) {
        const seismograph = orgDispItem.getContainedPlotElements()[0];// as seisplotjs.seismograph.Seismograph;
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
  let staButtonSpan = d3.select("#scsnStations")
    .select("form")
    .selectAll("span")
    .data(config.stationList)
    .enter()
    .append("span");
  staButtonSpan
    .append("label")
    .text(function(d) {return d;});
  staButtonSpan.insert("input", ":first-child")
    .attr("type", "radio")
    .attr("class", "shape")
    .attr("name", "station")
    .attr("value", function(d, i) {return i;})
    .property("checked", function(d, i) {return d===config.station;})
    .on("click", function(d) {
      config.station = d3.select(this).text();
      loadAndPlotFun(config);
    })
    .text(function(d) {return d;});
  d3.select("#scsnStations").selectAll("input").on("change", function(){
      console.log(this.value)
  });
  let orientButtonSpan = d3.select("#orientations")
    .selectAll("span")
    .data(orientList)
    .enter()
    .append("span");
    orientButtonSpan
      .append("label")
      .text(function(d) {return d;});
    orientButtonSpan.insert("input", ":first-child")
      .attr("type", "radio")
      .attr("class", "shape")
      .attr("name", "orientation")
      .attr("value", function(d, i) {return i;})
      .property("checked", function(d, i) {
        return d.charAt(0)===config.orientationCode;
      })
      .on("click", function(d) {
        let newOrientationCode = d3.select(this).text();
        if (newOrientationCode.length > 1) {
          config.altOrientationCode = newOrientationCode.slice(-1);
          config.orientationCode = newOrientationCode.charAt(0);
        } else {
          config.orientationCode = newOrientationCode;
          config.altOrientationCode = "";
        }
        console.log(`click ${config.orientationCode} ${config.altOrientationCode}`);
        loadAndPlotFun(config);
      })
      .text(function(d) {return d;});
    d3.select("div.orientations").selectAll("input").on("change", function(){
        console.log(this.value)
    });


  let instButtonSpan = d3.select("#instruments")
    .selectAll("span")
    .data(bandInstCodeList)
    .enter()
    .append("span");
    instButtonSpan
      .append("label")
      .text(function(d) {
        if (d === 'HN') {
          return "Strong Motion";
        } else if (d === 'HH') {
          return "Seismometer";
        } else if (d === 'LH') {
          return "Long Period";
        } else {
          return "UNKNOWN???";
        }
      });
    instButtonSpan.insert("input", ":first-child")
      .attr("type", "radio")
      .attr("class", "shape")
      .attr("name", "instrument")
      .attr("value", function(d, i) {return i;})
      .property("checked", function(d, i) {
        return d.charAt(0)===config.bandCode && d.charAt(1)===config.instCode;
      })
      .on("click", function(d) {
        let bandInst = d3.select(this).text();
        config.bandCode = bandInst.charAt(0);
        config.instCode = bandInst.charAt(1);
        console.log(`click ${config.bandCode}${config.instCode}`);
        loadAndPlotFun(config);
      })
      .text(function(d) {return d;});


  let loccodeButtonSpan = d3.select("#loccode")
    .selectAll("span")
    .data(locCodeList)
    .enter()
    .append("span");
    loccodeButtonSpan
      .append("label")
      .text(d => {return d;});
    loccodeButtonSpan.insert("input", ":first-child")
      .attr("type", "radio")
      .attr("class", "shape")
      .attr("name", "loccode")
      .attr("value", function(d, i) {return i;})
      .property("checked", function(d, i) {
        return d===config.locCode;
      })
      .on("click", function(d) {
        let locCode = d3.select(this).text();
        config.locCode = locCode;
        console.log(`click ${config.locCode} ${config.bandCode}${config.instCode}`);
        loadAndPlotFun(config);
      })
      .text(function(d) {return d;});

  d3.select("button#loadNow").on("click", function(d) {
    config.endTime = getNowTime().toISO();
    console.log(`now ${config.endTime}`);
    updateDateChooser(config);
    loadAndPlotFun(config);
  });

  d3.select("button#loadToday").on("click", function(d) {
    config.endTime = luxon.DateTime.utc().endOf('day').plus({millisecond: 1}).toISO();
    console.log(`today ${config.endTime}`);
    updateDateChooser(config);
    loadAndPlotFun(config);
  });

  d3.select("button#loadPrev").on("click", function(d) {
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

  d3.select("button#loadNext").on("click", function(d) {
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

  d3.select("#amp")
    .select("input#maxAmp")
    .on("click", d => {
      handleAmpChange(config, "max", redrawFun);
    });

  d3.select("#amp")
    .select("input#fixedAmp")
    .on("click", d => {
      let value = Number(d3.select("input#fixedAmpText").property("value"));
      handleAmpChange(config, value, redrawFun);
    });
  d3.select("#amp")
    .select("input#fixedAmpText")
    .on("keypress", function(e) {
      if(e.keyCode === 13) {
        // return  is 13
        let value = Number(d3.select("input#fixedAmpText").property("value"));
        handleAmpChange(config, value, redrawFun);
      }
  }).on("change", () => {
    let value = Number(d3.select("input#fixedAmpText").property("value"));
    handleAmpChange(config, value, redrawFun);
  });

  d3.select("#amp")
    .select("input#percentAmp")
    .on("click", d => {
      let value = d3.select("input#percentAmpSlider").property("value");
      handleAmpChange(config, `${value}%`, redrawFun);
    });
  d3.select("#percentAmpSlider").on("input", function() {
    handleAmpChange(config, `${this.value}%`, redrawFun);
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
  d3.select("#amp")
    .select("input#percentAmp").property("checked", "true");
  d3.select("#amp")
    .select("input#maxAmp").property("checked", "false");
  d3.select("#amp")
    .select("input#fixedAmp").property("checked", "false");
  if (currentConfig) {
    if (typeof currentConfig.amp === 'string' && currentConfig.amp.endsWith('%')) {
      let percent = Number(currentConfig.amp.substring(0, currentConfig.amp.length-1));
      d3.select("input#percentAmpSlider").property("value", percent);
      d3.select("#amp")
        .select("input#percentAmp").property("checked", "true");
    } else if (currentConfig.amp === "max") {
      d3.select("#amp")
        .select("input#maxAmp").property("checked", "true");
      currentConfig.amp = "max";
    } else if ( Number.isFinite(Number(currentConfig.amp))) {
      d3.select("#amp")
        .select("input#fixedAmp").property("checked", "true");
      d3.select("#amp")
        .select("input#fixedAmpText").property("value", currentConfig.amp);
      d3.select("#amp")
        .select("input#fixedAmpText").text(currentConfig.amp);
    } else {
      // default to max?
        d3.select("#amp")
          .select("input#maxAmp").property("checked", "true");
        currentConfig.amp = "max";
    }

  } else {
    // default to max?
      d3.select("#amp")
        .select("input#maxAmp").property("checked", "true");
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
  d3.select("div#"+region)
    .select("input#"+id).property("value", currentConfig[id]);
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
  let inputVal = d3.select("div#"+region)
    .select("input#"+id).property("value");
  if ( Number.isFinite(Number(inputVal))) {
    currentConfig[id] = parseFloat(inputVal);
  } else {
    throw new Error(`Value for input ${id} is not a valid number: ${inputVal}`);
  }
}

export function enableFiltering(heliDataIsMinMax) {
  if (heliDataIsMinMax) {
  }
  d3.select("#filtering")
    .select("input#allpass").property("disabled", `${heliDataIsMinMax}`);
  d3.select("#filtering")
    .select("input#lowpass").property("disabled", `${heliDataIsMinMax}`);
  d3.select("#filtering")
    .select("input#bandpass").property("disabled", `${heliDataIsMinMax}`);
  d3.select("#filtering")
    .select("input#highpass").property("disabled", `${heliDataIsMinMax}`);
}
