// @flow

/*global DataView*/

import moment from 'moment';

//reexport
export { moment, };


import RSVP from 'rsvp';

RSVP.on('error', function(reason: string) {
  console.assert(false, reason);
});

//reexport
export {RSVP, };


// flow predicate %check functions
export function hasArgs(value: any): boolean %checks {
  return arguments.length !== 0 && typeof value !== 'undefined';
}
export function hasNoArgs(value: any): boolean %checks {
  return arguments.length === 0 || typeof value === 'undefined';
}
export function isStringArg(value: any): boolean %checks {
  return arguments.length !== 0 && typeof value === 'string';
}
export function isNumArg(value: any): boolean %checks {
  return typeof value === 'number';
}

export function isObject (obj: mixed): boolean %checks {
  return obj !== null && typeof obj === 'object';
}
export function isDef(v: mixed): boolean %checks {
  return typeof v !== 'undefined' && v !== null;
}

export function dataViewToString(dataView: DataView) {
  let out = "";
  for (let i=0; i< dataView.byteLength; i++) {
    out += String.fromCharCode(dataView.getUint8(i));
  }
  return out;
}


/** String representation of input. THis is kind of dumb but makes
 *  flow happier.
 */
export function stringify(value: mixed): string {
  if (typeof value === 'string') {
    return value;
  } else if (typeof value === 'number') {
    return value.toString();
  } else if (typeof value === 'boolean') {
    return value ? "true" : "false";
  } else if (typeof value === 'undefined') {
    return "undefined";
  } else if (typeof value === 'function') {
    return "function "+value.name;
  } else if (typeof value === 'object') {
    if (value) {
      if (value instanceof moment) {
        return value.toISOString();
      } else {
        return value.toString();
      }
    } else {
      return "null";
    }
// symbol not yet supported by flow
//  } else if (typeof value === 'symbol') {
//    return value.toString();
  } else {
    return "<unknown"+(typeof value)+"???>";
  }
}


export function calcClockOffset(serverTime: moment): number {
  return moment.utc().getTime() - serverTime.getTime();
}

/**
Any two of start, end and duration can be specified, or just duration which
then assumes end is now.
start and end are Date objects, duration is in seconds.
clockOffset is the milliseconds that should be subtracted from the local time
 to get real world time, ie local - UTC
 or new Date().getTime() - serverDate.getTime()
 default is zero.
*/
export class StartEndDuration {
  start: moment;
  end: moment;
  duration: moment.duration;
  clockOffset: moment.duration;
  constructor(start: moment | null, end: moment | null, duration: number | null =null, clockOffset?: number | null =0) {

    if (duration &&
        (typeof duration === "string" || duration instanceof String)) {
      if (duration.charAt(0) === 'P') {
        this.duration = moment.duration(duration);
      } else {
        this.duration = moment.duration(Number.parseFloat(duration), 'seconds');
      }
    }
    if (duration &&
      (typeof duration === "number" || duration instanceof Number)) {
      this.duration = moment.duration(duration, 'seconds');
    }
    if (start && end) {
      this.start = checkStringOrDate(start);
      this.end = checkStringOrDate(end);
      this.duration = moment.duration(this.end.diff(this.start));
    } else if (start && this.duration) {
      this.start = checkStringOrDate(start);
      this.end = moment.utc(this.start).add(this.duration);
    } else if (end && this.duration) {
      this.end = checkStringOrDate(end);
      this.start = moment.utc(this.end).subtract(this.duration);
    } else if (this.duration) {
      if (clockOffset === undefined) {
        this.clockOffset = moment.duration(0, 'seconds');
      } else if (clockOffset instanceof Number) {
        this.clockOffset = moment.duration(clockOffset, 'seconds');
      } else {
        this.clockOffset = clockOffset;
      }
      this.end = moment.utc().subtract(clockOffset);
      this.start = moment.utc(this.end).subtract(this.duration);
    } else {
      throw "need some combination of start, end and duration";
    }
  }
}

/** converts the input value is a moment, throws Error if not
 * a string, Date or moment. Zero length string or "now" return
 * current time.
 */
export function checkStringOrDate(d: any): moment {
  if (moment.isMoment(d)) {
    return d;
  } else if (d instanceof Date) {
      return moment.utc(d);
  } else if (d instanceof Number || typeof d === "number") {
    return moment.utc(d);
  } else if (d instanceof String || typeof d === "string") {
    let lc = d.toLowerCase();
    if (d.length === 0 || lc === "now") {
      return moment.utc();
    } else {
      return moment.utc(d);
    }
  }
  throw new Error("unknown date type: "+d+" "+(typeof d));
}

/** converts to ISO8601 but removes the trailing Z as FDSN web services
  do not allow that. */
export function toIsoWoZ(date: moment): string {
  let out = date.toISOString();
  return out.substring(0, out.length-1);
}

/** returns the protocol, http or https for the document if possible. */
export function checkProtocol() {
  let _protocol = 'http:';
  if (typeof document !== 'undefined' && document.location && "https:" === document.location.protocol) {
    _protocol = 'https:';
  }
  return _protocol;
}
