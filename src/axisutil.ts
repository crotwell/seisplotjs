import {SeismographConfig} from "./seismographconfig";
import {createSVGElement, checkLuxonValid, toJSDate} from "./util";
//import * as d3 from "d3";
import {scaleUtc as d3scaleUtc } from "d3-scale";
import {select as d3select} from "d3-selection";
import 'd3-transition';
import type {
  //ScaleLinear,
  ScaleTime} from "d3-scale";
import {DateTime, Interval} from "luxon";

//import type {HandlebarsInput} from "./handlebarshelpers";

export interface HandlebarsInput {
  seisConfig?: SeismographConfig,
  seisDataList?: unknown,
  seisXData?: unknown,
  seisYData?: unknown,
}

export class LuxonTimeScale {
  interval: Interval;
  range: [number, number];
  constructor(interval: Interval, range: [number, number]) {
    checkLuxonValid(interval);
    this.interval = interval;
    this.range = range.slice() as [number, number];
  }
  for(d: DateTime): number {
    return this.d3scale(toJSDate(d));
  }
  invert(v: number): DateTime {
    return DateTime.fromJSDate(this.d3scale.invert(v));
  }
  domain(): Interval {
    return this.interval;
  }
  get d3scale(): ScaleTime<number, number, never> {
    checkLuxonValid(this.interval);
    const d3TimeScale = d3scaleUtc();
    const s = toJSDate(this.interval.start);
    const e = toJSDate(this.interval.end);
    d3TimeScale.domain([s, e]);
    d3TimeScale.range(this.range);
  return d3TimeScale;
  }
  millisPerPixel(): number {
    return this.interval.length('milliseconds')/(this.range[1]-this.range[0]);
  }
}
export function drawXLabel(
  svgEl: SVGElement,
  seismographConfig: SeismographConfig,
  height: number,
  width: number,
  handlebarsInput: HandlebarsInput = {},
) {
  const svg = d3select(svgEl);
  svg.selectAll("g.xLabel").remove();

  if (seismographConfig.xLabel && seismographConfig.xLabel.length > 0) {
    const svgText = svg
      .append("g")
      .classed("xLabel", true)
      .attr(
        "transform",
        `translate(${seismographConfig.margin.left + width / 2}, ${
          height +
          seismographConfig.margin.top +
          (seismographConfig.margin.bottom * 2) / 3
        } )`,
      )
      .append("text")
      .classed("x label", true)
      .attr("text-anchor", "middle")
      .text(seismographConfig.xLabel);
    const handlebarOut = seismographConfig.handlebarsXLabel(handlebarsInput, {
      allowProtoPropertiesByDefault: true, // this might be a security issue???
    });
    svgText.html(handlebarOut);
  }
}
export function drawXSublabel(
  svgEl: SVGElement,
  seismographConfig: SeismographConfig,
  height: number,
  width: number, // eslint-disable-next-line no-unused-vars
  handlebarsInput: HandlebarsInput = {},
) {
  const svg = d3select(svgEl);
  svg.selectAll("g.xSublabel").remove();
  const svgText = svg
    .append("g")
    .classed("xSublabel", true)
    .attr(
      "transform",
      `translate(${seismographConfig.margin.left + width / 2}, ${
        height + seismographConfig.margin.top + seismographConfig.margin.bottom
      } )`,
    )
    .append("text")
    .classed("x label sublabel", true)
    .attr("text-anchor", "middle");
    const handlebarOut = seismographConfig.handlebarsXSublabel(handlebarsInput, {
      allowProtoPropertiesByDefault: true, // this might be a security issue???
    });
    svgText.html(handlebarOut);
}
export function drawYLabel(
  svgEl: SVGElement,
  seismographConfig: SeismographConfig,
  height: number,
  width: number,
  handlebarsInput: HandlebarsInput = {},
) {
  const svg = d3select(svgEl);
  svg.selectAll("g.yLabel").remove();

  for (const side of ["left", "right"]) {
    const hTranslate =
      side === "left" ? 0 : seismographConfig.margin.left + width + 1;
    const svgText = svg
      .append("g")
      .classed("yLabel", true)
      .classed(side, true)
      .attr("x", 0)
      .attr(
        "transform",
        `translate(${hTranslate}, ${
          seismographConfig.margin.top + height / 2
        })`,
      )
      .append("text");
    svgText.classed("y label", true);

    if (seismographConfig.yLabelOrientation === "vertical") {
      // vertical
      svgText
        .attr("text-anchor", "middle")
        .attr("dy", ".75em")
        .attr("transform", "rotate(-90, 0, 0)");
    } else {
      // horizontal
      if (side === "left") {
        svgText.attr("text-anchor", "start").attr("dominant-baseline", "central");
      } else {
        svgText.attr("text-anchor", "end").attr("dominant-baseline", "central");
        svgText.attr("x", seismographConfig.margin.right-1);
      }
    }

    if (side === "left") {
      const handlebarOut = seismographConfig.handlebarsYLabel(handlebarsInput, {
        allowProtoPropertiesByDefault: true, // this might be a security issue???
      });
      svgText.html(handlebarOut);
    } else {
      const handlebarOut = seismographConfig.handlebarsYLabelRight(
        handlebarsInput,
        {
          allowProtoPropertiesByDefault: true, // this might be a security issue???
        },
      );
      svgText.html(handlebarOut);
    }
  }
}
/**
 * Draws Y axis sublabel, possibly reflecting units of seismograph.
 *
 * @param  svgEl             svg to draw to
 * @param  seismographConfig  config options
 * @param  height             height of svg
 * @param  width              width of svg
 * @param  handlebarsInput    optional key-values for handlebars
 * @param  unitsLabel          option label representing units if config.ySublabelIsUnit
 */
