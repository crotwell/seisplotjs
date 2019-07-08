// @flow

import moment from 'moment';
import { checkStringOrDate } from './util';
import * as seedcodec from './seedcodec';


export type TimeRangeType = {
  duration: number,
  start: moment,
  end: moment
};

export type HighLowType = {
      xScaleDomain: Array<number>;
      xScaleRange: Array<number>;
      secondsPerPixel: number;
      samplesPerPixel: number;
      highlowArray: Array<number>;
};

/**
* A contiguous segment of a Seismogram.
* @param  yArray array of Y sample values, ie the timeseries
* @param  sampleRate sample rate of the seismogram, hertz
* @param  start start time of seismogrm as a momentjs moment in utc or a string that can be parsed
*/
export class SeismogramSegment {
  /** Array of y values */
  _y: null | Int32Array | Float32Array | Float64Array;
  _compressed: null | Array<seedcodec.EncodedDataSegment>;
  /**  @private the sample rate in hertz */
  _sampleRate: number;
  /** @private */
  _start: moment;
  _end_cache: null | moment;
  _end_cache_numPoints: number;
  networkCode: string;
  stationCode: string;
  locationCode: string;
  channelCode: string;
  yUnit: string;
  _highlow: HighLowType;
  constructor(yArray: Array<seedcodec.EncodedDataSegment> | Int32Array | Float32Array | Float64Array, sampleRate: number, start: moment) {
    if (yArray instanceof Int32Array || yArray instanceof Float32Array || yArray instanceof Float64Array) {
      this._y = yArray;
      this._compressed = null;
    } else if (Array.isArray(yArray) && yArray.every( ee => ee instanceof seedcodec.EncodedDataSegment)) {
        this._compressed = yArray;
        this._y = null;
    } else if (Array.isArray(yArray) && yArray.every( ee => typeof ee === 'number')) {
      // numbers in js are 64bit, so...
      this._y = Float64Array.from(((yArray: any):Array<number>));
      this._compressed = null;
    }
    this._sampleRate = sampleRate;
    this._start = checkStringOrDate(start);
    this.yUnit = 'count';
    // to avoid recalc of end time as it is kind of expensive
    this._end_cache = null;
    this._end_cache_numPoints = 0;
  }
  /** Y data of the seismogram. Decompresses data if needed.
  */
  get y(): Int32Array | Float32Array | Float64Array {
    let out;
    if (this._y) {
      out = this._y;
    } else {
      if ( ! this.isEncoded()) {
        throw new Error("Seismogram not y as TypedArray or encoded.");
      }
      // data is still compressed
      let outLen = this.numPoints;

      if ( this._compressed === null) {
        // for flow
        throw new Error("Seismogram not y as TypedArray or encoded.");
      }
      if (this._compressed[0].compressionType === seedcodec.DOUBLE) {
        out = new Float64Array(outLen);
      } else if (this._compressed[0].compressionType === seedcodec.FLOAT) {
        out = new Float32Array(outLen);
      } else {
        out = new Int32Array(outLen);
      }
      let currIdx = 0;
      for (let c of this._compressed) {
        const cData = c.decode();
        for (let i=0; i<c.numSamples; i++) {
          out[currIdx+i] = cData[i];
        }
        currIdx += c.numSamples;
      }
      this._y = out;
      this._compressed = null;
    }
    return out;
  }
  set y(value: Int32Array | Float32Array | Float64Array) {
    this._y = value;
    this._invalidate_end_cache();
  }
  get start(): moment {
    return this._start;
  }
  set start(value: moment | string) {
    this._start = checkStringOrDate(value);
    this._invalidate_end_cache();
  }
  get end(): moment {
    if ( ! this._end_cache || this._end_cache_numPoints !== this.numPoints) {
      // array length modified, recalc cached end time
      this._end_cache_numPoints = this.numPoints;
      this._end_cache = this.timeOfSample(this._end_cache_numPoints-1);
    }
    return this._end_cache;
  }
  get sampleRate() {
    return this._sampleRate;
  }
  set sampleRate(value: number) {
    this._sampleRate = value;
    this._invalidate_end_cache();
  }
  get numPoints(): number {
    let out = 0;
    if (this._y) {
      out = this._y.length;
    } else if (this._compressed) {
      for (let c of this._compressed) {
        out += c.numSamples;
      }
    }
    return out;
  }
  get netCode(): string {
    return this.networkCode;
  }
  get staCode(): string {
    return this.stationCode;
  }
  get locId(): string {
    return this.locationCode;
  }
  get locCode(): string {
    return this.locationCode;
  }
  get chanCode(): string {
    return this.channelCode;
  }
  isEncoded(): boolean {
    if (this._y && this._y.length > 0) {
      return false;
    } else if (this._compressed && this._compressed.length > 0) {
      return true;
    } else {
      return false;
    }
  }
  getEncoded(): Array<seedcodec.EncodedDataSegment> {
    if (this.isEncoded()) {
      return ((this._compressed: any): Array<seedcodec.EncodedDataSegment>);
    } else {
      throw new Error("Data is not encoded.");
    }
  }
  yAtIndex(i: number): number {
    return this.y[i];
  }
  /** Finds the min and max values of a SeismogramSegment, with an optional
    * accumulator for use with gappy data. */
  findMinMax(minMaxAccumulator?: Array<number>): Array<number> {
    let minAmp = Number.MAX_SAFE_INTEGER;
    let maxAmp = -1 * (minAmp);
    if ( minMaxAccumulator) {
      minAmp = minMaxAccumulator[0];
      maxAmp = minMaxAccumulator[1];
    }
    let yData = ((this.y: any): Array<number>); // for flow
    for (let n = 0; n < yData.length; n++) {
      if (minAmp > yData[n]) {
        minAmp = yData[n];
      }
      if (maxAmp < yData[n]) {
        maxAmp = yData[n];
      }
    }
    return [ minAmp, maxAmp ];
  }
  timeOfSample(i: number ): moment {
    return moment.utc(this.start).add(i/this.sampleRate, 'seconds');
  }
  /** @return nslc codes separated by '.'
  */
  codes(): string {
    return this.networkCode+"."+this.stationCode+"."+this.locationCode+"."+this.channelCode;
  }
  seisId(): string {
   return (this.codes()+"_"+this.start.toISOString()+"_"+this.end.toISOString()).replace(/\./g,'_').replace(/:/g,'');
  }
  clone(): SeismogramSegment {
    let clonedData = this._y;
    if (clonedData !== null) {
      clonedData = clonedData.slice();
    } else if (this.isEncoded()) {
      // shallow copy array, assume Encoded is immutable
      clonedData = Array.from(this.getEncoded());
    } else {
      throw new Error("no _y and no _compressed");
    }
    return this.cloneWithNewData(clonedData);
  }

