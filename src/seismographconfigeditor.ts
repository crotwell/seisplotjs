/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * https://www.seis.sc.edu
 */
import {insertCSS,} from "./cssutil";
import {SeismographConfig} from "./seismographconfig";
import {isDef} from "./util";
import { select as d3select} from "d3-selection";

import type {Selection} from 'd3-selection';

export function createEditor(
  div: Selection<HTMLElement, unknown, null, undefined>,
  config: SeismographConfig,
  onChange: () => void,
) {
  if (!isDef(div)) {
    throw new Error("div is Required");
  }
  if (!isDef(onChange)) {
    onChange = () => {
      // default do nothing
    };
  }

  const titleDiv = div.append("div");
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
  const xLabelDiv = div.append("div");
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
  const yLabelDiv = div.append("div");
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
  const yLabelDivB = div.append("div");
  createBooleanOptionByKey(
    yLabelDivB.append("span"),
    "Nice",
    "isYAxisNice",
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
  const marginDiv = div.append("div");
  marginDiv.append("label").text("Margin:");
  createNumberOption(
    marginDiv.append("span"),
    "Left",
    "left",
    config.margin,
    onChange,
  );
  createNumberOption(
    marginDiv.append("span"),
    "Right",
    "right",
    config.margin,
    onChange,
  );
  createNumberOption(
    marginDiv.append("span"),
    "Top",
    "top",
    config.margin,
    onChange,
  );
  createNumberOption(
    marginDiv.append("span"),
    "Bottom",
    "bottom",
    config.margin,
    onChange,
  );
  const colorDiv = div.append("div");
  colorDiv.append("label").text("Color:");
  let colorLineNum = 0;
  const perLine = 5;
  while (colorLineNum*perLine < config.lineColors.length) {
    const subDiv = colorDiv.append("div");
    config.lineColors.slice(colorLineNum*perLine, colorLineNum*perLine+perLine).forEach((color, index) => {
      const colorspan = subDiv.append("span");
      const cindex = index+colorLineNum*perLine;
      colorspan.style("color", color);
      colorspan.append("label").text(`${cindex + 1}:`);
      colorspan
        .append("input")
        .classed("smallconfigtext", true)
        .attr("type", "text")
        .attr("name", `color${cindex + 1}`)
        .property("value", color)
        .on("change", function () {
          // @ts-ignore
          const val = d3select(this).property("value");
          config.lineColors[cindex] = val;
          colorspan.style("color", val);
          colorspan.select("input").style("color", val);
          onChange();
        });
      colorspan.select("input").style("color", color);
    });
    colorLineNum+=1;
  }
  createNumberOption(
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
  const subHeightDiv = heightDiv.append("span");
  createNumberOption(
    subHeightDiv.append("span"),
    "Min",
    "minHeight",
    config,
    onChange,
  );
  createNumberOption(
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
export type SEL_DIV_SPAN = Selection<HTMLDivElement, unknown, null, undefined> | Selection<HTMLSpanElement, unknown, null, undefined>
function createBooleanOptionByKey(
  myspan: SEL_DIV_SPAN,
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
      config[key] = d3select(this).property("checked");
      onChange();
    });
  myspan.append("label").text(`${label}:`);
  return myspan;
}

function createTextOption(
  mydiv: SEL_DIV_SPAN,
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
    .attr("name", key)
    .property("value", config[key])
    .on("change", function () {
      // @ts-ignore
      config[key] = d3select(this).property("value");
      onChange();
    });
  return myspan;
}

function createNumberOption(
  mydiv: SEL_DIV_SPAN,
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
    .attr("type", "number")
    .attr("id", key)
    .attr("name", key)
    .property("value", config[key])
    .on("change", function () {
      // @ts-ignore
      config[key] = Number.parseInt(d3select(this).property("value"));
      onChange();
    });
  return myspan;
}

export const configEditor_css = `
input[type="text"].smallconfigtext {
  width: 7em;
}

input[type="number"].smallconfigtext {
  width: 7em;
}

input[type="text"].bigconfigtext {
  width: 27em;
}
`;

if (document) {
  insertCSS(configEditor_css, "configeditor");
}
