/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * https://www.seis.sc.edu
 */
import { DateTime, Duration } from "luxon";
import {extractDLProto} from "./datalink";
import {
  FDSN_PREFIX,
  FDSNSourceId,
  StationSourceId,
  NetworkSourceId,
  NslcId,
  parseSourceId } from "./fdsnsourceid";
import * as util from "./util"; // for util.log

import {
  doIntGetterSetter,
  doStringGetterSetter,
  doFloatGetterSetter,
  checkProtocol,
  isNonEmptyStringArg,
  isNumArg,
  isDef,
  TEXT_MIME,
  doFetchWithTimeout,
  defaultFetchInitObj,
  isoToDateTime,
} from "./util";
export const SEEDLINK_PATH = "/seedlink";
export const DATALINK_PATH = "/datalink";
export type RingserverIdType = {
  software: string;
  organization: string;
  server_start: string;
  datalink_protocol: Array<string>;
  seedlink_protocol: Array<string>;
};
export type StreamsResultType = {
  software: string;
  organization: string;
  accessTime: DateTime;
  streams: Array<StreamStat>;
};
export const IRIS_HOST = "rtserve.iris.washington.edu";
const ORG = "Organization: ";

/**
 * Web connection to a Ringserver.
 *
 *
 * @param host optional host to connect to, defaults to IRIS. This maybe a full URL.
 * @param port optional host to connect to, defaults to 80
 */
export class RingserverConnection {
  /** @private */
  _protocol: string;

  /** @private */
  _host: string;

  /** @private */
  _port: number;

  /** @private */
  _prefix: string;

  /** @private */
  _timeoutSec: number;

  isFDSNSourceId = false;

  dlproto = "1.0";

  constructor(host?: string, port?: number) {
    const hostStr = isNonEmptyStringArg(host) ? host : IRIS_HOST;

    if (hostStr.startsWith("http")) {
      const rs_url = new URL(hostStr);
      this._host = rs_url.hostname;
      this._port = parseInt(rs_url.port);
      this._protocol = rs_url.protocol;

      if (!Number.isInteger(this._port)) {
        this._port = 80;
      }

      this._prefix = rs_url.pathname;
    } else {
      this._protocol = "http:";
      this._host = hostStr;
      this._port = 80;
      this._prefix = "";
    }

    // override port in URL if given
    if (isNumArg(port)) {
      this._port = port;
    }

    this._timeoutSec = 30;
  }

  /**
   * Gets/Sets the remote host to connect to.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  host(value?: string): RingserverConnection {
    doStringGetterSetter(this, "host", value);
    return this;
  }

  getHost(): string {
    return this._host;
  }

  /**
   * Gets/Sets the remote port to connect to.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  port(value?: number): number | RingserverConnection {
    doIntGetterSetter(this, "port", value);
    return this;
  }

  getPort(): number | undefined {
    return this._port;
  }

  /**
   * Get/Set the timeout in seconds for the request. Default is 30.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  timeout(value?: number): RingserverConnection {
    doFloatGetterSetter(this, "timeoutSec", value);
    return this;
  }

  getTimeout(): number | undefined {
    return this._timeoutSec;
  }

/*  .../id/json
{
"software":"ringserver/4.1.0-RC",
"organization":"Test Ring Server 4",
"server_start":"2025-05-14T00:33:11Z",
"datalink_protocol":["DLPROTO:1.1"],
"seedlink_protocol":["SLPROTO:4.0","SLPROTO:3.1"]
}
 */

  /**
   * Pulls id result from ringserver /id parsed into an object with
   * 'ringserverVersion' and 'serverId' fields. Also sets the
   * isFDSNSourceId value as ringserver v4 uses new FDSN style ids
   * while
   *
   * @returns Result as a Promise.
   */
  pullId(): Promise<RingserverVersion> {
    return this.pullJson(this.formIdURL()).then((raw) => {6
      this.dlproto = extractDLProto(lines);
      if (this.dlproto == "1.0") {
        if (version.startsWith(ringserver_v4)) {
          // version 4.0 was FDSN Sid, but did not have DLPROTO:1.1
          // version 4.1 and greater should have it
          this.isFDSNSourceId = true;
        } else {
          this.isFDSNSourceId = false;
        }
      } else {
        this.isFDSNSourceId = true;
      }
      if (isFDSNSourceId) {
        // can use id/json
        return this.pullJson(this.formIdURL()).then((raw) => {
          const lines = raw.split("\n");
        });
      }
      let dlinfo = "";
      let slinfo = "";
      let serverStart = "";
      for (let line of lines) {
        if (line.startsWith("Datalink")) {
          dlinfo = line;
        }
        if (line.startsWith("Seedlink")) {
          slinfo = line;
        }
        if (line.startsWith("Seedlink")) {
          slinfo = line;
        }
      }

      return {
        ringserverVersion: lines[0],
        serverId: organization,
        datalink: dlinfo,
        seedlink: slinfo
      };
    });
  }

