
import type {DateTime} from 'luxon';
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
  const cache = new Map<SeismogramDisplayData, number | string | DateTime>();
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

export function createSortValueFunction(key: string): (sdd: SeismogramDisplayData) => number | string | DateTime {
  if (key === SORT_DISTANCE) {
    return (sdd: SeismogramDisplayData) => {
      let out = Number.MAX_VALUE;
      if (sdd.hasQuake() && sdd.hasChannel()) {
        const distaz = sdd.distaz;
        out = distaz ? Math.min(Number.MAX_VALUE,distaz.delta) : Number.MAX_VALUE;
      }
      return out;
    };
  } else if (key === SORT_AZIMUTH) {
    return (sdd: SeismogramDisplayData) => {
      let out = Number.MAX_VALUE;
      if (sdd.hasQuake() && sdd.hasChannel()) {
        const distaz = sdd.distaz;
        out = distaz ? Math.min(Number.MAX_VALUE,distaz.az) : Number.MAX_VALUE;
      }
      return out;
    };
  } else if (key === SORT_BACKAZIMUTH) {
    return (sdd: SeismogramDisplayData) => {
      let out = Number.MAX_VALUE;
      if (sdd.hasQuake() && sdd.hasChannel()) {
        const distaz = sdd.distaz;
        out = distaz ? Math.min(Number.MAX_VALUE,distaz.baz) : Number.MAX_VALUE;
      }
      return out;
    };
  } else if (key === SORT_ALPHABETICAL) {
    return (sdd: SeismogramDisplayData) => sdd.sourceId.toString();
  } else if (key === SORT_STARTTIME) {
    return (sdd: SeismogramDisplayData) => sdd.startTime;
  } else if (key === SORT_ORIGINTIME) {
    return (sdd: SeismogramDisplayData) => {
      let out = WAY_FUTURE;
      if (sdd.hasQuake()) {
        out = sdd.quake ? sdd.quake.time : out;
      }
      return out;
    };
  } else {
    throw new Error(`unknown sorting key: ${key}`);
  }
}

function xyzCompareFun(a: SeismogramDisplayData, b: SeismogramDisplayData): number {
  if (a.hasChannel() && b.hasChannel()) {
    // first, if dip is close to 90, sort by dip to look for vertical
    if ((Math.abs(a.channel.dip) > 85 || Math.abs(b.channel.dip)>85)) {
      if (a.channel.dip !== b.channel.dip) {
        return Math.abs(a.channel.dip) - Math.abs(b.channel.dip);
      }
    }
    // dips not vertical or are same
    // if az a ~= az b +90 deg, then b before a as x before y
    const ninetyRot = Math.abs((a.channel.azimuth - b.channel.azimuth + 90) % 360);
    if (ninetyRot < 5 || ninetyRot > 355) {
      return 1;
    }
    if (ninetyRot > 175 || ninetyRot < 185) {
      return -1;
    }
  }
  // not diff by 90 deg, or no channels, so just sort by channel code
  // which works out for ZNE and almost for Z12
  const aSID = a.sourceId;
  const bSID = b.sourceId;
  if (aSID && bSID) {
    return aSID.subsourceCode.localeCompare(bSID.subsourceCode);
  } else if (aSID === bSID) {
    return 0;
  } else {
    return -1;
  }
}

/**
 * Reorders array of SeismogramDisplayData in "best effort" xyz order. The data
 * should all be from the same station and represent three components of
 * motion. A common grouping of Z,N,E seismograms in any order would be returned as
 * E,N,Z. If the grouping was Z,1,2 where the azimuth of 1 is 90 degrees ccw
 * from 2, then the returned order would be 2,1,Z.
 *
 * @param  sddList  array representing compoment of motion
 * @returns     sorted array in x,y,z order
 */
export function reorderXYZ(sddList: Array<SeismogramDisplayData>): Array<SeismogramDisplayData> {
  return sddList.slice().sort(xyzCompareFun);
}
