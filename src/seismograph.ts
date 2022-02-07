/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */
import moment from "moment";
import * as d3 from "d3";
import {insertCSS, AUTO_COLOR_SELECTOR, G_DATA_SELECTOR} from "./cssutil";
import {
  SeismographConfig,
  LinkedAmpScale,
  AmplitudeScalable,
  TimeScalable,
  DRAW_SVG,
  DRAW_CANVAS,
  DRAW_BOTH,
  DRAW_BOTH_ALIGN,
  numberFormatWrapper,
} from "./seismographconfig";
// reexport as was defined here in 2.0.1
export {LinkedAmpScale};
import type {MarkerType} from "./seismogram";
import type {MarginType} from "./seismographconfig";
import type {TraveltimeJsonType} from "./traveltime";
import type {ScaleTime} from "d3-scale"
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
export type ScaleChangeListenerType = {
  destinationKey: any;
  notifyScaleChange: (value: any) => void;
};
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
export class Seismograph {
  /** @private */
  static _lastID: number;
  plotId: number;
  beforeFirstDraw: boolean;
  svgParent: any;
  seismographConfig: SeismographConfig;
  seisDataList: Array<SeismogramDisplayData>;

  /** @private */
  _debugAlignmentSeisData: Array<SeismogramDisplayData>;
  width: number;
  height: number;
  outerWidth: number;
  outerHeight: number;
  svg: any;
  canvasHolder: any;
  canvas: any;
  origXScale: any;
  currZoomXScale: any;
  yScale: any; // for drawing seismogram

  yScaleRmean: any; // for drawing y axis

  yScaleData: any; // holds min max of data in time window

  lineFunc: any;
  zoom: any;
  xAxis: any;
  xAxisTop: any;
  yAxis: any;
  yAxisRight: any;
  g: any;
  throttleRescale: any;
  throttleResize: any;
  myTimeScalable: TimeScalable;
  myAmpScalable: AmplitudeScalable;
  xScaleChangeListeners: Array<ScaleChangeListenerType>;

