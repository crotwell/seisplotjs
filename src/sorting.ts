
import { SeismogramDisplayData } from './seismogram';
import {WAY_FUTURE} from './util';

export const SORT_NONE = "none";
export const SORT_DISTANCE = "distance";
export const SORT_AZIMUTH = "azimuth";
export const SORT_BACKAZIMUTH = "backazimuth";
export const SORT_ALPHABETICAL = "alphabetical";
export const SORT_STARTTIME = "starttime";
export const SORT_ORIGINTIME = "origin";

export function sort(seisData: Array<SeismogramDisplayData>, key: string) {
  if (key === SORT_NONE) {
    return seisData;
  }
  const cache = new Map();
  const calcSortValue = createSortValueFunction(key);
  seisData.forEach(sdd => {
    cache.set(sdd, calcSortValue(sdd));
  });
  return seisData.slice().sort((sddA,sddB) => {
    const valA = cache.get(sddA);
    const valB = cache.get(sddB);
    if (!valA && !valB) {
      return 0;
    } else if (!valA) {
      return 1;
    } else if (!valB) {
      return -1;
    } else if (valA < valB) {
      return -1;
    } else if (valA > valB) {
      return 1;
    } else {
      return 0;
    }
  });
}

export function createSortValueFunction(key: string): (sdd: SeismogramDisplayData) => any {
  if (key === SORT_DISTANCE) {
    return (sdd: SeismogramDisplayData) => {
      let out = Number.MAX_VALUE;
      if (sdd.hasQuake && sdd.hasChannel) {
        const distaz = sdd.distaz;
        out = distaz ? Math.min(Number.MAX_VALUE,distaz.delta) : Number.MAX_VALUE;
      }
      return out;
    };
  } else if (key === SORT_AZIMUTH) {
    return (sdd: SeismogramDisplayData) => {
      let out = Number.MAX_VALUE;
      if (sdd.hasQuake && sdd.hasChannel) {
        const distaz = sdd.distaz;
        out = distaz ? Math.min(Number.MAX_VALUE,distaz.az) : Number.MAX_VALUE;
      }
      return out;
    };
  } else if (key === SORT_BACKAZIMUTH) {
    return (sdd: SeismogramDisplayData) => {
      let out = Number.MAX_VALUE;
      if (sdd.hasQuake && sdd.hasChannel) {
        const distaz = sdd.distaz;
        out = distaz ? Math.min(Number.MAX_VALUE,distaz.baz) : Number.MAX_VALUE;
      }
      return out;
    };
  } else if (key === SORT_ALPHABETICAL) {
    return (sdd: SeismogramDisplayData) => sdd.sourceId;
  } else if (key === SORT_STARTTIME) {
    return (sdd: SeismogramDisplayData) => sdd.startTime;
  } else if (key === SORT_ORIGINTIME) {
    return (sdd: SeismogramDisplayData) => {
      let out = WAY_FUTURE;
      if (sdd.hasQuake) {
        out = sdd.quake ? sdd.quake.time : out;
      }
      return out;
    };
  } else {
    throw new Error(`unknown sorting key: ${key}`);
  }
}
