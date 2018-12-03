//@flow

import type { TimeRangeType } from './chooser';
import * as model from '../model/index';
import { d3 } from './util';

const moment = model.moment;

export type MarkerType = {
  name: string,
  time: moment,
  type: string
}

export type MarginType = {
  top: number,
  right: number,
  bottom: number,
  left: number
};

export class SeismographConfig {
  xScaleFormat: (date: Date) => string;
  yScaleFormat: string | (value :number) => string;
  _title: Array<string>;
  xLabel: string;
  xSublabel: string;
  yLabel: string;
  ySublabel: string;
  ySublabelTrans: number;
  markerTextOffset: number;
  markerTextAngle: number;
  minHeight: number;
  maxHeight: number;
  margin: MarginType;
  segmentDrawCompressedCutoff: number;//below this draw all points, above draw minmax
  maxZoomPixelPerSample: number; // no zoom in past point of sample
                                       // separated by pixels
  doRMean: boolean;
  doGain: boolean;

  constructor(plotStartDate :moment, plotEndDate :moment) {
    this.xScaleFormat = multiFormatHour;
    this.yScaleFormat = "3e";
    this._title = [ ];
    this.xLabel = "Time";
    this.xSublabel = "";
    this.yLabel = "Amplitude";
    this.ySublabel = "";
    this.ySublabelTrans = 15;
    this.doRMean = true;
    this.doGain = true;
    this.markerTextOffset = .85;
    this.markerTextAngle = 45;
    this.margin = {top: 20, right: 20, bottom: 42, left: 85, toString: function() {return "t:"+this.top+" l:"+this.left+" b:"+this.bottom+" r:"+this.right;}};
    this.segmentDrawCompressedCutoff=10;//below this draw all points, above draw minmax
    this.maxZoomPixelPerSample = 20; // no zoom in past point of sample
                                     // separated by pixels
  }

  get title() :Array<string> {
    return this._title;
  }
  /** Sets the title as simple string or array of strings. If an array
  then each item will be in a separate tspan for easier formatting.
  */
  set title(value :string | Array<string>) :Seismograph {
    if (Array.isArray(value)) {
      this._title = value;
    } else {
      this._title = [ value ];
    }
  }
};

export class SeismogramDisplayData {
  trace: model.seismogram.Trace;
  markers: Array<MarkerType>;
  channel: model.stationxml.Channel;
  instrumentSensitivity: miniseed.model.InstrumentSensitivity;
  quake: model.quakeml.Quake;
  startDate: moment;
  endDate: moment;
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

export const multiFormatHour = function(date: Date) :string {
  return (d3.utcSecond(date) < date ? formatMillisecond
      : d3.utcMinute(date) < date ? formatSecond
      : d3.utcHour(date) < date ? formatMinute
      : d3.utcDay(date) < date ? formatHour
      : d3.utcMonth(date) < date ?  formatDay
      : d3.utcYear(date) < date ? formatMonth
      : formatYear)(date);
};