// @flow

import moment from 'moment';

import { Seismogram } from './seismogram.js';
import type { MarkerType } from './seismographconfig';
import { Seismograph } from './seismograph.js';
import { SeismographConfig, SeismogramDisplayData } from './seismographconfig';
import {minMaxMean, mean } from './filter.js';
import {StartEndDuration} from './util.js';


export class Helicorder {
  seismographArray: Array<Seismograph>;
  secondsPerLine: number;
  svgParent: any;
  heliConfig: HelicorderConfig;
  trace: Seismogram;
  xScaleArray: any;
  yScale: any;
  plotStartTime: moment;
  plotEndTime: moment;
  maxVariation: number;
  constructor(inSvgParent: any,
              heliConfig: HelicorderConfig,
              trace: Seismogram,
              plotStartTime: moment, plotEndTime: moment) {
    this.seismographArray = [];
    this.svgParent = inSvgParent;
    this.heliConfig = heliConfig;
    this.secondsPerLine = moment.duration(plotEndTime.diff(plotStartTime, 'seconds'))/heliConfig.numLines;
    this.plotStartTime = plotStartTime;
    this.plotEndTime = plotEndTime;
    let cutSeis = trace.cut(new StartEndDuration(plotStartTime, plotEndTime));
    if (cutSeis) { this.trace = cutSeis;} // check for null for flow
    let minMax = minMaxMean(this.trace);
    let posOffset = minMax.max - minMax.mean;
    let negOffset = minMax.mean = minMax.min;
    this.maxVariation = Math.max(posOffset, negOffset);
  }
  draw() {
    if ( ! this.trace) {
      // no data
      return;
    }
    let startTime = moment.utc(this.plotStartTime);
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
      lineSeisConfig.yLabel = `${startTime.format("HH.mm")}`;
      lineSeisConfig.lineColors = [ seisDiv.style("color")];
      lineSeisConfig.minHeight = height;
      lineSeisConfig.maxHeight = height;

      let trimSeisArr: Array<SeismogramDisplayData> = [  ];
      let lineCutSeis = this.trace.cut(lineTime);
      let lineMean = 0;
      if (lineCutSeis) {
        let seisData = SeismogramDisplayData.fromSeismogram(lineCutSeis);
        seisData.startEndDur = lineTime;
        lineMean = mean(lineCutSeis);
        trimSeisArr.push(seisData);
      }
      lineSeisConfig.fixedYScale = [lineMean-this.maxVariation, lineMean+this.maxVariation];
      let seismograph = new Seismograph(seisDiv, lineSeisConfig, trimSeisArr, startTime, endTime);
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
  setPlotStartEnd(startTime: moment, endTime: moment) {
    this.plotStartTime = startTime;
    this.plotEndTime = endTime;
    let lineTimes = this.calcTimesForLines(startTime, this.secondsPerLine, 3);
    for(let i=0; i< lineTimes.length; i++) {
      this.seismographArray[i].setPlotStartEnd(lineTimes[i].startTime, lineTimes[i].endTime);
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
        if (m.time.isAfter(s.plotStartTime) && m.time.isBefore(s.plotEndTime)) {
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
