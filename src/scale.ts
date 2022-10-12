
import {isDef} from "./util";
import {Duration} from "luxon";

/** enum for amplitude modes, RAW, MINMAX, MEAN */
export enum AMPLITUDE_MODE {
  Raw = "RAW",
  MinMax = "MINMAX",
  Mean = "MEAN",
}

let _lastId = 0;

export class AmplitudeScalable {
  middle: number;
  halfWidth: number;

  constructor(middle: number, halfWidth: number) {
    this.middle = middle;
    this.halfWidth = halfWidth;
  }

  // eslint-disable-next-line no-unused-vars
  notifyAmplitudeChange(middle: number, halfWidth: number) {
    // no-op
  }
  toString(): string {
    return `mid: ${this.middle} hw: ${this.halfWidth}`;
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
  linkAll(graphList: Array<AmplitudeScalable | { amp_scalable: AmplitudeScalable}>) {
    graphList.forEach(graph => {
        if ("notifyAmplitudeChange" in graph) {
          this._graphSet.add(graph);
        } else if ("amp_scalable" in graph) {
          this._graphSet.add(graph.amp_scalable);
        } else {
          console.warn(`graph does not have notifyAmplitudeChange method or amp_scalable field, skipping: ${graph}`);
        }
    });
    this.recalculate();
  }
  /**
   * Link new Seismograph with this amplitude scale.
   *
   * @param   graph AmplitudeScalable to link
   */
  link(graph: AmplitudeScalable | { amp_scalable: AmplitudeScalable}) {
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
   */
  recalculate(): Array<Promise<AmplitudeScalable>> {
    const mythis = this;

    const maxHalfRange = mythis.graphList.reduce((acc, cur) => {
      return acc > cur.halfWidth ? acc : cur.halfWidth;
    }, 0);
    let promiseList;
    if (mythis.halfWidth !== maxHalfRange) {
      mythis.halfWidth = maxHalfRange;
      promiseList = mythis._internalNotifyAll();
    } else {
      // no change
      promiseList = mythis.graphList.map(g => Promise.resolve(g));
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
  _originalStartOffset: Duration;
  _zoomedDuration: null | Duration;
  _zoomedStartOffset: null | Duration;
  _scaleId: number;

  constructor(
    graphList?: Array<TimeScalable>,
    originalDuration?: Duration,
    originalStartOffset?: Duration,
    scaleId?: number,
  ) {
    if (scaleId) {this._scaleId = scaleId;} else {this._scaleId = -1;}
    const glist = graphList ? graphList : []; // in case null

    this._graphSet = new Set(glist);
    this._originalDuration = Duration.fromMillis(0);
    this._originalStartOffset = Duration.fromMillis(0);
    this._zoomedDuration = null;
    this._zoomedStartOffset = null;

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

    if (originalStartOffset) {
      this._originalStartOffset = originalStartOffset;
    } else {
      this._originalStartOffset = Duration.fromMillis(0);
    }
    this.recalculate();
  }

  /**
   * Link new TimeScalable with this time scale.
   *
   * @param   graph TimeScalable to link
   */
  link(graph: TimeScalable | { time_scalable: TimeScalable}) {
    this.linkAll([graph]);
  }

  /**
   * Links TimeScalable with this time scale. Each
   * object in the array should either be a TimeScalable
   * or have a time_scalable field that is a TimeScalable.
   *
   * @param   graphList Array of TimeScalable to link
   */
  linkAll(graphList: Array<TimeScalable | { time_scalable: TimeScalable}>) {
    graphList.forEach(graph => {
        if ("notifyTimeRangeChange" in graph) {
          this._graphSet.add(graph);
        } else if ("time_scalable" in graph) {
          this._graphSet.add(graph.time_scalable);
        } else {
          console.warn(`graph does not have notifyTimeRangeChange method or time_scalable field, skipping: ${graph}`);
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
    this._zoomedStartOffset = startOffset;
    this.notifyAll();
  }

  unzoom() {
    this._zoomedDuration = null;
    this._zoomedStartOffset = null;
    this.recalculate();
  }

  get offset(): Duration {
    return this._zoomedStartOffset
      ? this._zoomedStartOffset
      : this._originalStartOffset;
  }

  set offset(offset: Duration) {
    this._originalStartOffset = offset;
    this._zoomedStartOffset = offset;
    this.recalculate();
  }

  get duration(): Duration {
    return isDef(this._zoomedDuration) ? this._zoomedDuration : this._originalDuration;
  }

  set duration(duration: Duration) {
    if (!isDef(duration)) {
      throw new Error(`Duration must be defined: ${duration}`);
    }
    this._originalDuration = duration;
    this._zoomedDuration = duration;
    this.recalculate();
  }

  get origOffset(): Duration {
    return this._originalStartOffset;
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
