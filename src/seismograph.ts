/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * https://www.seis.sc.edu
 */
import { DateTime, Duration, Interval } from "luxon";
import { select as d3select } from "d3-selection";
import "d3-transition";

import { scaleLinear as d3scaleLinear } from "d3-scale";
import {
  axisLeft as d3axisLeft,
  axisBottom as d3axisBottom,
  axisTop as d3axisTop,
  axisRight as d3axisRight,
} from "d3-axis";

import { AUTO_COLOR_SELECTOR } from "./cssutil";
import { AmplitudeScalable, TimeScalable, MinMaxable } from "./scale";
import { SeismographConfig, numberFormatWrapper } from "./seismographconfig";
import {
  createMarkersForTravelTimes,
  createMarkerForOriginTime,
  createFullMarkersForQuakeAtStation,
  createFullMarkersForQuakeAtChannel,
  createMarkerForQuakePicks,
  createMarkerForPicks,
} from "./seismographmarker";
// re-export for compatibility with ver 3.1.3
export {
  createMarkersForTravelTimes,
  createMarkerForOriginTime,
  createFullMarkersForQuakeAtStation,
  createFullMarkersForQuakeAtChannel,
  createMarkerForQuakePicks,
  createMarkerForPicks,
};
import {
  clearCanvas,
  DEFAULT_MAX_SAMPLE_PER_PIXEL,
  drawAllOnCanvas,
  drawXScaleGridLines,
  drawYScaleGridLines,
} from "./seismographutil";
import { XHTML_NS } from "./util";
import type { MarkerType } from "./seismographmarker";
import type { HandlebarsInput } from "./axisutil";
import type { Axis } from "d3-axis";
import type { ScaleLinear, NumberValue as d3NumberValue } from "d3-scale";
import type { Selection } from "d3-selection";

import {PanZoomer} from "./scale";
import {
  SeismogramDisplayData,
  calcMinMax,
  findMaxDuration,
  findMinMax,
  findMinMaxOverTimeRange,
  findMinMaxOverRelativeTimeRange,
  Seismogram,
  COUNT_UNIT,
} from "./seismogram";
import { SeisPlotElement } from "./spelement";
import * as axisutil from "./axisutil";
import * as util from "./util"; // for util.log to replace console.log

import { isDef, isNumArg, validStartTime, validEndTime } from "./util";
import { registerHelpers } from "./handlebarshelpers";
registerHelpers();

const CLIP_PREFIX = "seismographclip";
export type BBoxType = {
  height: number;
  width: number;
};
export type MarkerHolderType = {
  marker: MarkerType;
  sdd: SeismogramDisplayData;
  xscale: axisutil.LuxonTimeScale;
  bbox?: BBoxType;
};

export const SEIS_CLICK_EVENT = "seisclick";
export const SEIS_MOVE_EVENT = "seismousemove";

export const SEISMOGRAPH_ELEMENT = "sp-seismograph";
export const seismograph_css = `

:host {
  display: block;
  min-height: 50px;
  height: 100%;
}

div.wrapper {
  min-height: 50px;
  height: 100%;
}

@property --sp-seismograph-is-xlabel {
  syntax: "<number>";
  inherits: true;
  initial-value: 1;
}

@property --sp-seismograph-is-xsublabel {
  syntax: "<number>";
  inherits: true;
  initial-value: 1;
}

@property --sp-seismograph-is-ylabel {
  syntax: "<number>";
  inherits: true;
  initial-value: 1;
}

@property --sp-seismograph-is-ysublabel {
  syntax: "<number>";
  inherits: true;
  initial-value: 1;
}

@property --sp-seismograph-display-title {
  syntax: "<number>";
  inherits: true;
  initial-value: 1;
}

.marker {
  opacity: 0.4;
}

.marker .markerpath {
  fill: none;
  stroke: black;
  stroke-width: 1px;
}

.marker polygon {
  fill: rgba(150,220,150,.4);
}

.marker.predicted polygon {
  fill: rgba(220,220,220,.4);
}

.marker.pick polygon {
  fill: rgba(255,100,100,.4);
}

path.seispath {
  stroke: skyblue;
  fill: none;
  stroke-width: 1px;
}

path.orientZ {
  stroke: seagreen;
}

path.orientN {
  stroke: cornflowerblue;
}

path.orientE {
  stroke: orange;
}

path.alignment {
  stroke-dasharray: 8;
  stroke-width: 2px;
}

svg.seismograph {
  height: 100%;
  width: 100%;
  min-height: 25px;
  min-width: 25px;
}

svg.seismograph g.ySublabel text {
  font-size: smaller;
}

svg.seismograph g.xSublabel text {
  font-size: smaller;
}

svg.seismograph text.title {
  font-size: larger;
  font-weight: bold;
  fill: black;
  color: black;
}

svg.realtimePlot g.allseismograms path.seispath {
  stroke: skyblue;
}

/* links in svg */
svg.seismograph text a {
  fill: #0000EE;
  text-decoration: underline;
}


`;

export const COLOR_CSS_ID = "seismographcolors";

/* A seismogram plot, using d3. The actual waveform can be drawn
 * with a separate Canvas (default) or with SVG.
 * Note that for SVG you must have
 * stroke and fill set in css like:<br>
 * path.seispath {
 *   stroke: skyblue;
 *   fill: none;
 * }<br/>
 * in order to have the seismogram display.
 */
export class Seismograph extends SeisPlotElement {
  /** @private */
  static _lastID: number;
  plotId: number;
  beforeFirstDraw: boolean;
  /** @private */
  _debugAlignmentSeisData: Array<SeismogramDisplayData>;
  width: number;
  height: number;
  outerWidth: number;
  outerHeight: number;
  svg: Selection<SVGSVGElement, unknown, null, undefined>;
  canvasHolder: null | Selection<
    SVGForeignObjectElement,
    unknown,
    null,
    undefined
  >;
  canvas: null | Selection<HTMLCanvasElement, unknown, null, undefined>;

  g: Selection<SVGGElement, unknown, null, undefined>;
  throttleRescale: ReturnType<typeof setTimeout> | null;
  throttleRedraw: ReturnType<typeof requestAnimationFrame> | null;
  time_scalable: SeismographTimeScalable;
  amp_scalable: SeismographAmplitudeScalable;

  panZoomer?: PanZoomer;

