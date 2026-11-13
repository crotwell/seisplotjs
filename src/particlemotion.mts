/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * https://www.seis.sc.edu
 */
//import * as d3 from "d3";
import { select as d3select } from "d3-selection";
import "d3-transition";
import { scaleLinear as d3scaleLinear } from "d3-scale";
import { line as d3line, curveLinear as d3curveLinear } from "d3-shape";
import { axisLeft as d3axisLeft, axisBottom as d3axisBottom } from "d3-axis";
import { Duration, Interval } from "luxon";
import { SeisPlotElement } from "./spelement.mjs";
import {
  MinMaxable, AmplitudeScalable,
  TimeScalable, ZERO_DURATION } from "./scale.mjs";
import { SeismographConfig, numberFormatWrapper } from "./seismographconfig.mjs";
import { ScalableGraph } from "./scaleablegraph.mjs";
import {
  Seismogram,
  SeismogramDisplayData,
  findMinMaxOfSDD,
  findMaxDuration
} from "./seismogram.mjs";
import { SeismogramSegment } from "./seismogramsegment.mjs";
import { COLOR_CSS_ID } from "./seismograph.mjs";
import { isDef, isNumArg, SVG_NS, validStartTime, validEndTime, createSVGElement } from "./util.mjs";
import {AUTO_COLOR_SELECTOR} from "./cssutil.mjs";
import * as axisutil from "./axisutil.mjs";
import type { HandlebarsInput } from "./axisutil.mjs";

