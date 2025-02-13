/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * https://www.seis.sc.edu
 */
import { DateTime, Duration, Interval, Zone, FixedOffsetZone } from "luxon";
import { removeTrend } from "./filter";
import { AMPLITUDE_MODE, FixedHalfWidthAmplitudeScale } from "./scale";
import {
  Seismogram,
  SeismogramDisplayData,
  findMinMaxOverTimeRange,
} from "./seismogram";
import { SeismogramSegment } from "./seismogramsegment";
import { Seismograph } from "./seismograph";
import { SeismographConfig } from "./seismographconfig";
import { SeisPlotElement } from "./spelement";
import {
  isDef, validStartTime, validEndTime, startDuration, nameForTimeZone
} from "./util";

export const HELI_CLICK_EVENT = "heliclick";
export const HELI_MOUSE_MOVE_EVENT = "helimousemove";

export const HELICORDER_ELEMENT = "sp-helicorder";

/**
 * A helicorder-like multi-line seismogram display usually covering 24 hours
 *
 * @param inSvgParent the parent element, usually a div tag
 * @param heliConfig configuration object
 * @param seisData the data to display
 */
export class Helicorder extends SeisPlotElement {
  constructor(
    seisData?: Array<SeismogramDisplayData>,
    seisConfig?: SeismographConfig,
  ) {
    let heliConfig;
    if (!seisConfig) {
      const timeWindow = Interval.before(
        DateTime.utc(),
        Duration.fromObject({ hours: 24 }),
      );
      heliConfig = new HelicorderConfig(timeWindow);
    } else if (seisConfig instanceof HelicorderConfig) {
      heliConfig = seisConfig;
    } else {
      heliConfig = HelicorderConfig.fromSeismographConfig(seisConfig);
    }
    super(seisData, heliConfig);
    if (seisData && seisData.length > 1) {
      throw new Error(
        `Helicorder seisData must be length 1, but was ${seisData.length}`,
      );
    }

    const wrapper = document.createElement("div");
    wrapper.setAttribute("class", "wrapper");
    this.addStyle(helicorder_css);
    this.getShadowRoot().appendChild(wrapper);
    // event listener to transform mouse click into time
    this.addEventListener("click", (evt) => {
      const detail = this.calcDetailForEvent(evt);
      const event = new CustomEvent(HELI_CLICK_EVENT,
        { detail: detail,
          bubbles: true,
          cancelable: false,
          composed: true
        }
      );
      this.dispatchEvent(event);
    });
    this.addEventListener("mousemove", (evt) => {
      const detail = this.calcDetailForEvent(evt);
      const event = new CustomEvent(HELI_MOUSE_MOVE_EVENT,
        { detail: detail,
          bubbles: true,
          cancelable: false,
          composed: true
        }
      );
      this.dispatchEvent(event);
    });
    this.addEventListener(HELI_MOUSE_MOVE_EVENT, (hEvent) => {
      const detail = (hEvent as CustomEvent).detail as HeliMouseEventType;
      wrapper.querySelectorAll(`sp-seismograph`).forEach((seismograph, idx) => {
        if (idx === detail.lineNum) {
          let selectedStyle =
            seismograph.shadowRoot?.querySelector("style.selection");
          if (!selectedStyle) {
            selectedStyle = document.createElement("style");
            seismograph.shadowRoot?.insertBefore(
              selectedStyle,
              seismograph.shadowRoot?.firstChild,
            );
            selectedStyle.setAttribute("class", "selection");
            selectedStyle.textContent = `
              svg g.yLabel text {
                font-weight: bold;
                text-decoration: underline;
              }
            `;
          }
        } else {
          seismograph.shadowRoot?.querySelector("style.selection")?.remove();
        }
      });
    });
  }
  get heliConfig(): HelicorderConfig {
    return this.seismographConfig as HelicorderConfig;
  }
  set heliConfig(config: HelicorderConfig) {
    this.seismographConfig = config;
  }
  get width(): number {
    const wrapper = this.getShadowRoot().querySelector(
      "div.wrapper",
    ) as HTMLDivElement;
    const rect = wrapper.getBoundingClientRect();
    return rect.width;
  }
  get height(): number {
    const wrapper = this.getShadowRoot().querySelector(
      "div.wrapper",
    ) as HTMLDivElement;
    const rect = wrapper.getBoundingClientRect();
    return rect.height;
  }

