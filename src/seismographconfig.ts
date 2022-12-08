/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */
import { AUTO_COLOR_SELECTOR, G_DATA_SELECTOR} from "./cssutil";
import {IndividualAmplitudeScale,
  LinkedAmplitudeScale,
  LinkedTimeScale,
  AMPLITUDE_MODE
} from "./scale";

import {SeismogramDisplayData, Seismogram} from "./seismogram";
import {isDef} from "./util";
import { Duration, Interval} from "luxon";
import * as d3 from "d3";
import type {AxisDomain} from "d3-axis";
import {Handlebars, registerHelpers} from "./handlebarshelpers";
registerHelpers();

export type MarginType = {
  top: number;
  right: number;
  bottom: number;
  left: number;
  toString?: () => string;
};

export const DEFAULT_TITLE =
  "{{#each seisDataList}}<tspan>{{onlyChangesChannel ../seisDataList @index}}</tspan> {{else}}No Data{{/each}}";

/**
 * Configuration object for Seismograph display.
 *
 */
export class SeismographConfig {
  static _lastID: number;
  configId: number;

  timeFormat: (date: Date) => string;
  relativeTimeFormat: (value: number) => string;
  amplitudeFormat: (value: number) => string;
  showTitle: boolean;

  /** @private */
  _title: Array<string>;

  /** @private */
  _titleHandlebarsCompiled: null | ((arg0: {}, arg1: {}) => string);
  isXAxis: boolean;
  isXAxisTop: boolean;
  _xLabel: string;

  /** @private */
  _xLabelHandlebarsCompiled: null | ((arg0: {}, arg1: {}) => string);
  xLabelOrientation: string;
  _xSublabel: string;
  xSublabelIsUnits: boolean;
  /** @private */
  _xSublabelHandlebarsCompiled: null | ((arg0: {}, arg1: {}) => string);
  isYAxis: boolean;
  isYAxisRight: boolean;
  isYAxisNice: boolean;
  _yLabel: string;

  /** @private */
  _yLabelHandlebarsCompiled: null | ((arg0: {}, arg1: {}) => string);
  _yLabelRight: string;

  /** @private */
  _yLabelRightHandlebarsCompiled: null | ((arg0: {}, arg1: {}) => string);
  yLabelOrientation: string;
  _ySublabel: string;
  /** @private */
  _ySublabelHandlebarsCompiled: null | ((arg0: {}, arg1: {}) => string);
  ySublabelTrans: number;
  ySublabelIsUnits: boolean;
  doMarkers: boolean;
  markerTextOffset: number;
  markerTextAngle: number;
  markerFlagpoleBase: string;
  minHeight: number;
  maxHeight: null | number;
  minWidth: number;
  maxWidth: null | number;
  margin: MarginType;
  segmentDrawCompressedCutoff: number; //below this draw all points, above draw minmax

  maxZoomPixelPerSample: number; // no zoom in past point of sample

  // separated by pixels
  connectSegments: boolean;
  lineColors: Array<string>;
  lineWidth: number;
  wheelZoom: boolean;
  amplitudeMode: AMPLITUDE_MODE;
  doGain: boolean;
  windowAmp: boolean;
  /** @private */
  _fixedAmplitudeScale: null | Array<number>;

  /** @private */
  _fixedTimeScale: null | Interval;

  /** @private */
  _linkedAmplitudeScale: null | LinkedAmplitudeScale;

  /** @private */
  _linkedTimeScale: null | LinkedTimeScale;
  isRelativeTime: boolean;