import type { Axis } from "d3-axis";
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
  xScale: ScaleLinear<number, number, never>;
  xScaleRmean: ScaleLinear<number, number, never>;
  xAxis: Axis<d3NumberValue>;
  yScale: ScaleLinear<number, number, never>;
  yScaleRmean: ScaleLinear<number, number, never>;
  yAxis: Axis<d3NumberValue>;
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

    this.xScale = d3scaleLinear();
    // yScale for axis (not drawing) that puts mean at 0 in center
    this.xScaleRmean = d3scaleLinear();
    this.yScale = d3scaleLinear();
    // yScale for axis (not drawing) that puts mean at 0 in center
    this.yScaleRmean = d3scaleLinear();

    if (this.seismographConfig.isCenteredAmp()) {
      this.xAxis = d3axisBottom(this.xScaleRmean);
      this.yAxis = d3axisLeft(this.yScaleRmean);
    } else {
      this.xAxis = d3axisBottom(this.xScale);
      this.yAxis = d3axisLeft(this.yScale);
    }
    this.xAxis.ticks(this.seismographConfig.yAxisNumTickHint,
      this.seismographConfig.amplitudeFormat)
      .tickFormat(
        numberFormatWrapper(this.seismographConfig.amplitudeFormat),
      );
    this.yAxis.ticks(this.seismographConfig.yAxisNumTickHint,
      this.seismographConfig.amplitudeFormat)
      .tickFormat(
        numberFormatWrapper(this.seismographConfig.amplitudeFormat),
      );

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
    g.classList.add("plot");
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

    const timeScalePromiseList = Promise.all(
      this._seisDataList.map((sdd) => this.recalcDisplayTimeRangeForSeisDisplayData(sdd)));
    const ampScalePromiseList = Promise.all(
      this._seisDataList.map((sdd) => this.ampScaleForSeisDisplayData(sdd)));
    return Promise.all([timeScalePromiseList, ampScalePromiseList]).then( ([timeScaleList, ampScaleList]) => {
      console.log(`redraw time: ${timeScaleList[0]}  amp: ${ampScaleList[0].domain()}`)
      this.calcScaleDomain();
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
    });
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

    let g = svgEl.querySelector("g.plot");
    if (g == null) {
      g = svgEl.appendChild(createSVGElement("g"));
      g.classList.add("plot");
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
    const promiseList: Array<Promise<void>> = [];
    for (let i = 0; i < this.xSeisData.length; i++) {
      const lineG = g.appendChild(createSVGElement("g")) as SVGGElement;
      lineG.classList.add("particleMotion");
      lineG.classList.add("seisplotjsdata");
      lineG.classList.add("seispath");
      lineG.classList.add(this.xSeisData[0].codes());
      lineG.classList.add("orient" + xOrientCode + "_" + yOrientCode);
      xSegments = this.xSeisData[i].segments;
      ySegments = this.ySeisData[i].segments;
      const segPromise = this.recalcDisplayTimeRangeForSeisDisplayData(this.xSeisData[i])
      .then((timeRange: Interval) => {
        if (timeRange != null) {
          console.log(`drawPM, timeRange: ${timeRange}`);
          const ampScale = this.ampScaleForSeisDisplayData(this.xSeisData[i]);
          console.log(`amp scale: ${ampScale.domain()} ${ampScale.range()}`)
          xSegments.forEach((segX) => {
            ySegments.forEach((segY) => {
              this.drawParticleMotionForSegment(lineG, segX, segY, timeRange, ampScale);
            });
          });
        }
      });
      promiseList.push(segPromise);
    }
    Promise.all(promiseList).catch(err => console.warn(`probelm drawing par mo`, err));
  }

  drawParticleMotionForSegment(
    lineG: SVGGElement,
    segA: SeismogramSegment,
    segB: SeismogramSegment,
    pmtimeRange: Interval,
    ampScale: ScaleLinear<number, number, never>
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
      pathPoints += ampScale(segA.yAtIndex(idxA+i))+","+ampScale(segB.yAtIndex(idxB + i))+"L";
    }
    path.setAttribute("d", pathPoints.substring(0, pathPoints.length-1));
  }


  ampScaleForSeisDisplayData(
    sdd: SeismogramDisplayData,
  ): ScaleLinear<number, number, never> {
    const ampRange = this.ampRangeForSeisDisplayData(sdd)
    const ampScale = this.__initAmpScale([this.height-1,1], false);  // Set resolution scaling to true
    ampScale.domain(ampRange.asArray());
    console.log(`pm ampScaleForSeisDisplayData: ${ampScale.domain()} ${ampScale.range()} `)
    return ampScale;
  }

  drawAxis() {
    const svgEl = this.getShadowRoot().querySelector("svg") as SVGElement;
    const svgG = svgEl?.querySelector("g.plot");
    if (svgG != null) {
      for (const g of svgG.querySelectorAll("g.axis")) {
        svgG.removeChild(g);
      }
      const xg = svgG.appendChild(createSVGElement("g")) as SVGGElement;
      xg.classList.add("axis");
      xg.classList.add("axis--x");
      xg.setAttribute("transform", "translate(0," + this.height + ")");
      const xg_d3 = d3select(xg) as Selection<SVGGElement,unknown,null,undefined>;
      xg_d3.call(this.xAxis);
      const yg = svgG.appendChild(createSVGElement("g")) as SVGGElement;
      yg.classList.add("axis");
      yg.classList.add("axis--y");
      const yg_d3 = d3select(yg) as Selection<SVGGElement,unknown,null,undefined>;
      yg_d3.call(this.yAxis);
    }
  }

  rescaleAxis() {
    const delay = 500;
    const svg = d3select(this.getShadowRoot().querySelector("svg") as SVGElement);
    const yaxisG = svg.select(".axis--y") as Selection<SVGGElement,unknown,null,undefined>;
    yaxisG
      .transition()
      .duration(delay / 2)
      .call(this.yAxis);
    const xaxisG = svg.select(".axis--x") as Selection<SVGGElement,unknown,null,undefined>;
    xaxisG
      .transition()
      .duration(delay / 2)
      .call(this.xAxis);
  }

  calcScaleDomain() {
    let ampRange = this.calcAmpScaleDomain().asArray();
    this.xScale.domain(ampRange).nice();
    this.yScale.domain(ampRange).nice();

    const xNiceMinMax = this.xScale.domain();
    const xHalfNice = (xNiceMinMax[1] - xNiceMinMax[0]) / 2;
    if (this.seismographConfig.isCenteredAmp()) {
      this.xScaleRmean.domain([-1 * xHalfNice, xHalfNice]);
    } else {
      this.xScaleRmean.domain(this.xScale.domain());
    }
    const yNiceMinMax = this.yScale.domain();
    const yHalfNice = (yNiceMinMax[1] - yNiceMinMax[0]) / 2;
    if (this.seismographConfig.isCenteredAmp()) {
      this.yScaleRmean.domain([-1 * yHalfNice, yHalfNice]);
    } else {
      this.yScaleRmean.domain(this.yScale.domain());
    }
    this.rescaleAxis();
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
    this.xScale.range([0, this.width]);
    this.yScale.range([this.height, 0]);
    this.xScaleRmean.range([0, this.width]);
    this.yScaleRmean.range([this.height, 0]);
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
