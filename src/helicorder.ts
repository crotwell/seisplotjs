/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */
import * as d3 from "d3";
import {DateTime, Duration} from "luxon";
import {insertCSS, isCSSInserted} from "./cssutil";
import {SeismogramDisplayData} from "./seismogram";
import {Seismograph} from "./seismograph";
import {SeismographConfig} from "./seismographconfig";
import {StartEndDuration, isDef} from "./util";

/**
 * A helicorder-like multi-line seismogram display usually covering 24 hours
 *
 * @param inSvgParent the parent element, usually a div tag
 * @param heliConfig configuration object
 * @param seisData the data to display
 */
export class Helicorder {
  seismographArray: Array<Seismograph>;
  svgParent: any;
  heliConfig: HelicorderConfig;
  seisData: SeismogramDisplayData;
  xScaleArray: any;
  yScale: any;

  constructor(
    inSvgParent: any,
    heliConfig: HelicorderConfig,
    seisData: SeismogramDisplayData,
  ) {
    this.seismographArray = [];
    this.seisData = seisData;

    if (typeof inSvgParent === "string") {
      this.svgParent = d3.select(inSvgParent);
    } else {
      this.svgParent = inSvgParent;
    }

    this.svgParent = this.svgParent
      .append("div")
      .classed(HELICORDER_SELECTOR, true);
    this.heliConfig = heliConfig;

    if (!isCSSInserted(HELI_COLOR_CSS_ID)) {
      insertCSS(
        this.heliConfig.createCSSForLineColors(HELICORDER_SELECTOR),
        HELI_COLOR_CSS_ID,
      );
    }
  }

  /**
   * draws, or redraws, the helicorder.
   */
  draw() {
    this.heliConfig.lineSeisConfig.doRMean = this.heliConfig.doRMean;
    this.drawSeismograms();
  }

  /**
   * draws or redraws the seismograms in the helicorder
   *
   * @private
   */
  drawSeismograms(): void {
    if (!this.seisData) {
      // no data
      return;
    }

    const timeRange = this.heliConfig.fixedTimeScale;

    if (!isDef(timeRange)) {
      throw new Error("Helicorder config must have fixedTimeScale set");
    }

    let maxVariation = 1;

    if (this.seisData.seismogram) {
      const seis = this.seisData.seismogram; // for flow

      if (!this.heliConfig.fixedYScale) {
        if (this.heliConfig.maxVariation === 0) {
          let cutSeis = seis.cut(timeRange);

          if (cutSeis) {
            let [min, max] = cutSeis.findMinMax();
            let mean = cutSeis.mean();
            let posOffset = max - mean;
            let negOffset = mean - min;
            maxVariation = Math.max(posOffset, negOffset);
          }
        } else {
          maxVariation = this.heliConfig.maxVariation;
        }
      }
    }

    let startTime = timeRange.startTime;
    this.seismographArray = [];
    const secondsPerLine =
      timeRange.duration.toMillis() / 1000 / this.heliConfig.numLines;
    this.svgParent.selectAll("div.heliLine").remove();
    let lineTimes = this.calcTimesForLines(
      startTime,
      secondsPerLine,
      this.heliConfig.numLines,
    );
    const margin = this.heliConfig.margin;
    const nl = this.heliConfig.numLines;
    // for flow
    const maxHeight =
      this.heliConfig.maxHeight !== null
        ? this.heliConfig.maxHeight
        : DEFAULT_MAX_HEIGHT;
    const baseHeight =
      (maxHeight - margin.top - margin.bottom) /
      (nl - (nl - 1) * this.heliConfig.overlap);

    for (let lineTime of lineTimes) {
      let startTime = lineTime.startTime;
      let endTime = lineTime.endTime;
      let height = baseHeight;
      let marginTop =
        lineTime.lineNumber === 0
          ? 0
          : Math.round(-1.0 * height * this.heliConfig.overlap);
      let lineSeisConfig = this.heliConfig.lineSeisConfig.clone();
      // don't title lines past the first
      lineSeisConfig.title = null;

      if (lineTime.lineNumber === 0) {
        lineSeisConfig.title = this.heliConfig.title;
        lineSeisConfig.isXAxisTop = this.heliConfig.isXAxisTop;
        lineSeisConfig.margin.top += this.heliConfig.margin.top;
        height += this.heliConfig.margin.top;
      } else if (lineTime.lineNumber === nl - 1) {
        lineSeisConfig.isXAxis = this.heliConfig.isXAxis;
        lineSeisConfig.margin.bottom += this.heliConfig.margin.bottom;
        height += this.heliConfig.margin.bottom;
      }

      let seisDiv = this.svgParent
        .append("div")
        .classed("heliLine", true)
        .style("height", height + "px")
        .style("margin-top", marginTop + "px");
      lineSeisConfig.fixedTimeScale = lineTime;
      lineSeisConfig.yLabel = `${startTime.toFormat("HH:mm")}`;
      lineSeisConfig.yLabelRight = `${endTime.toFormat("HH:mm")}`;
      lineSeisConfig.lineColors = [
        this.heliConfig.lineColors[
          lineTime.lineNumber % this.heliConfig.lineColors.length
        ],
      ];
      //      [ seisDiv.style("color")];
      let lineCutSeis = null;
      let lineSeisData;
      let lineMean = 0;

      if (this.seisData.seismogram) {
        lineCutSeis = this.seisData.seismogram.cut(lineTime);
        lineSeisData = this.seisData.cloneWithNewSeismogram(lineCutSeis);
        lineMean = lineSeisData.mean;
      } else {
        // no data in window, but keep seisData in case of markers, etc
        lineSeisData = this.seisData.clone();
      }

      lineSeisData.timeRange = lineTime;

      if (this.heliConfig.fixedYScale) {
        lineSeisConfig.fixedYScale = this.heliConfig.fixedYScale;
      } else {
        if (this.heliConfig.doRMean) {
          lineSeisConfig.fixedYScale = [
            lineMean - maxVariation,
            lineMean + maxVariation,
          ];
        } else {
          lineSeisConfig.fixedYScale = [
            lineMean - maxVariation,
            lineMean + maxVariation,
          ];
        }
      }

      let seismograph = new Seismograph();
      seismograph.seismographConfig = lineSeisConfig;
      seismograph.appendSeisData(lineSeisData);
      seismograph.svg.classed(HELICORDER_SELECTOR, true);
      seisDiv.node().appendChild(seismograph);

      if (lineTime.lineNumber === 0) {
        // add UTC to top left
        seismograph.svg
          .append("g")
          .classed("yLabel", true)
          .classed("utcLabel", true)
          .append("text")
          .attr("x", 0)
          .attr("y", 0)
          .attr("text-anchor", "start")
          .attr("dy", ".75em")
          .text("UTC");
      }

      this.seismographArray.push(seismograph);
      startTime = endTime;
    }
  }

