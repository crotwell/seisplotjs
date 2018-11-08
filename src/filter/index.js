// @flow

import * as OregonDSPTop from 'oregondsp';
import * as model from '../model/index';

import * as transfer  from './transfer';
import * as taper  from './taper';
import {hilbert, envelope} from './hilbert';
import {calcDFT, inverseDFT, ampPhase} from './fft';
import {rotate, vectorMagnitude} from 'vector';

export const createComplex = transfer.createComplex;

let OregonDSP = OregonDSPTop.com.oregondsp.signalProcessing;

export { OregonDSP, model, taper, transfer, hilbert, envelope,
  calcDFT, inverseDFT, ampPhase,
  rotate, vectorMagnitude };

export let BAND_PASS = OregonDSP.filter.iir.PassbandType.BANDPASS;
export let LOW_PASS = OregonDSP.filter.iir.PassbandType.LOWPASS;
export let HIGH_PASS = OregonDSP.filter.iir.PassbandType.HIGHPASS;

const DtoR = Math.PI / 180;

export function amplitude(real: number, imag: number) {
  return Math.hypot(real, imag);
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
