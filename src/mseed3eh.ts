

//import {MSeed3Record} from "./mseed3";
import {Quake, createQuakeFromValues} from "./quakeml";
import {isoToDateTime} from "./util";

export const STD_EH = "std";

export function ehToQuake(sacEH: SacJsonEHType): Quake|null {
  const ev = sacEH.ev;
  if (!!ev) {
    const time = isoToDateTime(ev.time);
    return createQuakeFromValues("extraheader", time, ev.la, ev.lo, ev.dp);
  }
  return null;
}

export function extractSacEH(jsonEH: Record<string, unknown>): SacJsonEHType|null {
  if (!jsonEH || typeof jsonEH !== 'object') {
    return null;
  }
  const eh = jsonEH as ExtraHeaderType;
  if (typeof eh.sac === 'undefined') {
    return null
  }
  const object = eh.sac as Record<string, unknown>;
  if (isValidSacJsonEHType(object)) {
    return object;
  } else {
    throw new TypeError(`Oops, we did not get sac extra header JSON!`);
  }
}

export type StationEHType = {
  la: number;
  lo: number;
  elev?: number;
  dp?: number;
  code?: string;
};
export type OriginEHType = {
  la: number;
  lo: number;
  time: string;
  dp: number;
  mag?: number;
  magtype?: string;
}

/**
 * Type for basic seismology json extra headers
 *
 */
export type SacJsonEHType = {
  st?: StationEHType;
  ev?: OriginEHType;
  gcarc?: number;
  pick?: Array<PickEHType>;
};
export type PickEHType = {
  time: string;
  name: string;
  amp: number;
}
export type ExtraHeaderType = {
  sac: SacJsonEHType|undefined;
}


/**
 * Verifies that JSON matches the types we expect, for typescript.
 *
 * @param  v sac station JSON object, usually from MSeed3 extra headers
 * @returns   true if matches expected structure
 */
export function isValidSacStationJsonEHType(v: unknown): v is StationEHType {
  if (!v || typeof v !== 'object') {
    return false;
  }
  const object = v as Record<string, unknown>;
  return typeof object.la === 'number' &&
    typeof object.lo === 'number' &&
    (typeof object.code === 'undefined' || typeof object.code === 'string') &&
    (typeof object.evel === 'undefined' || typeof object.evel === 'number') &&
    (typeof object.dp === 'undefined' || typeof object.dp === 'number');
}

/**
 * Verifies that JSON matches the types we expect, for typescript.
 *
 * @param  v sac station JSON object, usually from MSeed3 extra headers
 * @returns   true if matches expected structure
 */
export function isValidSacEventJsonEHType(v: unknown): v is OriginEHType {
  if (!v || typeof v !== 'object') {
    return false;
  }
  const object = v as Record<string, unknown>;
  return typeof object.la === 'number' &&
    typeof object.lo === 'number' &&
    typeof object.dp === 'number' &&
    typeof object.time === 'string' &&
    (typeof object.magtype === 'undefined' || typeof object.magtype === 'string') &&
    (typeof object.mag === 'undefined' || typeof object.mag === 'number') &&
    (typeof object.dp === 'undefined' || typeof object.dp === 'number');
}

/**
 * Verifies that JSON matches the types we expect, for typescript.
 *
 * @param  v sac JSON object, usually from MSeed3 extra headers
 * @returns   true if matches expected structure
 */
export function isValidSacJsonEHType(v: unknown): v is SacJsonEHType {
  if (!v || typeof v !== 'object') {
    return false;
  }
  const object = v as Record<string, unknown>;

  if ( ! ( (typeof object.st === 'undefined' || isValidSacStationJsonEHType(object.st)) &&
      (typeof object.ev === 'undefined' || isValidSacEventJsonEHType(object.ev)) &&
      (typeof object.gcarc === 'undefined' || typeof object.gcard === 'number') &&
      (typeof object.az === 'undefined' || typeof object.az === 'number') &&
      (typeof object.baz === 'undefined' || typeof object.baz === 'number')
    )) {
    return false;
  }
  if ( ! (typeof object.picks === 'undefined' || Array.isArray(object.picks))) {
    return false;
  }
  return true;
}
