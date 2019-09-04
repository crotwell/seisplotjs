// @flow

/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */

import {Seismogram } from './seismogram.js';
import {InstrumentSensitivity} from './stationxml.js';
import * as OregonDSPTop from 'oregondsp';

const OregonDSP = OregonDSPTop.com.oregondsp.signalProcessing;
const CenteredHilbertTransform = OregonDSP.filter.fir.equiripple.CenteredHilbertTransform;
export const Complex = OregonDSP.filter.iir.Complex;

export function createComplex(real: number, imag: number) {
  return OregonDSP.filter.iir.Complex_init(real, imag);
}

/**
 * Constant for bandpass OregonDSP filter creation.
 * @type string
 */
export let BAND_PASS = OregonDSP.filter.iir.PassbandType.BANDPASS;
/**
 * Constant for lowpass OregonDSP filter creation.
 * @type string
 */
export let LOW_PASS = OregonDSP.filter.iir.PassbandType.LOWPASS;
/**
 * Constant for highpass OregonDSP filter creation.
 * @type string
 */
export let HIGH_PASS = OregonDSP.filter.iir.PassbandType.HIGHPASS;

export function amplitude(real: number, imag: number) {
  return Math.hypot(real, imag);
}

/**
 * Remove the mean from a seismogram. Subtract the mean from each data point.
 * @param  {[type]} seis input seismogram
 * @return {[type]}      seismogram with mean of zero
 */
export function rMean(seis: Seismogram): Seismogram {
  if (seis instanceof Seismogram) {
    let meanVal = seis.mean();
    let rmeanSeismogram = new Seismogram(seis.segments.map(s =>{
        let demeanY = s.y.map(function(d) {
          return d-meanVal;
        });
        let out = s.cloneWithNewData(demeanY);
        return out;
      }));
    return rmeanSeismogram;
  } else {
    throw new Error("rMean arg not a Seismogram");
  }
}
/**
 * Apply the frequency independent overall gain to a seismogram. This does not
 * do a full transfer using poles and zero, this only applies the scalar conversion
 * factor to convert counts back to original real world units and update the units.
 * @param  {[type]} seis                  the seismogram to correct
 * @param  {[type]} instrumentSensitivity overall gain object, usually pulled from stationxml
 * @return {[type]}                       new seismogram with original units, like m/s and gain applied.
 */
export function gainCorrect(seis: Seismogram, instrumentSensitivity: InstrumentSensitivity): Seismogram {
  if (seis instanceof Seismogram) {
    let gain = instrumentSensitivity.sensitivity;
    let gainSeismogram = new Seismogram(seis.segments.map(s => {
      let gainY;
      if ( s.y instanceof Int32Array || s.y instanceof Float32Array) {
        gainY = Float32Array.from(s.y);
      } else {
        gainY = Float64Array.from(s.y)
      }
      gainY = gainY.map(function(d) {
        return d/gain;
      });
      let outS = s.cloneWithNewData(gainY);
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


/**
 * Creates a Butterworth IIR filter using the OregonDSP library.
 * @param  {[type]} numPoles       number of poles
 * @param  {[type]} passband       type, use constants of BAND_PASS, LOW_PASS, HIGH_PASS
 * @param  {[type]} lowFreqCorner  low corner frequency
 * @param  {[type]} highFreqCorner high corner frequency
 * @param  {[type]} delta          delta, period, of timeseries
 * @return {[type]}                Butterworth IIR filter
 */
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

/**
 * Creates a Chebyshev I IIR filter using the OregonDSP library.
 * @param  {[type]} numPoles       number of poles
 * @param  {[type]} epsilon        Chebyshev epsilon value
 * @param  {[type]} passband       type, use constants of BAND_PASS, LOW_PASS, HIGH_PASS
 * @param  {[type]} lowFreqCorner  low corner frequency
 * @param  {[type]} highFreqCorner high corner frequency
 * @param  {[type]} delta          delta, period, of timeseries
 * @return {[type]}                Chebyshev I IIR filter
 */
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

/**
 * Creates a Chebyshev II IIR filter using the OregonDSP library.
 * @param  {[type]} numPoles       number of poles
 * @param  {[type]} epsilon        Chebyshev epsilon value
 * @param  {[type]} passband       type, use constants of BAND_PASS, LOW_PASS, HIGH_PASS
 * @param  {[type]} lowFreqCorner  low corner frequency
 * @param  {[type]} highFreqCorner high corner frequency
 * @param  {[type]} delta          delta, period, of timeseries
 * @return {[type]}                Chebyshev II IIR filter
 */
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

export function applyFilter(iirFilter: OregonDSP.filter.iir.IIRFilter, seis: Seismogram): Seismogram {
  let filteredSegments = [];
  for(let i=0; i<seis.segments.length; i++) {
    let outData = Float32Array.from(seis.segments[i].y);
    iirFilter.filterInPlace(outData);
    filteredSegments.push(seis.segments[i].cloneWithNewData(outData));
  }
  return new Seismogram(filteredSegments);
}


/** Calculates the envelope, y_i = sqrt( y_i * y_i + h_i * h_i)
 *  where h is the hilber transform of y. The default configuration
 *  for the hilbet transform is n=100, lowEdge=.05 and highEdge = 0.95
 */
export function envelope(seis: Seismogram): Seismogram {
  if (seis.isContiguous()) {
    let seisY = seis.y;
    let s = hilbert(seis);
    let hilbertY = s.y;
    let outY;
    if ( seis.y instanceof Int32Array || seis.y instanceof Float32Array) {
      outY = new Float32Array(seisY.length);
    } else {
      outY = new Float64Array(seisY.length);
    }
    for(let n=0; n<seisY.length; n++) {
      outY[n] = Math.sqrt(hilbertY[n]*hilbertY[n] + seisY[n]*seisY[n]);
    }
    return seis.cloneWithNewData(outY);
  } else {
    throw new Error("Cannot take envelope of non-contiguous seismogram");
  }
}

/** Calculates the hilbert transform using the OregonDSP library
 *  with default number of points, n=10 (to yield a 21 pt FIR transform)
 *  and default low and high edge of 0.05 and 0.95. Low and high edge are
 *  given normalized 0 to 1.
 */
export function hilbert(seis: Seismogram, n?: number, lowEdge?: number, highEdge?: number ): Seismogram {
  if (seis.isContiguous()) {
    let seisY = seis.y;
    if (! n) { n = 10;}
    if (! lowEdge) { lowEdge = .05;}
    if (! highEdge) { highEdge = .95;}
    let hilbert = new CenteredHilbertTransform(n, lowEdge, highEdge);
    let coeff = hilbert.getCoefficients();
    for (let c of coeff) {
      if ( Number.isNaN(c)) {
        throw new Error(`Hilbert FIR coeff includes NaN: ${coeff.join()}`);
      }
    }
    let hilbertY = hilbert.filter(seisY);
    let s = seis.cloneWithNewData(hilbertY);
    return s;
  } else {
    throw new Error("Cannot take hilbert of non-contiguous seismogram");
  }
}
