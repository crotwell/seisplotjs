// @flow

import moment from 'moment';

import { Seismogram } from './seismogram.js';
import type { MarkerType } from './seismographconfig';
import { Seismograph } from './seismograph.js';
import { SeismographConfig } from './seismographconfig';
import {StartEndDuration} from './util.js';


export class Helicorder {
  seismographArray: Array<Seismograph>;
  secondsPerLine: number;
  svgParent: any;
  heliConfig: HelicorderConfig;
  trace: Seismogram;
  xScaleArray: any;
  yScale: any;
  plotStartDate: moment;
  plotEndDate: moment;
  constructor(inSvgParent: any,
              heliConfig: HelicorderConfig,
              trace: Seismogram,
              plotStartDate: moment, plotEndDate: moment) {
    this.seismographArray = [];
    this.svgParent = inSvgParent;
    this.heliConfig = heliConfig;
    this.secondsPerLine = moment.duration(plotEndDate.diff(plotStartDate, 'seconds'))/heliConfig.numLines;
    this.plotStartDate = plotStartDate;
    this.plotEndDate = plotEndDate;
    this.trace = trace;
  }
  draw() {
    let start = moment.utc(this.plotStartDate);
    this.seismographArray = [];
    let lineTimes = this.calcTimesForLines(start, this.secondsPerLine, this.heliConfig.numLines);
  //  while (start.isBefore(this.plotEndDate)) {
  //    let lineTime = lineTimes[0]; // temp, wrong, just for height
  //    let end = moment.utc(start).add(this.secondsPerLine, 'seconds');
    for(let lineTime of lineTimes) {
      let start = lineTime.start;
      let end = lineTime.end;
      let seisDiv = this.svgParent.append('div');
      let nl = this.heliConfig.numLines;
      let height = this.heliConfig.maxHeight/(nl-(nl-1)*this.heliConfig.overlap);
      let marginTop = lineTime.lineNumber===0?0:Math.round(-1.0*height*this.heliConfig.overlap);
      console.log(`line ${lineTime.lineNumber} height: ${height}  marginTop: ${marginTop}  ${this.heliConfig.overlap}`);
      seisDiv.classed('heliLine', true)
        .style('height', height+'px')
        .style('margin-top', `${marginTop}px`);
      let lineSeisConfig = this.heliConfig.lineSeisConfig.clone();
      lineSeisConfig.yLabel = `${start.format("HH.mm")}`;
      lineSeisConfig.lineColors = [ seisDiv.style("color")];
      lineSeisConfig.minHeight = height;
      lineSeisConfig.maxHeight = height;
      let seismograph = new Seismograph(seisDiv, lineSeisConfig, [this.trace], start, end);
      seismograph.disableWheelZoom();
      seismograph.draw();
      seismograph.canvas.style("height", `${height}px`);
      seismograph.svg.style("height", `${height}px`);

      this.seismographArray.push(seismograph);
      start = end;
    }
  }
  calcTimesForLines(startTime: moment, secondsPerLine: number, numberOfLines: number): Array<HeliTimeRange> {
    let out = [];
    let s = moment.utc(startTime);
    for (let lineNum=0; lineNum < numberOfLines; lineNum++) {
      let e = moment.utc(s).add(secondsPerLine, 'seconds');
      let startEnd = new HeliTimeRange(s, e);
      startEnd.lineNumber = lineNum;
      out.push(startEnd);
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
  appendMarkers(value: Array<MarkerType> | MarkerType) {
    let markers;
    if (Array.isArray(value)) {
      markers = value;
    } else {
      markers = [ value ];
    }
    for(let s of this.seismographArray) {
      for(let m of markers) {
        if (m.time.isAfter(s.plotStartDate) && m.time.isBefore(s.plotEndDate)) {
          s.appendMarkers(m);
        }
      }
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
    this.lineSeisConfig.yLabel = '';// replace later with `${start.format("HH.mm")}`;
    this.lineSeisConfig.isXAxis = false;
    this.lineSeisConfig.isYAxis = false;
    this.lineSeisConfig.margin.top = 2;
    this.lineSeisConfig.margin.bottom = 2;
    this.lineSeisConfig.margin.left = 32;
    this.lineSeisConfig.disableWheelZoom = true;
  }
}

export class HeliTimeRange extends StartEndDuration {
  lineNumber: number;
  constructor(start: moment | null, end: moment | null, duration: number | null =null, clockOffset?: number | null =0) {
    super(start, end, duration, clockOffset);
  }
}
