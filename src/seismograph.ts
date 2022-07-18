/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */
 import { DateTime, Duration, Interval} from "luxon";
import * as d3 from "d3";
import { AUTO_COLOR_SELECTOR, G_DATA_SELECTOR} from "./cssutil";
import {
  AmplitudeScalable,
  TimeScalable,
} from "./scale";
import {
  SeismographConfig,
  DRAW_BOTH_ALIGN,
  numberFormatWrapper,
} from "./seismographconfig";
import type {MarkerType} from "./seismogram";
import type {TraveltimeJsonType} from "./traveltime";
import type {ScaleLinear, ScaleTime} from "d3-scale";
import {
  SeismogramDisplayData,
  findMaxDuration,
  findMinMax,
  findMinMaxOverTimeRange,
  findMinMaxOverRelativeTimeRange,
  Seismogram,
  COUNT_UNIT,
} from "./seismogram";
import {SeismogramSegment} from "./seismogramsegment";
import {SeisPlotElement} from "./spelement";
import {Quake, Origin} from "./quakeml";
import {Station, Channel} from "./stationxml";
import * as distaz from "./distaz";
import * as axisutil from "./axisutil";
import * as util from "./util"; // for util.log to replace console.log

import {isDef, isNumArg} from "./util";
import {registerHelpers} from "./handlebarshelpers";
registerHelpers();

const CLIP_PREFIX = "seismographclip";
export type BBoxType = {
  height: number;
  width: number;
}
export type MarkerHolderType = {
  marker: MarkerType;
  sdd: SeismogramDisplayData;
  xscale: any;
  bbox?: BBoxType;
};

