// @flow

/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */

import * as d3 from 'd3';
import moment from 'moment';

import {insertCSS} from './plotutil.js';
import { Seismogram, SeismogramDisplayData } from './seismogram.js';
import type { MarkerType } from './seismogram.js';
import { Seismograph } from './seismograph.js';
import { SeismographConfig } from './seismographconfig';
import {StartEndDuration, isDef} from './util.js';

/**
 * A helicorder-like multi-line seismogram display usually covering 24 hours
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
  maxVariation: number;
  constructor(inSvgParent: any,
              heliConfig: HelicorderConfig,
              seisData: SeismogramDisplayData) {
    this.seismographArray = [];
    this.seisData = seisData;
    this.svgParent = d3.select(inSvgParent).append('div').classed('helicorder', true);
    this.heliConfig = heliConfig;
    this.maxVariation = 1;
    if (seisData.seismogram) {
      const seis = seisData.seismogram; // for flow
      const timeWindow = this.heliConfig.fixedTimeScale;
      // for flow
      if ( ! isDef(timeWindow)){
        throw new Error("Helicorder config must have fixedTimeScale set");
      }
      let cutSeis = seis.cut(timeWindow);
      if (cutSeis) {
        let [min,max] = cutSeis.findMinMax();
        let mean = cutSeis.mean();
        let posOffset = max - mean;
        let negOffset = mean = min;
        this.maxVariation = Math.max(posOffset, negOffset);
      }
    }
  }
  /**
   * draws, or redraws, the helicorder.
   */
  draw() {
    this.drawTitle();
    this.drawSeismograms();
  }
  drawTitle() {
    let titleEl = this.svgParent.append('h3').classed("helicordertitle", true);
    if (Array.isArray(this.heliConfig.title)) {
      this.heliConfig.title.forEach( s => {
        titleEl.append("span").text(s+" ");
      });
    } else {
      titleEl.text(this.heliConfig.title);
    }
  }
  drawSeismograms() {
    if ( ! this.seisData) {
      // no data
      return;
    }
    const timeWindow = this.heliConfig.fixedTimeScale;
    if ( ! isDef(timeWindow)){
      throw new Error("Helicorder config must have fixedTimeScale set");
    }
    let startTime = moment.utc(timeWindow.startTime);
    this.seismographArray = [];
    const secondsPerLine = timeWindow.duration.asSeconds()/this.heliConfig.numLines;

    let lineTimes = this.calcTimesForLines(startTime, secondsPerLine, this.heliConfig.numLines);
    for(let lineTime of lineTimes) {
      let startTime = lineTime.startTime;
      let endTime = lineTime.endTime;
      let nl = this.heliConfig.numLines;
      let height = this.heliConfig.maxHeight/(nl-(nl-1)*this.heliConfig.overlap);
      let marginTop = lineTime.lineNumber===0?0:Math.round(-1.0*height*this.heliConfig.overlap);
      //console.log(`line ${lineTime.lineNumber} height: ${height}  marginTop: ${marginTop}  ${this.heliConfig.overlap}`);

      let seisDiv = this.svgParent.append('div')
        .classed('heliLine', true)
        .style('height', height+'px')
        .style('margin-top', `${marginTop}px`);
      let lineSeisConfig = this.heliConfig.lineSeisConfig.clone();
      lineSeisConfig.fixedTimeScale = lineTime;
      lineSeisConfig.yLabel = `${startTime.format("HH.mm")}`;
      lineSeisConfig.lineColors = [ seisDiv.style("color")];
      lineSeisConfig.minHeight = height;
      lineSeisConfig.maxHeight = height;

      let trimSeisDataList: Array<SeismogramDisplayData> = [  ];
      let lineCutSeis = null;
      if (this.seisData.seismogram) {lineCutSeis = this.seisData.seismogram.cut(lineTime);}
      let lineMean = 0;
      let seisData = this.seisData.clone();
      if (lineCutSeis) {
        seisData.seismogram = lineCutSeis;
        lineMean = lineCutSeis.mean();
      } else {
        seisData.seismogram = null;
      }
      seisData.timeWindow = lineTime;
      trimSeisDataList.push(seisData);

      lineSeisConfig.fixedYScale = [lineMean-this.maxVariation, lineMean+this.maxVariation];
      let seismograph = new Seismograph(seisDiv, lineSeisConfig, trimSeisDataList);
      seismograph.draw();
      seismograph.canvas.style("height", `${height}px`);
      seismograph.svg.style("height", `${height}px`);
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
   * @param  {[type]} startTime      start of display
   * @param  {[type]} secondsPerLine seconds covered by each line
   * @param  {[type]} numberOfLines  number of lines
   * @return Array of HeliTimeRange, one per line
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
  drawMarkers() {
    this.seismographArray.forEach(h => {
      h.seisDataList.forEach(sd => sd.markerList = this.seisData.markerList);
      h.drawMarkers()
    });
  }
}

/**
 * Configuration of the helicorder
 * @param timeWindow the time range covered by the helicorder, required
 */
export class HelicorderConfig extends SeismographConfig {
  lineSeisConfig: SeismographConfig;
  overlap: number;
  numLines: number;
  constructor(timeWindow: StartEndDuration) {
    super();
    if ( ! isDef(timeWindow)){
      throw new Error("Helicorder config must have fixedTimeScale set");
    }
    this.fixedTimeScale = timeWindow;
    this.maxHeight = 600;
    this.xLabel = '';
    this.yLabel = '';
    this.xSublabel = '';
    this.ySublabel = ' ';
    this.ySublabelIsUnits = false;
    this.isXAxis = false;
    this.isYAxis = false;
    this.overlap = 0.5;
    this.numLines = 12;
    this.margin.left = 20;

    this.lineSeisConfig = new SeismographConfig();
    this.lineSeisConfig.ySublabel = ` `;
    this.lineSeisConfig.xLabel = ' ';
    this.lineSeisConfig.yLabel = '';// replace later with `${startTime.format("HH.mm")}`;
    this.lineSeisConfig.yLabelOrientation = 'horizontal';
    this.lineSeisConfig.ySublabelIsUnits = false;
    this.lineSeisConfig.isXAxis = false;
    this.lineSeisConfig.isYAxis = false;
    this.lineSeisConfig.margin.top = 2;
    this.lineSeisConfig.margin.bottom = 2;
    this.lineSeisConfig.margin.left = 37;
    this.lineSeisConfig.wheelZoom = false;
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

export const helicorder_css = `

div.heliLine {
  height: 100px;
  margin-top: -50px;
  color: black;
}

div.helicorder div.heliLine .yLabel text {
  font-size: smaller;
}

div.helicorder div.heliLine:first-child {
  margin-top: 0;
}

div.helicorder div.heliLine:nth-child(3n+1) {
  color: skyblue;
}
div.helicorder div.heliLine:nth-child(3n+2) {
  color: olivedrab;
}
div.helicorder div.heliLine:nth-child(3n) {
  color: goldenrod;
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

h3.helicordertitle {
  text-align: center;
}
`;

if (document){
  insertCSS(helicorder_css);
}
