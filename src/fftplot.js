// @flow

/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */

import {FFTResult} from './fft.js';
import { SeismographConfig } from './seismographconfig';

import * as d3 from 'd3';

import {insertCSS} from './cssutil.js';

/**
 * Create a single amplitude plot of FFT data.
 *
 * @param   cssSelector selection of the containing element, usually a div
 * @param   fftResult         data to plot
 * @param   config configuration of the plot, note not all options are supported by fft plots
 * @param   loglog      true for loglog plot, false for linlog
 * @returns             the plot
 */
export function createSimpleFFTPlot(cssSelector: string, fftResult: FFTResult, config: SeismographConfig, loglog: boolean = true) {
  let fftplot =  new FFTPlot(cssSelector, config, fftResult, loglog);
  fftplot.draw();
  return fftplot;
}

/**
 * Create a amplitude plot of multiple FFT data.
 *
 * @param   cssSelector selection of the containing element, usually a div
 * @param   fftResults         data to plot
 * @param   config configuration of the plot, note not all options are supported by fft plots
 * @param   loglog      true for loglog plot, false for linlog
 * @returns             the plot
 */
export function createOverlayFFTPlot(cssSelector: string, fftResults: Array<FFTResult>, config: SeismographConfig = new SeismographConfig(), loglog: boolean = true) {
  let fftplot =  new FFTPlot(cssSelector, config, fftResults, loglog);
  fftplot.draw();
  return fftplot;
}

/**
 * A amplitude plot of fft data.
 *
 * @param cssSelector selector or d3 selection
 * @param seismographConfig config of the plot, not all values are used
 * @param fftResult fft data to plot
 * @param loglog log or linear frequency
 */
export class FFTPlot {
  svgParent: any;
  seismographConfig: SeismographConfig;
  fftResults: Array<FFTResult>;
  xScale: d3.scale;
  yScale: d3.scale;
  svg: any;
  loglog: boolean;
  constructor(cssSelector: string,
              seismographConfig: SeismographConfig,
              fftResult: FFTResult | Array<FFTResult>,
              loglog: boolean = true) {
    this.svgParent = cssSelector;
    this.seismographConfig = seismographConfig;
    this.fftResults = Array.isArray(fftResult) ? fftResult : [fftResult];
    this.xScale = null;
    this.yScale = null;
    this.svg = null;
    this.loglog = loglog;
    if (typeof cssSelector === 'string') {
      this.svgParent = d3.select(cssSelector);
    } else {
      this.svgParent = cssSelector;
    }

  }
  draw() {
    const that = this;
    let ampPhaseList = [];
    let ampSliceMap = new Map();
    let maxFFTAmpLen = 0;
    let extentFFTData = null;
    let freqMinMax = [];
    for (const fftA of this.fftResults) {
      if (this.loglog) {
        freqMinMax.push(fftA.fundamentalFrequency); // min freq
      } else {
        freqMinMax.push(0);
      }
      freqMinMax.push(fftA.sampleRate/2); // max freq
      let ap: FFTResult;
      if (fftA instanceof FFTResult) {
        ap = fftA;
      } else {
        throw new Error("fftResults must be array of FFTResult");
      }
      ampPhaseList.push(ap);
      if (maxFFTAmpLen < ap.amp.length) {
        maxFFTAmpLen = ap.amp.length;
      }
      let ampSlice;
      if (this.loglog) {
        // don't plot zero freq amp
        ampSlice = ap.amp.slice(1);
      } else {
        ampSlice = ap.amp;
      }
      let currExtent = d3.extent(ampSlice);
      if (currExtent[0] === 0) {
        // replace zero with smallest non-zero / 10 for loglog plot
        currExtent[0] = 0.1 * ampSlice.reduce((acc, curr) => {
          if (curr > 0 && curr < acc) {
            return curr;
          } else {
            return acc;
          }
          }, 1e-9);
      }
      ampSliceMap.set(ap, ampSlice);
      if (extentFFTData) {
        extentFFTData = d3.extent([ extentFFTData[0],
                                    extentFFTData[1],
                                    currExtent[0],
                                    currExtent[1]],
                                    function(d) { return d; });
      } else {
        extentFFTData = currExtent;
      }
    }

    let svg = this.svgParent.append("svg");
    this.svg = svg;
    svg.classed("fftplot", true);


    let rect = svg.node().getBoundingClientRect();

    let width = +rect.width - this.seismographConfig.margin.left - this.seismographConfig.margin.right;
    let height = +rect.height - this.seismographConfig.margin.top - this.seismographConfig.margin.bottom;
    let g = svg.append("g").attr("transform", "translate(" + this.seismographConfig.margin.left + "," + this.seismographConfig.margin.top + ")");

    if (this.loglog) {
      this.xScale = d3.scaleLog()
          .rangeRound([0, width]);
    } else {
      this.xScale = d3.scaleLinear()
          .rangeRound([0, width]);
    }
    this.xScale.domain(d3.extent(freqMinMax));
    this.yScale = d3.scaleLog()
        .rangeRound([height, 0]);
    this.yScale.domain(extentFFTData);
    if (this.yScale.domain()[0] === this.yScale.domain()[1]) {
      this.yScale.domain( [ this.yScale.domain()[0]/2, this.yScale.domain()[1]*2]);
    }
    const xAxis = d3.axisBottom(this.xScale);
    g.append("g")
        .attr("transform", "translate(0," + height + ")")
        .call(xAxis);
    g.append("g")
        .attr("transform", `translate(0, ${height+ this.seismographConfig.margin.bottom} )`)
      .append("text")
        .attr("fill", "#000")
        .attr("y", 0)
        .attr("x", width/2)
        .attr("dy", "0.71em")
        .attr("text-anchor", "end")
        .text("Hertz");

    const yAxis = d3.axisLeft(this.yScale);
    g.append("g")
        .call(yAxis);
    svg.append("g")
        .attr("transform", `translate(0, ${this.seismographConfig.margin.top+height/2} )`)
      .append("text")
        .attr("fill", "#000")
        .attr("dy", "0.71em")
        .attr("transform", "rotate(-90)")
        .attr("text-anchor", "end")
        .text("Amp");
    let pathg = g.append("g").classed("allfftpaths", true);
    for (const ap of ampPhaseList) {
      let ampSlice = ampSliceMap.get(ap);
      let minFreq = ap.fundamentalFrequency;
      let line = d3.line();
      if (this.loglog) {
        line.x(function(d, i) { return that.xScale((i+1)*minFreq); });
        // minus one as slice off zero freq above
      } else {
        line.x(function(d, i) { return that.xScale((i  )*minFreq); });
      }
      line.y(function(d) {if (d !== 0.0 && ! isNaN(d)) {return that.yScale(d);} else {return that.yScale.range()[0];} });
      pathg.append("g").append("path")
          .classed("fftpath", true)
          .datum(ampSlice)
          .attr("d", line);
    }
    return this;
  }
}

