// @flow

/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */

import * as d3 from 'd3';

import {
    createPlotsBySelectorPromise
  } from './plotutil.js';

import {insertCSS} from './cssutil.js';
import { SeismographConfig } from './seismographconfig';
import {SeismogramSegment, Seismogram, SeismogramDisplayData } from './seismogram.js';
import { isDef, isNumArg, StartEndDuration } from './util.js';

/**
 * Creates particle motion plots, for each selected element. This assumes each
 * element has some combination of start, end, duration, net, sta, loc, and chan
 * attributes sufficient to form the data query to return all components of
 * motion. Or an href to a miniseed file.
 *
 * @param selector css selector
 */
export function createParticleMotionBySelector(selector: string): void {
    createPlotsBySelectorPromise(selector)
    .then(function(resultArray) {
      resultArray.forEach(function(result) {
        result.svgParent.append("p").text("Build plot");
        const sddList = result.sddList;
          if (sddList.length >1) {
            addDivForParticleMotion(result.svgParent, sddList[0], sddList[1]);
            if (sddList.length > 2) {
              addDivForParticleMotion(result.svgParent, sddList[0], sddList[2]);
              addDivForParticleMotion(result.svgParent, sddList[1], sddList[2]);
            }
          } else {
            result.svgParent.append("p").text(`Not Enough Data: ${sddList.length}`);
          }
      });
    });
  }

export function addDivForParticleMotion(svgParent: any, xSeisData: SeismogramDisplayData, ySeisData: SeismogramDisplayData, timeWindow?: StartEndDuration): ParticleMotion {
  let svgDiv = svgParent.append("div");
  if ( ! isDef(xSeisData)) {throw new Error("xSeisData cannot be null");}
  if ( ! isDef(ySeisData)) {throw new Error("ySeisData cannot be null");}
  const xSeis = xSeisData.seismogram;
  const ySeis = ySeisData.seismogram;
  const xLabel = xSeis ? xSeis.channelCode : "unknown";
  const yLabel = ySeis ? ySeis.channelCode : "unknown";
  svgDiv.classed(xLabel+" "+yLabel, true);
  svgDiv.classed("particleMotionContainer", true);
  return addParticleMotion(svgDiv, xSeisData, ySeisData, timeWindow);
}

export function addParticleMotion(svgParent: any, xSeisData: SeismogramDisplayData, ySeisData: SeismogramDisplayData, timeWindow?: StartEndDuration): ParticleMotion {
  if ( ! isDef(xSeisData.seismogram) || ! isDef(ySeisData.seismogram)) {
    // $FlowFixMe
    throw new Error(`Seismogram has no data: ${xSeisData.seismogram} ${ySeisData.seismogram}`);
  }
  const xSeis = xSeisData.seismogram;
  const ySeis = ySeisData.seismogram;

  let seisConfig = new SeismographConfig();
  if (isDef(timeWindow)) {
    seisConfig.fixedTimeScale = timeWindow;
  }
  seisConfig.title = xSeis.channelCode+" "+ySeis.channelCode;
  seisConfig.xLabel = xSeis.channelCode;
  seisConfig.yLabel = ySeis.channelCode;
  seisConfig.margin.top = seisConfig.margin.bottom;
  seisConfig.margin.right = seisConfig.margin.left;
  let pmp = new ParticleMotion(svgParent, seisConfig, xSeisData, ySeisData);
  pmp.draw();
  return pmp;
}

/**
 * Particle motion plot.
 *
 * @param inSvgParent parent element, often a div
 * @param seismographConfig config, not all parameters are used in
 * particle motion plots. Can be null for defaults.
 * @param xSeisData x axis seismogram
 * @param ySeisData y axis seismogram
 */
