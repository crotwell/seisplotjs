/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * https://www.seis.sc.edu
 */
import { AUTO_COLOR_SELECTOR, G_DATA_SELECTOR } from "./cssutil";
import {
  IndividualAmplitudeScale,
  LinkedAmplitudeScale,
  LinkedTimeScale,
  AMPLITUDE_MODE,
} from "./scale";
import { DEFAULT_GRID_LINE_COLOR } from "./seismographutil";
import { SeismogramDisplayData, Seismogram } from "./seismogram";
import {
  isDef, validStartTime, stringify, isStringArg, nameForTimeZone
 } from "./util";
import { DateTime, Duration, Interval, Zone, FixedOffsetZone, IANAZone } from "luxon";
import { format as d3format } from "d3-format";
import type { AxisDomain } from "d3-axis";
import { Handlebars, registerHelpers } from "./handlebarshelpers";
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

export class SeismographConfigCache {
  titleHandlebarsCompiled: null | ((arg0: object, arg1: object) => string);
  xLabelHandlebarsCompiled: null | ((arg0: object, arg1: object) => string);
  xSublabelHandlebarsCompiled: null | ((arg0: object, arg1: object) => string);
  yLabelHandlebarsCompiled: null | ((arg0: object, arg1: object) => string);
  yLabelRightHandlebarsCompiled:
    | null
    | ((arg0: object, arg1: object) => string);
  ySublabelHandlebarsCompiled: null | ((arg0: object, arg1: object) => string);

  constructor() {
    this.titleHandlebarsCompiled = null;
    this.xLabelHandlebarsCompiled = null;
    this.xSublabelHandlebarsCompiled = null;
    this.yLabelHandlebarsCompiled = null;
    this.yLabelRightHandlebarsCompiled = null;
    this.ySublabelHandlebarsCompiled = null;
  }
}
/**
 * Configuration object for Seismograph display.
 *
 */
export class SeismographConfig {
  /** @private */
  static _lastID: number;
  configId: number;
  /** @private */
  __cache__: SeismographConfigCache;

  _timeFormat: null | ((date: Date) => string);
  relativeTimeFormat: (value: number) => string;
  amplitudeFormat: (value: number) => string;
  showTitle: boolean;

  /** @private */
  _title: Array<string>;

  /** @private */
  isXAxis: boolean;
  xAxisTimeZone: null|string|Zone;
  isXAxisTop: boolean;
  /** @private */
  _xLabel: string;

  xLabelOrientation: string;
  /** @private */
  _xSublabel: string;
  xSublabelIsUnits: boolean;
  /**
   * Should grid lines be drawn for each tick on the x axis.
   */
  xGridLines: boolean;
  isYAxis: boolean;
  isYAxisRight: boolean;
  isYAxisNice: boolean;
  /** @private */
  _yLabel: string;

  /** @private */
  _yLabelRight: string;

