/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */
import moment from "moment";
import {checkStringOrDate, meanOfSlice, isDef, stringify} from "./util";
import * as seedcodec from "./seedcodec";
import {distaz, DistAzOutput} from "./distaz";
import {Channel, InstrumentSensitivity} from "./stationxml";
import {Quake} from "./quakeml";
import {StartEndDuration} from "./util";
import type {TraveltimeJsonType, TraveltimeArrivalType} from "./traveltime";
export const COUNT_UNIT = "count";
export type HighLowType = {
  xScaleDomain: Array<Date>;
  xScaleRange: Array<number>;
  secondsPerPixel: number;
  samplesPerPixel: number;
  highlowArray: Array<number>;
};
export type MarkerType = {
  name: string;
  time: moment.Moment;
  type: string;
  description: string;
  link?: string;
};

/**
 * A contiguous segment of a Seismogram.
 *
 * @param  yArray array of Y sample values, ie the timeseries
 * @param  sampleRate sample rate of the seismogram, hertz
 * @param  startTime start time of seismogrm as a momentjs moment in utc or a string that can be parsed
 */
export class SeismogramSegment {
  /** Array of y values */
  _y: null | Int32Array | Float32Array | Float64Array;
  _compressed: null | Array<seedcodec.EncodedDataSegment>;

  /**
   * the sample rate in hertz
   *
   * @private
   */
  _sampleRate: number;

  /** @private */
  _startTime: moment.Moment;
  _endTime_cache: null | moment.Moment;
  _endTime_cache_numPoints: number;
  networkCode: string|null = null;
  stationCode: string|null = null;
  locationCode: string|null = null;
  channelCode: string|null = null;
  yUnit: string;
  _highlow: HighLowType|undefined;

  constructor(
    yArray:
      | Array<seedcodec.EncodedDataSegment>
      | Int32Array
      | Float32Array
      | Float64Array,
    sampleRate: number,
    startTime: moment.Moment,
  ) {
    if (
      yArray instanceof Int32Array ||
      yArray instanceof Float32Array ||
      yArray instanceof Float64Array
    ) {
      this._y = yArray;
      this._compressed = null;
    } else if (
      Array.isArray(yArray) &&
      yArray.every(ee => ee instanceof seedcodec.EncodedDataSegment)
    ) {
      this._compressed = yArray;
      this._y = null;
    } else if (
      Array.isArray(yArray) &&
      yArray.every(ee => typeof ee === "number")
    ) {
      // numbers in js are 64bit, so...
      this._y = Float64Array.from((yArray as any) as Array<number>);
      this._compressed = null;
    } else {
      this._compressed = null;
      this._y = null;
    }

    if (sampleRate <= 0) {
      throw new Error(`SampleRate must be positive number: ${sampleRate}`);
    }
    this._sampleRate = sampleRate;
    this._startTime = checkStringOrDate(startTime);
    this.yUnit = COUNT_UNIT;
    // to avoid recalc of end time as it is kind of expensive
    this._endTime_cache = null;
    this._endTime_cache_numPoints = 0;
  }

