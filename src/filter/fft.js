//@flow

import {createComplex, Complex } from './filterUtil';

import * as OregonDSPTop from 'oregondsp';
const OregonDSP = OregonDSPTop.com.oregondsp.signalProcessing;

/** A higher level function to calculate DFT. Returns a
  * FFTResult for easier access to the result as
  * complex, amp, phase arrays. Calls calcDFT internally.
  */
export function fftForward(timeseries: Int32Array | Float32Array | Float64Array) {
  let result = new FFTResult(calcDFT(timeseries, timeseries.length), timeseries.length);
  return result;
}

/** A higher level function to calculate inverse DFT.
  * Argument is a FFTResult output by fftForward.
  * Calls inverseDFT internally.
  */
export function fftInverse(fftResult: FFTResult) {
  return inverseDFT(fftResult.packedFreq, fftResult.origLength);
}

export function calcDFT(waveform: Int32Array | Float32Array | Float64Array, npts: number): Float32Array {
  let log2N = 4;
  let N = 16;
  while(N < npts) { log2N += 1; N = 2 * N;}
  let dft = new OregonDSP.fft.RDFT(log2N);
  let inArray = new Float32Array(N);
  inArray.fill(0);
  for(let i=0; i<waveform.length; i++) {
    inArray[i] = waveform[i];
  }

  let out = new Float32Array(N).fill(0);
  dft.evaluate(inArray, out);
  return out;
}

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
  constructor(packedFreq: Float32Array, origLength: number) {
    this.packedFreq = packedFreq;
    this.origLength = origLength;
    this._calcAmpPhase();
  }
  _calcAmpPhase(): void {
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
    let modComplex = new Array(this.complex.length);
    for (let i=0; i< this.complex.length; i++) {
      modComplex[i] = OregonDSP.filter.iir.Complex.Companion.ComplexFromPolar(this.amp[i], this.phase[i]);
    }
    this.complex = modComplex;
  }
  clone() {
    return new FFTResult(this.packedFreq.slice(), this.origLength);
  }
}
