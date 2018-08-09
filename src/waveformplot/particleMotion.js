// @flow

import {
    d3,
    miniseed,
    createPlotsBySelectorPromise,
    findMinMax
  } from './util';

const moment = miniseed.model.moment;
import type { MarginType } from './waveformplot';

export function createParticleMotionBySelector(selector: string) :void {
    createPlotsBySelectorPromise(selector)
    .then(function(resultArray) {
      resultArray.forEach(function(result) {
        result.svgParent.append("p").text("Build plot");
          if (result.segments.length >1) {
            addDivForParticleMotion(result.segments[0], result.segments[1], result.svgParent, result.startDate, result.endDate);
            if (result.segments.length > 2) {
              addDivForParticleMotion(result.segments[0], result.segments[2], result.svgParent, result.startDate, result.endDate);
              addDivForParticleMotion(result.segments[1], result.segments[2], result.svgParent, result.startDate, result.endDate);
            }
          } else {
            result.svgParent.append("p").text("No Data");
          }
      });
    });
  }

function addDivForParticleMotion(sa: Array<miniseed.model.Seismogram>, sb: Array<miniseed.model.Seismogram>, svgParent: any, startDate: moment, endDate: moment) :void {
  svgParent.append("h5").text(sa[0].chanCode()+" "+sb[0].chanCode());
  let svgDiv = svgParent.append("div");
  svgDiv.classed(sa[0].chanCode()+" "+sb[0].chanCode(), true);
  svgDiv.classed("svg-container-square", true);
  let pmp = new ParticleMotion(svgDiv, [sa[0], sb[0]], startDate, endDate);
  pmp.setXLabel(sa[0].chanCode());
  pmp.setYLabel(sb[0].chanCode());
  pmp.draw();
}

/** Particle motion. */
export class ParticleMotion {
  plotId: number;
  segments: Array<miniseed.model.Seismogram>;
  width: number;
  height: number;
  outerWidth: number;
  outerHeight: number;
  margin: MarginType;
  title: string;
  xLabel: string;
  xSublabel: string;
  yLabel: string;
  ySublabel: string;
  ySublabelTrans: number;
  yScaleFormat: string | (value :number) => string;
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
  constructor(inSvgParent: any, inSegments: Array<miniseed.model.Seismogram>, plotStartDate: moment, plotEndDate: moment) :void {
    if (inSvgParent == null) {throw new Error("inSvgParent cannot be null");}
    if (inSegments.length != 2) {throw new Error("inSegments should be lenght 2 but was "+inSegments.length);}
    this.plotId = ++ParticleMotion._lastID;
// maybe don't need, just plot as many points as can
//    if (inSegments[0].y().length != inSegments[1].y().length) {throw new Error("inSegments should be of same lenght but was "+inSegments[0].y().length+" "+inSegments[1].y().length);}
    if ( ! plotStartDate) {plotStartDate = inSegments[0].start();}
    if ( ! plotEndDate) {plotEndDate = inSegments[0].end();}
    this.svg = inSvgParent.append("svg");
    this.svg.classed("svg-content-responsive", true);
    this.svg.attr("version", "1.1");
    this.svg.attr("preserveAspectRatio", "xMinYMin meet");
    this.svg.attr("viewBox", "0 0 400 400")
      .attr("plotId", this.plotId);
    this.xScale = d3.scaleLinear();
    // yScale for axis (not drawing) that puts mean at 0 in center
    this.xScaleRmean = d3.scaleLinear();
    this.yScale = d3.scaleLinear();
    // yScale for axis (not drawing) that puts mean at 0 in center
    this.yScaleRmean = d3.scaleLinear();
    this.svgParent = inSvgParent;
    this.segments = inSegments;

    this.yScaleFormat = "3e";
    this.xAxis = d3.axisBottom(this.xScaleRmean).ticks(8, this.yScaleFormat);
    this.yAxis = d3.axisLeft(this.yScaleRmean).ticks(8, this.yScaleFormat);
    this.margin = {top: 20, right: 20, bottom: 42, left: 65};
    this.width = 100;
    this.height = 100;
    this.ySublabelTrans = 10;
    let mythis = this;

    this.g = this.svg.append("g")
        .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");
    this.calcScaleDomain();
    d3.select(window).on('resize.particleMotion'+this.plotId, function() {if (mythis.checkResize()) {mythis.draw();}});
  }
  draw() {
    this.checkResize();
    this.drawAxis(this.g);
    this.drawAxisLabels();
    this.drawParticleMotion(this.segments[0], this.segments[1]);
    return this;
  }
  checkResize(): boolean {
    let rect = this.svgParent.node().getBoundingClientRect();
    if (rect.width != this.outerWidth || rect.height != this.outerHeight) {
      this.setWidthHeight(rect.width, rect.height);
      return true;
    }
    return false;
  }
  drawParticleMotion(segA: miniseed.model.Seismogram, segB: miniseed.model.Seismogram) {
    let mythis = this;
    this.g.selectAll("g.particleMotion").remove();
    let lineG = this.g.append("g").classed("particleMotion", true);
    let path = lineG.selectAll("path").data( [ segA.y() ] );
    path.exit().remove();
    path.enter()
      .append("path")
      .attr("class", function() {
        return "seispath "+segA.codes()+" orient"+segA.chanCode().charAt(2)+"_"+segB.chanCode().charAt(2);
      })
    .attr("d", d3.line().curve(d3.curveLinear)
      .x(d => mythis.xScale(d))
      .y((d,i) => mythis.yScale(segB.yAtIndex(i))));
  }