export function drawYSublabel(
  svgEl: SVGElement,
  seismographConfig: SeismographConfig,
  height: number,
  width: number, // eslint-disable-next-line no-unused-vars
  handlebarsInput: HandlebarsInput = {},
  unitsLabel: string = "",
) {
  const svg = d3select(svgEl);
  svg.selectAll("g.ySublabel").remove();

  for (const side of ["left", "right"]) {
  const svgText = svg
    .append("g")
    .classed("ySublabel", true)
    .attr("x", 0)
    .attr(
      "transform",
      `translate( ${seismographConfig.ySublabelTrans}, ${seismographConfig.margin.top + height / 2} )`,
    )
    .append("text")
    .classed("y label sublabel", true);

  if (seismographConfig.yLabelOrientation === "vertical") {
    // vertical
    svgText
      .attr("text-anchor", "middle")
      .attr("dy", ".75em")
      .attr("transform", "rotate(-90, 0, 0)");
  } else {
    // horizontal
    if (side === "left") {
      svgText.attr("text-anchor", "start").attr("dominant-baseline", "central");
    } else {
      svgText.attr("text-anchor", "end").attr("dominant-baseline", "central");
      svgText.attr("x", seismographConfig.margin.right-1);
    }
  }

  if (seismographConfig.ySublabelIsUnits) {
    svgText.html(unitsLabel);
  } else {
    const handlebarOut = seismographConfig.handlebarsYSublabel(handlebarsInput, {
      allowProtoPropertiesByDefault: true, // this might be a security issue???
    });
    svgText.html(handlebarOut);
  }
  }
}
export function drawTitle(
  svgEl: SVGElement,
  seismographConfig: SeismographConfig,
  height: number,
  width: number,
  handlebarsInput: HandlebarsInput = {},
) {
  if (!svgEl) {
    // drawTitle, but no svg element
    return;
  }
  let titleG = svgEl.querySelector("g.title");
  if ( ! seismographConfig.showTitle) {
    if (titleG) { svgEl.removeChild(titleG); }
    return;
  }

  if ( ! titleG) {
    titleG = svgEl.appendChild(createSVGElement("g"));
    titleG.setAttribute("class", "title");
  }
  titleG.setAttribute(
    "transform",
    `translate(${seismographConfig.margin.left + width / 2}, 0)`,
  );
  let textEl: SVGTextElement;
  // fighting with typescript null
  const queryTextEl = titleG.querySelector("text");
  if ( ! queryTextEl) {
    textEl = createSVGElement("text") as SVGTextElement;
    titleG.appendChild(textEl);
  } else {
    textEl = queryTextEl;
  }
  textEl.setAttribute("class", "title label");
  textEl.setAttribute("x", "0");
  textEl.setAttribute("dy", "0.85em");
  textEl.setAttribute("text-anchor", "middle");
  if (!handlebarsInput.seisConfig) {
    handlebarsInput.seisConfig = seismographConfig;
  }
  const handlebarOut = seismographConfig.handlebarsTitle(handlebarsInput, {
    allowProtoPropertiesByDefault: true, // this might be a security issue???
  });
  textEl.innerHTML = handlebarOut;
}


/**
 * Draws axis labels and title, possibly reflecting units of seismograph.
 *
 * @param  svgEl             svg to draw to
 * @param  seismographConfig  config options
 * @param  height             height of svg
 * @param  width              width of svg
 * @param  handlebarsInput    optional key-values for handlebars
 * @param  unitsLabel          option label representing units if config.ySublabelIsUnit
 */
export function drawAxisLabels(
  svgEl: SVGElement,
  seismographConfig: SeismographConfig,
  height: number,
  width: number,
  handlebarsInput: HandlebarsInput = {},
  unitsLabel: string = "",
) {
  if (!svgEl) {
    // axisutil.drawAxisLabels, but no svg element
    return;
  }
  if (!(svgEl instanceof SVGElement)) {
    // axisutil.drawAxisLabels, but not SVGElement
    return;
  }
  drawTitle(svgEl, seismographConfig, height, width, handlebarsInput);
  drawXLabel(svgEl, seismographConfig, height, width, handlebarsInput);
  drawXSublabel(svgEl, seismographConfig, height, width, handlebarsInput);
  drawYLabel(svgEl, seismographConfig, height, width, handlebarsInput);
  drawYSublabel(svgEl, seismographConfig, height, width, handlebarsInput, unitsLabel);
}
