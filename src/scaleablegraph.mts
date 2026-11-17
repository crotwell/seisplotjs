import { Duration, Interval } from "luxon";
import { scaleLinear as d3scaleLinear } from "d3-scale";
import type { ScaleLinear } from "d3-scale";

import {
  AmplitudeScalable, TimeScalable, MinMaxable, ZERO_DURATION
} from "./scale.mjs";
import { SeismographConfig } from "./seismographconfig.mjs";
import { SeisPlotElement } from "./spelement.mjs";
import {
  SeismogramDisplayData,
  calcMinMax,
  findMaxDuration,
  findMinMax,
  findMinMaxOverTimeRange,
  findMinMaxOverRelativeTimeRange,
} from "./seismogram.mjs";
import {
  isDef, warn
 } from "./util.mjs";

export class ScalableGraph extends SeisPlotElement {

  time_scalable: SeismographTimeScalable;
  amp_scalable: SeismographAmplitudeScalable;
  constructor(
    seisData?: SeismogramDisplayData | Array<SeismogramDisplayData>,
    seisConfig?: SeismographConfig,
  ) {
    super(seisData, seisConfig);

    const alignmentTimeOffset = Duration.fromMillis(0);
    const maxDuration = findMaxDuration(this.seisData);

    this.time_scalable = new SeismographTimeScalable(
      this,
      alignmentTimeOffset,
      maxDuration,
    );

    if (isDef(this.seismographConfig.linkedTimeScale)) {
      this.seismographConfig.linkedTimeScale.link(this.time_scalable);
    }

    this.calcTimeScaleDomain();
    this.amp_scalable = new SeismographAmplitudeScalable(this);

    if (this.seismographConfig.linkedAmplitudeScale) {
      this.seismographConfig.linkedAmplitudeScale.link(this.amp_scalable);
    }
  }


  get seismographConfig() {
    return super.seismographConfig;
  }
  set seismographConfig(seismographConfig: SeismographConfig) {
    if (isDef(this.seismographConfig.linkedTimeScale)) {
      this.seismographConfig.linkedTimeScale.unlink(this.time_scalable);
    }
    if (this.seismographConfig.linkedAmplitudeScale) {
      this.seismographConfig.linkedAmplitudeScale.unlink(this.amp_scalable);
    }
    super.seismographConfig = seismographConfig;
    if (isDef(this.seismographConfig.linkedTimeScale)) {
      this.seismographConfig.linkedTimeScale.link(this.time_scalable);
    }
    if (this.seismographConfig.linkedAmplitudeScale) {
      this.seismographConfig.linkedAmplitudeScale.link(this.amp_scalable);
    }

    this.redraw();
  }

  connectedCallback() {
    if (this.seismographConfig.linkedAmplitudeScale) {
      this.seismographConfig.linkedAmplitudeScale.recalculate().catch((e) => warn(e));
    } else {
      this.redraw();
    }
  }
  disconnectedCallback() {
    if (this.seismographConfig.linkedAmplitudeScale) {
      this.seismographConfig.linkedAmplitudeScale.unlink(this.amp_scalable);
    }
    if (this.seismographConfig.linkedTimeScale) {
      this.seismographConfig.linkedTimeScale.unlink(this.time_scalable);
    }
  }

  /**
   * Update the duration if not already set. This only matters for
   * linkedTimeScale currently.
   */
  calcTimeScaleDomain(): void {
    if (isDef(this.seismographConfig.linkedTimeScale)) {
      const linkedTimeScale = this.seismographConfig.linkedTimeScale;
      if (
        this._seisDataList.length !== 0 &&
        linkedTimeScale.duration.toMillis() === 0
      ) {
        this.seismographConfig.linkedTimeScale.duration = findMaxDuration(
          this._seisDataList,
        );
      }
    }
  }

  /**
   * Notification to the element that something about the current seismogram
   * data has changed. This could be that the actual waveform data has been updated
   * or that auxillary data like quake or channel has been added. This should
   * trigger a redraw.
   */
  seisDataUpdated() {
    this.calcTimeScaleDomain();
    let ampMinMax = this.calcAmpScaleDomain();
    if (this.isConnected) {
      this.redraw();
      // only trigger a draw if appending after already drawn on screen
      // otherwise, just append the data and wait for outside to call first draw()
      //this.drawSeismograms();
      if (this.seismographConfig.linkedAmplitudeScale) {
        this.seismographConfig.linkedAmplitudeScale.recalculate().catch((e) => warn(e));
      }
    }
  }

