/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */
import * as d3 from "d3";
import {insertCSS} from "./cssutil";
import {SeismographConfig, numberFormatWrapper } from "./seismographconfig";
import {
  SeismogramSegment,
  Seismogram,
  SeismogramDisplayData,
} from "./seismogram";
import {isDef, isNumArg, StartEndDuration} from "./util";
import {drawAxisLabels} from "./axisutil";
export const DEFAULT_TITLE =
  "<tspan>{{#each seisDataList}}{{onlyChangesChannel ../seisDataList @index}} {{else}}No Data{{/each}}</tspan>";
export const DEFAULT_XLABEL = "{{seisXData.channelCode}}";
export const DEFAULT_YLABEL = "{{seisYData.channelCode}}";

export function addDivForParticleMotion(
  svgParent: any,
  xSeisData: SeismogramDisplayData,
  ySeisData: SeismogramDisplayData,
  timeRange?: StartEndDuration,
): ParticleMotion {
  let svgDiv = svgParent.append("div");

  if (!isDef(xSeisData)) {
    throw new Error("xSeisData cannot be null");
  }

  if (!isDef(ySeisData)) {
    throw new Error("ySeisData cannot be null");
  }

  svgDiv.classed(xSeisData.channelCode, true);
  svgDiv.classed(ySeisData.channelCode, true);
  svgDiv.classed("particleMotionContainer", true);
  return addParticleMotion(svgDiv, xSeisData, ySeisData, timeRange);
}
export function addParticleMotion(
  svgParent: any,
  xSeisData: SeismogramDisplayData,
  ySeisData: SeismogramDisplayData,
  timeRange?: StartEndDuration,
): ParticleMotion {
  if (!isDef(xSeisData.seismogram) || !isDef(ySeisData.seismogram)) {
    throw new Error(
      `Seismogram has no data: ${xSeisData.seismogram} ${ySeisData.seismogram}`,
    );
  }

  let seisConfig = createParticleMotionConfig(timeRange);
  let pmp = new ParticleMotion(svgParent, seisConfig, xSeisData, ySeisData);
  pmp.draw();
  return pmp;
}
export function createParticleMotionConfig(
  timeRange?: StartEndDuration,
): SeismographConfig {
  let seisConfig = new SeismographConfig();
  seisConfig.title = DEFAULT_TITLE;

  if (isDef(timeRange)) {
    seisConfig.fixedTimeScale = timeRange;
  }

  seisConfig.xLabel = DEFAULT_XLABEL;
  seisConfig.yLabel = DEFAULT_YLABEL;
  seisConfig.margin.top = 40;
  seisConfig.margin.bottom = 40;
  seisConfig.margin.right = 40;
  seisConfig.margin.left = 40;
  return seisConfig;
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
  timeRange: StartEndDuration;
  width: number;
  height: number;
  outerWidth: number = -1;
  outerHeight: number = -1;
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

  constructor(
    inSvgParent: any,
    seismographConfig: SeismographConfig,
    xSeisData: SeismogramDisplayData | Seismogram,
    ySeisData: SeismogramDisplayData | Seismogram,
  ) {
    if (!isDef(inSvgParent)) {
      throw new Error("inSvgParent cannot be null");
    }

    if (!isDef(xSeisData)) {
      throw new Error("xSeisData cannot be null");
    }

    if (!isDef(ySeisData)) {
      throw new Error("ySeisData cannot be null");
    }

    this.plotId = ++ParticleMotion._lastID;

    if (xSeisData instanceof Seismogram) {
      this.xSeisData = SeismogramDisplayData.fromSeismogram(xSeisData);
    } else if (xSeisData instanceof SeismogramDisplayData) {
      this.xSeisData = xSeisData;
    } else {
      throw new Error("xSeisData must be Seismogram or SeismogramDisplayData");
    }

    if (ySeisData instanceof Seismogram) {
      this.ySeisData = SeismogramDisplayData.fromSeismogram(ySeisData);
    } else if (ySeisData instanceof SeismogramDisplayData) {
      this.ySeisData = ySeisData;
    } else {
      throw new Error("ySeisData must be Seismogram or SeismogramDisplayData");
    }

    if (isDef(seismographConfig)) {
      this.seismographConfig = seismographConfig;
    } else {
      this.seismographConfig = createParticleMotionConfig();
      this.seismographConfig.xLabel = this.xSeisData.channelCode;
      this.seismographConfig.yLabel = this.ySeisData.channelCode;
    }

    this.timeRange = this.calcTimeWindow();
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

    if (this.seismographConfig.doRMean) {
      this.xAxis = d3
        .axisBottom(this.xScaleRmean)
        .tickFormat(numberFormatWrapper(this.seismographConfig.amplitudeFormat));
      this.yAxis = d3
        .axisLeft(this.yScaleRmean)
        .tickFormat(numberFormatWrapper(this.seismographConfig.amplitudeFormat));
    } else {
      this.xAxis = d3
        .axisBottom(this.xScale)
        .tickFormat(numberFormatWrapper(this.seismographConfig.amplitudeFormat));
      this.yAxis = d3
        .axisLeft(this.yScale)
        .tickFormat(numberFormatWrapper(this.seismographConfig.amplitudeFormat));
    }

    this.width = 100;
    this.height = 100;
    let mythis = this;
    // for line ends to show direction of particle motion
    const arrow = this.svg.append("defs").append("marker");
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
    this.g = this.svg
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
    d3.select(window).on("resize.particleMotion" + this.plotId, function () {
      if (mythis.checkResize()) {
        mythis.draw();
      }
    });
  }

  draw() {
    this.checkResize();
    this.drawAxis();
    let handlebarsInput = {
      seisDataList: [this.xSeisData, this.ySeisData],
      seisXData: this.xSeisData,
      seisYData: this.ySeisData,
      seisConfig: this.seismographConfig,
    };
    drawAxisLabels(
      this.svg,
      this.seismographConfig,
      this.height,
      this.width,
      handlebarsInput,
    );
    this.drawParticleMotion();
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
    lineG
      .classed("particleMotion", true)
      .classed("seisplotjsdata", true)
      .classed("seispath", true)
      .classed(this.xSeisData.codes(), true)
      .classed(
        "orient" +
          this.xSeisData.channelCode.charAt(2) +
          "_" +
          this.ySeisData.channelCode.charAt(2),
        true,
      );
    let xSegments = this.xSeisData.seismogram
      ? this.xSeisData.seismogram.segments
      : [];
    let ySegments = this.ySeisData.seismogram
      ? this.ySeisData.seismogram.segments
      : [];
    xSegments.forEach(segX => {
      ySegments.forEach(segY => {
        this.drawParticleMotionForSegment(lineG, segX, segY);
      });
    });
  }

  drawParticleMotionForSegment(
    lineG: any,
    segA: SeismogramSegment,
    segB: SeismogramSegment,
  ) {
    const mythis = this;
    const timeRange = segA.timeRange.intersect(segB.timeRange);

    if (!isDef(timeRange)) {
      // no overlap
      return;
    }

    const idxA = segA.indexOfTime(timeRange.startTime);
    const lastIdxA = segA.indexOfTime(timeRange.endTime);
    const idxB = segB.indexOfTime(timeRange.startTime);
    const lastIdxB = segB.indexOfTime(timeRange.endTime);

    if (idxA === -1 || lastIdxA === -1 || idxB === -1 || lastIdxB === -1) {
      return;
    }

    const numPts = Math.min(lastIdxA - idxA, lastIdxB - idxB) + 1;
    let segmentG = lineG.append("g").classed("segment", true);
    let path = segmentG.selectAll("path").data([segA.y.slice(idxA, numPts)]);
    path.exit().remove();
    path
      .enter()
      .append("path")
      .classed("seispath", true)
      .attr("marker-end", "url(#arrow)")
      .attr(
        "d",
        d3
          .line()
          .curve(d3.curveLinear)
          .x(d => mythis.xScale(d))
          .y((d, i) => mythis.yScale(segB.yAtIndex(idxB + i))),
      );
  }

  drawAxis() {
    let svgG = this.g;
    svgG.selectAll("g.axis").remove();
    svgG
      .append("g")
      .attr("class", "axis axis--x")
      .attr("transform", "translate(0," + this.height + ")")
      .call(this.xAxis);
    svgG.append("g").attr("class", "axis axis--y").call(this.yAxis);
  }

  drawAxisLabels() {
    this.drawTitle();
    this.drawXLabel();
    this.drawXSublabel();
    this.drawYLabel();
    this.drawYSublabel();
  }

  rescaleAxis() {
    let delay = 500;
    this.g
      .select(".axis--y")
      .transition()
      .duration(delay / 2)
      .call(this.yAxis);
    this.g
      .select(".axis--x")
      .transition()
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
      let xMinMax = [this.xSeisData.min, this.xSeisData.max];
      let yMinMax = [this.ySeisData.min, this.ySeisData.max];
      halfDomainDelta = (xMinMax[1] - xMinMax[0]) / 2;

      if (yMinMax[1] - yMinMax[0] > xMinMax[1] - xMinMax[0]) {
        halfDomainDelta = (yMinMax[1] - yMinMax[0]) / 2;
      }

      let xMid = (xMinMax[1] + xMinMax[0]) / 2;
      let yMid = (yMinMax[1] + yMinMax[0]) / 2;
      xMinMax = [xMid - halfDomainDelta, xMid + halfDomainDelta];
      yMinMax = [yMid - halfDomainDelta, yMid + halfDomainDelta];
      this.xScale.domain(xMinMax).nice();
      this.yScale.domain(yMinMax).nice();
    }

    let xNiceMinMax = this.xScale.domain();
    let xHalfNice = (xNiceMinMax[1] - xNiceMinMax[0]) / 2;
    this.xScaleRmean.domain([-1 * xHalfNice, xHalfNice]);
    let yNiceMinMax = this.yScale.domain();
    let yHalfNice = (yNiceMinMax[1] - yNiceMinMax[0]) / 2;
    this.yScaleRmean.domain([-1 * yHalfNice, yHalfNice]);
    this.rescaleAxis();
  }

  calcTimeWindow(): StartEndDuration {
    let tw = null;

    if (this.seismographConfig.fixedTimeScale) {
      tw = this.seismographConfig.fixedTimeScale;
    } else {
      tw = this.xSeisData.timeRange.intersect(this.ySeisData.timeRange);
    }

    if (!tw) {
      // intersection might be null
      throw new Error(
        `Seismograms do not overlap: ${this.xSeisData.timeRange.toString()} ${this.ySeisData.timeRange.toString()}`,
      );
    }

    this.timeRange = tw;
    return tw;
  }

  calcWidthHeight(nOuterWidth: number, nOuterHeight: number) {
    this.outerWidth = nOuterWidth ? Math.max(100, nOuterWidth) : 100;
    this.outerHeight = nOuterHeight ? Math.max(100, nOuterHeight) : 100;
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

  /**
   * Draws the title as simple string or array of strings. If an array
   * then each item will be in a separate tspan for easier formatting.
   *
   * @returns this
   */
  drawTitle(): ParticleMotion {
    this.svg.selectAll("g.title").remove();
    let titleSVGText = this.svg
      .append("g")
      .classed("title", true)
      .attr(
        "transform",
        `translate(${this.seismographConfig.margin.left + this.width / 2}, 0)`,
      )
      .append("text")
      .classed("title label", true)
      .attr("x", 0)
      .attr("y", 2) // give little extra space at top, css style as hanging doesn't quite do it
      .attr("text-anchor", "middle");
    let handlebarOut = this.seismographConfig.handlebarsTitle(
      {
        seisDataList: [this.xSeisData, this.ySeisData],
        seisXData: this.xSeisData,
        seisYData: this.ySeisData,
        seisConfig: this.seismographConfig,
      },
      {
        allowProtoPropertiesByDefault: true, // this might be a security issue???
      },
    );
    titleSVGText.html(handlebarOut);
    return this;
  }

  drawXLabel() {
    this.svg.selectAll("g.xLabel").remove();

    if (isNumArg(this.width) && isNumArg(this.outerWidth)) {
      let svgText = this.svg
        .append("g")
        .classed("xLabel", true)
        .attr(
          "transform",
          "translate(" +
            (this.seismographConfig.margin.left + this.width / 2) +
            ", " +
            (this.outerHeight - this.seismographConfig.margin.bottom / 3) +
            ")",
        )
        .append("text")
        .classed("x label", true)
        .attr("text-anchor", "middle")
        .text(this.seismographConfig.xLabel);
      let handlebarOut = this.seismographConfig.handlebarsXLabel(
        {
          seisDataList: [this.xSeisData, this.ySeisData],
          seisXData: this.xSeisData,
          seisYData: this.ySeisData,
          seisConfig: this.seismographConfig,
        },
        {
          allowProtoPropertiesByDefault: true, // this might be a security issue???
        },
      );
      svgText.html(handlebarOut);
    }
  }

  drawYLabel() {
    this.svg.selectAll("g.yLabel").remove();

    for (let side of ["left", "right"]) {
      let hTranslate =
        side === "left"
          ? 0
          : this.seismographConfig.margin.left + this.width + 1;
      let svgText = this.svg
        .append("g")
        .classed("yLabel", true)
        .classed(side, true)
        .attr("x", 0)
        .attr(
          "transform",
          `translate(${hTranslate}, ${
            this.seismographConfig.margin.top + this.height / 2
          })`,
        )
        .append("text");
      svgText.classed("y label", true);

      if (this.seismographConfig.yLabelOrientation === "vertical") {
        // vertical
        svgText
          .attr("text-anchor", "middle")
          .attr("dy", ".75em")
          .attr("transform", "rotate(-90, 0, 0)");
      } else {
        // horizontal
        svgText
          .attr("text-anchor", "start")
          .attr("dominant-baseline", "central");
      }

      if (side === "left") {
        let handlebarOut = this.seismographConfig.handlebarsYLabel(
          {
            seisDataList: [this.xSeisData, this.ySeisData],
            seisXData: this.xSeisData,
            seisYData: this.ySeisData,
            seisConfig: this.seismographConfig,
          },
          {
            allowProtoPropertiesByDefault: true, // this might be a security issue???
          },
        );
        svgText.html(handlebarOut);
      } else {
        let handlebarOut = this.seismographConfig.handlebarsYLabelRight(
          {
            seisDataList: [this.xSeisData, this.ySeisData],
            seisXData: this.xSeisData,
            seisYData: this.ySeisData,
            seisConfig: this.seismographConfig,
          },
          {
            allowProtoPropertiesByDefault: true, // this might be a security issue???
          },
        );
        svgText.html(handlebarOut);
      }
    }
  }

  drawXSublabel() {
    this.svg.selectAll("g.xSublabel").remove();
    this.svg
      .append("g")
      .classed("xSublabel", true)
      .attr(
        "transform",
        "translate(" +
          (this.seismographConfig.margin.left + this.width / 2) +
          ", " +
          this.outerHeight +
          ")",
      )
      .append("text")
      .classed("x label sublabel", true)
      .attr("text-anchor", "middle")
      .text(this.seismographConfig.xSublabel);
  }

  drawYSublabel() {
    this.svg.selectAll("g.ySublabel").remove();
    let svgText = this.svg
      .append("g")
      .classed("ySublabel", true)
      .attr("x", 0)
      .attr(
        "transform",
        "translate( " +
          this.seismographConfig.ySublabelTrans +
          " , " +
          (this.seismographConfig.margin.top + this.height / 2) +
          ")",
      )
      .append("text")
      .classed("y label sublabel", true);

    if (this.seismographConfig.yLabelOrientation === "vertical") {
      // vertical
      svgText
        .attr("text-anchor", "middle")
        .attr("dy", ".75em")
        .attr("transform", "rotate(-90, 0, 0)");
    } else {
      // horizontal
      svgText.attr("text-anchor", "start").attr("dominant-baseline", "central");
    }

    svgText.text(this.seismographConfig.ySublabel);
  }
}
export const particleMotion_css = `

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

if (document) {
  insertCSS(particleMotion_css, "particlemotion");
}

// static ID for particle motion
ParticleMotion._lastID = 0;
