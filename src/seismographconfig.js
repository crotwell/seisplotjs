//@flow

import {Channel, InstrumentSensitivity} from './stationxml.js';
import { Seismogram} from './seismogram.js';
import {Quake} from './quakeml.js';
import moment from 'moment';
import * as d3 from 'd3';

export type MarkerType = {
  name: string,
  time: moment,
  type: string,
  description: string
}

export type MarginType = {
  top: number,
  right: number,
  bottom: number,
  left: number
};

/** Constant for drawing seismogram using svg. */
export const DRAW_SVG = "svg";
/** Constant for drawing seismogram using canvas, axies are still svg. */
export const DRAW_CANVAS = "canvas";
/** Constant for drawing seismogram using both canvas and svg, for testing. */
export const DRAW_BOTH = "both"; // for testing
/** Constant for drawing seismogram using both canvas and svg plus alignment markers, for testing. */
export const DRAW_BOTH_ALIGN = "alignment"; // for testing

export class SeismographConfig {
  drawingType: string;
  xScaleFormat: (date: Date) => string;
  yScaleFormat: string | (value: number) => string;
  _title: Array<string>;
  isXAxis: boolean;
  xLabel: string;
  xLabelOrientation: string;
  xSublabel: string;
  isYAxis: boolean;
  yLabel: string;
  yLabelOrientation: string;
  ySublabel: string;
  ySublabelTrans: number;
  ySublabelIsUnits: boolean;
  markerTextOffset: number;
  markerTextAngle: number;
  markerFlagpoleBase: string;
  minHeight: number;
  maxHeight: number;
  margin: MarginType;
  segmentDrawCompressedCutoff: number;//below this draw all points, above draw minmax
  maxZoomPixelPerSample: number; // no zoom in past point of sample
                                 // separated by pixels

  connectSegments: boolean;
  lineColors: Array<string>;
  lineWidth: number;
  wheelZoom: boolean;
  doRMean: boolean;
  doGain: boolean;
  fixedYScale: null | Array<number>;

  constructor() {
    this.drawingType = DRAW_CANVAS;
    this.isXAxis = true;
    this.isYAxis = true;
    this.xScaleFormat = multiFormatHour;
    this.yScaleFormat = "3e";
    this._title = [ ];
    this.xLabel = "Time";
    this.xLabelOrientation = "horizontal";
    this.xSublabel = "";
    this.yLabel = "Amplitude";
    this.yLabelOrientation = "vertical";
    this.ySublabel = "";
    this.ySublabelTrans = 15;
    this.ySublabelIsUnits = true;
    this.doRMean = true;
    this.doGain = true;
    this.fixedYScale = null;
    this.markerTextOffset = .85;
    this.markerTextAngle = 45;
    this.markerFlagpoleBase = "bottom"; // bottom or center
    this.minHeight=100;
    this.margin = {top: 20, right: 20, bottom: 42, left: 85, toString: function() {return "t:"+this.top+" l:"+this.left+" b:"+this.bottom+" r:"+this.right;}};
    this.segmentDrawCompressedCutoff=10;//below this draw all points, above draw minmax
    this.maxZoomPixelPerSample = 20; // no zoom in past point of sample
                                     // separated by pixels

    this.wheelZoom = true;
    this.connectSegments = false;
    this.lineColors = [
       "skyblue",
       "olivedrab",
       "goldenrod",
       "firebrick",
       "darkcyan",
       "orange",
       "darkmagenta",
       "mediumvioletred",
       "sienna",
       "black"];
    this.lineWidth = 1;
  }

  get title(): Array<string> {
    return this._title;
  }
  /** Sets the title as simple string or array of strings. If an array
  then each item will be in a separate tspan for easier formatting.
  */
  set title(value: string | Array<string>) {
    if (Array.isArray(value)) {
      this._title = value;
    } else {
      this._title = [ value ];
    }
  }

  getColorForIndex(i: number) {
    if (this.lineColors.length && this.lineColors.length > 0) {
      return this.lineColors[i%this.lineColors.length];
    } else {
        return "black";
    }
  }
  clone(): SeismographConfig {
    let out = new SeismographConfig();
    out.drawingType = this.drawingType;
    out.isXAxis = this.isXAxis;
    out.isYAxis = this.isYAxis;
    out.xScaleFormat = this.xScaleFormat;
    out.yScaleFormat = this.yScaleFormat;
    out._title = this._title;
    out.xLabel = this.xLabel;
    out.xLabelOrientation = this.xLabelOrientation;
    out.xSublabel = this.xSublabel;
    out.yLabel = this.yLabel;
    out.yLabelOrientation = this.yLabelOrientation;
    out.ySublabel = this.ySublabel;
    out.ySublabelIsUnits = this.ySublabelIsUnits;
    out.ySublabelTrans = this.ySublabelTrans;
    out.doRMean = this.doRMean;
    out.doGain = this.doGain;
    out.fixedYScale = this.fixedYScale;
    out.markerTextOffset = this.markerTextOffset;
    out.markerTextAngle = this.markerTextAngle;
    out.markerFlagpoleBase = this.markerFlagpoleBase;
    out.minHeight=this.minHeight;
    out.margin = this.margin;
    out.segmentDrawCompressedCutoff = this.segmentDrawCompressedCutoff;
    out.maxZoomPixelPerSample = this.maxZoomPixelPerSample;
    out.wheelZoom = this.wheelZoom;
    out.connectSegments = this.connectSegments;
    out.lineColors = this.lineColors;
    return out;
  }
}

export class SeismogramDisplayData {
  trace: Seismogram;
  markers: Array<MarkerType>;
  channel: Channel;
  instrumentSensitivity: InstrumentSensitivity;
  quake: Quake;
  startTime: moment;
  endTime: moment;
  doShow: boolean;
  _statsCache: SeismogramDisplayStats;
}

class SeismogramDisplayStats {
  mean: number;
  trendSlope: number;

}

export const formatMillisecond = d3.utcFormat(".%L");
export const formatSecond = d3.utcFormat(":%S");
export const formatMinute = d3.utcFormat("%H:%M");
export const formatHour = d3.utcFormat("%H:%M");
export const formatDay = d3.utcFormat("%m/%d");
export const formatMonth = d3.utcFormat("%Y/%m");
export const formatYear = d3.utcFormat("%Y");

export const multiFormatHour = function(date: Date): string {
  return (d3.utcSecond(date) < date ? formatMillisecond
      : d3.utcMinute(date) < date ? formatSecond
      : d3.utcHour(date) < date ? formatMinute
      : d3.utcDay(date) < date ? formatHour
      : d3.utcMonth(date) < date ?  formatDay
      : d3.utcYear(date) < date ? formatMonth
      : formatYear)(date);
};