export const SEISMOGRAPH_ELEMENT = 'sp-seismograph';
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
  dominant-baseline: hanging;
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
  svg: any;
  canvasHolder: any;
  canvas: any;

  g: any;
  throttleRescale: ReturnType<typeof setTimeout> | null;
  throttleResize: ReturnType<typeof setTimeout> | null;
  throttleRedraw: ReturnType<typeof setTimeout> | null;
  time_scalable: SeismographTimeScalable;
  amp_scalable: SeismographAmplitudeScalable;

  constructor(seisData?: Array<SeismogramDisplayData>, seisConfig?: SeismographConfig) {
    super(seisData, seisConfig);
    this.outerWidth = -1;
    this.outerHeight = -1;
    this.throttleRescale = null;
    this.throttleResize = null;
    this.throttleRedraw = null;

    this.plotId = ++Seismograph._lastID;
    this.beforeFirstDraw = true;

    this._debugAlignmentSeisData = [];
    this.width = 200;
    this.height = 100;


    const shadow = this.attachShadow({mode: 'open'});
    const wrapper = document.createElement('div');
    wrapper.setAttribute("class", "wrapper");
    const style = shadow.appendChild(document.createElement('style'));
    style.textContent = seismograph_css;
    const lineColorsStyle = shadow.appendChild(document.createElement('style'));
    const lineColorsCSS = this.seismographConfig.createCSSForLineColors();
    lineColorsStyle.setAttribute("id", COLOR_CSS_ID);
    lineColorsStyle.textContent = lineColorsCSS;
    shadow.appendChild(wrapper);

    this.canvas = null;
    this.svg = d3.select(wrapper).append("svg").style("z-index", 100);
    wrapper.appendChild(this.svg.node());

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
    if (seisData) {
      maxDuration = findMaxDuration(seisData);
    }

    this.time_scalable = new SeismographTimeScalable(this, alignmentTimeOffset, maxDuration);

    if (isDef(this.seismographConfig.linkedTimeScale)) {
      this.seismographConfig.linkedTimeScale.link(this.time_scalable);
    }

    this.calcTimeScaleDomain();
    this.amp_scalable = new SeismographAmplitudeScalable(this);

    if (this.seismographConfig.linkedAmplitudeScale) {
      this.seismographConfig.linkedAmplitudeScale.link(this.amp_scalable);
    }


    const mythis = this;
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
    this.enableZoom();

    // create marker g
    this.g
      .append("g")
      .attr("class", "allmarkers")
      .attr("style", "clip-path: url(#" + CLIP_PREFIX + this.plotId + ")");
    d3.select(window).on(
      "resize.canvasseismograph" + mythis.plotId,
      function () {
        if (!mythis.beforeFirstDraw && mythis.checkResize()) {
          mythis.redraw();
        }
      },
    );
  }

  get seisData() {
    return super.seisData;
  }
  set seisData(seisData: Array<SeismogramDisplayData>) {
    super._seisDataList = [];
    this.appendSeisData(seisData);
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
    this.enableZoom();

    this.redraw();
  }
  connectedCallback() {
    this.redraw();
  }
  disconnectedCallback() {
    if (this.seismographConfig.linkedAmplitudeScale) {
      this.seismographConfig.linkedAmplitudeScale.unlink(this.amp_scalable);
    }
    if (this.seismographConfig.linkedTimeScale) {
      this.seismographConfig.linkedTimeScale.unlink(this.time_scalable);
    }
  }
  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    this.redraw();
  }

  checkResize(): boolean {
    const wrapper = (this.shadowRoot?.querySelector('div') as HTMLDivElement);
    const svgEl = wrapper.querySelector('svg') as SVGElement;
    const rect = svgEl.getBoundingClientRect();

    if (rect.width !== this.outerWidth || rect.height !== this.outerHeight) {
      return true;
    }

    return false;
  }
  enableZoom(): void {
    const mythis = this;
    const z = this.svg.call(
      d3.zoom().on("zoom", function (e) {
        mythis.zoomed(e);
      }),
    );

    if (!this.seismographConfig.wheelZoom) {
      z.on("wheel.zoom", null);
    }
  }

  redraw(): void {
    if (this.throttleRedraw) {
      clearTimeout(this.throttleRedraw);
    }
    const mythis = this;
    this.throttleRedraw = setTimeout(() => {
      mythis.draw();
      mythis.throttleRedraw = null;
    }, 10);
  }
  draw(): void {
    if ( ! this.isConnected) { return; }
    const wrapper = (this.shadowRoot?.querySelector('div') as HTMLDivElement);
    const svgEl = wrapper.querySelector('svg') as SVGElement;
    const rect = svgEl.getBoundingClientRect();

    if (
      rect.width === 0 ||
      !isDef(rect.width) ||
      rect.height === 0 ||
      !isDef(rect.height)
    ) {
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
      "translate(" +
        this.seismographConfig.margin.left +
        "," +
        this.seismographConfig.margin.top +
        ")",
    );
    if (this.canvas) {
      this.canvasHolder.attr("width", this.width).attr("height", this.height);
      this.canvasHolder.attr("x", this.seismographConfig.margin.left);
      this.canvasHolder.attr("y", this.seismographConfig.margin.top);
      this.canvas.attr("width", this.width).attr("height", this.height);
    } else {
      const svg = d3.select(svgEl);
      this.canvasHolder = svg
        .insert("foreignObject", ":first-child")
        .classed("seismograph", true)
        .attr("x", this.seismographConfig.margin.left)
        .attr("y", this.seismographConfig.margin.top)
        .attr("width", this.width)
        .attr("height", this.height + 1);
      this.canvas = this.canvasHolder
        .append("xhtml:canvas")
        .classed("seismograph", true)
        .attr("xmlns", "http://www.w3.org/1999/xhtml")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", this.width)
        .attr("height", this.height + 1);
    }

    this.drawSeismograms();
    this.drawAxis();
    axisutil.drawAxisLabels(
      svgEl,
      this.seismographConfig,
      this.height,
      this.width,
      this.createHandlebarsInput(),
    );

    if (this.seismographConfig.doMarkers) {
      this.drawMarkers();
    }

    this.beforeFirstDraw = false;
    return this.svg;
  }

  printSizes(): void {
    const wrapper = (this.shadowRoot?.querySelector('div') as HTMLDivElement);
    const svgEl = wrapper.querySelector('svg') as SVGElement;
    let out = "";
    const rect = svgEl.getBoundingClientRect();
    out += "svg rect.height " + rect.height + "\n";
    out += "svg rect.width " + rect.width + "\n";
    const grect = this.getBoundingClientRect();
    out += "parent rect.height " + grect.height + "\n";
    out += "parent rect.width " + grect.width + "\n";
    const crect = this.canvas.node().getBoundingClientRect();
    out += "c rect.height " + crect.height + "\n";
    out += "c rect.width " + crect.width + "\n";
    out += "c style.height " + this.canvas.style("height") + "\n";
    out += "c style.width " + this.canvas.style("width") + "\n";
    out += "this.height " + this.height + "\n";
    out += "this.width " + this.width + "\n";
    out += "canvas.height " + this.canvas.node().height + "\n";
    out += "canvas.width " + this.canvas.node().width + "\n";
    out += "this.outerHeight " + this.outerHeight + "\n";
    out += "this.outerWidth " + this.outerWidth + "\n";
    out += "this.margin " + this.seismographConfig.margin + "\n";
    util.log(out);
  }

  drawSeismograms() {
    this.drawSeismogramsCanvas();
    //this.drawSeismogramsSvg();
  }

  isVisible(): boolean {
    const elem = this.canvas.node();

    if (!elem) {
      return false;
    }

    return !!(
      elem.offsetWidth ||
      elem.offsetHeight ||
      elem.getClientRects().length
    );
  }

  drawSeismogramsCanvas(): void {
    const mythis = this;

    if (!this.isVisible()) {
      // no need to draw if we are not visible
      return;
    }

    // get the canvas drawing context
    const canvasNode = this.canvas.node();
    const context = canvasNode.getContext("2d");
    context.save();
    // clear the canvas from previous drawing
    context.clearRect(0, 0, canvasNode.width, canvasNode.height);
    context.lineWidth = this.seismographConfig.lineWidth;

    if (this.seismographConfig.drawingType === DRAW_BOTH_ALIGN) {
      context.lineWidth = this.seismographConfig.lineWidth * 2;
    }
    const sddList = this._seisDataList.concat(this._debugAlignmentSeisData);
    sddList.forEach((sdd, sddIndex) => {
      const ti = sddIndex;
      const xscaleForSDD: d3.ScaleTime<number, number, never> = this.timeScaleForSeisDisplayData(sdd);
      const yscaleForSDD = this.ampScaleForSeisDisplayData(sdd);
      const secondsPerPixel =
        (xscaleForSDD.domain()[1].valueOf() -
          xscaleForSDD.domain()[0].valueOf()) /
        1000 /
        (xscaleForSDD.range()[1] - xscaleForSDD.range()[0]);
      let color: string;

      if (this.seismographConfig.drawingType === DRAW_BOTH_ALIGN) {
        color = mythis.seismographConfig.getColorForIndex(ti + sddList.length);
      } else {
        color = mythis.seismographConfig.getColorForIndex(ti);
      }

      let firstTime = true;

      if (sdd.seismogram) {
        sdd.seismogram.segments.forEach(s => {
          if (
            xscaleForSDD(s.startTime) > xscaleForSDD.range()[1] ||
            xscaleForSDD(s.endTime) < xscaleForSDD.range()[0]
          ) {
            // segment either totally off to left or right of visible
            return;
          }

          const samplesPerPixel = 1.0 * s.sampleRate * secondsPerPixel;
          const pixelsPerSample = 1.0 / samplesPerPixel;
          const startPixel = xscaleForSDD(s.startTime.toJSDate());
          const endPixel = xscaleForSDD(s.endTime.toJSDate());
          let leftVisibleSample = 0;
          let rightVisibleSample = s.y.length;
          let leftVisiblePixel = startPixel;

          if (startPixel < 0) {
            leftVisibleSample =
              Math.floor(-1 * startPixel * samplesPerPixel) - 1;
            leftVisiblePixel = 0;
          }

          if (endPixel > xscaleForSDD.range()[1] + 1) {
            rightVisibleSample =
              leftVisibleSample +
              Math.ceil((this.width + 1) * samplesPerPixel) +
              1;
          }

          if (firstTime || !this.seismographConfig.connectSegments) {
            context.beginPath();
            context.strokeStyle = color;
            //context.lineWidth = 5;
            context.moveTo(
              leftVisiblePixel,
              yscaleForSDD(s.y[leftVisibleSample]),
            );
            firstTime = false;
          }

          for (
            let i = leftVisibleSample;
            i < rightVisibleSample + 2 && i < s.y.length;
            i++
          ) {
            context.lineTo(
              startPixel + i * pixelsPerSample,
              yscaleForSDD(s.y[i]),
            );
          }

          if (!this.seismographConfig.connectSegments) {
            context.stroke();
          }
        });
      } else {
        util.log(`seisdata has no seismogram ${util.stringify(ti)}`);
      }

      if (this.seismographConfig.connectSegments) {
        context.stroke();
      }
    });
    context.restore();
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

    const clip = this.svg.select("defs").select("#" + CLIP_PREFIX + this.plotId);
    clip.selectAll("rect").remove();
    clip.append("rect").attr("width", this.width).attr("height", this.height);
  }

  ampScaleForSeisDisplayData(sdd: SeismogramDisplayData): ScaleLinear<number, number, never> {
      const ampScale = d3.scaleLinear();
      ampScale.range([this.height, 0]);
      if (this.seismographConfig.linkedAmplitudeScale) {
        const halfWidth = this.amp_scalable.drawHalfWidth;
        let middle = this.amp_scalable.drawMiddle;
        if (this.seismographConfig.centeredAmp) {
          middle = sdd.middle;
        }

        let sensitivityVal = 1;
        if (this.seismographConfig.doGain && sdd.sensitivity?.sensitivity) {
          sensitivityVal = sdd.sensitivity.sensitivity;
        }
        // if doGain, halfWidth is in real world units, so mul sensitivity to
        // get counts for drawing
        const myMin = middle - halfWidth*sensitivityVal;
        const myMax = middle + halfWidth*sensitivityVal;
        ampScale.domain([myMin, myMax]);
      } else if (this.seismographConfig.fixedAmplitudeScale) {
        ampScale.domain(this.seismographConfig.fixedAmplitudeScale);
      } else {
        throw new Error("ampScaleForSeisDisplayData Must be either linked or fixed amp scale");
      }
      return ampScale;
  }

  timeScaleForSeisDisplayData(sdd: SeismogramDisplayData): ScaleTime<number, number, never> {
    let plotSed;
    const sddXScale = d3.scaleUtc();

    if (this.seismographConfig.linkedTimeScale) {
      if (this.time_scalable.drawDuration.equals(ZERO_DURATION)) {
        this.seismographConfig.linkedTimeScale.recalculate();
      }
      // drawDuration should be set via recalculate now
      const startOffset = this.time_scalable.drawAlignmentTimeOffset;
      const duration = this.time_scalable.drawDuration;
      plotSed = sdd.relativeTimeWindow(startOffset, duration);
    } else if (this.seismographConfig.fixedTimeScale) {
      plotSed = this.seismographConfig.fixedTimeScale;
    } else {
      throw new Error("Must be either fixed or linked time scale");
    }

    sddXScale.domain([plotSed.start.toJSDate(), plotSed.end.toJSDate()]);
    sddXScale.range([0, this.width]);
    return sddXScale;
  }

  drawSeismogramsSvg() {
    const sddList = this._seisDataList.concat(this._debugAlignmentSeisData);
    const mythis = this;
    const allSegG = this.g.select("g.allseismograms");
    const traceJoin = allSegG
      .selectAll("g.seismogram")
      .data(sddList)
      .enter()
      .append("g")
      .attr("label", (s: SeismogramDisplayData) => (s ? s.label : "none"))
      .attr("codes", (s: SeismogramDisplayData) =>
        s.seismogram && s.seismogram.hasCodes() ? s.seismogram.codes() : "none",
      )
      .classed("seismogram", true);
    traceJoin.exit().remove();
    const subtraceJoin = traceJoin.selectAll("path").data((sdd: SeismogramDisplayData) => {
      const sddTimeScale = this.timeScaleForSeisDisplayData(sdd);
      const sddAmpScale = this.ampScaleForSeisDisplayData(sdd);
      const segArr = sdd.seismogram ? sdd.seismogram.segments : [];
      return segArr.map(seg => {
        return {
          segment: seg,
          timeScale: sddTimeScale,
          ampScale: sddAmpScale
        };
      });
    });
    subtraceJoin
      .enter()
      .append("path")
      .classed(G_DATA_SELECTOR, true)
      .classed(
        DRAW_BOTH_ALIGN,
        this.seismographConfig.drawingType === DRAW_BOTH_ALIGN,
      )
      .attr("style", "clip-path: url(#" + CLIP_PREFIX + mythis.plotId + ")")
      .attr("shape-rendering", "crispEdges")
      .attr("d", function (segHolder: {segment: SeismogramSegment, timeScale: ScaleTime<number, number>, ampScale: ScaleLinear<number, number>}) {
        return mythis.segmentDrawLine(segHolder.segment, segHolder.timeScale, segHolder.ampScale);
      });
    subtraceJoin.exit().remove();
  }

  calcSecondsPerPixel(xScale: d3.ScaleTime<number, number, never>): number {
    const domain = xScale.domain(); // rel time and absolute both milliseconds

    const range = xScale.range(); // pixels

    return (
      (domain[1].getTime() - domain[0].getTime()) / 1000 / (range[1] - range[0])
    );
  }

  segmentDrawLine(seg: SeismogramSegment, timeScale: ScaleTime<number,number>, ampScale: ScaleLinear<number, number>): string|null {
    const secondsPerPixel = this.calcSecondsPerPixel(timeScale);
    const samplesPerPixel = seg.sampleRate * secondsPerPixel;
    const lineFunc = d3
      .line()
      .curve(d3.curveLinear)
      .x(function (d) {
        return timeScale(d[0]);
      })
      .y(function (d) {
        return ampScale(d[1]);
      });

    if (samplesPerPixel < this.seismographConfig.segmentDrawCompressedCutoff) {
      if (!seg.y) {
        util.log(
          "canvasSeis seg.y not defined: " +
            typeof seg +
            " " +
            (seg instanceof Seismogram),
        );
        return null;
      }

      return lineFunc(
        Array.from(seg.y, function (d, i) {
          return [seg.timeOfSample(i).toJSDate().valueOf(),d];
        }),
      );
    } else {
      // lots of points per pixel so use high/low lines
      if (
        !seg._highlow ||
        seg._highlow.secondsPerPixel !== secondsPerPixel ||
        seg._highlow.xScaleDomain[1] !== timeScale.domain()[1]
      ) {
        const highlow = [];
        const y = seg.y;
        const numHL = 2 * Math.ceil(y.length / samplesPerPixel);

        for (let i = 0; i < numHL; i++) {
          const startidx = i * samplesPerPixel;
          let min = y[startidx];
          let max = y[startidx];
          for (let j=startidx; j<startidx+ samplesPerPixel&& j<y.length;j++) {
            min = Math.min(min, y[j]);
            max = Math.max(max, y[j]);
          }
          highlow[2 * i] = min;
          highlow[2 * i + 1] = max;
        }

        seg._highlow = {
          xScaleDomain: [timeScale.domain()[0], timeScale.domain()[1]],
          xScaleRange: timeScale.range(),
          secondsPerPixel: secondsPerPixel,
          samplesPerPixel: samplesPerPixel,
          highlowArray: highlow,
        };
      }

      return lineFunc(
        seg._highlow.highlowArray.map(function (d: number, i: number) {
          return [
              seg.startTime.valueOf() +
                1000 * ((Math.floor(i / 2) + 0.5) * secondsPerPixel),
              d ];
        }),
      );
    }
  }

  /**
   * Draws the top, bottom, (time) axis and the left and right (amplitude) axis if configured.
   */
  drawAxis(): void {
    this.drawTopBottomAxis();
    this.drawLeftRightAxis();
  }

  ampScaleForAxis(): ScaleLinear<number, number, never> {
    const ampAxisScale = d3.scaleLinear();
    ampAxisScale.range([this.height, 0]);
    if (this.seismographConfig.fixedAmplitudeScale) {
      ampAxisScale.domain(this.seismographConfig.fixedAmplitudeScale);
    } else if (this.seismographConfig.linkedAmplitudeScale) {
      let middle = this.amp_scalable.drawMiddle;
      if (this.seismographConfig.centeredAmp) {
        middle = 0;
      }
      ampAxisScale.domain([ middle - this.amp_scalable.drawHalfWidth,
                      middle + this.amp_scalable.drawHalfWidth ]);
    } else {
      throw new Error("ampScaleForAxis Must be either linked or fixed amp scale");
    }
    return ampAxisScale;
  }

  timeScaleForAxis(): ScaleLinear<number, number, never> | ScaleTime<number, number, never> {
    let xScaleToDraw;
    if (this.seismographConfig.isRelativeTime) {
      xScaleToDraw = d3.scaleLinear();
      xScaleToDraw.range([0, this.width]);
      if (this.seismographConfig.linkedTimeScale) {
        const startOffset = this.time_scalable.drawAlignmentTimeOffset.toMillis()/1000;
        const duration = this.time_scalable.drawDuration.toMillis()/1000;
        xScaleToDraw.domain([startOffset, startOffset+duration]);
      } else if (this.seismographConfig.fixedTimeScale) {
        const psed = this.seismographConfig.fixedTimeScale;
        xScaleToDraw.domain([psed.start.toMillis()/1000, psed.end.toMillis()/1000]);
      } else {
        throw new Error("neither fixed nor linked time scale");
      }
    } else {
      if (this.seismographConfig.linkedTimeScale) {
        if (this.seisData.length > 0) {
          xScaleToDraw = this.timeScaleForSeisDisplayData(this.seisData[0]);
        } else {
          const psed = Interval.before(DateTime.utc(), this.seismographConfig.linkedTimeScale.duration);
          xScaleToDraw = d3.scaleUtc();
          xScaleToDraw.range([0, this.width]);
          xScaleToDraw.domain([psed.start.toJSDate(), psed.end.toJSDate()]);
        }
      } else if (this.seismographConfig.fixedTimeScale) {
        const psed = this.seismographConfig.fixedTimeScale;
        xScaleToDraw = d3.scaleUtc();
        xScaleToDraw.range([0, this.width]);
        xScaleToDraw.domain([psed.start.toJSDate(), psed.end.toJSDate()]);
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
    let xScaleToDraw;

    if (this.seismographConfig.isRelativeTime) {
      xScaleToDraw = this.timeScaleForAxis();
      if (this.seismographConfig.isXAxis) {
        const xAxis = d3.axisBottom(xScaleToDraw);
        xAxis.tickFormat(createNumberFormatWrapper(this.seismographConfig.relativeTimeFormat));
        this.g.append("g")
          .attr("class", "axis axis--x")
          .attr("transform", "translate(0," + this.height + ")")
          .call(xAxis);
      }
      if (this.seismographConfig.isXAxisTop) {
        const xAxisTop = d3.axisTop(xScaleToDraw);
        xAxisTop.tickFormat(createNumberFormatWrapper(this.seismographConfig.relativeTimeFormat));
        this.g.append("g").attr("class", "axis axis--x-top").call(xAxisTop);
      }

    } else {
      xScaleToDraw = this.timeScaleForAxis();
      if (this.seismographConfig.isXAxis) {
        const xAxis = d3.axisBottom(xScaleToDraw);
        xAxis.tickFormat(createDateFormatWrapper(this.seismographConfig.timeFormat));
        this.g.append("g")
          .attr("class", "axis axis--x")
          .attr("transform", "translate(0," + this.height + ")")
          .call(xAxis);
      }
      if (this.seismographConfig.isXAxisTop) {
        const xAxisTop = d3.axisTop(xScaleToDraw);
        xAxisTop.tickFormat(createDateFormatWrapper(this.seismographConfig.timeFormat));
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
  createLeftRightAxis(): Array<d3.Axis<d3.NumberValue> | null> {
    let yAxis = null;
    let yAxisRight = null;
    const axisScale = this.ampScaleForAxis();
    if (this.seismographConfig.isYAxis) {
      yAxis = d3
        .axisLeft(axisScale)
        .tickFormat(numberFormatWrapper(this.seismographConfig.amplitudeFormat));
      yAxis.scale(axisScale);
      yAxis.ticks(8, this.seismographConfig.amplitudeFormat);

    }

    if (this.seismographConfig.isYAxisRight) {
      yAxisRight = d3
        .axisRight(axisScale)
        .tickFormat(numberFormatWrapper(this.seismographConfig.amplitudeFormat));
      yAxisRight.scale(axisScale);
      yAxisRight.ticks(8, this.seismographConfig.amplitudeFormat);

    }
    return [ yAxis, yAxisRight ];
  }

  rescaleYAxis(): void {
    if (!this.beforeFirstDraw) {
      const delay = 500;
      const mythis = this;

      if (this.throttleRescale) {
        clearTimeout(this.throttleRescale);
      }

      this.throttleRescale = setTimeout(function () {

        const [yAxis, yAxisRight] = mythis.createLeftRightAxis();
        if (yAxis) {
          mythis.g
            .select(".axis--y")
            .transition()
            .duration(delay / 2)
            .call(yAxis);
        }

        if (yAxisRight) {
          mythis.g
            .select(".axis--y-right")
            .transition()
            .duration(delay / 2)
            .call(yAxisRight);
        }

        mythis.throttleRescale = null;
      }, delay);
    }
  }

  createHandlebarsInput(): any {
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

  zoomed(e: any): void {
    const t = e.transform;

    if (isDef(this.seismographConfig.linkedTimeScale)) {
      const linkedTS = this.seismographConfig.linkedTimeScale;

      const origOffset = linkedTS.origOffset.toMillis()/1000;
      const origDuration = linkedTS.origDuration.toMillis()/1000;
      const origXScale = d3.scaleLinear();
      origXScale.range([0, this.width]);
      origXScale.domain([origOffset, origOffset+origDuration]);
      const xt = t.rescaleX(origXScale);
      const startDelta = xt.domain()[0].valueOf() - origXScale.domain()[0].valueOf();
      const duration = xt.domain()[1] - xt.domain()[0];
      linkedTS.zoom(
        Duration.fromMillis(startDelta*1000),
        Duration.fromMillis(duration*1000),
      );
    } else {
      throw new Error("can't zoom fixedTimeScale");
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
        .attr("transform", function (mh: MarkerHolderType) {
          mh.xscale = mythis.timeScaleForSeisDisplayData(mh.sdd);
          const textx = mh.xscale(mh.marker.time.toJSDate());
          return "translate(" + textx + "," + 0 + ")";
        });
      const axisScale = mythis.ampScaleForAxis();
      this.g
        .select("g.allmarkers")
        .selectAll("g.markertext")
        .attr("transform", function () {
          // shift up by this.seismographConfig.markerTextOffset percentage
          const axisScale = mythis.ampScaleForAxis();
          const maxY = axisScale.range()[0];
          const deltaY = axisScale.range()[0] - axisScale.range()[1];
          const texty = maxY - mythis.seismographConfig.markerTextOffset * deltaY;
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
      this.g
        .select("g.allmarkers")
        .selectAll("path.markerpath")
        .attr("d", () => {
          return d3
            .line()
            .x(function () {
              return 0; // g is translated so marker time is zero
            })
            .y(function (d, i) {
              return i === 0 ? 0 : axisScale.range()[0];
            })
            .curve(d3.curveLinear)([ [
              axisScale.domain()[0],
              axisScale.domain()[1],
          ] ]); // call the d3 function created by line with data
        });
      const undrawnMarkers = this._seisDataList
        .reduce((acc, sdd) => {
          const sddXScale = this.timeScaleForSeisDisplayData(sdd);
          sdd.markerList.forEach(m =>
            acc.push({
              // use marker holder to also hold xscale in case relative plot
              marker: m,
              sdd: sdd,
              xscale: sddXScale,
            }),
          );
          return acc;
        }, new Array<MarkerHolderType>(0))
        .filter(mh => {
          const xpixel = mh.xscale(mh.marker.time.toJSDate());
          return xpixel >= mh.xscale.range()[0] && xpixel <= mh.xscale.range()[1];
        });

      if (undrawnMarkers.length !== 0) {
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
        sdd.markerList.forEach(m =>
          acc.push({
            // use marker holder to also hold xscale in case relative plot
            marker: m,
            sdd: sdd,
            xscale: sddXScale,
          }),
        );
        return acc;
      }, [])
      .filter(mh => {
        const xpixel = mh.xscale(mh.marker.time.toJSDate());
        return xpixel >= mh.xscale.range()[0] && xpixel <= mh.xscale.range()[1];
      });
    // marker overlay
    const mythis = this;
    const markerG = this.g.select("g.allmarkers");
    markerG.selectAll("g.marker").remove();
    const labelSelection = markerG
      .selectAll("g.marker")
      .data(allMarkers, function (mh: MarkerHolderType) {
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
      .attr("transform", function (mh: MarkerHolderType) {
        const textx = mh.xscale(mh.marker.time.toJSDate());
        return "translate(" + textx + "," + 0 + ")";
      })
      .each(function (mh: MarkerHolderType) {
        // @ts-ignore
        const drawG = d3.select(this);
        drawG.classed(mh.marker.name, true).classed(mh.marker.type, true);
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
            return mh.marker.name + " " + mh.marker.time.toISO();
          }
        });
        const textSel = innerTextG.append("text");

        if (mh.marker.link && mh.marker.link.length > 0) {
          // if marker has link, make it clickable
          textSel
            .append("svg:a")
            .attr("xlink:href", () => ""+mh.marker.link)
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
        let markerPoleY =0;
        if (mythis.seismographConfig.markerFlagpoleBase === "center") {
          markerPoleY = (axisScale.range()[0] + axisScale.range()[1]) / 2;
        } else {
          markerPoleY = axisScale.range()[0];
        }
        let markerPole = `M0,0l0,${markerPoleY}`;
        drawG
          .append("path")
          .classed("markerpath", true)
          .attr("d", markerPole);
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

    if (this.canvas) {
      this.canvasHolder
        .attr("width", this.width)
        .attr("height", this.height + 1);
      this.canvas.attr("width", this.width).attr("height", this.height + 1);
    }
  }

  throttle(func: () => void, delay: number): void {
    if (this.throttleResize) {
      clearTimeout(this.throttleResize);
    }

    this.throttleResize = setTimeout(func, delay);
  }

  resizeNeeded() {
    const myThis = this;
    this.throttle(function () {
      myThis.draw();
    }, 250);
  }

  drawTitle() {
    const wrapper = (this.shadowRoot?.querySelector('div') as HTMLDivElement);
    const svgEl = wrapper.querySelector('svg') as SVGElement;
    axisutil.drawTitle(
      svgEl,
      this.seismographConfig,
      this.height,
      this.width,
      this.createHandlebarsInput(),
    );
  }

  drawXLabel() {
    const wrapper = (this.shadowRoot?.querySelector('div') as HTMLDivElement);
    const svgEl = wrapper.querySelector('svg') as SVGElement;
    axisutil.drawXLabel(
      svgEl,
      this.seismographConfig,
      this.height,
      this.width,
      this.createHandlebarsInput(),
    );
  }

  drawXSublabel() {
    const wrapper = (this.shadowRoot?.querySelector('div') as HTMLDivElement);
    const svgEl = wrapper.querySelector('svg') as SVGElement;
    axisutil.drawXSublabel(
      svgEl,
      this.seismographConfig,
      this.height,
      this.width,
      this.createHandlebarsInput(),
    );
  }

  drawYLabel() {
    const wrapper = (this.shadowRoot?.querySelector('div') as HTMLDivElement);
    const svgEl = wrapper.querySelector('svg') as SVGElement;
    axisutil.drawYLabel(
      svgEl,
      this.seismographConfig,
      this.height,
      this.width,
      this.createHandlebarsInput(),
    );
  }

  drawYSublabel() {
    const wrapper = (this.shadowRoot?.querySelector('div') as HTMLDivElement);
    const svgEl = wrapper.querySelector('svg') as SVGElement;
    axisutil.drawYSublabel(
      svgEl,
      this.seismographConfig,
      this.height,
      this.width,
      this.createHandlebarsInput(),
    );
  }

  calcTimeScaleDomain(): void {
    if (this.seismographConfig.isRelativeTime) {

      if (isDef(this.seismographConfig.linkedTimeScale)) {
        if (this._seisDataList.length !== 0 && this.seismographConfig.linkedTimeScale.duration.toMillis()===0) {
          this.seismographConfig.linkedTimeScale.duration = findMaxDuration(this._seisDataList);
        }
      } else if (this.seismographConfig.fixedTimeScale) {
      } else {
      }
    } else {

      if (isDef(this.seismographConfig.linkedTimeScale)) {
        const linkedTimeScale = this.seismographConfig.linkedTimeScale;
        if (this._seisDataList.length !== 0 && linkedTimeScale.duration.toMillis()===0) {
          this.seismographConfig.linkedTimeScale.duration = findMaxDuration(this._seisDataList);
        }
      } else if (this.seismographConfig.fixedTimeScale) {
      } else {
      }

    }
  }

  calcAmpScaleDomain(): [number, number] {

    let minMax;
    if (this.seismographConfig.fixedAmplitudeScale) {
      minMax = this.seismographConfig.fixedAmplitudeScale;
    } else {
      if (this.seismographConfig.windowAmp) {
        if (isDef(this.seismographConfig.linkedTimeScale)) {
          minMax = findMinMaxOverRelativeTimeRange(
            this._seisDataList,
            this.seismographConfig.linkedTimeScale.offset,
            this.seismographConfig.linkedTimeScale.duration,
            this.seismographConfig.doGain,
            this.seismographConfig.centeredAmp
          );
        } else if (isDef(this.seismographConfig.fixedTimeScale)) {
          minMax = findMinMaxOverTimeRange(this._seisDataList,
            this.seismographConfig.fixedTimeScale,
            this.seismographConfig.doGain,
            this.seismographConfig.centeredAmp);
        } else {
          throw new Error("neither fixed nor linked time scale");
        }
      } else {

        minMax = findMinMax(this._seisDataList,
          this.seismographConfig.doGain,
          this.seismographConfig.centeredAmp);
      }

      if (minMax[0] === minMax[1]) {
        // flatlined data, use -1, +1
        //minMax = [minMax[0] - 1, minMax[1] + 1];
      }
      if (this.seismographConfig.isYAxisNice) {
        // use d3 scale's nice function
        let scale = d3.scaleLinear();
        scale.domain(minMax);
        scale = scale.nice();
        minMax = scale.domain();
      }


    }
    const middle = (minMax[1]+minMax[0])/2;
    const halfWidth = (minMax[1]-minMax[0])/2;
    return [middle, halfWidth];
  }

  recheckAmpScaleDomain(): void {
    const calcMidHW = this.calcAmpScaleDomain();
    const oldMiddle = this.amp_scalable.middle;
    const oldHalfWidth = this.amp_scalable.halfWidth;
    this.amp_scalable.middle = calcMidHW[0];
    this.amp_scalable.halfWidth = calcMidHW[1];

    if (this.seismographConfig.linkedAmplitudeScale) {
      if (this.amp_scalable.middle !== oldMiddle || this.amp_scalable.halfWidth !== oldHalfWidth) {
        this.seismographConfig.linkedAmplitudeScale.recalculate(); // sets yScale.domain
      }
    } else {
      this.redoDisplayYScale();
    }
  }

  redoDisplayYScale(): void {
    if (
      this.seismographConfig.doGain &&
      this._seisDataList.length > 0 &&
      this._seisDataList.every(sdd => sdd.hasSensitivity()) &&
      this._seisDataList.every(
        sdd => isDef(sdd.seismogram) && sdd.seismogram.yUnit === COUNT_UNIT,
      )
    ) {
      // each has seisitivity
      const firstSensitivity = this._seisDataList[0].sensitivity;
      const allSameSensitivity = this._seisDataList.every(
        sdd =>
          isDef(firstSensitivity) &&
          sdd.sensitivity &&
          firstSensitivity.sensitivity === sdd.sensitivity.sensitivity &&
          firstSensitivity.inputUnits === sdd.sensitivity.inputUnits &&
          firstSensitivity.outputUnits === sdd.sensitivity.outputUnits,
      );
      if (!allSameSensitivity) {
        console.log(`not all same sensitivity: ${this._seisDataList.length}`);
        this._seisDataList.forEach(sdd => {
          console.log(` ${sdd.sensitivity?.sensitivity} ${sdd.sensitivity?.inputUnits} ${sdd.sensitivity?.outputUnits}`);
        });
      }

      if (
        isDef(firstSensitivity) &&
        this._seisDataList.every(
          sdd =>
            isDef(firstSensitivity) &&
            sdd.sensitivity &&
            firstSensitivity.sensitivity === sdd.sensitivity.sensitivity &&
            firstSensitivity.inputUnits === sdd.sensitivity.inputUnits &&
            firstSensitivity.outputUnits === sdd.sensitivity.outputUnits,
        )
      ) {
        //niceMinMax[0] = niceMinMax[0] / firstSensitivity.sensitivity;
        //niceMinMax[1] = niceMinMax[1] / firstSensitivity.sensitivity;

        if (this.seismographConfig.ySublabelIsUnits) {
          this.seismographConfig.ySublabel = firstSensitivity.inputUnits;
        }
      } else {

        throw new Error(
          `doGain with different seisitivities not yet implemented. ${firstSensitivity} doGain=${this.seismographConfig.doGain}`,
        );
      }
    } else {
      if (this.seismographConfig.ySublabelIsUnits) {
        this.seismographConfig.ySublabel = "";
        const allUnits = [];

        for (const t of this._seisDataList) {
          if (t.seismogram) {
            const u = t.seismogram.yUnit;
            allUnits.push(u);
            this.seismographConfig.ySublabel += `${u} `;
          }
        }

        if (allUnits.length === 0) {
          allUnits.push("Count");
        }

        this.seismographConfig.ySublabel = allUnits.join(" ");
      }
    }

    if (this.seismographConfig.ySublabelIsUnits && this.seismographConfig.centeredAmp) {
      this.seismographConfig.ySublabel = `centered ${this.seismographConfig.ySublabel}`;
    }

    this.rescaleYAxis();

    if (this.seismographConfig.ySublabelIsUnits) {
      this.drawYSublabel();
    }
  }

  getSeismogramData(): Array<SeismogramDisplayData> {
    return this._seisDataList;
  }

  /**
   * can append single seismogram segment or an array of segments.
   *
   * @param sddList array or single SeismogramDisplayData or Seismogram
   * @private
   */
  _internalAppend(
    sddList:
      | Array<SeismogramDisplayData>
      | SeismogramDisplayData
      | Array<Seismogram>
      | Seismogram,
  ): void {
    if (!sddList) {
      // don't append a null
    } else if (Array.isArray(sddList)) {
      for (const s of sddList) {
        if (s instanceof SeismogramDisplayData) {
          this._seisDataList.push(s);
        } else {
          this._seisDataList.push(SeismogramDisplayData.fromSeismogram(s));
        }
      }
    } else {
      if (sddList instanceof SeismogramDisplayData) {
        this._seisDataList.push(sddList);
      } else {
        this._seisDataList.push(SeismogramDisplayData.fromSeismogram(sddList));
      }
    }
  }

  /**
   * appends the seismogram(s) or SeismogramDisplayData as separate time series.
   *
   * @param seismogram data to append
   */
  appendSeisData(seismogram: Array<Seismogram> | Array<SeismogramDisplayData> | Seismogram | SeismogramDisplayData) {
    this._internalAppend(seismogram);
    this.calcTimeScaleDomain();
    this.recheckAmpScaleDomain();
    if (!this.beforeFirstDraw) {
      // only trigger a draw if appending after already drawn on screen
      // otherwise, just append the data and wait for outside to call first draw()
      //this.drawSeismograms();
      this.redraw();
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
    const out = this._seisDataList.find(sd => sd.seismogram === seis);

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
    this._seisDataList = this._seisDataList.filter(sd => sd !== seisData);
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
    super(calcMidHW[0], calcMidHW[1]);
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

  constructor(graph: Seismograph, alignmentTimeOffset: Duration, duration: Duration) {
    super(alignmentTimeOffset, duration);
    this.graph = graph;
    this.drawAlignmentTimeOffset = ZERO_DURATION;
    this.drawDuration = ZERO_DURATION;
  }

  notifyTimeRangeChange(
    offset: Duration,
    duration: Duration,
  ) {
    if (!this.drawAlignmentTimeOffset.equals(offset) ||
        !this.drawDuration.equals(duration)) {
      this.drawAlignmentTimeOffset = offset;
      this.drawDuration = duration;
      // something changed, maybe redraw
      if (isDef(this.graph) && ! this.graph.beforeFirstDraw) {
        this.graph.redrawWithXScale();
      }
    }
  }
}
// static ID for seismogram
Seismograph._lastID = 0;

/**
 * Creates Markers for all of the arrivals in ttime.arrivals, relative
 * to the given Quake.
 *
 * @param   quake quake the travel times are relative to
 * @param   ttime travel times json object as returned from the
 * IRIS traveltime web service, or the json output of TauP
 * @returns        array of Markers suitable for adding to a seismograph
 */
export function createMarkersForTravelTimes(
  quake: Quake,
  ttime: TraveltimeJsonType,
): Array<MarkerType> {
  return ttime.arrivals.map(a => {
    return {
      type: "predicted",
      name: a.phase,
      time: quake.time.plus(Duration.fromMillis(1000*a.time)),
      description: "",
    };
  });
}

/**
 * Creates a Marker for the origin time in ttime.arrivals, for the given Quake.
 *
 * @param   quake quake the travel times are relative to
 * @returns        Marker suitable for adding to a seismograph
 */
export function createMarkerForOriginTime(quake: Quake): MarkerType {
  return {
    type: "predicted",
    name: "origin",
    time: quake.time,
    description: "",
  };
}
export function createFullMarkersForQuakeAtStation(
  quake: Quake,
  station: Station,
): Array<MarkerType> {
  const markers: Array<MarkerType> = [];
  const daz = distaz.distaz(
    station.latitude,
    station.longitude,
    quake.latitude,
    quake.longitude,
  );
  markers.push({
    type: "predicted",
    name: `M${quake.preferredMagnitude.mag} ${quake.time.toFormat("HH:mm")}`,
    time: quake.time,
    link: `https://earthquake.usgs.gov/earthquakes/eventpage/${quake.eventId}/executive`,
    description: `${quake.time.toISO()}
${quake.latitude.toFixed(2)}/${quake.longitude.toFixed(2)} ${(
      quake.depth / 1000
    ).toFixed(2)} km
${quake.description}
${quake.preferredMagnitude.toString()}
${daz.delta.toFixed(2)} deg to ${station.stationCode} (${daz.distanceKm} km)
`,
  });
  return markers;
}
export function createFullMarkersForQuakeAtChannel(
  quake: Quake,
  channel: Channel,
): Array<MarkerType> {
  const markers = createFullMarkersForQuakeAtStation(quake, channel.station);
  return markers.concat(createMarkerForPicks(quake.preferredOrigin, channel));
}

/**
 * Creates a Marker for the picked arrival times in quake.arrivals, for the given Quake.
 *
 * @param origin quake the travel times are relative to
 * @param channel channel picks made on
 * @returns        Marker suitable for adding to a seismograph
 */
export function createMarkerForPicks(
  origin: Origin,
  channel: Channel,
): Array<MarkerType> {
  const markers: Array<MarkerType> = [];

  if (origin.arrivals) {
    origin.arrivals.forEach(arrival => {
      if (arrival && arrival.pick.isOnChannel(channel)) {
        markers.push({
          type: "pick",
          name: arrival.phase,
          time: arrival.pick.time,
          description: "",
        });
      }
    });
  }

  return markers;
}
/**
 * Creates a wrapper for d3 formatter for numbers for axis that keeps typescript happy.
 *
 * @param  formatter simple formatter
 * @returns           function that converts input types
 */

export function createNumberFormatWrapper(formatter: (value: number) => string): (nValue: d3.NumberValue) => string {
  return (nValue: d3.NumberValue) => {
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
export function createDateFormatWrapper(formatter: (value: Date) => string): (nValue: Date | d3.NumberValue, index: number) => string {
  return (nValue: Date | d3.NumberValue) => {
    if (nValue instanceof Date) {
      return formatter(nValue);
    } else if (typeof nValue === "number") {
      return formatter(new Date(nValue));
    } else {
      return formatter(new Date(nValue.valueOf()));
    }
  };
}
customElements.define(SEISMOGRAPH_ELEMENT, Seismograph);