/**
 * Defualt CSS for styling fft plots.
 */
export const fftplot_css = `


path.fftpath {
  stroke: skyblue;
  fill: none;
  stroke-width: 1px;
}

svg.fftplot {
  height: 100%;
  width: 100%;
}

svg.fftplot g.allfftpaths g:nth-child(9n+1) path.fftpath {
  stroke: skyblue;
}

svg.fftplot g.allfftpaths g:nth-child(9n+2) path.fftpath {
  stroke: olivedrab;
}

svg.fftplot g.allfftpaths g:nth-child(9n+3) path.fftpath {
  stroke: goldenrod;
}

svg.fftplot g.allfftpaths g:nth-child(9n+4) path.fftpath {
  stroke: firebrick;
}

svg.fftplot g.allfftpaths g:nth-child(9n+5) path.fftpath {
  stroke: darkcyan;
}

svg.fftplot g.allfftpaths g:nth-child(9n+6) path.fftpath {
  stroke: orange;
}

svg.fftplot g.allfftpaths g:nth-child(9n+7) path.fftpath {
  stroke: darkmagenta;
}

svg.fftplot g.allfftpaths g:nth-child(9n+8) path.fftpath {
  stroke: mediumvioletred;
}

svg.fftplot g.allfftpaths g:nth-child(9n+9) path.fftpath {
  stroke: sienna;
}

/* same colors for titles */

svg.fftplot g.title tspan:nth-child(9n+1)  {
  fill: skyblue;
}

svg.fftplot g.title text tspan:nth-child(9n+2)  {
  stroke: olivedrab;
}

svg.fftplot g.title text tspan:nth-child(9n+3)  {
  stroke: goldenrod;
}

svg.fftplot g.title tspan:nth-child(9n+4)  {
  stroke: firebrick;
}

svg.fftplot g.title tspan:nth-child(9n+5)  {
  stroke: darkcyan;
}

svg.fftplot g.title tspan:nth-child(9n+6)  {
  stroke: orange;
}

svg.fftplot g.title tspan:nth-child(9n+7)  {
  stroke: darkmagenta;
}

svg.fftplot g.title tspan:nth-child(9n+8)  {
  stroke: mediumvioletred;
}

svg.fftplot g.title tspan:nth-child(9n+9)  {
  stroke: sienna;
}


/* links in svg */
svg.fftplot text a {
  fill: #0000EE;
  text-decoration: underline;
}

`;

if (document){
  insertCSS(fftplot_css);
}