  /**
   * Calculates the time range covered by each line of the display
   *
   * @param   startTime      start of display
   * @param   secondsPerLine seconds covered by each line
   * @param   numberOfLines  number of lines
   * @returns Array of HeliTimeRange, one per line
   */
  calcTimesForLines(
    startTime: DateTime,
    secondsPerLine: number,
    numberOfLines: number,
  ): Array<HeliTimeRange> {
    let out = [];
    let s = startTime;

    for (let lineNum = 0; lineNum < numberOfLines; lineNum++) {
      let startEnd = new HeliTimeRange(s, null, secondsPerLine);
      startEnd.lineNumber = lineNum;
      out.push(startEnd);
      s = startEnd.endTime;
    }

    return out;
  }
}
export const DEFAULT_MAX_HEIGHT = 600;

/**
 * Configuration of the helicorder
 *
 * @param timeRange the time range covered by the helicorder, required
 */
export class HelicorderConfig extends SeismographConfig {
  lineSeisConfig: SeismographConfig;
  overlap: number;
  numLines: number;
  maxVariation: number;

  constructor(timeRange: StartEndDuration) {
    super();

    if (!isDef(timeRange)) {
      throw new Error("Helicorder config must have fixedTimeScale set");
    }

    this.fixedTimeScale = timeRange;
    this.maxVariation = 0;
    this.maxHeight = DEFAULT_MAX_HEIGHT;
    this.xLabel = "";
    this.yLabel = "";
    this.xSublabel = "";
    this.ySublabel = " ";
    this.ySublabelIsUnits = false;
    this.isXAxis = true;
    this.isXAxisTop = true;
    this.isYAxis = false;
    this.overlap = 0.5;
    this.numLines = 12;
    this.margin.left = 20;
    this.margin.right = 20;
    this.margin.top = 40;
    this.lineColors = ["skyblue", "olivedrab", "goldenrod"];
    this.lineSeisConfig = new SeismographConfig();
    this.lineSeisConfig.ySublabel = ` `;
    this.lineSeisConfig.xLabel = " ";
    this.lineSeisConfig.yLabel = ""; // replace later with `${startTime.toFormat("HH:mm")}`;

    this.lineSeisConfig.yLabelOrientation = "horizontal";
    this.lineSeisConfig.ySublabelIsUnits = false;
    this.lineSeisConfig.isXAxis = false;
    this.lineSeisConfig.isYAxis = false;
    this.lineSeisConfig.margin.top = 0;
    this.lineSeisConfig.margin.bottom = 0;
    this.lineSeisConfig.margin.left = 37;
    this.lineSeisConfig.margin.right = 37;
    this.lineSeisConfig.wheelZoom = false;
    this.lineSeisConfig.doRMean = true;
  }
}

/**
 * Time range for a single line of the helicorder, extends StartEndDuration
 * to add the line number
 */
export class HeliTimeRange extends StartEndDuration {
  lineNumber: number;

  constructor(
    startTime: DateTime | null,
    endTime: DateTime | null,
    duration: number | null = null,
    clockOffset: number | null = 0,
  ) {
    super(startTime, endTime, duration, clockOffset);
    this.lineNumber = 0;
  }
}

/** default styling for helicorder plots. */
export const helicorder_css = `

div.helicorder {
  height: 100%;
  width: 100%;
}

div.helicorder div.heliLine .yLabel text {
  font-size: smaller;
}

div.helicorder div.heliLine:nth-child(3n+1) {
  color: skyblue;
}
div.helicorder div.heliLine:nth-child(3n+1) path.seispath {
  stroke: skyblue;
}
div.helicorder div.heliLine:nth-child(3n+2) {
  color: olivedrab;
}
div.helicorder div.heliLine:nth-child(3n+2) path.seispath {
  stroke: olivedrab;
}
div.helicorder div.heliLine:nth-child(3n) {
  color: goldenrod;
}
div.helicorder div.heliLine:nth-child(3n) path.seispath {
  stroke: goldenrod;
}
div.helicorder div.heliLine:nth-child(3n+1) .yLabel text {
  fill: skyblue;
}
div.helicorder div.heliLine:nth-child(3n+2) .yLabel text {
  fill: olivedrab;
}
div.helicorder div.heliLine:nth-child(3n) .yLabel text {
  fill: goldenrod;
}

`;
export const HELICORDER_SELECTOR = "helicorder";
export const HELI_COLOR_CSS_ID = "helicordercolors";

if (document) {
  insertCSS(helicorder_css, "helicorder");
}
