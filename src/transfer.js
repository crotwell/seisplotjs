//@flow

/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */

import {calcDFT, inverseDFT, FFTResult } from './fft.js';
import {SeismogramSegment, Seismogram } from './seismogram.js';
import { SacPoleZero } from './sacpolezero.js';
import {Response, PolesZeros } from './stationxml.js';
import Qty from 'js-quantities';
import { Complex, createComplex} from './oregondsputil.js';

/**
 * Applies response, poles and zeros along with overall gain to the seismogram.
 * Should produce results similar to the sac command:
 * transfer from polezero to none
 *
 * @param   seis     seismogram to instrument correct
 * @param   response response to apply
 * @param   lowCut   low cut
 * @param   lowPass  low pass
 * @param   highPass high pass
 * @param   highCut  high cut
 * @returns           instrument corrected seismogram
 */
export function transfer(seis: Seismogram,
                        response: Response,
                        lowCut: number,
                        lowPass: number,
                        highPass: number,
                        highCut: number): Seismogram {
        if (! response) {
          throw new Error("Response not exist???");
        }
        const sacPoleZero = convertToSacPoleZero(response);

        return transferSacPZ(seis, sacPoleZero, lowCut, lowPass, highPass, highCut);
      }


export function transferSacPZ(seis: Seismogram,
                              sacPoleZero: SacPoleZero,
                              lowCut: number,
                              lowPass: number,
                              highPass: number,
                              highCut: number): Seismogram {
  let outSeis = [];
  for( let i=0; i< seis.segments.length; i++) {
    let result = transferSacPZSegment(seis.segments[i],
                                      sacPoleZero,
                                      lowCut,
                                      lowPass,
                                      highPass,
                                      highCut);
    outSeis.push(result);
  }
  return new Seismogram(outSeis);
}

export function transferSacPZSegment(seis: SeismogramSegment,
                              sacPoleZero: SacPoleZero,
                              lowCut: number,
                              lowPass: number,
                              highPass: number,
                              highCut: number): SeismogramSegment {
        const sampFreq = seis.sampleRate;

        let values = seis.y;
        let outData = Float32Array.from(values);
        /* sac premultiplies the data by the sample period before doing the fft. Later it
         * seems to be cancled out by premultiplying the pole zeros by a similar factor.
         * I don't understand why they do this, but am reproducing it in order to be
         * compatible.
         */
        outData.forEach((d,i) => outData[i] = d/sampFreq);

        let freqValues = calcDFT(outData);
        freqValues = combine(freqValues, sampFreq, sacPoleZero, lowCut, lowPass, highPass, highCut);

        outData = inverseDFT(freqValues, values.length);
        // a extra factor of nfft gets in somehow???
        outData.forEach((d,i) => outData[i] = d * freqValues.length);
        let out = seis.cloneWithNewData(outData);
        //out.y_unit = UNITS.METER;
        out.yUnit = 'm';
        return out;
    }


export function calcResponse(response: Response, numPoints: number, sampleRate: number, unit: string | Qty ="m"): FFTResult {
  const sacPoleZero = convertToSacPoleZero(response);

  const unitQty = new Qty(unit);
  let gamma = 0;
  if (unitQty.isCompatible(UNITS.METER)) {
      gamma = 0;
  } else if (unitQty.isCompatible(UNITS.METER_PER_SECOND)) {
      gamma = 1;
  } else if (unitQty.isCompatible(UNITS.METER_PER_SECOND_PER_SECOND)) {
      gamma = 2;
  } else {
      throw new Error("response unit is not displacement (m), velocity (m/s) or acceleration (m/s^2): "+unit);
  }
  for(let i=0; i<gamma; i++) {
    let z = sacPoleZero.zeros[sacPoleZero.zeros.length-1-i];
    if (z.real() !== 0 || z.imag() !== 0) {
      throw new Error(`Attempt to trim ${gamma} zeros from SacPoleZero, but zero isn't 0+i0: ${z}`);
    }
  }
  // subtract gama zeros, ex 1 to get
  let trimmedZeros = sacPoleZero.zeros.slice().reverse();
  for(let i=0; i<gamma; i++) {
    let idx = trimmedZeros.findIndex((d) => d.real() === 0 && d.imag() === 0);
    trimmedZeros.splice(idx, 1);
  }
  trimmedZeros = trimmedZeros.reverse();
  sacPoleZero.zeros = trimmedZeros;
  let out = calcResponseFromSacPoleZero( sacPoleZero, numPoints, sampleRate);
  return out;
}

