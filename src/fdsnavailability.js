// @flow

/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */

import moment from 'moment';
import RSVP from 'rsvp';

// special due to flow
import {checkProtocol, toIsoWoZ, isDef, hasArgs, hasNoArgs, isStringArg, isNumArg, checkStringOrDate, stringify} from './util';
import type {RootType} from './fdsnws-availability-1.0.schema.json.flow.js';

import {SeismogramDisplayData } from './seismogram.js';
import { TEXT_MIME, JSON_MIME, StartEndDuration , doFetchWithTimeout, defaultFetchInitObj} from './util.js';
import {Network, Station, Channel} from './stationxml.js';

/** const for json format, json */
export const FORMAT_JSON = 'json';
/** const for text format, text */
export const FORMAT_TEXT = 'text';
/** const for geocsv format, geocsv */
export const FORMAT_GEOCSV = 'geocsv';
/** const for request format, request */
export const FORMAT_REQUEST = 'request';

/** const of completely empty json, {} */
export const EMPTY_JSON = JSON.parse('{}');

/**
 * Major version of the FDSN spec supported here.
 * Currently is 1.
 */
export const SERVICE_VERSION = 1;
/**
 * Service name as used in the FDSN DataCenters registry,
 * http://www.fdsn.org/datacenters
 */
export const SERVICE_NAME = `fdsnws-availability-${SERVICE_VERSION}`;

export const IRIS_HOST = "service.iris.edu";