  cloneWithNewData(clonedData: Array<seedcodec.EncodedDataSegment> | Int32Array | Float32Array | Float64Array): SeismogramSegment {
    let out = new SeismogramSegment(clonedData,
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
    if (trimEnd.isBefore(this._start) || trimStart.isAfter(this.end)) {
      return null;
    }
    let sIndex = 0;
    if (trimStart.isAfter(this._start)) {
      let milliDiff = trimStart.diff(this._start);
      let offset = milliDiff * this.sampleRate /1000.0;
      sIndex = Math.floor(offset);
    }
    let eIndex = 0;
    if (trimEnd.isBefore(this.end)) {
      let milliDiff = moment.utc(this.end).diff(trimEnd);
      let offset = milliDiff * this.sampleRate /1000.0;
      eIndex = this.y.length - Math.floor(offset);
    }
    let trimY = this.y.slice(sIndex, eIndex);

    let out = new SeismogramSegment(trimY,
                          this.sampleRate,
                          moment.utc(this._start).add(sIndex / this.sampleRate, 'seconds'));
    out.networkCode = this.networkCode;
    out.stationCode = this.stationCode;
    out.locationCode = this.locationCode;
    out.channelCode = this.channelCode;
    out.yUnit = this.yUnit;
    return out;
  }
  _invalidate_end_cache() {
    this._end_cache = null;
    this._end_cache_numPoints = 0;
  }
}

/** Represents time window for a single channel that may
  * contain gaps or overlaps, but is otherwise more or less
  * continuous, or at least adjacent data from the channel.
  * Each segment within
  * the Seismogram will have the same units, channel identifiers
  * and sample rate, but cover different times. */
export class Seismogram {
  _segmentArray: Array<SeismogramSegment>;
  _start: moment;
  _end: moment;
  _y: null | Int32Array | Float32Array | Float64Array;
  constructor(segmentArray: SeismogramSegment | Array<SeismogramSegment>) {
    this._y = null;
    if ( Array.isArray(segmentArray) && segmentArray[0] instanceof SeismogramSegment) {
      this._segmentArray = segmentArray;
    } else if ( segmentArray instanceof SeismogramSegment) {
      this._segmentArray = [ segmentArray ];
    } else {
      throw new Error("segmentArray is not Array<SeismogramSegment> or SeismogramSegment");
    }
    this.checkAllSimilar();
    this.findStartEnd();
  }
  checkAllSimilar() {
    if (this._segmentArray.length === 0) {throw new Error("Seismogram is empty");}
    let f = this._segmentArray[0];
    this._segmentArray.forEach((s, i) => {
      if (! s) {
        throw new Error(`index ${i} is null in trace`);
      }
      this.checkSimilar(f, s);
    });
  }
  checkSimilar(f: SeismogramSegment, s: SeismogramSegment) {
    if (s.networkCode !== f.networkCode) {throw new Error("NetworkCode not same: "+s.networkCode+" !== "+f.networkCode);}
    if (s.stationCode !== f.stationCode) {throw new Error("StationCode not same: "+s.stationCode+" !== "+f.stationCode);}
    if (s.locationCode !== f.locationCode) {throw new Error("LocationCode not same: "+s.locationCode+" !== "+f.locationCode);}
    if (s.channelCode !== f.channelCode) {throw new Error("ChannelCode not same: "+s.channelCode+" !== "+f.channelCode);}
    if (s.yUnit !== f.yUnit) {throw new Error("yUnit not same: "+s.yUnit+" !== "+f.yUnit);}
    if (s.sampleRate !== f.sampleRate) {throw new Error("SampleRate not same: "+s.sampleRate+" !== "+f.sampleRate);}
  }
  findStartEnd() {
    let allStart = this._segmentArray.map(seis => {
      return moment.utc(seis.start);
    });
    this._start = moment.min(allStart);
    let allEnd = this._segmentArray.map(seis => {
      return moment.utc(seis.end);
    });
    this._end = moment.max(allEnd);
  }
  findMinMax(minMaxAccumulator?: Array<number>): Array<number> {
    if (this._segmentArray.length === 0) {
      throw new Error("No data");
    }
    for (let s of this._segmentArray) {
      minMaxAccumulator = s.findMinMax(minMaxAccumulator);
    }
    if (minMaxAccumulator){
      return minMaxAccumulator;
    } else {
      // should never happen, for flow
      throw new Error("No data to calc minmax");
    }
  }

