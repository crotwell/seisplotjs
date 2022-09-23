/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */
import {DateTime, Duration, Interval} from "luxon";
import {FDSNSourceId, NslcId} from "./fdsnsourceid";
import {meanOfSlice, isDef, stringify, isoToDateTime,} from "./util";
import * as seedcodec from "./seedcodec";
import {distaz, DistAzOutput} from "./distaz";
import {Network, Station, Channel, InstrumentSensitivity, findChannels} from "./stationxml";
import {Quake} from "./quakeml";
import {SeismogramSegment} from "./seismogramsegment";
//export {SeismogramSegment} from "./seismogramsegment";
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
  time: DateTime;
  markertype: string;
  description: string;
  link?: string;
};

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
  _startTime: DateTime;
  _endTime: DateTime;
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

    const f = this._segmentArray[0];

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

  findStartEnd(): [DateTime, DateTime] {
    const allStart = this._segmentArray.map(seis => {
      return seis.startTime;
    });

    const startTime = allStart.reduce((acc, cur)=> {
      return acc<cur ? acc : cur;
    } );

    const allEnd = this._segmentArray.map(seis => {
      return seis.endTime;
    });

    const endTime = allEnd.reduce((acc, cur)=> {
      return acc>cur ? acc : cur;
    } );
    return [startTime, endTime];
  }

  findMinMax(minMaxAccumulator?: Array<number>): Array<number> {
    if (this._segmentArray.length === 0) {
      throw new Error("No data");
    }

    for (const s of this._segmentArray) {
      minMaxAccumulator = s.findMinMax(minMaxAccumulator);
    }

    if (minMaxAccumulator) {
      return minMaxAccumulator;
    } else {
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
    const npts = this.numPoints;

    for (const s of this.segments) {
      meanVal += meanOfSlice(s.y, s.y.length) * s.numPoints;
    }

    meanVal = meanVal / npts;
    return meanVal;
  }

  get start(): DateTime {
    return this.startTime;
  }

  get startTime(): DateTime {
    return this._startTime;
  }

  get end(): DateTime {
    return this.endTime;
  }

  get endTime(): DateTime {
    return this._endTime;
  }

  get timeRange(): Interval {
    return Interval.fromDateTimes(this.startTime, this.endTime);
  }

  get timeWindow(): Interval {
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
  get sourceId(): FDSNSourceId | null {
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

  hasCodes(): boolean {
    return this._segmentArray[0].hasCodes();
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
  get nslcId(): NslcId {
    return this._segmentArray[0].nslcId;
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
      this._startTime =
        this.startTime<seismogram.startTime ? this.startTime : seismogram.startTime;
      this._endTime =
        this.endTime > seismogram.endTime ? this.endTime : seismogram.endTime;

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
  cut(timeRange: Interval): null | Seismogram {
    // coarse trim first
    let out = this.trim(timeRange);

    if (out && out._segmentArray) {
      const cutSeisArray = this._segmentArray
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
  trim(timeRange: Interval): null | Seismogram {
    let out = null;

    if (this._segmentArray) {
      const trimSeisArray = this._segmentArray
        .filter(function (d) {
          return d.endTime >= timeRange.start;
        })
        .filter(function (d) {
          return d.startTime <= timeRange.end;
        });

      if (trimSeisArray.length > 0) {
        out = new Seismogram(trimSeisArray);
      }
    }

    return out;
  }

  break(duration: Duration): void {
    if (this._segmentArray) {
      let breakStart = this.startTime;
      let out: Array<SeismogramSegment> = [];

      while (breakStart < this.endTime) {
        const breakWindow = Interval.after(breakStart, duration);

        const cutSeisArray: Array<SeismogramSegment> =
          this._segmentArray.map(seg => seg.cut(breakWindow)).filter(isDef);

        out = out.concat(cutSeisArray);
        breakStart = breakStart.plus(duration);
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
          prev.endTime < s.startTime &&
          prev.endTime
            .plus(Duration.fromMillis((1000 * 1.5) / prev.sampleRate))
            > s.startTime
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
      for (const v of seg.y) {
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
        "Seismogram is not contiguous, access each SeismogramSegment idividually.",
      );
    }
  }

  set y(val: Int32Array | Float32Array | Float64Array) {
    // ToDo
    throw new Error("seismogram y setter not impl, see cloneWithNewData()");
  }

  clone(): Seismogram {
    const cloned = this._segmentArray.map(s => s.clone());

    return new Seismogram(cloned);
  }

  cloneWithNewData(newY: Int32Array | Float32Array | Float64Array): Seismogram {
    if (newY && newY.length > 0) {
      const seg = this._segmentArray[0].cloneWithNewData(newY);

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
    startTime: DateTime,
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
export class SeismogramDisplayData {
  /** @private */
  _seismogram: Seismogram | null;
  _id: string | null;
  _sourceId: FDSNSourceId | null;
  label: string | null;
  markerList: Array<MarkerType>;
  traveltimeList: Array<TraveltimeArrivalType>;
  channel: Channel | null;
  channelCodesHolder: NslcId | null;
  _instrumentSensitivity: InstrumentSensitivity | null;
  quakeList: Array<Quake>;
  timeRange: Interval;
  alignmentTime: DateTime;
  doShow: boolean;
  _statsCache: SeismogramDisplayStats | null;

  constructor(timeRange: Interval) {
    if (!timeRange) {
      throw new Error("timeRange must not be missing.");
    }

    this._id = null;
    this._sourceId = null;
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
      Interval.fromDateTimes(
        seismogram.startTime,
        seismogram.endTime,
      ),
    );
    out.seismogram = seismogram;
    return out;
  }
  /**
   * Useful for creating fake data from an array, sample rate and start time
   * @return [description]
   */
  static fromContiguousData(
      yArray:
        | Array<seedcodec.EncodedDataSegment>
        | Int32Array
        | Float32Array
        | Float64Array,
      sampleRate: number,
      startTime: DateTime,): SeismogramDisplayData {
    return SeismogramDisplayData.fromSeismogram(
      Seismogram.createFromContiguousData(yArray, sampleRate, startTime));
  }
  static fromChannelAndTimeWindow(
    channel: Channel,
    timeRange: Interval,
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
    startTime: DateTime,
    endTime: DateTime,
  ): SeismogramDisplayData {
    const out = new SeismogramDisplayData(
      Interval.fromDateTimes(startTime, endTime),
    );
    out.channel = channel;
    return out;
  }

  static fromCodesAndTimes(
    networkCode: string,
    stationCode: string,
    locationCode: string,
    channelCode: string,
    startTime: DateTime,
    endTime: DateTime,
  ): SeismogramDisplayData {
    const out = new SeismogramDisplayData(
      Interval.fromDateTimes(startTime, endTime),
    );
    out.channelCodesHolder = new NslcId(
      networkCode,
      stationCode,
      locationCode,
      channelCode
    );
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

  hasQuake(): boolean {
    return this.quakeList.length > 0;
  }

  get quake(): Quake | null {
    if (this.hasQuake()) {
      return this.quakeList[0];
    }

    return null;
  }

  hasSeismogram(): this is {_seismogram: Seismogram} {
    return isDef(this._seismogram);
  }

  hasChannel(): this is {channel: Channel} {
    return isDef(this.channel);
  }

  hasSensitivity(): this is {_instrumentSensitivity: InstrumentSensitivity} {
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
  get sourceId(): FDSNSourceId | null {
    if (isDef(this.channel)) {
      return this.channel.sourceId;
    } else if (isDef(this._seismogram)) {
      return this._seismogram.sourceId;
    } else if (isDef(this._sourceId)) {
      return this._sourceId;
    } else if(isDef(this.channelCodesHolder)) {
      return FDSNSourceId.fromNslc(this.networkCode,
        this.stationCode,
        this.locationCode,
        this.channelCode);
    } else {
      return null;
      //throw new Error("unable to create Id, neither channel, channelCodesHolder nor seismogram");
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

  get nslcId(): NslcId {
    if (this.channel !== null) {
      return this.channel.nslcId;
    } else {
      return new NslcId(
        this.networkCode ? this.networkCode : "",
        this.stationCode ? this.stationCode : "",
        (this.locationCode && this.locationCode !== "--") ? this.locationCode : "",
        this.channelCode ? this.channelCode : ""
      );
    }
  }

  /**
   * return network, station, location and channels codes as one string.
   * Uses this.channel if it exists, this.seismogram if not.
   *
   * @param sep separator, defaults to '.'
   * @returns nslc codes separated by sep
   */
  codes(sep = "."): string {
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

  get startTime(): DateTime {
    return this.timeRange.start;
  }

  get start(): DateTime {
    return this.timeRange.start;
  }

  get endTime(): DateTime {
    return this.timeRange.end;
  }

  get end(): DateTime {
    return this.timeRange.end;
  }

  get timeWindow(): Interval {
    return this.timeRange;
  }

  get numPoints(): number {
    if (this._seismogram) {
      return this._seismogram.numPoints;
    }
    return 0;
  }

  associateChannel(nets: Array<Network> ) {
    const matchChans = findChannels(nets,
                                    this.networkCode,
                                    this.stationCode,
                                    this.locationCode,
                                    this.channelCode);
    for( const c of matchChans) {
      if (c.timeRange.overlaps(this.timeRange)) {
        this.channel = c;
        return;
      }
    }
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
      const q = this.quake;
      const matchArrival = this.traveltimeList.find(ttArrival => {
        const match = intPhaseRegExp.exec(ttArrival.phase);
        // make sure regexp matches whole string, not just partial
        return match !== null && match[0] === ttArrival.phase;
      });

      if (matchArrival) {
        this.alignmentTime = q.time
          .plus(Duration.fromMillis(matchArrival.time * 1000)); //seconds
      } else {
        this.alignmentTime = this.start;
      }
    }
  }

  relativeTimeWindow(
    startOffset: Duration,
    duration: Duration,
  ): Interval {
    if (this.alignmentTime) {
      return Interval.after(
        this.alignmentTime.plus(startOffset),
        duration,
      );
    } else {
      return Interval.after(
        this.startTime.plus(startOffset),
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

  get middle(): number {
    if (!this._statsCache) {
      this._statsCache = this.calcStats();
    }

    return this._statsCache.middle;
  }

  get seismogram(): Seismogram | null {
    return this._seismogram;
  }

  set seismogram(value: Seismogram | null) {
    this._seismogram = value;
    this._statsCache = null;
  }

  get segments(): Array<SeismogramSegment> {
    if (this._seismogram) {
      return this._seismogram.segments;
    } else {
      return [];
    }
  }

  calcStats(): SeismogramDisplayStats {
    const stats = new SeismogramDisplayStats();

    if (this.seismogram) {
      const minMax = this.seismogram.findMinMax();
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
    const out = new SeismogramDisplayData(this.timeRange);
    Object.getOwnPropertyNames(this).forEach(name => {
      if (name === "_seismogram") {
        out._seismogram = seis; // @ts-ignore
      } else if (DateTime.isDateTime(this[name])) {
        // @ts-ignore
        out[name] = this[name]; // @ts-ignore
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
    out.channelCodesHolder = this.channelCodesHolder;
    if (!isDef(out._seismogram) && !isDef(out.channel)) {
      // so we con't forget our channel
      out._sourceId = this.sourceId;
      if (this._seismogram && this._seismogram.sourceId) {
        out.channelCodesHolder = this._seismogram.sourceId.asNslc();
      }
    }
    return out;
  }

  /**
   * Cut the seismogram. Creates a new seismogramDisplayData with the cut
   * seismogram and the timeRange set to the new time window.
   *
   * @param  timeRange start and end of cut
   * @returns           new seismogramDisplayData
   */
  cut(timeRange: Interval): null | SeismogramDisplayData {
    let cutSeis = this.seismogram;
    let out;

    if (cutSeis) {
      cutSeis = cutSeis.cut(timeRange);
      out = this.cloneWithNewSeismogram(cutSeis);
      if (!isDef(out._seismogram) && !isDef(out.channel)) {
        // so we con't forget our channel
        out._sourceId = this.sourceId;
      }
    } else {
      // no seismogram, so just clone?
      out = this.clone();
    }
    out.timeRange = timeRange;
    return out;
  }
  toString(): string {
    return `${this.sourceId} ${this.timeRange}`;
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
  get middle(): number {
    return (this.min+this.max)/2;
  }
}
export function findStartEnd(
  sddList: Array<SeismogramDisplayData>,
): Interval {
  if (sddList.length === 0) {
    // just use the default???
    return Interval.before(DateTime.utc(), 300);
  }
  const startTime = sddList.reduce((acc, sdd) => {
    return acc < sdd.timeRange.start ? acc : sdd.timeRange.start;
  }, sddList[0].timeRange.start);

  const endTime = sddList.reduce((acc, sdd) => {
    return acc > sdd.timeRange.end ? acc : sdd.timeRange.end;
  }, sddList[0].timeRange.end);
  return Interval.fromDateTimes(startTime, endTime);
}
export function findMaxDuration(
  sddList: Array<SeismogramDisplayData>,
): Duration {
  return findMaxDurationOfType("start", sddList);
}
export function findMaxDurationOfType(
  type: string,
  sddList: Array<SeismogramDisplayData>,
): Duration {
  return sddList.reduce((acc, sdd) => {
    let timeRange;

    if (type === "start") {
      timeRange = sdd.timeRange;
    } else if (type === "origin" && sdd.hasQuake()) {
      timeRange = Interval.fromDateTimes(
        sdd.quakeList[0].time,
        sdd.timeRange.end,
      );
    } else {
      timeRange = sdd.timeRange;
    }

    if (timeRange.toDuration().toMillis() > acc.toMillis()) {
      return timeRange.toDuration();
    } else {
      return acc;
    }
  }, Duration.fromMillis(0));
}
export function findMinMax(
  sddList: Array<SeismogramDisplayData>,
  doGain = false,
  centeredAmp = false,
): Array<number> {
  const min = sddList
    .map(sdd => {
      let sens = 1.0;
      if (doGain && sdd.sensitivity) {
        sens = sdd.sensitivity.sensitivity;
      }
      let middle = 0;
      if (centeredAmp) {
        middle = sdd.middle;
      }
      return (sdd.min-middle)/sens;
    })
    .reduce(function (p, v) {
      return p < v ? p : v;
    });
  const max = sddList
    .map(sdd => {
      let sens = 1.0;
      if (doGain && sdd.sensitivity) {
        sens = sdd.sensitivity.sensitivity;
      }
      let middle = 0;
      if (centeredAmp) {
        middle = sdd.middle;
      }
      return (sdd.max-middle)/sens;
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
  timeRange: Interval,
  doGain = false,
  centeredAmp = false,
): Array<number> {
  if (sddList.length === 0) { return [-1, 1]; }
  const minMaxArr = sddList.map(sdd => {
    if (sdd.seismogram) {
      const cutSeis = sdd.seismogram.cut(timeRange);

      if (cutSeis) {
        const countMinMax = cutSeis.findMinMax();
        let sens = 1.0;
        if (doGain && sdd.sensitivity) {
          sens = sdd.sensitivity.sensitivity;
        }
        let middle = 0;
        if (centeredAmp) {
          middle = (countMinMax[1] + countMinMax[0])/2;
        }
        return [(countMinMax[0]-middle)/sens, (countMinMax[1]-middle)/sens];
      }
    }

    return [initial_minAmp, initial_maxAmp];
  });
  const min = minMaxArr
    .map(mm => {
      return mm[0];
    })
    .reduce(function (p, v) {
      return p < v ? p : v;
    });
  const max = minMaxArr
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
  startOffset: Duration,
  duration: Duration,
  doGain = false,
  centeredAmp = false,
): Array<number> {
  if (sddList.length === 0) {
    return [0,0];
  }
  const minMaxArr = sddList.map(sdd => {
    const timeRange = sdd.relativeTimeWindow(startOffset, duration);
    return findMinMaxOverTimeRange([sdd], timeRange, doGain, centeredAmp);
  });
  const min = minMaxArr
    .map(mm => {
      return mm[0];
    })
    .reduce(function (p, v) {
      return p < v ? p : v;
    });
  const max = minMaxArr
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
  accumulator?: Interval,
): Interval {
  let out: Interval;

  if (!accumulator && !data) {
    throw new Error("data and accumulator are not defined");
  } else if (!accumulator) {
    out = Interval.fromDateTimes(
      isoToDateTime("2500-01-01T00:00:00Z"),
      isoToDateTime("1001-01-01T00:00:00Z"),
    );
  } else {
    out = accumulator;
  }

  if (Array.isArray(data)) {
    for (const s of data) {
      if (s.startTime <= out.start) {
        out = Interval.fromDateTimes(s.startTime, out.end);
      }

      if (out.end <= s.endTime) {
        out = Interval.fromDateTimes(out.start, s.endTime);
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
  for (const s of data) {
    minMaxAccumulator = s.findMinMax(minMaxAccumulator);
  }

  if (minMaxAccumulator) {
    return minMaxAccumulator;
  } else {
    return [-1, 1];
  }
}
export function findMinMaxOfSDD(
  data: Array<SeismogramDisplayData>,
  minMaxAccumulator?: Array<number>,
): Array<number> {
  const seisData: Array<Seismogram> = [];
  data.forEach(sdd => {if (!!sdd && !! sdd.seismogram) {seisData.push(sdd.seismogram);}});
  return findMinMaxOfSeismograms(seisData, minMaxAccumulator);
}
export function uniqueStations(
  seisData: Array<SeismogramDisplayData>,
): Array<Station> {
  const out = new Set<Station>();
  seisData.forEach(sdd => {
    if (sdd.channel) {
      out.add(sdd.channel.station);
    }
  });
  return Array.from(out.values());
}
export function uniqueChannels(
  seisData: Array<SeismogramDisplayData>,
): Array<Channel> {
  const out = new Set<Channel>();
  seisData.forEach(sdd => {
    if (sdd.channel) {
      out.add(sdd.channel);
    }
  });
  return Array.from(out.values());
}
export function uniqueQuakes(
  seisData: Array<SeismogramDisplayData>,
): Array<Quake> {
  const out = new Set<Quake>();
  seisData.forEach(sdd => {
    sdd.quakeList.forEach(q => out.add(q));
  });
  return Array.from(out.values());
}
