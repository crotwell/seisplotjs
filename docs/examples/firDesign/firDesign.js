
const odsp = seisplotjs.OregonDSP;
const d3 = seisplotjs.d3;


d3.select("button#load").on("click", function(d) {
  //let mseeedUrl = "testData/XX.PI04.RW.HNZ.2019.070.18";
  let mseedUrl = document.getElementsByName('mseedUrl')[0].value;
  d3.select("div.message").selectAll("*").remove();
  loadTestData(mseedUrl).then(trace => {
    console.log(`after loadTestData ${trace}`);
    let doRMean = d3.select("input[name=rmean]").property('checked');
    if (doRMean) {
      trace = seisplotjs.filter.rMean(trace);
    }
    let testData = trace.merge();
    console.log(`testData: ${testData.length}`);
    createFIR(testData);
    console.log(`after createFIR: ${testData.length}`);
    return testData;
  }).then(testData => {
    console.log(`all done: ${testData.length}`);
  }).catch( function(error) {
    d3.select("div.message").append('p').text("Error loading data." +error);
    console.assert(false, error);
    throw error;
  });
});

let createFIR = function(testData) {
  // order N => 2N+1 coeff
  let N = parseInt(document.getElementsByName('N')[0].value);
  // top of pass band, scale 0-1 by nyquist
  let OmegaP=parseFloat(document.getElementsByName('OmegaP')[0].value);
  // weight given to passband ripple?
  let Wp=parseFloat(document.getElementsByName('Wp')[0].value);
  // bottom of stop band, must be > OmegaP
  let OmegaS=parseFloat(document.getElementsByName('OmegaS')[0].value);
  // Weight given to stopband ripple?
  let Ws=parseFloat(document.getElementsByName('Ws')[0].value);
  const fixdelay = d3.select("input[name=fixdelay]").property('checked');
  const initval = d3.select("input[name=initval]").property('checked');
  const doLogLog = d3.select("input[name=loglog]").property('checked');
  let firLp = new odsp.filter.fir.equiripple.EquirippleLowpass(N, OmegaP, Wp, OmegaS, Ws);

  let filterDelay = (firLp.getCoefficients().length-1)/2;
  let delayCorrection = 0;
  if (fixdelay) {
    delayCorrection = filterDelay;
  }
  d3.select("h3.coefficients").selectAll("*").remove();
  d3.select("h3.coefficients").text(`FIR Coefficients: N: ${N} => ${2*N+1}  OmegaP: ${OmegaP} Wp: ${Wp}  OmegsS: ${OmegaS} Ws: ${Ws}`)

  let coeffDispFun = function(d, i, a) {
    let pre = "    ";
    if (i === 0) {pre = 'coeff = [';}
    let post = ", ";
    if (i === a.length-1) {post = "];"}
    console.log(`${pre}${d}${post}`);
    return `${pre}${d}${post}`;
  };
  let coeffDisplay = d3.select("div.coefficients").select("ul").selectAll("li")
    .data(firLp.getCoefficients())
    .text(coeffDispFun);
  coeffDisplay.enter().append("li").text(coeffDispFun);
  coeffDisplay.exit().remove();

  zeroFreqPlot(OmegaP, Wp, OmegaS, Ws)

  const NumPoints = parseInt(document.getElementsByName('NumPoints')[0].value);
  const plotWidth = 1024;
  const plotHeight = 512;
  const margin = {top: 20, right: 30, bottom: 30, left: 40};
  let width = plotWidth - margin.left - margin.right;
  let height = plotHeight - margin.top - margin.bottom;

  let inData = testData.slice( NumPoints);
  // let inData = new Array(NumPoints-firLp.getCoefficients().length);
  // inData.fill(0.0);
  // inData[inData.length/2-1] = 1.0
  // for (let i=0; i<inData.length; i++) {
  //   inData[i] = 1-2*Math.random();
  // }
  outData = firLp.filter(inData);
  reoutData = firLp.filter(outData.slice(filterDelay));

  timeDomainData = applyTimeDomain(firLp.getCoefficients(), inData, initval);

  //
  // let impulseDisplay = d3.select("div.impulse").select("ul").selectAll("li")
  //   .data(outData)
  //   .text(function(d) { return d; });
  // impulseDisplay.enter().append("li").text(d=> d);
  // impulseDisplay.exit().remove();

  let plotSvg = d3.select("div.plot").select("svg.timeseries");
  plotSvg.attr("width", plotWidth).attr("height", plotHeight);
  let xScale = d3.scaleLinear().range([0, width]).domain([0, NumPoints]);
  let inextent = d3.extent(inData);
  let outextent = d3.extent(outData);
  let extent = d3.extent([ inextent[0], inextent[1], outextent[0], outextent[1]]);
  let yScale = d3.scaleLinear().range([height, 0]).domain(extent);

  lineFunc = d3.line()
        .curve(d3.curveLinear)
        .x(function(d, i) {return xScale(i); })
        .y(function(d) {return yScale(d); });

  plotSvg.selectAll("*").remove();
  plotSvg.append("g").classed("in", true).attr("transform", "translate(" + margin.left + "," + margin.top + ")")
    .append("path").attr("d", lineFunc(inData));
  plotSvg.append("g").classed("out", true).attr("transform", "translate(" + margin.left + "," + margin.top + ")")
    .append("path").attr("d", lineFunc(outData.slice(delayCorrection)));
  plotSvg.append("g").classed("timedomain", true).attr("transform", "translate(" + margin.left + "," + margin.top + ")")
    .append("path").attr("d", lineFunc(timeDomainData.slice(delayCorrection)));
  plotSvg.append("g").classed("reout", true).attr("transform", "translate(" + margin.left + "," + margin.top + ")")
    .append("path").attr("d", lineFunc(reoutData.slice(delayCorrection)));



  let xAxis = d3.axisBottom(xScale);
  let yAxis = d3.axisLeft(yScale);
  plotSvg.append("g").attr("transform", "translate("+margin.left+"," + margin.top + ")")
  .call(yAxis);
  plotSvg.append("g").attr("transform", "translate(" +margin.left  + ","+(margin.top +height)+")")
  .call(xAxis);

// FFT plots

  let fftSvg = d3.select("div.plot").select("svg.fft");
  fftSvg.selectAll("*").remove();
  fftSvg.attr("width", plotWidth).attr("height", plotHeight);
  let xScaleFFT = d3.scaleLog().range([0, width]).domain([1.0/NumPoints/2, 1]);
  let yScaleFFT = d3.scaleLinear().range([height, 0]).domain([-1, 1]);

  let inDataFFT = fftForwardArray(inData, inData.sampleRate);
  let outDataFFT = fftForwardArray(outData.slice(delayCorrection));
  let timeDomainDataFFT = fftForwardArray(timeDomainData.slice(delayCorrection));
  console.log(`fft in: ${inDataFFT.amp.length}  out: ${outDataFFT.amp.length} `);
  // for(let i=0; i<1000;i+=20) {
  //   console.log(`fft ${i} in: ${inDataFFT.amp[i]}  out: ${outDataFFT.amp[i]}  ratio: ${outDataFFT.amp[i]/inDataFFT.amp[i]}`);
  // }
  let inOutAmpRatio = inDataFFT.clone();
  for(let i=0; i<inDataFFT.amp.length; i++ ) {
    inOutAmpRatio.amp[i] = outDataFFT.amp[i]/inDataFFT.amp[i];
    inOutAmpRatio.phase[i] = outDataFFT.phase[i] - inDataFFT.phase[i];
  }
  inOutAmpRatio.recalcFromAmpPhase();

  let inTimeAmpRatio = inDataFFT.clone();
  for(let i=0; i<inDataFFT.amp.length; i++ ) {
    inTimeAmpRatio.amp[i] = timeDomainDataFFT.amp[i]/inDataFFT.amp[i];
    inTimeAmpRatio.phase[i] = timeDomainDataFFT.phase[i] - inDataFFT.phase[i];
  }
  inTimeAmpRatio.recalcFromAmpPhase();

  d3.select("div.fft").selectAll("*").remove();
  d3.select("div.fftratio").selectAll("*").remove();
  const plotConfig = new seisplotjs.seismographconfig.SeismographConfig();
  const fftPlot = new seisplotjs.fftplot.FFTPlot("div.fft", plotConfig, [inDataFFT, outDataFFT, timeDomainDataFFT],  doLogLog);
  fftPlot.draw();
  let longCoeff = new Array(NumPoints).fill(0);
  for(let i=0; i<firLp.getCoefficients().length; i++) {
    longCoeff[i] = firLp.getCoefficients()[i];
  }
  let impulseResponse = fftForwardArray(longCoeff)
  const fftRatioPlot = new seisplotjs.fftplot.FFTPlot("div.fftratio", plotConfig, [impulseResponse, inOutAmpRatio, inTimeAmpRatio], doLogLog);
  fftRatioPlot.draw();
  d3.select("div.fftfir").selectAll("*").remove();
  const firPlot = new seisplotjs.fftplot.FFTPlot("div.fftfir", plotConfig, [impulseResponse],  doLogLog);
  firPlot.draw();
  d3.select("div.message").append('p').text(`Zero Freq Gain: ${impulseResponse.amp[0]}`);
}

