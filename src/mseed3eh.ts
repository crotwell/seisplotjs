

//import {MSeed3Record} from "./mseed3";
import {Quake, createQuakeFromValues} from "./quakeml";
import {
  MS3ExtraHeader,
  Marker as EHMarker,
  Event as EHEvent,
  Origin as EHOrigin,
  Magnitude as EHMagnitude,
  Station as EHStation,
  Timeseries as EHTimeseries,
  BagExtraHeader as EHBag,
} from "./ms3ehtypes";
import {MarkerType} from "./seismographmarker";
import { isoToDateTime } from "./util";

export const STD_EH = "bag";

export function ehToQuake(exHead: MS3ExtraHeader): Quake|null {
  const bag = extractBagEH(exHead);
  const origin = bag?.ev?.origin;
  if (origin != null) {
    const time = isoToDateTime(origin.time);
    return createQuakeFromValues("extraheader", time, origin.la, origin.lo, origin.dp);
  }
  return null;
}

export function ehToMarkers(exHead: MS3ExtraHeader): Array<MarkerType> {
  const bag = extractBagEH(exHead);
  const markList = bag?.mark;
  if (markList != null) {
    return markList.map(m => {
      return {
        time: isoToDateTime(m.time),
        name: m.name,
        markertype: m.mtype == null ? "unknown" : m.mtype,
        description: m.desc == null ? "" : m.desc
      };
    });
  }
  return [];
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
 * @param  v Bag event JSON object, usually from MSeed3 extra headers
 * @returns   true if matches expected structure
 */
export function isValidBagEventJsonEHType(v: unknown): v is EHEvent {
  if (!v || typeof v !== 'object') {
    return false;
  }
  const object = v as Record<string, unknown>;
  return (typeof object.id === 'undefined' || typeof object.id === 'string') &&
    (typeof object.origin === 'undefined' || isValidBagOriginJsonEHType(object.mag)) &&
    (typeof object.mag === 'undefined' || isValidBagMagJsonEHType(object.mag)) &&
    (typeof object.mt === 'undefined' || typeof object.mt === 'object');
}

/**
 * Verifies that JSON matches the types we expect, for typescript.
 *
 * @param  v Bag origin JSON object, usually from MSeed3 extra headers
 * @returns   true if matches expected structure
 */
export function isValidBagOriginJsonEHType(v: unknown): v is EHOrigin {
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
 * @param  v Bag magnitude JSON object, usually from MSeed3 extra headers
 * @returns   true if matches expected structure
 */
export function isValidBagMagJsonEHType(v: unknown): v is EHMagnitude {
  if (!v || typeof v !== 'object') {
    return false;
  }
  const object = v as Record<string, unknown>;
  return (typeof object.val === 'undefined' || typeof object.val === 'number') &&
    (typeof object.type === 'undefined' || typeof object.id === 'string');
}

/**
 * Verifies that JSON matches the types we expect, for typescript.
 *
 * @param  v Bag magnitude JSON object, usually from MSeed3 extra headers
 * @returns   true if matches expected structure
 */
export function isValidBagPathJsonEHType(v: unknown): v is EHMagnitude {
  if (!v || typeof v !== 'object') {
    return false;
  }
  const object = v as Record<string, unknown>;
  return (typeof object.gcarc === 'undefined' || typeof object.gcarc === 'number') &&
    (typeof object.az === 'undefined' || typeof object.az === 'number') &&
    (typeof object.baz === 'undefined' || typeof object.baz === 'number');
}


/**
 * Verifies that JSON matches the types we expect, for typescript.
 *
 * @param  v Bag magnitude JSON object, usually from MSeed3 extra headers
 * @returns   true if matches expected structure
 */
export function isValidBagMarkJsonEHType(v: unknown): v is EHMarker {
  if (!v || typeof v !== 'object') {
    return false;
  }
  const object = v as Record<string, unknown>;
  return (typeof object.name === 'string') &&
    (typeof object.time === 'string') &&
    (typeof object.mtype === 'undefined' || typeof object.mtype === 'string');
}

/**
 * Verifies that JSON matches the types we expect, for typescript.
 *
 * @param  v Bag magnitude JSON object, usually from MSeed3 extra headers
 * @returns   true if matches expected structure
 */
export function isValidBagTimeseriesJsonEHType(v: unknown): v is EHTimeseries {
  if (!v || typeof v !== 'object') {
    return false;
  }
  const object = v as Record<string, unknown>;
  return (typeof object.si === 'string') &&
    (typeof object.proc === 'undefined' || typeof object.proc === 'string');
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
      (typeof object.path === 'undefined' || isValidBagPathJsonEHType(object.path)) &&
      (typeof object.y === 'undefined' || typeof object.y === 'object') &&
      (typeof object.mark === 'undefined' || Array.isArray(object.mark))
    )) {
    return false;
  }
  const markerList = object.mark;
  if ( ! (typeof markerList === 'undefined' || Array.isArray(markerList))) {
    return false;
  } else {
    if (markerList != null) {
      for( const m of markerList) {
        if ( ! isValidBagMarkJsonEHType(m)) {
          return false;
        }
      }
    }
  }
  return true;
}