  _resizeObserver: ResizeObserver;
  minmax_sample_pixels = DEFAULT_MAX_SAMPLE_PER_PIXEL;
  constructor(
    seisData?: SeismogramDisplayData | Array<SeismogramDisplayData>,
    seisConfig?: SeismographConfig,
  ) {
    super(seisData, seisConfig);
    this.outerWidth = -1;
    this.outerHeight = -1;
    this.throttleRescale = null;
    this.throttleRedraw = null;

    this.plotId = ++Seismograph._lastID;
    this.beforeFirstDraw = true;

    this._debugAlignmentSeisData = [];
    this.width = 200;
    this.height = 100;


    const wrapper = document.createElement("div");
    wrapper.setAttribute("class", "wrapper");
    this.addStyle(seismograph_css);
    const lineColorsCSS = this.seismographConfig.createCSSForLineColors();
    this.addStyle(lineColorsCSS, COLOR_CSS_ID);
    this.getShadowRoot().appendChild(wrapper);

    this.canvas = null;
    this.canvasHolder = null;

    this.svg = d3select(wrapper).append("svg").style("z-index", 100);
    const svgNode = this.svg.node();
    if (svgNode != null) {
      wrapper.appendChild(svgNode);
    }

    if (
      isDef(this.seismographConfig.minHeight) &&
      isNumArg(this.seismographConfig.minHeight) &&
      this.seismographConfig.minHeight > 0
    ) {
      const minHeight = this.seismographConfig.minHeight;

      this.svg.style("min-height", minHeight + "px");
    }

    if (
      isNumArg(this.seismographConfig.maxHeight) &&
      this.seismographConfig.maxHeight > 0
    ) {
      this.svg.style("max-height", this.seismographConfig.maxHeight + "px");
    }

    if (
      isNumArg(this.seismographConfig.minWidth) &&
      this.seismographConfig.minWidth > 0
    ) {
      const minWidth = this.seismographConfig.minWidth;

      this.svg.style("min-width", minWidth + "px");
    }

    if (
      isNumArg(this.seismographConfig.maxWidth) &&
      this.seismographConfig.maxWidth > 0
    ) {
      this.svg.style("max-width", this.seismographConfig.maxWidth + "px");
    }

    this.svg.classed("seismograph", true);
    this.svg.classed(AUTO_COLOR_SELECTOR, true);
    this.svg.attr("plotId", this.plotId);

    const alignmentTimeOffset = Duration.fromMillis(0);
    let maxDuration = Duration.fromMillis(0);
    maxDuration = findMaxDuration(this.seisData);

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
    this.redoDisplayYScale();

    this.g = this.svg
      .append("g")
      .classed("marginTransform", true)
      .attr(
        "transform",
        "translate(" +
          this.seismographConfig.margin.left +
          "," +
          this.seismographConfig.margin.top +
          ")",
      );
    this.g
      .append("g")
      .classed("allseismograms", true)
      .classed(AUTO_COLOR_SELECTOR, true);

    // create marker g
    this.g
      .append("g")
      .attr("class", "allmarkers")
      .attr("style", "clip-path: url(#" + CLIP_PREFIX + this.plotId + ")");

    // set up to redraw if size changes
    this._resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target instanceof Seismograph) {
          const graph = entry.target;
          const rect = entry.contentRect;
          if (
            !graph.beforeFirstDraw &&
            (rect.width !== graph.outerWidth ||
              rect.height !== graph.outerHeight)
          ) {
            graph.redraw();
          }
        }
      }
    });
    this._resizeObserver.observe(this);

    // event listener to transform mouse click into time
    this.addEventListener("click", (evt) => {
      const detail = this.calcDetailForEvent(evt, "click");
      const event = new CustomEvent(SEIS_CLICK_EVENT,
        { detail: detail,
          bubbles: true,
          cancelable: false,
          composed: true
        }
      );
      this.dispatchEvent(event);
    });
    this.addEventListener("mousemove", (evt) => {
      const detail = this.calcDetailForEvent(evt, "mousemove");
      const event = new CustomEvent(SEIS_MOVE_EVENT,
        { detail: detail,
          bubbles: true,
          cancelable: false,
          composed: true
        }
      );
      this.dispatchEvent(event);
    });
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
      this.beforeFirstDraw = false;
      this.seismographConfig.linkedAmplitudeScale.recalculate();
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
  attributeChangedCallback(_name: string, _oldValue: string, _newValue: string) {
    this.redraw();
  }

  checkResize(): boolean {
    const wrapper = this.getShadowRoot().querySelector("div") as HTMLDivElement;
    const svgEl = wrapper.querySelector("svg") as SVGElement;
    const rect = svgEl.getBoundingClientRect();

    if (rect.width !== this.outerWidth || rect.height !== this.outerHeight) {
      return true;
    }

    return false;
  }

  draw(): void {
    if (!this.isConnected) {
      return;
    }
    if (this.panZoomer && this.seismographConfig.linkedTimeScale) {
      // in case update in seisConfig after creation
      this.panZoomer.linkedTimeScale = this.seismographConfig.linkedTimeScale;
      this.panZoomer.wheelZoom = this.seismographConfig.wheelZoom;
    }
    const wrapper = this.getShadowRoot().querySelector("div") as HTMLDivElement;
    const svgEl = wrapper.querySelector("svg") as SVGElement;
    const rect = svgEl.getBoundingClientRect();

    if (rect.width === 0 || rect.height === 0) {
      util.log(
        `Attempt draw seismograph, but width/height too small: ${rect.width} ${rect.height}`,
      );
      return;
    }

    let calcHeight = rect.height;

    if (rect.width !== this.outerWidth || rect.height !== this.outerHeight) {
      if (
        isNumArg(this.seismographConfig.minHeight) &&
        calcHeight < this.seismographConfig.minHeight
      ) {
        calcHeight = this.seismographConfig.minHeight;
      }

      if (
        isNumArg(this.seismographConfig.maxHeight) &&
        calcHeight > this.seismographConfig.maxHeight
      ) {
        calcHeight = this.seismographConfig.maxHeight;
      }
    }
    this.calcWidthHeight(rect.width, calcHeight);

    this.g.attr(
      "transform",
      `translate(${this.seismographConfig.margin.left}, ${this.seismographConfig.margin.top} )`,
    );
    if (this.canvas && this.canvasHolder) {
      this.canvasHolder.attr("width", this.width).attr("height", this.height);
      this.canvasHolder.attr("x", this.seismographConfig.margin.left);
      this.canvasHolder.attr("y", this.seismographConfig.margin.top);
      this.canvas.attr("width", this.width).attr("height", this.height);
    } else {
      const svg = d3select(svgEl);
      this.canvasHolder = svg
        .insert("foreignObject", ":first-child")
        .classed("seismograph", true)
        .attr("x", this.seismographConfig.margin.left)
        .attr("y", this.seismographConfig.margin.top)
        .attr("width", this.width)
        .attr("height", this.height);
      if (this.canvasHolder == null) {
        throw new Error("canvasHolder is null");
      }
      const c = this.canvasHolder
        .append("xhtml:canvas")
        .classed("seismograph", true)
        .attr("xmlns", XHTML_NS)
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", this.width)
        .attr("height", this.height);
      this.canvas = c as unknown as Selection<
        HTMLCanvasElement,
        unknown,
        null,
        undefined
      >;
      if (this.seismographConfig.linkedTimeScale) {
        const canvasHolderNode = this.canvasHolder.node();
        if (!this.panZoomer && canvasHolderNode) {
          this.panZoomer = new PanZoomer(canvasHolderNode, this.seismographConfig.linkedTimeScale, this.seismographConfig.wheelZoom);
        } else if (this.panZoomer && canvasHolderNode) {
          this.panZoomer.target = canvasHolderNode;
        }
      }
    }

    this.drawSeismograms();
    this.drawAxis();
    const unitsLabel = this.seismographConfig.ySublabelIsUnits
      ? this.createUnitsLabel()
      : "";
    axisutil.drawAxisLabels(
      svgEl,
      this.seismographConfig,
      this.height,
      this.width,
      this.createHandlebarsInput(),
      unitsLabel,
    );

    if (this.seismographConfig.doMarkers) {
      this.drawMarkers();
    }

    this.beforeFirstDraw = false;
  }

  printSizes(): void {
    const wrapper = this.getShadowRoot().querySelector("div") as HTMLDivElement;
    const svgEl = wrapper.querySelector("svg") as SVGElement;
    let out = "";
    const rect = svgEl.getBoundingClientRect();
    out += "svg rect.height " + rect.height + "\n";
    out += "svg rect.width " + rect.width + "\n";
    const grect = this.getBoundingClientRect();
    out += "parent rect.height " + grect.height + "\n";
    out += "parent rect.width " + grect.width + "\n";
    const cnode = this.canvas?.node();
    const crect = cnode?.getBoundingClientRect();
    if (this.canvas && cnode && crect) {
      out += "c rect.height " + crect.height + "\n";
      out += "c rect.width " + crect.width + "\n";
      out += "c style.height " + this.canvas.style("height") + "\n";
      out += "c style.width " + this.canvas.style("width") + "\n";
      out += "this.height " + this.height + "\n";
      out += "this.width " + this.width + "\n";
      out += "canvas.height " + cnode.height + "\n";
      out += "canvas.width " + cnode.width + "\n";
      out += "this.outerHeight " + this.outerHeight + "\n";
      out += "this.outerWidth " + this.outerWidth + "\n";
      const m = this.seismographConfig.margin;
      out += m ? `this.margin ${String(m)}\n` : `this.margin null\n`;
    } else {
      out += "crect bounding rect is null\n";
    }
    util.log(out);
  }
  calcDetailForEvent(evt: MouseEvent, _type?: string): SeisMouseEventType {
    const margin = this.seismographConfig.margin;
    const mouseTimeVal = this.timeScaleForAxis().invert(
      evt.offsetX - margin.left,
    );
    const mouseAmp = this.ampScaleForAxis().invert(evt.offsetY - margin.top);
    const out = {
      mouseevent: evt,
      time: null,
      relative_time: null,
      amplitude: mouseAmp,
      seismograph: this,
    } as SeisMouseEventType;
    if (mouseTimeVal instanceof DateTime) {
      out.time = mouseTimeVal;
    } else {
      // relative time in seconds
      out.relative_time = Duration.fromMillis(mouseTimeVal * 1000);
    }
    return out;
  }

  isVisible(): boolean {
    const elem = this.canvas?.node();

    if (!elem) {
      return false;
    }

    return !!(
      elem.offsetWidth ||
      elem.offsetHeight ||
      elem.getClientRects().length
    );
  }

  drawSeismograms(): void {
    if (!this.isVisible()) {
      // no need to draw if we are not visible
      return;
    }
    const canvas = this.canvas?.node();
    if (!canvas) {
      return;
    }
    clearCanvas(canvas);
    if (this.seismographConfig.xGridLines) {
      drawXScaleGridLines(
        canvas,
        this.timeScaleForAxis(),
        this.seismographConfig.gridLineColor,
      );
    }
    if (this.seismographConfig.yGridLines) {
      drawYScaleGridLines(
        canvas,
        this.ampScaleForAxis(),
        this.seismographConfig.gridLineColor,
      );
    }
    drawAllOnCanvas(
      canvas,
      this._seisDataList,
      this._seisDataList.map((sdd) => this.timeScaleForSeisDisplayData(sdd)),
      this._seisDataList.map((sdd) => this.ampScaleForSeisDisplayData(sdd)),
      this._seisDataList.map((_sdd, ti) =>
        this.seismographConfig.getColorForIndex(ti),
      ),
      this.seismographConfig.lineWidth,
      this.seismographConfig.connectSegments,
      this.minmax_sample_pixels,
    );
  }

  calcScaleAndZoom(): void {
    this.rescaleYAxis();
    // check if clip exists, wonky d3 convention
    const container = this.svg
      .select("defs")
      .select("#" + CLIP_PREFIX + this.plotId);

    if (container.empty()) {
      this.svg
        .append("defs")
        .append("clipPath")
        .attr("id", CLIP_PREFIX + this.plotId);
    }

    const clip = this.svg
      .select("defs")
      .select("#" + CLIP_PREFIX + this.plotId);
    clip.selectAll("rect").remove();
    clip.append("rect").attr("width", this.width).attr("height", this.height);
  }

  ampScaleForSeisDisplayData(
    sdd: SeismogramDisplayData,
  ): ScaleLinear<number, number, never> {
    const ampScale = this.__initAmpScale();
    if (this.seismographConfig.linkedAmplitudeScale) {
      const drawHalfWidth = this.amp_scalable.drawHalfWidth;
      let sensitivityVal = 1;
      if (
        this.seismographConfig.doGain &&
        sdd.seismogram?.isYUnitCount() &&
        sdd.sensitivity?.sensitivity
      ) {
        sensitivityVal = sdd.sensitivity.sensitivity;
      }
      if (!this.seismographConfig.isCenteredAmp()) {
        return ampScale.domain([
          (this.amp_scalable.drawMiddle - drawHalfWidth) * sensitivityVal,
          (this.amp_scalable.drawMiddle + drawHalfWidth) * sensitivityVal,
        ]);
      }
      const sddInterval = this.displayTimeRangeForSeisDisplayData(sdd);
      const minMax = calcMinMax(
        sdd,
        sddInterval,
        false,
        this.seismographConfig.amplitudeMode,
      );
      if (minMax) {
        // if doGain, halfWidth is in real world units, so mul sensitivity to
        // get counts for drawing
        const myMin = minMax.middle - drawHalfWidth * sensitivityVal;
        const myMax = minMax.middle + drawHalfWidth * sensitivityVal;
        ampScale.domain([myMin, myMax]);
      } else {
        // no data?
        ampScale.domain([-1, 1]);
      }
    } else if (this.seismographConfig.fixedAmplitudeScale) {
      ampScale.domain(this.seismographConfig.fixedAmplitudeScale);
    } else {
      throw new Error(
        "ampScaleForSeisDisplayData Must be either linked or fixed amp scale",
      );
    }
    return ampScale;
  }

  displayTimeRangeForSeisDisplayData(sdd: SeismogramDisplayData): Interval {
    let plotInterval;
    if (this.seismographConfig.linkedTimeScale) {
      if (this.time_scalable.drawDuration.equals(ZERO_DURATION)) {
        this.seismographConfig.linkedTimeScale.recalculate().catch((m) => {
          // eslint-disable-next-line no-console
          console.warn(
            `problem recalc displayTimeRangeForSeisDisplayData: ${m}`,
          );
        });
      }
      // drawDuration should be set via recalculate now
      const startOffset = this.time_scalable.drawAlignmentTimeOffset;
      const duration = this.time_scalable.drawDuration;
      plotInterval = sdd.relativeTimeWindow(startOffset, duration);
    } else if (this.seismographConfig.fixedTimeScale) {
      plotInterval = this.seismographConfig.fixedTimeScale;
    } else {
      throw new Error("Must be either fixed or linked time scale");
    }
    return plotInterval;
  }

  timeScaleForSeisDisplayData(
    sdd?: SeismogramDisplayData | Interval,
  ): axisutil.LuxonTimeScale {
    let plotInterval;
    if (sdd) {
      if (sdd instanceof SeismogramDisplayData) {
        plotInterval = this.displayTimeRangeForSeisDisplayData(sdd);
      } else {
        plotInterval = sdd;
      }
    } else {
      if (this.seismographConfig.linkedTimeScale) {
        plotInterval = util.durationEnd(
          this.seismographConfig.linkedTimeScale.duration,
          DateTime.utc(),
        );
      } else if (this.seismographConfig.fixedTimeScale) {
        plotInterval = this.seismographConfig.fixedTimeScale;
      } else {
        // ??? should not happen, just use now and 1 sec?
        plotInterval = util.durationEnd(1, DateTime.utc());
      }
    }
    return new axisutil.LuxonTimeScale(plotInterval, [0, this.width]);
  }

  /**
   * Draws the top, bottom, (time) axis and the left and right (amplitude) axis if configured.
   */
  drawAxis(): void {
    this.drawTopBottomAxis();
    this.drawLeftRightAxis();
  }

  /**
   * Creates amp scale, set range based on height.
   * @private
   * @returns amp scale with range set
   */
  __initAmpScale(): ScaleLinear<number, number, never> {
    const ampAxisScale = d3scaleLinear();
    // don't use top,bot pixel, somehow line at top amp disappears if [this.height, 0]
    ampAxisScale.range([this.height - 1, 1]);
    return ampAxisScale;
  }

  ampScaleForAxis(): ScaleLinear<number, number, never> {
    const ampAxisScale = this.__initAmpScale();
    if (this.seismographConfig.fixedAmplitudeScale) {
      ampAxisScale.domain(this.seismographConfig.fixedAmplitudeScale);
    } else if (this.seismographConfig.linkedAmplitudeScale) {
      let middle = this.amp_scalable.drawMiddle;
      if (this.seismographConfig.isCenteredAmp()) {
        middle = 0;
      } else {
        middle = this.amp_scalable.drawMiddle;
      }
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

  timeScaleForAxis():
    | ScaleLinear<number, number, never>
    | axisutil.LuxonTimeScale {
    let xScaleToDraw;
    if (this.seismographConfig.isRelativeTime) {
      xScaleToDraw = d3scaleLinear();
      xScaleToDraw.range([0, this.width]);
      if (this.seismographConfig.linkedTimeScale) {
        const startOffset =
          this.time_scalable.drawAlignmentTimeOffset.toMillis() / 1000;
        const duration = this.time_scalable.drawDuration.toMillis() / 1000;
        if (duration > 0) {
          xScaleToDraw.domain([startOffset, startOffset + duration]);
        } else {
          xScaleToDraw.domain([startOffset + duration, startOffset]);
        }
      } else if (this.seismographConfig.fixedTimeScale) {
        const psed = this.seismographConfig.fixedTimeScale;
        const s = validStartTime(psed);
        const e = validEndTime(psed);
        xScaleToDraw.domain([s.toMillis() / 1000, e.toMillis() / 1000]);
      } else {
        throw new Error("neither fixed nor linked time scale");
      }
    } else {
      if (this.seismographConfig.linkedTimeScale) {
        if (this.seisData.length > 0) {
          xScaleToDraw = this.timeScaleForSeisDisplayData(this.seisData[0]);
        } else {
          xScaleToDraw = this.timeScaleForSeisDisplayData(); // empty uses duration and now
        }
      } else if (this.seismographConfig.fixedTimeScale) {
        const psed = this.seismographConfig.fixedTimeScale;
        xScaleToDraw = this.timeScaleForSeisDisplayData(psed);
      } else {
        throw new Error("neither fixed nor linked time scale");
      }
    }
    return xScaleToDraw;
  }
  /**
   * Draws the left and right (amplitude) axis if configured.
   *
   */
  drawTopBottomAxis(): void {
    this.g.selectAll("g.axis--x").remove();
    this.g.selectAll("g.axis--x-top").remove();
    let xScaleToDraw = this.timeScaleForAxis();

    if (this.seismographConfig.isRelativeTime) {
      // eg xScaleToDraw is ScaleLinear
      xScaleToDraw = xScaleToDraw as ScaleLinear<number, number, never>;
      if (this.seismographConfig.isXAxis) {
        const xAxis = d3axisBottom(xScaleToDraw);
        xAxis.tickFormat(
          createNumberFormatWrapper(this.seismographConfig.relativeTimeFormat),
        );
        this.g
          .append("g")
          .attr("class", "axis axis--x")
          .attr("transform", "translate(0," + this.height + ")")
          .call(xAxis);
      }
      if (this.seismographConfig.isXAxisTop) {
        const xAxisTop = d3axisTop(xScaleToDraw);
        xAxisTop.tickFormat(
          createNumberFormatWrapper(this.seismographConfig.relativeTimeFormat),
        );
        this.g.append("g").attr("class", "axis axis--x-top").call(xAxisTop);
      }
    } else {
      xScaleToDraw = xScaleToDraw as axisutil.LuxonTimeScale;
      if (this.seismographConfig.isXAxis) {
        const xAxis = d3axisBottom(xScaleToDraw.d3scale);
        xAxis.tickFormat(
          createDateFormatWrapper(this.seismographConfig.timeFormat),
        );
        this.g
          .append("g")
          .attr("class", "axis axis--x")
          .attr("transform", "translate(0," + this.height + ")")
          .call(xAxis);
      }
      if (this.seismographConfig.isXAxisTop) {
        const xAxisTop = d3axisTop(xScaleToDraw.d3scale);
        xAxisTop.tickFormat(
          createDateFormatWrapper(this.seismographConfig.timeFormat),
        );
        this.g.append("g").attr("class", "axis axis--x-top").call(xAxisTop);
      }
    }
  }

  /**
   * Draws the left and right (amplitude) axis if configured.
   */
  drawLeftRightAxis(): void {
    this.g.selectAll("g.axis--y").remove();
    this.g.selectAll("g.axis--y-right").remove();
    const [yAxis, yAxisRight] = this.createLeftRightAxis();
    if (isDef(yAxis)) {
      this.g.append("g").attr("class", "axis axis--y").call(yAxis);
    }
    if (isDef(yAxisRight)) {
      this.g
        .append("g")
        .attr("class", "axis axis--y-right")
        .attr("transform", "translate(" + this.width + ",0)")
        .call(yAxisRight);
    }
  }
  createLeftRightAxis(): Array<Axis<d3NumberValue> | null> {
    let yAxis = null;
    let yAxisRight = null;
    const axisScale = this.ampScaleForAxis();
    if (this.seismographConfig.isYAxis) {
      yAxis = d3axisLeft(axisScale).tickFormat(
        numberFormatWrapper(this.seismographConfig.amplitudeFormat),
      );
      yAxis.scale(axisScale);
      yAxis.ticks(this.seismographConfig.yAxisNumTickHint,
        this.seismographConfig.amplitudeFormat);
    }

    if (this.seismographConfig.isYAxisRight) {
      yAxisRight = d3axisRight(axisScale).tickFormat(
        numberFormatWrapper(this.seismographConfig.amplitudeFormat),
      );
      yAxisRight.scale(axisScale);
      yAxisRight.ticks(this.seismographConfig.yAxisNumTickHint, this.seismographConfig.amplitudeFormat);
    }
    return [yAxis, yAxisRight];
  }

  rescaleYAxis(): void {
    if (!this.beforeFirstDraw) {
      const delay = 500;

      if (this.throttleRescale) {
        clearTimeout(this.throttleRescale);
      }

      this.throttleRescale = setTimeout(() => {
        const [yAxis, yAxisRight] = this.createLeftRightAxis();
        if (yAxis) {
          this.g
            .select(".axis--y")
            .transition()
            .duration(delay / 2)
            // @ts-expect-error typescript and d3 dont always play well together
            .call(yAxis);
        }

        if (yAxisRight) {
          this.g
            .select(".axis--y-right")
            .transition()
            .duration(delay / 2)
            // @ts-expect-error typescript and d3 dont always play well together
            .call(yAxisRight);
        }

        this.throttleRescale = null;
      }, delay);
    }
  }

  createHandlebarsInput(): HandlebarsInput {
    return {
      seisDataList: this._seisDataList,
      seisConfig: this._seismographConfig,
    };
  }

  drawAxisLabels(): void {
    this.drawTitle();
    this.drawXLabel();
    this.drawXSublabel();
    this.drawYLabel();
    this.drawYSublabel();
  }

  resetZoom(): void {
    if (this.seismographConfig.linkedTimeScale) {
      this.seismographConfig.linkedTimeScale.unzoom();
    } else {
      throw new Error("can't reset zoom for fixedTimeScale");
    }
  }

  redrawWithXScale(): void {
    const mythis = this;

    if (!this.beforeFirstDraw) {
      this.g.select("g.allseismograms").selectAll("g.seismogram").remove();

      if (this.seismographConfig.windowAmp) {
        this.recheckAmpScaleDomain();
      }

      this.drawSeismograms();
      this.g
        .select("g.allmarkers")
        .selectAll("g.marker")
        .attr("transform", function (v: unknown) {
          const mh = v as MarkerHolderType;
          mh.xscale = mythis.timeScaleForSeisDisplayData(mh.sdd);
          const textx = mh.xscale.for(mh.marker.time);
          return "translate(" + textx + "," + 0 + ")";
        });
      this.g
        .select("g.allmarkers")
        .selectAll("g.markertext")
        .attr("transform", function () {
          // shift up by this.seismographConfig.markerTextOffset percentage
          const axisScale = mythis.ampScaleForAxis();
          const maxY = axisScale.range()[0];
          const deltaY = axisScale.range()[0] - axisScale.range()[1];
          const texty =
            maxY - mythis.seismographConfig.markerTextOffset * deltaY;
          return (
            "translate(" +
            0 +
            "," +
            texty +
            ") rotate(" +
            mythis.seismographConfig.markerTextAngle +
            ")"
          );
        });

      const undrawnMarkers = this._seisDataList
        .reduce((acc, sdd) => {
          const sddXScale = this.timeScaleForSeisDisplayData(sdd);
          sdd.markerList.forEach((m) =>
            acc.push({
              // use marker holder to also hold xscale in case relative plot
              marker: m,
              sdd: sdd,
              xscale: sddXScale,
            }),
          );
          return acc;
        }, new Array<MarkerHolderType>(0))
        .filter((mh) => {
          const xpixel = mh.xscale.for(mh.marker.time);
          return xpixel >= mh.xscale.range[0] && xpixel <= mh.xscale.range[1];
        });

      if (this.seismographConfig.doMarkers && undrawnMarkers.length !== 0) {
        this.drawMarkers();
      }

      this.drawTopBottomAxis();
    }
  }

  drawMarkers() {
    const axisScale = this.ampScaleForAxis();
    const allMarkers: Array<MarkerHolderType> = this._seisDataList
      .reduce((acc: Array<MarkerHolderType>, sdd) => {
        const sddXScale = this.timeScaleForSeisDisplayData(sdd);
        sdd.markerList.forEach((m) =>
          acc.push({
            // use marker holder to also hold xscale in case relative plot
            marker: m,
            sdd: sdd,
            xscale: sddXScale,
          }),
        );
        return acc;
      }, [])
      .filter((mh) => {
        const xpixel = mh.xscale.for(mh.marker.time);
        return xpixel >= mh.xscale.range[0] && xpixel <= mh.xscale.range[1];
      });
    // marker overlay
    const mythis = this;
    const markerG = this.g.select("g.allmarkers");
    markerG.selectAll("g.marker").remove();
    const labelSelection = markerG
      .selectAll("g.marker")
      .data(allMarkers, function (v: unknown) {
        const mh = v as MarkerHolderType;
        // key for data
        return `${mh.marker.name}_${mh.marker.time.toISO()}`;
      });
    labelSelection.exit().remove();
    const radianTextAngle =
      (this.seismographConfig.markerTextAngle * Math.PI) / 180;
    labelSelection
      .enter()
      .append("g")
      .classed("marker", true) // translate so marker time is zero
      .attr("transform", function (v: unknown) {
        const mh = v as MarkerHolderType;
        const textx = mh.xscale.for(mh.marker.time);
        return "translate(" + textx + "," + 0 + ")";
      })
      .each(function (mh: MarkerHolderType) {
        const drawG = d3select(this);
        drawG.classed(mh.marker.name, true).classed(mh.marker.markertype, true);
        const innerTextG = drawG
          .append("g")
          .attr("class", "markertext")
          .attr("transform", () => {
            // shift up by this.seismographConfig.markerTextOffset percentage
            const maxY = axisScale.range()[0];
            const deltaY = axisScale.range()[0] - axisScale.range()[1];
            const texty =
              maxY - mythis.seismographConfig.markerTextOffset * deltaY;
            return (
              "translate(" +
              0 +
              "," +
              texty +
              ") rotate(" +
              mythis.seismographConfig.markerTextAngle +
              ")"
            );
          });
        innerTextG.append("title").text(() => {
          if (mh.marker.description) {
            return mh.marker.description;
          } else {
            return (
              mh.marker.markertype +
              " " +
              mh.marker.name +
              " " +
              mh.marker.time.toISO()
            );
          }
        });
        const textSel = innerTextG.append("text");

        if (mh.marker.link && mh.marker.link.length > 0) {
          // if marker has link, make it clickable
          textSel
            .append("svg:a")
            .attr("xlink:href", () => "" + mh.marker.link)
            .text(function (datum) {
              const mh: MarkerHolderType = datum as MarkerHolderType;
              return mh.marker.name;
            });
        } else {
          textSel.text(function (datum) {
            const mh: MarkerHolderType = datum as MarkerHolderType;
            return mh.marker.name;
          });
        }

        textSel.attr("dy", "-0.35em").call(function (selection) {
          // this stores the BBox of the text in the bbox field for later use
          selection.each(function (datum) {
            const mh: MarkerHolderType = datum as MarkerHolderType;
            // set a default just in case
            mh.bbox = {
              height: 15,
              width: 20,
            };

            try {
              mh.bbox = this.getBBox();
            } catch (error) {
              // eslint-disable-next-line no-console
              console.warn(error); // this happens if the text is not yet in the DOM, I think
              //  https://bugzilla.mozilla.org/show_bug.cgi?id=612118
            }
          });
        });
        // draw/insert flag behind/before text
        innerTextG.insert("polygon", "text").attr("points", function (datum) {
          const mh: MarkerHolderType = datum as MarkerHolderType;
          let bboxH = 10 + 5; // defaults if no bbox, should not happen
          let bboxW = 10;
          if (mh.bbox) {
            bboxH = mh.bbox.height + 5;
            bboxW = mh.bbox.width;
          }
          return (
            "0,0 " +
            -1 * bboxH * Math.tan(radianTextAngle) +
            ",-" +
            bboxH +
            " " +
            bboxW +
            ",-" +
            bboxH +
            " " +
            bboxW +
            ",0"
          );
        });
        // let style be in css?
        //              .style("fill", "rgba(220,220,220,.4)");
        let markerPoleY = 0;
        if (mythis.seismographConfig.markerFlagpoleBase === "none") {
          // no flagpole
          markerPoleY = 0;
        } else if (mythis.seismographConfig.markerFlagpoleBase === "short") {
          // no flagpole
          markerPoleY = (axisScale.range()[0] + axisScale.range()[1]) / 4;
        } else if (mythis.seismographConfig.markerFlagpoleBase === "center") {
          markerPoleY = (axisScale.range()[0] + axisScale.range()[1]) / 2;
        } else {
          // bottom
          markerPoleY = axisScale.range()[0];
        }
        const markerPole = `M0,0l0,${markerPoleY}`;
        drawG.append("path").classed("markerpath", true).attr("d", markerPole);
      });
  }

  calcWidthHeight(nOuterWidth: number, nOuterHeight: number): void {
    if (
      nOuterWidth <
      this.seismographConfig.margin.left + this.seismographConfig.margin.right
    ) {
      throw new Error(
        `width too small for margin: ${nOuterWidth} < ${this.seismographConfig.margin.left} + ${this.seismographConfig.margin.right}`,
      );
    }

    if (
      nOuterHeight <
      this.seismographConfig.margin.top + this.seismographConfig.margin.bottom
    ) {
      throw new Error(
        `height too small for margin: ${nOuterHeight} < ${this.seismographConfig.margin.top} + ${this.seismographConfig.margin.bottom}`,
      );
    }

    this.outerWidth = nOuterWidth;
    this.outerHeight = nOuterHeight;
    this.height =
      this.outerHeight -
      this.seismographConfig.margin.top -
      this.seismographConfig.margin.bottom;
    this.width =
      this.outerWidth -
      this.seismographConfig.margin.left -
      this.seismographConfig.margin.right;

    this.calcScaleAndZoom();

    if (this.canvasHolder) {
      this.canvasHolder
        .attr("width", this.width)
        .attr("height", this.height + 1);
    }
    if (this.canvas) {
      this.canvas.attr("width", this.width).attr("height", this.height + 1);
    }
    if (this.panZoomer) {
      this.panZoomer.width = this.width;
    }
  }

  drawTitle() {
    const wrapper = this.getShadowRoot().querySelector("div") as HTMLDivElement;
    const isTitleCSS = getComputedStyle(wrapper).getPropertyValue("--sp-seismograph-is-title");
    const svgEl = wrapper.querySelector("svg") as SVGElement;
    if (isTitleCSS === "0") {
      axisutil.removeTitle(svgEl);
    } else {
      axisutil.drawTitle(
        svgEl,
        this.seismographConfig,
        this.height,
        this.width,
        this.createHandlebarsInput(),
      );
    }
  }

  drawXLabel() {
    const wrapper = this.getShadowRoot().querySelector("div") as HTMLDivElement;
    const isXLabelCSS = getComputedStyle(wrapper).getPropertyValue("--sp-seismograph-is-xlabel");
    const svgEl = wrapper.querySelector("svg") as SVGElement;
    if (isXLabelCSS === "0") {
      axisutil.removeXLabel(svgEl);
    } else {
      axisutil.drawXLabel(
        svgEl,
        this.seismographConfig,
        this.height,
        this.width,
        this.createHandlebarsInput(),
      );
    }
  }

  drawXSublabel() {
    const wrapper = this.getShadowRoot().querySelector("div") as HTMLDivElement;
    const isXSublabelCSS = getComputedStyle(wrapper).getPropertyValue("--sp-seismograph-is-xsublabel");
    const svgEl = wrapper.querySelector("svg") as SVGElement;
    if (isXSublabelCSS === "0") {
      axisutil.removeXSublabel(svgEl);
    } else {
      axisutil.drawXSublabel(
        svgEl,
        this.seismographConfig,
        this.height,
        this.width,
        this.createHandlebarsInput(),
      );
    }
  }

  drawYLabel() {
    const wrapper = this.getShadowRoot().querySelector("div") as HTMLDivElement;
    const isYLabelCSS = getComputedStyle(wrapper).getPropertyValue("--sp-seismograph-is-ylabel");
    const svgEl = wrapper.querySelector("svg") as SVGElement;
    if (isYLabelCSS === "0") {
      axisutil.removeYLabel(svgEl);
    } else {
      axisutil.drawYLabel(
        svgEl,
        this.seismographConfig,
        this.height,
        this.width,
        this.createHandlebarsInput(),
      );
    }
  }

  drawYSublabel() {
    const wrapper = this.getShadowRoot().querySelector("div") as HTMLDivElement;
    const isYSublabelCSS = getComputedStyle(wrapper).getPropertyValue("--sp-seismograph-is-ysublabel");
    const svgEl = wrapper.querySelector("svg") as SVGElement;
    if (isYSublabelCSS === "0") {
      axisutil.removeYSublabel(svgEl);
    } else {
      const unitsLabel = this.seismographConfig.ySublabelIsUnits
        ? this.createUnitsLabel()
        : "";
      axisutil.drawYSublabel(
        svgEl,
        this.seismographConfig,
        this.height,
        this.width,
        this.createHandlebarsInput(),
        unitsLabel,
      );
    }
  }

  /**
   * Update the duration if not already set. This only matters for
   * linedTimeScale currently.
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
   * Calculate the amplitude range over the current time range, depending
   * on amplitude style.
   *
   * @returns min max over the time range
   */
  calcAmpScaleDomain(): MinMaxable {
    let minMax;
    if (this.seismographConfig.fixedAmplitudeScale) {
      minMax = MinMaxable.fromArray(this.seismographConfig.fixedAmplitudeScale);
    } else {
      if (this.seismographConfig.windowAmp) {
        if (isDef(this.seismographConfig.linkedTimeScale)) {
          minMax = findMinMaxOverRelativeTimeRange(
            this._seisDataList,
            this.seismographConfig.linkedTimeScale.offset,
            this.seismographConfig.linkedTimeScale.duration,
            this.seismographConfig.doGain,
            this.seismographConfig.amplitudeMode,
          );
        } else if (isDef(this.seismographConfig.fixedTimeScale)) {
          minMax = findMinMaxOverTimeRange(
            this._seisDataList,
            this.seismographConfig.fixedTimeScale,
            this.seismographConfig.doGain,
            this.seismographConfig.amplitudeMode,
          );
        } else {
          throw new Error("neither fixed nor linked time scale");
        }
      } else {
        minMax = findMinMax(
          this._seisDataList,
          this.seismographConfig.doGain,
          this.seismographConfig.amplitudeMode,
        );
      }

      if (minMax.halfWidth === 0) {
        // flatlined data, use -1, +1
        //minMax = [minMax[0] - 1, minMax[1] + 1];
      }
      if (this.seismographConfig.isYAxisNice) {
        // use d3 scale's nice function
        let scale = d3scaleLinear();
        scale.domain(minMax.asArray());
        scale = scale.nice();
        minMax = MinMaxable.fromArray(scale.domain());
      }
    }
    return minMax;
  }

  recheckAmpScaleDomain(): void {
    const calcMidHW = this.calcAmpScaleDomain();
    const oldMiddle = this.amp_scalable.middle;
    const oldHalfWidth = this.amp_scalable.halfWidth;
    this.amp_scalable.minMax = calcMidHW;

    if (this.seismographConfig.linkedAmplitudeScale) {
      if (
        this.amp_scalable.middle !== oldMiddle ||
        this.amp_scalable.halfWidth !== oldHalfWidth
      ) {
        this.seismographConfig.linkedAmplitudeScale
          .recalculate() // sets yScale.domain
          .catch((m) => {
            // eslint-disable-next-line no-console
            console.warn(`problem recalc amp scale: ${m}`);
          });
      }
    } else {
      this.redoDisplayYScale();
    }
  }

  redoDisplayYScale(): void {
    this.rescaleYAxis();

    if (this.seismographConfig.ySublabelIsUnits) {
      this.drawYSublabel();
    }
  }
  createUnitsLabel(): string {
    let ySublabel = "";
    if (
      this.seismographConfig.doGain &&
      this._seisDataList.length > 0 &&
      this._seisDataList.every((sdd) => sdd.hasSensitivity()) &&
      this._seisDataList.every(
        (sdd) => isDef(sdd.seismogram) && sdd.seismogram.yUnit === COUNT_UNIT,
      )
    ) {
      // each has seisitivity
      const firstSensitivity = this._seisDataList[0].sensitivity;
      const allSameUnits =
        firstSensitivity &&
        this._seisDataList.every(
          (sdd) =>
            isDef(firstSensitivity) &&
            sdd.sensitivity &&
            firstSensitivity.inputUnits === sdd.sensitivity.inputUnits,
        );
      if (this.seismographConfig.ySublabelIsUnits) {
        const unitList = this._seisDataList
          .map((sdd) =>
            sdd.sensitivity ? sdd.sensitivity.inputUnits : "uknown",
          )
          .join(",");
        if (!allSameUnits) {
          ySublabel = unitList;
        } else {
          ySublabel = firstSensitivity.inputUnits;
        }
      }
    } else {
      if (this.seismographConfig.ySublabelIsUnits) {
        ySublabel = "";
        const allUnits = [];

        for (const t of this._seisDataList) {
          if (t.seismogram) {
            const u = t.seismogram.yUnit;
            allUnits.push(u);
          }
        }

        if (allUnits.length === 0) {
          allUnits.push("Count");
        }

        ySublabel = allUnits.join(" ");
      }
    }

    if (
      this.seismographConfig.ySublabelIsUnits &&
      this.seismographConfig.isCenteredAmp()
    ) {
      ySublabel = `centered ${ySublabel}`;
    }
    return ySublabel;
  }

  getSeismogramData(): Array<SeismogramDisplayData> {
    return this._seisDataList;
  }

  /**
   * Notification to the element that something about the current seismogram
   * data has changed. This could be that the actual waveform data has been updated
   * or that auxillary data like quake or channel has been added. This should
   * trigger a redraw.
   */
  seisDataUpdated() {
    this.calcTimeScaleDomain();
    this.recheckAmpScaleDomain();
    if (!this.beforeFirstDraw) {
      // only trigger a draw if appending after already drawn on screen
      // otherwise, just append the data and wait for outside to call first draw()
      //this.drawSeismograms();
      if (this.seismographConfig.linkedAmplitudeScale) {
        this.seismographConfig.linkedAmplitudeScale.recalculate();
      } else {
        this.redraw();
      }
    }
  }

  /**
   * Finds the SeismogramDisplayData within the display containing the given
   * Seismogram.
   *
   * @param   seis seismogram to search for
   * @returns       SeismogramDisplayData if found or null if not
   */
  getDisplayDataForSeismogram(seis: Seismogram): SeismogramDisplayData | null {
    const out = this._seisDataList.find((sd) => sd.seismogram === seis);

    if (out) {
      return out;
    } else {
      return null;
    }
  }

  /**
   * Removes a seismogram from the display.
   *
   * @param   seisData seis data to remove
   */
  removeSeisData(seisData: SeismogramDisplayData): void {
    this._seisDataList = this._seisDataList.filter((sd) => sd !== seisData);
  }

  /**
   * Removes seismograms that do not overlap the window.
   *
   * @param   timeRange overlap data to keep
   */
  trim(timeRange: Interval): void {
    if (this._seisDataList) {
      this._seisDataList = this._seisDataList.filter(function (d) {
        return d.timeRange.overlaps(timeRange);
      });

      if (this._seisDataList.length > 0) {
        this.recheckAmpScaleDomain();
        this.drawSeismograms();
      }
    }
  }
}

export class SeismographAmplitudeScalable extends AmplitudeScalable {
  graph: Seismograph;
  drawHalfWidth: number;
  drawMiddle: number;
  constructor(graph: Seismograph) {
    const calcMidHW = graph.calcAmpScaleDomain();
    super(calcMidHW);
    this.graph = graph;
    this.drawHalfWidth = super.halfWidth;
    this.drawMiddle = super.middle;
  }
  notifyAmplitudeChange(middle: number, halfWidth: number) {
    if (middle !== this.drawMiddle || halfWidth !== this.drawHalfWidth) {
      this.drawMiddle = middle;
      this.drawHalfWidth = halfWidth;
      this.graph.redoDisplayYScale();

      if (!this.graph.beforeFirstDraw) {
        // only trigger a draw if appending after already drawn on screen
        // otherwise, just append the data and wait for outside to call first draw()
        this.graph.redraw();
      }
    }
  }
}

export const ZERO_DURATION = Duration.fromMillis(0);

export class SeismographTimeScalable extends TimeScalable {
  graph: Seismograph;
  drawAlignmentTimeOffset: Duration;
  drawDuration: Duration;
  constructor(
    graph: Seismograph,
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
      if (isDef(this.graph) && !this.graph.beforeFirstDraw) {
        window.requestAnimationFrame(() => {
          this.graph.redrawWithXScale();
        });
      }
    }
  }
}
// static ID for seismogram
Seismograph._lastID = 0;

