// @flow

/*global window */

import moment from 'moment';
if (typeof window !== 'undefined') {
//  console.log("setting global moment for momentTimezone, this is dumb...");
  window.moment = moment; // allow moment-timezone to find it
}
import momentTimezone from 'moment-timezone';

console.assert(moment === momentTimezone, "Two moments!!!");

//reexport
export { moment, };

// flow type for moment type
//import type { moment as momentType } from 'moment';

// flow predicate %check functions
export function hasArgs(value: any): boolean %checks {
  return arguments.length != 0 && typeof value != 'undefined';
}
export function hasNoArgs(value: any): boolean %checks {
  return arguments.length == 0 || typeof value === 'undefined';
}
export function isStringArg(value: any): boolean %checks {
  return arguments.length != 0 && typeof value === 'string';
}
export function isNumArg(value: any): boolean %checks {
  return typeof value === 'number';
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

/** converts the input value is a moment, throws Error if not
 * a string, Date or moment.
 */
export function checkStringOrDate(d: any): moment {
  if (moment.isMoment(d)) {
    return d;
  } else if (d instanceof Date) {
      return moment.utc(d);
  } else if (d instanceof Number || typeof d === "number") {
    return moment.utc(d);
  } else if (d instanceof String || typeof d === "string") {
    return moment.utc(d);
  }
  throw new Error("unknown date type: "+d+" "+(typeof d));
}

/** converts to ISO8601 but removes the trailing Z as FDSN web services
  do not allow that. */
export function toIsoWoZ(date:moment) :string {
  let out = date.toISOString();
  return out.substring(0, out.length-1);
}

export function isDef(v: mixed) :boolean {
  return typeof v !== 'undefined' && v !== null;
}


export type ComplexType = {
  real: number,
  imag: number
}

// allow overriding the complex object to use
// if OregonDSP is loaded we want to use
// its Complex instead of the simple one defined here
export function createComplex(real:number, imag:number): ComplexType {
  /*
  try {
    return new OregonDSP.filter.iir.Complex_init(real, imag);
  } catch(err) {
  console.log("create complex default case "+err);
  return {
    real: real,
    imag: imag
  };
}
*/
  return {
    real: real,
    imag: imag
  };
}
