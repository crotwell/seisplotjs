// @flow
import moment from 'moment';
import * as util from './util';
import * as miniseed from '../miniseed';
import * as RSVP from 'rsvp';

let model = miniseed.model;

export const Allowed_Flags = [ 'n', 's', 'l', 'c', 'Y', 'j', 'H'];

export class MSeedArchive {
  _rootUrl: string;
  _pattern: string;
  _recordSize: number;
  constructor(rootUrl: string, pattern: string) {
    this._rootUrl = rootUrl;
    this._pattern = pattern;
    this._recordSize = 512;
    this.checkPattern(this._pattern);
  }
  getRootUrl(): string {
    return this._rootUrl;
  }
  getPattern(): string {
    return this._pattern;
  }
  /** checks pattern for allowed flags as not all that are supported
    * by ringserver are supported here. Must only include:
    * * n : network code, white space removed
    * * s : station code, white space removed
    * * l : location code, white space removed
    * * c : channel code, white space removed
    * * Y : year, 4 digits
    * * j : day of year, 3 digits zero padded
    * * H : hour, 2 digits zero padded
    */
  checkPattern(p: string): boolean {
    let regexp = /%[a-zA-Z]/g;
    let allFlags = p.match(regexp);
    if ( ! allFlags) {
      return false;
    } else {
      for( let f of allFlags) {
        if (Allowed_Flags.indexOf(f.slice(1)) == -1) {
          console.log("Didn't find '"+f+"'");
          return false;
        }
      }
    }
    return true;
  }
  loadDataForChannel(channel: model.Channel, start: moment, end: moment) {
    return this.loadData(channel.station().network().networkCode(),
                    channel.station().stationCode(),
                    channel.locationCode(),
                    channel.channelCode(),
                    start,
                    end,
                    channel.sampleRate());
  }
  loadData(net: string, sta: string, loc: string, chan: string, start: moment, end: moment, sampleRate: number) {
    let basePattern = this.fillBasePattern(net, sta, loc, chan);
    if ( ! util.isDef(sampleRate)) {
      sampleRate = minSampleRate(chan);
    }
    let recordTime = maxTimeForRecord(this._recordSize, sampleRate);
    let t = moment.utc(start).subtract(recordTime, 'seconds');
    let promiseArray = [];
    while (t.isBefore(end)) {
      let url = this.getRootUrl()+'/'+this.fillTimePattern(basePattern, t);
      promiseArray.push(fetch(url, { cache: "no-store" }));
      t.add(1, 'hour');
    }
    if (moment.utc(t).add(recordTime, 'seconds').isAfter(end)) {
      let url = this.getRootUrl()+'/'+this.fillTimePattern(basePattern, t);
      promiseArray.push(fetch(url, { cache: "no-store" }));
    }
    promiseArray = promiseArray.map( (p, i) => {
      return p.then(fetchResponse => {
        if (fetchResponse.ok) {
          console.log("######  is ok "+fetchResponse.status);
          if (fetchResponse.status == 200 || fetchResponse.status == 304) {
            return fetchResponse.arrayBuffer().then(ab => {
              console.log("got data for "+fetchResponse.url+" "+ab.byteLength);
              return ab;
            });
          } else {
            console.log("no data: status="+fetchResponse.status+" "+fetchResponse.url);
            return null;
          }
        } else {
          console.log("###### not ok "+fetchResponse.status);
          return null;
          //throw new Error("no data returned: "+fetchResponse.ok+" "+fetchResponse.url);
        }
      }).catch(err => {
        console.log("caught fetch err, continuing with empty: "+err);
        return null;
      }).then(arrayBuffer => {
        let dataRecords = [];
        if (arrayBuffer && arrayBuffer.byteLength > 0) {
          dataRecords = dataRecords.concat(miniseed.parseDataRecords(arrayBuffer));
        }
        return dataRecords;
      })
    });

    return RSVP.all(promiseArray).then(pArray => {
        let dataRecords: Array<miniseed.DataRecord> = [];
        let index = 0;
        pArray.forEach(p => {
          dataRecords = dataRecords.concat(p);
        });
        return dataRecords;
    }).then(dataRecords => {
      if (dataRecords) {
        return dataRecords.filter(dr => dr.header.end.isSameOrAfter(start) &&
                                        dr.header.start.isSameOrBefore(end));
      } else {
        return []; // for flow
      }
    });
  }
  fillBasePattern(net: string, sta: string, loc: string, chan: string): string {
    return this.getPattern().replace(/%n/g, net)
      .replace(/%s/g, sta)
      .replace(/%l/g, loc)
      .replace(/%c/g, chan);
  }
  fillTimePattern(basePattern: string, t: moment): string {
    return basePattern.replace(/%Y/g, t.format('YYYY'))
      .replace(/%j/g, t.format('DDDD'))
      .replace(/%H/g, t.format('HH'));

  }
}

/** Gives the maximum sample rate for the channel, based on the
  * band code, first char, of the channel code. */
export function maxSampleRate(chan: string): number {
  let f = chan.slice(0,1);
  switch(f) {
    case 'F':
    case 'G':
      return 5000;
    case 'D':
    case 'C':
      return 1000;
    case 'E':
    case 'H':
      return 250;
    case 'S':
    case 'B':
      return 80;
    case 'M':
      return 10;
    case 'L':
      return 1;
    case 'V':
      return .1;
    case 'U':
      return .01;
    case 'R':
      return .001;
    case 'P':
      return .0001;
    case 'Q':
      return .000001;
    default:
      throw new Error("Unknown band code "+f+" in "+chan);
  }
}


/** Gives the minimum sample rate for the channel, based on the
  * band code, first char, of the channel code. */
export function minSampleRate(chan: string): number {
  let f = chan.slice(0,1);
  switch(f) {
    case 'F':
    case 'G':
      return 1000;
    case 'D':
    case 'C':
      return 2500;
    case 'E':
    case 'H':
      return 80;
    case 'S':
    case 'B':
      return 10;
    case 'M':
      return 1;
    case 'L':
      return 1; // maybe wrong, seed manual not clear
    case 'V':
      return .1; // maybe wrong, seed manual not clear
    case 'U':
      return .01; // maybe wrong, seed manual not clear
    case 'R':
      return .0001;
    case 'P':
      return .00001;
    case 'Q':
      return .0000001;
    default:
      throw new Error("Unknown band code "+f+" in "+chan);
  }
}
/** Calculates the maximum time coverage for a single miniseed record
  * given the record size (usually 512 or 4096) and the sample rate (Hertz).
  * This assumes 40 bytes of header and maximum compression of 2 samples
  * per byte (4 bit per sample) which is the best Steim2.
  */
export function maxTimeForRecord(recordSize: number, sampleRate: number) {
  return (recordSize-40)*2/sampleRate;
}
