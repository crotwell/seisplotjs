// @flow

import {FFTResult} from './fft.js';

import * as d3 from 'd3';

import {insertCSS} from './plotutil.js';

export function createSimpleFFTPlot(fft: FFTResult, cssSelector: string, sps: number, loglog: boolean = true) {
  simpleOverlayFFTPlot( [ fft], cssSelector, sps, loglog);
}

export function simpleOverlayFFTPlot(fftArrays: Array<FFTResult>, cssSelector: string, sps: number, loglog: boolean = true) {
    let T = 1/sps;
    let ampPhaseList = [];
    let ampSliceMap = new Map();
    let maxFFTAmpLen = 0;
    let extentFFTData = null;
    for (const fftA of fftArrays) {
      let ap: FFTResult;
      if (fftA instanceof FFTResult) {
        ap = fftA;
      } else {
        // assume packed array
        ap = FFTResult.createFromPackedFreq(fftA, fftA.length);
      }
      ampPhaseList.push(ap);
      if (maxFFTAmpLen < ap.amp.length) {
        maxFFTAmpLen = ap.amp.length;
      }
      let ampSlice;
      if (loglog) {
        ampSlice = ap.amp.slice(1); // don't plot zero freq amp
      } else {
        ampSlice = ap.amp;
      }
      let currExtent = d3.extent(ampSlice);
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
    svg.classed("fftplot", true);

    let margin = {top: 20, right: 20, bottom: 30, left: 50};
    //const styleHeight = svgParent.style("height");
    //const styleWidth = svgParent.style("width");
    const styleHeight = 500;
    const styleWidth = 900;
    svg.attr("width", styleWidth).attr("height", styleHeight);
    let width = +styleWidth - margin.left - margin.right;
    let height = +styleHeight - margin.top - margin.bottom;
    let g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    let x;
    let line = d3.line();
    if (loglog) {
      x = d3.scaleLog()
          .rangeRound([0, width]);
      line.x(function(d, i, a) { return x((i+1)*sps/2/(a.length-1)); });
      // minus one as slice off zero freq above
      x.domain([sps/2/(maxFFTAmpLen-1), sps/2]);
    } else {
      x = d3.scaleLinear()
          .rangeRound([0, width]);
      line.x(function(d, i, a) { return x((i  )*sps/2.0/(a.length-1)); });
      x.domain([0, sps/2]);
    }
    let y = d3.scaleLog()
        .rangeRound([height, 0]);


    line.y(function(d) { return y(d); });

  y.domain(extentFFTData);
  if (y.domain()[0] === y.domain()[1]) {
    y.domain( [ y.domain()[0]/2, y.domain()[1]*2]);
  }
  g.append("g")
      .attr("transform", "translate(0," + height + ")")
      .call(d3.axisBottom(x));
  g.append("g")
      .attr("transform", `translate(0, ${height+ +margin.bottom} )`)
    .append("text")
      .attr("fill", "#000")
      .attr("y", 0)
      .attr("x", width/2)
      .attr("dy", "0.71em")
      .attr("text-anchor", "end")
      .text("Hertz");
//    .select(".domain")
//      .remove();

  g.append("g")
      .call(d3.axisLeft(y))
    .append("text")
      .attr("fill", "#000")
      .attr("transform", "rotate(-90)")
      .attr("y", 6)
      .attr("dy", "0.71em")
      .attr("text-anchor", "end")
      .text("Amp");
  let pathg = g.append("g").classed("allfftpaths", true);
  for (const ap of ampPhaseList) {
    let ampSlice = ampSliceMap.get(ap);
    pathg.append("g").append("path")
        .classed("fftpath", true)
        .datum(ampSlice)
        .attr("d", line);
  }
    return svg;
}


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

svg.fftplot.overlayPlot g.allfftpaths g:nth-child(9n+1) path.seispath {
  stroke: skyblue;
}

svg.fftplot.overlayPlot g.allfftpaths g:nth-child(9n+2) path.seispath {
  stroke: olivedrab;
}

svg.fftplot.overlayPlot g.allfftpaths g:nth-child(9n+3) path.seispath {
  stroke: goldenrod;
}

svg.fftplot.overlayPlot g.allfftpaths g:nth-child(9n+4) path.seispath {
  stroke: firebrick;
}

svg.fftplot.overlayPlot g.allfftpaths g:nth-child(9n+5) path.seispath {
  stroke: darkcyan;
}

svg.fftplot.overlayPlot g.allfftpaths g:nth-child(9n+6) path.seispath {
  stroke: orange;
}

svg.fftplot.overlayPlot g.allfftpaths g:nth-child(9n+7) path.seispath {
  stroke: darkmagenta;
}

svg.fftplot.overlayPlot g.allfftpaths g:nth-child(9n+8) path.seispath {
  stroke: mediumvioletred;
}

svg.fftplot.overlayPlot g.allfftpaths g:nth-child(9n+9) path.seispath {
  stroke: sienna;
}

/* same colors for titles */

svg.fftplot.overlayPlot g.title tspan:nth-child(9n+1)  {
  fill: skyblue;
}

svg.fftplot.overlayPlot g.title text tspan:nth-child(9n+2)  {
  stroke: olivedrab;
}

svg.fftplot.overlayPlot g.title text tspan:nth-child(9n+3)  {
  stroke: goldenrod;
}

svg.fftplot.overlayPlot g.title tspan:nth-child(9n+4)  {
  stroke: firebrick;
}

svg.fftplot.overlayPlot g.title tspan:nth-child(9n+5)  {
  stroke: darkcyan;
}

svg.fftplot.overlayPlot g.title tspan:nth-child(9n+6)  {
  stroke: orange;
}

svg.fftplot.overlayPlot g.title tspan:nth-child(9n+7)  {
  stroke: darkmagenta;
}

svg.fftplot.overlayPlot g.title tspan:nth-child(9n+8)  {
  stroke: mediumvioletred;
}

svg.fftplot.overlayPlot g.title tspan:nth-child(9n+9)  {
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