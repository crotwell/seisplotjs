/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * https://www.seis.sc.edu
 */
//import * as d3 from "d3";
import {select as d3select} from "d3-selection";
import 'd3-transition';
import {scaleLinear as d3scaleLinear } from "d3-scale";
import {
  line as d3line,
  curveLinear as d3curveLinear
} from "d3-shape";
import {
  axisLeft as d3axisLeft ,
  axisBottom as d3axisBottom,
} from "d3-axis";
import {Interval} from "luxon";
import {SeisPlotElement} from "./spelement";
import {MinMaxable} from './scale';
import {SeismographConfig, numberFormatWrapper } from "./seismographconfig";
import {
  Seismogram,
  SeismogramDisplayData,
  findMinMaxOfSDD,
} from "./seismogram";
import {SeismogramSegment} from "./seismogramsegment";
import {COLOR_CSS_ID} from "./seismograph";
import {isDef, isNumArg, SVG_NS, validStartTime, validEndTime} from "./util";
import * as axisutil from "./axisutil";
import type {HandlebarsInput} from "./axisutil";

import type {Axis} from 'd3-axis';
import type {ScaleLinear, NumberValue as d3NumberValue} from "d3-scale";
import type {Selection} from 'd3-selection';

export const DEFAULT_TITLE =
  "<tspan>{{#each seisDataList}}{{onlyChangesChannel ../seisDataList @index}} {{else}}No Data{{/each}}</tspan>";
export const DEFAULT_XLABEL =
"{{#each seisXData}}<tspan>{{this.channelCode}}</tspan> {{else}}No Data{{/each}}";

export const DEFAULT_YLABEL =
"{{#each seisYData}}<tspan>{{this.channelCode}}</tspan> {{else}}No Data{{/each}}";

export const PARTICLE_MOTION_ELEMENT = 'sp-particle-motion';


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
  defaultSeisConfig?: SeismographConfig
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

/**
 * Particle motion plot.
 *
 * @param xSeisData x axis seismogram
 * @param ySeisData y axis seismogram
 * @param seismographConfig config, not all parameters are used in
 * particle motion plots. Can be null for defaults.
 */
export class ParticleMotion extends SeisPlotElement {
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
  g: Selection<SVGGElement, unknown, null, undefined>;
  static _lastID: number;

