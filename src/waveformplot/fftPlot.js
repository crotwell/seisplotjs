

export function createSimpleFFTPlot(fft, cssSelector, sps) {

    let T = 1/sps;
    let ampLength = fft.length/2 +1;
    let fftReal = fft.slice(0, ampLength);
    let fftImag = new Array(ampLength);
    fftImag[0] = 0;
    fftImag[fftImag.length-1] = 0;
    for (let i=1; i< fft.length/2; i++) {
      fftImag[i] = fft[fft.length - i];
    }
    let fftAmp = new Array(fftReal.length);
    for (let i=0; i< fftReal.length; i++) {
      fftAmp[i] = Math.hypot(fftReal[i], fftImag[i]);
    }

    fftAmp = fftAmp.slice(1);

console.log(`FFT len:${fftAmp.length} T: ${T} sps: ${sps}`)

    let svgParent = d3.select(cssSelector);
    let svg = svgParent.append("svg");

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

let x = d3.scaleLog()
    .rangeRound([0, width]);

let y = d3.scaleLog()
    .rangeRound([height, 0]);

let line = d3.line()
    .x(function(d, i) { return x((i+1)*sps/2/(fftAmp.length-1)); })
    .y(function(d, i) { return y(d); });

  // minus one as slice off zero freq above
  x.domain([sps/2/(fftAmp.length-1), sps/2]);
//  x.domain(d3.extent(fftAmp, function(d, i) { return i; }));
  y.domain(d3.extent(fftAmp, function(d, i) { return d; }));
  if (y.domain()[0] === y.domain()[1]) {
    y.domain( [ y.domain()[0]/2, y.domain()[1]*2]);
  }
console.log(`height: ${height} T ${T}  fft0 ${fftAmp[0]}`);
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

  g.append("path")
      .datum(fftAmp)
      .attr("fill", "none")
      .attr("stroke", "steelblue")
      .attr("stroke-linejoin", "round")
      .attr("stroke-linecap", "round")
      .attr("stroke-width", 1.5)
      .attr("d", line);

}
