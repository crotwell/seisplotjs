/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * https://www.seis.sc.edu
 */
import { DateTime, Duration } from "luxon";
import { NslcId } from "./fdsnsourceid";
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
export type RingserverVersion = {
  ringserverVersion: string;
  serverId: string;
};
export type StreamsResult = {
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

  /**
   * Pulls id result from ringserver /id parsed into an object with
   * 'ringserverVersion' and 'serverId' fields.
   *
   * @returns Result as a Promise.
   */
  pullId(): Promise<RingserverVersion> {
    return this.pullRaw(this.formIdURL()).then((raw) => {
      const lines = raw.split("\n");
      let organization = lines[1];

      if (organization.startsWith(ORG)) {
        organization = organization.substring(ORG.length);
      }

      return {
        ringserverVersion: lines[0],
        serverId: organization,
      };
    });
  }

  /**
   *  Use numeric level (1-6) to pull just IDs from ringserver.
   *  In a default ringserver,
   *  level=1 would return all networks like
   *  CO
   *  and level=2 would return all stations like
   *  CO_JSC
   *  If level is falsy/missing, level=6 is used.
   *  The optional matchPattern is a regular expression, so for example
   *  '.+_JSC_00_HH.' would get all HH? channels from any station name JSC.
   *
   * @param level 1-6
   * @param matchPattern regular expression to match
   * @returns Result as a Promise.
   */
  pullStreamIds(level: number, matchPattern: string): Promise<Array<string>> {
    let queryParams = "level=6";

    if (isNumArg(level) && level > 0) {
      queryParams = "level=" + level;
    }

    if (matchPattern) {
      queryParams = queryParams + "&match=" + matchPattern;
    }

    const url = this.formStreamIdsURL(queryParams);
    return this.pullRaw(url).then((raw) => {
      return raw.split("\n").filter((line) => line.length > 0);
    });
  }

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
    return this.pullRaw(url).then((raw) => {
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
  pullRaw(url: string): Promise<string> {
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
   * Forms the ringserver id url.
   *
   * @returns the id url
   */
  formIdURL(): string {
    return this.formBaseURL() + "/id";
  }

  /**
   * Forms the ringserver streams url using the query parameters.
   *
   * @param queryParams optional string of query parameters
   * @returns the streams url
   */
  formStreamsURL(queryParams?: string): string {
    return (
      this.formBaseURL() +
      "/streams" +
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
    const nslc_type = nslcSplit(s.key);
    const nslc = nslc_type.nslc;
    const staKey = nslc.networkCode + "." + nslc.stationCode;
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
export class NslcWithType {
  type: string;
  nslc: NslcId;
  constructor(type: string, nslc: NslcId) {
    this.type = type;
    this.nslc = nslc;
  }
}

/**
 * Split type, networkCode, stationCode, locationCode and channelCode
 * from a ringserver id formatted like net_sta_loc_chan/type
 *
 * @param   id id string to split
 * @returns  object with the split fields
 */
export function nslcSplit(id: string): NslcWithType {
  const split = id.split("/");
  const nslc = split[0].split("_");

  if (nslc.length === 4) {
    // assume net, station, loc, chan
    return new NslcWithType(
      split[1],
      new NslcId(nslc[0], nslc[1], nslc[2], nslc[3]),
    );
  } else {
    throw new Error("tried to split, did not find 4 elements in array: " + id);
  }
}

/**
 * Object to hold start and end times for a key, usually channel or station.
 *
 * @param key id, usually station or channel
 * @param start start time
 * @param end end time
 */
export class StreamStat {
  key: string;
  startRaw: string;
  endRaw: string;
  start: DateTime;
  end: DateTime;

  constructor(key: string, start: string, end: string) {
    this.key = key;
    this.startRaw = start;
    this.endRaw = end;

    if (
      this.startRaw.indexOf(".") !== -1 &&
      this.startRaw.indexOf(".") < this.startRaw.length - 4
    ) {
      this.startRaw = this.startRaw.substring(
        0,
        this.startRaw.indexOf(".") + 4,
      );
    }

    if (this.startRaw.charAt(this.startRaw.length - 1) !== "Z") {
      this.startRaw = this.startRaw + "Z";
    }

    if (
      this.endRaw.indexOf(".") !== -1 &&
      this.endRaw.indexOf(".") < this.endRaw.length - 4
    ) {
      this.endRaw = this.endRaw.substring(0, this.endRaw.indexOf(".") + 4);
    }

    if (this.endRaw.charAt(this.endRaw.length - 1) !== "Z") {
      this.endRaw = this.endRaw + "Z";
    }

    this.start = isoToDateTime(this.startRaw);
    this.end = isoToDateTime(this.endRaw);
    this.startRaw = start; // reset to unchanged strings

    this.endRaw = end;
  }

  /**
   * Calculates latency time difference between last packet and current time.
   *
   * @param accessTime time latency is calculated relative to
   * @returns latency
   */
  calcLatency(accessTime?: DateTime): Duration {
    if (!accessTime) accessTime = DateTime.utc();
    return this.end.diff(accessTime);
  }
}
