// @flow

/**
 * Philip Crotwell
 * University of South Carolina, 2017
 * http://www.seis.sc.edu
 */

import RSVP from 'rsvp';
import moment from 'moment';

import * as miniseed from './miniseed';

import { checkProtocol, hasArgs, hasNoArgs, isStringArg, isNumArg, isDef } from './util';

export type RingserverVersion = {
  'ringserverVersion': string,
  'serverId': string
};

export type StreamsResult = {
  accessTime :moment,
  streams: Array<StreamStat>
};

export const IRIS_HOST = 'rtserve.iris.washington.edu';

const ORG = 'Organization: ';

export class RingserverConnection {
  _host: string;
  _port: number;
  constructor(host ?:string, port ?:number) {
    this._host = (host ? host : IRIS_HOST);
    this._port = (port ? port : 80);
  }

  host(value ?:string) :string | RingserverConnection {
    return hasArgs(value) ? (this._host = value, this) : this._host;
  }

  port(value ?:number) :number | RingserverConnection {
    return hasArgs(value) ? (this._port = value, this) : this._port;
  }


  /** Pulls id result from ringserver /id parsed into an object with
    * 'ringserverVersion' and 'serverId' fields.
    * Result returned is an RSVP Promise.
    */
  pullId() :Promise<RingserverVersion> {
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
   *  Result returned is an RSVP Promise.
   */
  pullStreamIds(level :number, matchPattern :string) :Promise<Array<string>> {
    let queryParams = 'level=6';
    if (level && level > 0) { queryParams = 'level='+level; }
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
    */
  pullStreams(matchPattern :string ) :Promise<StreamsResult> {
    let queryParams = "";
    if (matchPattern) { queryParams = 'match='+matchPattern; }
    const url = this.formStreamsURL(queryParams);
    return this.pullRaw(url).then(raw => {
      let lines = raw.split('\n');
      let out = {};
      out.accessTime = moment().utc();
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
          console.log("Bad /streams line, skipping: '"+line+"'");
        }
      }
      return out;
    });
  }

  /** Pulls raw result from ringserver /streams. QueryParams should
    * be formatted like URL query parameters, ie 'name=value&name=value'.
    * Result returned is an RSVP Promise.
    */
  pullRaw(url :string) :Promise<string>{
    let promise = new RSVP.Promise(function(resolve, reject) {
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
            console.log("Reject pullRaw: "+url+" "+this.status);
            reject(this);
          }
        }
      }
    });
    return promise;
  }

  formBaseURL() :string {
    return checkProtocol()+'//'+this._host+(this._port==80 ? '' : (':'+this._port));
  }

  formIdURL() :string {
    return this.formBaseURL()+'/id';
  }

  formStreamsURL(queryParams :string) :string {
    return this.formBaseURL()+'/streams'+((queryParams && queryParams.length > 0) ? '?'+queryParams : '');
  }

  formStreamIdsURL(queryParams :string) :string {
    return this.formBaseURL()+'/streamids'+((queryParams && queryParams.length > 0) ? '?'+queryParams : '');
  }

}

export function stationsFromStreams(streams :Array<StreamStat>) :Array<StreamStat> {
  let out :Map<string, StreamStat> = new Map();
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
  networkCode :string,
  stationCode :string,
  locationCode :string,
  channelCode :string
};

export function nslcSplit(id :string) :NSLCType {
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

export class StreamStat {
  key :string;
  startRaw :string;
  endRaw :string;
  start :moment;
  end :moment;
  constructor(key :string, start :moment, end :moment) {
    this.key = key;
    this.startRaw = start;
    this.endRaw = end;
    if (this.startRaw.indexOf('.') != -1 && this.startRaw.indexOf('.') < this.startRaw.length-4) {
      this.startRaw = this.startRaw.substring(0, this.startRaw.indexOf('.')+4);
    }
    if (this.startRaw.charAt(this.startRaw.length-1) != 'Z') {
      this.startRaw = this.startRaw+'Z';
    }
    if (this.endRaw.indexOf('.') != -1 && this.endRaw.indexOf('.') < this.endRaw.length-4) {
      this.endRaw = this.endRaw.substring(0, this.endRaw.indexOf('.')+4);
    }
    if (this.endRaw.charAt(this.endRaw.length-1) != 'Z') {
      this.endRaw = this.endRaw+'Z';
    }
    this.start = moment.utc(this.startRaw);
    this.end = moment.utc(this.endRaw);
    this.startRaw = start; // reset to unchanged strings
    this.endRaw = end;
  }
  calcLatency(accessTime :moment) :moment.duration {
    return this.end.from(accessTime);
  }
}
