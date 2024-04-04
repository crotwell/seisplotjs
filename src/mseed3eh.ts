

//import {MSeed3Record} from "./mseed3";
import {FDSNSourceId} from "./fdsnsourceid";
import {Quake, createQuakeFromValues, Magnitude} from "./quakeml";
import {Network, Station, Channel} from "./stationxml";
import {
  MS3ExtraHeader,
  Marker as EHMarker,
  Event as EHEvent,
  Origin as EHOrigin,
  Magnitude as EHMagnitude,
  Channel as EHChannel,
  Timeseries as EHTimeseries,
  BagExtraHeader as EHBag,
} from "./ms3ehtypes";
import {MarkerType} from "./seismographmarker";
import { isoToDateTime, stringify } from "./util";

export const STD_EH = "bag";

export function ehToQuake(exHead: MS3ExtraHeader): Quake|null {
  const bag = extractBagEH(exHead);
  const origin = bag?.ev?.or;
  let q = null;
  if (origin != null) {
    const time = isoToDateTime(origin.tm);
    q = createQuakeFromValues("extraheader", time, origin.la, origin.lo, origin.dp*1000);
    if (bag?.ev?.mag?.v != null) {
      const magtype = bag.ev.mag.t == null ? "" : bag.ev.mag.t;
      const mag = new Magnitude(bag.ev.mag.v, magtype);
      q.preferredMagnitude = mag;
    }
  }
  return q;
}

export function quakeToEH(quake: Quake): EHEvent {
  const ehEvent = {} as EHEvent;
  if (quake.publicId != null) { ehEvent.id = quake.publicId;}
  if (quake.preferredOrigin != null) {
    const or = quake.origin;
    const isoTime = or.time.toISO();
    if (isoTime == null) {
      throw new Error(`Bad origin time: ${stringify(or.time)}`);
    }
    ehEvent.or = {
      tm: isoTime,
      la: or.latitude,
      lo: or.longitude,
      dp: or.depthKm
    };
  }
  if (quake.preferredMagnitude != null) {
    ehEvent.mag = {
      v: quake.preferredMagnitude.mag,
      t: quake.preferredMagnitude.type
    };
  }
  return ehEvent;
}

export function channelToEH(channel: Channel): EHChannel {
  return {
    la: channel.latitude,
    lo: channel.longitude,
    el: channel.elevation,
    dp: channel.depth,
    az: channel.azimuth,
    dip: channel.dip
  };
}

export function ehToChannel(exHead: MS3ExtraHeader, sid: FDSNSourceId): Channel|null {
  const bag = extractBagEH(exHead);
  const ch = bag?.ch;
  const channel = null;
  if (ch != null) {
    const net = new Network(sid.networkCode);
    const sta = new Station(net, sid.stationCode);
    sta.latitude = ch.la;
    sta.longitude = ch.lo;
    if (ch.el != null) { sta.elevation = ch.el;}
    const channel = new Channel(sta, sid.locationCode, sid.formChannelCode());
    channel.latitude = ch.la;
    channel.longitude = ch.lo;
    if (ch.dp != null) { channel.depth = ch.dp;}
    if (ch.el != null) { channel.elevation = ch.el;}
    if (ch.az != null) { channel.azimuth = ch.az;}
    if (ch.dip != null) { channel.dip = ch.dip;}
  }
  return channel;
}

export function markerTypeFromEH(mtype: string): string {
  if (mtype === "pk" || mtype === "pick") {
    return "pick";
  }
  if (mtype === "md" || mtype === "predicted") {
    return "predicted";
  }
  return mtype;
}

export function ehToMarkers(exHead: MS3ExtraHeader): Array<MarkerType> {
  const bag = extractBagEH(exHead);
  const markList = bag?.mark;
  if (markList != null) {
    return markList.map(m => {
      return {
        time: isoToDateTime(m.tm),
        name: m.n,
        markertype: m.mtype == null ? "unknown" : markerTypeFromEH(m.mtype),
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
    return null;
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
export function isValidBagChannelJsonEHType(v: unknown): v is EHChannel {
  if (!v || typeof v !== 'object') {
    return false;
  }
  const object = v as Record<string, unknown>;

  const answer = typeof object.la === 'number' &&
    typeof object.lo === 'number' &&
    (typeof object.code === 'undefined' || typeof object.code === 'string') &&
    (typeof object.el === 'undefined' || typeof object.el === 'number') &&
    (typeof object.dp === 'undefined' || typeof object.dp === 'number');
  // if ( ! answer) {
  //   let reason = "";
  //   if (typeof object.la !== 'number') {
  //     reason += `la not numner: ${typeof object.la}`;
  //   }
  //   if (typeof object.lo !== 'number') {
  //     reason += `lo not numner: ${typeof object.lo}`;
  //   }
  //   if ( ! (typeof object.el === 'undefined' || typeof object.el === 'number')) {
  //     reason += `elev not number: ${typeof object.el}`;
  //   }
  //   if ( ! (typeof object.dp === 'undefined' || typeof object.dp === 'number')) {
  //     reason += `dp not number: ${typeof object.dp}`;
  //   }
  //   console.log(`Station EH fail: ${reason}`);
  // }
  return answer;
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
    (typeof object.or === 'undefined' || isValidBagOriginJsonEHType(object.or)) &&
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
    typeof object.tm === 'string';
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
  return (typeof object.v === 'undefined' || typeof object.v === 'number') &&
    (typeof object.t === 'undefined' || typeof object.t === 'string');
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
  return (typeof object.n === 'string') &&
    (typeof object.tm === 'string') &&
    (typeof object.mtype === 'undefined' || typeof object.mtype === 'string') &&
    (typeof object.desc === 'undefined' || typeof object.desc === 'string');
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

  if ( ! ( (typeof object.st === 'undefined' || isValidBagChannelJsonEHType(object.st)) &&
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
