import { isDef } from "./util";
import * as util from "./util";
import {transition} from "./transition";
import { Duration } from "luxon";

/** enum for amplitude modes, RAW, ZERO, MINMAX, MEAN */
export enum AMPLITUDE_MODE {
  Raw = "raw", // raw values, no centering
  Zero = "zero", // same as Raw, but also includes zero
  MinMax = "minmax", // centered on midpoint of min-max
  Mean = "mean", // centered on mean
}

let _lastId = 0;

/** The Golden ratio. */
export const PHI = (1 + Math.sqrt(5)) / 2;
export const SQRT_PHI = Math.sqrt(PHI)

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
    return this.fullWidth / 2;
  }
  get fullWidth(): number {
    return this.max - this.min;
  }
  union(omm?: MinMaxable): MinMaxable {
    if (omm) {
      return new MinMaxable(
        Math.min(this.min, omm.min),
        Math.max(this.max, omm.max),
      );
    } else {
      return this;
    }
  }
  expandPercentage(percent: number): MinMaxable {
    return MinMaxable.fromMiddleHalfWidth(
      this.middle,
      this.halfWidth * percent,
    );
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

  notifyAmplitudeChange(_middle: number, _halfWidth: number) {
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

  constructor(alignmentTimeOffset: Duration, duration: Duration) {
    this.alignmentTimeOffset = alignmentTimeOffset;
    this.duration = duration;
  }

  notifyTimeRangeChange(_alignmentTimeOffset: Duration, _duration: Duration) {
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
      this.notifyAll().catch((m) => {
        util.warn(`problem recalc halfWidth: ${m}`);
      });
    }
  }

  /**
   * Links new Seismograph with this amplitude scale.
   *
   * @param   graphList Array of AmplitudeScalable to link
   */
  linkAll(
    graphList: Array<AmplitudeScalable | { amp_scalable: AmplitudeScalable }>,
  ) {
    graphList.forEach((graph) => {
      if ("notifyAmplitudeChange" in graph) {
        this._graphSet.add(graph);
      } else if ("amp_scalable" in graph) {
        this._graphSet.add(graph.amp_scalable);
      } else {
        // graph does not have notifyAmplitudeChange method or amp_scalable field, skipping
      }
    });
    this.recalculate().catch((m) => {
      util.warn(`problem recalc linkAll: ${m}`);
    });
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

    this.recalculate().catch((m) => {
      util.warn(`problem recalc unlink: ${m}`);
    });
  }

  /**
   * Recalculate the best amplitude scale for all Seismographs. Causes a redraw.
   *
   * @returns array of promise of best amp scales
   */
  recalculate(): Promise<Array<AmplitudeScalable>> {
    const maxHalfRange = this.graphList.reduce((acc, cur) => {
      return acc > cur.halfWidth ? acc : cur.halfWidth;
    }, 0);
    let promiseOut;
    if (this.halfWidth !== maxHalfRange) {
      this.halfWidth = maxHalfRange;
      promiseOut = this._internalNotifyAll();
    } else {
      // no change
      promiseOut = Promise.all(this.graphList.map((g) => Promise.resolve(g)));
    }
    return promiseOut;
  }
  _internalNotifyAll(): Promise<Array<AmplitudeScalable>> {
    const hw = this.halfWidth;
    return Promise.all(
      this.graphList.map((g) => {
        return new Promise<AmplitudeScalable>((resolve) => {
          setTimeout(() => {
            g.notifyAmplitudeChange(g.middle, hw);
            resolve(g);
          }, 10);
        });
      }),
    );
  }
  notifyAll(): Promise<Array<AmplitudeScalable>> {
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
  recalculate(): Promise<Array<AmplitudeScalable>> {
    // no-op, just notify
    return this.notifyAll();
  }
  notifyAll(): Promise<Array<AmplitudeScalable>> {
    return Promise.all(
      this.graphList.map((g) => {
        return new Promise<AmplitudeScalable>((resolve) => {
          setTimeout(() => {
            g.notifyAmplitudeChange(g.middle, g.halfWidth);
            resolve(g);
          }, 10);
        });
      }),
    );
  }
}

export class FixedHalfWidthAmplitudeScale extends LinkedAmplitudeScale {
  constructor(halfWidth: number, graphList?: Array<AmplitudeScalable>) {
    super(graphList);
    this._halfWidth = halfWidth;

  }
  recalculate(): Promise<Array<AmplitudeScalable>> {
    // no-op, just notify
    return this.notifyAll();
  }
  notifyAll(): Promise<Array<AmplitudeScalable>> {
    const hw = this.halfWidth;
    return Promise.all(
      this.graphList.map((g) => {
        return new Promise<AmplitudeScalable>((resolve) => {
          setTimeout(() => {
            g.notifyAmplitudeChange(g.middle, hw);
            resolve(g);
          }, 10);
        });
      }),
    );
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

  _prev_zoom_k: number = 1;
  _prev_zoom_x: number = 0;

  constructor(
    graphList?: Array<TimeScalable>,
    originalDuration?: Duration,
    originalOffset?: Duration,
    scaleId?: number,
  ) {
    if (scaleId) {
      this._scaleId = scaleId;
    } else {
      this._scaleId = -1;
    }
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
        return acc > cur.duration ? acc : cur.duration;
      }, Duration.fromMillis(0));
    }

    if (originalOffset) {
      this._originalOffset = originalOffset;
    } else {
      this._originalOffset = Duration.fromMillis(0);
    }
    this.recalculate().catch((m) => {
      util.warn(`problem recalc constructor: ${m}`);
    });
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
    graphList.forEach((graph) => {
      if ("notifyTimeRangeChange" in graph) {
        this._graphSet.add(graph);
      } else if ("time_scalable" in graph) {
        this._graphSet.add(graph.time_scalable);
      } else {
        //graph does not have notifyTimeRangeChange method or time_scalable field, skipping
      }
    });
    this.recalculate().catch((m) => {
      util.warn(`problem recalc linkAll: ${m}`);
    });
  }

  /**
   * Unlink TimeScalable with this amplitude scale.
   *
   * @param   graph TimeScalable to unlink
   */
  unlink(graph: TimeScalable) {
    this._graphSet.delete(graph);
    this.recalculate().catch((m) => {
      util.warn(`problem recalc unlink: ${m}`);
    });
  }

  zoom(startOffset: Duration, duration: Duration) {
    this._zoomedDuration = duration;
    this._zoomedOffset = startOffset;
    this.recalculate().catch((m) => {
      util.warn(`problem recalc zoom: ${m}`);
    });
  }

  /**
   * Return to original no-zoom zoom level
   */
  unzoom() {
    this._zoomedDuration = null;
    this._zoomedOffset = null;
    this.recalculate().catch((m) => {
      util.warn(`problem recalc unzoom: ${m}`);
    });
  }

  get offset(): Duration {
    return this._zoomedOffset ? this._zoomedOffset : this._originalOffset;
  }

  set offset(offset: Duration) {
    this._originalOffset = offset;
    this._zoomedOffset = offset;
    this.recalculate().catch((m) => {
      util.warn(`problem recalc set offset: ${m}`);
    });
  }

  get duration(): Duration {
    return isDef(this._zoomedDuration)
      ? this._zoomedDuration
      : this._originalDuration;
  }

  set duration(duration: Duration) {
    if (!isDef(duration)) {
      throw new Error(`Duration must be defined`);
    }
    this._originalDuration = duration;
    this._zoomedDuration = duration;
    this.recalculate().catch((m) => {
      util.warn(`problem recalc set duration: ${m}`);
    });
  }

  get origOffset(): Duration {
    return this._originalOffset;
  }
  get origDuration(): Duration {
    return this._originalDuration;
  }

  /**
   * Recalculate the best time scale for all Seismographs. Causes a redraw.
   * @returns promise to array of all linked items
   */
  recalculate(): Promise<Array<TimeScalable>> {
    if (
      !isDef(this._zoomedDuration) ||
      this._originalDuration.toMillis() === 0
    ) {
      this.graphList.forEach((graph) => {
        if (graph && graph.duration > this._originalDuration) {
          this._originalDuration = graph.duration;
        }
      });
    }
    return this.notifyAll();
  }
  notifyAll(): Promise<Array<TimeScalable>> {
    return Promise.all(
      this.graphList.map((g) => {
        return new Promise<TimeScalable>((resolve) => {
          setTimeout(() => {
            if (g != null) {
              g.notifyTimeRangeChange(this.offset, this.duration);
            }
            resolve(g);
          }, 10);
        });
      }),
    );
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
    scaleId?: number,
  ) {
    super(graphList, originalDuration, originalOffset, scaleId);
  }

  /**
   * Does no calculation, just causes a redraw.
   * @returns promise to all linked items
   */
  recalculate(): Promise<Array<TimeScalable>> {
    return this.notifyAll();
  }
  notifyAll(): Promise<Array<TimeScalable>> {
    return Promise.all(
      this.graphList.map((g) => {
        return new Promise<TimeScalable>((resolve) => {
          setTimeout(() => {
            if (g != null) {
              g.notifyTimeRangeChange(this.offset, this.duration);
            }
            resolve(g);
          }, 10);
        });
      }),
    );
  }
}