  /**
   *  The optional matchPattern is a regular expression, so for example
   *  '.+_JSC_00_HH.' would get all HH? channels from any station name JSC.
   *
   * @param level 1-6
   * @param matchPattern regular expression to match
   * @returns Result as a Promise.
   */
  pullStreamIds(matchPattern: string): Promise<Array<string>> {
    let queryParams = "";
    if (matchPattern) {
      queryParams = queryParams + "&match=" + matchPattern;
    }

    const url = this.formStreamIdsURL(queryParams);
    return this.pullJson(url).then((raw) => {
      return raw.split("\n").filter((line) => line.length > 0);
    });
  }

/*  .../streams/json
{
  "software": "ringserver/4.1.0-RC",
  "organization": "Test Ring Server 4",
  "stream": [
    {
      "id": "FDSN:CO_BARN_00_H_N_E/MSEED",
      "start_time": "2025-05-20T22:20:58.425000Z",
      "end_time": "2025-05-21T19:09:14.015000Z",
      "earliest_packet_id": 191770832,
      "earliest_packet_time": "2025-05-20T22:21:01.423953Z",
      "latest_packet_time": "2025-05-21T19:09:15.537190Z",
      "latest_packet_id": 193469736,
      "data_latency": 2.159491
    },
 */


  /**
   * Pull streams, including start and end times, from the ringserver.
   * The optional matchPattern is a regular expression, so for example
   * '.+_JSC_00_HH.' would get all HH? channels from any station name JSC.
   * Result returned is an Promise.
   *
   * @param matchPattern regular expression to match
   * @returns promise to object with 'accessTime' as a DateTime
   * and 'streams' as an array of StreamStat objects.
   */
  pullStreams(matchPattern: string): Promise<StreamsResult> {
    let queryParams = "";

    if (matchPattern) {
      queryParams = "match=" + matchPattern;
    }

    const url = this.formStreamsURL(queryParams);
    return this.pullJson(url).then((raw) => {
      const lines = raw.split("\n");
      const out: StreamsResult = {
        accessTime: DateTime.utc(),
        streams: [],
      };

      for (const line of lines) {
        if (line.length === 0) {
          continue;
        }

        const vals = line.split(/\s+/);

        if (vals.length === 0) {
          // blank line, skip
          continue;
        } else if (vals.length >= 2) {
          out.streams.push(new StreamStat(vals[0], vals[1], vals[2]));
        } else {
          util.log("Bad /streams line, skipping: '" + line + "'");
        }
      }

      return out;
    });
  }

  /**
   * Utility method to pull raw result from ringserver url.
   * Result returned is an Promise.
   *
   * @param url the url
   * @returns promise to string result
   */
  pullJson(url: string): Promise<string> {
    const fetchInit = defaultFetchInitObj(JSON_MIME);
    return doFetchWithTimeout(url, fetchInit, this._timeoutSec * 1000).then(
      (response) => {
        if (response.status === 200) {
          return response.json();
        } else {
          throw new Error(`Status not 200: ${response.status}`);
        }
      },
    );
  }

  getDataLinkURL(): string {
    let proto = "ws:";

    if (checkProtocol(this._protocol) === "https:") {
      proto = "wss:";
    }

    return (
      proto +
      "//" +
      this._host +
      (this._port === 80 ? "" : ":" + this._port) +
      this._prefix +
      DATALINK_PATH
    );
  }

  getSeedLinkURL(): string {
    let proto = "ws:";

    if (checkProtocol(this._protocol) === "https:") {
      proto = "wss:";
    }

    return (
      proto +
      "//" +
      this._host +
      (this._port === 80 ? "" : ":" + this._port) +
      this._prefix +
      SEEDLINK_PATH
    );
  }

  /**
   * Forms base url from protocol, host and port.
   *
   * @returns the string url
   */
  formBaseURL(): string {
    if (this._port === 0) {
      this._port = 80;
    }

    return (
      checkProtocol(this._protocol) +
      "//" +
      this._host +
      (this._port === 80 ? "" : ":" + this._port) +
      this._prefix
    );
  }

  /**
   * Forms the ringserver id/json url.
   *
   * @returns the id url
   */
  formIdURL(): string {
    return this.formBaseURL() + "/id/json";
  }

  /**
   * Forms the ringserver streams/json url using the query parameters.
   *
   * @param queryParams optional string of query parameters
   * @returns the streams url
   */
  formStreamsURL(queryParams?: string): string {
    return (
      this.formBaseURL() +
      "/streams/json" +
      (isNonEmptyStringArg(queryParams) && queryParams.length > 0
        ? "?" + queryParams
        : "")
    );
  }