function applyTimeDomain(coeff, data, chargeFirstVal) {
  let out = [];
  let history = new Array(coeff.length);
  let chargeVal = 0;
  if (chargeFirstVal) {
    chargeVal = data[0];
  }
  history.fill(chargeVal);
  for(let offset=0; offset<data.length+coeff.length; offset++) {
    history = history.slice(1);
    if (offset < data.length) {
      history.push(data[offset]);
    } else {
      history.push(0);
    }
    let temp = 0;
    for(let i=0; i<coeff.length; i++) {
        temp += coeff[coeff.length-i-1]*history[i];
    }
    out.push(temp);
  }
  return out;
}

function loadTestData(mseedUrl) {

  return fetch(mseedUrl)
  .then( fetchResponse => {
    return fetchResponse.arrayBuffer();
  }).then(function(rawBuffer) {
    let dataRecords = seisplotjs.miniseed.parseDataRecords(rawBuffer);
    return dataRecords;
  }).then(function(dataRecords) {
    let traceArr = seisplotjs.miniseed.seismogramPerChannel(dataRecords);
    return traceArr;
  }).then(function(traceArr) {
    console.log("After fetch promise resolve");
    return traceArr[0]; // should only be one
  // }).catch( function(error) {
  //   d3.select("div.message").append('p').text("Error loading data." +error);
  //   console.assert(false, error);
  //   throw error;
  });
}

