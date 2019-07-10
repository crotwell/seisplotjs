// @flow

import moment from 'moment';
import RSVP from 'rsvp';

RSVP.on('error', function(reason: string) {
  console.assert(false, reason);
});

// special due to flow
import {checkProtocol, toIsoWoZ, hasArgs, hasNoArgs, isStringArg, checkStringOrDate, stringify} from './util';

import * as miniseed from './miniseed';
import { Channel } from './stationxml';
import { Seismogram } from './seismogram';


export class ChannelTimeRange {
  channel: Channel;
  startTime: moment;
  endTime: moment;
  constructor(channel: Channel, startTime: moment, endTime: moment) {
    this.channel = channel;
    this.startTime = startTime;
    this.endTime = endTime;
  }
}
export const FORMAT_MINISEED = 'mseed';

export const IRIS_HOST = "service.iris.edu";

export class DataSelectQuery {
  /** @private */
  _specVersion: number;
  /** @private */
  _protocol: string;
  /** @private */
  _host: string;
  /** @private */
  _nodata: number;
  /** @private */
  _port: number;
  /** @private */
  _networkCode: string;
  /** @private */
  _stationCode: string;
  /** @private */
  _locationCode: string;
  /** @private */
  _channelCode: string;
  /** @private */
  _startTime: moment;
  /** @private */
  _endTime: moment;
  /** @private */
  _quality: string;
  /** @private */
  _minimumLength: number;
  /** @private */
  _longestOnly: boolean;
  /** @private */
  _repository: string;
  /** @private */
  _format: string;
  constructor(host?: string) {
    this._specVersion = 1;
    this._protocol = checkProtocol();
    if (host) {
      this._host = host;
    } else {
      this._host = IRIS_HOST;
    }
    this._port = 80;
  }
  /** Gets/Sets the version of the fdsnws spec, 1 is currently the only value.
   *  Setting this is probably a bad idea as the code may not be compatible with
   *  the web service.
  */
  specVersion(value?: number): number | DataSelectQuery {
    if (hasArgs(value)) {
      this._specVersion = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._specVersion;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  /** Gets/Sets the protocol, http or https. This should match the protocol
   *  of the page loaded, but is autocalculated and generally need not be set.
  */
  protocol(value?: string): string | DataSelectQuery {
    if (isStringArg(value)) {
      this._protocol = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._protocol;
    } else {
      throw new Error('value argument is optional or string, but was '+typeof value);
    }
  }
  /** Gets/Sets the remote host to connect to.
  */
  host(value?: string): string | DataSelectQuery {
    if (isStringArg(value)) {
      this._host = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._host;
    } else {
      throw new Error('value argument is optional or string, but was '+typeof value);
    }
  }
  /** Gets/Sets the nodata parameter, usually 404 or 204 (default), controlling
   * the status code when no matching data is found by the service.
   */
  nodata(value?: number): number | DataSelectQuery {
    if (hasNoArgs(value)) {
      return this._nodata;
    } else if (hasArgs(value)) {
      this._nodata = value;
      return this;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  /** Gets/Sets the remote port to connect to.
  */
  port(value?: number): number | DataSelectQuery {
    if (hasNoArgs(value)) {
      return this._port;
    } else if (hasArgs(value)) {
      this._port = value;
      return this;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  networkCode(value?: string): string | DataSelectQuery {
    if (isStringArg(value)) {
      this._networkCode = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._networkCode;
    } else {
      throw new Error('value argument is optional or string, but was '+value);
    }
  }
  stationCode(value?: string): string | DataSelectQuery {
    if (isStringArg(value)) {
      this._stationCode = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._stationCode;
    } else {
      throw new Error('value argument is optional or string, but was '+value);
    }
  }
  locationCode(value?: string): string | DataSelectQuery {
    if (isStringArg(value)) {
      this._locationCode = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._locationCode;
    } else {
      throw new Error('value argument is optional or string, but was '+value);
    }
  }
  channelCode(value?: string): string | DataSelectQuery {
    if (isStringArg(value)) {
      this._channelCode = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._channelCode;
    } else {
      throw new Error('value argument is optional or string, but was '+value);
    }
  }
  startTime(value?: moment): moment | DataSelectQuery {
    if (hasNoArgs(value)) {
      return this._startTime;
    } else if (hasArgs(value)) {
      this._startTime = checkStringOrDate(value);
      return this;
    } else {
      throw new Error('value argument is optional or moment or string, but was '+typeof value);
    }
  }
  endTime(value?: moment): moment | DataSelectQuery {
    if (hasNoArgs(value)) {
      return this._endTime;
    } else if (hasArgs(value)) {
      this._endTime = checkStringOrDate(value);
      return this;
    } else {
      throw new Error('value argument is optional or moment or string, but was '+typeof value);
    }
  }
  quality(value?: string): string | DataSelectQuery {
    if (isStringArg(value)) {
      this._quality = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._quality;
    } else {
      throw new Error('value argument is optional or string, but was '+value);
    }
  }
  minimumLength(value?: number): number | DataSelectQuery {
    if (hasNoArgs(value)) {
      return this._minimumLength;
    } else if (hasArgs(value)) {
      this._minimumLength = value;
      return this;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  longestOnly(value?: boolean): boolean | DataSelectQuery {
    if (hasNoArgs(value)) {
      return this._longestOnly;
    } else if (hasArgs(value)) {
      this._longestOnly = value;
      return this;
    } else {
      throw new Error('value argument is optional or boolean, but was '+typeof value);
    }
  }

  /** set or get the repository paramter. This is an IRIS-specific
  * parameter that will not work with other dataselect web services.
  */
  repository(value?: string): string | DataSelectQuery {
    if (isStringArg(value)) {
      this._repository = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._repository;
    } else {
      throw new Error('value argument is optional or string, but was '+value);
    }
  }
  format(value?: string): string | DataSelectQuery {
    if (isStringArg(value)) {
      this._format = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._format;
    } else {
      throw new Error('value argument is optional or string, but was '+value);
    }
  }
  computeStartEnd(start?: moment, end?: moment, duration?: number | null =null, clockOffset?: number =0): DataSelectQuery {
    let se = new StartEndDuration(start, end, duration, clockOffset);
    this.startTime(se.start);
    this.endTime(se.end);
    return this;
  }

  queryDataRecords(): Promise<Array<miniseed.DataRecord>> {
    return this.queryRaw().then(function(rawBuffer) {
        let dataRecords = miniseed.parseDataRecords(rawBuffer);
        return dataRecords;
    });
  }
  querySeismograms(): Promise<Map<string, Seismogram>> {
    return this.queryDataRecords().then(dataRecords => {
      return miniseed.mergeByChannel(dataRecords);
    });
  }
  queryRaw() {
    let mythis = this;
    let promise = new RSVP.Promise(function(resolve, reject) {
      let client = new XMLHttpRequest();
      let url = mythis.formURL();
console.log("fdsnDataSelect URL: "+url);
      client.open("GET", url);
      client.ontimeout = function() {
        this.statusText = "Timeout "+this.statusText;
        reject(this);
      };
      client.onreadystatechange = handler;
      client.responseType = "arraybuffer";
      client.setRequestHeader("Accept", "application/vnd.fdsn.mseed");
      client.send();

      function handler() {
        if (this.readyState === this.DONE) {
          if (this.status === 200) {
            resolve(this.response);
          } else if (this.status === 204 || (mythis.nodata() && this.status === mythis.nodata())) {
            // no data, so resolve success but with empty array
            resolve( new ArrayBuffer(0) );
          } else {
            reject(this);
          }
        }
      }
    });
    return promise;
  }

  postQueryDataRecords(channelTimeList: Array<ChannelTimeRange>): Promise<Array<miniseed.DataRecord>> {
    return this.postQueryRaw(channelTimeList)
    .then( fetchResponse => {
      if(fetchResponse.ok) {
        return fetchResponse.arrayBuffer().then(ab => {
          console.log(`fetch response ok, bytes=${ab.byteLength}  ${(typeof ab)}`);
          return miniseed.parseDataRecords(ab);
        });
      } else {
        console.log("fetchRespone not ok");
        return [];
      }
    });
  }
  postQuerySeismograms(channelTimeList: Array<ChannelTimeRange>): Promise<Map<string, Seismogram>> {
    return this.postQueryDataRecords(channelTimeList).then(dataRecords => {
      return miniseed.tracePerChannel(dataRecords);
    });
  }
  postQueryRaw(channelTimeList: Array<ChannelTimeRange>): Promise<Response> {
    if (channelTimeList.length === 0) {
      // return promise faking an not ok fetch response
      console.log("Empty chan length so return fake fetch promise");
      return RSVP.hash({
        ok: false
      });
    } else {
      return fetch(this.formURL(), {
          method: "POST",
          mode: "cors",
          referrer: "seisplotjs",
          body: this.createPostBody(channelTimeList),
        });
    }
  }

  createPostBody(channelTimeList: Array<ChannelTimeRange>): string {
    let out = "";
    for (let ct of channelTimeList) {
      let sta = ct.channel.station;
      let net = sta.network;
      out += `${net.networkCode} ${sta.stationCode} ${ct.channel.locationCode} ${ct.channel.channelCode} ${ct.startTime.toISOString()} ${ct.endTime.toISOString()}`;
      out += '\n';
    }
    return out;
  }

  formBaseURL(): string {
      let colon = ":";
      if (this._protocol.endsWith(colon)) {
        colon = "";
      }
      return this._protocol+colon+"//"+this._host+(this._port===80?"":(":"+this._port))+"/fdsnws/dataselect/"+this._specVersion;
  }

  formVersionURL(): string {
    return this.formBaseURL()+"/version";
  }

  queryVersion(): Promise<string> {
    let mythis = this;
    let promise = new RSVP.Promise(function(resolve, reject) {
      let url = mythis.formVersionURL();
      let client = new XMLHttpRequest();
      client.open("GET", url);
      client.onreadystatechange = handler;
      client.responseType = "text";
      client.setRequestHeader("Accept", "text/plain");
      client.send();

      function handler() {
        if (this.readyState === this.DONE) {
          if (this.status === 200) {
            resolve(this.response);
          } else {
            reject(this);
          }
        }
      }
    });
    return promise;
  }

  makeParam(name: string, val: mixed): string {
    return name+"="+encodeURIComponent(stringify(val))+"&";
  }

  formURL(): string {
    let url = this.formBaseURL()+"/query?";
    if (this._networkCode) { url = url+this.makeParam("net", this.networkCode());}
    if (this._stationCode) { url = url+this.makeParam("sta", this.stationCode());}
    if (this._locationCode) { url = url+this.makeParam("loc", this.locationCode());}
    if (this._channelCode) { url = url+this.makeParam("cha", this.channelCode());}
    if (this._startTime) { url = url+this.makeParam("starttime", toIsoWoZ(this.startTime()));}
    if (this._endTime) { url = url+this.makeParam("endtime", toIsoWoZ(this.endTime()));}
    if (this._quality) { url = url+this.makeParam("quality", this.quality());}
    if (this._minimumLength) { url = url+this.makeParam("minimumlength", this.minimumLength());}
    if (this._repository) { url = url+this.makeParam("repository", this.repository());}
    if (this._longestOnly) { url = url+this.makeParam("longestonly", this.longestOnly());}
    if (this._format) { url = url+this.makeParam("format", this.format());}
    if (this._nodata) { url = url+this.makeParam("nodata", this.nodata());}

    if (url.endsWith('&') || url.endsWith('?')) {
      url = url.substr(0, url.length-1); // zap last & or ?
    }
    return url;
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

export function createDataSelectQuery(params: Object): DataSelectQuery {
  if ( ! params || typeof params !== 'object' ) {
    throw new Error("params null or not an object");
  }
  let out = new DataSelectQuery();
  if (params.net) { out.networkCode(params.net); }
  if (params.network) { out.networkCode(params.network); }
  if (params.networkCode) { out.networkCode(params.networkCode); }
  if (params.sta) { out.stationCode(params.sta); }
  if (params.station) { out.stationCode(params.station); }
  if (params.stationCode) { out.stationCode(params.stationCode); }
  if (params.loc) { out.locationCode(params.loc); }
  if (params.location) { out.locationCode(params.location); }
  if (params.locationCode) { out.locationCode(params.locationCode); }
  if (params.chan) { out.channelCode(params.chan); }
  if (params.channel) { out.channelCode(params.channel); }
  if (params.channelCode) { out.channelCode(params.channelCode); }
  if (params.start) { out.startTime(params.start); }
  if (params.starttime) { out.startTime(params.starttime); }
  if (params.end) { out.endTime(params.end); }
  if (params.endtime) { out.endTime(params.endtime); }
  if (params.quality) { out.quality(params.quality); }
  if (params.minimumlength) { out.minimumLength(params.minimumlength); }
  if (params.repository) { out.repository(params.repository); }
  if (params.longestonly) { out.longestOnly(params.longestonly); }
  if (params.format) { out.format(params.format); }
  if (params.nodata) { out.nodata(params.nodata); }
  if (params.host) { out.host(params.host); }
  if (params.port) { out.port(params.port); }
  if (params.specVersion) { out.specVersion(params.specVersion); }
  return out;
}
