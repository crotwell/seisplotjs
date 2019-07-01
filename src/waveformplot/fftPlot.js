import {FFTResult} from '../filter/index.js';

import * as d3 from 'd3';

export function createSimpleFFTPlot(fft, cssSelector, sps) {
  simpleOverlayFFTPlot( [ fft], cssSelector, sps);
}

export function simpleOverlayFFTPlot(fftArrays, cssSelector, sps, loglog) {
    let T = 1/sps;
    let ampPhaseList = [];
    let maxFFTAmpLen = 0;
    let extentFFTData = null;
    for (const fft of fftArrays) {
      let ap;
      if (fft instanceof FFTResult) {
        ap = fft;
      } else {
        // assume packed array
        ap = new FFTResult(fft);
      }
      ampPhaseList.push(ap);
      if (maxFFTAmpLen < ap.amp.length) {
        maxFFTAmpLen = ap.amp.length;
      }

      if (loglog) {
        ap.ampSlice = ap.amp.slice(1); // don't plot zero freq amp
      } else {
        ap.ampSlice = ap.amp;
      }
      let currExtent = d3.extent(ap.ampSlice);
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

console.log(`FFT len:${ampPhaseList.length} T: ${T} sps: ${sps}`);

    let svgParent = d3.select(cssSelector);
    let svg = svgParent.append("svg");
    svg.classed("fftplot", true);

    let margin = {top: 20, right: 20, bottom: 30, left: 50};
    //const styleHeight = svgParent.style("height");
    //const styleWidth = svgParent.style("width");
    const styleHeight = 500;
    const styleWidth = 900;
    svg.attr("width", styleWidth).attr("height", styleHeight);
    console.log(`style width: ${styleWidth} height ${styleHeight}`);
    let width = +styleWidth - margin.left - margin.right;
    let height = +styleHeight - margin.top - margin.bottom;
    let g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    let x;
    if (loglog) {
      x = d3.scaleLog()
          .rangeRound([0, width]);
    } else {
      x = d3.scaleLinear()
          .rangeRound([0, width]);
    }
    let y = d3.scaleLog()
        .rangeRound([height, 0]);

    let line = d3.line()
        .x(function(d, i, a) { return x((i+1)*sps/2/(a.length-1)); })
        .y(function(d) { return y(d); });

  // minus one as slice off zero freq above
  x.domain([sps/2/(maxFFTAmpLen-1), sps/2]);
//  x.domain(d3.extent(fftAmp, function(d, i) { return i; }));
  y.domain(extentFFTData);
  if (y.domain()[0] === y.domain()[1]) {
    y.domain( [ y.domain()[0]/2, y.domain()[1]*2]);
  }
  g.append("g")
      .attr("transform", "translate(0," + height + ")")
      .call(d3.axisBottom(x));
  g.append("g")
      .attr("transform", "translate(0," + height+ margin.bottom + ")")
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
    pathg.append("g").append("path")
        .datum(ap.ampSlice)
        .attr("d", line);
  }
    return svg;
}
