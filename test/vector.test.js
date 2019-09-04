// @flow

import * as vector from '../src/vector.js';
import * as util from '../src/util.js';
let moment = util.moment;

import { SeismogramSegment, Seismogram }  from "../src/seismogram";

const a = Float32Array.from([ 1, 1, 0]);
const b = Float32Array.from([ 2, 0, 2]);

test( "vector magnitude test", () => {
    let yValues = Float32Array.from([0, 1, 2]);
    let sampleRate = 20.0;
    let startTime = moment.utc();
    let netCode = "XX";
    let staCode = "ABCD";
    let locCode = "00";
    let chanCode = "BHZ";
    let seisA = Seismogram.createFromContiguousData(yValues, sampleRate, startTime);
    seisA.networkCode = netCode;
    seisA.stationCode = staCode;
    seisA.locationCode = locCode;
    seisA.channelCode = chanCode;
    let seisB = seisA.clone();
    seisB.channelCode = "BHN";
    let seisC = seisA.clone();
    seisC.channelCode = "BHE";
    let ans = yValues.map(d => magFunc(d,d,d));
    let vecMag = vector.vectorMagnitude(seisA, seisB, seisC);
    expect(vecMag.y[0]).toEqual(ans[0]);
    expect(vecMag.y[1]).toEqual(ans[1]);
    expect(vecMag.y[2]).toEqual(ans[2]);
});

let magFunc = function(a, b, c) {
  return Math.sqrt(a*a+b*b+c*c);
}


test("trace rotation", () => {
  let az = 0;
  let rotAzInc = 30;
  let now = moment.utc();
  let seisA = new SeismogramSegment(a, 1.0, now);
  seisA.networkCode = "XX";
  seisA.stationCode = "AAA";
  seisA.locationCode = "00";
  seisA.channelCode = "BHE";
  let seisB = new SeismogramSegment(b, 1.0, now);
  seisB.networkCode = "XX";
  seisB.stationCode = "AAA";
  seisB.locationCode = "00";
  seisB.channelCode = "BHN";
  let traceA = new Seismogram(seisA);
  let traceB = new Seismogram(seisB);
  let outSeismogram = vector.rotate(traceA, az, traceB, az+90, az+rotAzInc);
  let outSeis = vector.rotateSeismogramSegment(seisA, az, seisB, az+90, az+rotAzInc);
  expect(outSeismogram.radial.segments.length).toBe(1);
  expect(outSeismogram.transverse.segments.length).toBe(1);
  expect(outSeismogram.radial.segments[0].y[0]).toEqual(outSeis.radial.y[0]);
  expect(outSeismogram.transverse.segments[0].y[0]).toEqual(outSeis.transverse.y[0]);
});

test("simple rotation", () => {
  let az = 0;
  let rotToAz = 90;
  let now = moment.utc();
  let seisA = new SeismogramSegment(a, 1.0, now);
  seisA.networkCode = "XX";
  seisA.stationCode = "AAA";
  seisA.locationCode = "00";
  seisA.channelCode = "BHE";
  let seisB = new SeismogramSegment(b, 1.0, now);
  seisB.networkCode = "XX";
  seisB.stationCode = "AAA";
  seisB.locationCode = "00";
  seisB.channelCode = "BHN";

  let out = vector.rotateSeismogramSegment(seisA, az, seisB, az+90, rotToAz);
  expect(out.radial.y.length).toBe(3);
  expect(out.transverse.y.length).toBe(3);
  expect(out.azimuthRadial).toBe(rotToAz);
  expect(out.azimuthTransverse).toBe(rotToAz+90);
  expect(out.radial.yAtIndex(0)).toBeCloseTo(2, 9);
  expect(out.radial.yAtIndex(1)).toBeCloseTo(0, 9);
  expect(out.radial.yAtIndex(2)).toBeCloseTo(2, 9);
  expect(out.transverse.yAtIndex(0)).toBeCloseTo(-1, 9);
  expect(out.transverse.yAtIndex(1)).toBeCloseTo(-1, 9);
  expect(out.transverse.yAtIndex(2)).toBeCloseTo(0, 9);
  expect(out.radial.chanCode).toBe("BHR");
  expect(out.transverse.chanCode).toBe("BHT");

  // 0->360, nothing should change
  let out360 = vector.rotateSeismogramSegment(seisA, az, seisB, az+90, az+360);
  expect(out360.radial.yAtIndex(0)).toBeCloseTo(seisA.yAtIndex(0), 8);
  expect(out360.radial.yAtIndex(1)).toBeCloseTo(seisA.yAtIndex(1), 9);
  expect(out360.radial.yAtIndex(2)).toBeCloseTo(seisA.yAtIndex(2), 9);
  expect(out360.transverse.yAtIndex(0)).toBeCloseTo(seisB.yAtIndex(0), 9);
  expect(out360.transverse.yAtIndex(1)).toBeCloseTo(seisB.yAtIndex(1), 9);
  expect(out360.transverse.yAtIndex(2)).toBeCloseTo(seisB.yAtIndex(2), 9);


  // rotate to 30 az,
  let out30 = vector.rotateSeismogramSegment(seisA, az, seisB, az+90, az+30);
  let sqrt3_2 = Math.sqrt(3)/2;
  expect(out30.radial.yAtIndex(0)).toBeCloseTo(sqrt3_2*seisA.yAtIndex(0) + .5*seisB.yAtIndex(0), 7);
  expect(out30.radial.yAtIndex(1)).toBeCloseTo(sqrt3_2*seisA.yAtIndex(1) + .5*seisB.yAtIndex(1), 7);
  expect(out30.radial.yAtIndex(2)).toBeCloseTo(sqrt3_2*seisA.yAtIndex(2) + .5*seisB.yAtIndex(2), 7);
  expect(out30.transverse.yAtIndex(0)).toBeCloseTo(-0.5*seisA.yAtIndex(0) + sqrt3_2*seisB.yAtIndex(0), 7);
  expect(out30.transverse.yAtIndex(1)).toBeCloseTo(-0.5*seisA.yAtIndex(1) + sqrt3_2*seisB.yAtIndex(1), 7);
  expect(out30.transverse.yAtIndex(2)).toBeCloseTo(-0.5*seisA.yAtIndex(2) + sqrt3_2*seisB.yAtIndex(2), 7);
});
