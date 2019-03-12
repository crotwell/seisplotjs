// @flow

import { moment, checkStringOrDate, hasArgs, hasNoArgs, isStringArg } from './util';
import * as miniseed from '../miniseed';

/**
* A Seismogram object.
* @param {Array} yArray array of Y sample values, ie the timeseries
* @param {number} sampleRate sample rate of the seismogram, hertz
* @param {moment} start start time of seismogrm as a momentjs moment in utc or a string that can be parsed
*/
export class Seismogram {
  /** Array of y values */
  _y: Array<number>;
  _compressed: Array<miniseed.DataRecord>;
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
    if (yArray.length > 0 && yArray[0] instanceof miniseed.DataRecord) {
      this._compressed = yArray;
      this._y = null;
    } else {
      this._compressed = null;
      this._y = yArray;
    }
    this.sampleRate = sampleRate;
    this.start = checkStringOrDate(start);
    this.yUnit = 'count';
  }
  get y() {
    if ( ! this._y && this._compressed) {
      let out = [];
      for (let i=0; i<this._compressed.length; i++) {
        out = out.concat(this._compressed[i].decompress());
      }
      this._y = out;
      this._compressed = null;
    }
    return this._y;
  }
  set y(value) {
    this._y = value;
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
    out.yUnit = this.yUnit;
    return out;
  }
  trim(trimStart: moment, trimEnd: moment) {
    if (trimEnd.isBefore(this._start) || trimStart.isAfter(this._end)) {
      return null;
    }
    let sIndex = 0;
    if (trimStart.isAfter(this._start)) {
      let milliDiff = trimStart.diff(this._start);
      let offset = milliDiff * this.sampleRate /1000.0;
      sIndex = Math.floor(offset);
    }
    let eIndex = 0;
    if (trimEnd.isBefore(this._end)) {
      let milliDiff = moment.utc(this._end).diff(trimEnd);
      let offset = milliDiff * this.sampleRate /1000.0;
      eIndex = this.y.length - Math.floor(offset);
    }
    let newY = this.y.slice(sIndex, eIndex);

    let out = new Seismogram(newY,
                          this.sampleRate,
                          moment.utc(this._start).add(sIndex / this.sampleRate, 'seconds'));
    out.networkCode = this.networkCode;
    out.stationCode = this.stationCode;
    out.locationCode = this.locationCode;
    out.channelCode = this.channelCode;
    return out;
  }
}

/** Represents time window for a single channel that may
  * contain gaps or overlaps, but is otherwise more or less
  * continuous, or at least adjacent data from the channel.
  * Each segment within
  * the Trace will have the same units, channel identifiers
  * and sample rate, but cover different times. */
export class Trace {
  seisArray: Array<Seismogram>;
  constructor(seisArray: Seismogram | Array<Seismogram>) {
    if ( Array.isArray(seisArray)) {
      this.seisArray = seisArray;
    } else if ( seisArray instanceof Seismogram) {
      this.seisArray = [ seisArray ];
    } else {
      throw new Error("seisArray is not Array");
    }
    this.checkAllSimilar();
    this.findStartEnd();
  }
  checkAllSimilar() {
    if (this.seisArray.length == 0) {throw new Error("Trace is empty");}
    let f = this.seisArray[0];
    this.seisArray.forEach((s, i) => {
      if (! s) {
        throw new Error(`index ${i} is null in trace`);
      }
      this.checkSimilar(f, s);
    });
  }
  checkSimilar(f, s) {
    if (s.networkCode !== f.networkCode) {throw new Error("NetworkCode not same: "+s.networkCode+" !== "+f.networkCode);}
    if (s.stationCode !== f.stationCode) {throw new Error("StationCode not same: "+s.stationCode+" !== "+f.stationCode);}
    if (s.locationCode !== f.locationCode) {throw new Error("LocationCode not same: "+s.locationCode+" !== "+f.locationCode);}
    if (s.channelCode !== f.channelCode) {throw new Error("ChannelCode not same: "+s.channelCode+" !== "+f.channelCode);}
    if (s.yUnit !== f.yUnit) {throw new Error("yUnit not same: "+s.yUnit+" !== "+f.yUnit);}
    if (s.sampleRate !== f.sampleRate) {throw new Error("SampleRate not same: "+s.sampleRate+" !== "+f.sampleRate);}
  }
  findStartEnd() {
    let allStart = this.seisArray.map(seis => {
      return moment.utc(seis.start);
    });
    this.start = moment.min(allStart);
    let allEnd = this.seisArray.map(seis => {
      return moment.utc(seis.end);
    });
    this.end = moment.max(allEnd);
  }

  get networkCode() :string {
    return this.seisArray[0].networkCode;
  }
  get stationCode() :string {
    return this.seisArray[0].stationCode;
  }
  get locationCode() :string {
    return this.seisArray[0].locationCode;
  }
  get channelCode() :string {
    return this.seisArray[0].channelCode;
  }
  get sampleRate() :string {
    return this.seisArray[0].sampleRate;
  }
  get yUnit() :string {
    return this.seisArray[0].yUnit;
  }
  get numPoints() :number {
    return this.seisArray.reduce((accumulator, seis) => accumulator + seis.numPoints, 0);
  }
  codes() :string {
    return this.seisArray[0].codes();
  }
  get segments() : Array<Seismogram> {
    return this.seisArray;
  }
  append(seismogram) {
    this.checkSimilar(this.seisArray[0], seismogram);
    this.start = moment.min([ this.start, moment.utc(seismogram.start)]);
    this.end = moment.max([ this.end, moment.utc(seismogram.end)]);
    this.seisArray.push(seismogram);
  }
  /**
    * Creates a new Trace composed of all seismogram segments that overlap the
    * given time window. If none do, this returns null;
    */
  trim(timeWindow: TimeRangeType) :Trace {
    let out = null;
    if (this.seisArray) {
      let trimSeisArray = this.seisArray.filter(function(d) {
        return d.end.isAfter(timeWindow.start);
      }).filter(function(d) {
        return d.start.isBefore(timeWindow.end);
      });
      if (trimSeisArray.length > 0) {
        out = new Trace(trimSeisArray);
      }
    }
    return out;
  }
  break(duration: moment.Duration) {
    if (this.seisArray) {
      let breakStart = moment.utc(this.start);
      let out = [];
      while (breakStart.isBefore(this.end)) {
        let breakEnd = moment.utc(breakStart).add(duration);
        let trimSeisArray = this.seisArray.map(function(seis) {
          return seis.clone().trim(breakStart, breakEnd);
        });
        out = out.concat(trimSeisArray);
        breakStart.add(duration);
      }
      // check for null
      out = out.filter(function(seis) { return seis;})
      this.seisArray = out;
    }
    return this;
  }
  merge() {
    return this.seisArray.reduce((acc, s) => {
                return acc.concat(s.y);
              }, []);
  }
}

export function ensureIsTrace(seisTrace :Trace | Seismogram) {
  if (typeof seisTrace === "object") {
    if (seisTrace instanceof Trace) {
      return seisTrace;
    } else if (seisTrace instanceof Seismogram) {
      return new Trace([ seisTrace ]);
    } else {
      let s = typeof seisTrace;
      if (seisTrace.prototype && seisTrace.prototype.constructor) {
        s += " "+seisTrace.prototype.constructor.name;
      } else {
        s += " "+seisTrace;
      }
      throw new Error("must be Trace or Seismogram but "+s)
    }
  } else {
    throw new Error("must be Trace or Seismogram but not an object");
  }
}
