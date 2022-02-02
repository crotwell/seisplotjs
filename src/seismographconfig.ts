/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */
import {insertCSS, AUTO_COLOR_SELECTOR, G_DATA_SELECTOR} from "./cssutil";
import {SeismogramDisplayData, Seismogram} from "./seismogram";
import {StartEndDuration, isDef} from "./util";
import moment from "moment";
import * as d3 from "d3";
import type {AxisDomain} from "d3-axis";
import Handlebars from "handlebars";
export type MarginType = {
  top: number;
  right: number;
  bottom: number;
  left: number;
  toString?: () => string;
};

/** Constant for drawing seismogram using svg. */
export const DRAW_SVG = "svg";

/** Constant for drawing seismogram using canvas, axies are still svg. */
export const DRAW_CANVAS = "canvas";

/** Constant for drawing seismogram using both canvas and svg, for testing. */
export const DRAW_BOTH = "both"; // for testing

/** Constant for drawing seismogram using both canvas and svg plus alignment markers, for testing. */
export const DRAW_BOTH_ALIGN = "alignment"; // for testing

export const DEFAULT_TITLE =
  "{{#each seisDataList}}<tspan>{{onlyChangesChannel ../seisDataList @index}}</tspan> {{else}}No Data{{/each}}";

/**
 * Configuration object for Seismograph display.
 *
 */
export class SeismographConfig {
  drawingType: string; // canvas or svg

  xScaleFormat: (date: Date) => string;
  yScaleFormat: (value: number) => string;
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
  xSublabel: string;
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
  doRMean: boolean;
  doGain: boolean;
  windowAmp: boolean;
  fixedYScale: null | Array<number>;

  /** @private */
  _fixedTimeScale: null | StartEndDuration;
  linkedAmplitudeScale: null | LinkedAmpScale;

  /** @private */
  _linkedTimeScale: null | LinkedTimeScale;
  isRelativeTime: boolean;

