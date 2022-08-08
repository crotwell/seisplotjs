import * as seisplotjs from './seisplotjs_3.0.0-alpha.1_standalone.mjs';

const d3 = seisplotjs.d3;
const luxon = seisplotjs.luxon;

export function setupEventHandlers(state) {
  document.querySelector("button#goheli").addEventListener("click", () => {
    console.log(`goheli button`)
    document.querySelector("#heli").setAttribute("style", "display: block;");
    document.querySelector("#seismograph").setAttribute("style", "display: none;");
  });

}

export function updatePageForState(currentState) {
  // minmax
  document.querySelector("input#minmax").checked = currentState.dominmax;

  // rmean
  document.querySelector("input#rmean").checked = currentState.rmean;

  // filtering
  d3.select("#filtering")
    .select("input#allpass").property("checked", "false");
  d3.select("#filtering")
    .select("input#lowpass").property("checked", "false");
  d3.select("#filtering")
    .select("input#bandpass").property("checked", "false");
  d3.select("#filtering")
    .select("input#highpass").property("checked", "false");
  if (currentState && currentState.filter) {
    if (currentState.filter.type === "lowpass") {
      d3.select("#filtering")
        .select("input#lowpass").property("checked", "true");
    } else if (currentState.filter.type === "bandpass") {
      d3.select("#filtering")
        .select("input#bandpass").property("checked", "true");
    } else if (currentState.filter.type === "highpass") {
      d3.select("#filtering")
        .select("input#highpass").property("checked", "true");
    } else {
      // all pass
      d3.select("#filtering")
        .select("input#allpass").property("checked", "true");
    }
    d3.select("#filtering")
      .select("input#lowcut").property("value", currentState.filter.lowcut);
    d3.select("#filtering")
      .select("input#lowcut").text(currentState.filter.lowcut);
    d3.select("#filtering")
      .select("input#highcut").property("value", currentState.filter.highcut);
    d3.select("#filtering")
      .select("input#highcut").text(currentState.filter.highcut);
  }

  // amp
  d3.select("#amp")
    .select("input#percentAmp").property("checked", "true");
  d3.select("#amp")
    .select("input#maxAmp").property("checked", "false");
  d3.select("#amp")
    .select("input#fixedAmp").property("checked", "false");
  if (currentState) {
    if (typeof currentState.amp === 'string' && currentState.amp.endsWith('%')) {
      let percent = Number(currentState.amp.substring(0, currentState.amp.length-1));
      d3.select("input#percentAmpSlider").property("value", percent);
      d3.select("#amp")
        .select("input#percentAmp").property("checked", "true");
    } else if (currentState.amp === "max") {
      d3.select("#amp")
        .select("input#maxAmp").property("checked", "true");
      currentState.amp = "max";
    } else if ( Number.isFinite(Number(currentState.amp))) {
      d3.select("#amp")
        .select("input#fixedAmp").property("checked", "true");
      d3.select("#amp")
        .select("input#fixedAmpText").property("value", currentState.amp);
      d3.select("#amp")
        .select("input#fixedAmpText").text(currentState.amp);
    } else {
      // default to max?
        d3.select("#amp")
          .select("input#maxAmp").property("checked", "true");
        currentState.amp = "max";
    }

  } else {
    // default to max?
      d3.select("#amp")
        .select("input#maxAmp").property("checked", "true");
      currentState.amp = "max";
  }

  // earthquake query params
  updateEarthquakeQueryParam(currentState, 'localMinLat', 31.75);
  updateEarthquakeQueryParam(currentState, 'localMaxLat', 35.5);
  updateEarthquakeQueryParam(currentState, 'localMinLon', -84);
  updateEarthquakeQueryParam(currentState, 'localMaxLon', -78);
  updateEarthquakeQueryParam(currentState, 'regionalMaxRadius', 10);
  updateEarthquakeQueryParam(currentState, 'regionalMinMag', 4.5);
  updateEarthquakeQueryParam(currentState, 'globalMinMag', 6);
  loadAllEarthquakeQueryParams(currentState);
  console.log(`currentState: ${JSON.stringify(currentState)}`);
};

function updateEarthquakeQueryParam(currentState, id, defaultValue) {
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
  if ( ! Number.isFinite(Number(currentState[id]))) {
    currentState[id] = defaultValue;
  }
  if (typeof currentState[id] !== 'number') {
    currentState[id] = parseFloat(currentState[id]);
  }
  d3.select("div#"+region)
    .select("input#"+id).property("value", currentState[id]);
};

function loadAllEarthquakeQueryParams(currentState) {
  loadEarthquakeQueryParam(currentState, 'localMinLat');
  loadEarthquakeQueryParam(currentState, 'localMaxLat');
  loadEarthquakeQueryParam(currentState, 'localMinLon');
  loadEarthquakeQueryParam(currentState, 'localMaxLon');
  loadEarthquakeQueryParam(currentState, 'regionalMaxRadius');
  loadEarthquakeQueryParam(currentState, 'regionalMinMag');
  loadEarthquakeQueryParam(currentState, 'globalMinMag');
}

function loadEarthquakeQueryParam(currentState, id) {
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
    currentState[id] = parseFloat(inputVal);
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
