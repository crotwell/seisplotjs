// @flow

/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */

 /**
  * Current version of seisplotjs
  */
import {version} from '../package.json';
export {version};


import moment from 'moment';
import * as d3 from 'd3';

//reexport
export { moment, };


import RSVP from 'rsvp';

RSVP.on('error', function(reason: string) {
  // eslint-disable-next-line no-console
  console.assert(false, reason);
});

//reexport
export {RSVP, };

export const XML_MIME = "application/xml";
export const JSON_MIME = "application/json";
export const JSONAPI_MIME = "application/vnd.api+json";
export const SVG_MIME = "image/svg+xml";
export const TEXT_MIME = "text/plain";

// flow predicate %check functions
export function hasArgs(value: any): boolean %checks {
  return arguments.length !== 0 && typeof value !== 'undefined';
}
export function hasNoArgs(value: any): boolean %checks {
  return arguments.length === 0 || typeof value === 'undefined';
}
export function isStringArg(value: any): boolean %checks {
  return arguments.length !== 0
    && (typeof value === 'string'
        || (isObject(value) && value instanceof String)) ;
}
export function isNumArg(value: any): boolean %checks {
  return arguments.length !== 0
    && (typeof value === 'number'
        || (isObject(value) && value instanceof Number)) ;
}
export function isNonEmptyStringArg(value: any): boolean %checks {
  return arguments.length !== 0 && isStringArg(value) && value.length !== 0;
}
export function isObject(obj: mixed): boolean %checks {
  return obj !== null && typeof obj === 'object';
}
export function isDef(v: mixed): boolean %checks {
  return typeof v !== 'undefined' && v !== null;
}

export function doStringGetterSetter(obj: any, field: string, value?: string): string | any {
  const hiddenField = `_${field}`;
  if (hasNoArgs(value)) {
    return obj[hiddenField];
  } else if (isStringArg(value)) {
    obj[hiddenField] = value;
  } else {
    throw new Error(`${field} value argument is optional or number, but was type ${(typeof value)}, '${value}' `);
  }
  return obj;
}

export function doIntGetterSetter(obj: any, field: string, value?: number): number | any {
  const hiddenField = `_${field}`;
  if (hasNoArgs(value)) {
    return obj[hiddenField];
  } else if (isNumArg(value)) {
    obj[hiddenField] = value;
  } else if (isStringArg(value) && Number.isFinite(Number(value))) {
    obj[hiddenField] = parseInt(value);
  } else {
    throw new Error(`${field} value argument is optional or number, but was type ${(typeof value)}, '${value}' `);
  }
  return obj;
}

export function doFloatGetterSetter(obj: any, field: string, value?: number): number | any {
  const hiddenField = `_${field}`;
  if (hasNoArgs(value)) {
    return obj[hiddenField];
  } else if (isNumArg(value)) {
    obj[hiddenField] = value;
  } else if (isStringArg(value) && Number.isFinite(Number(value))) {
    obj[hiddenField] = parseFloat(value);
  } else {
    throw new Error(`value argument is optional or number, but was type ${(typeof value)}, '${value}' `);
  }
  return obj;
}

export function doMomentGetterSetter(obj: any, field: string, value?: moment$Moment): any | moment$Moment {
  const hiddenField = `_${field}`;
  if (hasNoArgs(value)) {
    return (obj[hiddenField]: moment$Moment);
  } else if (hasArgs(value) && isObject(value) && moment.isMoment(value)) {
    obj[hiddenField] = value;
  } else if (hasArgs(value) && moment.isMoment(checkStringOrDate(value))) {
    obj[hiddenField] = checkStringOrDate(value);
  } else {
    throw new Error(`${field} value argument is optional, moment, date or date string, but was type ${(typeof value)}, '${stringify(value)}' `);
  }
  return obj;
}

/**
 * Converts entire DataView to a string as utf-8.
 *
 * @param   dataView bytes to convert
 * @returns           the string
 */