  drawAxis(svgG: any) {
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
    this.setTitle(this.title);
    this.setXLabel(this.xLabel);
    this.setXSublabel(this.xSublabel);
    this.setYLabel(this.yLabel);
    this.setYSublabel(this.ySublabel);
    return this;
  }

  rescaleAxis() {
    let delay = 500;
    this.g.select(".axis--y").transition().duration(delay/2).call(this.yAxis);
    this.g.select(".axis--x").transition().duration(delay/2).call(this.xAxis);
    return this;
}

  calcScaleDomain() {
    let minMax = findMinMax(this.segments[0]);
    this.xScale.domain(minMax).nice();
    let niceMinMax = this.xScale.domain();
    this.xScaleRmean.domain([ (niceMinMax[0]-niceMinMax[1])/2, (niceMinMax[1]-niceMinMax[0])/2 ]);
    minMax = findMinMax(this.segments[1]);
    this.yScale.domain(minMax).nice();
    niceMinMax = this.yScale.domain();
    this.yScaleRmean.domain([ (niceMinMax[0]-niceMinMax[1])/2, (niceMinMax[1]-niceMinMax[0])/2 ]);
    this.rescaleAxis();
    return this;
  }

  setWidthHeight(nOuterWidth: number, nOuterHeight: number) {
    this.outerWidth = nOuterWidth ? Math.max(100, nOuterWidth) : 100;
    this.outerHeight = nOuterHeight ? Math.max(100, nOuterHeight) : 100;
    this.height = this.outerHeight - this.margin.top - this.margin.bottom;
    this.width = this.outerWidth - this.margin.left - this.margin.right;
    this.svg.attr("viewBox", "0 0 "+this.outerWidth+" "+this.outerHeight);
    this.xScale.range([0, this.width]);
    this.yScale.range([this.height, 0]);
    this.xScaleRmean.range([this.width, 0]);
    this.yScaleRmean.range([this.height, 0]);
    return this;
  }
  /** Sets the title as simple string or array of strings. If an array
  then each item will be in a separate tspan for easier formatting.
  */
  setTitle(value: string) {
    this.title = value;
    this.svg.selectAll("g.title").remove();
    let titleSVGText = this.svg.append("g")
       .classed("title", true)
       .attr("transform", "translate("+(this.margin.left+(this.width)/2)+", "+( this.margin.bottom/3  )+")")
       .append("text").classed("title label", true)
       .attr("text-anchor", "middle");
    if (Array.isArray(value)) {
      value.forEach(function(s) {
        titleSVGText.append("tspan").text(s+" ");
      });
    } else {
      titleSVGText
        .text(this.title);
    }
    return this;
  }
  setXLabel(value: string) {
    if (!arguments.length)
      return this.xLabel;
    this.xLabel = value;
    this.svg.selectAll("g.xLabel").remove();
    if (this.width && this.outerWidth) {
    this.svg.append("g")
       .classed("xLabel", true)
       .attr("transform", "translate("+(this.margin.left+(this.width)/2)+", "+(this.outerHeight - this.margin.bottom/3  )+")")
       .append("text").classed("x label", true)
       .attr("text-anchor", "middle")
       .text(this.xLabel);
    }
    return this;
  }
  setYLabel(value: string) {
    if (!arguments.length)
      return this.yLabel;
    this.yLabel = value;
    this.svg.selectAll('g.yLabel').remove();
    if (this.height) {
      this.svg.append("g")
       .classed("yLabel", true)
       .attr("x", 0)
       .attr("transform", "translate(0, "+(this.margin.top+(this.height)/2)+")")
       .append("text")
       .classed("y label", true)
       .attr("text-anchor", "middle")
       .attr("dy", ".75em")
       .attr("transform-origin", "center center")
       .attr("transform", "rotate(-90)")
       .text(this.yLabel);
     }
    return this;
  }
  setXSublabel(value: string) {
    if (!arguments.length)
      return this.xSublabel;
    this.xSublabel = value;
    this.svg.selectAll('g.xSublabel').remove();
    this.svg.append("g")
       .classed("xSublabel", true)
       .attr("transform", "translate("+(this.margin.left+(this.width)/2)+", "+(this.outerHeight  )+")")
       .append("text").classed("x label sublabel", true)
       .attr("text-anchor", "middle")
       .text(this.xSublabel);
    return this;
  }
  setYSublabel(value: string)  {
    this.ySublabel = value;
    this.svg.selectAll('g.ySublabel').remove();

    this.svg.append("g")
       .classed("ySublabel", true)
       .attr("x", 0)
       .attr("transform", "translate( "+this.ySublabelTrans+" , "+(this.margin.top+(this.height)/2)+")")
       .append("text")
       .classed("y label sublabel", true)
       .attr("text-anchor", "middle")
       .attr("dy", ".75em")
       .attr("transform-origin", "center center")
       .attr("transform", "rotate(-90)")
       .text(this.ySublabel);
    return this;
  }
}
// static ID for particle motion
ParticleMotion._lastID = 0;