  constructor(
    inSvgParent: any,
    seismographConfig: SeismographConfig,
    seisData:
      | Array<SeismogramDisplayData>
      | Array<Seismogram>
      | SeismogramDisplayData
      | Seismogram,
  ) {
    if (inSvgParent === null) {
      throw new Error("inSvgParent cannot be null");
    }
    this.outerWidth = -1;
    this.outerHeight = -1;

    if (!isDef(seismographConfig)) {
      if (
        isDef(seisData) &&
        (!Array.isArray(seisData) || seisData.length > 0)
      ) {
        // need at least one of seismographConfig or seisData to get time window
        seismographConfig = new SeismographConfig();
      } else {
        throw new Error("seismographConfig and seisData cannot both be null");
      }
    }

    this.plotId = ++Seismograph._lastID;
    this.beforeFirstDraw = true;
    this.seismographConfig = seismographConfig;
    this.seisDataList = [];

    this._internalAppend(seisData);

    this._debugAlignmentSeisData = [];
    this.width = 200;
    this.height = 100;

    if (typeof inSvgParent === "string") {
      this.svgParent = d3.select(inSvgParent);
    } else {
      this.svgParent = inSvgParent;
    }

    this.canvas = null;
    this.svg = this.svgParent.append("svg").style("z-index", 100);

    if (
      isDef(this.seismographConfig.minHeight) &&
      isNumArg(this.seismographConfig.minHeight) &&
      this.seismographConfig.minHeight > 0
    ) {
      const minHeight = this.seismographConfig.minHeight; // for flow

      this.svg.style("min-height", minHeight + "px");
      this.svgParent.style("min-height", minHeight + "px");
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
      const minWidth = this.seismographConfig.minWidth; // for flow

      this.svg.style("min-width", minWidth + "px");
      this.svgParent.style("min-width", minWidth + "px");
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
    // this might be bad, global colors for individual Seismograph???
    // doesn't apply to just the svg that contain is
    insertCSS(this.seismographConfig.createCSSForLineColors(), COLOR_CSS_ID);
    this.xScaleChangeListeners = [];
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

    if (this.seismographConfig.isXAxis) {
      this.xAxis = d3.axisBottom(this.currZoomXScale);

      if (!this.seismographConfig.isRelativeTime) {
        this.xAxis.tickFormat(this.seismographConfig.xScaleFormat);
      }
    }

    if (this.seismographConfig.isXAxisTop) {
      this.xAxisTop = d3.axisTop(this.currZoomXScale);

      if (!this.seismographConfig.isRelativeTime) {
        this.xAxisTop.tickFormat(this.seismographConfig.xScaleFormat);
      }
    }

    if (this.seismographConfig.isYAxis) {
      this.yAxis = d3
        .axisLeft(this.yScaleRmean)
        .tickFormat(numberFormatWrapper(this.seismographConfig.yScaleFormat));
    }

    if (this.seismographConfig.isYAxisRight) {
      this.yAxisRight = d3
        .axisRight(this.yScaleRmean)
        .tickFormat(numberFormatWrapper(this.seismographConfig.yScaleFormat));
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

  static fromSeismograms(
    inSvgParent: any,
    seismographConfig: SeismographConfig,
    seismogramList: Array<Seismogram>,
  ): Seismograph {
    return new Seismograph(
      inSvgParent,
      seismographConfig,
      seismogramList.map(s => SeismogramDisplayData.fromSeismogram(s)),
    );
  }

  checkResize(): boolean {
    let rect = this.svg.node().getBoundingClientRect();

    if (rect.width !== this.outerWidth || rect.height !== this.outerHeight) {
      return true;
    }

    return false;
  }

  draw(): void {
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
    let grect = this.svgParent.node().getBoundingClientRect();
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
    // $FlowFixMe
    out += "this.margin " + this.seismographConfig.margin + "\n";
    util.log(out);
  }

  drawSeismograms() {
    if (this.seismographConfig.drawingType === DRAW_BOTH_ALIGN) {
      if (this._debugAlignmentSeisData.length === 0) {
        const startenddur = new StartEndDuration(
          this.currZoomXScale.domain()[0],
          this.currZoomXScale.domain()[1],
        );
        const fakeSDD = this.seismographConfig.createAlignmentData(startenddur);

        this._debugAlignmentSeisData.push(fakeSDD);
      }
    } else {
      this._debugAlignmentSeisData = [];
    }

    if (
      this.seismographConfig.drawingType === DRAW_CANVAS ||
      this.seismographConfig.drawingType === DRAW_BOTH ||
      this.seismographConfig.drawingType === DRAW_BOTH_ALIGN
    ) {
      this.drawSeismogramsCanvas();
    }

    if (
      this.seismographConfig.drawingType === DRAW_SVG ||
      this.seismographConfig.drawingType === DRAW_BOTH ||
      this.seismographConfig.drawingType === DRAW_BOTH_ALIGN
    ) {
      this.drawSeismogramsSvg();
    }

    if (this.seismographConfig.drawingType === DRAW_BOTH_ALIGN) {
      this.drawCanvasAlignment();
    }
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

    const sddList = this.seisDataList.concat(this._debugAlignmentSeisData);
    sddList.forEach((sdd, sddIndex) => {
      let ti = sddIndex;
      const xscaleForSDD = this.timeScaleForSeisDisplayData(sdd);
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
          const startPixel = xscaleForSDD(s.startTime.toDate());
          const endPixel = xscaleForSDD(s.endTime.toDate());
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

  drawCanvasAlignment(): void {
    const mythis = this;
    let radius = 10;
    // draw corners in svg for comparison
    let minX = this.currZoomXScale.domain()[0];
    let maxX = this.currZoomXScale.domain()[1];
    let minY = this.yScale.domain()[0];
    let maxY = this.yScale.domain()[1];
    this.g.selectAll("circle").remove();
    let circles = this.g.selectAll("circle").data([
      [minX, minY],
      [minX, maxY],
      [maxX, minY],
      [maxX, maxY],
    ]);
    circles.exit().remove();
    circles
      .enter()
      .append("circle")
      .attr("fill-opacity", "0.4")
      .attr("cx", function (d: Array<number>) {
        return mythis.currZoomXScale(d[0]);
      })
      .attr("cy", function (d: Array<number>) {
        return mythis.yScale(d[1]);
      })
      .attr("r", radius - 2);
    this.g.selectAll("path.diagonal").remove();
    this.g
      .append("path")
      .attr("class", "seispath diagonal")
      .attr(
        "d",
        "M0,0L" + mythis.currZoomXScale(maxX) + ", " + mythis.yScale(minY),
      );
    // svg text color
    let textcolor = this.seismographConfig.getColorForIndex(
      this.seisDataList.length,
    );
    let textcolorArr = [textcolor];
    this.g
      .selectAll("text")
      .data(textcolorArr)
      .enter()
      .append("text")
      .style("fill", textcolor)
      .text("svg " + textcolor)
      .attr("x", (this.width * 3) / 4)
      .attr("y", this.height / 4 + 20);
    // get the canvas drawing context
    const canvasNode = this.canvas.node();
    //canvasNode.height = this.height;
    //canvasNode.width = this.width;
    const context = canvasNode.getContext("2d");
    // canvas text color
    textcolor = this.seismographConfig.getColorForIndex(
      2 * this.seisDataList.length + this._debugAlignmentSeisData.length,
    );
    context.strokeStyle = textcolor;
    context.strokeText(
      "canvas " + textcolor,
      (this.width * 3) / 4,
      this.height / 4,
    );
    context.beginPath();
    context.fillStyle = "lightblue";
    context.arc(
      this.currZoomXScale((minX + maxX) / 2),
      this.yScale((minY + maxY) / 2),
      radius,
      0,
      2 * Math.PI,
      true,
    );
    context.fill();
    context.beginPath();
    context.fillStyle = "lightblue";
    context.arc(
      this.currZoomXScale(minX),
      this.yScale(minY),
      radius,
      0,
      2 * Math.PI,
      true,
    );
    context.fill();
    context.beginPath();
    context.fillStyle = "red";
    context.arc(
      this.currZoomXScale(maxX),
      this.yScale(minY),
      radius,
      0,
      2 * Math.PI,
      true,
    );
    context.fill();
    context.beginPath();
    context.fillStyle = "green";
    context.arc(
      this.currZoomXScale(minX),
      this.yScale(maxY),
      radius,
      0,
      2 * Math.PI,
      true,
    );
    context.fill();
    context.beginPath();
    context.fillStyle = "black";
    context.arc(
      this.currZoomXScale(maxX),
      this.yScale(maxY),
      radius,
      0,
      2 * Math.PI,
      true,
    );
    context.fill();
    context.beginPath();
    context.moveTo(
      this.currZoomXScale(this.currZoomXScale.domain()[0]),
      this.yScaleRmean(0),
    );
    context.lineTo(
      this.currZoomXScale(this.currZoomXScale.domain()[1]),
      this.yScaleRmean(0),
    );
    context.moveTo(0, 0);
    context.lineTo(this.width, this.height);
    context.stroke(); //  this.printSizes();
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

  timeScaleForSeisDisplayData(sdd: SeismogramDisplayData): ScaleTime<number, number> {
    let plotSed;
    let sddXScale = d3.scaleUtc();

    if (
      this.seismographConfig.isRelativeTime &&
      this.seismographConfig.linkedTimeScale
    ) {
      plotSed = sdd.relativeTimeWindow(
        this.seismographConfig.linkedTimeScale.offset,
        this.seismographConfig.linkedTimeScale.duration,
      );
    } else {
      plotSed = new StartEndDuration(
        this.currZoomXScale.domain()[0],
        this.currZoomXScale.domain()[1],
      );
    }

    sddXScale.domain([plotSed.start.toDate(), plotSed.end.toDate()]);

    if (this.currZoomXScale.range()) {
      sddXScale.range(this.currZoomXScale.range());
    } else {
      throw new Error(`this.currZoomXScale.range() no defined`);
    }

    return sddXScale;
  }

  drawSeismogramsSvg() {
    const sddList = this.seisDataList.concat(this._debugAlignmentSeisData);
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

  calcSecondsPerPixel(xScale: any): number {
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
        // $FlowFixMe
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
          return [seg.timeOfSample(i).toDate().valueOf(),d];
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

  /**
   * Draws the left and right (amplitude) axis if configured.
   *
   */
  drawTopBottomAxis(): void {
    this.g.selectAll("g.axis--x").remove();
    this.g.selectAll("g.axis--x-top").remove();
    let xScaleToDraw;

    if (this.seismographConfig.isRelativeTime) {
      xScaleToDraw = this.currZoomXScale.copy();
      const millisecondDomain = xScaleToDraw.domain();
      xScaleToDraw.domain([
        millisecondDomain[0] / 1000,
        millisecondDomain[1] / 1000,
      ]);
    } else {
      xScaleToDraw = this.currZoomXScale;
    }

    if (this.seismographConfig.isXAxis) {
      this.xAxis.scale(xScaleToDraw);

      if (!this.seismographConfig.isRelativeTime) {
        this.xAxis.tickFormat(this.seismographConfig.xScaleFormat);
      }

      this.g
        .append("g")
        .attr("class", "axis axis--x")
        .attr("transform", "translate(0," + this.height + ")")
        .call(this.xAxis);
    }

    if (this.seismographConfig.isXAxisTop) {
      this.xAxisTop.scale(xScaleToDraw);

      if (!this.seismographConfig.isRelativeTime) {
        this.xAxisTop.tickFormat(this.seismographConfig.xScaleFormat);
      }

      this.g.append("g").attr("class", "axis axis--x-top").call(this.xAxisTop);
    }
  }

  /**
   * Draws the left and right (amplitude) axis if configured.
   */
  drawLeftRightAxis(): void {
    this.g.selectAll("g.axis--y").remove();
    this.g.selectAll("g.axis--y-right").remove();

    if (this.seismographConfig.isYAxis) {
      this.yAxis.scale(this.yScaleRmean);
      this.yAxis.ticks(8, this.seismographConfig.yScaleFormat);
      this.g.append("g").attr("class", "axis axis--y").call(this.yAxis);
    }

    if (this.seismographConfig.isYAxisRight) {
      this.yAxisRight.scale(this.yScaleRmean);
      this.yAxisRight.ticks(8, this.seismographConfig.yScaleFormat);
      this.g
        .append("g")
        .attr("class", "axis axis--y-right")
        .attr("transform", "translate(" + this.width + ",0)")
        .call(this.yAxisRight);
    }
  }

  rescaleYAxis(): void {
    if (!this.beforeFirstDraw) {
      let delay = 500;
      let myThis = this;

      if (this.throttleRescale) {
        window.clearTimeout(this.throttleRescale);
      }

      this.throttleRescale = window.setTimeout(function () {
        if (myThis.seismographConfig.isYAxis) {
          myThis.g
            .select(".axis--y")
            .transition()
            .duration(delay / 2)
            .call(myThis.yAxis);
        }

        if (myThis.seismographConfig.isYAxisRight) {
          myThis.g
            .select(".axis--y-right")
            .transition()
            .duration(delay / 2)
            .call(myThis.yAxisRight);
        }

        myThis.throttleRescale = null;
      }, delay);
    }
  }

  createHandlebarsInput(): any {
    return {
      seisDataList: this.seisDataList,
      seisConfig: this.seismographConfig,
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
      this.redrawWithXScale(this.origXScale.copy());
    }
  }

  zoomed(e: any): void {
    let t = e.transform;
    let xt = t.rescaleX(this.origXScale);

    if (isDef(this.seismographConfig.linkedTimeScale)) {
      // for flow
      const linkedTS = this.seismographConfig.linkedTimeScale;

      if (this.seismographConfig.isRelativeTime) {
        let startDelta = xt.domain()[0] - this.origXScale.domain()[0];
        let duration = xt.domain()[1] - xt.domain()[0];
        linkedTS.zoom(
          moment.duration(startDelta),
          moment.duration(duration, "milliseconds"),
        );
      } else {
        let orig = new StartEndDuration(
          this.origXScale.domain()[0],
          this.origXScale.domain()[1],
        );
        let sed = new StartEndDuration(xt.domain()[0], xt.domain()[1]);
        let startDelta = moment.duration(sed.start.diff(orig.start));
        linkedTS.zoom(startDelta, sed.duration);
      }
    } else {
      this.redrawWithXScale(xt);
    }
  }

  redrawWithXScale(xt: any): void {
    if (
      this.currZoomXScale &&
      xt.range()[0] === this.currZoomXScale.range()[0] &&
      xt.range()[1] === this.currZoomXScale.range()[1]
    ) {
      if (
        !this.seismographConfig.isRelativeTime &&
        xt.domain()[0].getTime() ===
          this.currZoomXScale.domain()[0].getTime() &&
        xt.domain()[1].getTime() === this.currZoomXScale.domain()[1].getTime()
      ) {
        return;
      }

      if (
        this.seismographConfig.isRelativeTime &&
        xt.domain()[0] === this.currZoomXScale.domain()[0] &&
        xt.domain()[1] === this.currZoomXScale.domain()[1]
      ) {
        return;
      }
    }

    this.currZoomXScale = xt;
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
          let textx = mh.xscale(mh.marker.time.toDate());
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
      let undrawnMarkers = this.seisDataList
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
          const xpixel = mh.xscale(mh.marker.time.toDate());
          return xpixel < mh.xscale.range()[0] || xpixel > mh.xscale.range()[1];
        });

      if (undrawnMarkers.length !== 0) {
        this.drawMarkers();
      }

      this.drawTopBottomAxis();
    }

    this.xScaleChangeListeners.forEach(l => l.notifyScaleChange(xt));
  }

  drawMarkers() {
    let allMarkers: Array<MarkerHolderType> = this.seisDataList
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
        const xpixel = mh.xscale(mh.marker.time.toDate());
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
        return `${mh.marker.name}_${mh.marker.time.toISOString()}`;
      });
    labelSelection.exit().remove();
    let radianTextAngle =
      (this.seismographConfig.markerTextAngle * Math.PI) / 180;
    labelSelection
      .enter()
      .append("g")
      .classed("marker", true) // translate so marker time is zero
      .attr("transform", function (mh: MarkerHolderType) {
        let textx = mh.xscale(mh.marker.time.toDate());
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
            return mh.marker.name + " " + mh.marker.time.toISOString();
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
    this.origXScale.range([0, this.width]);
    this.yScale.range([this.height, 0]);
    this.yScaleRmean.range([this.height, 0]);

    if (this.seismographConfig.isYAxis) {
      this.yAxis.scale(this.yScaleRmean);
    }

    if (this.seismographConfig.isYAxisRight) {
      this.yAxisRight.scale(this.yScaleRmean);
    }

    this.calcScaleAndZoom();

    if (this.canvas) {
      this.canvasHolder
        .attr("width", this.width)
        .attr("height", this.height + 1);
      this.canvas.attr("width", this.width).attr("height", this.height + 1);
    }

    const resizeXScale = this.currZoomXScale.copy();
    // keep same time window
    // but use new pixel range
    resizeXScale.range([0, this.width]);
    // this updates currZoomXScale
    this.redrawWithXScale(resizeXScale);
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
      if (!isDef(this.origXScale)) {
        this.origXScale = d3.scaleLinear();
      }

      if (isDef(this.seismographConfig.linkedTimeScale)) {
        const linkedTimeScale = this.seismographConfig.linkedTimeScale;
        const offset = linkedTimeScale.offset;
        const duration = linkedTimeScale.duration;
        const relStart = offset.asMilliseconds();
        const relEnd = relStart + duration.asMilliseconds();
        this.origXScale.domain([relStart, relEnd]);
      } else if (this.seismographConfig.fixedTimeScale) {
        this.origXScale.domain([
          0,
          this.seismographConfig.fixedTimeScale.duration.asMilliseconds(),
        ]);
      } else {
        let timeWindow = findStartEnd(this.seisDataList);
        this.origXScale.domain([0, timeWindow.duration.asSeconds()]);
      }

      // force to be same but not to share same array
      this.currZoomXScale = this.origXScale.copy();
    } else {
      let timeWindow;

      if (isDef(this.seismographConfig.linkedTimeScale)) {
        const linkedTimeScale = this.seismographConfig.linkedTimeScale;

        if (this.seisDataList.length === 0) {
          timeWindow = new StartEndDuration(
            null,
            moment.utc(),
            linkedTimeScale.duration,
          );
        } else {
          // use first sdd alignmentTime to align, since we are not plotting relative
          const alignTime = this.seisDataList[0].alignmentTime;
          const start = alignTime.clone().add(linkedTimeScale.offset);
          timeWindow = new StartEndDuration(
            start,
            null,
            linkedTimeScale.duration,
          );
        }
      } else if (this.seismographConfig.fixedTimeScale) {
        timeWindow = this.seismographConfig.fixedTimeScale;
      } else {
        timeWindow = findStartEnd(this.seisDataList);
      }

      if (!isDef(this.origXScale)) {
        this.origXScale = d3.scaleUtc();
      }

      this.origXScale.domain([
        timeWindow.startTime.toDate(),
        timeWindow.endTime.toDate(),
      ]);
      // force to be same but not to share same array
      this.currZoomXScale = this.origXScale.copy();
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
        if (this.seismographConfig.isRelativeTime) {
          if (isDef(this.seismographConfig.linkedTimeScale)) {
            minMax = findMinMaxOverRelativeTimeRange(
              this.seisDataList,
              this.seismographConfig.linkedTimeScale.offset,
              this.seismographConfig.linkedTimeScale.duration,
            );
          } else {
            // ??
            let timeWindow = new StartEndDuration(
              this.currZoomXScale.domain()[0],
              this.currZoomXScale.domain()[1],
            );
            minMax = findMinMaxOverTimeRange(this.seisDataList, timeWindow);
          }
        } else {
          let timeWindow = new StartEndDuration(
            this.currZoomXScale.domain()[0],
            this.currZoomXScale.domain()[1],
          );
          minMax = findMinMaxOverTimeRange(this.seisDataList, timeWindow);
        }
      } else {
        minMax = findMinMax(this.seisDataList);
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
      this.seisDataList.length > 0 &&
      this.seisDataList.every(sdd => sdd.hasSensitivity) &&
      this.seisDataList.every(
        sdd => isDef(sdd.seismogram) && sdd.seismogram.yUnit === COUNT_UNIT,
      )
    ) {
      // each has seisitivity
      const firstSensitivity = this.seisDataList[0].sensitivity;

      if (
        isDef(firstSensitivity) &&
        this.seisDataList.every(
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

        for (let t of this.seisDataList) {
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
    return this.seisDataList;
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
          this.seisDataList.push(s);
        } else {
          this.seisDataList.push(SeismogramDisplayData.fromSeismogram(s));
        }
      }
    } else {
      if (sddList instanceof SeismogramDisplayData) {
        this.seisDataList.push(sddList);
      } else {
        this.seisDataList.push(SeismogramDisplayData.fromSeismogram(sddList));
      }
    }
  }

  /**
   * appends the seismogram(s) or SeismogramDisplayData as separate time series.
   *
   * @param seismogram data to append
   */
  append(seismogram: Array<Seismogram> | Seismogram | SeismogramDisplayData) {
    if (seismogram instanceof SeismogramDisplayData) {
      this._internalAppend(seismogram);
    } else if (Array.isArray(seismogram)) {
      let sdd = seismogram.map(s => SeismogramDisplayData.fromSeismogram(s));

      this._internalAppend(sdd);
    } else if (seismogram instanceof Seismogram) {
      this._internalAppend(SeismogramDisplayData.fromSeismogram(seismogram));
    } else {
      throw new Error(
        `Unable to append, doesn't look like Array of Seismogram, Seismogram or SeismogramDisplayData: ${seismogram}`,
      );
    }

    this.calcAmpScaleDomain();

    if (!this.beforeFirstDraw) {
      // only trigger a draw if appending after already drawn on screen
      // otherwise, just append the data and wait for outside to call first draw()
      this.drawSeismograms();
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
    let out = this.seisDataList.find(sd => sd.seismogram === seis);

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
  remove(seisData: SeismogramDisplayData): void {
    this.seisDataList = this.seisDataList.filter(sd => sd !== seisData);
  }

  /**
   * Removes seismograms that do not overlap the window.
   *
   * @param   timeWindow overlap data to keep
   */
  trim(timeWindow: StartEndDuration): void {
    if (this.seisDataList) {
      this.seisDataList = this.seisDataList.filter(function (d) {
        return d.timeWindow.overlaps(timeWindow);
      });

      if (this.seisDataList.length > 0) {
        this.calcAmpScaleDomain();
        this.drawSeismograms();
      }
    }
  }

  // eslint-disable-next-line jsdoc/require-param

  /**
   * @deprecated
   */
  // eslint-disable-next-line no-unused-vars
  linkXScaleTo(seismograph: Seismograph) {
    throw new Error(
      "no longer supported, use SeismogramConfig.linkedTimeScale",
    );
  }

  // eslint-disable-next-line jsdoc/require-param

  /**
   * @deprecated
   */
  // eslint-disable-next-line no-unused-vars
  unlinkXScaleTo(seismograph: Seismograph) {
    throw new Error(
      "no longer supported, use SeismogramConfig.linkedTimeScale",
    );
  }
}
export class SeismographAmplitudeScalable extends AmplitudeScalable {
  graph: Seismograph;

  constructor(graph: Seismograph) {
    let minMax = [-1, 1];

    if (graph.yScaleData) {
      minMax = graph.yScaleData.domain();
    } else {
      minMax = findMinMax(graph.seisDataList);
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
    let alignmentTimeOffset = moment.duration(0);
    let maxDuration = findMaxDuration(graph.seisDataList);
    super(alignmentTimeOffset, maxDuration);
    this.graph = graph;
  }

  notifyTimeRangeChange(
    offset: moment.Duration,
    duration: moment.Duration,
  ) {
    if (this.graph.beforeFirstDraw) {
      return;
    }

    if (this.graph.seismographConfig.isRelativeTime) {
      let timeScale = d3.scaleLinear();
      timeScale.domain([
        offset.asMilliseconds(),
        offset.asMilliseconds() + duration.asMilliseconds(),
      ]);
      timeScale.range(this.graph.origXScale.range());
      this.graph.redrawWithXScale(timeScale);
    } else {
      const coverageSed = findStartEnd(this.graph.seisDataList);
      const offsetStart = moment.utc(coverageSed.start).add(offset);
      let sed = new StartEndDuration(offsetStart, null, duration);
      let timeScale = this.graph.origXScale.copy();
      timeScale.domain([sed.startTime.toDate(), sed.endTime.toDate()]);
      this.graph.redrawWithXScale(timeScale);
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
      time: moment.utc(quake.time).add(a.time, "seconds"),
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
    time: moment.utc(quake.time),
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
    name: `M${quake.preferredMagnitude.mag} ${quake.time.format("HH:mm")}`,
    time: moment.utc(quake.time),
    link: `https://earthquake.usgs.gov/earthquakes/eventpage/${quake.eventId}/executive`,
    // $FlowFixMe[incompatible-type]
    description: `${quake.time.toISOString()}
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
export const seismograph_css = `


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

if (document) {
  insertCSS(seismograph_css, "seismograph");
  // default seis colors
  insertCSS(new SeismographConfig().createCSSForLineColors(), COLOR_CSS_ID);
}