export function dataViewToString(dataView: DataView): string {
  let out = "";
  for (let i=0; i< dataView.byteLength; i++) {
    out += String.fromCharCode(dataView.getUint8(i));
  }
  return out;
}

/**
 * Log a message to the console. Put here to limit lint console errors
 * for the times we really do want to use console.log. Will also append a
 * p tag to a div#debug if it exists.
 *
 * @param   msg the message to log
 */
export function log(msg: string): void {
  // eslint-disable-next-line no-console
  if (console) {console.log(`${stringify(msg)}`);}
  if (typeof window !== 'undefined' && window !== null) {
    d3.select("div#debug").append("p").text(`${stringify(msg)}`);
  }
}

/**
 * Log a warning message to the console. Put here to limit lint console errors
 * for the times we really do want to use console.log. Will also append a
 * p tag to a div#debug if it exists.
 *
 * @param   msg the message to log
 */
export function warn(msg: string): void {
  // eslint-disable-next-line no-console
  if (console) {console.log(`${stringify(msg)}`);}
  if (typeof window !== 'undefined' && window !== null) {
    d3.select("div#debug").append("p").text(`${stringify(msg)}`);
  }
}

/**
 * String representation of input. This is kind of dumb but makes
 *  flow happier.
 *
 * @param value any kind of thing that can be turned into a string
 * @returns a string
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
      if (moment.isMoment(value)) {
        const momentValue = ((value: any): moment$Moment);
        return momentValue.toISOString();
      } else {
        return value.constructor.name+ " "+value.toString();
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

/**
 * Calculates offset of remote server versus local time. It is assumed that the
 * argument was acquired as close in time to calling this as possible.
 *
 * @param  serverTimeUTC now as reported by remote server
 * @returns offset in seconds to now on local machine
 */
export function calcClockOffset(serverTimeUTC: moment$Moment): number {
  return moment.utc().diff(serverTimeUTC, 'seconds', true);
}

export const WAY_FUTURE: moment$Moment = moment.utc('2500-01-01T00:00:00');

/**
 * Any two of startTime, endTime and duration can be specified, or just duration which
 * then assumes endTime is now.
 * startTime and endTime are moment objects, duration is in seconds.
 * clockOffset is the seconds that should be subtracted from the computer time
 * to get real world time, ie computerUTC - UTC
 * or moment.utc().diff(serverTimeUTC, 'seconds', true).
 * default is zero.
 */