  recheckAmpScaleDomain(): Promise<AmplitudeScalable> {
    const calcMidHW = this.calcAmpScaleDomain();
    const oldMiddle = this.amp_scalable.middle;
    const oldHalfWidth = this.amp_scalable.halfWidth;
    this.amp_scalable.minMax = calcMidHW;

    if (this.seismographConfig.linkedAmplitudeScale) {
      if (
        this.amp_scalable.middle !== oldMiddle ||
        this.amp_scalable.halfWidth !== oldHalfWidth
      ) {
        return this.seismographConfig.linkedAmplitudeScale
          .recalculate() // sets yScale.domain
          .catch((m) => {
            // eslint-disable-next-line no-console
            console.warn(`problem recalc amp scale: ${m}`);
          }).then(() => {return this.amp_scalable;});
      }
    }
    return Promise.resolve(this.amp_scalable);
  }

  /**
   * Calculate the amplitude range over the current time range, depending
   * on amplitude style.
   *
   * @returns min max over the time range
   */
  calcAmpScaleDomain(): MinMaxable {
    return calcAmpScaleWithConfig(this._seisDataList, this.seismographConfig);
  }


  ampRangeForSeisDisplayData(
    sdd: SeismogramDisplayData,
  ): MinMaxable {
    let out: MinMaxable;
    if (this.seismographConfig.linkedAmplitudeScale) {
      let sensitivityVal = 1;
      if (
        this.seismographConfig.doGain &&
        sdd.seismogram?.isYUnitCount() &&
        sdd.sensitivity?.sensitivity
      ) {
        sensitivityVal = sdd.sensitivity.sensitivity;
      }
      const sddInterval = this.displayTimeRangeForSeisDisplayData(sdd);
      const minMax = calcMinMax(
        sdd,
        sddInterval,
        false,
        this.seismographConfig.amplitudeMode,
      );
      if (minMax) {
        if (this.amp_scalable.drawHalfWidth===0.0) {
          this.amp_scalable.drawHalfWidth = minMax.halfWidth;
          this.amp_scalable.minMax = minMax;
          if (this.seismographConfig.linkedAmplitudeScale) {
            this.seismographConfig.linkedAmplitudeScale.recalculate();
          }
        }
        const drawHalfWidth = this.amp_scalable.drawHalfWidth;
        console.log(`ampRangeForSeisDisplayData: minMax: ${minMax}  sens: ${sensitivityVal}  dhw: ${drawHalfWidth}`)
        // if doGain, halfWidth is in real world units, so mul sensitivity to
        // get counts for drawing
        const myMin = minMax.middle - drawHalfWidth / sensitivityVal;
        const myMax = minMax.middle + drawHalfWidth / sensitivityVal;
        out = new MinMaxable(myMin, myMax);
      } else {
        out = new MinMaxable(-1, 1);
      }
    } else if (this.seismographConfig.fixedAmplitudeScale) {
      const aScale = this.seismographConfig.fixedAmplitudeScale;
      out = new MinMaxable(aScale[0], aScale[1]);
    } else {
      throw new Error(
        "ampRangeForSeisDisplayData Must be either linked or fixed amp scale",
      );
    }
    console.log(`ampRangeForSeisDisplayData: ${out} `)

    return out;
  }

  ampScaleForAxis(pixelDimension: [number, number]): ScaleLinear<number, number, never> {
    const ampAxisScale = this.__initAmpScale(pixelDimension, false);
    if (this.seismographConfig.fixedAmplitudeScale) {
      ampAxisScale.domain(this.seismographConfig.fixedAmplitudeScale);
    } else if (this.seismographConfig.linkedAmplitudeScale) {
      let middle;
      if (this.seismographConfig.isCenteredAmp()) {
        middle = 0;
      } else {
        middle = this.amp_scalable.drawMiddle;
      }
      console.log(`ampScaleForAxis  HW: ${this.amp_scalable.drawHalfWidth}`)
      ampAxisScale.domain([
        middle - this.amp_scalable.drawHalfWidth,
        middle + this.amp_scalable.drawHalfWidth,
      ]);
    } else {
      throw new Error(
        "ampScaleForAxis Must be either linked or fixed amp scale",
      );
    }
    return ampAxisScale;
  }


  /**
   * Creates amp scale, set range based on pixelDimension.
   * @private
   * @returns amp scale with range set
   */
  __initAmpScale(pixelDimension: [number, number], scaleForResolution: boolean = false): ScaleLinear<number, number, never> {
    const ampAxisScale = d3scaleLinear();
    // don't use top,bot pixel, somehow line at top amp disappears if [this.height, 0]
    const resolutionScale =
      (scaleForResolution ? (this.seismographConfig.resolutionScale)
      : 1);
    ampAxisScale.range([pixelDimension[0]*resolutionScale, pixelDimension[1]*resolutionScale]);
    return ampAxisScale;
  }


  recalcDisplayTimeRangeForSeisDisplayData(sdd: SeismogramDisplayData): Promise<Interval> {
    let recalcPromise: Promise<void> = Promise.resolve();
    const linkedTimeScale = this.seismographConfig.linkedTimeScale;
    if (linkedTimeScale) {
      if (this.time_scalable.drawDuration.equals(ZERO_DURATION)) {
        recalcPromise = recalcPromise.then( () => {
          return linkedTimeScale.recalculate().catch((m) => {
            // eslint-disable-next-line no-console
            console.warn(
              `problem recalc displayTimeRangeForSeisDisplayData: ${m}`,
            );
          }).then( () => {});
        });
      }
    }
    return recalcPromise.then( () => {
      return this.displayTimeRangeForSeisDisplayData(sdd);
    });
  }