  constructor() {
    this.configId = ++SeismographConfig._lastID;
    this.isXAxis = true;
    this.isXAxisTop = false;
    this.isYAxisNice = true;
    this.isYAxis = true;
    this.isYAxisRight = false;
    this.timeFormat = multiFormatHour;
    this.relativeTimeFormat = formatCountOrAmp;
    this.amplitudeFormat = formatCountOrAmp;
    this._title = [DEFAULT_TITLE];
    this._titleHandlebarsCompiled = null;
    this.showTitle = true;
    this._xLabel = "Time";
    this.xLabelOrientation = "horizontal";
    this._xSublabel = "";
    this.xSublabelIsUnits = false;
    this._yLabel = "Amplitude";
    this._yLabelRight = "";
    this._xLabelHandlebarsCompiled = null;
    this._xSublabelHandlebarsCompiled = null;
    this.yLabelOrientation = "vertical";
    this._yLabelHandlebarsCompiled = null;
    this._yLabelRightHandlebarsCompiled = null;
    this._ySublabel = "";
    this._ySublabelHandlebarsCompiled = null;
    this.ySublabelTrans = 15;
    this.ySublabelIsUnits = true;
    this.amplitudeMode = AMPLITUDE_MODE.MinMax;
    this.doGain = true;
    this.windowAmp = true;
    this._fixedAmplitudeScale = null;
    this._fixedTimeScale = null;
    this._linkedAmplitudeScale = new IndividualAmplitudeScale();
    this._linkedTimeScale = new LinkedTimeScale([], Duration.fromMillis(0), Duration.fromMillis(0), this.configId);
    this.isRelativeTime = false;
    this.doMarkers = true;
    this.markerTextOffset = 0.85;
    this.markerTextAngle = 45;
    this.markerFlagpoleBase = "bottom"; // bottom or center

    this.minHeight = 0;
    this.maxHeight = null;
    this.minWidth = 0;
    this.maxWidth = null;
    this.margin = {
      top: 25,
      right: 20,
      bottom: 42,
      left: 85,
      toString: function () {
        return (
          "t:" +
          this.top +
          " l:" +
          this.left +
          " b:" +
          this.bottom +
          " r:" +
          this.right
        );
      },
    };
    this.segmentDrawCompressedCutoff = 10; //below this draw all points, above draw minmax

    this.maxZoomPixelPerSample = 20; // no zoom in past point of sample

    this.wheelZoom = false;
    // separated by pixels
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
      "black",
    ];
    this.lineWidth = 1;
  }

  static fromJSON(json: any): SeismographConfig {
    const seisConfig = new SeismographConfig();
    Object.assign(seisConfig, json);

    if (json.isLinkedTimeScale) {
      seisConfig.linkedTimeScale = new LinkedTimeScale();
    }

    if (json.isLinkedAmplitudeScale) {
      seisConfig.linkedAmplitudeScale = new LinkedAmplitudeScale();
    } else if (! isDef(seisConfig.fixedAmplitudeScale)) {
      // neither fixed nor linked, so individual
      seisConfig.linkedAmplitudeScale = new IndividualAmplitudeScale();
    }

    return seisConfig;
  }

  asJSON(): any {
    // kind of dumb...
    const out = JSON.parse(JSON.stringify(this));
    out.title = out._title;
    delete out._title;
    out.fixedAmplitudeScale = out._fixedAmplitudeScale;
    delete out._fixedAmplitudeScale;
    out.fixedTimeScale = out._fixedTimeScale;
    delete out._fixedTimeScale;
    delete out._linkedTimeScale;
    out.isLinkedTimeScale = isDef(this._linkedTimeScale);
    out.isLinkedAmplitudeScale = isDef(this._linkedAmplitudeScale) && ! (this._linkedAmplitudeScale instanceof IndividualAmplitudeScale);
    delete out._titleHandlebarsCompiled;
    return out;
  }

  get fixedAmplitudeScale(): null | Array<number> {
    return this._fixedAmplitudeScale;
  }

  set fixedAmplitudeScale(ts: null | Array<number>) {
    if (!isDef(ts)) {throw new Error("amp scale must be defined");}
    this._fixedAmplitudeScale = ts;
    this._linkedAmplitudeScale = null;
  }

  get linkedAmplitudeScale(): null | LinkedAmplitudeScale {
    return this._linkedAmplitudeScale;
  }

  set linkedAmplitudeScale(ts: null | LinkedAmplitudeScale) {
    if (!isDef(ts)) {throw new Error("amp scale must be defined");}
    if (this._linkedAmplitudeScale) {
      ts.linkAll(this._linkedAmplitudeScale.graphList);
    }
    this._linkedAmplitudeScale = ts;
    this._fixedAmplitudeScale = null;
  }

  /**
   * Enable linked amplitude scales across seismographs.
   *
   */
  enableLinkedAmplitude() {
    // setter handles details...
    this.linkedAmplitudeScale = new LinkedAmplitudeScale();
  }
  amplitudeRaw() {
    this.amplitudeMode = AMPLITUDE_MODE.Raw;
  }
  amplitudeMinMax() {
    this.amplitudeMode = AMPLITUDE_MODE.MinMax;
  }
  amplitudeMean() {
    this.amplitudeMode = AMPLITUDE_MODE.Mean;
  }
  amplitudeWithZero() {
    this.amplitudeMode = AMPLITUDE_MODE.Zero;
  }
  /**
   * True if the amplitude is "centered".
   *
   * Both MinMax and Mean center the amplitude, Raw and Zero do not.
   * @return [description]
   */
  isCenteredAmp() {
    return this.amplitudeMode === AMPLITUDE_MODE.MinMax
            || this.amplitudeMode === AMPLITUDE_MODE.Mean;
  }

  get fixedTimeScale(): null | Interval {
    return this._fixedTimeScale;
  }

  set fixedTimeScale(ts: null | Interval) {
    if (!isDef(ts)) {throw new Error("time scale must be defined");}
    this._fixedTimeScale = ts;
    this._linkedTimeScale = null;
  }

  get linkedTimeScale(): null | LinkedTimeScale {
    return this._linkedTimeScale;
  }

  set linkedTimeScale(ts: null | LinkedTimeScale) {
    if (!isDef(ts)) {throw new Error("time scale must be defined");}
    if (this._linkedTimeScale) {
      ts.linkAll(this._linkedTimeScale.graphList);
    }
    this._linkedTimeScale = ts;
    this._fixedTimeScale = null;
  }

  /**
   * gets the current title
   *
   * @returns        title as an array of strings
   */
  get title(): Array<string> {
    return this._title;
  }

  /**
   * Sets the title as simple string or array of strings or a
   * handlebars template. If an array
   * then each item will be in a separate tspan for easier formatting.
   *
   * @param value string or array of strings to be the title
   */
  set title(value: null | string | Array<string>) {
    if (!isDef(value)) {
      this._title = [""];
    } else if (Array.isArray(value)) {
      this._title = value;
    } else {
      this._title = [value];
    }

    this._titleHandlebarsCompiled = null;
  }

  handlebarsTitle(context: {}, runtimeOptions: {}): string {
    if (!isDef(this._titleHandlebarsCompiled)) {
      if (
        !isDef(this._title) ||
        this._title.length === 0 ||
        !isDef(this._title[0])
      ) {
        // empty title
        return "";
      } else if (this._title.length === 1) {
        this._titleHandlebarsCompiled = Handlebars.compile(this._title[0]);
      } else {
        this._titleHandlebarsCompiled = Handlebars.compile(
          "" + this._title.join(" "),
        );
      }
    }
    // don't think this can happen, keep typescript happy
    if (! this._titleHandlebarsCompiled) {
      throw new Error(`Unable to compile handlebars title for ${this._title}`);
    }
    return this._titleHandlebarsCompiled(context, runtimeOptions);
  }

  /**
   * gets the current x label
   *
   * @returns        x label
   */
  get xLabel(): string {
    return this._xLabel;
  }

  /**
   * Sets the xLabel as simple string or a
   * handlebars template.
   *
   * @param value string  to be the x label
   */
  set xLabel(value: null | string) {
    if (!isDef(value)) {
      this._xLabel = "";
    } else {
      this._xLabel = value;
    }

    this._xLabelHandlebarsCompiled = null;
  }

  /**
   * gets the current x sublabel
   *
   * @returns        x sublabel
   */
  get xSublabel(): string {
    return this._xSublabel;
  }

  /**
   * Sets the xSublabel as simple string or a
   * handlebars template.
   *
   * @param value string  to be the x sublabel
   */
  set xSublabel(value: null | string) {
    if (!isDef(value)) {
      this._xSublabel = "";
    } else {
      this._xSublabel = value;
    }

    this._xSublabelHandlebarsCompiled = null;
  }

  handlebarsXLabel(context: {}, runtimeOptions: {}): string {
    if (!isDef(this._xLabelHandlebarsCompiled)) {
      if (!isDef(this._xLabel) || this._xLabel.length === 0) {
        // empty label
        return "";
      } else {
        this._xLabelHandlebarsCompiled = Handlebars.compile(this._xLabel);
      }
    }
    // don't think this can happen, keep typescript happy
    if (! this._xLabelHandlebarsCompiled) {
      throw new Error(`Unable to compile handlebars xLabel for ${this._xLabel}`);
    }

    return this._xLabelHandlebarsCompiled(context, runtimeOptions);
  }


  handlebarsXSublabel(context: {}, runtimeOptions: {}): string {
    if (!isDef(this._xSublabelHandlebarsCompiled)) {
      if (!isDef(this._xSublabel) || this._xSublabel.length === 0) {
        // empty label
        return "";
      } else {
        this._xSublabelHandlebarsCompiled = Handlebars.compile(this._xSublabel);
      }
    }
    // don't think this can happen, keep typescript happy
    if (! this._xSublabelHandlebarsCompiled) {
      throw new Error(`Unable to compile handlebars xLabel for ${this._xSublabel}`);
    }

    return this._xSublabelHandlebarsCompiled(context, runtimeOptions);
  }
  /**
   * gets the current y label
   *
   * @returns        yLabel
   */
  get yLabel(): string {
    return this._yLabel;
  }

  /**
   * Sets the ylabel as simple string or a
   * handlebars template.
   *
   * @param value string to be the y label
   */
  set yLabel(value: null | string) {
    if (!isDef(value)) {
      this._yLabel = "";
    } else {
      this._yLabel = value;
    }

    this._yLabelHandlebarsCompiled = null;
  }

  /**
   * gets the current y sublabel
   *
   * @returns        ySublabel
   */
  get ySublabel(): string {
    return this._ySublabel;
  }

  /**
   * Sets the y sublabel as simple string or a
   * handlebars template.
   *
   * @param value string to be the y sublabel
   */
  set ySublabel(value: null | string) {
    if (!isDef(value)) {
      this._ySublabel = "";
    } else {
      this._ySublabel = value;
    }

    this._ySublabelHandlebarsCompiled = null;
  }

  handlebarsYLabel(context: {}, runtimeOptions: {}): string {
    if (!isDef(this._yLabelHandlebarsCompiled)) {
      if (!isDef(this._yLabel) || this._yLabel.length === 0) {
        // empty label
        return "";
      } else {
        this._yLabelHandlebarsCompiled = Handlebars.compile(this._yLabel);
      }
    }
    // don't think this can happen, keep typescript happy
    if (! this._yLabelHandlebarsCompiled) {
      throw new Error(`Unable to compile handlebars yLabel for ${this._yLabel}`);
    }

    return this._yLabelHandlebarsCompiled(context, runtimeOptions);
  }

  handlebarsYSublabel(context: {}, runtimeOptions: {}): string {
    if (!isDef(this._ySublabelHandlebarsCompiled)) {
      if (!isDef(this._ySublabel) || this._ySublabel.length === 0) {
        // empty label
        return "";
      } else {
        this._ySublabelHandlebarsCompiled = Handlebars.compile(this._ySublabel);
      }
    }
    // don't think this can happen, keep typescript happy
    if (! this._ySublabelHandlebarsCompiled) {
      throw new Error(`Unable to compile handlebars yLabel for ${this._ySublabel}`);
    }

    return this._ySublabelHandlebarsCompiled(context, runtimeOptions);
  }

  /**
   * gets the current title
   *
   * @returns        yLabel
   */
  get yLabelRight(): string {
    return this._yLabelRight;
  }

  /**
   * Sets the ylabel as simple string or a
   * handlebars template.
   *
   * @param value string to be the y label
   */
  set yLabelRight(value: null | string) {
    if (!isDef(value)) {
      this._yLabelRight = "";
    } else {
      this._yLabelRight = value;
    }

    this._yLabelRightHandlebarsCompiled = null;
  }

  handlebarsYLabelRight(context: {}, runtimeOptions: {}): string {
    if (!isDef(this._yLabelRightHandlebarsCompiled)) {
      if (!isDef(this._yLabelRight) || this._yLabelRight.length === 0) {
        // empty label
        return "";
      } else {
        this._yLabelRightHandlebarsCompiled = Handlebars.compile(
          this._yLabelRight,
        );
      }
    }
    // don't think this can happen, keep typescript happy
    if (! this._yLabelRightHandlebarsCompiled) {
      throw new Error(`Unable to compile handlebars yLabelRight for ${this._yLabelRight}`);
    }

    return this._yLabelRightHandlebarsCompiled(context, runtimeOptions);
  }

  /**
   * Fake data to use to test alignment of seismograph axis and between canvas
   *  and svg drawing.
   *
   * @param   timeRange start and end of fake data
   * @param   min        min amplitude for fake data, default is -100
   * @param   max        max amplitude for fake data, default is 100
   * @returns             fake data
   */
  createAlignmentData(
    timeRange: Interval,
    min = -100,
    max = 100,
  ): SeismogramDisplayData {
    const mid = (max + min) / 2;
    const fakeData = Float32Array.from([
      max,
      min,
      max,
      min,
      mid,
      mid,
      max,
      mid,
      mid,
      min,
    ]);
    const fakeSampleRate =
      1 / (1000*timeRange.toDuration().toMillis() / (fakeData.length - 1));
    const fakeSeis = Seismogram.fromContiguousData(
      fakeData,
      fakeSampleRate,
      timeRange.start,
    );
    const fakeSDD = SeismogramDisplayData.fromSeismogram(fakeSeis);
    return fakeSDD;
  }

  getColorForIndex(i: number): string {
    if (isDef(this.lineColors) && this.lineColors.length > 0) {
      return this.lineColors[i % this.lineColors.length];
    } else {
      return "black";
    }
  }

  createCSSForLineColors(svgClass?: string): string {
    let cssText = "";
    const numColors = this.lineColors.length;
    let svgEl = "svg";

    if (!isDef(svgClass)) {
      svgEl = `svg.${AUTO_COLOR_SELECTOR}`;
    } else if (svgClass.length === 0) {
      svgEl = "svg";
    } else {
      svgEl = `svg.${svgClass}`;
    }

    // line width and fill for paths that are seisplotjsdata
    cssText =
      cssText +
      `
      ${svgEl} g.${G_DATA_SELECTOR} g path {
        fill: none;
        stroke-width: 1px;
      }
    `;
    this.lineColors.forEach((color, index) => {
      cssText =
        cssText +
        `
        ${svgEl} g.title  text tspan:nth-child(${numColors}n+${index + 1})  {
          stroke: ${color};
          fill: ${color};
          color: ${color};
        }
        `;
      // not used by actual waveform as default is canvas, not svg
      // is used by fftplot
      cssText += `
        ${svgEl} g.${G_DATA_SELECTOR} g:nth-child(${numColors}n+${
        index + 1
      }) path {
          stroke: ${color};
        }
        `;
    });
    return cssText;
  }

  clone(): SeismographConfig {
    const out = new SeismographConfig();
    Object.getOwnPropertyNames(this).forEach(name => {
      // @ts-ignore
      if (Array.isArray(this[name])) {
        // @ts-ignore
        out[name] = this[name].slice();
      } else {
        // @ts-ignore
        out[name] = this[name];
      }

      // handle margin separately
      out.margin = {
        top: this.margin.top,
        right: this.margin.right,
        bottom: this.margin.bottom,
        left: this.margin.left,
        toString: function () {
          return (
            "t:" +
            this.top +
            " l:" +
            this.left +
            " b:" +
            this.bottom +
            " r:" +
            this.right
          );
        },
      };
    });
    return out;
  }

  toString(): string {
    let outS = "";
    Object.getOwnPropertyNames(this).forEach(name => {
      // @ts-ignore
      outS += `  seisConfig.${name} = ${JSON.stringify(this[name])}\n`;
    });
    return outS;
  }
}

