// @flow

/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */

import {FFTResult} from './fft.js';

import * as d3 from 'd3';

import {insertCSS} from './cssutil.js';

/**
 * Create a single amplitude plot of FFT data.
 *
 * @param   cssSelector selection of the containing element, usually a div
 * @param   fft         data to plot
 * @param   loglog      true for loglog plot, false for linlog
 * @return              the svg element containing the plot
 */
export function createSimpleFFTPlot(cssSelector: string, fft: FFTResult, loglog: boolean = true) {
  let svg = createOverlayFFTPlot(cssSelector,  [ fft ], loglog);
  svg.classed("overlayplot", false);
  return svg;
}

/**
 * Create a amplitude plot of multiple FFT data.
 *
 * @param   cssSelector selection of the containing element, usually a div
 * @param   fft         array of FFT data to plot
 * @param   loglog      true for loglog plot, false for linlog
 * @return              the svg element containing the plot
 */
export function createOverlayFFTPlot(cssSelector: string, fftArrays: Array<FFTResult>, loglog: boolean = true) {
    let ampPhaseList = [];
    let ampSliceMap = new Map();
    let maxFFTAmpLen = 0;
    let extentFFTData = null;
    let freqMinMax = [];
    for (const fftA of fftArrays) {
      if (loglog) {
        freqMinMax.push(fftA.fundamentalFrequency); // min freq
      } else {
        freqMinMax.push(0);
      }
      freqMinMax.push(fftA.sampleRate/2); // max freq
      let ap: FFTResult;
      if (fftA instanceof FFTResult) {
        ap = fftA;
      } else {
        throw new Error("fftArrays must be array of FFTResult");
      }
      ampPhaseList.push(ap);
      if (maxFFTAmpLen < ap.amp.length) {
        maxFFTAmpLen = ap.amp.length;
      }
      let ampSlice;
      if (loglog) {
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

    let svgParent = d3.select(cssSelector);
    let svg = svgParent.append("svg");
    svg.classed("fftplot", true).classed("overlayplot", true);

    let margin = {top: 20, right: 20, bottom: 30, left: 50};

    let rect = svg.node().getBoundingClientRect();

    let width = +rect.width - margin.left - margin.right;
    let height = +rect.height - margin.top - margin.bottom;
    let g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    let x;
    if (loglog) {
      x = d3.scaleLog()
          .rangeRound([0, width]);
    } else {
      x = d3.scaleLinear()
          .rangeRound([0, width]);
    }
    x.domain(d3.extent(freqMinMax));
    let y = d3.scaleLog()
        .rangeRound([height, 0]);
  y.domain(extentFFTData);
  if (y.domain()[0] === y.domain()[1]) {
    y.domain( [ y.domain()[0]/2, y.domain()[1]*2]);
  }
  g.append("g")
      .attr("transform", "translate(0," + height + ")")
      .call(d3.axisBottom(x));
  g.append("g")
      .attr("transform", `translate(0, ${height+ margin.bottom} )`)
    .append("text")
      .attr("fill", "#000")
      .attr("y", 0)
      .attr("x", width/2)
      .attr("dy", "0.71em")
      .attr("text-anchor", "end")
      .text("Hertz");

  g.append("g")
      .call(d3.axisLeft(y));
  svg.append("g")
      .attr("transform", `translate(0, ${margin.top+height/2} )`)
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
    if (loglog) {
      line.x(function(d, i) { return x((i+1)*minFreq); });
      // minus one as slice off zero freq above
    } else {
      line.x(function(d, i) { return x((i  )*minFreq); });
    }
    line.y(function(d) {if (d !== 0.0 && ! isNaN(d)) {return y(d);} else {return y.range()[0];} });
    pathg.append("g").append("path")
        .classed("fftpath", true)
        .datum(ampSlice)
        .attr("d", line);
  }
  return svg;
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

svg.fftplot.overlayplot g.allfftpaths g:nth-child(9n+1) path.fftpath {
  stroke: skyblue;
}

svg.fftplot.overlayplot g.allfftpaths g:nth-child(9n+2) path.fftpath {
  stroke: olivedrab;
}

svg.fftplot.overlayplot g.allfftpaths g:nth-child(9n+3) path.fftpath {
  stroke: goldenrod;
}

svg.fftplot.overlayplot g.allfftpaths g:nth-child(9n+4) path.fftpath {
  stroke: firebrick;
}

svg.fftplot.overlayplot g.allfftpaths g:nth-child(9n+5) path.fftpath {
  stroke: darkcyan;
}

svg.fftplot.overlayplot g.allfftpaths g:nth-child(9n+6) path.fftpath {
  stroke: orange;
}

svg.fftplot.overlayplot g.allfftpaths g:nth-child(9n+7) path.fftpath {
  stroke: darkmagenta;
}

svg.fftplot.overlayplot g.allfftpaths g:nth-child(9n+8) path.fftpath {
  stroke: mediumvioletred;
}

svg.fftplot.overlayplot g.allfftpaths g:nth-child(9n+9) path.fftpath {
  stroke: sienna;
}

/* same colors for titles */

svg.fftplot.overlayplot g.title tspan:nth-child(9n+1)  {
  fill: skyblue;
}

svg.fftplot.overlayplot g.title text tspan:nth-child(9n+2)  {
  stroke: olivedrab;
}

svg.fftplot.overlayplot g.title text tspan:nth-child(9n+3)  {
  stroke: goldenrod;
}

svg.fftplot.overlayplot g.title tspan:nth-child(9n+4)  {
  stroke: firebrick;
}

svg.fftplot.overlayplot g.title tspan:nth-child(9n+5)  {
  stroke: darkcyan;
}

svg.fftplot.overlayplot g.title tspan:nth-child(9n+6)  {
  stroke: orange;
}

svg.fftplot.overlayplot g.title tspan:nth-child(9n+7)  {
  stroke: darkmagenta;
}

svg.fftplot.overlayplot g.title tspan:nth-child(9n+8)  {
  stroke: mediumvioletred;
}

svg.fftplot.overlayplot g.title tspan:nth-child(9n+9)  {
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