export class StartEndDuration {
  _startTime: moment$Moment;
  _endTime: moment$Moment;
  _duration: moment$MomentDuration;
  _clockOffset: moment$MomentDuration;
  constructor(startTime: moment$Moment | string | null, endTime: moment$Moment | string | null, duration: moment$MomentDuration | string | number | null =null, clockOffset?: number | null =0) {
    if (isDef(duration)) {
      if ((typeof duration === "string" )) {
        if (duration.charAt(0) === 'P') {
          this._duration = moment.duration(duration);
        } else {
          this._duration = moment.duration(Number.parseFloat(duration), 'seconds');
        }
      } else if ((typeof duration === "number" )) {
        this._duration = moment.duration(duration, 'seconds');
      } else if ((moment.isDuration(duration))) {
        const momentDuration = ((duration: any): moment$MomentDuration);
        this._duration = momentDuration;
      } else {
        throw new Error(`Unknown type for duration: ${typeof duration} ${duration.constructor.name}  ${JSON.stringify(duration)}`);
      }
    }
    if (isDef(startTime) && isDef(endTime)) {
      this._startTime = checkStringOrDate(startTime);
      this._endTime = checkStringOrDate(endTime);
      this._duration = moment.duration(this.endTime.diff(this.startTime));
    } else if (isDef(startTime) && isDef(this._duration)) {
      this._startTime = checkStringOrDate(startTime);
      this._endTime = moment.utc(this.startTime).add(this.duration);
    } else if (isDef(endTime) && isDef(this._duration)) {
      this._endTime = checkStringOrDate(endTime);
      this._startTime = moment.utc(this.endTime).subtract(this.duration);
    } else if (isDef(this._duration)) {
      if (! isDef(clockOffset) ) {
        this._clockOffset = moment.duration(0, 'seconds');
      } else if (typeof clockOffset === 'number') {
        this._clockOffset = moment.duration(clockOffset, 'seconds');
      } else {
        this._clockOffset = clockOffset;
      }
      this._endTime = moment.utc().subtract(this._clockOffset);
      this._startTime = moment.utc(this.endTime).subtract(this.duration);
    } else if (isDef(startTime)) {
      // only a start time, maybe like a Channel that is active currently
      this._startTime = checkStringOrDate(startTime);
      this._endTime = moment.utc(WAY_FUTURE);
      this._duration = moment.duration(this.endTime.diff(this.startTime));
    } else {
      throw new Error(`need some combination of startTime, endTime and duration: ${stringify(startTime)} ${stringify(endTime)} ${stringify(duration)}`);
    }
  }
  get start(): moment$Moment {
    return this._startTime;
  }
  get startTime(): moment$Moment {
    return this._startTime;
  }
  get end(): moment$Moment {
    return this._endTime;
  }
  get endTime(): moment$Moment {
    return this._endTime;
  }
  get duration(): moment$MomentDuration {
    return this._duration;
  }
  get clockOffset(): moment$MomentDuration {
    return this._clockOffset;
  }
  /**
   * Check if this time window contains the given moment. Equality to start
   * or end is considered being contained in.
   *
   * @param   other moment to check
   * @returns        true if moment is inside this time range
   */
  contains(other: moment$Moment | StartEndDuration): boolean {
    if (moment.isMoment(other)){
      const momentOther = ((other: any): moment$Moment);
      if (this.startTime.isAfter(momentOther)
          || this.endTime.isBefore(momentOther)) {
        return false;
      }
      return true;
    } else if (other instanceof StartEndDuration) {
      return this.contains(other.startTime) && this.contains(other.endTime);
    } else {
      let otherType = "?";
      if (other && isDef(other.constructor)) { otherType = other.constructor.name; }
      throw new Error(`expect moment or StartEndDuration: "${stringify(other)}" ${otherType}`);
    }
  }
  overlaps(other: StartEndDuration): boolean {
    if (this.startTime.isAfter(other.endTime)
        || this.endTime.isBefore(other.startTime)) {
      return false;
    }
    return true;
  }
  intersect(other: StartEndDuration): StartEndDuration | null {
    let out = null;
    if (this.overlaps(other)) {
      let tb = this.startTime;
      if (tb.isBefore(other.startTime)) {
        tb = other.startTime;
      }
      let te = this.endTime;
      if (te.isAfter(other.endTime)) {
        te = other.endTime;
      }
      out = new StartEndDuration(tb, te);
    }
    return out;
  }
  union(other: StartEndDuration): StartEndDuration {
    let tb = this.startTime;
    if (tb.isAfter(other.startTime)) {
      tb = other.startTime;
    }
    let te = this.endTime;
    if (te.isBefore(other.endTime)) {
      te = other.endTime;
    }
    return new StartEndDuration(tb, te);
  }
  toString(): string {
    return `StartEndDuration: ${toIsoWoZ(this.startTime)} to ${toIsoWoZ(this.endTime)} ${this.duration.toISOString()}`;
  }
}

/**
 * converts the input value is a moment, throws Error if not
 * a string, Date or moment. Zero length string or "now" return
 * current time.
 *
 * @param d 'now', string time, Date, number of milliseconds since epoch, or moment
 * @returns moment created from argument
 */
