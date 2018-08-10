// @flow

import { moment, checkStringOrDate, hasArgs, hasNoArgs, isStringArg } from './util';

/**
* A Seismogram object.
* @param {Array} yArray array of Y sample values, ie the timeseries
* @param {number} sampleRate sample rate of the seismogram, hertz
* @param {moment} start start time of seismogrm as a momentjs moment in utc or a string that can be parsed
*/
export class Seismogram {
  /** Array of y values */
  y: Array<number>;
  /** the sample rate in hertz */
  sampleRate:number;
  /** @private */
  _start:moment;
  networkCode:string;
  stationCode:string;
  locationCode:string;
  channelCode:string;
  yUnit:string;
  constructor(yArray:Array<number>, sampleRate: number, start: moment) {
    this.y = yArray;
    this.sampleRate = sampleRate;
    this.start = checkStringOrDate(start);
    this.yUnit = 'count';
  }
  get start() :moment {
    return this._start;
  }
  set start(value: moment | string) {
    this._start = checkStringOrDate(value);
  }
  get end() :moment {
    return this.timeOfSample(this.numPoints-1);
  }
  get numPoints() :number {
    return this.y.length;
  }
  get netCode() :string {
    return this.networkCode;
  }
  get staCode() :string {
    return this.stationCode;
  }
  get locId() :string {
    return this.locationCode;
  }
  get locCode() :string {
    return this.locationCode;
  }
  get chanCode() :string {
    return this.channelCode;
  }
  yAtIndex(i: number) :number {
    return this.y[i];
  }

  timeOfSample(i:number ) :moment {
    return moment.utc(this.start).add(i/this.sampleRate, 'seconds');
  }
  codes() :string {
    return this.networkCode+"."+this.stationCode+"."+this.locationCode+"."+this.channelCode;
  }
  seisId() :string {
   return (this.codes()+"_"+this.start.toISOString()+"_"+this.end.toISOString()).replace(/\./g,'_').replace(/:/g,'');
  }
  clone():Seismogram {
    let out = new Seismogram(this.y.slice(),
                          this.sampleRate,
                          moment.utc(this._start));
    out.networkCode = this.networkCode;
    out.stationCode = this.stationCode;
    out.locationCode = this.locationCode;
    out.channelCode = this.channelCode;
    return out;
  }
}
