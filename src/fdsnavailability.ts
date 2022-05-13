/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */
import {DateTime} from "luxon";
import RSVP from "rsvp";
// special due to flow
import {
  doStringGetterSetter,
  doBoolGetterSetter,
  doIntGetterSetter,
  doFloatGetterSetter,
  doMomentGetterSetter,
  checkProtocol,
  toIsoWoZ,
  isoToDateTime,
  isDef,
  hasNoArgs,
  isNonEmptyStringArg,
  isNumArg,
  stringify,
} from "./util";
import {SeismogramDisplayData} from "./seismogram";
import {
  TEXT_MIME,
  JSON_MIME,
  StartEndDuration,
  makeParam,
  doFetchWithTimeout,
  defaultFetchInitObj,
} from "./util";
import {Network, Station, Channel} from "./stationxml";

/** const for json format, json */
export const FORMAT_JSON = "json";

/** const for text format, text */
export const FORMAT_TEXT = "text";

/** const for geocsv format, geocsv */
export const FORMAT_GEOCSV = "geocsv";

/** const for request format, request */
export const FORMAT_REQUEST = "request";

/** const of completely empty json, {} */
export const EMPTY_JSON: RootType = {
  version: {},
  datasources: [],
};

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
 * ```
 * const avail = AvailabilityQuery()
 *    .networkCode("CO")
 *    .stationCode("BIRD")
 *    .startTime("2021-12-27T19:18:54Z")
 *    .endTime("2021-12-27T19:22:54Z");
 * avail.query().then(sddList => {
 *   sddList.forEach(sdd => console.log(sdd))
 * });
 * ```
 *
 * @see http://www.fdsn.org/webservices/
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
  _nodata: number|undefined;

  /** @private */
  _port: number;

  /** @private */
  _networkCode: string|undefined;

  /** @private */
  _stationCode: string|undefined;

  /** @private */
  _locationCode: string|undefined;

  /** @private */
  _channelCode: string|undefined;

  /** @private */
  _startTime: DateTime|undefined;

  /** @private */
  _endTime: DateTime|undefined;

  /** @private */
  _quality: string|undefined;

  /** @private */
  _merge: string|undefined;

  /** @private */
  _show: string|undefined;

  /** @private */
  _mergeGaps: number|undefined;

  /** @private */
  _limit: number|undefined;

  /** @private */
  _orderby: string|undefined;

  /** @private */
  _includerestricted: boolean|undefined;

  /** @private */
  _format: string|undefined;

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
  specVersion(value?: number): AvailabilityQuery {
    doIntGetterSetter(this, "specVersion", value);
    return this;
  }

  getSpecVersion(): number {
    return this._specVersion;
  }

  /**
   * Gets/Sets the protocol, http or https. This should match the protocol
   *  of the page loaded, but is autocalculated and generally need not be set.
   *
   * @param value protocol, usually http or https
   * @returns the query when setting, the current value when no argument
   */
  protocol(value?: string): AvailabilityQuery {
    doStringGetterSetter(this, "protocol", value);
    return this;
  }

  getProtocol(): string | undefined {
    return this._protocol;
  }


  /**
   * Gets/Sets the remote host to connect to.
   *
   * @param value host
   * @returns the query when setting, the current value when no argument
   */
  host(value?: string): AvailabilityQuery {
    doStringGetterSetter(this, "host", value);
    return this;
  }

  getHost(): string {
    return this._host;
  }

  /**
   * Gets/Sets the nodata parameter, usually 404 or 204 (default), controlling
   * the status code when no matching data is found by the service.
   *
   * @param value number for nodata, usually 404 or 204
   * @returns the query when setting, the current value when no argument
   */
  nodata(value?: number): AvailabilityQuery {
    doIntGetterSetter(this, "nodata", value);
    return this;
  }

  getNodata(): number | undefined {
    return this._nodata;
  }

  /**
   * Gets/Sets the port, not usually set unless not on standard http or https ports
   *
   * @param value port
   * @returns the query when setting, the current value when no argument
   */
  port(value?: number): AvailabilityQuery {
    doIntGetterSetter(this, "port", value);
    return this;
  }

  getPort(): number {
    return this._port;
  }

  /**
   * Gets/Sets the network code to check.
   *
   * @param value network code like IU
   * @returns the query when setting, the current value when no argument
   */
  networkCode(value?: string): AvailabilityQuery {
    doStringGetterSetter(this, "networkCode", value);
    return this;
  }

  getNetworkCode(): string | undefined {
    return this._networkCode;
  }

  /**
   * Gets/Sets the station code to check.
   *
   * @param value station code like ANMO
   * @returns the query when setting, the current value when no argument
   */
  stationCode(value?: string): AvailabilityQuery {
    doStringGetterSetter(this, "stationCode", value);
    return this;
  }

  getStationCode(): string | undefined {
    return this._stationCode;
  }

  /**
   * Gets/Sets the location code to check.
   *
   * @param value location code like 00
   * @returns the query when setting, the current value when no argument
   */
  locationCode(value?: string): AvailabilityQuery {
    doStringGetterSetter(this, "locationCode", value);
    return this;
  }

  getLocationCode(): string | undefined {
    return this._locationCode;
  }

  /**
   * Gets/Sets the channel code to check.
   *
   * @param value channel code like BHZ
   * @returns the query when setting, the current value when no argument
   */
  channelCode(value?: string): AvailabilityQuery {
    doStringGetterSetter(this, "channelCode", value);
    return this;
  }

  getChannelCode(): string | undefined {
    return this._channelCode;
  }

  /**
   * Gets/Sets the start time parameter for the query.
   *
   * @param value start time
   * @returns the query when setting, the current value when no argument
   */
  startTime(value?: DateTime | string): AvailabilityQuery {
    doMomentGetterSetter(this, "startTime", value);
    return this;
  }

  getStartTime(): DateTime | undefined {
    return this._startTime;
  }

  /**
   * Gets/Sets the end time parameter for the query.
   *
   * @param value end time
   * @returns the query when setting, the current value when no argument
   */
  endTime(value?: DateTime | string): AvailabilityQuery {
    doMomentGetterSetter(this, "endTime", value);
    return this;
  }

  getEndTime(): DateTime | undefined {
    return this._endTime;
  }

  /**
   * Sets startTime and endTime using the given time window
   *
   * @param   se time window
   * @returns    the query
   */
  timeRange(se: StartEndDuration): AvailabilityQuery {
    this.startTime(se.startTime);
    this.endTime(se.endTime);
    return this;
  }
  /**
   * @deprecated
   * @param  se               [description]
   * @return    [description]
   */
  timeWindow(se: StartEndDuration): AvailabilityQuery {
    return this.timeRange(se);
  }

  /**
   * Gets/Sets the quality parameter for the query.
   *
   * @param value quality
   * @returns the query when setting, the current value when no argument
   */
  quality(value?: string): AvailabilityQuery {
    doStringGetterSetter(this, "quality", value);
    return this;
  }

  getQuality(): string | undefined {
    return this._quality;
  }

  /**
   * Gets/Sets the merge parameter for the query.
   *
   * @param value merge
   * @returns the query when setting, the current value when no argument
   */
  merge(value?: string): AvailabilityQuery {
    doStringGetterSetter(this, "merge", value);
    return this;
  }

  getMerge(): string | undefined {
    return this._merge;
  }

  /**
   * Gets/Sets the mergegaps parameter for the query.
   *
   * @param value merge gaps
   * @returns the query when setting, the current value when no argument
   */
  mergeGaps(value?: number): AvailabilityQuery {
    doFloatGetterSetter(this, "mergeGaps", value);
    return this;
  }

  getMergeGaps(): number | undefined {
    return this._mergeGaps;
  }

  /**
   * Gets/Sets the show parameter for the query.
   *
   * @param value show
   * @returns the query when setting, the current value when no argument
   */
  show(value?: string): AvailabilityQuery {
    doStringGetterSetter(this, "show", value);
    return this;
  }

  getShow(): string | undefined {
    return this._show;
  }

  /**
   * Gets/Sets the limit parameter for the query.
   *
   * @param value limit
   * @returns the query when setting, the current value when no argument
   */
  limit(value?: number): AvailabilityQuery {
    doIntGetterSetter(this, "limit", value);
    return this;
  }

  getLimit(): number | undefined {
    return this._limit;
  }

  /**
   * Gets/Sets the order by parameter for the query.
   *
   * @param value order by
   * @returns the query when setting, the current value when no argument
   */
  orderby(value?: string): AvailabilityQuery {
    doStringGetterSetter(this, "orderBy", value);
    return this;
  }

  getOrderBy(): string | undefined {
    return this._orderby;
  }

  /**
   * Gets/Sets the include restricted data parameter for the query.
   *
   * @param value true to include restricted data
   * @returns the query when setting, the current value when no argument
   */
  includeRestricted(value?: boolean): AvailabilityQuery {
    doBoolGetterSetter(this, "includerestricted", value);
    return this;
  }

  getIncludeRestricted(): boolean | undefined {
    return this._includerestricted;
  }

  /**
   * Gets/Sets the format parameter for the query. Usually not needed as is set
   * by the various query methods.
   *
   * @param value format
   * @returns the query when setting, the current value when no argument
   */
  format(value?: string): AvailabilityQuery {
    doStringGetterSetter(this, "format", value);
    return this;
  }

  getFormat(): string | undefined {
    return this._format;
  }

  /**
   * Get/Set the timeout in seconds for the request. Default is 30.
   *
   * @param value timeout in seconds
   * @returns the query when setting, the current value when no argument
   */
  timeout(value?: number): AvailabilityQuery {
    doFloatGetterSetter(this, "timeoutSec", value);
    return this;
  }

  getTimeout(): number | undefined {
    return this._timeoutSec;
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
    const mythis = this;
    return this.queryJson().then(function (json: RootType) {
      return mythis.extractFromJson(json);
    });
  }

  /**
   * Calls the query function the remote server and parses the returned data as json.
   *
   * @returns promise to the result as json
   */
  queryJson(): Promise<RootType> {
    const mythis = this;
    this.format(FORMAT_JSON);
    const url = this.formURL("query");
    const fetchInit = defaultFetchInitObj(JSON_MIME);
    return doFetchWithTimeout(url, fetchInit, this._timeoutSec * 1000).then(
      function (response) {
        if (
          response.status === 204 ||
          (isDef(mythis._nodata) && response.status === mythis._nodata)
        ) {
          return RSVP.hash(EMPTY_JSON);
        }

        let contentType = response.headers.get("content-type");

        if (
          isNonEmptyStringArg(contentType) &&
          contentType.includes(JSON_MIME)
        ) {
          return response.json();
        }

        throw new TypeError(`Oops, we did not get JSON! ${contentType}`);
      },
    );
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
    const mythis = this;
    return this.extentJson().then(function (json: RootType) {
      return mythis.extractFromJson(json);
    });
  }

  /**
   * Call the extend function on the remote server and parses the returned data as json.
   *
   * @returns promise to the result as json
   */
  extentJson(): Promise<RootType> {
    const mythis = this;
    this.format(FORMAT_JSON);
    const url = this.formURL("extent");
    const fetchInit = defaultFetchInitObj(JSON_MIME);
    return doFetchWithTimeout(url, fetchInit, this._timeoutSec * 1000).then(
      function (response) {
        if (
          response.status === 204 ||
          (isDef(mythis._nodata) && response.status === mythis._nodata)
        ) {
          return EMPTY_JSON;
        }

        let contentType = response.headers.get("content-type");

        if (
          isNonEmptyStringArg(contentType) &&
          contentType.includes(JSON_MIME)
        ) {
          return response.json();
        }

        throw new TypeError(`Oops, we did not get JSON! ${contentType}`);
      },
    );
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
  postQuery(
    channelTimeList: Array<SeismogramDisplayData>,
  ): Promise<Array<SeismogramDisplayData>> {
    return this.postQueryJson(channelTimeList).then(json => {
      return this.extractFromJson(json);
    });
  }

  postExtent(
    channelTimeList: Array<SeismogramDisplayData>,
  ): Promise<Array<SeismogramDisplayData>> {
    return this.postExtentJson(channelTimeList).then(json => {
      return this.extractFromJson(json);
    });
  }

  postExtentJson(
    channelTimeList: Array<SeismogramDisplayData>,
  ): Promise<RootType> {
    return this.postJson(channelTimeList, "extent");
  }

  postQueryJson(
    channelTimeList: Array<SeismogramDisplayData>,
  ): Promise<RootType> {
    return this.postJson(channelTimeList, "query");
  }

  postJson(
    channelTimeList: Array<SeismogramDisplayData>,
    method: string,
  ): Promise<RootType> {
    const mythis = this;
    this.format(FORMAT_JSON);
    return this.postRaw(channelTimeList, method).then(function (response) {
      if (
        response.status === 204 ||
        (isDef(mythis._nodata) && response.status === mythis._nodata)
      ) {
        return EMPTY_JSON;
      }

      let contentType = response.headers.get("content-type");

      if (isNonEmptyStringArg(contentType) && contentType.includes(JSON_MIME)) {
        return response.json();
      }

      throw new TypeError(`Oops, we did not get JSON! ${contentType}`);
    });
  }

  postRaw(
    channelTimeList: Array<SeismogramDisplayData>,
    method: string,
  ): Promise<Response> {
    if (channelTimeList.length === 0) {
      // return promise faking an not ok fetch response
      return RSVP.hash(new Response(null, {
        status: 204,
      }));
    } else {
      const fetchInit = defaultFetchInitObj(JSON_MIME);
      fetchInit.method = "POST";
      fetchInit.body = this.createPostBody(channelTimeList);
      return fetch(this.formBaseURL() + `/${method}?`, fetchInit).then(
        function (response) {
          if (response.ok) {
            return response;
          }

          throw new Error("Fetch response was not ok.");
        },
      );
    }
  }

  extractFromJson(jsonChanTimes: RootType): Array<SeismogramDisplayData> {
    let out = [];
    let knownNets = new Map();

    if (isDef(jsonChanTimes.datasources)) {
      for (let ds of jsonChanTimes.datasources) {
        let n = knownNets.get(ds.network);

        if (!n) {
          n = new Network(ds.network);
          knownNets.set(ds.network, n);
        }

        let s = null;

        for (let ss of n.stations) {
          if (ss.stationCode === ds.station) {
            s = ss;
          }
        }

        if (!s) {
          s = new Station(n, ds.station);
          n.stations.push(s);
        }

        let c = new Channel(s, ds.channel, ds.locationCode);

        if (
          isNonEmptyStringArg(ds.earliest) &&
          isNonEmptyStringArg(ds.latest)
        ) {
          out.push(
            SeismogramDisplayData.fromChannelAndTimes(
              c,
              isoToDateTime(ds.earliest),
              isoToDateTime(ds.latest),
            ),
          );
        } else if (ds.timespans) {
          for (let ts of ds.timespans) {
            out.push(
              SeismogramDisplayData.fromChannelAndTimes(
                c,
                isoToDateTime(ts[0]),
                isoToDateTime(ts[1]),
              ),
            );
          }
        }
      }
    }

    return out;
  }

  createPostBody(channelTimeList: Array<SeismogramDisplayData>): string {
    let out = "";

    if (this._quality) {
      out += this.makePostParm("quality", this.quality());
    }

    if (this._merge) {
      out += this.makePostParm("merge", this.merge());
    }

    if (
      isNumArg(this._mergeGaps) &&
      (this._format === "query" || this._format === "queryauth")
    ) {
      out += this.makePostParm("mergegaps", this.mergeGaps());
    }

    if (
      this._show &&
      (this._format === "query" || this._format === "queryauth")
    ) {
      out += this.makePostParm("show", this.show());
    }

    if (isNumArg(this._limit) && this._limit > 0) {
      out += this.makePostParm("limit", this.limit());
    }

    if (this._orderby) {
      out += this.makePostParm("orderby", this.orderby());
    }

    if (this._includerestricted) {
      out += this.makePostParm("includerestricted", this.includeRestricted());
    }

    if (this._format) {
      out += this.makePostParm("format", this.format());
    }

    if (this._nodata) {
      out += this.makePostParm("nodata", this.nodata());
    }

    for (let ct of channelTimeList) {
      if (isDef(ct.channel)) {
        let sta = ct.channel.station;
        let net = sta.network;
        out += `${net.networkCode} ${sta.stationCode} ${
          ct.channel.locationCode
        } ${
          ct.channel.channelCode
        } ${ct.startTime.toISO()} ${ct.endTime.toISO()}`;
        out += "\n";
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

    return (
      this._protocol +
      colon +
      "//" +
      this._host +
      (this._port === 80 ? "" : ":" + this._port) +
      "/fdsnws/availability/" +
      this._specVersion
    );
  }

  formVersionURL(): string {
    return this.formBaseURL() + "/version";
  }

  /**
   * Queries the remote web service to get its version
   *
   * @returns Promise to version string
   */
  queryVersion(): Promise<string> {
    let url = this.formVersionURL();
    const fetchInit = defaultFetchInitObj(TEXT_MIME);
    return doFetchWithTimeout(url, fetchInit, this._timeoutSec * 1000).then(
      response => {
        if (response.status === 200) {
          return response.text();
        } else {
          throw new Error(`Status not 200: ${response.status}`);
        }
      },
    );
  }

  makePostParm(name: string, val: unknown): string {
    return name + "=" + stringify(val) + "\n";
  }

  formURL(method?: string): string {
    if (hasNoArgs(method)) {
      method = "query";
    }

    let url = this.formBaseURL() + `/${method}?`;

    if (this._networkCode) {
      url = url + makeParam("net", this._networkCode);
    }

    if (this._stationCode) {
      url = url + makeParam("sta", this._stationCode);
    }

    if (this._locationCode) {
      url = url + makeParam("loc", this._locationCode);
    }

    if (this._channelCode) {
      url = url + makeParam("cha", this._channelCode);
    }

    if (this._startTime) {
      url = url + makeParam("starttime", toIsoWoZ(this._startTime));
    }

    if (this._endTime) {
      url = url + makeParam("endtime", toIsoWoZ(this._endTime));
    }

    if (this._quality) {
      url = url + makeParam("quality", this._quality);
    }

    if (this._merge) {
      url = url + makeParam("merge", this._merge);
    }

    if (this._mergeGaps) {
      url = url + makeParam("mergegaps", this._mergeGaps);
    }

    if (this._show) {
      url = url + makeParam("show", this._show);
    }

    if (isNumArg(this._limit) && this._limit > 0) {
      url = url + makeParam("limit", this._limit);
    }

    if (this._orderby) {
      url = url + makeParam("orderby", this._orderby);
    }

    if (this._includerestricted) {
      url = url + makeParam("includerestricted", this._includerestricted);
    }

    if (this._format) {
      url = url + makeParam("format", this._format);
    }

    if (this._nodata) {
      url = url + makeParam("nodata", this._nodata);
    }

    if (url.endsWith("&") || url.endsWith("?")) {
      url = url.substr(0, url.length - 1); // zap last & or ?
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
  created?: FdsnDateTime;
  version: Record<string, any>;
  datasources: Array<Datasource>;
} & Record<string, any>;
export type FdsnDateTime = string;
export type Datasource = ({
  network: string;
  station: string;
  location: string;
  channel: string;
  quality?: string;
  samplerate?: number;
  timespans?: Array<Array<FdsnDateTime>>;
  earliest?: FdsnDateTime;
  latest?: FdsnDateTime;
  updated?: FdsnDateTime;
  timespanCount?: number;
  restriction?: string;
} & Record<string, any>) &
  (
    | ({
        timespans: any;
      } & Record<string, any>)
    | ({
        earliest: any;
        latest: any;
      } & Record<string, any>)
  );
