Interval/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */
import {DateTime, Duration, Interval} from "luxon";
import {SeismogramDisplayData} from "./seismogram";
import {Seismograph, COLOR_CSS_ID} from "./seismograph";
import {SeismographConfig} from "./seismographconfig";
import {SeisPlotElement} from "./spelement";
import { isDef} from "./util";

export const HELICORDER_ELEMENT = 'sp-helicorder';

/**
 * A helicorder-like multi-line seismogram display usually covering 24 hours
 *
 * @param inSvgParent the parent element, usually a div tag
 * @param heliConfig configuration object
 * @param seisData the data to display
 */
export class Helicorder extends SeisPlotElement {
  seismographArray: Array<Seismograph>;

  constructor(seisData?: Array<SeismogramDisplayData>, seisConfig?: SeismographConfig) {
    let heliConfig;
    if ( ! seisConfig) {
      let timeWindow = Interval.before(DateTime.utc(), Duration.fromObject({hours: 24}));
      heliConfig = new HelicorderConfig(timeWindow);
    } else if (seisConfig instanceof HelicorderConfig) {
      heliConfig = seisConfig;
    } else {
      heliConfig = HelicorderConfig.fromSeismographConfig(seisConfig);
    }
    super(seisData, heliConfig);
    if (seisData && seisData.length > 1) {
      throw new Error(`Helicorder seisData must be length 1, but was ${seisData.length}`);
    }
    this.seismographArray = [];

    const shadow = this.attachShadow({mode: 'open'});
    const wrapper = document.createElement('div');
    wrapper.setAttribute("class", "wrapper");
    const style = shadow.appendChild(document.createElement('style'));
    style.textContent = helicorder_css;
    const lineColorsStyle = shadow.appendChild(document.createElement('style'));
    const lineColorsCSS = heliConfig.createCSSForLineColors();
    lineColorsStyle.setAttribute("id", COLOR_CSS_ID);
    lineColorsStyle.textContent = lineColorsCSS;
    shadow.appendChild(wrapper);
  }
  get heliConfig(): HelicorderConfig {
    return this.seismographConfig as HelicorderConfig;
  }
  set heliConfig(config: HelicorderConfig) {
    this.seismographConfig = config;
  }
  /**
   * draws, or redraws, the helicorder.
   */
  draw() {
    this.heliConfig.lineSeisConfig.doRMean = this.heliConfig.doRMean;
    this.drawSeismograms();
  }

  /**
   * draws or redraws the seismograms in the helicorder
   *
   * @private
   */
  drawSeismograms(): void {
    if ( ! this.isConnected) { return; }
    const wrapper = (this.shadowRoot?.querySelector('div') as HTMLDivElement);
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
      const seis = singleSeisData.seismogram;

      if (!this.heliConfig.fixedAmplitudeScale) {
        if (this.heliConfig.maxVariation === 0) {
          const cutSeis = seis.cut(timeRange);

          if (cutSeis) {
            const [min, max] = cutSeis.findMinMax();
            const mean = cutSeis.mean();
            const posOffset = max - mean;
            const negOffset = mean - min;
            maxVariation = Math.max(posOffset, negOffset);
          }
        } else {
          maxVariation = this.heliConfig.maxVariation;
        }
      }
    }

    const startTime = timeRange.start;
    this.seismographArray = [];
    const secondsPerLine =
      timeRange.toDuration().toMillis() / 1000 / this.heliConfig.numLines;
    wrapper.querySelectorAll("sp-seismograph").forEach(e => e.remove());

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
      lineSeisConfig.title = null;

      if (lineNumber === 0) {
        lineSeisConfig.title = this.heliConfig.title;
        lineSeisConfig.isXAxisTop = this.heliConfig.isXAxisTop;
        lineSeisConfig.margin.top += this.heliConfig.margin.top;
        height += this.heliConfig.margin.top;
      } else if (lineNumber === nl - 1) {
        lineSeisConfig.isXAxis = this.heliConfig.isXAxis;
        lineSeisConfig.margin.bottom += this.heliConfig.margin.bottom;
        height += this.heliConfig.margin.bottom;
      }

      lineSeisConfig.fixedTimeScale = lineInterval;
      lineSeisConfig.yLabel = `${startTime.toFormat("HH:mm")}`;
      lineSeisConfig.yLabelRight = `${endTime.toFormat("HH:mm")}`;
      lineSeisConfig.lineColors = [
        this.heliConfig.lineColors[
          lineNumber % this.heliConfig.lineColors.length
        ],
      ];
      //      [ seisDiv.style("color")];
      let lineCutSeis = null;
      let lineSeisData;
      let lineMean = 0;

