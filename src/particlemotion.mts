/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * https://www.seis.sc.edu
 */
//import * as d3 from "d3";
import { select as d3select } from "d3-selection";
import "d3-transition";
import { scaleLinear as d3scaleLinear } from "d3-scale";
import { Interval } from "luxon";
import { SeismographConfig, numberFormatWrapper } from "./seismographconfig.mjs";
import { ScalableGraph } from "./scaleablegraph.mjs";
import {
  Seismogram,
  SeismogramDisplayData
} from "./seismogram.mjs";
import { SeismogramSegment } from "./seismogramsegment.mjs";
import { COLOR_CSS_ID } from "./seismograph.mjs";
import { isDef, isNumArg, validStartTime, validEndTime, createSVGElement } from "./util.mjs";
import {AUTO_COLOR_SELECTOR} from "./cssutil.mjs";
import * as axisutil from "./axisutil.mjs";
import type { HandlebarsInput } from "./axisutil.mjs";

import type { Axis } from "d3-axis";
import {
  axisLeft as d3axisLeft,
  axisBottom as d3axisBottom,
  axisTop as d3axisTop,
  axisRight as d3axisRight,
} from "d3-axis";
import type { ScaleLinear, NumberValue as d3NumberValue } from "d3-scale";
import type { Selection } from "d3-selection";

export const DEFAULT_TITLE =
  "<tspan>{{#each seisDataList}}{{onlyChangesChannel ../seisDataList @index}} {{else}}No Data{{/each}}</tspan>";
export const DEFAULT_XLABEL =
  "{{#each seisXData}}<tspan>{{this.channelCode}}</tspan> {{else}}No Data{{/each}}";

export const DEFAULT_YLABEL =
  "{{#each seisYData}}<tspan>{{this.channelCode}}</tspan> {{else}}No Data{{/each}}";

export const PARTICLE_MOTION_ELEMENT = "sp-particle-motion";

export const particleMotion_css = `

:host {
  display: block;
  min-height: 200px;
  height: 100%;
}

div.wrapper {
  min-height: 100px;
  height: 100%;
  width: 100%;
}

svg {
  height: 100%;
  width: 100%;
  min-height: 125px;
  min-width: 125px;
  z-index: 100;
}

svg text.title {
  font-size: larger;
  font-weight: bold;
  fill: black;
  color: black;
}

svg path.seispath {
    stroke: skyblue;
    fill: none;
    stroke-width: 1px;
}
`;

export function createParticleMotionConfig(
  timeRange?: Interval | null,
  defaultSeisConfig?: SeismographConfig,
): SeismographConfig {
  let seisConfig;
  if (defaultSeisConfig) {
    seisConfig = defaultSeisConfig.clone();
  } else {
    seisConfig = new SeismographConfig();
  }
  seisConfig.title = DEFAULT_TITLE;

  if (isDef(timeRange)) {
    seisConfig.fixedTimeScale = timeRange;
  }

  seisConfig.xLabel = DEFAULT_XLABEL;
  seisConfig.yLabel = DEFAULT_YLABEL;
  seisConfig.xSublabelIsUnits = true;
  seisConfig.ySublabelIsUnits = true;
  seisConfig.margin.top = 20;
  seisConfig.margin.bottom = 45;
  seisConfig.margin.right = 40;
  seisConfig.margin.left = 40;
  return seisConfig;
}

export const PARTICLE_MOTION_CSS_ID = "particlemotioncss";

/**
 * Particle motion plot.
 *
 * @param xSeisData x axis seismogram
 * @param ySeisData y axis seismogram
 * @param seismographConfig config, not all parameters are used in
 * particle motion plots. Can be null for defaults.
 */
export class ParticleMotion extends ScalableGraph {
  plotId: number;
  _xSeisData: Array<SeismogramDisplayData>;
  _ySeisData: Array<SeismogramDisplayData>;
  width: number;
  height: number;
  outerWidth = -1;
  outerHeight = -1;
  static _lastID: number;

