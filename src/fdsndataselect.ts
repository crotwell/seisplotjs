/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */
import RSVP from "rsvp";
import * as util from "./util"; // for util.log

// special due to flow
import {
  doStringGetterSetter,
  doIntGetterSetter,
  doFloatGetterSetter,
  doMomentGetterSetter,
  isDef,
  checkProtocol,
  toIsoWoZ,
  hasArgs,
  hasNoArgs,
  isNonEmptyStringArg,
  isNumArg,
} from "./util";
import * as miniseed from "./miniseed";
import * as mseed3 from "./mseed3";
import {Seismogram, SeismogramDisplayData} from "./seismogram";
import {
  TEXT_MIME,
  StartEndDuration,
  makeParam,
  doFetchWithTimeout,
  defaultFetchInitObj,
} from "./util";

/** const for miniseed format, mseed */
export const FORMAT_MINISEED = "miniseed";

/** const for miniseed format, mseed */
export const FORMAT_MINISEED_THREE = "miniseed3";

/**
 * Major version of the FDSN spec supported here.
 * Currently is 1.
 */
export const SERVICE_VERSION = 1;

/**
 * Service name as used in the FDSN DataCenters registry,
 * http://www.fdsn.org/datacenters
 */
export const SERVICE_NAME = `fdsnws-dataselect-${SERVICE_VERSION}`;

/** const for the default IRIS web service host, service.iris.edu */
export const IRIS_HOST = "service.iris.edu";