  /**
   * Y data of the seismogram. Decompresses data if needed.
   *
   * @returns y data as typed array
   */
  get y(): Int32Array | Float32Array | Float64Array {
    let out;

    if (this._y) {
      out = this._y;
    } else {
      if (!this.isEncoded()) {
        throw new Error("Seismogram not y as TypedArray or encoded.");
      }

      // data is still compressed
      let outLen = this.numPoints;

      if (this._compressed === null) {
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

        for (let i = 0; i < c.numSamples; i++) {
          out[currIdx + i] = cData[i];
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

    this._invalidate_endTime_cache();
  }

  get start(): moment.Moment {
    return this.startTime;
  }

  set start(value: moment.Moment | string) {
    this.startTime = value;
  }

  get startTime(): moment.Moment {
    return this._startTime;
  }

  set startTime(value: moment.Moment | string) {
    this._startTime = checkStringOrDate(value);

    this._invalidate_endTime_cache();
  }

  get end(): moment.Moment {
    return this.endTime;
  }

  get endTime(): moment.Moment {
    if (
      !this._endTime_cache ||
      this._endTime_cache_numPoints !== this.numPoints
    ) {
      // array length modified, recalc cached end time
      this._endTime_cache_numPoints = this.numPoints;
      this._endTime_cache = this.timeOfSample(
        this._endTime_cache_numPoints - 1,
      );
    }

    return this._endTime_cache;
  }

  /**
   * @deprecated
   */
  get timeWindow(): StartEndDuration {
    return this.timeRange;
  }

  get timeRange(): StartEndDuration {
    return new StartEndDuration(this.startTime, this.endTime);
  }

  get sampleRate(): number {
    return this._sampleRate;
  }

  set sampleRate(value: number) {
    this._sampleRate = value;

    this._invalidate_endTime_cache();
  }

  get samplePeriod(): number {
    return 1.0/this.sampleRate;
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

  get netCode(): string|null {
    return this.networkCode;
  }

  get staCode(): string|null {
    return this.stationCode;
  }

  get locId(): string|null {
    return this.locationCode;
  }

  get locCode(): string|null {
    return this.locationCode;
  }

  get chanCode(): string|null {
    return this.channelCode;
  }

  /**
   * Checks if the data is encoded
   *
   * @returns true if encoded, false otherwise
   */
  isEncoded(): boolean {
    if (this._y && this._y.length > 0) {
      return false;
    } else if (this._compressed && this._compressed.length > 0) {
      return true;
    } else {
      return false;
    }
  }

  /**
   * Gets encoded data, if it is.
   *
   * @returns array of encoded data segments
   * @throws Error if data is not encoded
   */
  getEncoded(): Array<seedcodec.EncodedDataSegment> {
    if (this.isEncoded()) {
      return (this._compressed as any) as Array<seedcodec.EncodedDataSegment>;
    } else {
      throw new Error("Data is not encoded.");
    }
  }

  yAtIndex(i: number): number {
    return this.y[i];
  }

  /**
   * Finds the min and max values of a SeismogramSegment, with an optional
   * accumulator for use with gappy data.
   *
   * @param minMaxAccumulator optional initialized accumulator as an array
   * of two numbers, min and max
   * @returns min, max as arry of length two
   */
  findMinMax(minMaxAccumulator?: Array<number>): Array<number> {
    let minAmp = Number.MAX_SAFE_INTEGER;
    let maxAmp = -1 * minAmp;

    if (minMaxAccumulator) {
      minAmp = minMaxAccumulator[0];
      maxAmp = minMaxAccumulator[1];
    }

    let yData = this.y;

    for (let n = 0; n < yData.length; n++) {
      if (minAmp > yData[n]) {
        minAmp = yData[n];
      }

      if (maxAmp < yData[n]) {
        maxAmp = yData[n];
      }
    }

    return [minAmp, maxAmp];
  }

  timeOfSample(i: number): moment.Moment {
    return moment.utc(this.startTime).add(i / this.sampleRate, "seconds");
  }

  indexOfTime(t: moment.Moment): number {
    if (
      t.isBefore(this.startTime) ||
      t.isAfter(moment.utc(this.endTime).add(1 / this.sampleRate, "seconds"))
    ) {
      return -1;
    }

    return Math.round((t.diff(this.startTime) * this.sampleRate) / 1000);
  }

  get hasCodes(): boolean {
    return (
      isDef(this.networkCode) ||
      isDef(this.stationCode) ||
      isDef(this.locationCode) ||
      isDef(this.channelCode)
    );
  }

  /**
   * return network, station, location and channels codes as one string.
   * Uses this.channel if it exists, this.seismogram if not.
   *
   * @returns nslc codes separated by '.'
   */
  get nslc(): string {
    return this.codes();
  }

  /**
   * return network, station, location and channels codes as one string
   *
   * @param sep separator, defaults to '.'
   * @returns nslc codes separated by sep
   */
  codes(sep: string = "."): string {
    return (
      (this.networkCode ? this.networkCode : "") +
      sep +
      (this.stationCode ? this.stationCode : "") +
      sep +
      (this.locationCode ? this.locationCode : "") +
      sep +
      (this.channelCode ? this.channelCode : "")
    );
  }

  seisId(): string {
    return (
      this.codes() +
      "_" +
      this.startTime.toISOString() +
      "_" +
      this.endTime.toISOString()
    )
      .replace(/\./g, "_")
      .replace(/:/g, "");
  }

  /**
   * return FDSN source id as a string.
   *
   * @returns FDSN source id
   */
  get sourceId(): string {
    const sep = "_";
    let band;
    let source;
    let subsource;
    let chanCode = (this.channelCode ? this.channelCode : "");
    if (chanCode.length === 3) {
      band = chanCode.charAt(0);
      source = chanCode.charAt(1);
      subsource = chanCode.charAt(2);
    } else {
      let items = chanCode.split(sep);
      band = items[0];
      source = items[1];
      subsource = items[2];
    }

    return (
      "FDSN:" +
      (this.networkCode ? this.networkCode : "") +
      sep +
      (this.stationCode ? this.stationCode : "") +
      sep +
      (this.locationCode ? this.locationCode : "") +
      sep +
      band +
      sep +
      source +
      sep +
      subsource
    );
  }


  clone(): SeismogramSegment {
    let out: SeismogramSegment;
    if (isDef(this._y)) {
      out = this.cloneWithNewData(this._y.slice());
    } else if (this.isEncoded()) {
      // shallow copy array, assume Encoded is immutable
      out = this.cloneWithNewData(Array.from(this.getEncoded()));
    } else {
      throw new Error("no _y and no _compressed");
    }
    return out;
  }

  cloneWithNewData(
    clonedData:
      | Array<seedcodec.EncodedDataSegment>
      | Int32Array
      | Float32Array
      | Float64Array,
    clonedStartTime: moment.Moment = this._startTime,
  ): SeismogramSegment {
    let out = new SeismogramSegment(
      clonedData,
      this.sampleRate,
      moment.utc(clonedStartTime),
    );
    out.networkCode = this.networkCode;
    out.stationCode = this.stationCode;
    out.locationCode = this.locationCode;
    out.channelCode = this.channelCode;
    out.yUnit = this.yUnit;
    return out;
  }

  cut(timeRange: StartEndDuration): SeismogramSegment | null {
    if (
      timeRange.endTime.isBefore(this._startTime) ||
      timeRange.startTime.isAfter(this.endTime)
    ) {
      return null;
    }

    let sIndex = 0;

    if (timeRange.startTime.isAfter(this._startTime)) {
      let milliDiff = timeRange.startTime.diff(this._startTime);
      let offset = (milliDiff * this.sampleRate) / 1000.0;
      sIndex = Math.floor(offset);
    }

    let eIndex = this.y.length;

    if (timeRange.endTime.isBefore(this.endTime)) {
      let milliDiff = moment.utc(this.endTime).diff(timeRange.endTime);
      let offset = (milliDiff * this.sampleRate) / 1000.0;
      eIndex = this.y.length - Math.floor(offset);
    }

    let cutY = this.y.slice(sIndex, eIndex);
    let out = this.cloneWithNewData(
      cutY,
      moment.utc(this._startTime).add(sIndex / this.sampleRate, "seconds"),
    );
    return out;
  }

  _invalidate_endTime_cache() {
    this._endTime_cache = null;
    this._endTime_cache_numPoints = 0;
  }
}

/**
 * Represents time window for a single channel that may
 * contain gaps or overlaps, but is otherwise more or less
 * continuous, or at least adjacent data from the channel.
 * Each segment within
 * the Seismogram will have the same units, channel identifiers
 * and sample rate, but cover different times.
 */
export class Seismogram {
  _segmentArray: Array<SeismogramSegment>;
  _startTime: moment.Moment;
  _endTime: moment.Moment;
  _y: null | Int32Array | Float32Array | Float64Array;

  constructor(segmentArray: SeismogramSegment | Array<SeismogramSegment>) {
    this._y = null;

    if (
      Array.isArray(segmentArray) &&
      segmentArray[0] instanceof SeismogramSegment
    ) {
      this._segmentArray = segmentArray;
    } else if (segmentArray instanceof SeismogramSegment) {
      this._segmentArray = [segmentArray];
    } else {
      throw new Error(
        `segmentArray is not Array<SeismogramSegment> or SeismogramSegment: ${stringify(
          segmentArray,
        )}`,
      );
    }

    this.checkAllSimilar();
    [this._startTime, this._endTime] = this.findStartEnd();
  }

  checkAllSimilar() {
    if (this._segmentArray.length === 0) {
      throw new Error("Seismogram is empty");
    }

    let f = this._segmentArray[0];

    this._segmentArray.forEach((s, i) => {
      if (!s) {
        throw new Error(`index ${i} is null in trace`);
      }

      this.checkSimilar(f, s);
    });
  }

  checkSimilar(f: SeismogramSegment, s: SeismogramSegment) {
    if (s.networkCode !== f.networkCode) {
      throw new Error(
        "NetworkCode not same: " + s.networkCode + " !== " + f.networkCode,
      );
    }

    if (s.stationCode !== f.stationCode) {
      throw new Error(
        "StationCode not same: " + s.stationCode + " !== " + f.stationCode,
      );
    }

    if (s.locationCode !== f.locationCode) {
      throw new Error(
        "LocationCode not same: " + s.locationCode + " !== " + f.locationCode,
      );
    }

    if (s.channelCode !== f.channelCode) {
      throw new Error(
        "ChannelCode not same: " + s.channelCode + " !== " + f.channelCode,
      );
    }

    if (s.yUnit !== f.yUnit) {
      throw new Error("yUnit not same: " + s.yUnit + " !== " + f.yUnit);
    }
  }

  findStartEnd(): [moment.Moment, moment.Moment] {
    let allStart = this._segmentArray.map(seis => {
      return moment.utc(seis.startTime);
    });

    let startTime = moment.min(allStart);

    let allEnd = this._segmentArray.map(seis => {
      return moment.utc(seis.endTime);
    });

    let endTime = moment.max(allEnd);
    return [startTime, endTime];
  }

  findMinMax(minMaxAccumulator?: Array<number>): Array<number> {
    if (this._segmentArray.length === 0) {
      throw new Error("No data");
    }

    for (let s of this._segmentArray) {
      minMaxAccumulator = s.findMinMax(minMaxAccumulator);
    }

    if (minMaxAccumulator) {
      return minMaxAccumulator;
    } else {
      // should never happen, for flow
      throw new Error("No data to calc minmax");
    }
  }

  /**
   * calculates the mean of a seismogrma.
   *
   * @returns       mean value
   */
  mean(): number {
    let meanVal = 0;
    let npts = this.numPoints;

    for (let s of this.segments) {
      meanVal += meanOfSlice(s.y, s.y.length) * s.numPoints;
    }

    meanVal = meanVal / npts;
    return meanVal;
  }

  get start(): moment.Moment {
    return this.startTime;
  }

  get startTime(): moment.Moment {
    return this._startTime;
  }

  get end(): moment.Moment {
    return this.endTime;
  }

  get endTime(): moment.Moment {
    return this._endTime;
  }

  get timeRange(): StartEndDuration {
    return new StartEndDuration(this.startTime, this.endTime);
  }

  get timeWindow(): StartEndDuration {
    return this.timeRange;
  }

  get networkCode(): string|null {
    return this._segmentArray[0].networkCode;
  }

  set networkCode(value: string|null) {
    this._segmentArray.forEach(s => (s.networkCode = value));
  }

  get stationCode(): string|null {
    return this._segmentArray[0].stationCode;
  }

  set stationCode(value: string|null) {
    this._segmentArray.forEach(s => (s.stationCode = value));
  }

  get locationCode(): string|null {
    return this._segmentArray[0].locationCode;
  }

  set locationCode(value: string|null) {
    this._segmentArray.forEach(s => (s.locationCode = value));
  }

  get channelCode(): string|null {
    return this._segmentArray[0].channelCode;
  }

  set channelCode(value: string|null) {
    this._segmentArray.forEach(s => (s.channelCode = value));
  }

  /**
   * return FDSN source id as a string.
   *
   * @returns FDSN source id
   */
  get sourceId(): string {
    return this._segmentArray[0].sourceId;
  }

  get sampleRate(): number {
    return this._segmentArray[0].sampleRate;
  }

  get samplePeriod(): number {
    return 1.0/this.sampleRate;
  }

  get yUnit(): string|null {
    return this._segmentArray[0].yUnit;
  }

  get numPoints(): number {
    return this._segmentArray.reduce(
      (accumulator, seis) => accumulator + seis.numPoints,
      0,
    );
  }

  get hasCodes(): boolean {
    return this._segmentArray[0].hasCodes;
  }

  /**
   * return network, station, location and channels codes as one string.
   * Uses this.channel if it exists, this.seismogram if not.
   *
   * @returns net.sta.loc.chan
   */
  get nslc(): string {
    return this.codes();
  }

  codes(): string {
    return this._segmentArray[0].codes();
  }

  get segments(): Array<SeismogramSegment> {
    return this._segmentArray;
  }

  append(seismogram: SeismogramSegment | Seismogram) {
    if (seismogram instanceof Seismogram) {
      seismogram._segmentArray.forEach(s => this.append(s));
    } else {
      this.checkSimilar(this._segmentArray[0], seismogram);
      this._startTime = moment.min([
        this.startTime,
        moment.utc(seismogram.startTime),
      ]);
      this._endTime = moment.max([
        this.endTime,
        moment.utc(seismogram.endTime),
      ]);

      this._segmentArray.push(seismogram);
    }
  }

  /**
   * Cut the seismogram. Creates a new seismogram with all datapoints
   * contained in the time window.
   *
   * @param  timeRange start and end of cut
   * @returns            new seismogram
   */
  cut(timeRange: StartEndDuration): null | Seismogram {
    // coarse trim first
    let out = this.trim(timeRange);

    if (out && out._segmentArray) {
      let cutSeisArray = this._segmentArray
        .map(seg => seg.cut(timeRange))
        .filter(isDef);

      if (cutSeisArray.length > 0) {
        out = new Seismogram(cutSeisArray);
      } else {
        out = null;
      }
    } else {
      out = null;
    }

    return out;
  }

  /**
   * Creates a new Seismogram composed of all seismogram segments that overlap the
   * given time window. If none do, this returns null. This is a faster but coarser
   * version of cut as it only removes whole segments that do not overlap the
   * time window. For most seismograms that consist of a single contiguous
   * data segment, this will do nothing.
   *
   * @param timeRange time range to trim to
   * @returns seismogram if data in the window, null otherwise
   * @see cut
   */
  trim(timeRange: StartEndDuration): null | Seismogram {
    let out = null;

    if (this._segmentArray) {
      let trimSeisArray = this._segmentArray
        .filter(function (d) {
          return d.endTime.isSameOrAfter(timeRange.startTime);
        })
        .filter(function (d) {
          return d.startTime.isSameOrBefore(timeRange.endTime);
        });

      if (trimSeisArray.length > 0) {
        out = new Seismogram(trimSeisArray);
      }
    }

    return out;
  }

  break(duration: moment.Duration): void {
    if (this._segmentArray) {
      let breakStart = moment.utc(this.startTime);
      let out: Array<SeismogramSegment> = [];

      while (breakStart.isBefore(this.endTime)) {
        let breakWindow = new StartEndDuration(breakStart, null, duration);

        let cutSeisArray: Array<SeismogramSegment> =
          this._segmentArray.map(seg => seg.cut(breakWindow)).filter(isDef);

        out = out.concat(cutSeisArray);
        breakStart.add(duration);
      }

      // check for null, filter true if seg not null
      out = out.filter(isDef);
      this._segmentArray = out;
    }
  }

  isContiguous(): boolean {
    if (this._segmentArray.length === 1) {
      return true;
    }

    let prev = null;

    for (const s of this._segmentArray) {
      if (
        prev &&
        !(
          prev.endTime.isBefore(s.startTime) &&
          prev.endTime
            .add((1000 * 1.5) / prev.sampleRate, "ms")
            .isAfter(s.startTime)
        )
      ) {
        return false;
      }

      prev = s;
    }

    return true;
  }

  /**
   * Merges all segments into a single array of the same type as the first
   * segment. No checking is done for gaps or overlaps, this is a simple
   * congatination. Be careful!
   *
   * @returns contatenated data
   */
  merge(): Int32Array | Float32Array | Float64Array {
    let outArray;

    if (this._segmentArray[0].y instanceof Int32Array) {
      outArray = new Int32Array(this.numPoints);
    } else if (this._segmentArray[0].y instanceof Float32Array) {
      outArray = new Float32Array(this.numPoints);
    } else if (this._segmentArray[0].y instanceof Float64Array) {
      outArray = new Float64Array(this.numPoints);
    } else {
      throw new Error(
        `data not one of Int32Array, Float32Array or Float64Array: ${this._segmentArray[0].y}`,
      );
    }

    let i = 0;

    this._segmentArray.forEach(seg => {
      for (let v of seg.y) {
        outArray[i] = v;
        i++;
      }
    });

    return outArray;
  }

  /**
   * Gets the timeseries as an typed array if it is contiguous.
   *
   * @throws {NonContiguousData} if data is not contiguous.
   * @returns  timeseries as array of number
   */
  get y(): Int32Array | Float32Array | Float64Array {
    if (!this._y) {
      if (this.isContiguous()) {
        this._y = this.merge();
      }
    }

    if (this._y) {
      return this._y;
    } else {
      throw new Error(
        "Seismogram is not contiguous, acces each SeismogramSegment idividually.",
      );
    }
  }

  set y(val: Int32Array | Float32Array | Float64Array) {
    // ToDo
    throw new Error("seismogram y setter not impl, see cloneWithNewData()");
  }

  clone(): Seismogram {
    let cloned = this._segmentArray.map(s => s.clone());

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

  /**
   * factory method to create a single segment Seismogram from either encoded data
   *  or a TypedArray, along with sample rate and start time.
   *
   * @param yArray array of encoded data or typed array
   * @param sampleRate sample rate, samples per second of the data
   * @param startTime time of first sample
   * @returns seismogram initialized with the data
   */
  static createFromContiguousData(
    yArray:
      | Array<seedcodec.EncodedDataSegment>
      | Int32Array
      | Float32Array
      | Float64Array,
    sampleRate: number,
    startTime: moment.Moment,
  ): Seismogram {
    const seg = new SeismogramSegment(yArray, sampleRate, startTime);
    return new Seismogram([seg]);
  }
}
export class NonContiguousData extends Error {
  constructor(message?: string) {
    super(message);
    this.name = this.constructor.name;
  }
}
export function ensureIsSeismogram(
  seisSeismogram: Seismogram | SeismogramSegment,
): Seismogram {
  if (typeof seisSeismogram === "object") {
    if (seisSeismogram instanceof Seismogram) {
      return seisSeismogram;
    } else if (seisSeismogram instanceof SeismogramSegment) {
      return new Seismogram([seisSeismogram]);
    } else {
      throw new Error("must be Seismogram or SeismogramSegment but " + stringify(seisSeismogram));
    }
  } else {
    throw new Error(
      "must be Seismogram or SeismogramSegment but not an object: "+seisSeismogram,
    );
  }
}
export type ChannelCodeHolderType = {
  networkCode: string;
  stationCode: string;
  locationCode: string;
  channelCode: string;
};
export class SeismogramDisplayData {
  /** @private */
  _seismogram: Seismogram | null;
  _id: string | null;
  label: string | null;
  markerList: Array<MarkerType>;
  traveltimeList: Array<TraveltimeArrivalType>;
  channel: Channel | null;
  channelCodesHolder: ChannelCodeHolderType | null;
  _instrumentSensitivity: InstrumentSensitivity | null;
  quakeList: Array<Quake>;
  timeRange: StartEndDuration;
  alignmentTime: moment.Moment;
  doShow: boolean;
  _statsCache: SeismogramDisplayStats | null;

  constructor(timeRange: StartEndDuration) {
    if (!timeRange) {
      throw new Error("timeRange must not be missing.");
    }

    this._id = null;
    this._seismogram = null;
    this.label = null;
    this.markerList = [];
    this.traveltimeList = [];
    this.channel = null;
    this.channelCodesHolder = null;
    this._instrumentSensitivity = null;
    this.quakeList = [];
    this.timeRange = timeRange;
    this.alignmentTime = timeRange.start;
    this.doShow = true;
    this._statsCache = null;
  }

  static fromSeismogram(seismogram: Seismogram): SeismogramDisplayData {
    const out = new SeismogramDisplayData(
      new StartEndDuration(
        seismogram.startTime,
        seismogram.endTime,
        null,
        null,
      ),
    );
    out.seismogram = seismogram;
    return out;
  }

  static fromChannelAndTimeWindow(
    channel: Channel,
    timeRange: StartEndDuration,
  ): SeismogramDisplayData {
    if (!channel) {
      throw new Error("fromChannelAndTimeWindow, channel is undef");
    }

    const out = new SeismogramDisplayData(timeRange);
    out.channel = channel;
    return out;
  }

  static fromChannelAndTimes(
    channel: Channel,
    startTime: moment.Moment,
    endTime: moment.Moment,
  ): SeismogramDisplayData {
    const out = new SeismogramDisplayData(
      new StartEndDuration(startTime, endTime),
    );
    out.channel = channel;
    return out;
  }

  static fromCodesAndTimes(
    networkCode: string,
    stationCode: string,
    locationCode: string,
    channelCode: string,
    startTime: moment.Moment,
    endTime: moment.Moment,
  ): SeismogramDisplayData {
    const out = new SeismogramDisplayData(
      new StartEndDuration(startTime, endTime),
    );
    out.channelCodesHolder = {
      networkCode: networkCode,
      stationCode: stationCode,
      locationCode: locationCode,
      channelCode: channelCode,
    };
    return out;
  }

  addQuake(quake: Quake | Array<Quake>) {
    if (Array.isArray(quake)) {
      quake.forEach(q => this.quakeList.push(q));
    } else {
      this.quakeList.push(quake);
    }
  }

  addMarker(marker: MarkerType) {
    this.addMarkers([marker]);
  }

  addMarkers(markers: MarkerType | Array<MarkerType>) {
    if (Array.isArray(markers)) {
      markers.forEach(m => this.markerList.push(m));
    } else {
      this.markerList.push(markers);
    }
  }

  addTravelTimes(
    ttimes:
      | TraveltimeJsonType
      | TraveltimeArrivalType
      | Array<TraveltimeArrivalType>,
  ) {
    if (Array.isArray(ttimes)) {
      ttimes.forEach(m => this.traveltimeList.push(m));
    } else if ("arrivals" in ttimes ) { //  TraveltimeJsonType
      ttimes.arrivals.forEach(m => this.traveltimeList.push(m));
    } else {
      this.traveltimeList.push(ttimes);
    }
  }

  get hasQuake(): boolean {
    return this.quakeList.length > 0;
  }

  get quake(): Quake | null {
    if (this.hasQuake) {
      return this.quakeList[0];
    }

    return null;
  }

  get hasSeismogram(): boolean {
    return isDef(this._seismogram);
  }

  get hasChannel(): boolean {
    return this.channel !== null;
  }

  get hasSensitivity(): boolean {
    return (
      this._instrumentSensitivity !== null ||
      (isDef(this.channel) && this.channel.hasInstrumentSensitivity())
    );
  }

  /**
   * Allows id-ing a seismogram. Optional.
   *
   * @returns         string id
   */
  get id(): string | null {
    return this._id;
  }

  /**
   * Allows iding a seismogram. Optional.
   *
   * @param   value string id
   */
  set id(value: string | null) {
    this._id = value;
  }

  /**
   * return network code as a string.
   * Uses this.channel if it exists, this.seismogram if not.
   *
   * @returns network code
   */
  get networkCode(): string {
    let out: string|null = null;
    if (isDef(this.channel)) {
      out = this.channel.networkCode;
    } else if (isDef(this._seismogram)) {
      out = this._seismogram.networkCode;
    } else if (isDef(this.channelCodesHolder)) {
      out = this.channelCodesHolder.networkCode;
    }
    if ( ! isDef(out)) {
      out = "unknown";
    }
    return out;
  }

  /**
   * return station code as a string.
   * Uses this.channel if it exists, this.seismogram if not.
   *
   * @returns station code
   */
  get stationCode(): string {
    let out: string|null = null;
    if (isDef(this.channel)) {
      out = this.channel.stationCode;
    } else if (isDef(this._seismogram)) {
      out = this._seismogram.stationCode;
    } else if (isDef(this.channelCodesHolder)) {
      out = this.channelCodesHolder.stationCode;
    }
    if ( ! isDef(out)) {
      out = "unknown";
    }
    return out;
  }

  /**
   * return location code a a string.
   * Uses this.channel if it exists, this.seismogram if not.
   *
   * @returns location code
   */
  get locationCode(): string {
    let out: string|null = null;
    if (isDef(this.channel)) {
      out = this.channel.locationCode;
    } else if (isDef(this._seismogram)) {
      out = this._seismogram.locationCode;
    } else if (isDef(this.channelCodesHolder)) {
      out = this.channelCodesHolder.locationCode;
    }
    if ( ! isDef(out)) {
      out = "unknown";
    }
    return out;
  }

  /**
   * return channels code as a string.
   * Uses this.channel if it exists, this.seismogram if not.
   *
   * @returns channel code
   */
  get channelCode(): string {
    let out: string|null = null;
    if (isDef(this.channel)) {
      out = this.channel.channelCode;
    } else if (isDef(this._seismogram)) {
      out = this._seismogram.channelCode;
    } else if (isDef(this.channelCodesHolder)) {
      out = this.channelCodesHolder.channelCode;
    }
    if ( ! isDef(out)) {
      out = "unknown";
    }
    return out;
  }

  /**
   * return FDSN source id as a string.
   * Uses this.channel if it exists, this.seismogram if not.
   *
   * @returns FDSN source id
   */
  get sourceId(): string {
    if (isDef(this.channel)) {
      return this.channel.sourceId;
    } else if (isDef(this._seismogram)) {
      const sep = "_";
      let band;
      let source;
      let subsource;

      if (this.channelCode.length === 3) {
        band = this.channelCode.charAt(0);
        source = this.channelCode.charAt(1);
        subsource = this.channelCode.charAt(2);
      } else {
        let items = this.channelCode.split(sep);
        band = items[0];
        source = items[1];
        subsource = items[2];
      }

      return (
        "FDSN:" +
        (this.networkCode ? this.networkCode : "") +
        sep +
        (this.stationCode ? this.stationCode : "") +
        sep +
        (this.locationCode ? this.locationCode : "") +
        sep +
        band +
        sep +
        source +
        sep +
        subsource
      );
    } else {
      throw new Error("unable to create Id, neither channel nor seismogram");
    }
  }

  /**
   * return network, station, location and channels codes as one string.
   * Uses this.channel if it exists, this.seismogram if not
   *
   * @returns net.sta.loc.chan
   */
  get nslc(): string {
    return this.codes();
  }

  /**
   * return network, station, location and channels codes as one string.
   * Uses this.channel if it exists, this.seismogram if not.
   *
   * @param sep separator, defaults to '.'
   * @returns nslc codes separated by sep
   */
  codes(sep: string = "."): string {
    if (this.channel !== null) {
      return this.channel.codes();
    } else {
      return (
        (this.networkCode ? this.networkCode : "") +
        sep +
        (this.stationCode ? this.stationCode : "") +
        sep +
        (this.locationCode ? this.locationCode : "") +
        sep +
        (this.channelCode ? this.channelCode : "")
      );
    }
  }

  get startTime(): moment.Moment {
    return this.timeRange.startTime;
  }

  get start(): moment.Moment {
    return this.timeRange.startTime;
  }

  get endTime(): moment.Moment {
    return this.timeRange.endTime;
  }

  get end(): moment.Moment {
    return this.timeRange.endTime;
  }

  get timeWindow(): StartEndDuration {
    return this.timeRange;
  }

  alignStartTime() {
    this.alignmentTime = this.start;
  }

  alignOriginTime() {
    if (this.quake) {
      this.alignmentTime = this.quake.time;
    } else {
      this.alignmentTime = this.start;
    }
  }

  alignPhaseTime(phaseRegExp: RegExp | string) {
    let intPhaseRegExp: RegExp;

    if (typeof phaseRegExp === "string") {
      intPhaseRegExp = new RegExp(phaseRegExp);
    } else {
      intPhaseRegExp = phaseRegExp;
    }

    if (this.quake && this.traveltimeList) {
      // for flow
      const q = this.quake;
      let matchArrival = this.traveltimeList.find(ttArrival => {
        let match = intPhaseRegExp.exec(ttArrival.phase);
        // make sure regexp matches whole string, not just partial
        return match !== null && match[0] === ttArrival.phase;
      });

      if (matchArrival) {
        this.alignmentTime = moment
          .utc(q.time)
          .add(moment.duration(matchArrival.time, "seconds"));
      } else {
        this.alignmentTime = this.start;
      }
    }
  }

  relativeTimeWindow(
    startOffset: moment.Duration,
    duration: moment.Duration,
  ): StartEndDuration {
    if (this.alignmentTime) {
      return new StartEndDuration(
        moment.utc(this.alignmentTime).add(startOffset),
        null,
        duration,
      );
    } else {
      return new StartEndDuration(
        moment.utc(this.startTime).add(startOffset),
        null,
        duration,
      );
    }
  }

  get sensitivity(): InstrumentSensitivity | null {
    const channel = this.channel;

    if (this._instrumentSensitivity) {
      return this._instrumentSensitivity;
    } else if (isDef(channel) && channel.hasInstrumentSensitivity()) {
      return channel.instrumentSensitivity;
    } else {
      return null;
    }
  }

  set sensitivity(value: InstrumentSensitivity | null) {
    this._instrumentSensitivity = value;
  }

  get min(): number {
    if (!this._statsCache) {
      this._statsCache = this.calcStats();
    }

    return this._statsCache.min;
  }

  get max(): number {
    if (!this._statsCache) {
      this._statsCache = this.calcStats();
    }

    return this._statsCache.max;
  }

  get mean(): number {
    if (!this._statsCache) {
      this._statsCache = this.calcStats();
    }

    return this._statsCache.mean;
  }

  get seismogram(): Seismogram | null {
    return this._seismogram;
  }

  set seismogram(value: Seismogram | null) {
    this._seismogram = value;
    this._statsCache = null;
  }

  calcStats(): SeismogramDisplayStats {
    let stats = new SeismogramDisplayStats();

    if (this.seismogram) {
      let minMax = this.seismogram.findMinMax();
      stats.min = minMax[0];
      stats.max = minMax[1];
      stats.mean = this.seismogram.mean();
    }

    this._statsCache = stats;
    return stats;
  }

  /**
   * Calculates distance and azimuth for each event in quakeList.
   *
   * @returns Array of DistAzOutput, empty array if no quakes.
   */
  get distazList(): Array<DistAzOutput> {
    if (this.quakeList.length > 0 && isDef(this.channel)) {
      // for flow
      const c = this.channel;
      return this.quakeList.map(q =>
        distaz(c.latitude, c.longitude, q.latitude, q.longitude),
      );
    }

    return [];
  }

  /**
   * Calculates distance and azimuth for the first event in quakeList. This is
   * a convienence method as usually there will only be one quake.
   *
   * @returns DistAzOutput, null if no quakes.
   */
  get distaz(): null | DistAzOutput {
    let out = null;

    if (this.quakeList.length > 0 && this.channel !== null) {
      out = distaz(
        this.channel.latitude,
        this.channel.longitude,
        this.quakeList[0].latitude,
        this.quakeList[0].longitude,
      );
    }

    return out;
  }

  clone(): SeismogramDisplayData {
    return this.cloneWithNewSeismogram(
      this.seismogram ? this.seismogram.clone() : null,
    );
  }

  cloneWithNewSeismogram(seis: Seismogram | null): SeismogramDisplayData {
    let out = new SeismogramDisplayData(this.timeRange);
    Object.getOwnPropertyNames(this).forEach(name => {
      if (name === "_seismogram") {
        out._seismogram = seis; // @ts-ignore
      } else if (moment.isMoment(this[name])) {
        // @ts-ignore
        out[name] = moment.utc(this[name]); // @ts-ignore
      } else if (Array.isArray(this[name])) {
        // @ts-ignore
        out[name] = this[name].slice();
      } else {
        // @ts-ignore
        out[name] = this[name];
      }
    });
    out.seismogram = seis;
    out._statsCache = null;
    return out;
  }

  /**
   * Cut the seismogram. Creates a new seismogramDisplayData with the cut
   * seismogram and the timeRange set to the new time window.
   *
   * @param  timeRange start and end of cut
   * @returns           new seismogramDisplayData
   */
  cut(timeRange: StartEndDuration): null | SeismogramDisplayData {
    let cutSeis = this.seismogram;
    let out;

    if (cutSeis) {
      cutSeis = cutSeis.cut(timeRange);
      out = this.cloneWithNewSeismogram(cutSeis);
    } else {
      // no seismogram, so just clone?
      out = this.clone();
    }

    out.timeRange = timeRange;
    return out;
  }
}
export class SeismogramDisplayStats {
  min: number;
  max: number;
  mean: number;
  trendSlope: number;

  constructor() {
    this.min = 0;
    this.max = 0;
    this.mean = 0;
    this.trendSlope = 0;
  }
}
export function findStartEnd(
  sddList: Array<SeismogramDisplayData>,
): StartEndDuration {
  let allStart = sddList.map(sdd => {
    return moment.utc(sdd.timeRange.startTime);
  });
  let startTime = moment.min(allStart);
  let allEnd = sddList.map(sdd => {
    return moment.utc(sdd.timeRange.endTime);
  });
  let endTime = moment.max(allEnd);
  return new StartEndDuration(startTime, endTime);
}
export function findMaxDuration(
  sddList: Array<SeismogramDisplayData>,
): moment.Duration {
  return findMaxDurationOfType("start", sddList);
}
export function findMaxDurationOfType(
  type: string,
  sddList: Array<SeismogramDisplayData>,
): moment.Duration {
  return sddList.reduce((acc, sdd) => {
    let timeRange;

    if (type === "start") {
      timeRange = sdd.timeRange;
    } else if (type === "origin" && sdd.hasQuake) {
      timeRange = new StartEndDuration(
        sdd.quakeList[0].time,
        sdd.timeRange.end,
      );
    } else {
      timeRange = sdd.timeRange;
    }

    if (timeRange.duration.asMilliseconds() > acc.asMilliseconds()) {
      return timeRange.duration.clone();
    } else {
      return acc;
    }
  }, moment.duration(0, "seconds"));
}
export function findMinMax(
  sddList: Array<SeismogramDisplayData>,
): Array<number> {
  let min = sddList
    .map(sdd => {
      return sdd.min;
    })
    .reduce(function (p, v) {
      return p < v ? p : v;
    });
  let max = sddList
    .map(sdd => {
      return sdd.max;
    })
    .reduce(function (p, v) {
      return p > v ? p : v;
    });
  return [min, max];
}
const initial_minAmp = Number.MAX_SAFE_INTEGER;
const initial_maxAmp = -1 * initial_minAmp;
export function findMinMaxOverTimeRange(
  sddList: Array<SeismogramDisplayData>,
  timeRange: StartEndDuration,
): Array<number> {
  let minMaxArr = sddList.map(sdd => {
    if (sdd.seismogram) {
      const cutSeis = sdd.seismogram.cut(timeRange);

      if (cutSeis) {
        return cutSeis.findMinMax();
      }
    }

    return [initial_minAmp, initial_maxAmp];
  });
  let min = minMaxArr
    .map(mm => {
      return mm[0];
    })
    .reduce(function (p, v) {
      return p < v ? p : v;
    });
  let max = minMaxArr
    .map(mm => {
      return mm[1];
    })
    .reduce(function (p, v) {
      return p > v ? p : v;
    });
  return [min, max];
}
export function findMinMaxOverRelativeTimeRange(
  sddList: Array<SeismogramDisplayData>,
  startOffset: moment.Duration,
  duration: moment.Duration,
): Array<number> {
  let minMaxArr = sddList.map(sdd => {
    let timeRange = sdd.relativeTimeWindow(startOffset, duration);
    return findMinMaxOverTimeRange([sdd], timeRange);
  });
  let min = minMaxArr
    .map(mm => {
      return mm[0];
    })
    .reduce(function (p, v) {
      return p < v ? p : v;
    });
  let max = minMaxArr
    .map(mm => {
      return mm[1];
    })
    .reduce(function (p, v) {
      return p > v ? p : v;
    });
  return [min, max];
}
export function findStartEndOfSeismograms(
  data: Array<Seismogram>,
  accumulator?: StartEndDuration,
): StartEndDuration {
  let out: StartEndDuration;

  if (!accumulator && !data) {
    throw new Error("data and accumulator are not defined");
  } else if (!accumulator) {
    out = new StartEndDuration(
      moment.utc("2500-01-01"),
      moment.utc("1001-01-01"),
    );
  } else {
    out = accumulator;
  }

  if (Array.isArray(data)) {
    for (let s of data) {
      if (s.startTime.isSameOrBefore(out.startTime)) {
        out = new StartEndDuration(moment.utc(s.startTime), out.endTime);
      }

      if (out.endTime.isSameOrBefore(s.endTime)) {
        out = new StartEndDuration(out.startTime, moment.utc(s.endTime));
      }
    }
  } else {
    throw new Error(`Expected Array as first arg but was: ${typeof data}`);
  }

  return out;
}
export function findMinMaxOfSeismograms(
  data: Array<Seismogram>,
  minMaxAccumulator?: Array<number>,
): Array<number> {
  for (let s of data) {
    minMaxAccumulator = s.findMinMax(minMaxAccumulator);
  }

  if (minMaxAccumulator) {
    return minMaxAccumulator;
  } else {
    return [-1, 1];
  }
}
