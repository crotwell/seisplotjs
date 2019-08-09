//@flow

import {Channel, InstrumentSensitivity} from './stationxml.js';
import { Seismogram, SeismogramSegment} from './seismogram.js';
import {Quake} from './quakeml.js';
import {ChannelTimeRange} from './fdsndataselect.js';
import {StartEndDuration, stringify} from './util.js';
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
    Object.getOwnPropertyNames(this).forEach( name => {
      // $FlowFixMe
      if (this[name] instanceof moment) {
        // $FlowFixMe
        out[name] = moment.utc(this[name]);
        // $FlowFixMe
      } else if ( Array.isArray(this[name]) ) {
        // $FlowFixMe
        out[name] = this[name].slice();
      } else {
        // $FlowFixMe
        out[name] = this[name];
      }
      // handle margin separately
      out.margin = {
        top: this.margin.top,
        right: this.margin.right,
        bottom: this.margin.bottom,
        left: this.margin.left,
        toString: function() {return "t:"+this.top+" l:"+this.left+" b:"+this.bottom+" r:"+this.right;}
      };
    });
    return out;
  }
}

export class SeismogramDisplayData {
  /** @private */
  _seismogram: Seismogram | null;
  markers: Array<MarkerType>;
  channel: Channel | null;
  instrumentSensitivity: InstrumentSensitivity | null;
  quakeList: Array<Quake>;
  startEndDur: StartEndDuration;
  alignmentTime: moment | null;
  doShow: boolean;
  _statsCache: SeismogramDisplayStats | null;
  constructor(startEndDur: StartEndDuration) {
    if ( ! startEndDur) {
      throw new Error("StartEndDuration must not be missing.");
    }
    this._seismogram = null;
    this.markers = [];
    this.channel = null;
    this.instrumentSensitivity = null;
    this.quakeList = [];
    this.startEndDur = startEndDur;
    this.alignmentTime = null;
    this.doShow = true;
    this._statsCache = null;
  }
  static fromChannelTimeRange(chanTR: ChannelTimeRange): SeismogramDisplayData {
    const out = new SeismogramDisplayData(new StartEndDuration(chanTR.startTime, chanTR.endTime, null, chanTR.clockOffset));
    out.channel = chanTR.channel;
    if (chanTR.seismogram) {
      out.seismogram = chanTR.seismogram;
    }
    return out;
  }
  static fromSeismogram(seismogram: Seismogram | SeismogramSegment): SeismogramDisplayData {
    if (seismogram instanceof SeismogramSegment) {
      console.assert(false, new Error("SeismogramDisplayData created with a SeismogramSegment "));
      seismogram = new Seismogram( [ seismogram ]);
    }
    const out = new SeismogramDisplayData(new StartEndDuration(seismogram.startTime, seismogram.endTime, null, null));
    out.seismogram = seismogram;
    return out;
  }
  static fromChannelTimes(channel: Channel, startEndDur: StartEndDuration): SeismogramDisplayData {
    const out = new SeismogramDisplayData(startEndDur);
    out.channel = channel;
    return out;
  }
  addQuake(quake: Quake) {
    this.quakeList.push(quake);
  }
  hasQuake() {
    return this.quakeList.length > 0;
  }
  get min() {
    if ( ! this._statsCache ) {
      this._statsCache = this.calcStats();
    }
    return this._statsCache.min;
  }
  get max() {
    if ( ! this._statsCache ) {
      this._statsCache = this.calcStats();
    }
    return this._statsCache.max;
  }
  get mean() {
    if ( ! this._statsCache ) {
      this._statsCache = this.calcStats();
    }
    return this._statsCache.mean;
  }
  get seismogram() {
    return this._seismogram;
  }
  set seismogram(value: Seismogram) {
    this._seismogram = value;
    this._statsCache = null;
  }
  calcStats() {
    let stats = new SeismogramDisplayStats();
    if (this.seismogram) {
      let minMax = this.seismogram.findMinMax();
      stats.min = minMax[0];
      stats.max = minMax[1];
      // $FlowFixMe  know seismogram is not null
      stats.mean = this.seismogram.mean();
    }
    this._statsCache = stats;
    return stats;
  }
}

class SeismogramDisplayStats {
  min: number;
  max: number;
  mean: number;
  trendSlope: number;
  constructor() {
    this.min = 0;
    this.max = 0;
    this.mean = 0;
    this.trendSlope = 0;
  }
}

export function findStartEnd(sddList: Array<SeismogramDisplayData>): StartEndDuration {
  let allStart = sddList.map(sdd => {
    return moment.utc(sdd.startEndDur.startTime);
  });
  let startTime = moment.min(allStart);
  let allEnd = sddList.map(sdd => {
    return moment.utc(sdd.startEndDur.endTime);
  });
  let endTime = moment.max(allEnd);
  return new StartEndDuration(startTime, endTime);
}

export function findMinMax(sddList: Array<SeismogramDisplayData>): Array<number> {
  let min = sddList.map(sdd => {
    return sdd.min;
  }).reduce(function (p, v) {
    return ( p < v ? p : v );
  });
  let max = sddList.map(sdd => {
    return sdd.max;
  }).reduce(function (p, v) {
    return ( p > v ? p : v );
  });
  return [min, max];
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
