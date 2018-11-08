//@flow

import {createComplex } from './transfer';

import * as OregonDSPTop from 'oregondsp';
const OregonDSP = OregonDSPTop.com.oregondsp.signalProcessing;

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