/**
 * Query to a FDSN Dataselect web service.
 *
 * @see http://www.fdsn.org/webservices/
 * @param host optional host to connect to, defaults to IRIS
 */
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
  _startTime: moment$Moment;

  /** @private */
  _endTime: moment$Moment;

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
   * @returns new value if getting, this if setting
   */
  specVersion(value?: number): number | DataSelectQuery {
    if (hasArgs(value)) {
      this._specVersion = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._specVersion;
    } else {
      throw new Error(
        "value argument is optional or number, but was " + typeof value,
      );
    }
  }

  /**
   * Gets/Sets the protocol, http or https. This should match the protocol
   *  of the page loaded, but is autocalculated and generally need not be set.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  protocol(value?: string): string | DataSelectQuery {
    return doStringGetterSetter(this, "protocol", value);
  }

  /**
   * Gets/Sets the remote host to connect to.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  host(value?: string): string | DataSelectQuery {
    return doStringGetterSetter(this, "host", value);
  }

  /**
   * Gets/Sets the nodata parameter, usually 404 or 204 (default), controlling
   * the status code when no matching data is found by the service.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  nodata(value?: number): number | DataSelectQuery {
    return doIntGetterSetter(this, "nodata", value);
  }

  /**
   * Gets/Sets the remote port to connect to.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  port(value?: number): number | DataSelectQuery {
    return doIntGetterSetter(this, "port", value);
  }

  /**
   * Get/Set the network query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  networkCode(value?: string): string | DataSelectQuery {
    return doStringGetterSetter(this, "networkCode", value);
  }

  /**
   * Get/Set the station query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  stationCode(value?: string): string | DataSelectQuery {
    return doStringGetterSetter(this, "stationCode", value);
  }

  /**
   * Get/Set the location code query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  locationCode(value?: string): string | DataSelectQuery {
    return doStringGetterSetter(this, "locationCode", value);
  }

  /**
   * Get/Set the channel query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  channelCode(value?: string): string | DataSelectQuery {
    return doStringGetterSetter(this, "channelCode", value);
  }

  /**
   * Get/Set the starttime query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  startTime(value?: moment$Moment): moment$Moment | DataSelectQuery {
    return doMomentGetterSetter(this, "startTime", value);
  }

  /**
   * Get/Set the endtime query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  endTime(value?: moment$Moment): moment$Moment | DataSelectQuery {
    return doMomentGetterSetter(this, "endTime", value);
  }

  /**
   * Sets startTime and endTime using the given time window
   *
   * @param   se time window
   * @returns     this
   */
  timeWindow(se: StartEndDuration): DataSelectQuery {
    this.startTime(se.startTime);
    this.endTime(se.endTime);
    return this;
  }

  /**
   * Get/Set the quality query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  quality(value?: string): string | DataSelectQuery {
    return doStringGetterSetter(this, "quality", value);
  }

  /**
   * Get/Set the minimum length query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  minimumLength(value?: number): number | DataSelectQuery {
    return doFloatGetterSetter(this, "minimumLength", value);
  }

  /**
   * Get/Set the longest only query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  longestOnly(value?: boolean): boolean | DataSelectQuery {
    if (hasNoArgs(value)) {
      return this._longestOnly;
    } else if (hasArgs(value)) {
      this._longestOnly = value;
      return this;
    } else {
      throw new Error(
        "value argument is optional or boolean, but was " + typeof value,
      );
    }
  }

  /**
   * set or get the repository paramter. This is an IRIS-specific
   * parameter that will not work with other dataselect web services.
   *
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  repository(value?: string): string | DataSelectQuery {
    return doStringGetterSetter(this, "repository", value);
  }

  /**
   * Get/Set the format query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  format(value?: string): string | DataSelectQuery {
    return doStringGetterSetter(this, "format", value);
  }

  /**
   * Get/Set the timeout in seconds for the request. Default is 30.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  timeout(value?: number): number | DataSelectQuery {
    if (hasNoArgs(value)) {
      return this._timeoutSec;
    } else if (isNumArg(value)) {
      this._timeoutSec = value;
      return this;
    } else {
      throw new Error(
        "value argument is optional or number, but was " + typeof value,
      );
    }
  }

  /**
   * queries the web service using the configured parameters, parsing the response
   * into miniseed data records.
   *
   * @returns Promise to Array of miniseed.DataRecords
   */
  queryDataRecords(): Promise<Array<miniseed.DataRecord>> {
    const mythis = this;
    this.format(FORMAT_MINISEED);
    const url = this.formURL();
    const fetchInit = defaultFetchInitObj(miniseed.MINISEED_MIME);
    return doFetchWithTimeout(url, fetchInit, this._timeoutSec * 1000)
      .then(function (response) {
        if (
          response.status === 204 ||
          (isDef(mythis._nodata) && response.status === mythis.nodata())
        ) {
          // no data
          return new ArrayBuffer(0);
        } else {
          return response.arrayBuffer();
        }
      })
      .then(function (rawBuffer) {
        let dataRecords = miniseed.parseDataRecords(rawBuffer);
        return dataRecords;
      });
  }

  /**
   * queries the web service using the configured parameters, parsing the response
   * into miniseed data records.
   *
   * @returns Promise to Array of miniseed.DataRecords
   */
  queryMS3Records(): Promise<Array<mseed3.MSeed3Record>> {
    const mythis = this;
    this.format(FORMAT_MINISEED_THREE);
    const url = this.formURL();
    const fetchInit = defaultFetchInitObj(miniseed.MINISEED_MIME);
    return doFetchWithTimeout(url, fetchInit, this._timeoutSec * 1000)
      .then(function (response) {
        if (
          response.status === 204 ||
          (isDef(mythis._nodata) && response.status === mythis.nodata())
        ) {
          // no data
          return new ArrayBuffer(0);
        } else {
          return response.arrayBuffer();
        }
      })
      .then(function (rawBuffer) {
        let dataRecords = mseed3.parseMSeed3Records(rawBuffer);
        return dataRecords;
      });
  }

  /**
   * queries the web service using the configured parameters, parsing the response
   * into miniseed data records and then combining the data records into
   * Seismogram objects.
   *
   * @returns Promise to Array of Seismogram objects
   */
  querySeismograms(): Promise<Array<Seismogram>> {
    if (this._format === FORMAT_MINISEED_THREE) {
      return this.queryMS3Records().then(dataRecords => {
        return mseed3.seismogramPerChannel(dataRecords);
      });
    } else {
      return this.queryDataRecords().then(dataRecords => {
        return miniseed.seismogramPerChannel(dataRecords);
      });
    }
  }

  postQueryDataRecords(
    channelTimeList: Array<SeismogramDisplayData>,
  ): Promise<Array<miniseed.DataRecord>> {
    return this.postQueryRaw(channelTimeList).then(fetchResponse => {
      if (fetchResponse.ok) {
        return fetchResponse.arrayBuffer().then(ab => {
          return miniseed.parseDataRecords(ab);
        });
      } else {
        util.log("fetchResponse not ok");
        return [];
      }
    });
  }

  postQueryMS3Records(
    channelTimeList: Array<SeismogramDisplayData>,
  ): Promise<Array<mseed3.MSeed3Record>> {
    return this.postQueryRaw(channelTimeList).then(fetchResponse => {
      if (fetchResponse.ok) {
        return fetchResponse.arrayBuffer().then(ab => {
          return mseed3.parseMSeed3Records(ab);
        });
      } else {
        util.log("fetchResponse not ok");
        return [];
      }
    });
  }

  /**
   * query the dataselect server using post, which allows for multiple
   * channel-timeranges at once. This assumes that there are not multiple
   * time ranges for the same channel as the results, encapsulated as
   * SeismogramDisplayData objects, are returned one seismogram
   * per channel, which may contain gaps. The original channel and timerange are
   * also populated with each result.
   *
   * @param   sddList array of SeismogramDisplayData objects
   * that will be filled in with the resulting seismogram
   * @returns Promise to the input Array of SeismogramDisplayData objects, each with the
   * seismogram containing the data returned from the server
   */
  postQuerySeismograms(
    sddList: Array<SeismogramDisplayData>,
  ): Promise<Array<SeismogramDisplayData>> {
    let seismogramPromise;

    if (this._format === FORMAT_MINISEED_THREE) {
      seismogramPromise = this.postQueryMS3Records(sddList).then(
        dataRecords => {
          return mseed3.seismogramPerChannel(dataRecords);
        },
      );
    } else {
      seismogramPromise = this.postQueryDataRecords(sddList).then(
        dataRecords => {
          return miniseed.seismogramPerChannel(dataRecords);
        },
      );
    }

    return seismogramPromise.then(seisArray => {
      for (let sdd of sddList) {
        let codes = sdd.codes();
        let seis = seisArray.find(
          s => s.codes() === codes && s.timeRange.overlaps(sdd.timeWindow),
        );

        if (seis) {
          sdd.seismogram = seis;
        }
      }

      return sddList;
    });
  }

  postQueryRaw(sddList: Array<SeismogramDisplayData>): Promise<Response> {
    if (sddList.length === 0) {
      // return promise faking an not ok fetch response
      return RSVP.hash({
        ok: false,
      });
    } else {
      return this.postQueryRawWithBody(DataSelectQuery.createPostBody(sddList));
    }
  }

  postQueryRawWithBody(body: string): Promise<Response> {
    const fetchInit = defaultFetchInitObj(miniseed.MINISEED_MIME);
    fetchInit.method = "POST";
    fetchInit.body = body;
    return doFetchWithTimeout(
      this.formURL(),
      fetchInit,
      this._timeoutSec * 1000,
    );
  }

  static createPostBody(sddList: Array<SeismogramDisplayData>): string {
    let out = "";

    for (let sdd of sddList) {
      const locCode = sdd.locationCode.trim() === "" ? "--" : sdd.locationCode;
      out += `${sdd.networkCode} ${sdd.stationCode} ${locCode} ${
        sdd.channelCode
      } ${sdd.startTime.toISOString()} ${sdd.endTime.toISOString()}`;
      out += "\n";
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
      "/fdsnws/dataselect/" +
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

  formURL(): string {
    let url = this.formBaseURL() + "/query?";

    if (this._networkCode) {
      url = url + makeParam("net", this.networkCode());
    }

    if (this._stationCode) {
      url = url + makeParam("sta", this.stationCode());
    }

    if (this._locationCode) {
      url = url + makeParam("loc", this.locationCode());
    }

    if (this._channelCode) {
      url = url + makeParam("cha", this.channelCode());
    }

    if (this._startTime) {
      url = url + makeParam("starttime", toIsoWoZ(this._startTime));
    }

    if (this._endTime) {
      url = url + makeParam("endtime", toIsoWoZ(this._endTime));
    }

    if (this._quality) {
      url = url + makeParam("quality", this.quality());
    }

    if (this._minimumLength) {
      url = url + makeParam("minimumlength", this.minimumLength());
    }

    if (this._repository) {
      url = url + makeParam("repository", this.repository());
    }

    if (this._longestOnly) {
      url = url + makeParam("longestonly", this.longestOnly());
    }

    if (this._format) {
      url = url + makeParam("format", this.format());
    }

    if (this._nodata) {
      url = url + makeParam("nodata", this.nodata());
    }

    if (url.endsWith("&") || url.endsWith("?")) {
      url = url.substr(0, url.length - 1); // zap last & or ?
    }

    return url;
  }
}
export function createDataSelectQuery(
  params: Record<string, any>,
): DataSelectQuery {
  if (!params || typeof params !== "object") {
    throw new Error("params null or not an object");
  }

  let out = new DataSelectQuery();

  if (params.net) {
    out.networkCode(params.net);
  }

  if (params.network) {
    out.networkCode(params.network);
  }

  if (params.networkCode) {
    out.networkCode(params.networkCode);
  }

  if (params.sta) {
    out.stationCode(params.sta);
  }

  if (params.station) {
    out.stationCode(params.station);
  }

  if (params.stationCode) {
    out.stationCode(params.stationCode);
  }

  if (params.loc) {
    out.locationCode(params.loc);
  }

  if (params.location) {
    out.locationCode(params.location);
  }

  if (params.locationCode) {
    out.locationCode(params.locationCode);
  }

  if (params.chan) {
    out.channelCode(params.chan);
  }

  if (params.channel) {
    out.channelCode(params.channel);
  }

  if (params.channelCode) {
    out.channelCode(params.channelCode);
  }

  if (params.start) {
    out.startTime(params.start);
  }

  if (params.starttime) {
    out.startTime(params.starttime);
  }

  if (params.end) {
    out.endTime(params.end);
  }

  if (params.endtime) {
    out.endTime(params.endtime);
  }

  if (params.quality) {
    out.quality(params.quality);
  }

  if (params.minimumlength) {
    out.minimumLength(params.minimumlength);
  }

  if (params.repository) {
    out.repository(params.repository);
  }

  if (params.longestonly) {
    out.longestOnly(params.longestonly);
  }

  if (params.format) {
    out.format(params.format);
  }

  if (params.nodata) {
    out.nodata(params.nodata);
  }

  if (params.host) {
    out.host(params.host);
  }

  if (params.port) {
    out.port(params.port);
  }

  if (params.specVersion) {
    out.specVersion(params.specVersion);
  }

  return out;
}