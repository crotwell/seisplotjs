// @flow

import moment from 'moment';

import { Seismogram, SeismogramDisplayData } from './seismogram.js';
import type { MarkerType } from './seismogram.js';
import { Seismograph } from './seismograph.js';
import { SeismographConfig } from './seismographconfig';
import {minMaxMean, mean } from './filter.js';
import {StartEndDuration, isDef} from './util.js';


export class Helicorder {
  seismographArray: Array<Seismograph>;
  secondsPerLine: number;
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
    this.svgParent = inSvgParent;
    this.heliConfig = heliConfig;
    let timeWindow = heliConfig.fixedTimeScale;
    if (isDef(timeWindow)){
      this.secondsPerLine = timeWindow.duration.asSeconds()/heliConfig.numLines;
    } else {
      throw new Error("Helicorder config must have fixedTimeScale set");
    }
    this.maxVariation = 1;
    if (seisData.seismogram) {
      let cutSeis = seisData.seismogram.cut(timeWindow);
      if (cutSeis) {
        let minMax = minMaxMean(cutSeis);
        let posOffset = minMax.max - minMax.mean;
        let negOffset = minMax.mean = minMax.min;
        this.maxVariation = Math.max(posOffset, negOffset);
      }
    }
  }
  draw() {
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
    let lineTimes = this.calcTimesForLines(startTime, this.secondsPerLine, this.heliConfig.numLines);
    for(let lineTime of lineTimes) {
      let startTime = lineTime.startTime;
      let endTime = lineTime.endTime;
      let seisDiv = this.svgParent.append('div');
      let nl = this.heliConfig.numLines;
      let height = this.heliConfig.maxHeight/(nl-(nl-1)*this.heliConfig.overlap);
      let marginTop = lineTime.lineNumber===0?0:Math.round(-1.0*height*this.heliConfig.overlap);
      //console.log(`line ${lineTime.lineNumber} height: ${height}  marginTop: ${marginTop}  ${this.heliConfig.overlap}`);
      seisDiv.classed('heliLine', true)
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
      if (lineCutSeis) {
        let seisData = SeismogramDisplayData.fromSeismogram(lineCutSeis);
        seisData.timeWindow = lineTime;
        seisData.addMarkers(this.seisData.markerList);
        seisData.addQuake(this.seisData.quakeList);
        seisData.channel = this.seisData.channel;
        seisData.sensitivity = this.seisData.sensitivity;
        lineMean = mean(lineCutSeis);
        trimSeisDataList.push(seisData);
      }
      lineSeisConfig.fixedYScale = [lineMean-this.maxVariation, lineMean+this.maxVariation];
      let seismograph = new Seismograph(seisDiv, lineSeisConfig, trimSeisDataList);
      seismograph.draw();
      seismograph.canvas.style("height", `${height}px`);
      seismograph.svg.style("height", `${height}px`);

      this.seismographArray.push(seismograph);
      startTime = endTime;
    }
  }
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

export class HelicorderConfig extends SeismographConfig {
  lineSeisConfig: SeismographConfig;
  overlap: number;
  numLines: number;
  constructor(timeWindow: StartEndDuration) {
    super();
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
    this.lineSeisConfig.ySublabelIsUnits = false;
    this.lineSeisConfig.isXAxis = false;
    this.lineSeisConfig.isYAxis = false;
    this.lineSeisConfig.margin.top = 2;
    this.lineSeisConfig.margin.bottom = 2;
    this.lineSeisConfig.margin.left = 32;
    this.lineSeisConfig.wheelZoom = false;
  }
}

export class HeliTimeRange extends StartEndDuration {
  lineNumber: number;
  constructor(startTime: moment | null, endTime: moment | null, duration: number | null =null, clockOffset?: number | null =0) {
    super(startTime, endTime, duration, clockOffset);
  }
}