  appendSegment(segment: SeismogramSegment) {
    const segMinMax = segment.findMinMax();
    const origMinMax = this.heliConfig.fixedAmplitudeScale;
    const heliTimeRange = this.heliConfig.fixedTimeScale;
    if (!heliTimeRange) {
      throw new Error("Heli is not fixedTimeScale");
    }
    if (validEndTime(heliTimeRange) < validEndTime(segment.timeRange)) {
      const lineDuration = Duration.fromMillis(
        heliTimeRange.toDuration().toMillis() / this.heliConfig.numLines,
      );

      this.heliConfig.fixedTimeScale = Interval.fromDateTimes(
        validStartTime(heliTimeRange).plus(lineDuration),
        validEndTime(heliTimeRange).plus(lineDuration),
      );
      this.redraw();
    }
    if (this.seisData && this.seisData.length > 0) {
      const singleSeisData = this.seisData[0];
      singleSeisData.append(segment);
      if (
        validEndTime(heliTimeRange) < validEndTime(segment.timeRange) ||
        (origMinMax &&
          (segMinMax.min < origMinMax[0] || origMinMax[1] < segMinMax.max))
      ) {
        this.redraw(); //redraw because amp changed
      } else {
        // only redraw overlaping graphs

        const seismographList: Array<Seismograph> = this.shadowRoot
          ? Array.from(this.shadowRoot.querySelectorAll("sp-seismograph"))
          : [];
        seismographList.forEach((seisGraph) => {
          const lineInterval =
            seisGraph.displayTimeRangeForSeisDisplayData(singleSeisData);
          if (segment.timeRange.intersection(lineInterval)) {
            // overlaps
            const lineSeisData = this.cutForLine(singleSeisData, lineInterval);

            seisGraph.seisData = [lineSeisData];
          }
        });
      }
    } else {
      // heli is empty
      const sdd = SeismogramDisplayData.fromSeismogram(new Seismogram(segment));
      this.seisData = [sdd];
    }
  }
  /**
   * draws the helicorder.
   */
  draw() {
    this.heliConfig.lineSeisConfig.amplitudeMode =
      this.heliConfig.amplitudeMode;
    this.drawSeismograms();
  }

