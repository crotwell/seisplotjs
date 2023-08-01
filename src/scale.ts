
import { isDef } from "./util";
import { Duration } from "luxon";

/** enum for amplitude modes, RAW, ZERO, MINMAX, MEAN */
export enum AMPLITUDE_MODE {
  Raw = "raw",       // raw values, no centering
  Zero = "zero",     // same as Raw, but also includes zero
  MinMax = "minmax", // centered on midpoint of min-max
  Mean = "mean",     // centered on mean
}

let _lastId = 0;


export class MinMaxable {
  min: number;
  max: number;
  constructor(min: number, max: number) {
    this.min = min;
    this.max = max;
  }
  get middle(): number {
    return (this.min + this.max) / 2;
  }
  get halfWidth(): number {
    return (this.fullWidth) / 2;
  }
  get fullWidth(): number {
    return (this.max - this.min);
  }
  union(omm?: MinMaxable): MinMaxable {
    if (omm) {
      return new MinMaxable(Math.min(this.min, omm.min), Math.max(this.max, omm.max));
    } else {
      return this;
    }
  }
  expandPercentage(percent: number): MinMaxable {
    return MinMaxable.fromMiddleHalfWidth(this.middle, this.halfWidth * percent);
  }
  /**
   * This as a d3 style 2 element array.
   *
   * @returns length 2 array of min then max
   */
  asArray(): [number, number] {
    return [this.min, this.max];
  }
  toString(): string {
    return `${this.min} to ${this.max}, mid: ${this.middle} hw: ${this.halfWidth}`;
  }
  /**
   * Create MinMaxable from a d3 style two element array.
   *
   * @param  minmax  array of min then max
   * @returns       new MinMaxable
   */
  static fromArray(minmax: number[]): MinMaxable {
    if (minmax.length < 2) {
      throw new Error(`array must have lenght 2, ${minmax.length}`);
    }
    return new MinMaxable(minmax[0], minmax[1]);
  }
  static fromMiddleHalfWidth(mid: number, halfWidth: number): MinMaxable {
    return new MinMaxable(mid - halfWidth, mid + halfWidth);
  }
}

export class AmplitudeScalable {
  minMax: MinMaxable;

  constructor(minMax?: MinMaxable) {
    if (minMax) {
      this.minMax = minMax;
    } else {
      this.minMax = new MinMaxable(0, 0);
    }
  }

  // eslint-disable-next-line no-unused-vars
  notifyAmplitudeChange(middle: number, halfWidth: number) {
    // no-op
  }
  get middle(): number {
    return this.minMax.middle;
  }
  get halfWidth(): number {
    return this.minMax.halfWidth;
  }
  get fullWidth(): number {
    return this.minMax.fullWidth;
  }
  get min(): number {
    return this.minMax.min;
  }
  get max(): number {
    return this.minMax.max;
  }

  toString(): string {
    return this.minMax.toString();
  }
}
export class TimeScalable {
  alignmentTimeOffset: Duration;
  duration: Duration;

  constructor(
    alignmentTimeOffset: Duration,
    duration: Duration,
  ) {
    this.alignmentTimeOffset = alignmentTimeOffset;
    this.duration = duration;
  }

  // eslint-disable-next-line no-unused-vars
  notifyTimeRangeChange(
    alignmentTimeOffset: Duration,
    duration: Duration,
  ) {
    // no-op
  }
}

/**
 * Links amplitude scales across multiple seismographs, respecting doRmean.
 *
 * @param graphList optional list of AmplitudeScalable to link
 */
export class LinkedAmplitudeScale {
  /**
   * @private
   */
  _graphSet: Set<AmplitudeScalable>;
  _halfWidth: number;
  _recalcTimeoutID: ReturnType<typeof setTimeout> | null;
  _scaleId: number;

  constructor(graphList?: Array<AmplitudeScalable>) {
    this._scaleId = ++_lastId;
    const glist = graphList ? graphList : []; // in case null
    this._halfWidth = 0;
    this._graphSet = new Set(glist);
    this._recalcTimeoutID = null;
  }

  get halfWidth(): number {
    return this._halfWidth;
  }
  set halfWidth(val: number) {
    if (this._halfWidth !== val) {
      this._halfWidth = val;
      this.notifyAll();
    }
  }