export class ParticleMotion {
  plotId: number;
  xSeisData: SeismogramDisplayData;
  ySeisData: SeismogramDisplayData;
  seismographConfig: SeismographConfig;
  timeWindow: StartEndDuration;
  width: number;
  height: number;
  outerWidth: number;
  outerHeight: number;
  xScale: any;
  xScaleRmean: any;
  xAxis: any;
  yScale: any;
  yScaleRmean: any;
  yAxis: any;
  svg: any;
  svgParent: any;
  g: any;
  static _lastID: number;
  constructor(inSvgParent: any,
              seismographConfig: SeismographConfig,
              xSeisData: SeismogramDisplayData | Seismogram,
              ySeisData: SeismogramDisplayData | Seismogram): void {
    if ( ! isDef(inSvgParent)) {throw new Error("inSvgParent cannot be null");}
    if ( ! isDef(xSeisData)) {throw new Error("xSeisData cannot be null");}
    if ( ! isDef(ySeisData)) {throw new Error("ySeisData cannot be null");}
    this.plotId = ++ParticleMotion._lastID;
    if ( xSeisData instanceof Seismogram) {
      this.xSeisData = SeismogramDisplayData.fromSeismogram(xSeisData);
    } else if ( xSeisData instanceof SeismogramDisplayData) {
      this.xSeisData = xSeisData;
    }
    if ( ySeisData instanceof Seismogram) {
      this.ySeisData = SeismogramDisplayData.fromSeismogram(ySeisData);
    } else if ( ySeisData instanceof SeismogramDisplayData) {
      this.ySeisData = ySeisData;
    }
    if (isDef(seismographConfig)) {
      this.seismographConfig = seismographConfig;
    } else {
      this.seismographConfig = new SeismographConfig();
      this.seismographConfig.xLabel = this.xSeisData.channelCode;
      this.seismographConfig.yLabel = this.ySeisData.channelCode;
      this.seismographConfig.margin.left = 40;
      this.seismographConfig.margin.top = this.seismographConfig.margin.bottom;
      this.seismographConfig.margin.right = this.seismographConfig.margin.left;
    }
    this.calcTimeWindow();
    this.svg = inSvgParent.append("svg");
    this.svg.attr("version", "1.1");
    this.svg.classed("particleMotion", true);
    this.svg.attr("plotId", this.plotId);
    this.xScale = d3.scaleLinear();
    // yScale for axis (not drawing) that puts mean at 0 in center
    this.xScaleRmean = d3.scaleLinear();
    this.yScale = d3.scaleLinear();
    // yScale for axis (not drawing) that puts mean at 0 in center
    this.yScaleRmean = d3.scaleLinear();
    this.svgParent = inSvgParent;

    this.xAxis = d3.axisBottom(this.xScaleRmean).tickFormat(this.seismographConfig.yScaleFormat);
    this.yAxis = d3.axisLeft(this.yScaleRmean).tickFormat(this.seismographConfig.yScaleFormat);
    this.width = 100;
    this.height = 100;
    let mythis = this;

    this.g = this.svg.append("g")
        .attr("transform", "translate(" + this.seismographConfig.margin.left + "," + this.seismographConfig.margin.top + ")");
    this.calcScaleDomain();
    d3.select(window).on('resize.particleMotion'+this.plotId, function() {if (mythis.checkResize()) {mythis.draw();}});
  }
  draw() {
    this.checkResize();
    this.drawAxis();
    this.drawAxisLabels();
    this.drawParticleMotion();
    return this;
  }
  checkResize(): boolean {
    let rect = this.svgParent.node().getBoundingClientRect();
    if (rect.width !== this.outerWidth || rect.height !== this.outerHeight) {
      this.calcWidthHeight(rect.width, rect.height);
      return true;
    }
    return false;
  }
  drawParticleMotion() {
    this.g.selectAll("g.particleMotion").remove();
    let lineG = this.g.append("g");
    lineG.classed("particleMotion", true)
      .classed("seispath", true)
      .classed(this.xSeisData.codes(), true)
      .classed("orient"+this.xSeisData.channelCode.charAt(2)+"_"+this.ySeisData.channelCode.charAt(2), true);

    // for flow
    let xSegments = this.xSeisData.seismogram ? this.xSeisData.seismogram.segments : [];
    let ySegments = this.ySeisData.seismogram ? this.ySeisData.seismogram.segments : [];
    xSegments.forEach(segX => {
        ySegments.forEach(segY => {
          this.drawParticleMotionForSegment(lineG, segX, segY);
        });
      });
  }
  drawParticleMotionForSegment(lineG: d3.selection, segA: SeismogramSegment, segB: SeismogramSegment) {
    const mythis = this;
    const timeWindow = segA.timeWindow.intersect(segB.timeWindow);
    if ( ! isDef(timeWindow)) {
      // no overlap
      return;
    }
    const idxA = segA.indexOfTime(timeWindow.startTime);
    const lastIdxA = segA.indexOfTime(timeWindow.endTime);
    const idxB = segB.indexOfTime(timeWindow.startTime);
    const lastIdxB = segB.indexOfTime(timeWindow.endTime);
    if (idxA === -1 || lastIdxA === -1 || idxB === -1 || lastIdxB === -1) {
      return;
    }
    const numPts = Math.min(lastIdxA-idxA, lastIdxB-idxB)+1;
    let segmentG = lineG.append("g").classed("segment", true);
    let path = segmentG.selectAll("path").data( [ segA.y.slice(idxA, numPts) ] );
    path.exit().remove();
    path.enter()
      .append("path")
      .classed("seispath", true)
    .attr("d", d3.line().curve(d3.curveLinear)
      .x(d => mythis.xScale(d))
      .y((d,i) => mythis.yScale(segB.yAtIndex(idxB+i))));
  }

