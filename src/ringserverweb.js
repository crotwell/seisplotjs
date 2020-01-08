// @flow

/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */

import moment from 'moment';

import * as util from './util.js'; // for util.log
import { checkProtocol, hasNoArgs, isStringArg, isNonEmptyStringArg, isNumArg,
         isDef, TEXT_MIME, doFetchWithTimeout, defaultFetchInitObj} from './util.js';


export type RingserverVersion = {
  'ringserverVersion': string,
  'serverId': string
};

export type StreamsResult = {
  accessTime: moment,
  streams: Array<StreamStat>
};

export const IRIS_HOST = 'rtserve.iris.washington.edu';

const ORG = 'Organization: ';
/**
 * Web connection to a Ringserver.
 *
 *
 * @param host optional host to connect to, defaults to IRIS
 * @param port optional host to connect to, defaults to 80
 */
export class RingserverConnection {
  /** @private */
  _host: string;
  /** @private */
  _port: number;
  /** @private */
  _timeoutSec: number;
  constructor(host?: string, port?: number) {
    this._host = (isNonEmptyStringArg(host) ? host : IRIS_HOST);
    this._port = (isDef(port) ? port : 80);
    this._timeoutSec = 30;
  }

  /**
   * Gets/Sets the remote host to connect to.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  host(value?: string): string | RingserverConnection {
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
   * Gets/Sets the remote port to connect to.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  port(value?: number): number | RingserverConnection {
    if (hasNoArgs(value)) {
      return this._port;
    } else if (isNumArg(value)) {
      this._port = value;
      return this;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }

  /**
   * Get/Set the timeout in seconds for the request. Default is 30.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  timeout(value?: number): number | RingserverConnection {
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
   * Pulls id result from ringserver /id parsed into an object with
   * 'ringserverVersion' and 'serverId' fields.
   *
   * @returns Result as an RSVP Promise.
   */
  pullId(): Promise<RingserverVersion> {
    return this.pullRaw(this.formIdURL()).then(raw => {
      let lines = raw.split('\n');
      let organization = lines[1];
      if (organization.startsWith(ORG)) {
        organization = organization.substring(ORG.length);
      }
      return {
        'ringserverVersion': lines[0],
        'serverId': organization
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
   * @returns Result as an RSVP Promise.
   */
  pullStreamIds(level: number, matchPattern: string): Promise<Array<string>> {
    let queryParams = 'level=6';
    if (isNumArg(level) && level > 0) { queryParams = 'level='+level; }
    if (matchPattern) { queryParams = queryParams+'&match='+matchPattern; }
    const url = this.formStreamIdsURL(queryParams);
    return this.pullRaw(url).then(raw => {
      return raw.split('\n').filter( line => line.length > 0);
    });
  }

  /**
   * Pull streams, including start and end times, from the ringserver.
   * The optional matchPattern is a regular expression, so for example
   * '.+_JSC_00_HH.' would get all HH? channels from any station name JSC.
   * Result returned is an RSVP Promise.
   *
   * @param matchPattern regular expression to match
   * @returns promise to object with 'accessTime' as a moment
   * and 'streams' as an array of StreamStat objects.
   */
  pullStreams(matchPattern: string ): Promise<StreamsResult> {
    let queryParams = "";
    if (matchPattern) { queryParams = 'match='+matchPattern; }
    const url = this.formStreamsURL(queryParams);
    return this.pullRaw(url).then(raw => {
      let lines = raw.split('\n');
      let out = {};
      out.accessTime = moment.utc();
      out.streams = [];
      for(let line of lines) {
        if(line.length === 0 ) {continue;}
        let vals = line.split(/\s+/);
        if (vals.length === 0) {
          // blank line, skip
          continue;
        } else if (vals.length >= 2) {
          out.streams.push(new StreamStat(vals[0], vals[1], vals[2]));
        } else {
          util.log("Bad /streams line, skipping: '"+line+"'");
        }
      }
      return out;
    });
  }

  /**
   * Utility method to pull raw result from ringserver url.
   * Result returned is an RSVP Promise.
   *
   * @param url the url
   * @returns promise to string result
   */
  pullRaw(url: string): Promise<string>{
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

  /**
   * Forms base url from protocol, host and port.
   *
   * @returns the string url
   */
  formBaseURL(): string {
    return checkProtocol()+'//'+this._host+(this._port===80 ? '' : (':'+this._port));
  }

  /**
   * Forms the ringserver id url.
   *
   * @returns the id url
   */
  formIdURL(): string {
    return this.formBaseURL()+'/id';
  }

  /**
   * Forms the ringserver streams url using the query parameters.
   *
   * @param queryParams optional string of query parameters
   * @returns the streams url
   */
  formStreamsURL(queryParams?: string): string {
    return this.formBaseURL()+'/streams'+((isNonEmptyStringArg(queryParams) && queryParams.length > 0) ? '?'+queryParams : '');
  }

  /**
   * Forms the ringserver stream ids url using the query parameters.
   *
   * @param queryParams optional string of query parameters
   * @returns the stream ids url
   */
  formStreamIdsURL(queryParams: string): string {
    return this.formBaseURL()+'/streamids'+((queryParams && queryParams.length > 0) ? '?'+queryParams : '');
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
export function stationsFromStreams(streams: Array<StreamStat>): Array<StreamStat> {
  let out: Map<string, StreamStat> = new Map();
  for (const s of streams) {
    const nslc = nslcSplit(s.key);
    const staKey = nslc.networkCode+"."+nslc.stationCode;
    let stat = out.get(staKey);
    if (! isDef(stat)) {
      stat = new StreamStat(staKey, s.startRaw, s.endRaw);
      out.set(staKey, stat);
    } else {
      if (stat.start.isAfter(s.start)) {
        stat.start = s.start;
        stat.startRaw = s.startRaw;
      }
      if (stat.end.isBefore(s.end)) {
        stat.end = s.end;
        stat.endRaw = s.endRaw;
      }
    }
  }
  return Array.from(out.values());
}

export type NSLCType = {
  type: string,
  networkCode: string,
  stationCode: string,
  locationCode: string,
  channelCode: string
};

/**
 * Split type, networkCode, stationCode, locationCode and channelCode
 * from a ringserver id formatted like net_sta_loc_chan/type
 *
 * @param   id id string to split
 * @returns  object with the split fields
 */
export function nslcSplit(id: string): NSLCType {
  let split = id.split('/');
  let out = {};
  out.type = split[1];
  let nslc = split[0].split('_');
  if (nslc.length === 4) {
    // assume net, station, loc, chan
    out.networkCode = nslc[0];
    out.stationCode = nslc[1];
    out.locationCode = nslc[2];
    out.channelCode = nslc[3];
  } else {
    throw new Error("tried to split, did not find 4 elements in array: "+id);
  }
  return out;
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
  start: moment;
  end: moment;
  constructor(key: string, start: moment, end: moment) {
    this.key = key;
    this.startRaw = start;
    this.endRaw = end;
    if (this.startRaw.indexOf('.') !== -1 && this.startRaw.indexOf('.') < this.startRaw.length-4) {
      this.startRaw = this.startRaw.substring(0, this.startRaw.indexOf('.')+4);
    }
    if (this.startRaw.charAt(this.startRaw.length-1) !== 'Z') {
      this.startRaw = this.startRaw+'Z';
    }
    if (this.endRaw.indexOf('.') !== -1 && this.endRaw.indexOf('.') < this.endRaw.length-4) {
      this.endRaw = this.endRaw.substring(0, this.endRaw.indexOf('.')+4);
    }
    if (this.endRaw.charAt(this.endRaw.length-1) !== 'Z') {
      this.endRaw = this.endRaw+'Z';
    }
    this.start = moment.utc(this.startRaw);
    this.end = moment.utc(this.endRaw);
    this.startRaw = start; // reset to unchanged strings
    this.endRaw = end;
  }
  /**
   * Calculates latency time difference between last packet and current time.
   *
   * @param accessTime time latency is calculated relative to
   * @returns latency
   */
  calcLatency(accessTime: moment): moment.duration {
    return this.end.from(accessTime);
  }
}