  /**
   * Links new Seismograph with this amplitude scale.
   *
   * @param   graphList Array of AmplitudeScalable to link
   */
  linkAll(graphList: Array<AmplitudeScalable | { amp_scalable: AmplitudeScalable }>) {
    graphList.forEach(graph => {
      if ("notifyAmplitudeChange" in graph) {
        this._graphSet.add(graph);
      } else if ("amp_scalable" in graph) {
        this._graphSet.add(graph.amp_scalable);
      } else {
        // graph does not have notifyAmplitudeChange method or amp_scalable field, skipping
      }
    });
    this.recalculate();
  }
  /**
   * Link new Seismograph with this amplitude scale.
   *
   * @param   graph AmplitudeScalable to link
   */
  link(graph: AmplitudeScalable | { amp_scalable: AmplitudeScalable }) {
    this.linkAll([graph]);
  }

  /**
   * Unlink Seismograph with this amplitude scale.
   *
   * @param   graph AmplitudeScalable to unlink
   */
  unlink(graph: AmplitudeScalable) {
    this._graphSet.delete(graph);

    this.recalculate();
  }

  /**
   * Recalculate the best amplitude scale for all Seismographs. Causes a redraw.
   *
   * @returns array of promise of best amp scales
   */
  recalculate(): Array<Promise<AmplitudeScalable>> {
    const maxHalfRange = this.graphList.reduce((acc, cur) => {
      return acc > cur.halfWidth ? acc : cur.halfWidth;
    }, 0);
    let promiseList;
    if (this.halfWidth !== maxHalfRange) {
      this.halfWidth = maxHalfRange;
      promiseList = this._internalNotifyAll();
    } else {
      // no change
      promiseList = this.graphList.map(g => Promise.resolve(g));
    }
    return promiseList;
  }
  _internalNotifyAll(): Array<Promise<AmplitudeScalable>> {
    const hw = this.halfWidth;
    return this.graphList.map(g => {
      return new Promise(resolve => {
        setTimeout(() => {
          g.notifyAmplitudeChange(g.middle, hw);
          resolve(g);
        }, 10);
      });
    });
  }
  notifyAll(): Array<Promise<AmplitudeScalable>> {
    return this._internalNotifyAll();
  }
  get graphList() {
    return Array.from(this._graphSet.values());
  }
}

export class IndividualAmplitudeScale extends LinkedAmplitudeScale {
  constructor(graphList?: Array<AmplitudeScalable>) {
    super(graphList);
  }
  recalculate(): Array<Promise<AmplitudeScalable>> {
    // no-op, just notify
    return this.notifyAll();
  }
  notifyAll(): Array<Promise<AmplitudeScalable>> {
    return this.graphList.map(g => {
      return new Promise(resolve => {
        setTimeout(() => {
          g.notifyAmplitudeChange(g.middle, g.halfWidth);
          resolve(g);
        }, 10);
      });
    });
  }
}


export class FixedHalfWidthAmplitudeScale extends LinkedAmplitudeScale {
  constructor(halfWidth: number, graphList?: Array<AmplitudeScalable>) {
    super(graphList);
    this.halfWidth = halfWidth;
  }
  recalculate(): Array<Promise<AmplitudeScalable>> {
    // no-op, just notify
    return this.notifyAll();
  }
  notifyAll(): Array<Promise<AmplitudeScalable>> {
    const hw = this.halfWidth;
    return this.graphList.map(g => {
      return new Promise(resolve => {
        setTimeout(() => {
          g.notifyAmplitudeChange(g.middle, hw);
          resolve(g);
        }, 10);
      });
    });
  }
}

/**
 * Links time scales across multiple seismographs.
 *
 * @param graphList optional list of TimeScalables to link
 */
export class LinkedTimeScale {
  /**
   * @private
   */
  _graphSet: Set<TimeScalable>;
  _originalDuration: Duration;
  _originalOffset: Duration;
  _zoomedDuration: null | Duration;
  _zoomedOffset: null | Duration;
  _scaleId: number;

