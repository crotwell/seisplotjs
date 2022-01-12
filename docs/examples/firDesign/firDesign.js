
const odsp = seisplotjs.OregonDSP;
const d3 = seisplotjs.d3;
d3.select("button#load").on("click", function(d) { createFIR(); });

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
  const doLogLog = d3.select("input[name=loglog]").property('checked');
  let firLp = new odsp.filter.fir.equiripple.EquirippleLowpass(N, OmegaP, Wp, OmegaS, Ws);

  d3.select("h3.coefficients").selectAll("*").remove();
  d3.select("h3.coefficients").text(`FIR Coefficients: N: ${N} => ${2*N+1}  OmegaP: ${OmegaP} Wp: ${Wp}  OmegsS: ${OmegaS} Ws: ${Ws}`)

  let coeffDispFun = function(d, i, a) {
    let pre = "    ";
    if (i === 0) {pre = 'coeff = [';}
    let post = ", \n";
    if (i === a.length-1) {post = "];"}
    return `${pre}${d}${post}`;
  };
  let asText = "";
  firLp.getCoefficients().forEach((d,i,a) =>{ asText+= coeffDispFun(d,i,a);});
  let coeffDisplay = d3.select("div.coefficients").select("code")
    .text(asText);


  const NumPoints = parseInt(document.getElementsByName('NumPoints')[0].value);
  const plotWidth = 1024;
  const plotHeight = 512;

  let longCoeff = new Array(NumPoints).fill(0);
  for(let i=0; i<firLp.getCoefficients().length; i++) {
    longCoeff[i] = firLp.getCoefficients()[i];
  }
  const plotConfig = new seisplotjs.seismographconfig.SeismographConfig();
  plotConfig.title = "FIR Filter"
  d3.select("div.fftfir").selectAll("*").remove();
  let impulseResponse = fftForwardArray(longCoeff)
  d3.select("div.fftfir").selectAll("*").remove();
  const firPlot = new seisplotjs.fftplot.FFTPlot("div.fftfir", plotConfig, [impulseResponse],  doLogLog, true, false);
  firPlot.draw();
  const firPhasePlot = new seisplotjs.fftplot.FFTPlot("div.fftfir", plotConfig, [impulseResponse],  doLogLog, false, true);
  firPhasePlot.draw();
  d3.select("div.message").append('p').text(`Zero Freq Gain: ${impulseResponse.amp[0]}`);
}


function fftForwardArray(dataArray, sampRate=1) {
  let packetFreq = seisplotjs.fft.calcDFT(dataArray);
  let tryFFT = seisplotjs.fft.FFTResult.createFromPackedFreq(packetFreq, dataArray.length, sampRate);
  return tryFFT;
}
