//@flow

/**
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */

import {SeismogramSegment, Seismogram } from './seismogram.js';

export const DtoR = Math.PI / 180;

export function rotate(seisA: Seismogram, azimuthA: number, seisB: Seismogram, azimuthB: number, azimuth: number) {
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
  let out = {
    "radial": new Seismogram(rotOutRad),
    "transverse": new Seismogram(rotOutTrans),
    "azimuthRadial": azimuth % 360,
    "azimuthTransverse": (azimuth + 90) % 360
  };
  return out;
}

export function rotateSeismogramSegment(seisA: SeismogramSegment, azimuthA: number, seisB: SeismogramSegment, azimuthB: number, azimuth: number) {
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

export function vectorMagnitudeSegment(seisA: SeismogramSegment, seisB: SeismogramSegment, seisC: SeismogramSegment) {
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
    y[i] = Math.sqrt(seisA.yAtIndex(i) * seisA.yAtIndex(i)
      + seisB.yAtIndex(i) * seisB.yAtIndex(i)
      + seisC.yAtIndex(i) * seisC.yAtIndex(i));
  }
  let outSeis = seisA.cloneWithNewData(y);
  outSeis.channelCode = seisA.chanCode.slice(0,2)+"M";
  return outSeis;
}
