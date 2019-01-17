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
  seisPlotConfig: SeismographConfig;
  trace: Trace;
  xScaleArray: any;
  yScale: any;
  plotStartDate :moment;
  plotEndDate :moment;
  constructor(inSvgParent :any,
              seisPlotConfig: SeismographConfig,
              trace: Trace,
              plotStartDate :moment, plotEndDate :moment) {
    this.seismographArray = [];
    this.svgParent = inSvgParent;
    this.seisPlotConfig = seisPlotConfig;
    this.secondsPerLine = 7200;
    this.plotStartDate = plotStartDate;
    this.plotEndDate = plotEndDate;
    this.trace = trace;
  }
  draw() {
    let start = moment.utc(this.plotStartDate);
    this.seismographArray = new Array();
    let minmax = findMinMax(this.trace.segments);
    let lineTimes = this.calcTimesForLines(start, this.secondsPerLine, 12);
  //  while (start.isBefore(this.plotEndDate)) {
  //    let lineTime = lineTimes[0]; // temp, wrong, just for height
  //    let end = moment.utc(start).add(this.secondsPerLine, 'seconds');
    for(let lineTime of lineTimes) {
      let start = lineTime.start;
      let end = lineTime.end;
      let seisDiv = this.svgParent.append('div');
      seisDiv.classed('heliLine', true).style('height', this.seisPlotConfig.maxHeight/6+'px');
      let lineSeisConfig = new SeismographConfig();

      lineSeisConfig.ySublabel = ` `;
      lineSeisConfig.xLabel = '';
      lineSeisConfig.yLabel = `${start.format("HH.mm")}`;
      lineSeisConfig.isXAxis = false;
      lineSeisConfig.isYAxis = false;
      lineSeisConfig.margin.top = 2;
      lineSeisConfig.margin.bottom = -22;
      lineSeisConfig.disableWheelZoom = true;

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


export type HeliTimeRangeType = {
  lineNumber: number,
  duration: number,
  start: moment,
  end: moment
};