export class PanZoomer {
  isMouseDown: boolean = false;
  _target: HTMLElement|SVGSVGElement|SVGForeignObjectElement;
  width: number;
  linkedTimeScale: LinkedTimeScale;
  wheelZoom: boolean = false;
  _prev_zoom_k: number = 1;
  _prev_zoom_x: number = 0;
  min_k = 1/8192;
  max_k = 8192
  constructor(target: HTMLElement|SVGSVGElement|SVGForeignObjectElement,
              linkedTimeScale: LinkedTimeScale,
              wheelZoom?: boolean) {
    this._target = target;
    this.target = target; // run setter
    this.width = target.getBoundingClientRect().width;
    this.linkedTimeScale = linkedTimeScale;
    this.wheelZoom = (wheelZoom)?true:false;
  }
  set target(target: HTMLElement|SVGSVGElement|SVGForeignObjectElement) {
    this._target = target;

    target.addEventListener("mousedown",
      (event: Event) => {
        const me = event as MouseEvent;
        this.isMouseDown = true;
        this.linkedTimeScale._prev_zoom_x = me.offsetX;
      });
    target.addEventListener("mousemove",
      (event: Event) => {
        const me = event as MouseEvent;
        if (this.isMouseDown) {
          this.doZoom(this.linkedTimeScale._prev_zoom_k, me.offsetX, this.width);
        }
      });
    target.addEventListener("mouseup", (event: Event) => {
      this.isMouseDown = false;
    });
    target.addEventListener("mouseleave", (event: Event) => {
      this.isMouseDown = false;
    });
    target.addEventListener("dblclick", (event: Event) => {
      this.isMouseDown = false;
      event.preventDefault();
      const me = event as MouseEvent;
      let factor = PHI;
      if (me.shiftKey) {
        factor = 1/factor;
      }
      const offsetX = me.offsetX;

      this.transitionZoom(factor, offsetX);

    });

    target.addEventListener("wheel", (event: Event) => {
      if (this.wheelZoom) {
        this.isMouseDown = false;
        const we = event as WheelEvent;
        event.preventDefault();
        const offsetX = we.offsetX;
        // wheel does fire mousedown, so need to set prev offsetX
        this.linkedTimeScale._prev_zoom_x = offsetX;
        //const factor = we.deltaY>=0 ? 1/SQRT_PHI : SQRT_PHI;
        const factor = we.deltaY>=0 ? SQRT_PHI : 1/SQRT_PHI;

        this.transitionZoom(factor, offsetX, 100);
      }
    });

    this.width = target.getBoundingClientRect().width;
  }
  get target(): HTMLElement|SVGSVGElement|SVGForeignObjectElement {
    return this._target
  }
  transitionZoom(factor: number, offsetX: number, duration: number=250) {
    const start_k = this.linkedTimeScale._prev_zoom_k;
    const end_k = this.linkedTimeScale._prev_zoom_k*factor;
    const width = this.width;

    transition((step) => {
      let transK = start_k+(end_k-start_k)*step;
      this.doZoom(transK, offsetX, width);
      if (step === 1.0) {
      }
    }, duration);
  }
  doZoom(k: number, x: number, width: number) {
    if (k < this.min_k) { k=this.min_k;}
    if (k > this.max_k) { k=this.max_k;}
    if (this.linkedTimeScale._prev_zoom_k === k &&
        this.linkedTimeScale._prev_zoom_x === x) {
      return;
    }
    const linkedTS = this.linkedTimeScale;
    //const currStart = linkedTS.offset;
    const currDuration = linkedTS.duration;

    let zoomDuration = currDuration;
    const zoomDurationMillis = linkedTS.origDuration.toMillis() / k ;
    let timeShift = 0;

    if (k != this.linkedTimeScale._prev_zoom_k) {
      // zoom in, keep click time at same pixel
      zoomDuration = Duration.fromMillis(zoomDurationMillis);
      timeShift = (x/width)*(currDuration.toMillis()-zoomDurationMillis);
    } else {
      // pan seismogram, shift by pixel difference
      timeShift = zoomDurationMillis * (this.linkedTimeScale._prev_zoom_x-x)/width;
      this.linkedTimeScale._prev_zoom_x = x;
    }
    const zoomStart = linkedTS.offset.plus(Duration.fromMillis(timeShift));
    linkedTS.zoom(
      zoomStart,
      zoomDuration
    );
    this.linkedTimeScale._prev_zoom_k = k;
    this.linkedTimeScale._prev_zoom_x = x;
  }
}