/**
 * Creates a wrapper for d3 formatter for numbers for axis that keeps typescript happy.
 *
 * @param  formatter simple formatter
 * @returns           function that converts input types
 */

export function createNumberFormatWrapper(
  formatter: (value: number) => string,
): (nValue: d3NumberValue) => string {
  return (nValue: d3NumberValue) => {
    if (typeof nValue === "number") {
      return formatter(nValue);
    } else {
      return formatter(nValue.valueOf());
    }
  };
}
/**
 * Creates a wrapper for d3 formatter for Dates for axis that keeps typescript happy.
 *
 * @param  formatter simple formatter
 * @returns           function that converts input types
 */
export function createDateFormatWrapper(
  formatter: (value: Date) => string,
): (nValue: Date | d3NumberValue, index: number) => string {
  return (nValue: Date | d3NumberValue) => {
    if (nValue instanceof Date) {
      return formatter(nValue);
    } else if (typeof nValue === "number") {
      return formatter(new Date(nValue));
    } else {
      return formatter(new Date(nValue.valueOf()));
    }
  };
}

export type SeisMouseEventType = {
  mouseevent: MouseEvent;
  time: DateTime | null;
  relative_time: Duration | null;
  amplitude: number;
  seismograph: Seismograph;
};

customElements.define(SEISMOGRAPH_ELEMENT, Seismograph);
