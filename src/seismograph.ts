/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */
 import {DateTime, Duration} from "luxon";
import * as d3 from "d3";
import {insertCSS, AUTO_COLOR_SELECTOR, G_DATA_SELECTOR} from "./cssutil";
import {
  AmplitudeScalable,
  TimeScalable,
} from "./scale";
import {
  SeismographConfig,
  DRAW_SVG,
  DRAW_CANVAS,
  DRAW_BOTH,
  DRAW_BOTH_ALIGN,
  numberFormatWrapper,
} from "./seismographconfig";
import type {MarkerType} from "./seismogram";
import type {MarginType} from "./seismographconfig";
import type {TraveltimeJsonType} from "./traveltime";
import type {ScaleLinear, ScaleTime} from "d3-scale"
import {
  SeismogramDisplayData,
  findStartEnd,
  findMaxDuration,
  findMinMax,
  findMinMaxOverTimeRange,
  findMinMaxOverRelativeTimeRange,
  SeismogramSegment,
  Seismogram,
  COUNT_UNIT,
} from "./seismogram";
import {SeisPlotElement} from "./spelement";
import {Quake, Origin} from "./quakeml";
import {Station, Channel} from "./stationxml";
import * as distaz from "./distaz";
import {
  drawAxisLabels,
  drawTitle,
  drawXLabel,
  drawXSublabel,
  drawYLabel,
  drawYSublabel,
} from "./axisutil";
import * as util from "./util"; // for util.log to replace console.log

import {StartEndDuration, isDef, isNumArg} from "./util";
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

