import * as sp from '../../seisplotjs_3.1.1_standalone.mjs';

document.querySelector("button#load").addEventListener("click", function(d) { createFIR(); });

let createFIR = function() {
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
  const doLogLog = document.querySelector("input[name=loglog]").checked;
  let firLp = new sp.oregondsputil.EquirippleLowpass(N, OmegaP, Wp, OmegaS, Ws);

  document.querySelector("div.message").innerHTML = "";
  document.querySelector("h3.coefficients").innerHTML = "";
  document.querySelector("div.fftfir").innerHTML = "";
  document.querySelector("div.impulse").innerHTML = "";

  document.querySelector("h3.coefficients").textContent = `FIR Coefficients: N: ${N} => ${2*N+1}  OmegaP: ${OmegaP} Wp: ${Wp}  OmegsS: ${OmegaS} Ws: ${Ws}`;

  let coeffDispFun = function(d, i, a) {
    let pre = "    ";
    if (i === 0) {pre = 'coeff = [';}
    let post = ", \n";
    if (i === a.length-1) {post = "];";}
    return `${pre}${d}${post}`;
  };
  let asText = "";
  firLp.getCoefficients().forEach((d,i,a) =>{ asText+= coeffDispFun(d,i,a);});
  const coefDiv = document.querySelector("div.coefficients");
  coefDiv.querySelector("code").textContent = asText;


  const NumPoints = parseInt(document.getElementsByName('NumPoints')[0].value);

  let longCoeff = new Float32Array(NumPoints).fill(0);
  for(let i=0; i<firLp.getCoefficients().length; i++) {
    longCoeff[i] = firLp.getCoefficients()[i];
  }
  const plotConfig = new sp.seismographconfig.SeismographConfig();
  plotConfig.title = "FIR Filter"
  let impulseResponse = fftForwardArray(longCoeff);
  const fftfir_div = document.querySelector('div.fftfir');
  const firPlot = fftfir_div.appendChild(new sp.spectraplot.SpectraPlot([impulseResponse], plotConfig));

  firPlot.logfreq = doLogLog;
  firPlot.draw();
  const firPhasePlot = fftfir_div.appendChild(new sp.spectraplot.SpectraPlot([impulseResponse], plotConfig));
  firPhasePlot.logfreq = doLogLog;
  firPhasePlot.kind = "phase";
  firPhasePlot.draw();
  const msgP = document.querySelector("div.message").appendChild(document.createElement("p"));
  msgP.textContent = `Zero Freq Gain: ${impulseResponse.amplitudes()[0]}`;

  let sampleRate = 1;
  let start = sp.util.isoToDateTime('2000-01-01T00:00:00Z');
  let impulseSeis = sp.seismogram.Seismogram.fromContiguousData(longCoeff, sampleRate, start);
  // snip start draw
  const impluseresp_div = document.querySelector('div.impulse');
  let seisConfig = new sp.seismographconfig.SeismographConfig();
  seisConfig.title = "Impulse Response";
  seisConfig.margin.top = 25;
  seisConfig.doRMean = false;
  seisConfig.wheelZoom = false;
  let seisData = sp.seismogram.SeismogramDisplayData.fromSeismogram(impulseSeis);
  let graph = new sp.seismograph.Seismograph([seisData], seisConfig);
  graph.seismographConfig.isRelativeTime = true;
  graph.seismographConfig.linkedTimeScale.duration = seisData.timeRange.toDuration();
  graph.calcTimeScaleDomain();
  graph.calcAmpScaleDomain();
  impluseresp_div.appendChild(graph);
  graph.draw();

}


function fftForwardArray(dataArray, sampRate=1) {
  let packetFreq = sp.fft.calcDFT(dataArray);
  let tryFFT = sp.fft.FFTResult.createFromPackedFreq(packetFreq, dataArray.length, sampRate);
  return tryFFT;
}
