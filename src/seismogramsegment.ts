/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */
import {DateTime, Duration} from "luxon";
import {checkStringOrDate, isDef} from "./util";
import * as seedcodec from "./seedcodec";
import {StartEndDuration} from "./util";
export const COUNT_UNIT = "count";
export type HighLowType = {
  xScaleDomain: Array<Date>;
  xScaleRange: Array<number>;
  secondsPerPixel: number;
  samplesPerPixel: number;
  highlowArray: Array<number>;
};

/**
 * A contiguous segment of a Seismogram.
 *
 * @param  yArray array of Y sample values, ie the timeseries
 * @param  sampleRate sample rate of the seismogram, hertz
 * @param  startTime start time of seismogrm as a luxon DateTime in utc or a string that can be parsed
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
  _startTime: DateTime;
  _endTime_cache: null | DateTime;
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
    startTime: DateTime,
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

  get start(): DateTime {
    return this.startTime;
  }

  set start(value: DateTime | string) {
    this.startTime = value;
  }

  get startTime(): DateTime {
    return this._startTime;
  }

  set startTime(value: DateTime | string) {
    this._startTime = checkStringOrDate(value);

    this._invalidate_endTime_cache();
  }

  get end(): DateTime {
    return this.endTime;
  }

  get endTime(): DateTime {
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

  timeOfSample(i: number): DateTime {
    return this.startTime.plus(Duration.fromMillis(1000*i / this.sampleRate));
  }

  indexOfTime(t: DateTime): number {
    if (
      t < this.startTime ||
      t > this.endTime.plus(Duration.fromMillis(1000 / this.sampleRate))
    ) {
      return -1;
    }

    return Math.round((t.diff(this.startTime).toMillis() * this.sampleRate) / 1000);
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
      this.startTime.toISO() +
      "_" +
      this.endTime.toISO()
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
    clonedStartTime: DateTime = this._startTime,
  ): SeismogramSegment {
    let out = new SeismogramSegment(
      clonedData,
      this.sampleRate,
      clonedStartTime,
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
      timeRange.endTime < this._startTime ||
      timeRange.startTime > this.endTime
    ) {
      return null;
    }

    let sIndex = 0;

    if (timeRange.startTime > this._startTime) {
      let milliDiff = timeRange.startTime.diff(this._startTime).toMillis();
      let offset = (milliDiff * this.sampleRate) / 1000.0;
      sIndex = Math.floor(offset);
    }

    let eIndex = this.y.length;

    if (timeRange.endTime < this.endTime) {
      let milliDiff = this.endTime.diff(timeRange.endTime).toMillis();
      let offset = (milliDiff * this.sampleRate) / 1000.0;
      eIndex = this.y.length - Math.floor(offset);
    }

    let cutY = this.y.slice(sIndex, eIndex);
    let out = this.cloneWithNewData(
      cutY,
      this._startTime.plus(Duration.fromMillis(1000 * sIndex / this.sampleRate)),
    );
    return out;
  }

  _invalidate_endTime_cache() {
    this._endTime_cache = null;
    this._endTime_cache_numPoints = 0;
  }
}