  /**
   * draws or redraws the seismograms in the helicorder
   *
   * @private
   */
  drawSeismograms(): void {
    if (!this.isConnected) {
      return;
    }
    const wrapper = this.getShadowRoot().querySelector("div") as HTMLDivElement;
    const timeRange = this.heliConfig.fixedTimeScale;

    if (!isDef(timeRange)) {
      throw new Error("Helicorder config must have fixedTimeScale set");
    }

    let maxVariation = 1;
    let singleSeisData;
    if (this.seisData.length !== 0) {
      singleSeisData = this.seisData[0];
    } else {
      singleSeisData = new SeismogramDisplayData(timeRange);
    }
    if (singleSeisData.seismogram) {
      const mul_percent = 1.01;
      if (
        !this.heliConfig.fixedAmplitudeScale ||
        (this.heliConfig.fixedAmplitudeScale[0] === 0 &&
          this.heliConfig.fixedAmplitudeScale[1] === 0)
      ) {
        if (this.heliConfig.maxVariation === 0) {
          if (singleSeisData.seismogram.timeRange.overlaps(timeRange)) {
            const minMax = findMinMaxOverTimeRange(
              [singleSeisData],
              timeRange,
              false,
              this.heliConfig.amplitudeMode,
            );
            maxVariation = minMax.expandPercentage(mul_percent).fullWidth;
          }
        } else {
          maxVariation = this.heliConfig.maxVariation;
        }
        if (this.heliConfig.lineSeisConfig.linkedAmplitudeScale) {
          this.heliConfig.lineSeisConfig.linkedAmplitudeScale.halfWidth =
            maxVariation;
        }
      }
    }

    const startTime = validStartTime(timeRange);
    const secondsPerLine =
      timeRange.toDuration().toMillis() / 1000 / this.heliConfig.numLines;
    wrapper.querySelectorAll("sp-seismograph").forEach((e) => e.remove());

    const lineTimes = this.calcTimesForLines(
      startTime,
      secondsPerLine,
      this.heliConfig.numLines,
    );
    const margin = this.heliConfig.margin;
    const nl = this.heliConfig.numLines;
    const maxHeight =
      this.heliConfig.maxHeight !== null
        ? this.heliConfig.maxHeight
        : DEFAULT_MAX_HEIGHT;
    const baseHeight =
      (maxHeight - margin.top - margin.bottom) /
      (nl - (nl - 1) * this.heliConfig.overlap);

    for (const lineTime of lineTimes) {
      const lineNumber = lineTime.lineNumber;
      const lineInterval = lineTime.interval;
      let startTime = lineTime.interval.start;
      const endTime = lineTime.interval.end;
      let height = baseHeight;
      const marginTop =
        lineNumber === 0
          ? 0
          : Math.round(-1.0 * height * this.heliConfig.overlap);
      const lineSeisConfig = this.heliConfig.lineSeisConfig.clone();
      // don't title lines past the first
      lineSeisConfig.showTitle = false;

      if (lineNumber === 0) {
        lineSeisConfig.showTitle = true;
        lineSeisConfig.title = this.heliConfig.title;
        lineSeisConfig.isXAxisTop = this.heliConfig.isXAxisTop;
        lineSeisConfig.margin.top += this.heliConfig.margin.top;
        height += this.heliConfig.margin.top;
      } else if (lineNumber === nl - 1) {
        lineSeisConfig.isXAxis = this.heliConfig.isXAxis;
        lineSeisConfig.margin.bottom += this.heliConfig.margin.bottom;
        lineSeisConfig.xLabel = this.heliConfig.xLabel;
        lineSeisConfig.xSublabel = this.heliConfig.xSublabel;
        height += this.heliConfig.margin.bottom;
      }

      lineSeisConfig.xAxisTimeZone = this.heliConfig.xAxisTimeZone;
      lineSeisConfig.fixedTimeScale = lineInterval;
      lineSeisConfig.yLabel = `${startTime?.setZone(this.heliConfig.yLabelTimeZone).toFormat("HH:mm")}`;
      lineSeisConfig.yLabelRight = `${endTime?.setZone(this.heliConfig.yLabelRightTimeZone).toFormat("HH:mm")}`;
      lineSeisConfig.lineColors = [
        this.heliConfig.lineColors[
          lineNumber % this.heliConfig.lineColors.length
        ],
      ];
      const lineSeisData = this.cutForLine(singleSeisData, lineInterval);

      if (
        this.heliConfig.fixedAmplitudeScale &&
        (this.heliConfig.fixedAmplitudeScale[0] !== 0 ||
          this.heliConfig.fixedAmplitudeScale[1] !== 0)
      ) {
        lineSeisConfig.fixedAmplitudeScale =
          this.heliConfig.fixedAmplitudeScale;
      }

      const seismograph = new Seismograph([lineSeisData], lineSeisConfig);
      seismograph.svg.classed(HELICORDER_SELECTOR, true);
      seismograph.setAttribute("class", "heliLine");
      seismograph.setAttribute(
        "style",
        `height: ${height}px;margin-top: ${marginTop}px`,
      );
      const seismographWrapper = seismograph.shadowRoot?.querySelector(
        "div",
      ) as HTMLDivElement;
      const styleEl = document.createElement("style");
      const seismographRoot = seismograph.shadowRoot;
      if (seismographRoot) {
        const helicss = seismographRoot.insertBefore(
          styleEl,
          seismographWrapper,
        );
        helicss.textContent = `
        .yLabel text {
          font-size: x-small;
          fill: ${lineSeisConfig.lineColors[0]};
        }
        .utclabels {
          position: relative;
          font-size: x-small;
          width: 100%;
        }
        .utclabels div {
          display: flex;
          position: absolute;
          left: 0px;
          justify-content: space-between;
          width: 100%;
          z-index: -1;
        }
        `;
      }

      wrapper.appendChild(seismograph);
      if (lineNumber === 0) {
        const utcDiv = document.createElement("div");
        utcDiv.setAttribute("class", "utclabels");
        const innerDiv = utcDiv.appendChild(document.createElement("div"));
        innerDiv.setAttribute("style", `top: ${lineSeisConfig.margin.top}px;`);
        const textEl = innerDiv.appendChild(document.createElement("text"));
        textEl.textContent = nameForTimeZone(this.heliConfig.yLabelTimeZone, startTime);
        // and to top right
        const rightTextEl = innerDiv.appendChild(
          document.createElement("text"),
        );
        rightTextEl.textContent = nameForTimeZone(this.heliConfig.yLabelRightTimeZone, startTime);
        seismographWrapper.insertBefore(utcDiv, seismographWrapper.firstChild);
      }

      startTime = endTime;
    }
  }

