// @flow

import * as OregonDSPTop from 'oregondsp';

import {SeismogramSegment, Seismogram} from '../seismogram';
import {InstrumentSensitivity} from '../stationxml';

import * as transfer  from './transfer';
import * as taper  from './taper';
import {hilbert, envelope} from './hilbert';
import {calcDFT, inverseDFT, ampPhase, fftForward, fftInverse, FFTResult} from './fft';
import {rotate, vectorMagnitude} from './vector';

import {Complex, createComplex} from './filterUtil';

let OregonDSP = OregonDSPTop.com.oregondsp.signalProcessing;

export { OregonDSP, Complex, createComplex,
  taper, transfer, hilbert, envelope,
  calcDFT, inverseDFT, ampPhase, fftForward, fftInverse, FFTResult,
  rotate, vectorMagnitude };

export let BAND_PASS = OregonDSP.filter.iir.PassbandType.BANDPASS;
export let LOW_PASS = OregonDSP.filter.iir.PassbandType.LOWPASS;
export let HIGH_PASS = OregonDSP.filter.iir.PassbandType.HIGHPASS;

export function amplitude(real: number, imag: number) {
  return Math.hypot(real, imag);
}

export function rMean(seis: Seismogram): Seismogram {
  console.log(`rMean input class is: ${(seis.constructor.name)}`);
  if (seis instanceof Seismogram) {
    let meanVal = mean(seis);
    let rmeanSeismogram = new Seismogram(seis.seisArray.map(s =>{
        let demeanY = s.y.map(function(d) {
          return d-meanVal;
        });
        let out = s.clone();
        out.y = demeanY;
        return out;
      }));
    return rmeanSeismogram;
  } else {
    throw new Error("rMean arg not a Seismogram");
  }
}

export function gainCorrect(instrumentSensitivity: InstrumentSensitivity, seis: Seismogram): Seismogram {
  if (seis instanceof Seismogram) {
    let out = seis.clone();
    let gain = instrumentSensitivity.sensitivity;
    let gainSeismogram = new Seismogram(seis.seisArray.map(s =>{
      let outS = s.clone();
      let gainY = s.y.map(function(d) {
        return d/gain;
      });
      outS.y = gainY;
      outS.yUnit = instrumentSensitivity.inputUnits;
      return outS;
      }));
    return gainSeismogram;
  } else {
      throw new Error(`Expected Seismogram but was ${typeof seis}`);
  }
}

export type MinMaxMean = {
  min: number;
  max: number;
  mean: number;
};

export function minMaxMean(seis: Seismogram): MinMaxMean {
  let meanVal = 0;
  let minVal = 9999999999;
  let maxVal = -9999999999;
  if (seis instanceof Seismogram) {
    let npts = seis.numPoints;
    for (let s of seis.seisArray) {
      minVal = s.y.reduce((acc, val) => {return Math.min(acc, val);}, minVal);
      maxVal = s.y.reduce((acc, val) => {return Math.max(acc, val);}, maxVal);
    }
    meanVal = mean(seis);
  } else {
    throw new Error("seis not instance of Seismogram");
  }
  return {
    min: minVal,
    max: maxVal,
    mean: meanVal
  };
}
export function mean(seis: Seismogram): number {
  if (seis instanceof Seismogram) {
    let meanVal = 0;

    let npts = seis.numPoints;
    for (let s of seis.seisArray) {
      meanVal += meanOfSlice(s.y, s.y.length)*s.numPoints;
    }
    meanVal = meanVal / npts;
    return meanVal;
  } else {
    throw new Error("seis not instance of Seismogram "+(typeof seis)+" "+(seis.constructor.name));
  }
}

function meanOfSlice(dataSlice: Array<number>, totalPts: number ): number {
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