/**
 * Query to a FDSN Availability web service.
 * @see http://www.fdsn.org/webservices/
*/
export class AvailabilityQuery {
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
  _merge: string;
  /** @private */
  _show: string;
  /** @private */
  _mergeGaps: number;
  /** @private */
  _limit: number;
  /** @private */
  _orderby: string;
  /** @private */
  _includerestricted: boolean;
  /** @private */
  _format: string;
  /** @private */
  _timeoutSec: number;
  constructor(host?: string) {
    this._specVersion = 1;
    this._protocol = checkProtocol();
    if (host) {
      this._host = host;
    } else {
      this._host = IRIS_HOST;
    }
    this._port = 80;
    this._timeoutSec = 30;
  }
  /** Gets/Sets the version of the fdsnws spec, 1 is currently the only value.
   *  Setting this is probably a bad idea as the code may not be compatible with
   *  the web service.
  */
  specVersion(value?: number): number | AvailabilityQuery {
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
  protocol(value?: string): string | AvailabilityQuery {
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
  host(value?: string): string | AvailabilityQuery {
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
  nodata(value?: number): number | AvailabilityQuery {
    if (hasNoArgs(value)) {
      return this._nodata;
    } else if (hasArgs(value)) {
      this._nodata = value;
      return this;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  port(value?: number): number | AvailabilityQuery {
    if (hasNoArgs(value)) {
      return this._port;
    } else if (hasArgs(value)) {
      this._port = value;
      return this;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  networkCode(value?: string): string | AvailabilityQuery {
    if (isStringArg(value)) {
      this._networkCode = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._networkCode;
    } else {
      throw new Error('value argument is optional or string, but was '+value);
    }
  }
  stationCode(value?: string): string | AvailabilityQuery {
    if (isStringArg(value)) {
      this._stationCode = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._stationCode;
    } else {
      throw new Error('value argument is optional or string, but was '+value);
    }
  }
  locationCode(value?: string): string | AvailabilityQuery {
    if (isStringArg(value)) {
      this._locationCode = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._locationCode;
    } else {
      throw new Error('value argument is optional or string, but was '+value);
    }
  }
  channelCode(value?: string): string | AvailabilityQuery {
    if (isStringArg(value)) {
      this._channelCode = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._channelCode;
    } else {
      throw new Error('value argument is optional or string, but was '+value);
    }
  }
  startTime(value?: moment): moment | AvailabilityQuery {
    if (hasNoArgs(value)) {
      return this._startTime;
    } else if (hasArgs(value)) {
      this._startTime = checkStringOrDate(value);
      return this;
    } else {
      throw new Error('value argument is optional or moment or string, but was '+typeof value);
    }
  }
  endTime(value?: moment): moment | AvailabilityQuery {
    if (hasNoArgs(value)) {
      return this._endTime;
    } else if (hasArgs(value)) {
      this._endTime = checkStringOrDate(value);
      return this;
    } else {
      throw new Error('value argument is optional or moment or string, but was '+typeof value);
    }
  }
  /**
   * Sets startTime and endTime using the given time window
   * @param   se time window
   * @return     this
   */
  timeWindow(se: StartEndDuration) {
    this.startTime(se.startTime);
    this.endTime(se.endTime);
    return this;
  }
  quality(value?: string): string | AvailabilityQuery {
    if (isStringArg(value)) {
      this._quality = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._quality;
    } else {
      throw new Error('value argument is optional or string, but was '+value);
    }
  }
  merge(value?: string): string | AvailabilityQuery {
    if (isStringArg(value)) {
      this._merge = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._merge;
    } else {
      throw new Error('value argument is optional or string, but was '+value);
    }
  }
  mergeGaps(value?: number): number | AvailabilityQuery {
    if (isNumArg(value)) {
      this._mergeGaps = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._mergeGaps;
    } else {
      throw new Error('value argument is optional or string, but was '+value);
    }
  }
  show(value?: string): string | AvailabilityQuery {
    if (isStringArg(value)) {
      this._show = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._show;
    } else {
      throw new Error('value argument is optional or string, but was '+value);
    }
  }
  limit(value?: number): number | AvailabilityQuery {
    if (hasNoArgs(value)) {
      return this._limit;
    } else if (hasArgs(value)) {
      this._limit = value;
      return this;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  orderby(value?: string): string | AvailabilityQuery {
    if (isStringArg(value)) {
      this._orderby = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._orderby;
    } else {
      throw new Error('value argument is optional or string, but was '+value);
    }
  }
  includeRestricted(value?: boolean): boolean | AvailabilityQuery {
    if (hasNoArgs(value)) {
      return this._includerestricted;
    } else if (hasArgs(value)) {
      this._includerestricted = value;
      return this;
    } else {
      throw new Error('value argument is optional or boolean, but was '+typeof value);
    }
  }

  format(value?: string): string | AvailabilityQuery {
    if (isStringArg(value)) {
      this._format = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._format;
    } else {
      throw new Error('value argument is optional or string, but was '+value);
    }
  }
  /** Get/Set the timeout in seconds for the request. Default is 30.
  */
  timeout(value?: number): number | AvailabilityQuery {
    if (hasNoArgs(value)) {
      return this._timeoutSec;
    } else if (isNumArg(value)) {
      this._timeoutSec = value;
      return this;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }

  query(): Promise<Array<SeismogramDisplayData>> {
    return this.queryJson().then(function(json) {
          return this.extractFromJson(json);
      });
  }
  queryJson() {
    const mythis = this;
    this.format(FORMAT_JSON);
    const url = this.formURL("query");
    const fetchInit = defaultFetchInitObj(JSON_MIME);
    return doFetchWithTimeout(url, fetchInit, this._timeoutSec * 1000 )
      .then(function(response) {
        if (response.status === 204 || (mythis.nodata() && response.status === mythis.nodata())) {
          return EMPTY_JSON;
        }
        let contentType = response.headers.get('content-type');
        if(contentType && contentType.includes(JSON_MIME)) {
          return response.json();
        }
        // $FlowFixMe
        throw new TypeError(`Oops, we did not get JSON! ${contentType}`);
      });
  }

  extent(): Promise<Array<SeismogramDisplayData>> {
    return this.queryJson().then(function(json) {
          return this.extractFromJson(json);
      });
  }
  extentJson() {
    const mythis = this;
    this.format(FORMAT_JSON);
    const url = this.formURL("extent");
    const fetchInit = defaultFetchInitObj(JSON_MIME);
    return doFetchWithTimeout(url, fetchInit, this._timeoutSec * 1000 )
    .then(function(response) {
        if (response.status === 204 || (mythis.nodata() && response.status === mythis.nodata())) {
          return EMPTY_JSON;
        }
        let contentType = response.headers.get('content-type');
        if(contentType && contentType.includes(JSON_MIME)) {
          return response.json();
        }
        // $FlowFixMe
        throw new TypeError(`Oops, we did not get JSON! ${contentType}`);
      });
  }

  postQuery(channelTimeList: Array<SeismogramDisplayData>): Promise<Array<SeismogramDisplayData>> {
    return this.postQueryJson(channelTimeList).then(json => {
      return this.extractFromJson(json);
    });
  }
  postExtent(channelTimeList: Array<SeismogramDisplayData>): Promise<Array<SeismogramDisplayData>> {
    return this.postExtentJson(channelTimeList).then(json => {
      return this.extractFromJson(json);
    });
  }

  postExtentJson(channelTimeList: Array<SeismogramDisplayData>): Promise<RootType> {
    return this.postJson(channelTimeList, 'extent');
  }
  postQueryJson(channelTimeList: Array<SeismogramDisplayData>): Promise<RootType> {
    return this.postJson(channelTimeList, 'query');
  }
  postJson(channelTimeList: Array<SeismogramDisplayData>, method: string): Promise<RootType> {
    const mythis = this;
    this.format(FORMAT_JSON);
    return this.postRaw(channelTimeList, method).then(function(response) {
        if (response.status === 204 || (mythis.nodata() && response.status === mythis.nodata())) {
          return EMPTY_JSON;
        }
        let contentType = response.headers.get('content-type');
        if(contentType && contentType.includes(JSON_MIME)) {
          return response.json();
        }
        // $FlowFixMe
        throw new TypeError(`Oops, we did not get JSON! ${contentType}`);
      });
  }
  postRaw(channelTimeList: Array<SeismogramDisplayData>, method: string): Promise<Response> {
    if (channelTimeList.length === 0) {
      // return promise faking an not ok fetch response
      return RSVP.hash({
        ok: false
      });
    } else {
      const fetchInit = defaultFetchInitObj(JSON_MIME);
      fetchInit.method = "POST";
      fetchInit.body = this.createPostBody(channelTimeList);
      return fetch(this.formBaseURL()+`/${method}?`, fetchInit).then(function(response) {
          if(response.ok) {
            return response;
          }
          throw new Error('Fetch response was not ok.');
        });
    }
  }

  extractFromJson(jsonChanTimes: RootType): Array<SeismogramDisplayData> {
    let out = [];
    let knownNets = new Map();
    if (isDef(jsonChanTimes.datasources)){
      for (let ds of jsonChanTimes.datasources) {
        let n = knownNets.get(ds.network);
        if ( ! n) {
          n = new Network(ds.network);
          knownNets.set(ds.network, n);
        }
        let s = null;
        for (let ss of n.stations) {
          if (ss.stationCode === ds.station) {
            s = ss;
          }
        }
        if ( ! s) {
          s = new Station(n, ds.station);
          n.stations.push(s);
        }
        let c = new Channel(s, ds.channel, ds.locationCode);
        if (ds.earliest && ds.latest){
          out.push( SeismogramDisplayData.fromChannelAndTimes(c, moment.utc(ds.earliest), moment.utc(ds.latest)));
        } else if (ds.timespans) {
          for (let ts of ds.timespans) {
            out.push(SeismogramDisplayData.fromChannelAndTimes(c,  moment.utc(ts[0]), moment.utc(ts[1])));
          }
        }
      }
    }
    return out;
  }

  createPostBody(channelTimeList: Array<SeismogramDisplayData>): string {
    let out = "";
    if (this._quality) { out += this.makePostParm("quality", this.quality());}
    if (this._merge) { out += this.makePostParm("merge", this.merge());}
    if (this._mergeGaps && (this._format === 'query' || this._format === 'queryauth')) {
      out += this.makePostParm("mergegaps", this.mergeGaps());
    }
    if (this._show && (this._format === 'query' || this._format === 'queryauth')) {
      out += this.makePostParm("show", this.show());
    }
    if (this._limit && this._limit>0) { out += this.makePostParm("limit", this.limit());}
    if (this._orderby) { out += this.makePostParm("orderby", this.orderby());}
    if (this._includerestricted) { out += this.makePostParm("includerestricted", this.includeRestricted());}
    if (this._format) { out += this.makePostParm("format", this.format());}
    if (this._nodata) { out += this.makePostParm("nodata", this.nodata());}

    for (let ct of channelTimeList) {
      if ( isDef(ct.channel)) {
        let sta = ct.channel.station;
        let net = sta.network;
        out += `${net.networkCode} ${sta.stationCode} ${ct.channel.locationCode} ${ct.channel.channelCode} ${ct.startTime.toISOString()} ${ct.endTime.toISOString()}`;
        out += '\n';
      } else {
        throw new Error("Channel in missing in createPostBody");
      }
    }
    return out;
  }

  formBaseURL(): string {
      let colon = ":";
      if (this._protocol.endsWith(colon)) {
        colon = "";
      }
      return this._protocol+colon+"//"+this._host+(this._port===80?"":(":"+this._port))+"/fdsnws/availability/"+this._specVersion;
  }

  formVersionURL(): string {
    return this.formBaseURL()+"/version";
  }
  /** Queries the remote web service to get its version
   * @return Promise to version string
  */
  queryVersion(): Promise<string> {
    let url = this.formVersionURL();
    const fetchInit = defaultFetchInitObj(TEXT_MIME);
    return doFetchWithTimeout(url, fetchInit, this._timeoutSec * 1000 )
      .then(response => {
          if (response.status === 200) {
            return response.text();
          } else {
            throw new Error(`Status not 200: ${response.status}`);
          }
      });
  }

  makeParam(name: string, val: mixed): string {
    return name+"="+encodeURIComponent(stringify(val))+"&";
  }
  makePostParm(name: string, val: mixed): string {
    return name+"="+stringify(val)+"\n";
  }

  formURL(method: string): string {
    if (hasNoArgs(method)) {
      method = "query";
    }
    let url = this.formBaseURL()+`/${method}?`;
    if (this._networkCode) { url = url+this.makeParam("net", this.networkCode());}
    if (this._stationCode) { url = url+this.makeParam("sta", this.stationCode());}
    if (this._locationCode) { url = url+this.makeParam("loc", this.locationCode());}
    if (this._channelCode) { url = url+this.makeParam("cha", this.channelCode());}
    if (this._startTime) { url = url+this.makeParam("starttime", toIsoWoZ(this.startTime()));}
    if (this._endTime) { url = url+this.makeParam("endtime", toIsoWoZ(this.endTime()));}
    if (this._quality) { url = url+this.makeParam("quality", this.quality());}
    if (this._merge) { url = url+this.makeParam("merge", this.merge());}
    if (this._mergeGaps) { url = url+this.makeParam("mergegaps", this.mergeGaps());}
    if (this._show) { url = url+this.makeParam("show", this.show());}
    if (this._limit && this._limit>0) { url = url+this.makeParam("limit", this.limit());}
    if (this._orderby) { url = url+this.makeParam("orderby", this.orderby());}
    if (this._includerestricted) { url = url+this.makeParam("includerestricted", this.includeRestricted());}
    if (this._format) { url = url+this.makeParam("format", this.format());}
    if (this._nodata) { url = url+this.makeParam("nodata", this.nodata());}

    if (url.endsWith('&') || url.endsWith('?')) {
      url = url.substr(0, url.length-1); // zap last & or ?
    }
    return url;
  }
}