export function numberFormatWrapper( formater: (arg0: number) => string): ((domainValue: AxisDomain) => string) {
  return function(domainValue: AxisDomain) {
    if (typeof domainValue === "number" ) {
      return formater(domainValue);
    } else {
      throw new Error("Can only format number, "+domainValue);
    }
  };
}
export const formatCount: (arg0: number) => string = d3.format("~s");
export const formatExp: (arg0: number) => string = d3.format(".2e");
export const formatCountOrAmp = function (v: number): string {
  return -1 < v && v < 1 && v !== 0 ? formatExp(v) : formatCount(v);
};
export const formatMillisecond: (arg0: Date) => string = d3.utcFormat(".%L");
export const formatSecond: (arg0: Date) => string = d3.utcFormat(":%S");
export const formatMinute: (arg0: Date) => string = d3.utcFormat("%H:%M");
export const formatHour: (arg0: Date) => string = d3.utcFormat("%H:%M");
export const formatDay: (arg0: Date) => string = d3.utcFormat("%m/%d");
export const formatMonth: (arg0: Date) => string = d3.utcFormat("%Y/%m");
export const formatYear: (arg0: Date) => string = d3.utcFormat("%Y");
export const multiFormatHour = function (date: Date): string {
  return (d3.utcSecond(date) < date
    ? formatMillisecond
    : d3.utcMinute(date) < date
    ? formatSecond
    : d3.utcHour(date) < date
    ? formatMinute
    : d3.utcDay(date) < date
    ? formatHour
    : d3.utcMonth(date) < date
    ? formatDay
    : d3.utcYear(date) < date
    ? formatMonth
    : formatYear)(date);
};

SeismographConfig._lastID = 0;