  constructor(
    graphList?: Array<TimeScalable>,
    originalDuration?: Duration,
    originalOffset?: Duration,
    scaleId?: number,
  ) {
    if (scaleId) { this._scaleId = scaleId; } else { this._scaleId = -1; }
    const glist = graphList ? graphList : []; // in case null

    this._graphSet = new Set(glist);
    this._originalDuration = Duration.fromMillis(0);
    this._originalOffset = Duration.fromMillis(0);
    this._zoomedDuration = null;
    this._zoomedOffset = null;

    if (isDef(originalDuration)) {
      this._originalDuration = originalDuration;
      // so know that duration passed in instead of calculated
      // this prevents future links from causeing recalc
      this._zoomedDuration = originalDuration;
    } else if (glist.length > 0) {
      this._originalDuration = glist.reduce((acc, cur) => {
        return acc > cur.duration
          ? acc
          : cur.duration;
      }, Duration.fromMillis(0));
    }

    if (originalOffset) {
      this._originalOffset = originalOffset;
    } else {
      this._originalOffset = Duration.fromMillis(0);
    }
    this.recalculate();
  }

  /**
   * Link new TimeScalable with this time scale.
   *
   * @param   graph TimeScalable to link
   */
  link(graph: TimeScalable | { time_scalable: TimeScalable }) {
    this.linkAll([graph]);
  }

  /**
   * Links TimeScalable with this time scale. Each
   * object in the array should either be a TimeScalable
   * or have a time_scalable field that is a TimeScalable.
   *
   * @param   graphList Array of TimeScalable to link
   */
  linkAll(graphList: Array<TimeScalable | { time_scalable: TimeScalable }>) {
    graphList.forEach(graph => {
      if ("notifyTimeRangeChange" in graph) {
        this._graphSet.add(graph);
      } else if ("time_scalable" in graph) {
        this._graphSet.add(graph.time_scalable);
      } else {
        //graph does not have notifyTimeRangeChange method or time_scalable field, skipping
      }
    });
    this.recalculate();
  }

  /**
   * Unlink TimeScalable with this amplitude scale.
   *
   * @param   graph TimeScalable to unlink
   */
  unlink(graph: TimeScalable) {
    this._graphSet.delete(graph);
    this.recalculate();
  }

  zoom(startOffset: Duration, duration: Duration) {
    this._zoomedDuration = duration;
    this._zoomedOffset = startOffset;
    this.notifyAll();
  }

  unzoom() {
    this._zoomedDuration = null;
    this._zoomedOffset = null;
    this.recalculate();
  }

  get offset(): Duration {
    return this._zoomedOffset
      ? this._zoomedOffset
      : this._originalOffset;
  }

  set offset(offset: Duration) {
    this._originalOffset = offset;
    this._zoomedOffset = offset;
    this.recalculate();
  }

  get duration(): Duration {
    return isDef(this._zoomedDuration) ? this._zoomedDuration : this._originalDuration;
  }

  set duration(duration: Duration) {
    if (!isDef(duration)) {
      throw new Error(`Duration must be defined`);
    }
    this._originalDuration = duration;
    this._zoomedDuration = duration;
    this.recalculate();
  }

  get origOffset(): Duration {
    return this._originalOffset;
  }
  get origDuration(): Duration {
    return this._originalDuration;
  }

  /**
   * Recalculate the best time scale for all Seismographs. Causes a redraw.
   */
  recalculate() {
    if (!isDef(this._zoomedDuration) || this._originalDuration.toMillis() === 0) {
      this.graphList.forEach(graph => {
        if (graph && graph.duration > this._originalDuration) {
          this._originalDuration = graph.duration;
        }
      });
    }
    this.notifyAll();
  }
  notifyAll() {
    this.graphList.forEach(graph => {
      if (graph) {
        // run later via event loop
        setTimeout(() => {
          graph.notifyTimeRangeChange(this.offset, this.duration);
        });
      }
    });
  }
  get graphList() {
    return Array.from(this._graphSet.values());
  }
}

/**
 * Linked Time Scale that only modifies the alignment via the offset. The
 * duration of the linked TimeScalable is reused.
 * @param graphList            [description]
 * @param originalDuration     [description]
 * @param originalOffset  [description]
 * @param scaleId              [description]
 */
export class AlignmentLinkedTimeScale extends LinkedTimeScale {

  constructor(
    graphList?: Array<TimeScalable>,
    originalDuration?: Duration,
    originalOffset?: Duration,
    scaleId?: number,) {
    super(graphList, originalDuration, originalOffset, scaleId);
  }

  /**
   * Does no calculation, just causes a redraw.
   */
  recalculate() {
    this.notifyAll();
  }
  notifyAll() {
    this.graphList.forEach(graph => {
      // run later via event loop
      setTimeout(() => {
        graph.notifyTimeRangeChange(this.offset, this.duration);
      });
    });
  }
}
