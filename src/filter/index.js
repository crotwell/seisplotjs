// @flow

import * as OregonDSPTop from 'oregondsp';

import {Seismogram, Trace} from './seismogram';
import {InstrumentSensitivity} from './stationxml';

import * as transfer  from './transfer';
import * as taper  from './taper';
import {hilbert, envelope} from './hilbert';
import {calcDFT, inverseDFT, ampPhase, fftForward, fftInverse, FFTResult} from './fft';
import {rotate, vectorMagnitude} from './vector';

export const createComplex = transfer.createComplex;

let OregonDSP = OregonDSPTop.com.oregondsp.signalProcessing;

export { OregonDSP, model, taper, transfer, hilbert, envelope,
  calcDFT, inverseDFT, ampPhase, fftForward, fftInverse, FFTResult,
  rotate, vectorMagnitude };

export let BAND_PASS = OregonDSP.filter.iir.PassbandType.BANDPASS;
export let LOW_PASS = OregonDSP.filter.iir.PassbandType.LOWPASS;
export let HIGH_PASS = OregonDSP.filter.iir.PassbandType.HIGHPASS;

export function amplitude(real: number, imag: number) {
  return Math.hypot(real, imag);
}

export function rMean(seis: Seismogram|Trace) :Seismogram {
  console.log(`rMean input class is: ${(seis.constructor.name)}`)
  if (seis instanceof Trace) {
    let meanVal = 0;
    let npts = seis.numPoints;
    for (let s of seis.seisArray) {
      meanVal += mean(s)*s.numPoints;
    }
    meanVal = meanVal / npts;
    let rmeanTrace = new Trace(seis.seisArray.map(s =>{
        let demeanY = s.y.map(function(d) {
          return d-meanVal;
        });
        let out = s.clone();
        out.y = demeanY;
        return out;
      }));
    return rmeanTrace;
  } else if (seis instanceof Seismogram) {
    let out = seis.clone();
    let meanVal = mean(seis);
    let demeanY = seis.y.map(function(d) {
      return d-meanVal;
    });
    out.y = demeanY;
    return out;
  } else {
    throw new Error("rMean arg not a Seismogram or Trace");
  }
}

export function gainCorrect(instrumentSensitivity : model.InstrumentSensitivity, seis: Seismogram|Trace) {
  if (seis instanceof Trace) {
    let gainTrace = new Trace(seis.seisArray.map(s =>{
      return gainCorrect(instrumentSensitivity, s);
      }));
    return gainTrace;
  } else {
      let out = seis.clone();
      let gain = instrumentSensitivity.sensitivity;
      let gainY = seis.y.map(function(d) {
        return d/gain;
      });
      out.y = gainY;
      out.yUnit = instrumentSensitivity.inputUnits;
      return out;
  }
}


export function minMaxMean(seis: Seismogram|Trace): number {
  let meanVal = 0;
  let minVal = 9999999999;
  let maxVal = -9999999999;
  if (seis instanceof Trace) {
    let npts = seis.numPoints;
    for (let s of seis.seisArray) {
      meanVal += mean(s)*s.numPoints;
      minVal = s.y.reduce((acc, val) => {return Math.min(acc, val);}, minVal);
      maxVal = s.y.reduce((acc, val) => {return Math.max(acc, val);}, maxVal);
    }
    meanVal = meanVal / npts;
  } else {
    meanVal += mean(seis);
    minVal = seis.y.reduce((acc, val) => {return Math.min(acc, val);}, minVal);
    maxVal = seis.y.reduce((acc, val) => {return Math.max(acc, val);}, maxVal);
  }
  return {
    min: minVal,
    max: maxVal,
    mean: meanVal
  };
}
export function mean(waveform: Seismogram|Trace): number {
  if (waveform instanceof Trace) {
    let meanVal = 0;

    let npts = waveform.numPoints;
    for (let s of waveform.seisArray) {
      meanVal += mean(s)*s.numPoints;
    }
    meanVal = meanVal / npts;
    return meanVal;
  } else {
    return meanOfSlice(waveform.y, waveform.y.length);
  }
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
