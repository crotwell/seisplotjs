// @flow

import {
    d3,
    miniseed,
    createPlotsBySelectorPromise,
    findStartEnd,
    findMinMax
  } from './util';

import type { PlotDataType } from './util';
import type { TimeRangeType } from './chooser';
import * as model from '../model/index';
import { Seismogram, Trace } from '../model/seismogram';
import { CanvasSeismograph } from './canvasSeismograph';
import { SeismographConfig } from './seismographconfig';

const moment = miniseed.model.moment;

export class Helicorder {
  seismographArray: Array<CanvasSeismograph>;
  secondsPerLine: number;
  svgParent: any;
  heliConfig: HelicorderConfig;
  trace: Trace;
  xScaleArray: any;
  yScale: any;
  plotStartDate :moment;
  plotEndDate :moment;
  constructor(inSvgParent :any,
              heliConfig: HelicorderConfig,
              trace: Trace,
              plotStartDate :moment, plotEndDate :moment) {
    this.seismographArray = [];
    this.svgParent = inSvgParent;
    this.heliConfig = heliConfig;
    this.secondsPerLine = 7200;
    this.plotStartDate = plotStartDate;
    this.plotEndDate = plotEndDate;
    this.trace = trace;
  }
  draw() {
    let start = moment.utc(this.plotStartDate);
    this.seismographArray = new Array();
    let minmax = findMinMax(this.trace.segments);
    let lineTimes = this.calcTimesForLines(start, this.secondsPerLine, this.heliConfig.numLines);
  //  while (start.isBefore(this.plotEndDate)) {
  //    let lineTime = lineTimes[0]; // temp, wrong, just for height
  //    let end = moment.utc(start).add(this.secondsPerLine, 'seconds');
    for(let lineTime of lineTimes) {
      let start = lineTime.start;
      let end = lineTime.end;
      let seisDiv = this.svgParent.append('div');
      let nl = this.heliConfig.numLines;
      let height = this.heliConfig.maxHeight*(1/nl+this.heliConfig.overlap/(nl-2));
      let marginTop = lineTime.lineNumber==0?0:Math.round(-1.0*this.heliConfig.maxHeight*this.heliConfig.overlap/(nl-2));
      console.log(`line ${lineTime.lineNumber} height: ${height}  marginTop: ${marginTop}`);
      seisDiv.classed('heliLine', true)
        .style('height', height+'px')
        .style('margin-top', `${marginTop}px`);
      let lineSeisConfig = this.heliConfig.lineSeisConfig.clone();
      lineSeisConfig.yLabel = `${start.format("HH.mm")}`;
      lineSeisConfig.lineColors = [ seisDiv.style("color")];

      let seismograph = new CanvasSeismograph(seisDiv, lineSeisConfig, this.trace, start, end);
      seismograph.disableWheelZoom();
      seismograph.draw();
      this.seismographArray.push(seismograph);
      start = end;
    }
  }
  calcTimesForLines(startTime: moment, secondsPerLine: number, numberOfLines: number) :Array<HeliTimeRangeType> {
    let out = [];
    let s = moment.utc(startTime);
    for (let lineNum=0; lineNum < numberOfLines; lineNum++) {
      let e = moment.utc(s).add(secondsPerLine, 'seconds');
      out.push({
        lineNumber: lineNum,
        start: s,
        duration: moment.duration(secondsPerLine, 'seconds'),
        end: e,
      });
      s = e;
    }
    return out;
  }
  setPlotStartEnd(startTime: moment, endTime: moment) {
    this.plotStartDate = startTime;
    this.plotEndDate = endTime;
    let lineTimes = this.calcTimesForLines(startTime, this.secondsPerLine, 3);
    for(let i=0; i< lineTimes.length; i++) {
      this.seismographArray[i].setPlotStartEnd(lineTimes[i].start, lineTimes[i].end);
      this.seismographArray[i].draw();
    }
  }
}

export class HelicorderConfig extends SeismographConfig {
  lineSeisConfig: SeismographConfig;
  overlap: number;
  numLines: number;
  constructor() {
    super();
    this.maxHeight = 600;
    this.xLabel = '';
    this.yLabel = '';
    this.xSublabel = '';
    this.ySublabel = ' ';
    this.isXAxis = false;
    this.isYAxis = false;
    this.overlap = 0.5;
    this.numLines = 12;
    this.margin.left = 20;

    this.lineSeisConfig = new SeismographConfig();
    this.lineSeisConfig.ySublabel = ` `;
    this.lineSeisConfig.xLabel = ' ';
    this.lineSeisConfig.yLabel = ''// replace later with `${start.format("HH.mm")}`;
    this.lineSeisConfig.isXAxis = false;
    this.lineSeisConfig.isYAxis = false;
    this.lineSeisConfig.margin.top = 2;
    this.lineSeisConfig.margin.bottom = 2;
    this.lineSeisConfig.margin.left = 32;
    this.lineSeisConfig.disableWheelZoom = true;
  }
}

export type HeliTimeRangeType = {
  lineNumber: number,
  duration: number,
  start: moment,
  end: moment
};