/**
 * Caclulates the frequency response from the given poles and zeros.
 *
 * @param   sacPoleZero poles and zeros
 * @param   numPoints   number of points in the output fft
 * @param   sampleRate  sample rate to compute at
 * @returns             frequency response
 */
export function calcResponseFromSacPoleZero(sacPoleZero: SacPoleZero, numPoints: number, sampleRate: number): FFTResult {
  // inst response as packed frequency array
  let freqValues = new Float32Array(numPoints);
  const deltaF = sampleRate / freqValues.length;
  // zero freq
  freqValues[0] = 0;
  // nyquist
  let freq = sampleRate / 2;
  let respAtS = evalPoleZeroInverse(sacPoleZero, freq);
  respAtS = createComplex(1, 0).overComplex(respAtS);
  freqValues[freqValues.length/2 ] = respAtS.real();
  for(let i = 1; i < freqValues.length / 2 ; i++) {
    freq = i * deltaF;
    respAtS = evalPoleZeroInverse(sacPoleZero, freq);
    //respAtS = respAtS.timesReal(deltaF*i);
    respAtS = createComplex(1, 0).overComplex(respAtS);
    if (respAtS.real() !== 0 && respAtS.imag() !== 0) {
      freqValues[i] = respAtS.real();
      freqValues[freqValues.length-i] = respAtS.imag();
    } else {
      freqValues[i] = 1e-10;
      freqValues[freqValues.length-i] = 0;
    }
  }
  let out = FFTResult.createFromPackedFreq(freqValues, numPoints, sampleRate);
  return out;
}

/**
 * Applies poles and zeros to the fft of a time series. Modifies the freqValues
 * in place.
 *
 * @param   freqValues  fft of a timeseries
 * @param   sampFreq    sampling frequency
 * @param   sacPoleZero poles and zeros
 * @param   lowCut      low cut
 * @param   lowPass     low pass
 * @param   highPass    high pass
 * @param   highCut     high cut
 * @returns             input freq values, with poles and zeros applied
 */
export function combine(freqValues: Float32Array,
                        sampFreq: number,
                        sacPoleZero: SacPoleZero,
                        lowCut: number,
                        lowPass: number,
                        highPass: number,
                        highCut: number) {
        const deltaF = sampFreq / freqValues.length;

        // handle zero freq, no imag, set real to 0
        freqValues[0] = 0;
        // handle nyquist
        let freq = sampFreq / 2;
        let respAtS = evalPoleZeroInverse(sacPoleZero, freq);
        respAtS = respAtS.timesReal(deltaF*calcFreqTaper(freq,
                                               lowCut,
                                               lowPass,
                                               highPass,
                                               highCut));
        freqValues[freqValues.length/2 ] = respAtS.timesReal(freqValues[freqValues.length/2 ]).real();
        for(let i = 1; i < freqValues.length / 2 ; i++) {
            freq = i * deltaF;
            respAtS = evalPoleZeroInverse(sacPoleZero, freq);
            respAtS = respAtS.timesReal(deltaF*calcFreqTaper(freq,
                                                               lowCut,
                                                               lowPass,
                                                               highPass,
                                                               highCut));
            let freqComplex = createComplex(freqValues[i], freqValues[freqValues.length-i])
                .timesComplex(respAtS);
            freqValues[i] = freqComplex.real();
            freqValues[freqValues.length-i] = freqComplex.imag();
        }
        return freqValues;
    }

  /**
   * Evaluates the poles and zeros at the given value. The return value is
   * 1/(pz(s) to avoid divide by zero issues. If there is a divide by zero
   * situation, then the response is set to be 0+0i.
   *
   * @param sacPoleZero SAC PoleZero response
   * @param freq frequency to evaluate
   * @returns complex frequency domain value for this frequency
   */
  export function evalPoleZeroInverse(sacPoleZero: SacPoleZero, freq: number) {
        const s = createComplex(0, 2 * Math.PI * freq);
        let zeroOut = createComplex(1, 0);
        let poleOut = createComplex(1, 0);
        for(let i = 0; i < sacPoleZero.poles.length; i++) {
            poleOut = poleOut.timesComplex( s.minusComplex(sacPoleZero.poles[i]) );
        }
        for(let i = 0; i < sacPoleZero.zeros.length; i++) {
            if(s.real() === sacPoleZero.zeros[i].real()
                    && s.imag() === sacPoleZero.zeros[i].imag()) {
                return createComplex(0,0);
            }
            zeroOut = zeroOut.timesComplex( s.minusComplex(sacPoleZero.zeros[i]) );
        }
        let out = poleOut.overComplex(zeroOut);
        return out.overReal( sacPoleZero.constant);
    }