  cutForLine(
    singleSeisData: SeismogramDisplayData,
    lineInterval: Interval,
  ): SeismogramDisplayData {
    let lineCutSeis = null;
    let lineSeisData;

    if (singleSeisData.seismogram) {
      lineCutSeis = singleSeisData.seismogram.cut(lineInterval);
      if (lineCutSeis && this.heliConfig.detrendLines) {
        lineCutSeis = removeTrend(lineCutSeis);
      }
      lineSeisData = singleSeisData.cloneWithNewSeismogram(lineCutSeis);
    } else {
      // no data in window, but keep seisData in case of markers, etc
      lineSeisData = singleSeisData.clone();
    }

    lineSeisData.timeRange = lineInterval;
    return lineSeisData;
  }
  /**
   * Calculates the time range covered by each line of the display
   *
   * @param   startTime      start of display
   * @param   secondsPerLine seconds covered by each line
   * @param   numberOfLines  number of lines
   * @returns Array of HeliTimeRange, one per line
   */
  calcTimesForLines(
    startTime: DateTime,
    secondsPerLine: number,
    numberOfLines: number,
  ): Array<HeliTimeRange> {
    const out = [];
    let s = startTime;
    const durationPerLine = Duration.fromMillis(secondsPerLine * 1000);
    for (let lineNum = 0; lineNum < numberOfLines; lineNum++) {
      const startEnd = new HeliTimeRange(s, durationPerLine, lineNum);
      out.push(startEnd);
      s = validEndTime(startEnd.interval);
    }

    return out;
  }
  calcDetailForEvent(evt: MouseEvent): HeliMouseEventType {
    const heliMargin = this.heliConfig.margin;
    const margin = this.heliConfig.lineSeisConfig.margin;
    const nl = this.heliConfig.numLines;
    const maxHeight =
      this.heliConfig.maxHeight !== null
        ? this.heliConfig.maxHeight
        : DEFAULT_MAX_HEIGHT;
    const baseHeight =
      (maxHeight - (heliMargin.top + heliMargin.bottom)) /
      (nl - (nl - 1) * this.heliConfig.overlap);

    let clickLine = 0;
    if (evt.offsetY < heliMargin.top + baseHeight * 0.5) {
      clickLine = 0;
    } else {
      clickLine = Math.round(
        (evt.offsetY - heliMargin.top - baseHeight * 0.5) /
          (baseHeight * (1 - this.heliConfig.overlap)),
      );
    }
    const timeRange = this.heliConfig.fixedTimeScale;
    if (timeRange) {
      const timeLineFraction =
        (evt.offsetX - margin.left) / (this.width - margin.left - margin.right);

      const secondsPerLine =
        timeRange.toDuration().toMillis() / 1000 / this.heliConfig.numLines;
      const clickTime = validStartTime(timeRange).plus(
        Duration.fromMillis(
          (clickLine + timeLineFraction) * secondsPerLine * 1000,
        ),
      );
      return {
        mouseevent: evt,
        time: clickTime,
        lineNum: clickLine,
      };
    } else {
      throw new Error("Helicorder must be fixedTimeScale");
    }
  }
}
export const DEFAULT_MAX_HEIGHT = 600;

