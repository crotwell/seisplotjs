// @flow

/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */

import {FFTResult} from './fft.js';
import { SeismographConfig } from './seismographconfig';
import { SeismogramDisplayData } from './seismogram.js';
import type { Complex } from './oregondsputil.js';

import * as d3 from 'd3';

import {insertCSS, G_DATA_SELECTOR, AUTO_COLOR_SELECTOR} from './cssutil.js';
import {drawAxisLabels} from './axisutil.js';

/**
 * Create a single amplitude plot of FFT data.
 *
 * @param   cssSelector selection of the containing element, usually a div
 * @param   fftResult         data to plot
 * @param   config configuration of the plot, note not all options are supported by fft plots
 * @param   loglog      true for loglog plot, false for linlog
 * @returns             the plot
 */
export function createSimpleFFTPlot(cssSelector: string,
                                    fftResult: FFTResult,
                                    config: SeismographConfig,
                                    loglog: boolean = true): FFTPlot {
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
export function createOverlayFFTPlot(cssSelector: string,
                                      fftResults: Array<FFTResult>,
                                      config: SeismographConfig = new SeismographConfig(),
                                      loglog: boolean = true): FFTPlot {
  let fftplot =  new FFTPlot(cssSelector, config, fftResults, loglog);
  fftplot.draw();
  return fftplot;
}

/**
 * Similar to FFTResult, but used for plotting non-fft generated data.
 * This allows the frequencies to be, for example, evenly distrubuted
 * in log instead of linearly for plotting PolesZeros stages.
 */
export class FreqAmp {
  freq: Array<number>;
  values: Array<Complex>;
  /** optional units of the original data for display purposes. */
  inputUnits: string;
  seismogramDisplayData: null | SeismogramDisplayData;
  constructor(freq: Array<number>, values: Array<Complex>) {
    this.freq = freq;
    this.values = values;
    this.inputUnits = '';// leave blank unless set manually
    this.seismogramDisplayData = null;
  }
  frequencies(): Array<number> {
    return this.freq;
  }
  amplitudes(): Array<number> {
    return this.values.map(c => c.abs());
  }
  phases(): Array<number> {
    return this.values.map(c => c.angle());
  }
  get numFrequencies(): number {
    return this.freq.length;
  }
  get minFrequency(): number {
    return this.fundamentalFrequency;
  }
  get maxFrequency(): number {
    return this.freq[this.freq.length-1];
  }
  // for compatibility with FFTResult
  get fundamentalFrequency(): number {
    return this.freq[0];
  }
}

/**
 * A amplitude or phase plot of fft data.
 *
 * @param cssSelector selector or d3 selection
 * @param seismographConfig config of the plot, not all values are used
 * @param fftResult fft data to plot
 * @param loglog log or linear frequency
 */
export class FFTPlot {
  svgParent: any;
  seismographConfig: SeismographConfig;
  fftResults: Array<FFTResult | FreqAmp>;
  xScale: any;
  yScale: any;
  xAxis: any;
  yAxis: any;
  svg: any;
  loglog: boolean;
  amplitude: boolean;
  phase: boolean;
  constructor(cssSelector: string,
              seismographConfig: SeismographConfig,
              fftResult: FFTResult | FreqAmp | Array<FFTResult>,
              loglog: boolean = true,
              amplitude: boolean = true,
              phase: boolean = false) {
    this.svgParent = cssSelector;
    this.seismographConfig = seismographConfig;
    // $FlowFixMe[incompatible-type]
    this.fftResults = Array.isArray(fftResult) ? fftResult : [fftResult];
    this.xScale = null;
    this.yScale = null;
    this.svg = null;
    this.loglog = loglog;
    this.amplitude = amplitude;
    this.phase = phase;
    if (typeof cssSelector === 'string') {
      this.svgParent = d3.select(cssSelector);
    } else {
      this.svgParent = cssSelector;
    }

  }
  draw() {
    const that = this;
    let ampPhaseList = [];
    let maxFFTAmpLen = 0;
    let extentFFTData = null;
    let freqMinMax = [];
    if (this.phase) { extentFFTData = d3.extent([-Math.PI, Math.PI]);}
    for (const fftA of this.fftResults) {
      if (this.loglog) {
        freqMinMax.push(fftA.fundamentalFrequency); // min freq
      } else {
        freqMinMax.push(0);
      }
      freqMinMax.push(fftA.maxFrequency); // max freq
      let ap: FFTResult | FreqAmp;
      if (fftA instanceof FFTResult || fftA instanceof FreqAmp) {
        ap = fftA;
      } else {
        throw new Error("fftResults must be array of FFTResult");
      }
      ampPhaseList.push(ap);
      if (maxFFTAmpLen < ap.numFrequencies) {
        maxFFTAmpLen = ap.numFrequencies;
      }
      let ampSlice;
      if (this.amplitude) {
        ampSlice = ap.amplitudes();
      } else {
        ampSlice = ap.phases();
      }
      if (this.loglog) {
        // don't plot zero freq amp
        ampSlice = ampSlice.slice(1);
      }
      let currExtent = d3.extent(ampSlice);
      if (this.amplitude && currExtent[0] === 0) {
        // replace zero with smallest non-zero / 10 for loglog plot
        currExtent[0] = 0.1 * ampSlice.reduce((acc, curr) => {
          if (curr > 0 && curr < acc) {
            return curr;
          } else {
            return acc;
          }
          }, 1e-9);
      }
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
    if ( ! extentFFTData) {
      extentFFTData = d3.extent([0.1,1]);
    }
    if ((extentFFTData[1]-extentFFTData[0])/ extentFFTData[1] < 1) {
      extentFFTData = d3.extent([ extentFFTData[0],
                                  extentFFTData[1],
                                  extentFFTData[0]*2,
                                  extentFFTData[0]*0.1],
                                  function(d) { return d; });
    }

    let svg = this.svgParent.append("svg");
    this.svg = svg;
    svg.classed("fftplot", true).classed(AUTO_COLOR_SELECTOR, true);


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
    if (this.loglog && this.amplitude) {
      this.yScale = d3.scaleLog()
          .rangeRound([height, 0]);
      this.yScale.domain(extentFFTData);
      if (this.yScale.domain()[0] === this.yScale.domain()[1]) {
        this.yScale.domain( [ this.yScale.domain()[0]/2, this.yScale.domain()[1]*2]);
      }
    } else {
      this.yScale = d3.scaleLinear()
          .rangeRound([height, 0]);
      this.yScale.domain(extentFFTData);
      if (this.yScale.domain()[0] === this.yScale.domain()[1]) {
        this.yScale.domain( [ this.yScale.domain()[0]-1, this.yScale.domain()[1]+1]);
      }
    }


    this.xAxis = d3.axisBottom(this.xScale);
    g.append("g")
        .attr("transform", "translate(0," + height + ")")
        .call(this.xAxis);

    this.yAxis = d3.axisLeft(this.yScale);
    g.append("g")
        .call(this.yAxis);
    this.seismographConfig.yLabel= "Amp";
    if ( ! this.amplitude) {
      this.seismographConfig.yLabel = "Phase";
    }
    this.seismographConfig.xLabel = "Frequency";
    this.seismographConfig.xSublabel = "Hz";
    if (this.seismographConfig.ySublabelIsUnits) {
      if (this.phase) {
        this.seismographConfig.ySublabel = "radian";
      } else {
        for (const ap of ampPhaseList) {
          this.seismographConfig.ySublabel += ap.inputUnits;
        }
      }
    }

    let pathg = g.append("g").classed(G_DATA_SELECTOR, true);
    for (const ap of ampPhaseList) {
      let ampSlice;
      if (this.amplitude) {
        ampSlice = ap.amplitudes();
      } else {
        ampSlice = ap.phases();
      }
      let freqSlice = ap.frequencies();
      if (this.loglog) {
        freqSlice = freqSlice.slice(1);
        ampSlice = ampSlice.slice(1);
      }
      let line = d3.line();
      line.x(function(d, i) {
        return that.xScale(freqSlice[i]);
      });
      line.y(function(d, i) {
        if (d !== 0.0 && ! isNaN(d)) {
          return that.yScale(d);
        } else {
          return that.yScale.range()[0];
        }
      });
      pathg.append("g").append("path")
          .classed("fftpath", true)
          .datum(ampSlice)
          .attr("d", line);
    }
    const handlebarInput = {
        seisDataList: this.fftResults.map(f => f.seismogramDisplayData),
        seisConfig: this.seismographConfig
      };
    drawAxisLabels(this.svg, this.seismographConfig, height, width, handlebarInput);
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
svg.fftplot text.title {
  font-size: larger;
  font-weight: bold;
  fill: black;
  color: black;
  dominant-baseline: hanging;
}

svg.fftplot text.sublabel {
  font-size: smaller;
}

/* links in svg */
svg.fftplot text a {
  fill: #0000EE;
  text-decoration: underline;
}

`;

if (document){
  insertCSS(fftplot_css, "fftplot");
}