  displayTimeRangeForSeisDisplayData(sdd: SeismogramDisplayData): Interval {
    let plotInterval: Interval;
    if (this.seismographConfig.linkedTimeScale) {

        // drawDuration should be set via recalculate now
        const startOffset = this.time_scalable.drawAlignmentTimeOffset;
        const duration = this.time_scalable.drawDuration;
        plotInterval =  sdd.relativeTimeWindow(startOffset, duration);
    } else if (this.seismographConfig.fixedTimeScale) {
      plotInterval =  this.seismographConfig.fixedTimeScale;
    } else {
      throw new Error("Must be either fixed or linked time scale");
    }
    return plotInterval;
  }
}


export class SeismographAmplitudeScalable extends AmplitudeScalable {
  graph: ScalableGraph;
  drawHalfWidth: number;
  drawMiddle: number;
  constructor(graph: ScalableGraph) {
    const calcMidHW = graph.calcAmpScaleDomain();
    super(calcMidHW);
    this.graph = graph;
    this.drawHalfWidth = super.halfWidth;
    this.drawMiddle = super.middle;
  }
  notifyAmplitudeChange(middle: number, halfWidth: number) {
    console.log(`notifyAmplitudeChange( ${middle}, ${halfWidth})`)
    if (middle !== this.drawMiddle || halfWidth !== this.drawHalfWidth) {
      this.drawMiddle = middle;
      this.drawHalfWidth = halfWidth;

      if (!this.graph.isConnected) {
        // only trigger a draw if appending after already drawn on screen
        // otherwise, just append the data and wait for outside to call first draw()
        window.requestAnimationFrame(() => {
          this.graph.redraw();
        });
      }
    }
  }
}

export class SeismographTimeScalable extends TimeScalable {
  graph: ScalableGraph;
  drawAlignmentTimeOffset: Duration;
  drawDuration: Duration;
  constructor(
    graph: ScalableGraph,
    alignmentTimeOffset: Duration,
    duration: Duration,
  ) {
    super(alignmentTimeOffset, duration);
    this.graph = graph;
    this.drawAlignmentTimeOffset = ZERO_DURATION;
    this.drawDuration = ZERO_DURATION;
  }

  notifyTimeRangeChange(offset: Duration, duration: Duration) {
    if (
      !this.drawAlignmentTimeOffset.equals(offset) ||
      !this.drawDuration.equals(duration)
    ) {
      this.drawAlignmentTimeOffset = offset;
      this.drawDuration = duration;
      // something changed, maybe redraw
      if (isDef(this.graph) && this.graph.isConnected) {
        window.requestAnimationFrame(() => {
          this.graph.redraw();
        });
      }
    }
  }
}


/**
 * Calculate the amplitude range over the current time range, depending
 * on amplitude style.
 *
 * @returns min max over the time range
 */
export function calcAmpScaleWithConfig(seisDataList: Array<SeismogramDisplayData>,
                                  seismographConfig: SeismographConfig): MinMaxable {
  let minMax;
  if (seismographConfig.fixedAmplitudeScale) {
    minMax = MinMaxable.fromArray(seismographConfig.fixedAmplitudeScale);
  } else {
    if (seismographConfig.windowAmp) {
      if (isDef(seismographConfig.linkedTimeScale)) {
        minMax = findMinMaxOverRelativeTimeRange(
          seisDataList,
          seismographConfig.linkedTimeScale.offset,
          seismographConfig.linkedTimeScale.duration,
          seismographConfig.doGain,
          seismographConfig.amplitudeMode,
        );
      } else if (isDef(seismographConfig.fixedTimeScale)) {
        minMax = findMinMaxOverTimeRange(
          seisDataList,
          seismographConfig.fixedTimeScale,
          seismographConfig.doGain,
          seismographConfig.amplitudeMode,
        );
      } else {
        throw new Error("neither fixed nor linked time scale");
      }
    } else {
      minMax = findMinMax(
        seisDataList,
        seismographConfig.doGain,
        seismographConfig.amplitudeMode,
      );
    }

    if (minMax.halfWidth === 0) {
      // flatlined data, use -1, +1
      //minMax = [minMax[0] - 1, minMax[1] + 1];
    }
    if (seismographConfig.isYAxisNice) {
      // use d3 scale's nice function
      let scale = d3scaleLinear();
      scale.domain(minMax.asArray());
      scale = scale.nice();
      minMax = MinMaxable.fromArray(scale.domain());
    }
  }
  console.log(`minMax calcAmpScaleWithConfig: ${minMax}`)
  return minMax;
}