/**
 * Configuration of the helicorder
 *
 * Note that setting maxVariation=0 and fixedAmplitudeScale=[0,0] will scale the
 * data to max
 *
 * @param timeRange the time range covered by the helicorder, required
 */
export class HelicorderConfig extends SeismographConfig {
  lineSeisConfig: SeismographConfig;
  overlap: number;
  numLines: number;
  maxVariation: number;
  detrendLines = false;
  yLabelTimeZone: string|Zone<boolean> = FixedOffsetZone.utcInstance;
  yLabelRightTimeZone: string|Zone<boolean> = FixedOffsetZone.utcInstance;

  constructor(timeRange: Interval) {
    super();

    if (!isDef(timeRange)) {
      throw new Error("Helicorder config must have fixedTimeScale set");
    }

    this.fixedTimeScale = timeRange;
    this.maxVariation = 0;
    this.maxHeight = DEFAULT_MAX_HEIGHT;
    this.xLabel = "";
    this.yLabel = "";
    this.xSublabel = "";
    this.ySublabel = " ";
    this.ySublabelIsUnits = false;
    this.isXAxis = true;
    this.isXAxisTop = true;
    this.isYAxis = false;
    this.overlap = 0.5;
    this.numLines = 12;
    this.margin.left = 0;
    this.margin.right = 0;
    this.margin.top = 40;
    this.lineColors = ["skyblue", "olivedrab", "goldenrod"];
    this.lineSeisConfig = new SeismographConfig();
    this.lineSeisConfig.amplitudeMode = AMPLITUDE_MODE.MinMax;
    this.lineSeisConfig.linkedAmplitudeScale = new FixedHalfWidthAmplitudeScale(
      1,
    );

    this.lineSeisConfig.ySublabel = ` `;
    this.lineSeisConfig.xLabel = " ";
    this.lineSeisConfig.yLabel = ""; // replace later with `${startTime.toFormat("HH:mm")}`;

    this.lineSeisConfig.yLabelOrientation = "horizontal";
    this.lineSeisConfig.ySublabelIsUnits = false;
    this.lineSeisConfig.isXAxis = false;
    this.lineSeisConfig.isYAxis = false;
    this.lineSeisConfig.minHeight = 80;
    this.lineSeisConfig.margin.top = 0;
    this.lineSeisConfig.margin.bottom = 0;
    this.lineSeisConfig.margin.left = 37;
    this.lineSeisConfig.margin.right = 37;
    this.lineSeisConfig.wheelZoom = false;
  }
  static fromSeismographConfig(
    seisConfig: SeismographConfig,
  ): HelicorderConfig {
    if (!seisConfig.fixedTimeScale) {
      throw new Error("Helicorder config must have fixedTimeScale set");
    }
    const heliConfig = new HelicorderConfig(seisConfig.fixedTimeScale);
    heliConfig.lineSeisConfig = seisConfig;
    heliConfig.lineColors = seisConfig.lineColors;
    return heliConfig;
  }
}

/**
 * Time range for a single line of the helicorder, extends Interval
 * to add the line number
 */
export class HeliTimeRange {
  lineNumber: number;
  interval: Interval;

  constructor(startTime: DateTime, duration: Duration, lineNumber: number) {
    this.interval = startDuration(startTime, duration);
    this.lineNumber = lineNumber;
  }
}


/** default styling for helicorder plots. */
export const helicorder_css = `
:host {
  display: block;
  min-height: 200px;
  height: 100%;
  cursor: crosshair;
}
`;

export const HELICORDER_SELECTOR = "helicorder";
export const HELI_COLOR_CSS_ID = "helicordercolors";
export type HeliMouseEventType = {
  mouseevent: MouseEvent;
  time: DateTime;
  lineNum: number;
};
customElements.define(HELICORDER_ELEMENT, Helicorder);