/**
 * Calculates the frequency taper for the given parameters.
 *
 * @param   freq     frequency
 * @param   lowCut   low cut
 * @param   lowPass  low pass
 * @param   highPass high pass
 * @param   highCut  high cut
 * @returns           taper value at the frequency
 */
export function calcFreqTaper(freq: number,
                          lowCut: number,
                          lowPass: number,
                          highPass: number,
                          highCut: number): number {
    if (lowCut > lowPass || lowPass > highPass || highPass > highCut) {
        throw new Error("must be lowCut > lowPass > highPass > highCut: "+lowCut +" "+ lowPass +" "+ highPass +" "+ highCut);
    }
    if(freq <= lowCut || freq >= highCut) {
        return 0;
    }
    if(freq >= lowPass && freq <= highPass) {
        return 1;
    }
    if(freq > lowCut && freq < lowPass) {
        return 0.5 * (1.0 + Math.cos(Math.PI * (freq - lowPass)
                / (lowCut - lowPass)));
    }
    // freq > highPass && freq < highCut
    return 0.5 * (1.0 - Math.cos(Math.PI * (freq - highCut)
            / (highPass - highCut)));
}

/**
 * Applies the frequency taper to the fft of the time series.
 *
 * @param   fftResult  fft of time series
 * @param   sampleRate sample rate
 * @param   lowCut     low cut
 * @param   lowPass    low pass
 * @param   highPass   high pass
 * @param   highCut    high cut
 * @returns            fft with taper applied
 */
export function applyFreqTaper(fftResult: FFTResult,
                          sampleRate: number,
                          lowCut: number,
                          lowPass: number,
                          highPass: number,
                          highCut: number): FFTResult {

  const deltaF = sampleRate / fftResult.amp.length / 2;
  return FFTResult.createFromAmpPhase(fftResult.amp.map( (v,i) => i === 0 ? 0 : v*calcFreqTaper(i*deltaF, lowCut, lowPass, highPass, highCut)),
                                      fftResult.phase, fftResult.origLength, fftResult.sampleRate);
}

/**
 * commonly used units as Qty
 */
export const UNITS = {
  COUNT: new Qty('count'),
  METER: new Qty('m'),
  METER_PER_SECOND: new Qty('m/s'),
  METER_PER_SECOND_PER_SECOND: new Qty('m/s2'),
};

 /**
  * Converts a StationXML response to SAC PoleZero style. This
  * converts the analog to digital stage (usually 0) along
  * with the overall gain, but does not include later FIR stages.
  * To maintain compatibility with SAC, this includes extra zeros
  * if needed to convert to displacement. The number of extra zeros
  * added is kept as gamma in the result.
  *
  * @param response stationxml Response to convert
  * @returns SAC PoleZero style version of the response
  */