  drawAxis() {
    let svgG = this.g;
    svgG.selectAll("g.axis").remove();
    svgG.append("g")
        .attr("class", "axis axis--x")
        .attr("transform", "translate(0," + this.height + ")")
        .call(this.xAxis);
    svgG.append("g")
        .attr("class", "axis axis--y")
        .call(this.yAxis);
  }
  drawAxisLabels() {
    this.drawTitle();
    this.drawXLabel();
    this.drawXSublabel();
    this.drawYLabel();
    this.drawYSublabel();
    return this;
  }

  rescaleAxis() {
    let delay = 500;
    this.g.select(".axis--y").transition().duration(delay/2).call(this.yAxis);
    this.g.select(".axis--x").transition().duration(delay/2).call(this.xAxis);
    return this;
  }

  calcScaleDomain() {
    let halfDomainDelta = 1;
    if (this.seismographConfig.fixedYScale) {
      halfDomainDelta = (this.seismographConfig.fixedYScale[1] - this.seismographConfig.fixedYScale[0])/2;
      this.xScale.domain(this.seismographConfig.fixedYScale).nice();
      this.yScale.domain(this.seismographConfig.fixedYScale).nice();
    } else {
      let xMinMax = [this.xSeisData.min, this.xSeisData.max];
      let yMinMax = [this.ySeisData.min, this.ySeisData.max];
      halfDomainDelta = (xMinMax[1] - xMinMax[0])/2;
      if (yMinMax[1]-yMinMax[0] > xMinMax[1] - xMinMax[0]) {
        halfDomainDelta = (yMinMax[1]-yMinMax[0])/2;
      }
      let xMid = (xMinMax[1] + xMinMax[0])/2;
      let yMid = (yMinMax[1] + yMinMax[0])/2;
      xMinMax = [xMid - halfDomainDelta, xMid + halfDomainDelta ];
      yMinMax = [yMid - halfDomainDelta, yMid + halfDomainDelta ];
      this.xScale.domain(xMinMax).nice();
      this.yScale.domain(yMinMax).nice();
    }
    let xNiceMinMax = this.xScale.domain();
    let xHalfNice = (xNiceMinMax[1] - xNiceMinMax[0])/2;
    this.xScaleRmean.domain([ -1 * xHalfNice,  xHalfNice ]);

    let yNiceMinMax = this.yScale.domain();
    let yHalfNice = (yNiceMinMax[1] - yNiceMinMax[0])/2;
    this.yScaleRmean.domain([ -1 * yHalfNice,  yHalfNice ]);
    this.rescaleAxis();
    return this;
  }

  calcTimeWindow(): void {
    let tw = null;
    if ( this.seismographConfig.fixedTimeScale) {
      tw = this.seismographConfig.fixedTimeScale;
    } else {
      tw = this.xSeisData.timeWindow.intersect(this.ySeisData.timeWindow);
    }
    if ( ! tw) {
      // intersection might be null
      throw new Error(`Seismograms do not overlap: ${this.xSeisData.timeWindow.toString()} ${this.ySeisData.timeWindow.toString()}`);
    }
    this.timeWindow = tw;
  }