function fftForwardArray(dataArray, sampRate=1) {
  let packetFreq = seisplotjs.fft.calcDFT(dataArray);
  let tryFFT = seisplotjs.fft.FFTResult.createFromPackedFreq(packetFreq, dataArray.length, sampRate);
  return tryFFT;
}

function zeroFreqPlot(OmegaP, Wp, OmegaS, Ws) {
  const max = 100;
  const min = 3;
  const plotWidth = 1024;
  const plotHeight = 300;
  const margin = {top: 20, right: 30, bottom: 30, left: 40};
  let width = plotWidth - margin.left - margin.right;
  let height = plotHeight - margin.top - margin.bottom;

  let firZeroGain = new Array(max).fill(0);
  for (let tryN=min; tryN<firZeroGain.length; tryN++) {
    tryLp = new odsp.filter.fir.equiripple.EquirippleLowpass(tryN, OmegaP, Wp, OmegaS, Ws);
    let impulse = Array.from(tryLp.getCoefficients());
    let tryFFT = fftForwardArray(impulse);
    firZeroGain[tryN] = tryFFT.amp[0];
  }

  let plotSvg = d3.select("div.zeroFreqGain").select("svg.zeroFreqGain");
  plotSvg.attr("width", plotWidth).attr("height", plotHeight);
  let xScale = d3.scaleLinear().range([0, width]).domain([0, max]);
  let yMin = 0.9;
  let yMax = 1.1;
  let yScale = d3.scaleLinear().range([height, 0]).domain([yMin, yMax]);

  lineFunc = d3.line()
        .curve(d3.curveLinear)
        .x(function(d, i) {return xScale(i); })
        .y(function(d) {return yScale(d); });
  plotSvg.selectAll("*").remove();

  let xAxis = d3.axisBottom(xScale);
  let yAxis = d3.axisLeft(yScale)
    .tickSize(-width, 0, 0);
  plotSvg.append("g").classed("yAxis", true).attr("transform", "translate("+margin.left+"," + margin.top + ")")
    .call(yAxis);
  plotSvg.append("g").classed("xAxis", true).attr("transform", "translate(" +margin.left  + ","+(margin.top +height)+")")
    .call(xAxis);

  plotSvg.append("g").classed("in", true).attr("transform", "translate(" + margin.left + "," + margin.top + ")")
    .append("path").attr("d", lineFunc(firZeroGain));

}