  yLabelOrientation: string;
  /** @private */
  _ySublabel: string;
  ySublabelTrans: number;
  ySublabelIsUnits: boolean;
  yGridLines: boolean;
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
  gridLineColor: string;
  allowZoom: boolean;
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
    this.__cache__ = new SeismographConfigCache();
    this.isXAxis = true;
    this.isXAxisTop = false;
    this.xAxisTimeZone = null; // defaults to UTC
    this.isYAxisNice = true;
    this.isYAxis = true;
    this.isYAxisRight = false;
    /**
     * Should grid lines be drawn for each tick on the X axis.
     * Defaults to false;
     */
    this.xGridLines = false;
    /**
     * Should grid lines be drawn for each tick on the Y axis.
     * Defaults to false;
     */
    this.yGridLines = false;
    /**
     * Color for gridlines. Defaults to gainsboro, a very light grey.
     */
    this.gridLineColor = DEFAULT_GRID_LINE_COLOR;
    this._timeFormat = null;
    this.relativeTimeFormat = formatCountOrAmp;
    this.amplitudeFormat = formatCountOrAmp;
    this._title = [DEFAULT_TITLE];
    this.showTitle = true;
    this._xLabel = "Time";
    this.xLabelOrientation = "horizontal";
    this._xSublabel = "";
    this.xSublabelIsUnits = false;
    this._yLabel = "Amplitude";
    this._yLabelRight = "";
    this.yLabelOrientation = "vertical";
    this._ySublabel = "";
    this.ySublabelTrans = 15;
    this.ySublabelIsUnits = true;
    this.amplitudeMode = AMPLITUDE_MODE.MinMax;
    this.doGain = true;
    this.windowAmp = true;
    this._fixedAmplitudeScale = null;
    this._fixedTimeScale = null;
    this._linkedAmplitudeScale = new IndividualAmplitudeScale();
    this._linkedTimeScale = new LinkedTimeScale(
      [],
      Duration.fromMillis(0),
      Duration.fromMillis(0),
      this.configId,
    );
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
        return `t: ${this.top} l: ${this.left} b: ${this.bottom} r: ${this.right}`;
      },
    };
    this.segmentDrawCompressedCutoff = 10; //below this draw all points, above draw minmax

    this.maxZoomPixelPerSample = 20; // no zoom in past point of sample

    this.wheelZoom = false;
    this.allowZoom = true;
    // separated by pixels
    this.connectSegments = false;
    this.lineColors = [
      "skyblue",
      "olivedrab",
      "goldenrod",
      "firebrick",
      "darkcyan",
      "chocolate",
      "darkmagenta",
      "mediumseagreen",
      "rebeccapurple",
      "sienna",
      "orchid",
      "royalblue",
      "mediumturquoise",
      "chartreuse",
      "peru",
      "black",
    ];
    this.lineWidth = 1;
  }

  static fromJSON(json: SeismographConfigJsonType): SeismographConfig {
    const seisConfig = new SeismographConfig();
    const tempJson = {};
    Object.assign(tempJson, json);
    if (Object.hasOwn(tempJson, "fixedAmplitudeScale")) {
      // @ts-expect-error ok as we just check hasOwn
      delete tempJson.fixedAmplitudeScale;
    }
    if (Object.hasOwn(tempJson, "fixedTimeScale")) {
      // @ts-expect-error ok as we just check hasOwn
      delete tempJson.fixedTimeScale;
    }
    if (Object.hasOwn(tempJson, "isLinkedTimeScale")) {
      // @ts-expect-error ok as we just check hasOwn
      delete tempJson.isLinkedTimeScale;
    }
    if (Object.hasOwn(tempJson, "isLinkedAmplitudeScale")) {
      // @ts-expect-error ok as we just check hasOwn
      delete tempJson.isLinkedAmplitudeScale;
    }
    if (Object.hasOwn(tempJson, "xAxisTimeZone")) {
      // @ts-expect-error ok as we just check hasOwn
      delete tempJson.xAxisTimeZone;
    }
    if (
      Object.hasOwn(tempJson, "ySublabel") &&
      // @ts-expect-error ok as we just check hasOwn
      tempJson.ySublabel.length === 0
    ) {
      // don't set in case ySublabelIsUnits
      // @ts-expect-error ok as we just check hasOwn
      delete tempJson.ySublabel;
    }
    Object.assign(seisConfig, tempJson);

    if (json.isLinkedTimeScale) {
      seisConfig.linkedTimeScale = new LinkedTimeScale();
    } else {
      seisConfig.fixedAmplitudeScale = json.fixedAmplitudeScale;
    }

    if (json.isLinkedAmplitudeScale) {
      seisConfig.linkedAmplitudeScale = new LinkedAmplitudeScale();
    } else if (isDef(json.fixedAmplitudeScale)) {
      seisConfig.fixedAmplitudeScale = json.fixedAmplitudeScale;
    } else {
      // neither fixed nor linked, so individual
      seisConfig.linkedAmplitudeScale = new IndividualAmplitudeScale();
    }
    if (json.xAxisTimeZone) {
      seisConfig.xAxisTimeZone = new IANAZone(json.xAxisTimeZone);
    }

    return seisConfig;
  }

  asJSON(): SeismographConfigJsonType {
    // kind of dumb...
    const out = JSON.parse(JSON.stringify(this));
    out.title = out._title;
    delete out._title;
    out.xAxisTimeZone = isDef(this.xAxisTimeZone) ? (
      isStringArg(this.xAxisTimeZone) ? this.xAxisTimeZone : this.xAxisTimeZone.name) : null;
    out.fixedAmplitudeScale = out._fixedAmplitudeScale;
    delete out._fixedAmplitudeScale;
    out.fixedTimeScale = out._fixedTimeScale;
    delete out._fixedTimeScale;
    delete out._linkedTimeScale;
    out.isLinkedTimeScale = isDef(this._linkedTimeScale);
    out.isLinkedAmplitudeScale =
      isDef(this._linkedAmplitudeScale) &&
      !(this._linkedAmplitudeScale instanceof IndividualAmplitudeScale);
    delete out._linkedAmplitudeScale;
    delete out.__cache__;
    Object.getOwnPropertyNames(out).forEach((p) => {
      if (p.startsWith("_")) {
        const tmp = out[p];
        delete out[p];
        out[p.substring(1)] = tmp;
      }
    });
    return out;
  }

  get fixedAmplitudeScale(): null | Array<number> {
    return this._fixedAmplitudeScale;
  }

  set fixedAmplitudeScale(ts: null | Array<number>) {
    if (!isDef(ts)) {
      throw new Error("amp scale must be defined setting fixed");
    }
    this._fixedAmplitudeScale = ts;
    this._linkedAmplitudeScale = null;
  }

  get linkedAmplitudeScale(): null | LinkedAmplitudeScale {
    return this._linkedAmplitudeScale;
  }

  set linkedAmplitudeScale(ts: null | LinkedAmplitudeScale) {
    if (!isDef(ts)) {
      throw new Error("amp scale must be defined setting linked");
    }
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
  /**
   * Set Raw amplitude mode, plot absolute and
   * goes from minimun to maximum of data
   */
  amplitudeRaw() {
    this.amplitudeMode = AMPLITUDE_MODE.Raw;
  }
  /**
   * Set MinMax amplitude mode, plot is relative and
   * centered on (minimun + maximum)/2
   */
  amplitudeMinMax() {
    this.amplitudeMode = AMPLITUDE_MODE.MinMax;
  }
  /**
   * Set Mean amplitude mode, plot is relative and
   * centered on mean of data
   */
  amplitudeMean() {
    this.amplitudeMode = AMPLITUDE_MODE.Mean;
  }
  /**
   * Set WithZero amplitude mode, plot is absolute and
   * centered on mean of data like Raw, but also includes zero
   * even if all data is positive. Useful when showing
   * data compared to zero is helpful.
   */
  amplitudeWithZero() {
    this.amplitudeMode = AMPLITUDE_MODE.Zero;
  }
  /**
   * True if the amplitude is "centered".
   *
   * Both MinMax and Mean center the amplitude, Raw and Zero do not.
   *
   * @returns if centered
   */
  isCenteredAmp() {
    return (
      this.amplitudeMode === AMPLITUDE_MODE.MinMax ||
      this.amplitudeMode === AMPLITUDE_MODE.Mean
    );
  }

  get fixedTimeScale(): null | Interval {
    return this._fixedTimeScale;
  }

  set fixedTimeScale(ts: null | Interval) {
    if (!isDef(ts)) {
      throw new Error("time scale must be defined");
    }
    this._fixedTimeScale = ts;
    this._linkedTimeScale = null;
  }

  get linkedTimeScale(): null | LinkedTimeScale {
    return this._linkedTimeScale;
  }

  set linkedTimeScale(ts: null | LinkedTimeScale) {
    if (!isDef(ts)) {
      throw new Error("time scale must be defined");
    }
    if (this._linkedTimeScale) {
      ts.linkAll(this._linkedTimeScale.graphList);
    }
    this._linkedTimeScale = ts;
    this._fixedTimeScale = null;
  }

  /**
   * Configures the time axis to show times in the given time zone. This
   * replaces timeFormat with createTimeFormatterForZone() and
   * sets xSublabel to be the zone name. If zone is null, uses UTC.
   *
   * @param  zone string like "US/Eastern" or luxon Zone
   */
  enableXAxisTimeZone(zone: null | Zone | string) {
    let zoneName: string;
    let tz: Zone;
    if (isStringArg(zone)) {
      zoneName = zone;
      tz = new IANAZone(zone);
    } else if (zone instanceof Zone) {
      tz = zone;
      zoneName = nameForTimeZone(tz.name);
    } else {
      tz = FixedOffsetZone.utcInstance;
      zoneName = "UTC";
    }
    this.timeFormat = createTimeFormatterForZone(tz);
    this.xSublabel = zoneName;
  }

  /**
   * Time formatter used by the x axis. Defaults to UTC via
   * createTimeFormatterForZone(zone).
   * Set xAxisTimeZone to change the time zone.
   * @return formatter for x axis time labels
   */
  get timeFormat() {
    let tz: Zone;
    if (this._timeFormat != null) {
      return this._timeFormat;
    } else if (isStringArg(this.xAxisTimeZone)) {
        tz = new IANAZone(this.xAxisTimeZone);
      } else if (this.xAxisTimeZone instanceof Zone) {
        tz = this.xAxisTimeZone;
      } else {
        tz = FixedOffsetZone.utcInstance;
      }
    return createTimeFormatterForZone(tz);
  }

  set timeFormat(formatter: (arg0: Date) => string) {
    this._timeFormat = formatter;
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

    this.__cache__.titleHandlebarsCompiled = null;
  }

  handlebarsTitle(context: object, runtimeOptions: object): string {
    if (!isDef(this.__cache__.titleHandlebarsCompiled)) {
      if (
        !isDef(this._title) ||
        this._title.length === 0 ||
        !isDef(this._title[0])
      ) {
        // empty title
        return "";
      } else if (this._title.length === 1) {
        this.__cache__.titleHandlebarsCompiled = Handlebars.compile(
          this._title[0],
        );
      } else {
        this.__cache__.titleHandlebarsCompiled = Handlebars.compile(
          "" + this._title.join(" "),
        );
      }
    }
    // don't think this can happen, keep typescript happy
    if (!this.__cache__.titleHandlebarsCompiled) {
      throw new Error(
        `Unable to compile handlebars title for ${stringify(this._title)}`,
      );
    }
    return this.__cache__.titleHandlebarsCompiled(context, runtimeOptions);
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

    this.__cache__.xLabelHandlebarsCompiled = null;
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

    this.__cache__.xSublabelHandlebarsCompiled = null;
  }

  handlebarsXLabel(context: object, runtimeOptions: object): string {
    if (!isDef(this.__cache__.xLabelHandlebarsCompiled)) {
      if (!isDef(this._xLabel) || this._xLabel.length === 0) {
        // empty label
        return "";
      } else {
        this.__cache__.xLabelHandlebarsCompiled = Handlebars.compile(
          this._xLabel,
        );
      }
    }
    // don't think this can happen, keep typescript happy
    if (!this.__cache__.xLabelHandlebarsCompiled) {
      throw new Error(
        `Unable to compile handlebars xLabel for ${this._xLabel}`,
      );
    }

    return this.__cache__.xLabelHandlebarsCompiled(context, runtimeOptions);
  }

  handlebarsXSublabel(context: object, runtimeOptions: object): string {
    if (!isDef(this.__cache__.xSublabelHandlebarsCompiled)) {
      if (!isDef(this._xSublabel) || this._xSublabel.length === 0) {
        // empty label
        return "";
      } else {
        this.__cache__.xSublabelHandlebarsCompiled = Handlebars.compile(
          this._xSublabel,
        );
      }
    }
    // don't think this can happen, keep typescript happy
    if (!this.__cache__.xSublabelHandlebarsCompiled) {
      throw new Error(
        `Unable to compile handlebars xLabel for ${this._xSublabel}`,
      );
    }

    return this.__cache__.xSublabelHandlebarsCompiled(context, runtimeOptions);
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

    this.__cache__.yLabelHandlebarsCompiled = null;
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
    this.ySublabelIsUnits = false;
    this.__cache__.ySublabelHandlebarsCompiled = null;
  }

  handlebarsYLabel(context: object, runtimeOptions: object): string {
    if (!isDef(this.__cache__.yLabelHandlebarsCompiled)) {
      if (!isDef(this._yLabel) || this._yLabel.length === 0) {
        // empty label
        return "";
      } else {
        this.__cache__.yLabelHandlebarsCompiled = Handlebars.compile(
          this._yLabel,
        );
      }
    }
    // don't think this can happen, keep typescript happy
    if (!this.__cache__.yLabelHandlebarsCompiled) {
      throw new Error(
        `Unable to compile handlebars yLabel for ${this._yLabel}`,
      );
    }

    return this.__cache__.yLabelHandlebarsCompiled(context, runtimeOptions);
  }

  handlebarsYSublabel(context: object, runtimeOptions: object): string {
    if (!isDef(this.__cache__.ySublabelHandlebarsCompiled)) {
      if (!isDef(this._ySublabel) || this._ySublabel.length === 0) {
        // empty label
        return "";
      } else {
        this.__cache__.ySublabelHandlebarsCompiled = Handlebars.compile(
          this._ySublabel,
        );
      }
    }
    // don't think this can happen, keep typescript happy
    if (!this.__cache__.ySublabelHandlebarsCompiled) {
      throw new Error(
        `Unable to compile handlebars yLabel for ${this._ySublabel}`,
      );
    }

    return this.__cache__.ySublabelHandlebarsCompiled(context, runtimeOptions);
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

    this.__cache__.yLabelRightHandlebarsCompiled = null;
  }

  handlebarsYLabelRight(context: object, runtimeOptions: object): string {
    if (!isDef(this.__cache__.yLabelRightHandlebarsCompiled)) {
      if (!isDef(this._yLabelRight) || this._yLabelRight.length === 0) {
        // empty label
        return "";
      } else {
        this.__cache__.yLabelRightHandlebarsCompiled = Handlebars.compile(
          this._yLabelRight,
        );
      }
    }
    // don't think this can happen, keep typescript happy
    if (!this.__cache__.yLabelRightHandlebarsCompiled) {
      throw new Error(
        `Unable to compile handlebars yLabelRight for ${this._yLabelRight}`,
      );
    }

    return this.__cache__.yLabelRightHandlebarsCompiled(
      context,
      runtimeOptions,
    );
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
      1 / ((1000 * timeRange.toDuration().toMillis()) / (fakeData.length - 1));
    const fakeSeis = Seismogram.fromContiguousData(
      fakeData,
      fakeSampleRate,
      validStartTime(timeRange),
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
    Object.getOwnPropertyNames(this).forEach((name) => {
      // @ts-expect-error typescript can't handle reflections, but ok as just clone
      if (Array.isArray(this[name])) {
        // @ts-expect-error typescript can't handle reflections, but ok as just clone
        out[name] = this[name].slice();
      } else {
        // @ts-expect-error typescript can't handle reflections, but ok as just clone
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
    // empty cache
    out.__cache__ = new SeismographConfigCache();
    return out;
  }

  toString(): string {
    let outS = "";
    Object.getOwnPropertyNames(this).forEach((name) => {
      // @ts-expect-error  typescript can't handle reflections, but ok for tostring?
      outS += `  seisConfig.${name} = ${JSON.stringify(this[name])}\n`;
    });
    return outS;
  }
}

export type SeismographConfigJsonType = {
  configId: number;

  showTitle: boolean;

  title: Array<string>;

  isXAxis: boolean;
  xAxisTimeZone: string;
  isXAxisTop: boolean;
  xLabel: string;

  xLabelOrientation: string;
  xSublabel: string;
  xSublabelIsUnits: boolean;
  isYAxis: boolean;
  isYAxisRight: boolean;
  isYAxisNice: boolean;
  yLabel: string;

  yLabelRight: string;

  yLabelOrientation: string;
  ySublabel: string;
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
  fixedAmplitudeScale: null | Array<number>;

  fixedTimeScale: null | Interval;

  isLinkedAmplitudeScale: boolean;

  isLinkedTimeScale: boolean;
  isRelativeTime: boolean;
};

export function numberFormatWrapper(
  formater: (arg0: number) => string,
): (domainValue: AxisDomain) => string {
  return function (domainValue: AxisDomain) {
    if (typeof domainValue === "number") {
      return formater(domainValue);
    } else {
      throw new Error("Can only format number, " + stringify(domainValue));
    }
  };
}
export const formatCount: (arg0: number) => string = d3format("~s");
export const formatExp: (arg0: number) => string = d3format(".2e");
export const formatCountOrAmp = function (v: number): string {
  return -1 < v && v < 1 && v !== 0 ? formatExp(v) : formatCount(v);
};

export function createTimeFormatterForZone(timezone: Zone): (arg0: Date) => string {
  return (date: Date) => {
    if (timezone == null) {timezone = FixedOffsetZone.utcInstance;}
    const dt = DateTime.fromJSDate(date, {zone: timezone});
    if (dt.millisecond !== 0) {
      return dt.toFormat(".SSS");
    } else if (dt.second !== 0) {
      return dt.toFormat(":ss");
    } else if (dt.minute !== 0) {
      return dt.toFormat("HH:mm");
    } else if (dt.hour !== 0) {
      return dt.toFormat("HH:mm");
    } else if (dt.day !== 0) {
      return dt.toFormat("LL/dd");
    } else if (dt.month !== 0) {
      return dt.toFormat("yyyy/LL");
    } else  {
      return dt.toFormat("yyyy");
    }
  };
}

SeismographConfig._lastID = 0;
