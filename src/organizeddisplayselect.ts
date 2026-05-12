import {SeismogramDisplayData} from "./seismogram";
import {Quake} from "./quakeml";

export function createStationFilterId(sdd: SeismogramDisplayData) {
  return `station_${sdd.networkCode}_${sdd.stationCode}`;
}
export function stationFilter(sdd: SeismogramDisplayData, container?: Element|null) {
  return inputIdFilter(createStationFilterId(sdd), container);
}

export function orientFilter(sdd: SeismogramDisplayData, container?: Element|null) {
  const inputId = `input#orient_${sdd.channelCode.charAt(2)}`;
  return inputIdFilter(inputId, container);
}

export function bandFilter(sdd: SeismogramDisplayData, container?: Element|null) {
  const inputId = `input#band_${sdd.channelCode.charAt(0)}`;
  return inputIdFilter(inputId, container);
}

export function gainFilter(sdd: SeismogramDisplayData, container?: Element|null) {
  const inputId = `input#gain_${sdd.channelCode.charAt(1)}`;
  return inputIdFilter(inputId, container);
}
export function createQuakeFilterId(quake: Quake) {
  return `quake_${quake.eventId}`;
}
export function quakeFilter(sdd: SeismogramDisplayData, container?: Element|null) {
  return sdd.quakeList.reduce((acc, cur) => {
    return acc && inputIdFilter(createQuakeFilterId(cur), container);
  }, true);
}

export function inputIdFilter(inputId: string, container?: Element|null) {
    let out = true; // plot by default
    const queryEl = (!!container) ? container : document;
    let inputEl = queryEl.querySelector(`#${inputId}`) as HTMLInputElement;
    if ( inputEl != null) {
      out = inputEl.checked;
    } else {
      console.log(`null inputIdFilter: ${inputId}`)
    }
    console.log(`${inputId} => ${out}`)
    return out;
}

export function defaultPlotSelect(sdd: SeismogramDisplayData, container?: Element|null) {
  return stationFilter(sdd, container)
      && bandFilter(sdd, container)
      && gainFilter(sdd, container)
      && orientFilter(sdd, container)
      && quakeFilter(sdd, container);
}
