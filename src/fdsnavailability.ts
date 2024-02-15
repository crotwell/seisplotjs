/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * https://www.seis.sc.edu
 */
import { FDSNCommon, IRIS_HOST } from "./fdsncommon";
import { DateTime, Interval } from "luxon";
import { SeismogramDisplayData } from "./seismogram";
import {
  doStringGetterSetter,
  doBoolGetterSetter,
  doIntGetterSetter,
  doFloatGetterSetter,
  doMomentGetterSetter,
  toIsoWoZ,
  isoToDateTime,
  isDef,
  hasNoArgs,
  isNonEmptyStringArg,
  isNumArg,
  stringify,
  TEXT_MIME,
  JSON_MIME,
  makeParam,
  doFetchWithTimeout,
  defaultFetchInitObj,
  validStartTime,
  validEndTime,
} from "./util";
import { Network, Station, Channel } from "./stationxml";

/** const for json format, json */
export const FORMAT_JSON = "json";

/** const for text format, text */
export const FORMAT_TEXT = "text";

/** const for geocsv format, geocsv */
export const FORMAT_GEOCSV = "geocsv";

/** const for request format, request */
export const FORMAT_REQUEST = "request";

/** const of completely empty json, \{\} */
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
 * https://www.fdsn.org/datacenters
 */
export const SERVICE_NAME = `fdsnws-availability-${SERVICE_VERSION}`;

/** const for the default IRIS web service host, service.iris.edu */
export { IRIS_HOST };

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
 * @see https://www.fdsn.org/webservices/
 * @param host optional host to connect to, defaults to IRIS
 */
export class AvailabilityQuery extends FDSNCommon {
  /** @private */
  _networkCode: string | undefined;

  /** @private */
  _stationCode: string | undefined;

  /** @private */
  _locationCode: string | undefined;

  /** @private */
  _channelCode: string | undefined;

  /** @private */
  _startTime: DateTime | undefined;

  /** @private */
  _endTime: DateTime | undefined;

  /** @private */
  _quality: string | undefined;

  /** @private */
  _merge: string | undefined;

  /** @private */
  _show: string | undefined;

  /** @private */
  _mergeGaps: number | undefined;

  /** @private */
  _limit: number | undefined;

  /** @private */
  _orderby: string | undefined;

  /** @private */
  _includerestricted: boolean | undefined;

  /** @private */
  _format: string | undefined;

  constructor(host?: string) {
    if (!isNonEmptyStringArg(host)) {
      host = IRIS_HOST;
    }
    super(host);
  }

  /**
   * Gets/Sets the version of the fdsnws spec, 1 is currently the only value.
   *  Setting this is probably a bad idea as the code may not be compatible with
   *  the web service.
   *
   * @param value spec version, usually 1
   * @returns the query when setting, the current value when no argument
   */
  specVersion(value?: string): AvailabilityQuery {
    doStringGetterSetter(this, "specVersion", value);
    return this;
  }

