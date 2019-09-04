//@flow

/**
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */

import {createComplex, Complex } from './filter.js';

import * as OregonDSPTop from 'oregondsp';
const OregonDSP = OregonDSPTop.com.oregondsp.signalProcessing;

/** A higher level function to calculate DFT. Returns a
  * FFTResult for easier access to the result as
  * complex, amp, phase arrays. Calls calcDFT internally.
  */
export function fftForward(timeseries: Int32Array | Float32Array | Float64Array) {
  let result = FFTResult.createFromPackedFreq(calcDFT(timeseries, timeseries.length), timeseries.length);
  return result;
}

/**
 * Calculates the discrete fourier transform using the OregonDSP library.
 * @param   timeseries timeseries array
 * @param   npts     number of points in timeseries array.
 * @return           DFT as packed array Float32Array
 */
export function calcDFT(timeseries: Int32Array | Float32Array | Float64Array, npts: number): Float32Array {
  let log2N = 4;
  let N = 16;
  while(N < npts) { log2N += 1; N = 2 * N;}
  let dft = new OregonDSP.fft.RDFT(log2N);
  let inArray = new Float32Array(N);
  inArray.fill(0);
  for(let i=0; i<timeseries.length; i++) {
    inArray[i] = timeseries[i];
  }

  let out = new Float32Array(N).fill(0);
  dft.evaluate(inArray, out);
  return out;
}

/**
 * Calculates the inverse discrete fourier transform using the OregonDSP library.
 * @param   packedFreq DFT as packed array Float32Array
 * @param   npts     number of points in original timeseries array.
 * @return           inverse of DFT as a timeseries array
 */
export function inverseDFT(packedFreq: Float32Array, npts: number): Float32Array {
  if (npts > packedFreq.length) {
    throw new Error("Not enough points in packed freq array for "+npts+", only "+packedFreq.length);
  }
  let log2N = 4;
  let N = 16;
  while(N < packedFreq.length) { log2N += 1; N = 2 * N;}
  if (N !== packedFreq.length) {
    throw new Error("power of two check fails: "+N+" "+packedFreq.length);
  }
  let dft = new OregonDSP.fft.RDFT(log2N);
  let out = new Float32Array(N).fill(0);
  dft.evaluateInverse(packedFreq, out);
  return out.slice(0, npts);
}

/** Results of FFT calculateion. Allows convertion of the packed real/imag array output from calcDFT into
 * amplitude and phase.
 */
export class FFTResult {
  origLength: number;
  packedFreq: Float32Array;
  complex: Array<Complex>;
  amp: Float32Array;
  phase: Float32Array;
  npts: number;
  constructor(origLength: number) {
      this.origLength = origLength;
  }
  /**
   * Factory method to create FFTResult from packed array.
   * @param   packedFreq real and imag values in packed format
   * @param   origLength length of the original timeseries before padding.
   * @return            FFTResult
   */
  static createFromPackedFreq(packedFreq: Float32Array, origLength: number) {
    let fftResult = new FFTResult(origLength);
    fftResult.packedFreq = packedFreq;
    fftResult.recalcFromPackedFreq();
    return fftResult;
  }
  /**
   * Factory method to create from array of complex numbers.
   * @param   complexArray real and imag values as array of Complex objects.
   * @param   origLength   length of the original timeseries before padding.
   * @return               FFTResult
   */
  static createFromComplex(complexArray: Array<Complex>, origLength: number) {
    let fftResult = new FFTResult(origLength);
    fftResult.complex = complexArray;
    fftResult.recalcFromComplex();
    return fftResult;
  }
  /**
   * Factory method to create from amp and phase arrays
   * @param   amp        amplitude values
   * @param   phase      phase values
   * @param   origLength length of the original timeseries before padding.
   * @return             FFTResult
   */
  static createFromAmpPhase(amp: Float32Array, phase: Float32Array, origLength: number) {
    let fftResult = new FFTResult(origLength);
    if (amp.length !== phase.length) {throw new Error(`amp and phase must be same length: ${amp.length} ${phase.length}`);}
    fftResult.amp = amp;
    fftResult.phase = phase;
    fftResult.recalcFromAmpPhase();
    return fftResult;
  }
  recalcFromPackedFreq(): void {
    this.complex = [];
    this.amp = new Float32Array(this.packedFreq.length/2+1);
    this.phase = new Float32Array(this.packedFreq.length/2+1);
    this.npts = 0;

    let c = createComplex(this.packedFreq[0], 0);
    this.complex.push(c);
    this.amp[0] = c.abs();
    this.phase[0] = c.angle();
    this.npts++;
    const L = this.packedFreq.length;
    for(let i=1; i<this.packedFreq.length/2; i++) {
      c = createComplex(this.packedFreq[i], this.packedFreq[L-i]);
      this.complex.push(c);
      this.amp[i] = c.abs();
      this.phase[i] = c.angle();
      this.npts++;
    }
    c = createComplex(this.packedFreq[L/2], 0);
    this.complex.push(c);
    this.amp[this.packedFreq.length/2] = c.abs();
    this.phase[this.packedFreq.length/2] = c.angle();
    this.npts++;
  }
  /** recalculate the packedFreq array after modifications
    * to the complex array. */
  recalcFromComplex() {
    const N = this.complex.length;
    let modFreq = new Float32Array(N).fill(0);
    modFreq[0] = this.complex[0].real;
    for (let i=1; i< this.complex.length-1; i++) {
      modFreq[i] = this.complex[i].real;
      modFreq[N-i] = this.complex[i].imag;
    }
    modFreq[N/2] = this.complex[N-1].real;
    this.packedFreq = modFreq;
  }
  /** recalculate the packedFreq array after modifications
    * to the amp and/or phase arrays.
    */
  recalcFromAmpPhase() {
    let modComplex = new Array(this.amp.length);
    for (let i=0; i< this.amp.length; i++) {
      modComplex[i] = OregonDSP.filter.iir.Complex.Companion.ComplexFromPolar(this.amp[i], this.phase[i]);
    }
    this.complex = modComplex;
  }
  /** calculates the inverse fft of this.packedFreq
  */
  fftInverse() {
    return inverseDFT(this.packedFreq, this.origLength);
  }
  clone() {
    return FFTResult.createFromPackedFreq(this.packedFreq.slice(), this.origLength);
  }
}
