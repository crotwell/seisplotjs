// @flow

/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */

import * as d3 from 'd3';
import moment from 'moment';

import {insertCSS} from './cssutil.js';
import { SeismogramDisplayData } from './seismogram.js';
import { Seismograph } from './seismograph.js';
import { SeismographConfig } from './seismographconfig';
import {StartEndDuration, isDef} from './util.js';

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
  constructor(inSvgParent: any,
              heliConfig: HelicorderConfig,
              seisData: SeismogramDisplayData) {
    this.seismographArray = [];
    this.seisData = seisData;

    if (typeof inSvgParent === 'string') {
      this.svgParent = d3.select(inSvgParent);
    } else {
      this.svgParent = inSvgParent;
    }
    this.svgParent = this.svgParent.append('div').classed('helicorder', true);
    this.heliConfig = heliConfig;
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
    if ( ! this.seisData) {
      // no data
      return;
    }

    const timeWindow = this.heliConfig.fixedTimeScale;
    if ( ! isDef(timeWindow)){
      throw new Error("Helicorder config must have fixedTimeScale set");
    }
    let maxVariation = 1;
    if (this.seisData.seismogram) {
      const seis = this.seisData.seismogram; // for flow
      if ( ! this.heliConfig.fixedYScale) {
        if ( this.heliConfig.maxVariation === 0) {
          let cutSeis = seis.cut(timeWindow);
          if (cutSeis) {
            let [min,max] = cutSeis.findMinMax();
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

    let startTime = moment.utc(timeWindow.startTime);
    this.seismographArray = [];
    const secondsPerLine = timeWindow.duration.asSeconds()/this.heliConfig.numLines;
    this.svgParent.selectAll("div.heliLine").remove();
    let lineTimes = this.calcTimesForLines(startTime, secondsPerLine, this.heliConfig.numLines);
    const margin = this.heliConfig.margin;
    const nl = this.heliConfig.numLines;
    const baseHeight = (this.heliConfig.maxHeight-margin.top-margin.bottom) /
                       (nl-(nl-1)*this.heliConfig.overlap) ;
    for(let lineTime of lineTimes) {
      let startTime = lineTime.startTime;
      let endTime = lineTime.endTime;
      let height = baseHeight;
      let marginTop = lineTime.lineNumber===0?0:Math.round(-1.0*height*this.heliConfig.overlap);

      let lineSeisConfig = this.heliConfig.lineSeisConfig.clone();
      if (lineTime.lineNumber===0) {
        lineSeisConfig.title = this.heliConfig.title;
        lineSeisConfig.isXAxisTop = this.heliConfig.isXAxisTop;
        lineSeisConfig.margin.top += this.heliConfig.margin.top;
        height += this.heliConfig.margin.top;
      } else if (lineTime.lineNumber === nl-1) {
        lineSeisConfig.isXAxis = this.heliConfig.isXAxis;
        lineSeisConfig.margin.bottom += this.heliConfig.margin.bottom;
        height += this.heliConfig.margin.bottom;
      }
      let seisDiv = this.svgParent.append('div')
        .classed('heliLine', true)
        .style('height', height+'px')
        .style('margin-top', marginTop+'px');
      lineSeisConfig.fixedTimeScale = lineTime;
      lineSeisConfig.yLabel = `${startTime.format("HH:mm")}`;
      lineSeisConfig.yLabelRight = `${endTime.format("HH:mm")}`;
      lineSeisConfig.lineColors = [ seisDiv.style("color")];

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
      lineSeisData.timeWindow = lineTime;

      if (this.heliConfig.fixedYScale) {
        lineSeisConfig.fixedYScale = this.heliConfig.fixedYScale;
      } else {
        if (this.heliConfig.doRMean) {
          lineSeisConfig.fixedYScale = [lineMean-maxVariation, lineMean+maxVariation];
        } else {
          lineSeisConfig.fixedYScale = [lineMean-maxVariation, lineMean+maxVariation];
        }
      }
      let seismograph = new Seismograph(seisDiv, lineSeisConfig, lineSeisData);
      seismograph.draw();
      if (lineTime.lineNumber===0) {
        // add UTC to top left
        seismograph.svg.append("g")
        .classed("yLabel", true)
        .classed("utcLabel", true)
        .append("text")
        .attr("x", 0).attr("y",0)
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
  calcTimesForLines(startTime: moment, secondsPerLine: number, numberOfLines: number): Array<HeliTimeRange> {
    let out = [];
    let s = moment.utc(startTime);
    for (let lineNum=0; lineNum < numberOfLines; lineNum++) {
      let startEnd = new HeliTimeRange(s, null, secondsPerLine);
      startEnd.lineNumber = lineNum;
      out.push(startEnd);
      s = moment.utc(startEnd.endTime);
    }
    return out;
  }
}

/**
 * Configuration of the helicorder
 *
 * @param timeWindow the time range covered by the helicorder, required
 */
export class HelicorderConfig extends SeismographConfig {
  lineSeisConfig: SeismographConfig;
  overlap: number;
  numLines: number;
  maxVariation: number;
  constructor(timeWindow: StartEndDuration) {
    super();
    if ( ! isDef(timeWindow)){
      throw new Error("Helicorder config must have fixedTimeScale set");
    }
    this.fixedTimeScale = timeWindow;
    this.maxVariation = 0;
    this.maxHeight = 600;
    this.xLabel = '';
    this.yLabel = '';
    this.xSublabel = '';
    this.ySublabel = ' ';
    this.ySublabelIsUnits = false;
    this.isXAxis = true;
    this.isXAxisTop = true;
    this.isYAxis = false;
    this.overlap = 0.5;
    this.numLines = 12;
    this.margin.left = 20;
    this.margin.right = 20;
    this.margin.top = 40;

    this.lineSeisConfig = new SeismographConfig();
    this.lineSeisConfig.ySublabel = ` `;
    this.lineSeisConfig.xLabel = ' ';
    this.lineSeisConfig.yLabel = '';// replace later with `${startTime.format("HH:mm")}`;
    this.lineSeisConfig.yLabelOrientation = 'horizontal';
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
  constructor(startTime: moment | null, endTime: moment | null, duration: number | null =null, clockOffset?: number | null =0) {
    super(startTime, endTime, duration, clockOffset);
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

if (document){
  insertCSS(helicorder_css);
}