  get start(): moment {
    return this._start;
  }
  get end(): moment {
    return this._end;
  }
  get networkCode(): string {
    return this._segmentArray[0].networkCode;
  }
  get stationCode(): string {
    return this._segmentArray[0].stationCode;
  }
  get locationCode(): string {
    return this._segmentArray[0].locationCode;
  }
  get channelCode(): string {
    return this._segmentArray[0].channelCode;
  }
  get sampleRate(): number {
    return this._segmentArray[0].sampleRate;
  }
  get yUnit(): string {
    return this._segmentArray[0].yUnit;
  }
  get numPoints(): number {
    return this._segmentArray.reduce((accumulator, seis) => accumulator + seis.numPoints, 0);
  }
  codes(): string {
    return this._segmentArray[0].codes();
  }
  get segments(): Array<SeismogramSegment> {
    return this._segmentArray;
  }
  append(seismogram: SeismogramSegment) {
    this.checkSimilar(this._segmentArray[0], seismogram);
    this._start = moment.min([ this.start, moment.utc(seismogram.start)]);
    this._end = moment.max([ this.end, moment.utc(seismogram.end)]);
    this._segmentArray.push(seismogram);
  }
  /**
    * Creates a new Seismogram composed of all seismogram segments that overlap the
    * given time window. If none do, this returns null;
    */
  trim(timeWindow: TimeRangeType): null | Seismogram {
    let out = null;
    if (this._segmentArray) {
      let trimSeisArray = this._segmentArray.filter(function(d) {
        return d.end.isAfter(timeWindow.start);
      }).filter(function(d) {
        return d.start.isBefore(timeWindow.end);
      });
      if (trimSeisArray.length > 0) {
        out = new Seismogram(trimSeisArray);
      }
    }
    return out;
  }
  break(duration: moment.Duration) {
    if (this._segmentArray) {
      let breakStart = moment.utc(this.start);
      let out = [];
      while (breakStart.isBefore(this.end)) {
        let breakEnd = moment.utc(breakStart).add(duration);
        let trimSeisArray = this._segmentArray.map(function(seis) {
          return seis.clone().trim(breakStart, breakEnd);
        });
        out = out.concat(trimSeisArray);
        breakStart.add(duration);
      }
      // check for null
      out = out.filter(function(seis) { return seis;});
      this._segmentArray = out;
    }
    return this;
  }
  isContiguous() {
    if (this._segmentArray.length === 1) {
      return true;
    }
    let prev = null;
    for (const s of this._segmentArray) {
      if (prev && ! (prev.end.isBefore(s.start)
          && prev.end.add(1000*1.5/prev.sampleRate, 'ms').isAfter(s.start))) {
        return false;
      }
      prev = s;
    }
    return true;
  }
  merge(): Int32Array | Float32Array | Float64Array {
    let outArray;
    if (this._segmentArray[0].y instanceof Int32Array) {
      outArray = new Int32Array(this.numPoints);
    } else if (this._segmentArray[0].y instanceof Float32Array) {
      outArray = new Float32Array(this.numPoints);
    } else if (this._segmentArray[0].y instanceof Float64Array) {
      outArray = new Float64Array(this.numPoints);
    } else {
      throw new Error(`data not one of Int32Array, Float32Array or Float64Array: ${this._segmentArray[0].y.constructor.name}`);
    }
    let i=0;
    this._segmentArray.forEach( seg => {
      for(let v of seg.y) {
        outArray[i] = v;
        i++;
      }
    });
    return outArray;
  }
  /**
   * Gets the timeseries as an array of number if it is contiguous.
   * @throws {NonContiguousData} if data is not contiguous.
   * @return  timeseries as array of number
   */
  get y(): Int32Array | Float32Array | Float64Array {
    if ( ! this._y) {
      if (this.isContiguous()) {
        this._y = this.merge();
      } else {
        throw new Error("Seismogram is not contiguous, acces each SeismogramSegment idividually.");
      }
    }
    return this._y;
  }
  set y(val: Array<number>) {
    // ToDo
    throw new Error("seismogram y setter not impl yet");
  }
  clone(): Seismogram {
    let cloned = this._segmentArray.map( s => s.clone());
    return new Seismogram(cloned);
  }