  getSpecVersion(): string {
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
  timeRange(se: Interval): AvailabilityQuery {
    this.startTime(validStartTime(se));
    this.endTime(validEndTime(se));
    return this;
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
    return this.queryJson().then((json: RootType) => {
      return this.extractFromJson(json);
    });
  }

  /**
   * Calls the query function the remote server and parses the returned data as json.
   *
   * @returns promise to the result as json
   */
  queryJson(): Promise<RootType> {
    this.format(FORMAT_JSON);
    const url = this.formURL("query");
    const fetchInit = defaultFetchInitObj(JSON_MIME);
    return doFetchWithTimeout(url, fetchInit, this._timeoutSec * 1000)
      .then((response) => {
        if (
          response.status === 204 ||
          (isDef(this._nodata) && response.status === this._nodata)
        ) {
          return EMPTY_JSON;
        }

        const contentType = response.headers.get("content-type");

        if (
          isNonEmptyStringArg(contentType) &&
          contentType.includes(JSON_MIME)
        ) {
          return response.json();
        }

        throw new TypeError(`Oops, we did not get JSON! ${contentType}`);
      })
      .then((jsonValue) => {
        if (isValidRootType(jsonValue)) {
          return jsonValue;
        }
        throw new TypeError(`Oops, we did not get valid root type json`);
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
    return this.extentJson().then((json: RootType) => {
      return this.extractFromJson(json);
    });
  }

  /**
   * Call the extend function on the remote server and parses the returned data as json.
   *
   * @returns promise to the result as json
   */
  extentJson(): Promise<RootType> {
    this.format(FORMAT_JSON);
    const url = this.formURL("extent");
    const fetchInit = defaultFetchInitObj(JSON_MIME);
    return doFetchWithTimeout(url, fetchInit, this._timeoutSec * 1000)
      .then((response) => {
        if (
          response.status === 204 ||
          (isDef(this._nodata) && response.status === this._nodata)
        ) {
          return EMPTY_JSON;
        }

        const contentType = response.headers.get("content-type");

        if (
          isNonEmptyStringArg(contentType) &&
          contentType.includes(JSON_MIME)
        ) {
          return response.json();
        }

        throw new TypeError(`Oops, we did not get JSON! ${contentType}`);
      })
      .then((jsonValue) => {
        if (isValidRootType(jsonValue)) {
          return jsonValue;
        }
        throw new TypeError(`Oops, we did not get valid root type json`);
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
  postQuery(
    channelTimeList: Array<SeismogramDisplayData>,
  ): Promise<Array<SeismogramDisplayData>> {
    return this.postQueryJson(channelTimeList).then((json) => {
      return this.extractFromJson(json);
    });
  }

  postExtent(
    channelTimeList: Array<SeismogramDisplayData>,
  ): Promise<Array<SeismogramDisplayData>> {
    return this.postExtentJson(channelTimeList).then((json) => {
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
    this.format(FORMAT_JSON);
    return this.postRaw(channelTimeList, method)
      .then((response) => {
        if (
          response.status === 204 ||
          (isDef(this._nodata) && response.status === this._nodata)
        ) {
          return EMPTY_JSON;
        }

        const contentType = response.headers.get("content-type");

        if (
          isNonEmptyStringArg(contentType) &&
          contentType.includes(JSON_MIME)
        ) {
          return response.json();
        }

        throw new TypeError(`Oops, we did not get JSON! ${contentType}`);
      })
      .then((jsonValue) => {
        if (isValidRootType(jsonValue)) {
          return jsonValue;
        }
        throw new TypeError(`Oops, we did not get valid root type json`);
      });
  }

  postRaw(
    channelTimeList: Array<SeismogramDisplayData>,
    method: string,
  ): Promise<Response> {
    if (channelTimeList.length === 0) {
      // return promise faking an not ok fetch response
      return Promise.resolve(
        new Response(null, {
          status: 204,
        }),
      );
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
    const out = [];
    const knownNets = new Map<string, Network>();

    if (isDef(jsonChanTimes.datasources)) {
      for (const ds of jsonChanTimes.datasources) {
        if (isValidDatasource(ds)) {
          let n = knownNets.get(ds.network);

          if (!n) {
            n = new Network(ds.network);
            knownNets.set(ds.network, n);
          }

          let s = null;

          for (const ss of n.stations) {
            if (ss.stationCode === ds.station) {
              s = ss;
            }
          }

          if (!s) {
            s = new Station(n, ds.station);
            n.stations.push(s);
          }

          const c = new Channel(s, ds.channel, ds.location);

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
            for (const ts of ds.timespans) {
              if (
                Array.isArray(ts) &&
                ts.length === 2 &&
                typeof ts[0] === "string" &&
                typeof ts[1] === "string"
              ) {
                out.push(
                  SeismogramDisplayData.fromChannelAndTimes(
                    c,
                    isoToDateTime(ts[0]),
                    isoToDateTime(ts[1]),
                  ),
                );
              } else {
                throw new TypeError("invalid timespans: " + stringify(ts));
              }
            }
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

    for (const ct of channelTimeList) {
      if (isDef(ct.channel)) {
        const sta = ct.channel.station;
        const net = sta.network;
        out += `${net.networkCode} ${sta.stationCode} ${
          ct.channel.locationCode
        } ${
          ct.channel.channelCode
        } ${toIsoWoZ(ct.startTime)} ${toIsoWoZ(ct.endTime)}`;
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
      (this._port === 80 ? "" : ":" + stringify(this._port)) +
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
    const url = this.formVersionURL();
    const fetchInit = defaultFetchInitObj(TEXT_MIME);
    return doFetchWithTimeout(url, fetchInit, this._timeoutSec * 1000).then(
      (response) => {
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
  version: Record<string, unknown>;
  datasources: Array<Datasource>;
} & Record<string, unknown>;
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
} & Record<string, unknown>) &
  (
    | ({
        timespans: unknown;
      } & Record<string, unknown>)
    | ({
        earliest: FdsnDateTime;
        latest: FdsnDateTime;
      } & Record<string, unknown>)
  );

export function isValidRootType(jsonValue: unknown): jsonValue is RootType {
  if (!jsonValue || typeof jsonValue !== "object") {
    throw new TypeError("json is not object");
  }
  const jsonObj = jsonValue as Record<string, unknown>;
  if (
    Array.isArray(jsonObj.datasources) &&
    jsonObj.datasources.every(isValidDatasource) &&
    typeof jsonObj.version === "number"
  ) {
    return true;
  } else {
    throw new TypeError("json is not valid for FDSN Availability");
  }
}
export function isValidDatasource(jsonValue: unknown): jsonValue is Datasource {
  if (!jsonValue || typeof jsonValue !== "object") {
    throw new TypeError("json is not object");
  }
  const jsonObj = jsonValue as Record<string, unknown>;
  if (
    typeof jsonObj.network === "string" &&
    typeof jsonObj.station === "string" &&
    typeof jsonObj.location === "string" &&
    typeof jsonObj.channel === "string"
  ) {
    return true;
  } else {
    throw new TypeError("json datasource is not valid for FDSN Availability");
  }
}
