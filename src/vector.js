//@flow

/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */

import {SeismogramSegment, Seismogram } from './seismogram.js';

/**
 * const for degrees to radians, pi/180
 */
export const DtoR = Math.PI / 180;

/**
 * Result of rotation for 2 seismograms.
 */
export class RotatedSeismograms {
  radial: Seismogram;
  transverse: Seismogram;
  azimuthRadial: number;
  azimuthTransverse: number;
  rotation: number;
  constructor(radial: Seismogram,
              azimuthRadial: number,
              transverse: Seismogram,
              azimuthTransverse: number,
              rotation: number) {
    this.radial = radial;
    this.azimuthRadial = azimuthRadial;
    this.transverse = transverse;
    this.azimuthTransverse = azimuthTransverse;
    this.rotation = rotation;
  }
}

/**
 * Rotates the given seismograms from their given azimuths so the output radial
 * is along the new azimuth and the output transverse is perpendicular to it.
 *
 * @param   seisA    first seismogram
 * @param   azimuthA azimuth of first seismogram
 * @param   seisB    second seismogram
 * @param   azimuthB azimuth of second seismogram
 * @param   azimuth  output radial azimuth to rotate to
 * @returns radial and transverse seismograms
 */
export function rotate(seisA: Seismogram, azimuthA: number, seisB: Seismogram, azimuthB: number, azimuth: number): RotatedSeismograms {
  if (seisA.segments.length !== seisB.segments.length) {
    throw new Error("Seismograms do not have same number of segments: "+seisA.segments.length+" !== "+seisB.segments.length);
  }
  let rotOutRad = [];
  let rotOutTrans = [];
  for( let i=0; i< seisA.segments.length; i++) {
    let result = rotateSeismogramSegment(seisA.segments[i], azimuthA,
                                         seisB.segments[i], azimuthB, azimuth);
    rotOutRad.push(result.radial);
    rotOutTrans.push(result.transverse);
  }
  let out = new RotatedSeismograms(new Seismogram(rotOutRad),
                                   azimuth % 360,
                                   new Seismogram(rotOutTrans),
                                   (azimuth + 90) % 360,
                                   azimuth - azimuthA);
  return out;
}

/**
 * Rotates two seismogram segments, checking for same length and time alignment.
 *
 * @param   seisA    first seismogram
 * @param   azimuthA azimuth of first
 * @param   seisB    second seismogram
 * @param   azimuthB azimuth of second
 * @param   azimuth  azimuth to rotate to as radial, transverse will be +90 deg
 * @returns           rotated seismogram segments along with their aziumths
 */
function rotateSeismogramSegment(seisA: SeismogramSegment, azimuthA: number, seisB: SeismogramSegment, azimuthB: number, azimuth: number) {
  if (seisA.y.length !== seisB.y.length) {
    throw new Error("seisA and seisB should be of same lenght but was "
    +seisA.y.length+" "+seisB.y.length);
  }
  if ( ! seisA.startTime.isSame(seisB.startTime)) {
    throw new Error("Expect startTime to be same, but was "+seisA.startTime.toISOString()+" "+seisB.startTime.toISOString());
  }
  if (seisA.sampleRate !== seisB.sampleRate) {
    throw new Error("Expect sampleRate to be same, but was "+seisA.sampleRate+" "+seisB.sampleRate);
  }
  if ((azimuthA + 90) % 360 !== azimuthB % 360) {
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
  let x = new Float32Array(seisA.y.length);
  let y = new Float32Array(seisA.y.length);
  for (let i = 0; i < seisA.y.length; i++) {
    x[i] = cosTheta * seisB.yAtIndex(i) - sinTheta * seisA.yAtIndex(i);
    y[i] = sinTheta * seisB.yAtIndex(i) + cosTheta * seisA.yAtIndex(i);
  }
  let outSeisRad = seisA.cloneWithNewData(y);
  outSeisRad.channelCode = seisA.chanCode.slice(0,2)+"R";
  let outSeisTan = seisA.cloneWithNewData(x);
  outSeisTan.channelCode = seisA.chanCode.slice(0,2)+"T";
  let out = {
    "radial": outSeisRad,
    "transverse": outSeisTan,
    "azimuthRadial": azimuth % 360,
    "azimuthTransverse": (azimuth + 90) % 360
  };
  return out;
}

/**
 * creates a new Seismogram where the value at each sample is the
 * vector magnitude of the 3 corresponding data points from each seismogram.
 * Each of the 3 seismograms are assumed to be mutually perpendicular so
 * that each set of samples gives a vector in 3-dimensional space. In particular
 * all three seismograms must have the same number of samples and sample rate.
 * It is assumed, but not checked, that they will be the three components of
 * motion at a station (ie matching network, station and location codes)
 * and have the same start time.
 *
 * @param   seisA first seismogram
 * @param   seisB second seismogram
 * @param   seisC third seismogram
 * @returns Seismogram of vector magnitudes
 */
export function vectorMagnitude(seisA: Seismogram, seisB: Seismogram, seisC: Seismogram) {
  if (seisA.segments.length !== seisB.segments.length) {
    throw new Error("Seismograms do not have same number of segments: "+seisA.segments.length+" !== "+seisB.segments.length+" !== "+seisC.segments.length);
  }
  if (seisA.segments.length !== seisC.segments.length) {
    throw new Error("Seismograms do not have same number of segments: "+seisA.segments.length+" !== "+seisB.segments.length+" !== "+seisC.segments.length);
  }
  let outSeis = [];
  for( let i=0; i< seisA.segments.length; i++) {
    let result = vectorMagnitudeSegment(seisA.segments[i],
                                        seisB.segments[i],
                                        seisC.segments[i]);
    outSeis.push(result);
  }
  return new Seismogram(outSeis);
}

/**
 * Calculates the vector magnitude of three components of motion. Each of the three
 * should be mutually perpendicular.
 *
 * @param   seisA first seismogram
 * @param   seisB second perpendicular seismogram
 * @param   seisC thrid perpendicular seismogram
 * @returns         seismogram representing the vector magnitude, sqrt(x*x+y*y+z*z)
 */
function vectorMagnitudeSegment(seisA: SeismogramSegment, seisB: SeismogramSegment, seisC: SeismogramSegment) {
  if (seisA.y.length !== seisB.y.length) {
    throw new Error("seisA and seisB should be of same lenght but was "
    +seisA.y.length+" "+seisB.y.length);
  }
  if (seisA.sampleRate !== seisB.sampleRate) {
    throw new Error("Expect sampleRate to be same, but was "+seisA.sampleRate+" "+seisB.sampleRate);
  }
  if (seisA.y.length !== seisC.y.length) {
    throw new Error("seisA and seisC should be of same lenght but was "
    +seisA.y.length+" "+seisC.y.length);
  }
  if (seisA.sampleRate !== seisC.sampleRate) {
    throw new Error("Expect sampleRate to be same, but was "+seisA.sampleRate+" "+seisC.sampleRate);
  }
  let y;
  if (seisA.y instanceof Float64Array) {
    y = new Float64Array(seisA.y.length);
  } else {
    y = new Float32Array(seisA.y.length);
  }
  for (let i = 0; i < seisA.y.length; i++) {
    y[i] = Math.sqrt(seisA.y[i] * seisA.y[i]
      + seisB.y[i] * seisB.y[i]
      + seisC.y[i] * seisC.y[i]);
  }
  let outSeis = seisA.cloneWithNewData(y);
  outSeis.channelCode = seisA.chanCode.slice(0,2)+"M";
  return outSeis;
}