  /**
   * Forms the ringserver stream ids url using the query parameters.
   *
   * @param queryParams optional string of query parameters
   * @returns the stream ids url
   */
  formStreamIdsURL(queryParams: string): string {
    return (
      this.formBaseURL() +
      "/streamids" +
      (queryParams && queryParams.length > 0 ? "?" + queryParams : "")
    );
  }
}

/**
 * Extract one StreamStat per station from an array of channel level
 * StreamStats. The start and end times are the min and max times for all
 * the channels within the station. Can be used to get most time of most
 * recent packet from the stations to give an idea of current latency.
 *
 * @param   streams array of channel level StreamStats
 * @returns array of station level StreamStats
 */
export function stationsFromStreams(
  streams: Array<StreamStat>,
): Array<StreamStat> {
  const out: Map<string, StreamStat> = new Map();

  for (const s of streams) {
    const sid = sidForId(s.key);
    if (sid == null || sid instanceof NetworkSourceId) {
      // oh well, doesn't look like a seismic channel?
      continue;
    }
    const staSid = sid instanceof StationSourceId ? sid : sid.stationSourceId();
    const staKey = staSid.networkCode + "_" + staSid.stationCode;
    let stat = out.get(staKey);

    if (!isDef(stat)) {
      stat = new StreamStat(staKey, s.startRaw, s.endRaw);
      out.set(staKey, stat);
    } else {
      if (stat.start > s.start) {
        stat.start = s.start;
        stat.startRaw = s.startRaw;
      }

      if (stat.end < s.end) {
        stat.end = s.end;
        stat.endRaw = s.endRaw;
      }
    }
  }

  return Array.from(out.values());
}

/**
 * extracts the type from a ringserver id, ie the type from
 * xxx/type.
 * @param  id   ringserver/datalink style id
 * @return   type, usually MSEED, MSEED3, JSON or TEXT
 */
export function typeForId(id: string): string | null {
  const split = id.split("/");
  if (split.length >= 2) {
    return split[split.length-1];
  }
  return null;
}

/**
 * extracts the source id from a ringserver id, ie the source id from
 * NN_SSSSS_LL_CCC/type or FDSN:NN_SSSSS_LL_B_S_S/type
 * @param  id   ringserver/datalink style id
 * @return   FDSN source id or null
 */
export function sidForId(id: string): FDSNSourceId | StationSourceId | NetworkSourceId | null {
  const split = id.split("/");
  if (split.length >= 1) {
    const sidStr = split[0];
    if (sidStr.startsWith(FDSN_PREFIX)) {
      return parseSourceId(split[0]);
    } else {
      const items = split[0].split("_");
      if (items.length == 4) {
        // maybe old style NSLC
        const nslc = NslcId.parse(split[0], "_");
        return FDSNSourceId.fromNslcId(nslc);
      }
    }
  }
  return null;
}

/**
 * Object to hold start and end times for a id,
 * usually channel or station.
 *
 * @param key id, usually station or channel
 * @param start start time
 * @param end end time
 */
export class RingStreamStat {
  id: string;
  start_time: DateTime;
  end_time: DateTime;
  earliest_packet_id: number;
  earliest_packet_time: DateTime;
  latest_packet_time: DateTime;
  latest_packet_id: number;
  data_latency: number;

  constructor(id: string,
              start_time: DateTime,
              end_time: DateTime,
              earliest_packet_id: number,
              earliest_packet_time: DateTime,
              latest_packet_id: number,
              latest_packet_time: DateTime,
              data_latency: number
            ) {
    this.id = id;
    this.start_time = start_time;
    this.end_time = end_time;
    this.earliest_packet_id = earliest_packet_id;
    this.earliest_packet_time = earliest_packet_time;
    this.latest_packet_id = latest_packet_id;
    this.latest_packet_time = latest_packet_time;
    this.data_latency = data_latency;
  }

  static fromJson(jsonObj: any): StreamStat {
    if (jsonObj instanceof string) {
      jsonObj = JSON.parse(jsonObj);
    }
    if ("start_time" in jsonObj &&
        "data_latency" in jsonObj
      ) {
      return new StreamStat(
        isoToDateTime(jsonObj.start_time),
        isoToDateTime(jsonObj.end_time),
        parseInt(jsonObj.earliest_packet_id),
        isoToDateTime(jsonObj.earliest_packet_time),
        parseInt(jsonObj.latest_packet_id),
        isoToDateTime(jsonObj.latest_packet_time),
        parseFloat(jsonObj.data_latency)
      );
    }
  }

  /**
   * Calculates latency time difference between last packet and current time.
   *
   * @param accessTime time latency is calculated relative to
   * @returns latency
   */
  calcLatency(accessTime?: DateTime): Duration {
    if (!accessTime) accessTime = DateTime.utc();
    return this.end_time.diff(accessTime);
  }
}
