

//import {MSeed3Record} from "./mseed3";
import {Quake, createQuakeFromValues} from "./quakeml";
import {isoToDateTime} from "./util";
import {
  MS3ExtraHeader,
  Origin as EHOrigin,
  Station as EHStation,
  Bag as EHBag,
} from "./ms3eh_bag";

export const STD_EH = "bag";

export function ehToQuake(exHead: MS3ExtraHeader): Quake|null {
  const bag = extractBagEH(exHead);
  const ev = bag?.ev;
  if (isValidBagEventJsonEHType(ev)) {
    const time = isoToDateTime(ev.time);
    return createQuakeFromValues("extraheader", time, ev.la, ev.lo, ev.dp);
  }
  return null;
}

export function extractBagEH(jsonEH: Record<string, unknown>): EHBag|null {
  if (!jsonEH || typeof jsonEH !== 'object') {
    return null;
  }
  const eh = jsonEH as MS3ExtraHeader;
  if (typeof eh.bag != 'object') {
    return null
  }
  const object = eh.bag as Record<string, unknown>;
  if (isValidBagJsonEHType(object)) {
    return object;
  } else {
    throw new TypeError(`Oops, we did not get Bag extra header JSON!`);
  }
}



/**
 * Verifies that JSON matches the types we expect, for typescript.
 *
 * @param  v Bag station JSON object, usually from MSeed3 extra headers
 * @returns   true if matches expected structure
 */
export function isValidBagStationJsonEHType(v: unknown): v is EHStation {
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
 * @param  v Bag origin JSON object, usually from MSeed3 extra headers
 * @returns   true if matches expected structure
 */
export function isValidBagEventJsonEHType(v: unknown): v is EHOrigin {
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
 * @param  v Bag JSON object, usually from MSeed3 extra headers
 * @returns   true if matches expected structure
 */
export function isValidBagJsonEHType(v: unknown): v is EHBag {
  if (!v || typeof v !== 'object') {
    return false;
  }
  const object = v as Record<string, unknown>;

  if ( ! ( (typeof object.st === 'undefined' || isValidBagStationJsonEHType(object.st)) &&
      (typeof object.ev === 'undefined' || isValidBagEventJsonEHType(object.ev)) &&
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