export function convertToSacPoleZero( response: Response) {
    let polesZeros: PolesZeros;
    if (response.stages[0].filter instanceof PolesZeros) {
      polesZeros = response.stages[0].filter;
    } else {
      throw new Error("can't find PolesZeros");
    }
    let unit = response.instrumentSensitivity.inputUnits;
    if (unit === "M/S" || unit === "M/SEC") {
      unit = "m/s";
    }
    const unitQty = new Qty(unit);
    let scaleUnit = new Qty(1, unit);
    let gamma = 0;
    if (unitQty.isCompatible(UNITS.METER)) {
        gamma = 0;
        scaleUnit = scaleUnit.to(UNITS.METER);
    } else if (unitQty.isCompatible(UNITS.METER_PER_SECOND)) {
        gamma = 1;
        scaleUnit = scaleUnit.to(UNITS.METER_PER_SECOND);
    } else if (unitQty.isCompatible(UNITS.METER_PER_SECOND_PER_SECOND)) {
        gamma = 2;
        scaleUnit = scaleUnit.to(UNITS.METER_PER_SECOND_PER_SECOND);
    } else {
        throw new Error("response unit is not displacement, velocity or acceleration: "+unit);
    }

    let mulFactor = 1;
    if (polesZeros.pzTransferFunctionType === "LAPLACE (HERTZ)") {
        mulFactor = 2 * Math.PI;
    }
    let zeros = [];
    // extra gamma zeros are (0,0)
    for (let i = 0; i < polesZeros.zeros.length; i++) {
        zeros[i] = createComplex(polesZeros.zeros[i].real() * mulFactor,
                               polesZeros.zeros[i].imag() * mulFactor);
    }
    for (let i=0; i<gamma; i++) {
      zeros.push(createComplex(0,0));
    }
    let poles = [];
    for (let i = 0; i < polesZeros.poles.length; i++) {
        poles[i] = createComplex(polesZeros.poles[i].real() * mulFactor,
                               polesZeros.poles[i].imag() * mulFactor);
    }
    let constant = polesZeros.normalizationFactor;
    let sd = response.instrumentSensitivity.sensitivity;
    let fs = response.instrumentSensitivity.frequency;
    sd *= Math.pow(2 * Math.PI * fs, gamma);
    let A0 = polesZeros.normalizationFactor;
    let fn = polesZeros.normalizationFrequency;
    A0 = A0 / Math.pow(2 * Math.PI * fn, gamma);
    if (polesZeros.pzTransferFunctionType === "LAPLACE (HERTZ)") {
        A0 *= Math.pow(2 * Math.PI, polesZeros.poles.length - polesZeros.zeros.length);
    }
    if (poles.length === 0 && zeros.length === 0) {
        constant = (sd * A0);
    } else {
        constant = (sd * calc_A0(poles, zeros, fs));
    }
    constant *= scaleUnit.scalar;
    let sacPZ = new SacPoleZero(poles, zeros, constant);
    sacPZ.gamma= gamma;
    sacPZ.mulFactor= mulFactor;
    sacPZ.sd= sd;
    sacPZ.A0= A0;
    return sacPZ;
}

export function calc_A0(poles: Array<Complex>,
                        zeros: Array<Complex>,
                        ref_freq: number) {
    let numer = createComplex(1, 0);
    let denom = createComplex(1, 0);
    let f0;
    let a0;
    f0 = createComplex(0, 2 * Math.PI * ref_freq);
    for (let i = 0; i < zeros.length; i++) {
        denom = denom.timesComplex( f0.minusComplex(zeros[i]));
    }
    for (let i = 0; i < poles.length; i++) {
        numer = numer.timesComplex( f0.minusComplex(poles[i]));
    }
    a0 = numer.overComplex(denom).abs();
    return a0;
}