      if (singleSeisData.seismogram) {
        lineCutSeis = singleSeisData.seismogram.cut(lineInterval);
        lineSeisData = singleSeisData.cloneWithNewSeismogram(lineCutSeis);
        lineMean = lineSeisData.mean;
      } else {
        // no data in window, but keep seisData in case of markers, etc
        lineSeisData = singleSeisData.clone();
      }

      lineSeisData.timeRange = lineInterval;

      if (this.heliConfig.fixedAmplitudeScale) {
        lineSeisConfig.fixedAmplitudeScale = this.heliConfig.fixedAmplitudeScale;
      } else {
        if (this.heliConfig.doRMean) {
          lineSeisConfig.fixedAmplitudeScale = [
            lineMean - maxVariation,
            lineMean + maxVariation,
          ];
        } else {
          lineSeisConfig.fixedAmplitudeScale = [
            lineMean - maxVariation,
            lineMean + maxVariation,
          ];
        }
      }

      const seismograph = new Seismograph([lineSeisData], lineSeisConfig);
      seismograph.svg.classed(HELICORDER_SELECTOR, true);
      seismograph.setAttribute("class", "heliLine");
      seismograph.setAttribute("style", `height: ${height}px;margin-top: ${marginTop}px`);
      wrapper.appendChild(seismograph);

      if (lineNumber === 0) {
        // add UTC to top left
        seismograph.svg
          .append("g")
          .classed("yLabel", true)
          .classed("utcLabel", true)
          .append("text")
          .attr("x", 0)
          .attr("y", 0)
          .attr("text-anchor", "start")
          .attr("dy", ".75em")
          .text("UTC");
      }

      this.seismographArray.push(seismograph);
      startTime = endTime;
    }
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
    let durationPerLine = Duration.fromMillis(secondsPerLine*1000);
    for (let lineNum = 0; lineNum < numberOfLines; lineNum++) {
      const startEnd = new HeliTimeRange(s, durationPerLine, lineNum);
      out.push(startEnd);
      s = startEnd.interval.end;
    }

    return out;
  }
}
export const DEFAULT_MAX_HEIGHT = 600;

/**
 * Configuration of the helicorder
 *
 * @param timeRange the time range covered by the helicorder, required
 */
export class HelicorderConfig extends SeismographConfig {
  lineSeisConfig: SeismographConfig;
  overlap: number;
  numLines: number;
  maxVariation: number;

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
    this.margin.left = 20;
    this.margin.right = 20;
    this.margin.top = 40;
    this.lineColors = ["skyblue", "olivedrab", "goldenrod"];
    this.lineSeisConfig = new SeismographConfig();
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
    this.lineSeisConfig.doRMean = true;
  }
  static fromSeismographConfig(seisConfig: SeismographConfig): HelicorderConfig {
    if (! seisConfig.fixedTimeScale) {
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

  constructor(
    startTime: DateTime,
    duration: Duration,
    lineNumber: number,
  ) {
    this.interval = Interval.after(startTime, duration);
    this.lineNumber = lineNumber;
  }
}

/** default styling for helicorder plots. */
export const helicorder_css = `

div.helicorder {
  height: 100%;
  width: 100%;
}

div.helicorder div.heliLine .yLabel text {
  font-size: smaller;
}

div.helicorder div.heliLine:nth-child(3n+1) {
  color: skyblue;
}
div.helicorder div.heliLine:nth-child(3n+1) path.seispath {
  stroke: skyblue;
}
div.helicorder div.heliLine:nth-child(3n+2) {
  color: olivedrab;
}
div.helicorder div.heliLine:nth-child(3n+2) path.seispath {
  stroke: olivedrab;
}
div.helicorder div.heliLine:nth-child(3n) {
  color: goldenrod;
}
div.helicorder div.heliLine:nth-child(3n) path.seispath {
  stroke: goldenrod;
}
div.helicorder div.heliLine:nth-child(3n+1) .yLabel text {
  fill: skyblue;
}
div.helicorder div.heliLine:nth-child(3n+2) .yLabel text {
  fill: olivedrab;
}
div.helicorder div.heliLine:nth-child(3n) .yLabel text {
  fill: goldenrod;
}

`;
export const HELICORDER_SELECTOR = "helicorder";
export const HELI_COLOR_CSS_ID = "helicordercolors";

customElements.define(HELICORDER_ELEMENT, Helicorder);
