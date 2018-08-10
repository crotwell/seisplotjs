// @flow

import * as OregonDSPTop from 'oregondsp';
import * as model from '../model/index';

import * as transfer  from './transfer';
import * as taper  from './taper';

let OregonDSP = OregonDSPTop.com.oregondsp.signalProcessing;

export { OregonDSP, model, taper, transfer };


// if OregonDSP is loaded (here it is) we want to use
// its Complex instead of the simple one defined in model
export function createComplex(real: number, imag: number) {
  return OregonDSP.filter.iir.Complex_init(real, imag);
};

export let BAND_PASS = OregonDSP.filter.iir.PassbandType.BANDPASS;
export let LOW_PASS = OregonDSP.filter.iir.PassbandType.LOWPASS;
export let HIGH_PASS = OregonDSP.filter.iir.PassbandType.HIGHPASS;

const DtoR = Math.PI / 180;

export function amplitude(real: number, imag: number) {
  return Math.hypot(real, imag);
}

export function rotate(seisA: model.Seismogram, azimuthA: number, seisB: model.Seismogram, azimuthB: number, azimuth: number) {
  if (seisA.y.length != seisB.y.length) {
    throw new Error("seisA and seisB should be of same lenght but was "
    +seisA.y.length+" "+seisB.y.length);
  }
  if (seisA.sampleRate != seisB.sampleRate) {
    throw new Error("Expect sampleRate to be same, but was "+seisA.sampleRate+" "+seisB.sampleRate);
  }
  if ((azimuthA + 90) % 360 != azimuthB % 360) {
    throw new Error("Expect azimuthB to be azimuthA + 90, but was "+azimuthA+" "+azimuthB);
  }
//  [   cos(theta)    -sin(theta)    0   ]
//  [   sin(theta)     cos(theta)    0   ]
//  [       0              0         1   ]
// seisB => x
// seisA => y
// sense of rotation is opposite for aziumth vs math
  const rotRadian = 1 * DtoR * (azimuth - azimuthA);
  const cosTheta = Math.cos(rotRadian);
  const sinTheta = Math.sin(rotRadian);
  let x = new Array(seisA.y.length);
  let y = new Array(seisA.y.length);
  for (var i = 0; i < seisA.y.length; i++) {
    x[i] = cosTheta * seisB.yAtIndex(i) - sinTheta * seisA.yAtIndex(i);
    y[i] = sinTheta * seisB.yAtIndex(i) + cosTheta * seisA.yAtIndex(i);
  }
  let outSeisRad = seisA.clone();
  outSeisRad.y = y;
  outSeisRad.channelCode = seisA.chanCode.slice(0,2)+"R";
  let outSeisTan = seisA.clone();
  outSeisTan.y = x;
  outSeisTan.channelCode = seisA.chanCode.slice(0,2)+"T";
  let out = {
    "radial": outSeisRad,
    "transverse": outSeisTan,
    "azimuthRadial": azimuth % 360,
    "azimuthTransverse": (azimuth + 90) % 360
  };
  return out;
}

export function rMean(seis: model.Seismogram) :model.Seismogram {
  let out = seis.clone();
  let meanVal = mean(seis);
  let demeanY = seis.y.map(function(d) {
    return d-meanVal;
  });
  out.y = demeanY;
  return out;
}

export function mean(waveform: model.Seismogram): number {
  return meanOfSlice(waveform.y, waveform.y.length);
}

function meanOfSlice(dataSlice: Array<number>, totalPts :number ):number {
  if (dataSlice.length < 8) {
    return dataSlice.reduce(function(acc, val) {
       return acc + val;
    }, 0) / totalPts;
  } else {
    var byTwo = Math.floor(dataSlice.length / 2);
    return meanOfSlice(dataSlice.slice(0, byTwo), totalPts) + meanOfSlice(dataSlice.slice(byTwo, dataSlice.length), totalPts);
  }
}

export function calcDFT(waveform: Array<number>, npts: number):Array<number> {
  let log2N = 4;
  let N = 16;
  while(N < npts) { log2N += 1; N = 2 * N;}
  let dft = new OregonDSP.fft.RDFT(log2N);
  let inArray = waveform.slice();
  for(let i=waveform.length; i< N; i++) {
    inArray.push(0);
  }

  let out = Array(N).fill(0);
  dft.evaluate(inArray, out);
  return out;
}

export function inverseDFT(packedFreq: Array<number>, npts: number):Array<number> {
  if (npts > packedFreq.length) {
    throw new Error("Not enough points in packed freq array for "+npts+", only "+packedFreq.length);
  }
  let log2N = 4;
  let N = 16;
  while(N < packedFreq.length) { log2N += 1; N = 2 * N;}
  if (N != packedFreq.length) {
    throw new Error("power of two check fails: "+N+" "+packedFreq.length);
  }
  let dft = new OregonDSP.fft.RDFT(log2N);
  let out = Array(N).fill(0);
  dft.evaluateInverse(packedFreq, out);
  return out.slice(0, npts);
}

/** converts a packed real/imag array output from calcDFT into
 * amplitude and phase. Output is object with amp and phase fields,
 * each of which is an array.
 */
export function ampPhase(packedFreq: Array<number>) {
  let out = {
    amp: [],
    phase: [],
    npts: 0
  }
  let c = createComplex(packedFreq[0], 0);
  out.amp.push(c.abs());
  out.phase.push(c.angle());
  out.npts++;
  const L = packedFreq.length;
  for(let i=1; i<packedFreq.length/2; i++) {
    c = createComplex(packedFreq[i], packedFreq[L-i]);
    out.amp.push(c.abs());
    out.phase.push(c.angle());
    out.npts++;
  }
  c = createComplex(packedFreq[L/2], 0);
  out.amp.push(c.abs());
  out.phase.push(c.angle());
  out.npts++;
  return out;
}

export function createButterworth(numPoles: number,
                                  passband: string,
                                  lowFreqCorner: number,
                                  highFreqCorner: number,
                                  delta: number) {
  return new OregonDSP.filter.iir.Butterworth(numPoles,
                                     passband,
                                     lowFreqCorner,
                                     highFreqCorner,
                                     delta);
}

export function createChebyshevI(numPoles: number,
                                  epsilon: number,
                                  passband: string,
                                  lowFreqCorner: number,
                                  highFreqCorner: number,
                                  delta: number) {
  return new OregonDSP.filter.iir.ChebyshevI(numPoles,
                                    epsilon,
                                    passband,
                                    lowFreqCorner,
                                    highFreqCorner,
                                    delta);
}

export function createChebyshevII(numPoles: number,
                                  epsilon: number,
                                  passband: string,
                                  lowFreqCorner: number,
                                  highFreqCorner: number,
                                  delta: number) {
  return new OregonDSP.filter.iir.ChebyshevII(numPoles,
                                     epsilon,
                                     passband,
                                     lowFreqCorner,
                                     highFreqCorner,
                                     delta);
}
