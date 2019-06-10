//@flow

import {createComplex, Complex } from './transfer';

import * as OregonDSPTop from 'oregondsp';
const OregonDSP = OregonDSPTop.com.oregondsp.signalProcessing;

/** A higher level function to calculate DFT. Returns a
  * FFTResult for easier access to the result as
  * complex, amp, phase arrays. Calls calcDFT internally.
  */
export function fftForward(timeseries: Array<number>) {
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

export function calcDFT(waveform: Array<number>, npts: number): Array<number> {
  let log2N = 4;
  let N = 16;
  while(N < npts) { log2N += 1; N = 2 * N;}
  let dft = new OregonDSP.fft.RDFT(log2N);
  let inArray = new Float32Array(N);
  inArray.fill(0);
  for(let i=0; i<waveform.length; i++) {
    inArray[i] = waveform[i];
  }

  let out = new Array(N).fill(0);
  dft.evaluate(inArray, out);
  return out;
}

export function inverseDFT(packedFreq: Array<number>, npts: number): Array<number> {
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
  };
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

export class FFTResult {
  origLength: number;
  packedFreq: Array<number>;
  complex: Array<Complex>;
  amp: Array<number>;
  phase: Array<number>;
  npts: number;
  constructor(packedFreq: Array<number>, origLength: number) {
    this.packedFreq = packedFreq;
    this.origLength = origLength;
    this._calcAmpPhase();
  }
  _calcAmpPhase() {
    this.complex = [];
    this.amp = [];
    this.phase = [];
    this.npts = 0;

    let c = createComplex(this.packedFreq[0], 0);
    this.complex.push(c);
    this.amp.push(c.abs());
    this.phase.push(c.angle());
    this.npts++;
    const L = this.packedFreq.length;
    for(let i=1; i<this.packedFreq.length/2; i++) {
      c = createComplex(this.packedFreq[i], this.packedFreq[L-i]);
      this.complex.push(c);
      this.amp.push(c.abs());
      this.phase.push(c.angle());
      this.npts++;
    }
    c = createComplex(this.packedFreq[L/2], 0);
    this.complex.push(c);
    this.amp.push(c.abs());
    this.phase.push(c.angle());
    this.npts++;
    return this;
  }
  /** recalculate the packedFreq array after modifications
    * to the complex array. */
  recalcFromComplex() {
    const N = this.complex.length;
    let modFreq = new Array(N).fill(0);
    modFreq.push(this.complex[0].real);
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
