/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * https://www.seis.sc.edu
 */
import { DateTime } from "luxon";
import { z } from "zod/v4";
import {defaultPortStringForProtocol} from "./fdsncommon";
import {
  FDSN_PREFIX,
  FDSNSourceId,
  StationSourceId,
  NetworkSourceId,
  NslcId,
  parseSourceId } from "./fdsnsourceid";
//import * as util from "./util"; // for util.log

import {
  doIntGetterSetter,
  doStringGetterSetter,
  doFloatGetterSetter,
  checkProtocol,
  isNonEmptyStringArg,
  isNumArg,
  isDef,
  isoToDateTime,
  pullJson,
  pullText
} from "./util";
export const SEEDLINK_PATH = "seedlink";
export const DATALINK_PATH = "datalink";
const RingserverId = z.object({
    software: z.string(),
    organization: z.string(),
    server_start: z.string(),
    datalink_protocol: z.array(z.string()),
    seedlink_protocol: z.array(z.string()),
});
export type RingserverIdType = z.infer<typeof RingserverId>;

const StreamStat = z.object({
  id: z.string(),
  start_time: z.iso.datetime().transform(isoToDateTime),
  end_time: z.iso.datetime().transform(isoToDateTime),
  earliest_packet_id: z.number(),
  earliest_packet_time: z.iso.datetime().transform(isoToDateTime),
  latest_packet_time: z.iso.datetime().transform(isoToDateTime),
  latest_packet_id: z.number(),
  data_latency: z.number()
});
export type StreamStatType = z.infer<typeof StreamStat>;
const StreamsResult=  z.object({
  software: z.string(),
  organization: z.string(),
  stream: z.array(StreamStat),
  accessTime: z.custom<DateTime>((d)=> d instanceof DateTime).optional()
});
export type StreamsResultType = z.infer<typeof StreamsResult>;

export const IRIS_HOST = "rtserve.iris.washington.edu";

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
      this._prefix = "/";
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
  port(value?: number): RingserverConnection {
    doIntGetterSetter(this, "port", value);
    return this;
  }

  getPort(): number | undefined {
    return this._port;
  }

  /**
   * Gets/Sets the protocol, http or https. This should match the protocol
   *  of the page loaded, but is autocalculated and generally need not be set.
   *
   * @param value protocol, usually http or https
   * @returns the query when setting, the current value when no argument
   */
  protocol(value?: string): RingserverConnection {
    doStringGetterSetter(this, "protocol", value);
    return this;
  }

  getProtocol(): string | undefined {
    return this._protocol;
  }

  /**
   * Sets the prefix for the URL path.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  prefix(value?: string): RingserverConnection {
    if (value && ! value.startsWith("/")) {
      value = "/"+value;
    }
    if (value && ! value.endsWith("/")) {
      value = value+"/";
    }
    doStringGetterSetter(this, "prefix", value);
    return this;
  }

  getPrefix(): string {
    return this._prefix;
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
  pullId(): Promise<RingserverIdType> {
    return pullJson(this.formIdURL(), this._timeoutSec).catch((_err) => {
      // failed to get /id/json, try just /id text like ringserver3
      return pullText(this.formBaseURL()+"id", this._timeoutSec).then( rawlines => {
        const lines = rawlines.split("\n");
        let dlinfo = [`DLPROTO:1.0`];
        let slinfo = ["SLPROTO:3.1" ];
        const version = lines[0];
        if (version.startsWith("ringserver/4.0")) {
          // version 4.0 was FDSN Sid, but did not have DLPROTO:1.1
          // version 4.1 and greater should go via /id/json
          this.isFDSNSourceId = true;
          dlinfo = [`DLPROTO:1.1`];
          slinfo = ["SLPROTO:3.1", "SLPROTO:4.0"];
        } else {
          this.isFDSNSourceId = false;
        }
        const organization = lines[1].substring("Organization: ".length);
        const serverStart = "";
        return {
          software: version,
          organization: organization,
          server_start: serverStart,
          datalink_protocol: dlinfo,
          seedlink_protocol: slinfo
        };
      });
    }).then(rawJson => {
        return RingserverId.parse(rawJson);
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
  pullStreamIds(matchPattern?: string): Promise<Array<string>> {
    let queryParams = "";
    if (matchPattern && matchPattern.length > 0) {
      queryParams = queryParams + "&match=" + matchPattern;
    }

    const url = this.formStreamIdsURL(queryParams);
    return pullText(url, this._timeoutSec).then((raw) => {
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
  pullStreams(matchPattern?: string): Promise<StreamsResultType> {
    let queryParams = "";

    if (matchPattern && matchPattern.length > 0) {
      queryParams = "match=" + matchPattern;
    }

    const url = this.formStreamsURL(queryParams);
    return pullJson(url, this._timeoutSec).then((raw) => {
      const accessTime = DateTime.utc();
      const out = StreamsResult.parse(raw);
      out.accessTime = accessTime;
      return out;
    });
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

    const port = defaultPortStringForProtocol(this._protocol, this._port);

    return `${checkProtocol(this._protocol)}//${this._host}${port}${this._prefix}`;
  }

  /**
   * Forms the ringserver id/json url.
   *
   * @returns the id url
   */
  formIdURL(): string {
    return this.formBaseURL() + "id/json";
  }

  /**
   * Forms the ringserver streams/json url using the query parameters.
   *
   * @param queryParams optional string of query parameters
   * @returns the streams url
   */
  formStreamsURL(queryParams?: string): string {
    return this.formBaseURL() +"streams/json" +
      (isNonEmptyStringArg(queryParams) && queryParams.length > 0
        ? "?" + queryParams   : "");
  }

  /**
   * Forms the ringserver stream ids url using the query parameters.
   *
   * @param queryParams optional string of query parameters
   * @returns the stream ids url
   */
  formStreamIdsURL(queryParams: string): string {
    return this.formBaseURL() +"streamids" +
      (queryParams && queryParams.length > 0 ? "?" + queryParams : "");
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
  streams: Array<StreamStatType>,
): Array<StreamStatType> {
  const out: Map<string, StreamStatType> = new Map();

  for (const s of streams) {
    const sid = sidForId(s.id);
    if (sid == null || sid instanceof NetworkSourceId) {
      // oh well, doesn't look like a seismic channel?
      continue;
    }
    const staSid = sid instanceof StationSourceId ? sid : sid.stationSourceId();
    const staKey = staSid.networkCode + "_" + staSid.stationCode;
    let stat = out.get(staKey);

    if (!isDef(stat)) {
      stat = StreamStat.parse({
        id: staKey,
        start_time: s.start_time,
        end_time: s.end_time,
        earliest_packet_id: s.earliest_packet_id,
        earliest_packet_time: s.earliest_packet_time,
        latest_packet_time: s.latest_packet_time,
        latest_packet_id: s.latest_packet_id,
        data_latency: s.data_latency
      });
      out.set(staKey, stat);
    } else {
      if (stat.start_time > s.start_time) {
        stat.start_time = s.start_time;
      }

      if (stat.end_time < s.end_time) {
        stat.end_time = s.end_time;
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
      if (items.length === 4) {
        // maybe old style NSLC
        const nslc = NslcId.parse(split[0], "_");
        return FDSNSourceId.fromNslcId(nslc);
      }
    }
  }
  return null;
}