  constructor(
    xSeisData?: Array<SeismogramDisplayData>,
    ySeisData?: Array<SeismogramDisplayData>,
    seisConfig?: SeismographConfig,
  ) {
    if (!xSeisData) {
      xSeisData = [];
    }
    if (xSeisData instanceof Seismogram) {
      xSeisData = [SeismogramDisplayData.fromSeismogram(xSeisData)];
    }
    if (!Array.isArray(xSeisData)) {
      xSeisData = [xSeisData];
    }
    if (!ySeisData) {
      ySeisData = [];
    }
    if (!Array.isArray(ySeisData)) {
      ySeisData = [ySeisData];
    }
    const seisData = xSeisData.concat(ySeisData);
    if (!seisConfig) {
      seisConfig = createParticleMotionConfig();
    }
    super(seisData, seisConfig);

    this._xSeisData = xSeisData;
    this._ySeisData = ySeisData;

    this.addStyle(particleMotion_css, PARTICLE_MOTION_CSS_ID);
    const lineColorsCSS = this.seismographConfig.createCSSForLineColors();
    this.addStyle(lineColorsCSS, COLOR_CSS_ID);

    const wrapper = document.createElement("div");
    wrapper.setAttribute("class", "wrapper");
    const svgWrapped = wrapper.appendChild(
      createSVGElement("svg"),
    );
    svgWrapped.classList.add(AUTO_COLOR_SELECTOR);
    svgWrapped.setAttribute("version", "1.1");
    svgWrapped.classList.add("particleMotion");
    this.plotId = ++ParticleMotion._lastID;
    svgWrapped.setAttribute("plotId", ""+this.plotId);
    this.getShadowRoot().appendChild(wrapper);

    if (this.xSeisData.length !== this.ySeisData.length) {
      throw new Error(
        `xSeisData and ySeisData should have same length: ${this.xSeisData.length} !== ${this.ySeisData.length}`,
      );
    }

    this.width = 100;
    this.height = 100;
    // for line ends to show direction of particle motion
    const defs = svgWrapped.appendChild(createSVGElement("defs"));
    const arrow = defs.appendChild(createSVGElement("marker"));
    arrow.setAttribute("id", "arrow");
    arrow.setAttribute("markerWidth", "10");
    arrow.setAttribute("markerHeight", "10");
    arrow.setAttribute("refX", "0");
    arrow.setAttribute("refY", "3");
    arrow.setAttribute("orient", "auto");
    arrow.setAttribute("markerUnits", "strokeWidth");
    const path = arrow.appendChild(createSVGElement("path"));
    path.setAttribute("d", "M0,0 L0,6 L9,3 z");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("fill", "currentColor");
    const g = svgWrapped.appendChild(createSVGElement("g"));
    g.classList.add("marginTransform");
    g.setAttribute(
        "transform",
        "translate(" +
          this.seismographConfig.margin.left +
          "," +
          this.seismographConfig.margin.top +
          ")",
      );

    d3select(window).on("resize.particleMotion" + this.plotId, () => {
      if (this.checkResize()) {
        this.redraw();
      }
    });
  }
  get xSeisData(): Array<SeismogramDisplayData> {
    return this._xSeisData;
  }
  set xSeisData(xsdd: Array<SeismogramDisplayData> | SeismogramDisplayData) {
    if (Array.isArray(xsdd)) {
      this._xSeisData = xsdd;
    } else if (xsdd instanceof SeismogramDisplayData) {
      this._xSeisData = [xsdd];
    } else {
      throw new Error(`Unknown data for xSeisData`);
    }
    this._seisDataList = this._xSeisData.concat(this._ySeisData);
  }
  get ySeisData(): Array<SeismogramDisplayData> {
    return this._ySeisData;
  }
  set ySeisData(ysdd: Array<SeismogramDisplayData> | SeismogramDisplayData) {
    if (Array.isArray(ysdd)) {
      this._ySeisData = ysdd;
    } else if (ysdd instanceof SeismogramDisplayData) {
      this._ySeisData = [ysdd];
    } else {
      throw new Error(`Unknown data for xSeisData:`);
    }
    this._seisDataList = this._xSeisData.concat(this._ySeisData);
  }

