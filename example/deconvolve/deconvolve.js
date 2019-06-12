// @ flow

// just to get flow working...
//import * as seisplotjs from '../../src/index';

// this comes from the seisplotjs miniseed bundle
const ds = seisplotjs.fdsndataselect;
const st = seisplotjs.fdsnstation;
const wp = seisplotjs.waveformplot;
const d3 = wp.d3;
const miniseed = wp.miniseed;
const OregonDSP = seisplotjs.filter.OregonDSP
const moment = seisplotjs.moment;

let doRunQuery = true;
// doRunQuery = false;//for testing

let eqTime = moment.utc('2018-07-13T09:46:49Z').add(60, 'seconds');
let times = new ds.StartEndDuration(eqTime, null, 300, 0);
let dsQuery = new ds.DataSelectQuery()
  .nodata(404)
  .networkCode('CO')
  .stationCode('JSC')
  .locationCode('00')
  .channelCode('HHZ')
  .startTime(times.start)
  .endTime(times.end);

let responseQuery = new st.StationQuery()
  .nodata(404)
  .networkCode('CO')
  .stationCode('JSC')
  .locationCode('00')
  .channelCode('HHZ')
  .startTime(times.start)
  .endTime(times.end);

let div = d3.select('div.miniseed');
let divP = div.append('p');
divP.text("URL: ");
let url = dsQuery.formURL();
divP.append("a")
    .attr("href", url)
    .text(url);

function processSeismograms(traceMap) {
      let trace = traceMap.values().next().value;

      let div = d3.select('div.rawseisplot');
      let svgDiv = div.append("div");
      svgDiv.style("position", "relative");
      svgDiv.style("width", "100%");
      svgDiv.style("height", "450px");
      let seisConfig = new wp.SeismographConfig();
      seisConfig.ySublabel = trace.yUnit;
      let seisConfigB = new wp.SeismographConfig();
      seisConfigB.ySublabel = trace.yUnit;
      let seisplot = new wp.CanvasSeismograph(svgDiv, seisConfigB, trace);
      seisplot.setHeight(450);
      seisplot.draw();

      responseQuery.query(st.LEVEL_RESPONSE).then(netArray => {
        let channel = netArray[0].stations[0].channels[0];
        let response = netArray[0].stations[0].channels[0].response;
        console.log("resp2: "+response);
        let correctedSeismogram = [];
        for(let i=0; i<trace.segments.length; i++) {
          let taperSeis = seisplotjs.filter.taper.taper(seisplotjs.filter.rMean(trace.segments[i]));
          correctedSeismogram.push(seisplotjs.filter.transfer.transfer(taperSeis,
                                            response,
                                            .01,
                                            .02,
                                            25,
                                            50));
        }

        let svgTransfer = d3.select('div.transferseisplot');
        let svgTransferDiv = svgTransfer.append("div");
        svgTransferDiv.style("position", "relative");
        svgTransferDiv.style("width", "100%");
        svgTransferDiv.style("height", "450px");
        let transferConfig = new wp.SeismographConfig();
        let transferPlot = new wp.CanvasSeismograph(svgTransferDiv, transferConfig, correctedSeismogram);
        transferConfig.ySublabel=correctedSeismogram[0].yUnit;
        transferPlot.draw();
        return channel;
      }).then(channel => {
        let respData = calcInstResponse(channel, 0.001, 40, 100);
        respLogPlot(respData, "div.instresponseplot")
      });


      let butterworth = seisplotjs.filter.createButterworth(
                                 4, // poles
                                 seisplotjs.filter.LOW_PASS,
                                 0, // low corner
                                 1, // high corner

                                 1/trace.sampleRate // delta (period)
                        );
      let filteredSeismogram = [];
      for(let i=0; i<trace.segments.length; i++) {
        let s = trace.segments[i].clone();
        butterworth.filterInPlace(s.y);
        filteredSeismogram.push(s);
      }

      let svgFiltered = d3.select('div.filterseisplot');

      let filteredPlot = new wp.CanvasSeismograph(svgFiltered, seisConfig, filteredSeismogram);
      filteredPlot.draw();

      let fftOut = seisplotjs.filter.calcDFT(trace.segments[0].y, trace.segments[0].numPoints );


      simpleLogPlot(fftOut, "div.fftplot", trace.sampleRate);

      let hilbert = new OregonDSP.filter.fir.equiripple.CenteredHilbertTransform(100, .2, .8);
      let hilbertSeismogram = [];
      for(let i=0; i< trace.segments.length; i++) {
        hilbertSeismogram.push(seisplotjs.filter.hilbert(trace.segments[i]));
      }
      let svgHilbert = d3.select('div.hilbertseisplot');
      let hilbertPlot = new wp.CanvasSeismograph(svgHilbert, seisConfig, hilbertSeismogram);
      hilbertPlot.draw();

      let envelopeSeismogram = [];
      for(let i=0; i< trace.segments.length; i++) {
        envelopeSeismogram.push(seisplotjs.filter.envelope(trace.segments[i]));
      }
      let svgEnvelope = d3.select('div.envelopeseisplot');
      let envelopePlot = new wp.CanvasSeismograph(svgEnvelope, seisConfig, envelopeSeismogram);
      envelopePlot.setDoRMean(false);
      envelopePlot.draw();
}