  calcWidthHeight(nOuterWidth: number, nOuterHeight: number) {
    this.outerWidth = nOuterWidth ? Math.max(100, nOuterWidth) : 100;
    this.outerHeight = nOuterHeight ? Math.max(100, nOuterHeight) : 100;
    this.height = this.outerHeight - this.seismographConfig.margin.top - this.seismographConfig.margin.bottom;
    this.width = this.outerWidth - this.seismographConfig.margin.left - this.seismographConfig.margin.right;
    this.xScale.range([0, this.width]);
    this.yScale.range([this.height, 0]);
    this.xScaleRmean.range([0, this.width]);
    this.yScaleRmean.range([this.height, 0]);
    return this;
  }
  /**
   * Draws the title as simple string or array of strings. If an array
   * then each item will be in a separate tspan for easier formatting.
   *
   * @returns this
   */
  drawTitle(): ParticleMotion {
    this.svg.selectAll("g.title").remove();
    let titleSVGText = this.svg.append("g")
       .classed("title", true)
       .attr("transform", "translate("+(this.seismographConfig.margin.left+(this.width)/2)+", "+( this.seismographConfig.margin.bottom/3  )+")")
       .append("text").classed("title label", true)
       .attr("text-anchor", "middle");
    if (Array.isArray(this.seismographConfig.title)) {
      this.seismographConfig.title.forEach(function(s) {
        titleSVGText.append("tspan").text(s+" ");
      });
    } else {
      titleSVGText
        .text(this.seismographConfig.title);
    }
    return this;
  }
  drawXLabel() {
    this.svg.selectAll("g.xLabel").remove();
    if (isNumArg(this.width) && isNumArg(this.outerWidth)) {
    this.svg.append("g")
       .classed("xLabel", true)
       .attr("transform", "translate("+(this.seismographConfig.margin.left+(this.width)/2)+", "+(this.outerHeight - this.seismographConfig.margin.bottom/3  )+")")
       .append("text").classed("x label", true)
       .attr("text-anchor", "middle")
       .text(this.seismographConfig.xLabel);
    }
    return this;
  }
  drawYLabel() {
    this.svg.selectAll('g.yLabel').remove();
    if (this.height) {
      this.svg.append("g")
       .classed("yLabel", true)
       .attr("x", 0)
       .attr("transform", "translate(0, "+(this.seismographConfig.margin.top+(this.height)/2)+")")
       .append("text")
       .classed("y label", true)
       .attr("text-anchor", "middle")
       .attr("dy", ".75em")
       .attr("transform-origin", "center center")
       .attr("transform", "rotate(-90)")
       .text(this.seismographConfig.yLabel);
     }
    return this;
  }
  drawXSublabel() {
    this.svg.selectAll('g.xSublabel').remove();
    this.svg.append("g")
       .classed("xSublabel", true)
       .attr("transform", "translate("+(this.seismographConfig.margin.left+(this.width)/2)+", "+(this.outerHeight  )+")")
       .append("text").classed("x label sublabel", true)
       .attr("text-anchor", "middle")
       .text(this.seismographConfig.xSublabel);
    return this;
  }
  drawYSublabel()  {
    this.svg.selectAll('g.ySublabel').remove();

    this.svg.append("g")
       .classed("ySublabel", true)
       .attr("x", 0)
       .attr("transform", "translate( "+this.seismographConfig.ySublabelTrans+" , "+(this.seismographConfig.margin.top+(this.height)/2)+")")
       .append("text")
       .classed("y label sublabel", true)
       .attr("text-anchor", "middle")
       .attr("dy", ".75em")
       .attr("transform-origin", "center center")
       .attr("transform", "rotate(-90)")
       .text(this.seismographConfig.ySublabel);
    return this;
  }
}

export const particleMotion_css = `
.particleMotionContainer {
  height: 100%;
  width: 100%;
  min-height: 25px;
  min-width: 25px;
}

svg.particleMotion {
  height: 100%;
  width: 100%;
  min-height: 25px;
  min-width: 25px;
}

svg.particleMotion text.title {
  font-size: larger;
  font-weight: bold;
  fill: black;
  color: black;
  dominant-baseline: hanging;
}

svg.particleMotion path.seispath {
    stroke: skyblue;
    fill: none;
    stroke-width: 1px;
}
`;

if (document){
  insertCSS(particleMotion_css);
}

// static ID for particle motion
ParticleMotion._lastID = 0;