  draw() {
    if (!this.isConnected) {
      return;
    }
    const wrapper = this.getShadowRoot().querySelector("div") as HTMLDivElement;
    const svgEl = wrapper.querySelector("svg") as SVGElement;
    if (!svgEl) {
      // svgEl is not def in particlemotion draw()?
      return;
    }
    const rect = svgEl.getBoundingClientRect();

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

    const timeScaleList = this._seisDataList.map((sdd) => this.recalcDisplayTimeRangeForSeisDisplayData(sdd));
    const ampScaleList = this._seisDataList.map((sdd) => this.ampScaleForSeisDisplayData(sdd));
    this.drawAxis();
    const handlebarsInput = this.createHandlebarsInput();
    axisutil.drawAxisLabels(
      svgEl,
      this.seismographConfig,
      this.height,
      this.width,
      handlebarsInput,
    );
    this.drawParticleMotion();
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

  drawParticleMotion() {
    const svgEl = this.getShadowRoot().querySelector("svg") as SVGElement;

    let g = svgEl.querySelector("g.marginTransform");
    if (g == null) {
      g = svgEl.appendChild(createSVGElement("g"));
      g.classList.add("marginTransform");
    }
    for (const inner_g of g.querySelectorAll("g.particleMotion")) {
      g.removeChild(inner_g);
    }
    if (
      !this.xSeisData ||
      this.xSeisData.length === 0 ||
      !this.ySeisData ||
      this.ySeisData.length === 0
    ) {
      // no data yet
      return;
    }
    let xOrientCode = "X";
    let yOrientCode = "Y";
    if (
      this.xSeisData[0].channelCode &&
      this.xSeisData[0].channelCode.length > 2
    ) {
      xOrientCode = this.xSeisData[0].channelCode.charAt(2);
    }
    if (
      this.ySeisData[0].channelCode &&
      this.ySeisData[0].channelCode.length > 2
    ) {
      yOrientCode = this.ySeisData[0].channelCode.charAt(2);
    }
    let xSegments: Array<SeismogramSegment>;
    let ySegments: Array<SeismogramSegment>;
    for (let i = 0; i < this.xSeisData.length; i++) {
      const lineG = g.appendChild(createSVGElement("g")) as SVGGElement;
      lineG.classList.add("particleMotion");
      lineG.classList.add("seisplotjsdata");
      lineG.classList.add("seispath");
      lineG.classList.add(this.xSeisData[0].codes());
      lineG.classList.add("orient" + xOrientCode + "_" + yOrientCode);
      xSegments = this.xSeisData[i].segments;
      ySegments = this.ySeisData[i].segments;
      let timeRange = this.recalcDisplayTimeRangeForSeisDisplayData(this.xSeisData[i]);
      if (timeRange != null) {
        const xAmpScale = this.xAmpScaleForSeisDisplayData(this.xSeisData[i]);
        const yAmpScale = this.ampScaleForSeisDisplayData(this.ySeisData[i]);
        xSegments.forEach((segX) => {
          ySegments.forEach((segY) => {
            this.drawParticleMotionForSegment(lineG, segX, segY, timeRange, xAmpScale, yAmpScale);
          });
        });
      }
    }
  }

  drawParticleMotionForSegment(
    lineG: SVGGElement,
    segA: SeismogramSegment,
    segB: SeismogramSegment,
    pmtimeRange: Interval,
    xampScale: ScaleLinear<number, number, never>,
    yampScale: ScaleLinear<number, number, never>
  ) {

    let timeRange = segA.timeRange?.intersection(segB.timeRange);
    timeRange = timeRange==null ? null : pmtimeRange.intersection(timeRange);
    if (!isDef(timeRange)) {
      // no overlap
      return;
    }

    const s = validStartTime(timeRange);
    const e = validEndTime(timeRange);
    const idxA = segA.indexOfTime(s);
    const lastIdxA = segA.indexOfTime(e);
    const idxB = segB.indexOfTime(s);
    const lastIdxB = segB.indexOfTime(e);

    if (idxA === -1 || lastIdxA === -1 || idxB === -1 || lastIdxB === -1) {
      return;
    }

    const numPts = Math.min(lastIdxA - idxA, lastIdxB - idxB) + 1;
    const path = lineG.appendChild(createSVGElement("path"));
    path.classList.add("seispath");
    path.setAttribute("marker-end", "url(#arrow)");
    let pathPoints = "M";
    for (let i = 0; i < numPts; i++) {
      pathPoints += xampScale(segA.yAtIndex(idxA+i))+","+yampScale(segB.yAtIndex(idxB + i))+"L";
    }
    path.setAttribute("d", pathPoints.substring(0, pathPoints.length-1));
  }


  ampScaleForSeisDisplayData(
    sdd: SeismogramDisplayData,
  ): ScaleLinear<number, number, never> {
    const ampRange = this.ampRangeForSeisDisplayData(sdd)
    const ampScale = this.__initAmpScale([this.height-1,1], false);  // Set resolution scaling to true
    ampScale.domain(ampRange.asArray());
    return ampScale;
  }

  xAmpScaleForSeisDisplayData(
    sdd: SeismogramDisplayData,
  ): ScaleLinear<number, number, never> {
    const ampRange = this.ampRangeForSeisDisplayData(sdd)
    const ampScale = this.__initAmpScale([1, this.width-1], false);  // Set resolution scaling to true
    ampScale.domain(ampRange.asArray());
    return ampScale;
  }

  drawAxis(): void {

    const wrapper = this.getShadowRoot().querySelector("div") as HTMLDivElement;
    const svgEl = wrapper.querySelector("svg") as SVGElement;
    if (!svgEl) {
      // svgEl is not def in particlemotion draw()?
      return;
    }

    const g = d3select(svgEl).select("g.marginTransform");
    g.selectAll("g.axis--y").remove();
    g.selectAll("g.axis--y-right").remove();
    const [yAxis, yAxisRight, xAxis, xAxisTop] = this.createLeftRightTopBottomAxis();
    const testg = g.append("g");
    testg.classed("testaxisg", true);
    if (isDef(yAxis)) {
      g.append("g").classed("axis axis--y", true).call(yAxis);
    }
    if (isDef(yAxisRight)) {
      g
        .append("g")
        .attr("class", "axis axis--y-right")
        .attr("transform", "translate(" + this.width + ",0)")
        .call(yAxisRight);
    }

    g.selectAll("g.axis--x").remove();
    g.selectAll("g.axis--x-top").remove();
    if (isDef(xAxis)) {
      g
        .append("g")
        .attr("class", "axis axis--x")
        .attr("transform", "translate(0," + this.height + ")")
        .call(xAxis);
    }
    if (isDef(xAxisTop)) {
      g.append("g").attr("class", "axis axis--x-top").call(xAxisTop);
    }
  }
  createLeftRightTopBottomAxis(): Array<Axis<d3NumberValue> | null> {
    let yAxis = null;
    let yAxisRight = null;
    const yAxisScale = this.ampScaleForAxis([this.height-1,1]);
    const xAxisScale = this.ampScaleForAxis([this.width-1,1]);
    if (this.seismographConfig.isYAxis) {
      yAxis = d3axisLeft(yAxisScale).tickFormat(
        numberFormatWrapper(this.seismographConfig.amplitudeFormat),
      );
      yAxis.scale(yAxisScale);
      yAxis.ticks(this.seismographConfig.yAxisNumTickHint,
        this.seismographConfig.amplitudeFormat);
    }

    if (this.seismographConfig.isYAxisRight) {
      yAxisRight = d3axisRight(yAxisScale).tickFormat(
        numberFormatWrapper(this.seismographConfig.amplitudeFormat),
      );
      yAxisRight.scale(yAxisScale);
      yAxisRight.ticks(this.seismographConfig.yAxisNumTickHint, this.seismographConfig.amplitudeFormat);
    }
    let xAxis = null;
    let xAxisTop = null;
    if (this.seismographConfig.isXAxis) {
      xAxis = d3axisBottom(xAxisScale).tickFormat(
        numberFormatWrapper(this.seismographConfig.amplitudeFormat),
      );
      xAxis.scale(xAxisScale);
      xAxis.ticks(this.seismographConfig.yAxisNumTickHint,
        this.seismographConfig.amplitudeFormat);
    }

    if (this.seismographConfig.isXAxisTop) {
      xAxisTop = d3axisTop(xAxisScale).tickFormat(
        numberFormatWrapper(this.seismographConfig.amplitudeFormat),
      );
      xAxisTop.scale(xAxisScale);
      xAxisTop.ticks(this.seismographConfig.yAxisNumTickHint, this.seismographConfig.amplitudeFormat);
    }
    return [yAxis, yAxisRight, xAxis, xAxisTop];
  }

  rescaleAxis() {
    const delay = 500;
    const svg = d3select(this.getShadowRoot().querySelector("svg") as SVGElement);
    const [yAxis, yAxisRight, xAxis, xAxisTop] = this.createLeftRightTopBottomAxis();
    if (yAxis) {
      const yaxisG = svg.select(".axis--y") as Selection<SVGGElement,unknown,null,undefined>;
      yaxisG
        .transition()
        .duration(delay / 2)
        .call(yAxis);
    }
    if (yAxisRight) {
      const yaxisG = svg.select(".axis--y-right") as Selection<SVGGElement,unknown,null,undefined>;
      yaxisG
        .transition()
        .duration(delay / 2)
        .call(yAxisRight);
    }
    if (xAxis) {
      const xaxisG = svg.select(".axis--x") as Selection<SVGGElement,unknown,null,undefined>;
      xaxisG
        .transition()
        .duration(delay / 2)
        .call(xAxis);
    }
    if (xAxisTop) {
      const xaxisG = svg.select(".axis--x-top") as Selection<SVGGElement,unknown,null,undefined>;
      xaxisG
        .transition()
        .duration(delay / 2)
        .call(xAxisTop);
    }
  }

  calcWidthHeight(nOuterWidth: number, nOuterHeight: number) {
    const defHW = 200;
    this.outerWidth = nOuterWidth ? Math.max(defHW, nOuterWidth) : defHW;
    this.outerHeight = nOuterHeight ? Math.max(defHW, nOuterHeight) : defHW;
    this.height =
      this.outerHeight -
      this.seismographConfig.margin.top -
      this.seismographConfig.margin.bottom;
    this.width =
      this.outerWidth -
      this.seismographConfig.margin.left -
      this.seismographConfig.margin.right;
    this.height = Math.min(this.height, this.width);
    this.width = Math.min(this.height, this.width);
  }

  createHandlebarsInput(): HandlebarsInput {
    return {
      seisDataList: this._seisDataList,
      seisConfig: this._seismographConfig,
      seisXData: this.xSeisData,
      seisYData: this.ySeisData,
    };
  }
}

// static ID for particle motion
ParticleMotion._lastID = 0;
customElements.define(PARTICLE_MOTION_ELEMENT, ParticleMotion);
