// @flow

/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */

import moment from 'moment';
import RSVP from 'rsvp';

// special due to flow
import {checkProtocol, toIsoWoZ, isDef, hasArgs, hasNoArgs, isStringArg,
        isNonEmptyStringArg, isNumArg, checkStringOrDate, stringify} from './util';

import {SeismogramDisplayData } from './seismogram.js';
import { TEXT_MIME, JSON_MIME, StartEndDuration, makeParam, doFetchWithTimeout, defaultFetchInitObj} from './util.js';
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
 *
 * @see http://www.fdsn.org/webservices/
 *
 * @param host optional host to connect to, defaults to IRIS
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
    if (isNonEmptyStringArg(host)) {
      this._host = host;
    } else {
      this._host = IRIS_HOST;
    }
    this._port = 80;
    this._timeoutSec = 30;
  }
  /**
   * Gets/Sets the version of the fdsnws spec, 1 is currently the only value.
   *  Setting this is probably a bad idea as the code may not be compatible with
   *  the web service.
   *
   * @param value spec version, usually 1
   * @returns the query when setting, the current value when no argument
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
  /**
   * Gets/Sets the protocol, http or https. This should match the protocol
   *  of the page loaded, but is autocalculated and generally need not be set.
   *
   * @param value protocol, usually http or https
   * @returns the query when setting, the current value when no argument
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
  /**
   * Gets/Sets the remote host to connect to.
   *
   * @param value host
   * @returns the query when setting, the current value when no argument
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
  /**
   * Gets/Sets the nodata parameter, usually 404 or 204 (default), controlling
   * the status code when no matching data is found by the service.
   *
   * @param value number for nodata, usually 404 or 204
   * @returns the query when setting, the current value when no argument
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
  /**
   * Gets/Sets the port, not usually set unless not on standard http or https ports
   *
   * @param value port
   * @returns the query when setting, the current value when no argument
   */
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
  /**
   * Gets/Sets the network code to check.
   *
   * @param value network code like IU
   * @returns the query when setting, the current value when no argument
   */
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
  /**
   * Gets/Sets the station code to check.
   *
   * @param value station code like ANMO
   * @returns the query when setting, the current value when no argument
   */
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
  /**
   * Gets/Sets the location code to check.
   *
   * @param value location code like 00
   * @returns the query when setting, the current value when no argument
   */
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
  /**
   * Gets/Sets the channel code to check.
   *
   * @param value channel code like BHZ
   * @returns the query when setting, the current value when no argument
   */
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
  /**
   * Gets/Sets the start time parameter for the query.
   *
   * @param value start time
   * @returns the query when setting, the current value when no argument
   */
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
  /**
   * Gets/Sets the end time parameter for the query.
   *
   * @param value end time
   * @returns the query when setting, the current value when no argument
   */
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
   *
   * @param   se time window
   * @returns    the query
   */
  timeWindow(se: StartEndDuration): AvailabilityQuery {
    this.startTime(se.startTime);
    this.endTime(se.endTime);
    return this;
  }
  /**
   * Gets/Sets the quality parameter for the query.
   *
   * @param value quality
   * @returns the query when setting, the current value when no argument
   */
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
  /**
   * Gets/Sets the merge parameter for the query.
   *
   * @param value merge
   * @returns the query when setting, the current value when no argument
   */
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
  /**
   * Gets/Sets the mergegaps parameter for the query.
   *
   * @param value merge gaps
   * @returns the query when setting, the current value when no argument
   */
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
  /**
   * Gets/Sets the show parameter for the query.
   *
   * @param value show
   * @returns the query when setting, the current value when no argument
   */
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
  /**
   * Gets/Sets the limit parameter for the query.
   *
   * @param value limit
   * @returns the query when setting, the current value when no argument
   */
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
  /**
   * Gets/Sets the order by parameter for the query.
   *
   * @param value order by
   * @returns the query when setting, the current value when no argument
   */
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
  /**
   * Gets/Sets the include restricted data parameter for the query.
   *
   * @param value true to include restricted data
   * @returns the query when setting, the current value when no argument
   */
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

  /**
   * Gets/Sets the format parameter for the query. Usually not needed as is set
   * by the various query methods.
   *
   * @param value format
   * @returns the query when setting, the current value when no argument
   */
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
   *
   * @param value timeout in seconds
   * @returns the query when setting, the current value when no argument
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
  /**
   * Calls query on the remote service, using configured parameters. Calls
   * queryJson internally, then unpacks the result into array of SeismogramDisplayData
   * objects.
   *
   * @returns          promise to array of SeismogramDisplayData, each representing
   * a channel-time window
   */
  query(): Promise<Array<SeismogramDisplayData>> {
    return this.queryJson().then(function(json) {
          return this.extractFromJson(json);
      });
  }
  /**
   * Calls the query function the remote server and parses the returned data as json.
   *
   * @returns promise to the result as json
   */
  queryJson(): Promise<string> {
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
        if(isNonEmptyStringArg(contentType) && contentType.includes(JSON_MIME)) {
          return response.json();
        }
        // $FlowFixMe
        throw new TypeError(`Oops, we did not get JSON! ${contentType}`);
      });
  }

  /**
   * Calls extent on the remote service, using configured parameters. Calls
   * extentJson internally, then unpacks the result into array of SeismogramDisplayData
   * objects.
   *
   * @returns          promise to array of SeismogramDisplayData, each representing
   * a channel-time window
   */
  extent(): Promise<Array<SeismogramDisplayData>> {
    return this.extentJson().then(function(json) {
          return this.extractFromJson(json);
      });
  }
  /**
   * Call the extend function on the remote server and parses the returned data as json.
   *
   * @returns promise to the result as json
   */
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
        if(isNonEmptyStringArg(contentType) && contentType.includes(JSON_MIME)) {
          return response.json();
        }
        // $FlowFixMe
        throw new TypeError(`Oops, we did not get JSON! ${contentType}`);
      });
  }

  /**
   * Calls query on the remote service using POST, using configured parameters
   * and forms the POST body using the channelTimeList. Calls
   * postQueryJson internally, then unpacks the result into array of SeismogramDisplayData
   * objects.
   *
   * @param channelTimeList array of channel-time windows for the request
   * @returns          promise to array of SeismogramDisplayData, each representing
   * a channel-time window
   */
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
        if(isNonEmptyStringArg(contentType) && contentType.includes(JSON_MIME)) {
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
        if (isNonEmptyStringArg(ds.earliest) && isNonEmptyStringArg(ds.latest)){
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
    if (isNumArg(this._mergeGaps) && (this._format === 'query' || this._format === 'queryauth')) {
      out += this.makePostParm("mergegaps", this.mergeGaps());
    }
    if (this._show && (this._format === 'query' || this._format === 'queryauth')) {
      out += this.makePostParm("show", this.show());
    }
    if (isNumArg(this._limit) && this._limit>0) { out += this.makePostParm("limit", this.limit());}
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
  /**
   * Queries the remote web service to get its version
   *
   * @returns Promise to version string
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

  makePostParm(name: string, val: mixed): string {
    return name+"="+stringify(val)+"\n";
  }

  formURL(method: string): string {
    if (hasNoArgs(method)) {
      method = "query";
    }
    let url = this.formBaseURL()+`/${method}?`;
    if (this._networkCode) { url = url+makeParam("net", this.networkCode());}
    if (this._stationCode) { url = url+makeParam("sta", this.stationCode());}
    if (this._locationCode) { url = url+makeParam("loc", this.locationCode());}
    if (this._channelCode) { url = url+makeParam("cha", this.channelCode());}
    if (this._startTime) { url = url+makeParam("starttime", toIsoWoZ(this.startTime()));}
    if (this._endTime) { url = url+makeParam("endtime", toIsoWoZ(this.endTime()));}
    if (this._quality) { url = url+makeParam("quality", this.quality());}
    if (this._merge) { url = url+makeParam("merge", this.merge());}
    if (this._mergeGaps) { url = url+makeParam("mergegaps", this.mergeGaps());}
    if (this._show) { url = url+makeParam("show", this.show());}
    if (isNumArg(this._limit) && this._limit>0) { url = url+makeParam("limit", this.limit());}
    if (this._orderby) { url = url+makeParam("orderby", this.orderby());}
    if (this._includerestricted) { url = url+makeParam("includerestricted", this.includeRestricted());}
    if (this._format) { url = url+makeParam("format", this.format());}
    if (this._nodata) { url = url+makeParam("nodata", this.nodata());}

    if (url.endsWith('&') || url.endsWith('?')) {
      url = url.substr(0, url.length-1); // zap last & or ?
    }
    return url;
  }
}

/* The below are slighly modified from json schema to flow autogenerator.
*
* */

/**
 * Root type of availablility json query.
 */
export type RootType = {
  created?: FdsnDateTime,
  version: Object,
  datasources: Array<Datasource>
} & Object;
export type FdsnDateTime = string;
export type Datasource = ({
  network: string,
  station: string,
  location: string,
  channel: string,
  quality?: string,
  samplerate?: number,
  timespans?: Array<Array<FdsnDateTime>>,
  earliest?: FdsnDateTime,
  latest?: FdsnDateTime,
  updated?: FdsnDateTime,
  timespanCount?: number,
  restriction?: string
} & Object) &
  (({ timespans: any } & Object) | ({ earliest: any, latest: any } & Object));