if (doRunQuery) {
  dsQuery.querySeismograms().then(traceMap => {
    console.log("before process, traceMap.size="+traceMap.size);
    processSeismograms(traceMap);
    return traceMap;
  }).catch( function(error) {
    d3.select("div.miniseed").append('p').html("Error loading data." +error);
    console.assert(false, error);
  });
} else {
  fetch("fdsnws-dataselect_2017-04-12T13_42_59Z.mseed")
  .then( fetchResponse => {
    return fetchResponse.arrayBuffer();
  }).then(function(rawBuffer) {
      let dataRecords = miniseed.parseDataRecords(rawBuffer);
      return dataRecords;
    }).then(function(dataRecords) {
      let traceMap = miniseed.mergeByChannel(records);
      processSeismograms(traceMap);
      return traceMap;
    }).then(function(dataRecords) {
      console.log("After fetch promise resolve");
    }).catch( function(error) {
      d3.select("div.miniseed").append('p').html("Error loading data." +error);
      console.assert(false, error);
    });
}

function calcInstResponseAtFreq(freq, sacPoleZero) {
  let ONE = seisplotjs.filter.createComplex(1, 0);
  let respAtF = seisplotjs.filter.transfer.evalPoleZeroInverse(sacPoleZero, freq);
  return ONE.overComplex(respAtF);
}
function calcInstResponse(channel, minFreq, maxFreq, numPoints) {
  let out = {
    minFreq: minFreq,
    maxFreq: maxFreq,
    numPoints: numPoints,
    data: [],
  }
  let sampRate = channel.sampleRate;
  const sacPoleZero = seisplotjs.filter.transfer.convertToSacPoleZero(channel.response);
  // make vel instead of disp
  sacPoleZero.zeros = sacPoleZero.zeros.slice(0, sacPoleZero.zeros.length-1);
  d3.select("div.sacpolezero").append("pre").text(sacPoleZero.toString());
  let powerScale = d3.scalePow()
    .exponent(10)
    .domain([0, numPoints-1])
    .range([minFreq, maxFreq]);
  for (let i=0; i< numPoints; i++) {
    let freq = powerScale(i);
    let respAtF = calcInstResponseAtFreq(freq, sacPoleZero);
    out.data.push({
      freq: freq,
      amp: respAtF.abs(),
      phase: respAtF.angle()
    });
  }
  return out;
}

function respLogPlot(respData, cssSelector) {
      let svg = d3.select(cssSelector).select("svg");

      let margin = {top: 20, right: 20, bottom: 30, left: 50},
      width = +svg.attr("width") - margin.left - margin.right,
      height = +svg.attr("height") - margin.top - margin.bottom,
      g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  let x = d3.scaleLog()
      .rangeRound([0, width]);

  let y = d3.scaleLog()
      .rangeRound([height, 0]);

  let line = d3.line()
      .x(function(d, i) { return x(d.freq); })
      .y(function(d, i) { return y(d.amp); });

    x.domain([respData.minFreq, respData.maxFreq]);
  //  x.domain(d3.extent(fftAmp, function(d, i) { return i; }));
    y.domain(d3.extent(respData.data, function(d, i) { return d.amp; }));
    if (y.domain()[0] === y.domain()[1]) {
      y.domain( [ y.domain()[0]/2, y.domain()[1]*2]);
    }

    g.append("g")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(x))
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
        .datum(respData.data)
        .attr("fill", "none")
        .attr("stroke", "steelblue")
        .attr("stroke-linejoin", "round")
        .attr("stroke-linecap", "round")
        .attr("stroke-width", 1.5)
        .attr("d", line);

}

function simpleLogPlot(fft, cssSelector, sps) {

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

    let svg = d3.select(cssSelector).select("svg");

    let margin = {top: 20, right: 20, bottom: 30, left: 50},
    width = +svg.attr("width") - margin.left - margin.right,
    height = +svg.attr("height") - margin.top - margin.bottom,
    g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

let x = d3.scaleLog()
    .rangeRound([0, width]);

let y = d3.scaleLog()
    .rangeRound([height, 0]);

let line = d3.line()
    .x(function(d, i) { return x((i+1)*T); })
    .y(function(d, i) { return y(d); });

  x.domain([T, fftAmp.length*T]);
//  x.domain(d3.extent(fftAmp, function(d, i) { return i; }));
  y.domain(d3.extent(fftAmp, function(d, i) { return d; }));
  if (y.domain()[0] === y.domain()[1]) {
    y.domain( [ y.domain()[0]/2, y.domain()[1]*2]);
  }

  g.append("g")
      .attr("transform", "translate(0," + height + ")")
      .call(d3.axisBottom(x))
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
