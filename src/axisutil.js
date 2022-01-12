//@flow

import * as d3 from 'd3';
import { SeismographConfig } from './seismographconfig';
import {Seismograph} from './seismograph.js';
import {StartEndDuration, isDef } from './util.js';


export function drawXLabel(svg: any,
                           seismographConfig: SeismographConfig,
                           height: number,
                           width: number,
                           handlebarsInput: any={}) {
  console.log(`Plotutil xLabel:  ${seismographConfig.xLabel}`)
  svg.selectAll("g.xLabel").remove();
  if (seismographConfig.xLabel && seismographConfig.xLabel.length > 0) {
    let svgText = svg.append("g")
       .classed("xLabel", true)
       .attr("transform",
             `translate(${seismographConfig.margin.left+(width)/2}, ${height +seismographConfig.margin.top+ seismographConfig.margin.bottom*2/3} )`)
       .append("text").classed("x label", true)
       .attr("text-anchor", "middle")
       .text(seismographConfig.xLabel);
    let handlebarOut = seismographConfig.handlebarsXLabel(handlebarsInput,
      {
        allowProtoPropertiesByDefault: true // this might be a security issue???
      });
    svgText.html(handlebarOut);
  }
}

export function drawXSublabel(svg: any,
                           seismographConfig: SeismographConfig,
                           height: number,
                           width: number,
                           handlebarsInput: any={}) {
  svg.selectAll('g.xSublabel').remove();
  svg.append("g")
     .classed("xSublabel", true)
     .attr("transform",
           `translate(${seismographConfig.margin.left+(width)/2}, ${height +seismographConfig.margin.top+ seismographConfig.margin.bottom} )`)
     .append("text").classed("x label sublabel", true)
     .attr("text-anchor", "middle")
     .text(seismographConfig.xSublabel);
}

export function drawYLabel(svg: any,
                           seismographConfig: SeismographConfig,
                           height: number,
                           width: number,
                           handlebarsInput: any={}) {
  svg.selectAll('g.yLabel').remove();
  for(let side of [ 'left', 'right']) {
    let hTranslate = (side==="left"?0:seismographConfig.margin.left+width+1);
    let svgText = svg.append("g")
       .classed("yLabel", true)
       .classed(side, true)
       .attr("x", 0)
       .attr("transform", `translate(${hTranslate}, ${(seismographConfig.margin.top+(height)/2)})`)
       .append("text");
    svgText
       .classed("y label", true);
    if (seismographConfig.yLabelOrientation === "vertical") {
      // vertical
      svgText
        .attr("text-anchor", "middle")
        .attr("dy", ".75em")
        .attr("transform", "rotate(-90, 0, 0)");
    } else {
      // horizontal
      svgText.attr("text-anchor", "start")
      .attr("dominant-baseline", "central");
    }
    if (side==="left") {
      let handlebarOut = seismographConfig.handlebarsYLabel(handlebarsInput,
        {
          allowProtoPropertiesByDefault: true // this might be a security issue???
        });
      svgText.html(handlebarOut);
    } else {
      let handlebarOut = seismographConfig.handlebarsYLabelRight(handlebarsInput,
        {
          allowProtoPropertiesByDefault: true // this might be a security issue???
        });
      svgText.html(handlebarOut);
    }
  }
}

export function drawYSublabel(svg: any,
                           seismographConfig: SeismographConfig,
                           height: number,
                           width: number,
                           handlebarsInput: any={}) {
  svg.selectAll('g.ySublabel').remove();
  let svgText = svg.append("g")
     .classed("ySublabel", true)
     .attr("x", 0)
     .attr("transform", "translate( "+seismographConfig.ySublabelTrans+" , "+(seismographConfig.margin.top+(height)/2)+")")
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
    svgText.attr("text-anchor", "start")
    .attr("dominant-baseline", "central");
  }
  svgText
     .text(seismographConfig.ySublabel);
}

export function drawTitle(svg: any,
                           seismographConfig: SeismographConfig,
                           height: number,
                           width: number,
                           handlebarsInput: any={}) {
  if (! handlebarsInput.seisConfig) {
    handlebarsInput.seisConfig = seismographConfig;
  }
  svg.selectAll("g.title").remove();
  if (seismographConfig.showTitle) {
    let titleSVGText = svg.append("g")
       .classed("title", true)
       .attr("transform", `translate(${(seismographConfig.margin.left+(width)/2)}, 0)`)
       .append("text").classed("title label", true)
       .attr("x",0)
       .attr("y",2) // give little extra space at top, css style as hanging doesn't quite do it
       .attr("text-anchor", "middle");
    let handlebarOut = seismographConfig.handlebarsTitle(handlebarsInput,
      {
        allowProtoPropertiesByDefault: true // this might be a security issue???
      });
    titleSVGText.html(handlebarOut);
  }
}

export function drawAxisLabels(svg: any,
                           seismographConfig: SeismographConfig,
                           height: number,
                           width: number,
                           handlebarsInput: any={}) {
  drawTitle(svg, seismographConfig, height, width, handlebarsInput);
  drawXLabel(svg, seismographConfig, height, width, handlebarsInput);
  drawXSublabel(svg, seismographConfig, height, width);
  drawYLabel(svg, seismographConfig, height, width, handlebarsInput);
  drawYSublabel(svg, seismographConfig, height, width);
}