  constructor(xSeisData?: Array<SeismogramDisplayData>,
      ySeisData?: Array<SeismogramDisplayData>,
      seisConfig?: SeismographConfig) {
    if ( ! xSeisData) { xSeisData = [];}
    if (xSeisData instanceof Seismogram) {
      xSeisData = [SeismogramDisplayData.fromSeismogram(xSeisData)];
    }
    if ( ! Array.isArray(xSeisData)) {xSeisData = [ xSeisData];}
    if ( ! ySeisData) { ySeisData = [];}
    if ( ! Array.isArray(ySeisData)) {ySeisData = [ ySeisData];}
    const seisData = xSeisData.concat(ySeisData);
    if ( ! seisConfig) {seisConfig = createParticleMotionConfig();}
    super(seisData, seisConfig);

    this._xSeisData = xSeisData;
    this._ySeisData = ySeisData;

    this.addStyle(particleMotion_css);
    const lineColorsCSS = this.seismographConfig.createCSSForLineColors();
    this.addStyle(lineColorsCSS, COLOR_CSS_ID);

    const wrapper = document.createElement('div');
    wrapper.setAttribute("class", "wrapper");
    const svgWrapped = wrapper.appendChild(document.createElementNS(SVG_NS, 'svg'));
    this.getShadowRoot().appendChild(wrapper);

    const svg = d3select(svgWrapped);

    this.plotId = ++ParticleMotion._lastID;

    if (this.xSeisData.length !== this.ySeisData.length) {
      throw new Error(`xSeisData and ySeisData should have same length: ${this.xSeisData.length} !== ${this.ySeisData.length}`);
    }

    svg.attr("version", "1.1");
    svg.classed("particleMotion", true);
    svg.attr("plotId", this.plotId);
    this.xScale = d3scaleLinear();
    // yScale for axis (not drawing) that puts mean at 0 in center
    this.xScaleRmean = d3scaleLinear();
    this.yScale = d3scaleLinear();
    // yScale for axis (not drawing) that puts mean at 0 in center
    this.yScaleRmean = d3scaleLinear();

    if (this.seismographConfig.isCenteredAmp()) {
      this.xAxis = d3axisBottom(this.xScaleRmean)
        .tickFormat(numberFormatWrapper(this.seismographConfig.amplitudeFormat));
      this.yAxis = d3axisLeft(this.yScaleRmean)
        .tickFormat(numberFormatWrapper(this.seismographConfig.amplitudeFormat));
    } else {
      this.xAxis = d3axisBottom(this.xScale)
        .tickFormat(numberFormatWrapper(this.seismographConfig.amplitudeFormat));
      this.yAxis = d3axisLeft(this.yScale)
        .tickFormat(numberFormatWrapper(this.seismographConfig.amplitudeFormat));
    }

    this.width = 100;
    this.height = 100;
    // for line ends to show direction of particle motion
    const arrow = svg.append("defs").append("marker");
    arrow
      .attr("id", "arrow")
      .attr("markerWidth", "10")
      .attr("markerHeight", "10")
      .attr("refX", "0")
      .attr("refY", "3")
      .attr("orient", "auto")
      .attr("markerUnits", "strokeWidth");
    arrow
      .append("path")
      .attr("d", "M0,0 L0,6 L9,3 z")
      .attr("stroke", "currentColor")
      .attr("fill", "currentColor");
    this.g = svg
      .append("g")
      .attr(
        "transform",
        "translate(" +
          this.seismographConfig.margin.left +
          "," +
          this.seismographConfig.margin.top +
          ")",
      );
    this.calcScaleDomain();
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
      this._xSeisData = [ xsdd ];
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
      this._ySeisData = [ ysdd ];
    } else {
      throw new Error(`Unknown data for xSeisData:`);
    }
    this._seisDataList = this._xSeisData.concat(this._ySeisData);
  }

  draw() {

    if ( ! this.isConnected) { return; }
    const wrapper = (this.getShadowRoot().querySelector('div') as HTMLDivElement);
    const svgEl = wrapper.querySelector('svg') as SVGElement;
    if (! svgEl) {
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
  }

  checkResize(): boolean {
    const wrapper = (this.getShadowRoot().querySelector('div') as HTMLDivElement);
    const svgEl = wrapper.querySelector('svg') as SVGElement;
    const rect = svgEl.getBoundingClientRect();

    if (rect.width !== this.outerWidth || rect.height !== this.outerHeight) {
      return true;
    }

    return false;
  }

  drawParticleMotion() {
    this.g.selectAll("g.particleMotion").remove();
    if ( ! this.xSeisData || this.xSeisData.length === 0
        || ! this.ySeisData || this.ySeisData.length === 0) {
      // no data yet
      return;
    }
    const lineG = this.g.append("g");
    let xOrientCode = 'X';
    let yOrientCode = 'Y';
    if (this.xSeisData[0].channelCode && this.xSeisData[0].channelCode.length > 2) {
      xOrientCode = this.xSeisData[0].channelCode.charAt(2);
    }
    if (this.ySeisData[0].channelCode && this.ySeisData[0].channelCode.length > 2) {
      yOrientCode = this.ySeisData[0].channelCode.charAt(2);
    }
    lineG
      .classed("particleMotion", true)
      .classed("seisplotjsdata", true)
      .classed("seispath", true)
      .classed(this.xSeisData[0].codes(), true)
      .classed("orient" +xOrientCode +"_" +yOrientCode, true);
    let xSegments: Array<SeismogramSegment>;
    let ySegments: Array<SeismogramSegment>;
    for(let i =0; i<this.xSeisData.length; i++) {
      xSegments = this.xSeisData[i].segments;
      ySegments = this.ySeisData[i].segments;
      xSegments.forEach(segX => {
        ySegments.forEach(segY => {
          this.drawParticleMotionForSegment(lineG, segX, segY);
        });
      });
    }
  }

  drawParticleMotionForSegment(
    lineG: Selection<SVGGElement, unknown, null, undefined>,
    segA: SeismogramSegment,
    segB: SeismogramSegment,
  ) {
    const timeRange = segA.timeRange.intersection(segB.timeRange);

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
    const segmentG = lineG.append("g").classed("segment", true);
    const path = segmentG.selectAll("path").data([segA.y.slice(idxA, numPts)]);
    path.exit().remove();
    path
      .enter()
      .append("path")
      .classed("seispath", true)
      .attr("marker-end", "url(#arrow)")
      .attr(
        "d",
        // @ts-expect-error no idea why typescript thinks dd is [number, number] when it is just number
        d3line()
          .curve(d3curveLinear)
          .x((dd) => {
            // @ts-expect-error no idea why typescript thinks dd is [number, number] when it is just number
            return this.xScale(dd);
          })
          .y((d, i) => {
            return this.yScale(segB.yAtIndex(idxB + i));
          }),
      );
  }

  drawAxis() {
    const svgG = this.g;
    svgG.selectAll("g.axis").remove();
    svgG
      .append("g")
      .attr("class", "axis axis--x")
      .attr("transform", "translate(0," + this.height + ")")
      .call(this.xAxis);
    svgG.append("g").attr("class", "axis axis--y").call(this.yAxis);
  }

  rescaleAxis() {
    const delay = 500;
    const yaxisG = this.g
      .select(".axis--y") as Selection<SVGGElement, unknown, null, undefined>;
    yaxisG.transition()
      .duration(delay / 2)
      .call(this.yAxis);
    const xaxisG = this.g
      .select(".axis--x") as Selection<SVGGElement, unknown, null, undefined>;
    xaxisG.transition()
      .duration(delay / 2)
      .call(this.xAxis);
  }

  calcScaleDomain() {
    let halfDomainDelta = 1;

    if (this.seismographConfig.fixedAmplitudeScale) {
      halfDomainDelta =
        (this.seismographConfig.fixedAmplitudeScale[1] -
          this.seismographConfig.fixedAmplitudeScale[0]) /
        2;
      this.xScale.domain(this.seismographConfig.fixedAmplitudeScale).nice();
      this.yScale.domain(this.seismographConfig.fixedAmplitudeScale).nice();
    } else {
      let xMinMax = new MinMaxable(-1, 1);
      if (this.xSeisData ) {
        xMinMax = findMinMaxOfSDD(this.xSeisData);
      }
      let yMinMax = new MinMaxable(-1, 1);
      if (this.ySeisData) {
        yMinMax = findMinMaxOfSDD(this.ySeisData);
      }
      halfDomainDelta = xMinMax.halfWidth;

      if (yMinMax.halfWidth > halfDomainDelta) {
        halfDomainDelta = yMinMax.halfWidth;
      }

      const xMid = xMinMax.middle;
      const yMid = yMinMax.middle;
      const xMinMaxArr = [xMid - halfDomainDelta, xMid + halfDomainDelta];
      const yMinMaxArr = [yMid - halfDomainDelta, yMid + halfDomainDelta];
      this.xScale.domain(xMinMaxArr).nice();
      this.yScale.domain(yMinMaxArr).nice();
    }

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