export const SEISMOGRAPH_ELEMENT = 'seismo-graph';
export const seismograph_css = `

:host {
  display: block;
  min-height: 100px;
  height: 100%;
}

div.wrapper {
  min-height: 100px;
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

  yScale: any; // for drawing seismogram

  yScaleRmean: any; // for drawing y axis

  yScaleData: any; // holds min max of data in time window

  zoom: any;
  g: any;
  throttleRescale: any;
  throttleResize: any;
  myTimeScalable: TimeScalable;
  myAmpScalable: AmplitudeScalable;

  constructor(seisData?: Array<SeismogramDisplayData>, seisConfig?: SeismographConfig) {
    super(seisData, seisConfig);
    this.outerWidth = -1;
    this.outerHeight = -1;

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
    this.svg.attr("version", "1.1");
    this.svg.attr("plotId", this.plotId);

    this.myTimeScalable = new SeismographTimeScalable(this);

    if (isDef(this.seismographConfig.linkedTimeScale)) {
      this.seismographConfig.linkedTimeScale.link(this.myTimeScalable);
    }

    this.calcTimeScaleDomain();
    this.yScale = d3.scaleLinear();
    this.yScaleData = d3.scaleLinear();
    // yScale for axis (not drawing) that puts mean at 0 in center
    this.yScaleRmean = d3.scaleLinear();
    this.calcAmpScaleDomain();
    this.myAmpScalable = new SeismographAmplitudeScalable(this);

    if (this.seismographConfig.linkedAmplitudeScale) {
      this.seismographConfig.linkedAmplitudeScale.link(this.myAmpScalable);
    }


    let mythis = this;
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
    let z = this.svg.call(
      d3.zoom().on("zoom", function (e) {
        mythis.zoomed(e);
      }),
    );

    if (!this.seismographConfig.wheelZoom) {
      z.on("wheel.zoom", null);
    }

    // create marker g
    this.g
      .append("g")
      .attr("class", "allmarkers")
      .attr("style", "clip-path: url(#" + CLIP_PREFIX + this.plotId + ")");
    d3.select(window).on(
      "resize.canvasseismograph" + mythis.plotId,
      function () {
        if (!mythis.beforeFirstDraw && mythis.checkResize()) {
          mythis.draw();
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
    super.seismographConfig = seismographConfig
    const mythis = this;
    if (this.seismographConfig.linkedAmplitudeScale) {
      this.seismographConfig.linkedAmplitudeScale.link(this.myAmpScalable);
    }
    if (isDef(this.seismographConfig.linkedTimeScale)) {
      this.seismographConfig.linkedTimeScale.link(this.myTimeScalable);
    }
    const z = this.svg.call(
      d3.zoom().on("zoom", function (e) {
        mythis.zoomed(e);
      }),
    );
    if (!this.seismographConfig.wheelZoom) {
      z.on("wheel.zoom", null);
    }

    this.draw();
  }
  connectedCallback() {
    this.draw();
  }
  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    this.draw();
  }

  checkResize(): boolean {
    let rect = this.svg.node().getBoundingClientRect();

    if (rect.width !== this.outerWidth || rect.height !== this.outerHeight) {
      return true;
    }

    return false;
  }

  draw(): void {
    if ( ! this.isConnected) { return; }
    let rect = this.svg.node().getBoundingClientRect();

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

      this.calcWidthHeight(rect.width, calcHeight);
    }

    if (this.canvas) {
      this.canvasHolder.attr("width", this.width).attr("height", this.height);
      this.canvas.attr("width", this.width).attr("height", this.height);
    } else {
      this.canvasHolder = this.svg
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
      let style = window.getComputedStyle(this.svg.node());
      let padTop =  Number(style.getPropertyValue("padding-top").replace("px", ""));
      let borderTop = Number(style.getPropertyValue("border-top-width").replace("px", ""));
    }

    this.drawSeismograms();
    this.drawAxis();
    drawAxisLabels(
      this.svg,
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
    let out = "";
    let rect = this.svg.node().getBoundingClientRect();
    out += "svg rect.height " + rect.height + "\n";
    out += "svg rect.width " + rect.width + "\n";
    let grect = this.getBoundingClientRect();
    out += "parent rect.height " + grect.height + "\n";
    out += "parent rect.width " + grect.width + "\n";
    let crect = this.canvas.node().getBoundingClientRect();
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
      let ti = sddIndex;
      const xscaleForSDD: d3.ScaleTime<number, number, never> = this.timeScaleForSeisDisplayData(sdd);
      const rangeTop: number = xscaleForSDD.range()[1];
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
              this.yScale(s.y[leftVisibleSample]),
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
              this.yScale(s.y[i]),
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
    let container = this.svg
      .select("defs")
      .select("#" + CLIP_PREFIX + this.plotId);

    if (container.empty()) {
      this.svg
        .append("defs")
        .append("clipPath")
        .attr("id", CLIP_PREFIX + this.plotId);
    }

    let clip = this.svg.select("defs").select("#" + CLIP_PREFIX + this.plotId);
    clip.selectAll("rect").remove();
    clip.append("rect").attr("width", this.width).attr("height", this.height);
  }

  timeScaleForSeisDisplayData(sdd: SeismogramDisplayData): ScaleTime<number, number, never> {
    let plotSed;
    let sddXScale = d3.scaleUtc();

    if (this.seismographConfig.linkedTimeScale) {
      plotSed = sdd.relativeTimeWindow(
        this.seismographConfig.linkedTimeScale.offset,
        this.seismographConfig.linkedTimeScale.duration,
      );
    } else if (this.seismographConfig.fixedTimeScale) {
      plotSed = this.seismographConfig.fixedTimeScale;
    } else {
      throw new Error("neither fixed nor linked time scale");
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
        s.seismogram && s.seismogram.hasCodes ? s.seismogram.codes() : "none",
      )
      .classed("seismogram", true);
    traceJoin.exit().remove();
    const subtraceJoin = traceJoin.selectAll("path").data((sdd: SeismogramDisplayData) => {
      const sddXScale = this.timeScaleForSeisDisplayData(sdd);
      let segArr = sdd.seismogram ? sdd.seismogram.segments : [];
      return segArr.map(seg => {
        return {
          segment: seg,
          xscale: sddXScale,
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
      .attr("d", function (segHolder: {segment: SeismogramSegment, xscale: ScaleTime<number, number>}) {
        return mythis.segmentDrawLine(segHolder.segment, segHolder.xscale);
      });
    subtraceJoin.exit().remove();
  }

  calcSecondsPerPixel(xScale: d3.ScaleTime<number, number, never>): number {
    let domain = xScale.domain(); // rel time and absolute both milliseconds

    let range = xScale.range(); // pixels

    return (
      (domain[1].getTime() - domain[0].getTime()) / 1000 / (range[1] - range[0])
    );
  }

  segmentDrawLine(seg: SeismogramSegment, xScale: ScaleTime<number,number>): string|null {
    const mythis = this;
    let secondsPerPixel = this.calcSecondsPerPixel(xScale);
    let samplesPerPixel = seg.sampleRate * secondsPerPixel;
    let lineFunc = d3
      .line()
      .curve(d3.curveLinear)
      .x(function (d) {
        return xScale(d[0]);
      })
      .y(function (d) {
        return mythis.yScale(d[1]);
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
        seg._highlow.xScaleDomain[1] !== xScale.domain()[1]
      ) {
        let highlow = [];
        let y = seg.y;
        let numHL = 2 * Math.ceil(y.length / samplesPerPixel);

        for (let i = 0; i < numHL; i++) {
          let startidx = i * samplesPerPixel;
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
          xScaleDomain: [xScale.domain()[0], xScale.domain()[1]],
          xScaleRange: xScale.range(),
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

  timeScaleForAxis(): ScaleLinear<number, number, never> | ScaleTime<number, number, never> {
    let xScaleToDraw;
    if (this.seismographConfig.isRelativeTime) {
      xScaleToDraw = d3.scaleLinear();
      xScaleToDraw.range([0, this.width]);
      if (this.seismographConfig.linkedTimeScale) {
        const startOffset = this.seismographConfig.linkedTimeScale.offset.toMillis()/1000;
        const duration = this.seismographConfig.linkedTimeScale.duration.toMillis()/1000;
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
          const psed = new StartEndDuration(null, null, this.seismographConfig.linkedTimeScale.duration);
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
    let xAxis;

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
    let [yAxis, yAxisRight] = this.createLeftRightAxis();
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
  createLeftRightAxis(): Array<d3.Axis<d3.AxisDomain> | null> {
    let yAxis = null;
    let yAxisRight = null;
    if (this.seismographConfig.isYAxis) {
      yAxis = d3
        .axisLeft(this.yScaleRmean)
        .tickFormat(numberFormatWrapper(this.seismographConfig.amplitudeFormat));
      yAxis.scale(this.yScaleRmean);
      yAxis.ticks(8, this.seismographConfig.amplitudeFormat);

    }

    if (this.seismographConfig.isYAxisRight) {
      yAxisRight = d3
        .axisRight(this.yScaleRmean)
        .tickFormat(numberFormatWrapper(this.seismographConfig.amplitudeFormat));
      yAxisRight.scale(this.yScaleRmean);
      yAxisRight.ticks(8, this.seismographConfig.amplitudeFormat);

    }
    return [ yAxis, yAxisRight ];
  }

  rescaleYAxis(): void {
    if (!this.beforeFirstDraw) {
      let delay = 500;
      let mythis = this;

      if (this.throttleRescale) {
        window.clearTimeout(this.throttleRescale);
      }

      this.throttleRescale = window.setTimeout(function () {

        let [yAxis, yAxisRight] = mythis.createLeftRightAxis();
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
    let t = e.transform;

    if (isDef(this.seismographConfig.linkedTimeScale)) {
      const linkedTS = this.seismographConfig.linkedTimeScale;

      const origOffset = linkedTS.origOffset.toMillis()/1000;
      const origDuration = linkedTS.origDuration.toMillis()/1000;
      const origXScale = d3.scaleLinear();
      origXScale.range([0, this.width]);
      origXScale.domain([origOffset, origOffset+origDuration]);
      let xt = t.rescaleX(origXScale);
      let startDelta = xt.domain()[0].valueOf() - origXScale.domain()[0].valueOf();
      let duration = xt.domain()[1] - xt.domain()[0];
      linkedTS.zoom(
        Duration.fromMillis(startDelta*1000),
        Duration.fromMillis(duration*1000),
      );
    } else {
      throw new Error("can't zoom fixedTimeScale");
    }
  }

  redrawWithXScale(): void {
    let mythis = this;

    if (!this.beforeFirstDraw) {
      this.g.select("g.allseismograms").selectAll("g.seismogram").remove();

      if (this.seismographConfig.windowAmp) {
        this.calcAmpScaleDomain();
      }

      this.drawSeismograms();
      this.g
        .select("g.allmarkers")
        .selectAll("g.marker")
        .attr("transform", function (mh: MarkerHolderType) {
          mh.xscale = mythis.timeScaleForSeisDisplayData(mh.sdd);
          let textx = mh.xscale(mh.marker.time.toJSDate());
          return "translate(" + textx + "," + 0 + ")";
        });
      this.g
        .select("g.allmarkers")
        .selectAll("g.markertext")
        .attr("transform", function () {
          // shift up by this.seismographConfig.markerTextOffset percentage
          let maxY = mythis.yScale.range()[0];
          let deltaY = mythis.yScale.range()[0] - mythis.yScale.range()[1];
          let texty = maxY - mythis.seismographConfig.markerTextOffset * deltaY;
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
              return i === 0 ? 0 : mythis.yScale.range()[0];
            })
            .curve(d3.curveLinear)([
            mythis.yScale.domain()[0],
            mythis.yScale.domain()[1],
          ]); // call the d3 function created by line with data
        });
      let undrawnMarkers = this._seisDataList
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
          return xpixel < mh.xscale.range()[0] || xpixel > mh.xscale.range()[1];
        });

      if (undrawnMarkers.length !== 0) {
        this.drawMarkers();
      }

      this.drawTopBottomAxis();
    }
  }

  drawMarkers() {
    let allMarkers: Array<MarkerHolderType> = this._seisDataList
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
    let mythis = this;
    let markerG = this.g.select("g.allmarkers");
    markerG.selectAll("g.marker").remove();
    let labelSelection = markerG
      .selectAll("g.marker")
      .data(allMarkers, function (mh: MarkerHolderType) {
        // key for data
        return `${mh.marker.name}_${mh.marker.time.toISO()}`;
      });
    labelSelection.exit().remove();
    let radianTextAngle =
      (this.seismographConfig.markerTextAngle * Math.PI) / 180;
    labelSelection
      .enter()
      .append("g")
      .classed("marker", true) // translate so marker time is zero
      .attr("transform", function (mh: MarkerHolderType) {
        let textx = mh.xscale(mh.marker.time.toJSDate());
        return "translate(" + textx + "," + 0 + ")";
      })
      .each(function (mh: MarkerHolderType) {
        // @ts-ignore
        let drawG = d3.select(this);
        drawG.classed(mh.marker.name, true).classed(mh.marker.type, true);
        let innerTextG = drawG
          .append("g")
          .attr("class", "markertext")
          .attr("transform", () => {
            // shift up by this.seismographConfig.markerTextOffset percentage
            let maxY = mythis.yScale.range()[0];
            let deltaY = mythis.yScale.range()[0] - mythis.yScale.range()[1];
            let texty =
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
        let textSel = innerTextG.append("text");

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
        drawG
          .append("path")
          .classed("markerpath", true)
          .attr("d", () => {
            return d3
              .line()
              .x(0) // g is translated so marker time is zero
              .y(function (d, i) {
                let out = 0;

                if (mythis.seismographConfig.markerFlagpoleBase === "center") {
                  out =
                    i === 0
                      ? 0
                      : (mythis.yScale.range()[0] + mythis.yScale.range()[1]) /
                        2;
                } else {
                  // mythis.seismographConfig.markerFlagpoleBase === 'bottom'
                  out = i === 0 ? 0 : mythis.yScale.range()[0];
                }

                return out;
              })
              .curve(d3.curveLinear)([
              mythis.yScale.domain()[0],
              mythis.yScale.domain()[1],
            ]); // call the d3 function created by line with data
          });
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
        `height too small for margin: ${nOuterWidth} < ${this.seismographConfig.margin.top} + ${this.seismographConfig.margin.bottom}`,
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
    this.yScale.range([this.height, 0]);
    this.yScaleRmean.range([this.height, 0]);

    this.calcScaleAndZoom();

    if (this.canvas) {
      this.canvasHolder
        .attr("width", this.width)
        .attr("height", this.height + 1);
      this.canvas.attr("width", this.width).attr("height", this.height + 1);
    }

    this.redrawWithXScale();
  }

  // see http://blog.kevinchisholm.com/javascript/javascript-function-throttling/
  throttle(func: () => void, delay: number): void {
    if (this.throttleResize) {
      window.clearTimeout(this.throttleResize);
    }

    this.throttleResize = window.setTimeout(func, delay);
  }

  resizeNeeded() {
    let myThis = this;
    this.throttle(function () {
      myThis.draw();
    }, 250);
  }

  setMargin(value: MarginType): Seismograph {
    this.seismographConfig.margin = value;

    if (!this.beforeFirstDraw) {
      this.calcWidthHeight(this.outerWidth, this.outerHeight);
      this.g.attr(
        "transform",
        "translate(" +
          this.seismographConfig.margin.left +
          "," +
          this.seismographConfig.margin.top +
          ")",
      );
    }

    return this;
  }

  drawTitle() {
    drawTitle(
      this.svg,
      this.seismographConfig,
      this.height,
      this.width,
      this.createHandlebarsInput(),
    );
  }

  drawXLabel() {
    drawXLabel(
      this.svg,
      this.seismographConfig,
      this.height,
      this.width,
      this.createHandlebarsInput(),
    );
  }

  drawXSublabel() {
    drawXSublabel(
      this.svg,
      this.seismographConfig,
      this.height,
      this.width,
      this.createHandlebarsInput(),
    );
  }

  drawYLabel() {
    drawYLabel(
      this.svg,
      this.seismographConfig,
      this.height,
      this.width,
      this.createHandlebarsInput(),
    );
  }

  drawYSublabel() {
    drawYSublabel(
      this.svg,
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
      let timeRange;

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

  calcAmpScaleDomain(): void {
    const oldMinMax = this.yScaleData.domain();

    if (this.seismographConfig.fixedYScale) {
      this.yScaleData.domain(this.seismographConfig.fixedYScale);
      this.yScale.domain(this.seismographConfig.fixedYScale);
    } else {
      let minMax;

      if (this.seismographConfig.windowAmp) {
        if (isDef(this.seismographConfig.linkedTimeScale)) {
          minMax = findMinMaxOverRelativeTimeRange(
            this._seisDataList,
            this.seismographConfig.linkedTimeScale.offset,
            this.seismographConfig.linkedTimeScale.duration,
          );
        } else if (isDef(this.seismographConfig.fixedTimeScale)) {
          minMax = findMinMaxOverTimeRange(this._seisDataList, this.seismographConfig.fixedTimeScale);
        } else {
          throw new Error("neither fixed nor linked time scale");
        }
      } else {
        minMax = findMinMax(this._seisDataList);
      }

      if (minMax[0] === minMax[1]) {
        // flatlined data, use -1, +1
        minMax = [minMax[0] - 1, minMax[1] + 1];
      }

      this.yScaleData.domain(minMax);

      if (this.seismographConfig.linkedAmplitudeScale) {
        if (oldMinMax[0] !== minMax[0] || oldMinMax[1] !== minMax[1]) {
          this.seismographConfig.linkedAmplitudeScale.recalculate(); // sets yScale.domain
        }
      } else {
        this.yScale.domain(minMax);

        if (this.seismographConfig.isYAxisNice) {
          this.yScale.nice();
        }

        this.redoDisplayYScale();
      }
    }
  }

  redoDisplayYScale(): void {
    let niceMinMax = this.yScale.domain();

    if (
      this.seismographConfig.doGain &&
      this._seisDataList.length > 0 &&
      this._seisDataList.every(sdd => sdd.hasSensitivity) &&
      this._seisDataList.every(
        sdd => isDef(sdd.seismogram) && sdd.seismogram.yUnit === COUNT_UNIT,
      )
    ) {
      // each has seisitivity
      const firstSensitivity = this._seisDataList[0].sensitivity;

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
        niceMinMax[0] = niceMinMax[0] / firstSensitivity.sensitivity;
        niceMinMax[1] = niceMinMax[1] / firstSensitivity.sensitivity;

        if (this.seismographConfig.ySublabelIsUnits) {
          this.seismographConfig.ySublabel = firstSensitivity.inputUnits;
        }
      } else {
        throw new Error(
          "doGain with different seisitivities not yet implemented.",
        );
      }
    } else {
      if (this.seismographConfig.ySublabelIsUnits) {
        this.seismographConfig.ySublabel = "";
        let allUnits = [];

        for (let t of this._seisDataList) {
          if (t.seismogram) {
            let u = t.seismogram.yUnit;
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

    if (this.seismographConfig.doRMean) {
      this.seismographConfig.ySublabel = `centered ${this.seismographConfig.ySublabel}`;
      this.yScaleRmean.domain([
        (niceMinMax[0] - niceMinMax[1]) / 2,
        (niceMinMax[1] - niceMinMax[0]) / 2,
      ]);
    } else {
      this.yScaleRmean.domain(niceMinMax);
    }

    this.rescaleYAxis();

    if (this.seismographConfig.ySublabelIsUnits) {
      drawYSublabel(this.svg, this.seismographConfig, this.height, this.width);
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
      for (let s of sddList) {
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
    this.calcAmpScaleDomain();
    if (!this.beforeFirstDraw) {
      // only trigger a draw if appending after already drawn on screen
      // otherwise, just append the data and wait for outside to call first draw()
      //this.drawSeismograms();
      this.draw();
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
    let out = this._seisDataList.find(sd => sd.seismogram === seis);

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
  trim(timeRange: StartEndDuration): void {
    if (this._seisDataList) {
      this._seisDataList = this._seisDataList.filter(function (d) {
        return d.timeRange.overlaps(timeRange);
      });

      if (this._seisDataList.length > 0) {
        this.calcAmpScaleDomain();
        this.drawSeismograms();
      }
    }
  }

}


customElements.define(SEISMOGRAPH_ELEMENT, Seismograph);

export class SeismographAmplitudeScalable extends AmplitudeScalable {
  graph: Seismograph;

  constructor(graph: Seismograph) {
    let minMax = [-1, 1];

    if (graph.yScaleData) {
      minMax = graph.yScaleData.domain();
    } else {
      minMax = findMinMax(graph.seisData);
    }

    super((minMax[0] + minMax[1]) / 2, minMax[1] - minMax[0]);
    this.graph = graph;
  }

  notifyAmplitudeChange(minAmp: number, maxAmp: number) {
    if (this.graph.seismographConfig.doRMean) {
      const mean =
        (this.graph.yScaleData.domain()[1] +
          this.graph.yScaleData.domain()[0]) /
        2;
      const maxRange = maxAmp - minAmp;
      this.graph.yScale.domain([mean - maxRange / 2, mean + maxRange / 2]);
      this.graph.yScaleRmean.domain([(-1 * maxRange) / 2, maxRange / 2]);
    } else {
      this.graph.yScale.domain([minAmp, maxAmp]);
      this.graph.yScaleRmean.domain([minAmp, maxAmp]);
    }

    this.graph.redoDisplayYScale();

    if (!this.graph.beforeFirstDraw) {
      // only trigger a draw if appending after already drawn on screen
      // otherwise, just append the data and wait for outside to call first draw()
      this.graph.draw();
    }
  }
}
export class SeismographTimeScalable extends TimeScalable {
  graph: Seismograph;

  constructor(graph: Seismograph) {
    let alignmentTimeOffset = Duration.fromMillis(0);
    let maxDuration = findMaxDuration(graph.seisData);
    super(alignmentTimeOffset, maxDuration);
    this.graph = graph;
  }

  notifyTimeRangeChange(
    offset: Duration,
    duration: Duration,
  ) {
    if (this.graph.beforeFirstDraw) {
      return;
    }
    this.graph.redrawWithXScale();
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
  let markers: Array<MarkerType> = [];
  let daz = distaz.distaz(
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
  let markers = createFullMarkersForQuakeAtStation(quake, channel.station);
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
  let markers: Array<MarkerType> = [];

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
 * @param  formatter simple formatter
 * @return           function that converts input types
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
 * @param  formatter simple formatter
 * @return           function that converts input types
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