  cloneWithNewData(newY: Int32Array | Float32Array | Float64Array): Seismogram {
    if (newY && newY.length > 0) {
      let seg = this._segmentArray[0].cloneWithNewData(newY);
      return new Seismogram([seg]);
    } else {
      throw new Error("Y value is empty");
    }
  }
  /** factory method to create a single segment Seismogram from either encoded data
   *  or a TypedArray, along with sample rate and start time.
  */
  static createFromContiguousData(yArray: Array<seedcodec.EncodedDataSegment> | Int32Array | Float32Array | Float64Array, sampleRate: number, start: moment) {
    const seg = new SeismogramSegment(yArray, sampleRate, start);
    return new Seismogram([seg]);
  }
}

export class NonContiguousData extends Error {
  constructor(message?: string) {
    super(message);
    this.name = this.constructor.name;
  }
}
export function ensureIsSeismogram(seisSeismogram: Seismogram | SeismogramSegment) {
  if (typeof seisSeismogram === "object") {
    if (seisSeismogram instanceof Seismogram) {
      return seisSeismogram;
    } else if (seisSeismogram instanceof SeismogramSegment) {
      return new Seismogram([ seisSeismogram ]);
    } else {
      let s = typeof seisSeismogram;
      if (seisSeismogram.prototype && seisSeismogram.prototype.constructor) {
        s += " "+seisSeismogram.prototype.constructor.name;
      } else {
        s += " "+seisSeismogram;
      }
      throw new Error("must be Seismogram or SeismogramSegment but "+s);
    }
  } else {
    throw new Error("must be Seismogram or SeismogramSegment but not an object");
  }
}


export function findStartEnd(data: Array<Seismogram>, accumulator?: TimeRangeType): TimeRangeType {
  let out: TimeRangeType;
  if ( ! accumulator && ! data) {
    throw new Error("data and accumulator are not defined");
  } else if ( ! accumulator) {
    out = {start: moment.utc('2500-01-01'), end: moment.utc('1001-01-01'), duration: 0 };
  } else {
    out = accumulator;
  }
  if ( Array.isArray(data)) {
    for (let s of data) {
      if ( s.start < out.start) {
        out.start = s.start;
      }
      if ( out.end < s.end ) {
        out.end = s.end;
      }
    }
  } else {
    throw new Error(`Expected Array as first arg but was: ${typeof data}`);
  }
  return out;
}


export function findMinMax(data: Array<Seismogram> , minMaxAccumulator ?: Array<number>): Array<number> {
  for(let s of data) {
    minMaxAccumulator = s.findMinMax(minMaxAccumulator);
  }
  if (minMaxAccumulator) {
    return minMaxAccumulator;
  } else {
    return [-1, 1];
  }
}