export function checkStringOrDate(d: any): moment$Moment {
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


/**
 * Converts name and value into a html query parameter, with appending ampersand.
 *
 * @param   name parameter name
 * @param   val  parameter value
 * @returns      formated query parameter
 */
export function makeParam(name: string, val: mixed): string {
  return name+"="+encodeURIComponent(stringify(val))+"&";
}

/**
 * Converts name and value into a parameter line, with appending newline,
 * for including in POST body.
 *
 * @param   name parameter name
 * @param   val  parameter value
 * @returns      formated query parameter
 */
export function makePostParam(name: string, val: mixed): string {
  return name+"="+stringify(val)+"\n";
}

/**
 * converts to ISO8601 but removes the trailing Z as FDSN web services
 * do not allow that.
 *
 * @param  date moment to convert to string
 * @returns ISO8601 without timezone Z
 **/
export function toIsoWoZ(date: moment$Moment): string {
  let out = date.toISOString();
  return out.substring(0, out.length-1);
}

/**
 * @returns the protocol, http or https for the document if possible.
 **/
export function checkProtocol(): string {
  let _protocol = 'http:';
  if (typeof document !== 'undefined' && document !== null
      && 'location' in document
      && 'protocol' in document.location
      && "https:" === document.location.protocol) {
    _protocol = 'https:';
  }
  return _protocol;
}

/**
 * Create default fetch init object with the given mimeType. Sets
 * no-cache, follow redirects, cors mode, referrer as seisplotjs and mimetype as a header.
 *
 * @param   mimeType requested mime type
 * @returns           object with fetch configuration parameters
 */
export function defaultFetchInitObj(mimeType?: string): { [key: string]: any } {
  let headers = {};
  if (isStringArg(mimeType)) {
    headers.Accept = mimeType;
  }
  return {
        cache: 'no-cache',
        redirect: 'follow', // manual, *follow, error
        mode: "cors",
        referrer: "seisplotjs",
        headers: headers
  };
}

/**
 * Does a fetch, but times out if it takes too long.
 *
 * @param   url        url to retrieve
 * @param   fetchInit  fetch configuration, initialization
 * @param   timeoutSec maximum time to wait in seconds
 * @returns             promise to the result
 * @throws Error if time out or other failure
 */
export function doFetchWithTimeout(url: string | URL,
                                   fetchInit?: { [key: string]: any },
                                   timeoutSec?: number): Promise<Response> {
  const controller = new AbortController();
  const signal = controller.signal;
  if ( ! isDef(fetchInit)) {
    fetchInit = defaultFetchInitObj();
  }
  if ( ! isDef(timeoutSec) ){
    timeoutSec = 30;
  }
  setTimeout(() => controller.abort(), timeoutSec * 1000);
  fetchInit.signal = signal;
  let absoluteUrl: URL;
  if (url instanceof URL) {
    absoluteUrl = url;
  } else if (isStringArg(url)) {
    absoluteUrl = new URL(url, document.URL);
  } else {
    throw new Error(`url must be string or URL, ${stringify(url)}`);
  }
  log(`attempt to fetch ${fetchInit.method ? fetchInit.method : ""} ${stringify(absoluteUrl)}`);
  return fetch(absoluteUrl.href, fetchInit)
  .catch(err => {
    log("fetch failed, possible CORS or PrivacyBadger or NoScript?");
    throw err;
  }).then(function(response) {
    if(response.ok || response.status === 404) {
      return response;
    }
    return response.text().then(text => {
      // $FlowFixMe
      throw new Error(`fetch response was not ok. ${response.ok} ${response.status}\n${text}`);
    });
  });
}


/**
 * Recursively calculates the mean of a slice of an array. This helps with
 * very long seismograms to equally weight each sample point without overflowing.
 *
 * @param   dataSlice slice of a seismogram
 * @param   totalPts  number of points in the original seismogram
 * @returns            sum of slice data points divided by totalPts
 */
export function meanOfSlice(dataSlice: Int32Array | Float32Array | Float64Array, totalPts: number ): number {
  if (dataSlice.length < 8) {
    return dataSlice.reduce(function(acc, val) {
       return acc + val;
    }, 0) / totalPts;
  } else {
    let byTwo = Math.floor(dataSlice.length / 2);
    return meanOfSlice(dataSlice.slice(0, byTwo), totalPts) + meanOfSlice(dataSlice.slice(byTwo, dataSlice.length), totalPts);
  }
}