  constructor() {
    this.drawingType = DRAW_CANVAS;
    this.isXAxis = true;
    this.isXAxisTop = false;
    this.isYAxisNice = true;
    this.isYAxis = true;
    this.isYAxisRight = false;
    this.xScaleFormat = multiFormatHour;
    this.yScaleFormat = formatCountOrAmp;
    this._title = [DEFAULT_TITLE];
    this._titleHandlebarsCompiled = null;
    this.showTitle = true;
    this._xLabel = "Time";
    this.xLabelOrientation = "horizontal";
    this.xSublabel = "";
    this._yLabel = "Amplitude";
    this._yLabelRight = "";
    this._xLabelHandlebarsCompiled = null;
    this.yLabelOrientation = "vertical";
    this._yLabelHandlebarsCompiled = null;
    this._yLabelRightHandlebarsCompiled = null;
    this.ySublabel = "";
    this.ySublabelTrans = 15;
    this.ySublabelIsUnits = true;
    this.doRMean = true;
    this.doGain = true;
    this.windowAmp = true;
    this.fixedYScale = null;
    this._fixedTimeScale = null;
    this.linkedAmplitudeScale = null;
    this._linkedTimeScale = new LinkedTimeScale();
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
      "black",
    ];
    this.lineWidth = 1;
  }

  static fromJSON(json: any): SeismographConfig {
    let seisConfig = new SeismographConfig();
    Object.assign(seisConfig, json);
    seisConfig.linkedAmplitudeScale = null;

    if (json.isLinkedTimeScale) {
      seisConfig._linkedTimeScale = new LinkedTimeScale();
    }

    if (json.isLinkedAmplitudeScale) {
      seisConfig.linkedAmplitudeScale = new LinkedAmpScale();
    }

    return seisConfig;
  }

  asJSON(): any {
    // kind of dumb...
    let out = JSON.parse(JSON.stringify(this));
    out.title = out._title;
    delete out._title;
    out.fixedYScale = out._fixedYScale;
    delete out._fixedYScale;
    out.fixedTimeScale = out._fixedTimeScale;
    delete out._fixedTimeScale;
    delete out._linkedTimeScale;
    out.isLinkedTimeScale = isDef(this._linkedTimeScale);
    out.isLinkedAmplitudeScale = isDef(this.linkedAmplitudeScale);
    delete out._titleHandlebarsCompiled;
    return out;
  }

  get fixedTimeScale(): null | StartEndDuration {
    return this._fixedTimeScale;
  }

  set fixedTimeScale(ts: null | StartEndDuration) {
    this._fixedTimeScale = ts;
    this._linkedTimeScale = null;
  }

  get linkedTimeScale(): null | LinkedTimeScale {
    return this._linkedTimeScale;
  }

  set linkedTimeScale(ts: null | LinkedTimeScale) {
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

  handlebarsXLabel(context: {}, runtimeOptions: {}): string {
    if (!isDef(this._xLabelHandlebarsCompiled)) {
      if (!isDef(this._xLabel) || this._xLabel.length === 0) {
        // empty label
        return "";
      } else {
        this._xLabelHandlebarsCompiled = Handlebars.compile(this._xLabel);
      }
    }

    return this._xLabelHandlebarsCompiled(context, runtimeOptions);
  }

  /**
   * gets the current title
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

  handlebarsYLabel(context: {}, runtimeOptions: {}): string {
    if (!isDef(this._yLabelHandlebarsCompiled)) {
      if (!isDef(this._yLabel) || this._yLabel.length === 0) {
        // empty label
        return "";
      } else {
        this._yLabelHandlebarsCompiled = Handlebars.compile(this._yLabel);
      }
    }

    return this._yLabelHandlebarsCompiled(context, runtimeOptions);
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

    return this._yLabelRightHandlebarsCompiled(context, runtimeOptions);
  }

  /**
   * Fake data to use to test alignment of seismograph axis and between canvas
   *  and svg drawing.
   *
   * @param   timeWindow start and end of fake data
   * @param   min        min amplitude for fake data, default is -100
   * @param   max        max amplitude for fake data, default is 100
   * @returns             fake data
   */
  createAlignmentData(
    timeWindow: StartEndDuration,
    min: number = -100,
    max: number = 100,
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
      1 / (timeWindow.duration.asSeconds() / (fakeData.length - 1));
    const fakeSeis = Seismogram.createFromContiguousData(
      fakeData,
      fakeSampleRate,
      timeWindow.startTime,
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
    let numColors = this.lineColors.length;
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
    let out = new SeismographConfig();
    Object.getOwnPropertyNames(this).forEach(name => {
      // @ts-ignore
      if (moment.isMoment(this[name])) {
        // @ts-ignore
        out[name] = moment.utc(this[name]);
        // @ts-ignore
      } else if (Array.isArray(this[name])) {
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
export class AmplitudeScalable {
  middle: number;
  halfWidth: number;

  constructor(middle: number, halfWidth: number) {
    this.middle = middle;
    this.halfWidth = halfWidth;
  }

  getAmplitudeRange(): Array<number> {
    return [-1, 1]; // default
  }

  // eslint-disable-next-line no-unused-vars
  notifyAmplitudeChange(minAmp: number, maxAmp: number) {
    // no-op
  }
}
export class TimeScalable {
  alignmentTimeOffset: moment.Duration;
  duration: moment.Duration;

  constructor(
    alignmentTimeOffset: moment.Duration,
    duration: moment.Duration,
  ) {
    this.alignmentTimeOffset = alignmentTimeOffset;
    this.duration = duration;
  }

  // eslint-disable-next-line no-unused-vars
  notifyTimeRangeChange(
    alignmentTimeOffset: moment.Duration,
    duration: moment.Duration,
  ) {
    // no-op
  }
}

/**
 * Links amplitude scales across multiple seismographs, respecting doRmean.
 *
 * @param graphList optional list of AmplitudeScalable to link
 */
export class LinkedAmpScale {
  /**
   * @private
   */
  _graphSet: Set<AmplitudeScalable>;

  constructor(graphList?: Array<AmplitudeScalable>) {
    const glist = graphList ? graphList : []; // in case null

    this._graphSet = new Set(glist);
  }

  /**
   * Link new Seismograph with this amplitude scale.
   *
   * @param   graph AmplitudeScalable to link
   */
  link(graph: AmplitudeScalable) {
    this._graphSet.add(graph);

    this.recalculate();
  }

  /**
   * Unlink Seismograph with this amplitude scale.
   *
   * @param   graph AmplitudeScalable to unlink
   */
  unlink(graph: AmplitudeScalable) {
    this._graphSet.delete(graph);

    this.recalculate();
  }

  /**
   * Recalculate the best amplitude scale for all Seismographs. Causes a redraw.
   */
  recalculate() {
    const graphList = Array.from(this._graphSet.values());
    const maxHalfRange = graphList.reduce((acc, cur) => {
      return acc > cur.halfWidth ? acc : cur.halfWidth;
    }, 0);
    graphList.forEach(g => {
      g.notifyAmplitudeChange(g.middle - maxHalfRange, g.middle + maxHalfRange);
    });
  }
}

/**
 * Links time scales across multiple seismographs.
 *
 * @param graphList optional list of TimeScalables to link
 */
export class LinkedTimeScale {
  /**
   * @private
   */
  _graphSet: Set<TimeScalable>;
  _originalDuration: moment.Duration;
  _originalStartOffset: moment.Duration;
  _zoomedDuration: null | moment.Duration;
  _zoomedStartOffset: null | moment.Duration;

  constructor(
    graphList?: Array<TimeScalable>,
    originalDuration?: moment.Duration,
    originalStartOffset?: moment.Duration,
  ) {
    const glist = graphList ? graphList : []; // in case null

    this._graphSet = new Set(glist);
    this._zoomedDuration = null;
    this._zoomedStartOffset = null;

    if (originalDuration) {
      this._originalDuration = originalDuration;
      // so know that duration passed in instead of calculated
      // this prevents future links from causeing recalc
      this._zoomedDuration = originalDuration;
    } else {
      this._originalDuration = glist.reduce((acc, cur) => {
        return acc.asMilliseconds() > cur.duration.asMilliseconds()
          ? acc
          : cur.duration;
      }, moment.duration(0));
    }

    if (originalStartOffset) {
      this._originalStartOffset = originalStartOffset;
    } else {
      this._originalStartOffset = moment.duration(0, "seconds");
    }
  }

  /**
   * Link new TimeScalable with this time scale.
   *
   * @param   graph TimeScalable to link
   */
  link(graph: TimeScalable) {
    this._graphSet.add(graph);

    if (!isDef(this._zoomedDuration)) {
      // assume before any zooming, so recalc duration
      if (
        graph.duration.asMilliseconds() >
        this._originalDuration.asMilliseconds()
      ) {
        this._originalDuration = graph.duration.clone();
      }
    }

    this.recalculate();
  }

  /**
   * Unlink TimeScalable with this amplitude scale.
   *
   * @param   graph TimeScalable to unlink
   */
  unlink(graph: TimeScalable) {
    this._graphSet.delete(graph);

    this.recalculate();
  }

  zoom(startOffset: moment.Duration, duration: moment.Duration) {
    this._zoomedDuration = duration;
    this._zoomedStartOffset = startOffset;
    this.recalculate();
  }

  unzoom() {
    this._zoomedDuration = null;
    this._zoomedStartOffset = null;
    this.recalculate();
  }

  get offset(): moment.Duration {
    return this._zoomedStartOffset
      ? this._zoomedStartOffset
      : this._originalStartOffset;
  }

  set offset(offset: moment.Duration) {
    this._originalStartOffset = offset;
    this.recalculate();
  }

  get duration(): moment.Duration {
    return this._zoomedDuration ? this._zoomedDuration : this._originalDuration;
  }

  set duration(duration: moment.Duration) {
    this._originalDuration = duration;
    this.recalculate();
  }

  /**
   * Recalculate the best time scale for all Seismographs. Causes a redraw.
   */
  recalculate() {
    const graphList = Array.from(this._graphSet.values());
    graphList.forEach(graph => {
      // run later via event loop
      setTimeout(() => {
        graph.notifyTimeRangeChange(this.offset, this.duration);
      });
    });
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
export function createEditor(
  div: any,
  config: SeismographConfig,
  onChange: () => void,
) {
  if (!isDef(div)) {
    throw new Error("div is Required");
  }

  let titleDiv = div.append("div");
  createBooleanOptionByKey(
    titleDiv.append("span"),
    "",
    "showTitle",
    config,
    onChange,
  );
  createTextOption(titleDiv.append("span"), "Title", "title", config, onChange);
  titleDiv
    .selectAll("input")
    .classed("smallconfigtext", false)
    .classed("bigconfigtext", true);
  let xLabelDiv = div.append("div");
  xLabelDiv.append("span").text("X Axis:");
  createBooleanOptionByKey(
    xLabelDiv.append("span"),
    "Bot",
    "isXAxis",
    config,
    onChange,
  );
  createBooleanOptionByKey(
    xLabelDiv.append("span"),
    "Top",
    "isXAxisTop",
    config,
    onChange,
  );
  createTextOption(
    xLabelDiv.append("span"),
    "X Label",
    "xLabel",
    config,
    onChange,
  );
  createTextOption(
    xLabelDiv.append("span"),
    "Sublabel",
    "xSublabel",
    config,
    onChange,
  );
  createBooleanOptionByKey(
    xLabelDiv.append("span"),
    "Relative",
    "isRelativeTime",
    config,
    onChange,
  );
  let yLabelDiv = div.append("div");
  yLabelDiv.append("span").text("Y Axis:");
  createBooleanOptionByKey(
    yLabelDiv.append("span"),
    "Left",
    "isYAxis",
    config,
    onChange,
  );
  createBooleanOptionByKey(
    yLabelDiv.append("span"),
    "Right",
    "isYAxisRight",
    config,
    onChange,
  );
  createTextOption(
    yLabelDiv.append("span"),
    "Label",
    "yLabel",
    config,
    onChange,
  );
  createTextOption(
    yLabelDiv.append("span"),
    " Sublabel",
    "ySublabel",
    config,
    onChange,
  );
  createBooleanOptionByKey(
    yLabelDiv.append("span"),
    "is Units",
    "ySublabelIsUnits",
    config,
    onChange,
  );
  let yLabelDivB = div.append("div");
  createBooleanOptionByKey(
    yLabelDivB.append("span"),
    "Nice",
    "isYAxisNice",
    config,
    onChange,
  );
  createBooleanOptionByKey(
    yLabelDivB.append("span"),
    "From Mid",
    "doRMean",
    config,
    onChange,
  );
  createBooleanOptionByKey(
    yLabelDivB.append("span"),
    "Window",
    "windowAmp",
    config,
    onChange,
  );
  let marginDiv = div.append("div");
  marginDiv.append("label").text("Margin:");
  createTextOption(
    marginDiv.append("span"),
    "Left",
    "left",
    config.margin,
    onChange,
  );
  createTextOption(
    marginDiv.append("span"),
    "Right",
    "right",
    config.margin,
    onChange,
  );
  createTextOption(
    marginDiv.append("span"),
    "Top",
    "top",
    config.margin,
    onChange,
  );
  createTextOption(
    marginDiv.append("span"),
    "Bottom",
    "bottom",
    config.margin,
    onChange,
  );
  let colorDiv = div.append("div");
  colorDiv.append("label").text("Color:");
  let subDiv = colorDiv.append("span");
  config.lineColors.forEach((color, index) => {
    let colorspan = subDiv.append("span");
    colorspan.style("color", color);
    colorspan.append("label").text(`${index + 1}:`);
    colorspan
      .append("input")
      .classed("smallconfigtext", true)
      .attr("type", "text")
      .attr("name", `color${index + 1}`)
      .property("value", color)
      .on("change", function () {
        // @ts-ignore
        let val = d3.select(this).property("value");
        config.lineColors[index] = val;
        colorspan.style("color", val);
        colorspan.select("input").style("color", val);
        onChange();
      });
    colorspan.select("input").style("color", color);
  });
  createTextOption(
    div.append("div"),
    "Line Width",
    "lineWidth",
    config,
    onChange,
  );
  createBooleanOptionByKey(
    div.append("div"),
    "Connect Segments",
    "connectSegments",
    config,
    onChange,
  );
  createBooleanOptionByKey(
    div.append("div"),
    "Show Markers",
    "doMarkers",
    config,
    onChange,
  );
  const heightDiv = div.append("div");
  heightDiv.append("label").text("Height:");
  let subHeightDiv = heightDiv.append("span");
  createTextOption(
    subHeightDiv.append("span"),
    "Min",
    "minHeight",
    config,
    onChange,
  );
  createTextOption(
    subHeightDiv.append("span"),
    "Max",
    "maxHeight",
    config,
    onChange,
  );
  createBooleanOptionByKey(
    div.append("div"),
    "Mouse Wheel Zoom",
    "wheelZoom",
    config,
    onChange,
  );
}

function createBooleanOptionByKey(
  myspan: any,
  label: string,
  key: string,
  config: SeismographConfig,
  onChange: () => void,
) {
  myspan
    .append("input")
    .attr("type", "checkbox")
    .attr("id", key)
    .attr("name", key) // @ts-ignore
    .property("checked", config[key])
    .on("change", function () {
      // @ts-ignore
      config[key] = d3.select(this).property("checked");
      onChange();
    });
  myspan.append("label").text(`${label}:`);
  return myspan;
}

function createTextOption(
  mydiv: any,
  label: string,
  key: string,
  config: any,
  onChange: () => void,
) {
  const myspan = mydiv.append("span");
  myspan.append("label").text(`${label}:`);
  myspan
    .append("input")
    .classed("smallconfigtext", true)
    .attr("type", "text")
    .attr("id", key)
    .attr("name", key) //$FlowExpectedError
    .property("value", config[key])
    .on("change", function () {
      // @ts-ignore
      config[key] = d3.select(this).property("value");
      onChange();
    });
  return myspan;
}

export const configEditor_css = `
input[type="text"].smallconfigtext {
  width: 7em;
}

input[type="text"].bigconfigtext {
  width: 27em;
}
`;

if (document) {
  insertCSS(configEditor_css, "configeditor");
}
