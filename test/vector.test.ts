import './jestRatioMatchers';

import * as vector from '../src/vector.js';
import {DateTime} from 'luxon';

import { Seismogram }  from "../src/seismogram";

const a = Float32Array.from([ 1, 1, 0]);
const b = Float32Array.from([ 2, 0, 2]);

test( "vector magnitude test", () => {
    let yValues = Float32Array.from([0, 1, 2]);
    let sampleRate = 20.0;
    let startTime = DateTime.utc();
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

let magFunc = function(a: number, b: number, c: number) {
  return Math.sqrt(a*a+b*b+c*c);
};


test("trace rotation", () => {
  let az = 0;
  let rotAzInc = 30;
  const rotRadian = rotAzInc*vector.DtoR;
  let now = DateTime.utc();
  let seisA = Seismogram.createFromContiguousData(a, 1.0, now);
  seisA.networkCode = "XX";
  seisA.stationCode = "AAA";
  seisA.locationCode = "00";
  seisA.channelCode = "BHE";
  let seisB = Seismogram.createFromContiguousData(b, 1.0, now);
  seisB.networkCode = "XX";
  seisB.stationCode = "AAA";
  seisB.locationCode = "00";
  seisB.channelCode = "BHN";
  let outSeismogram = vector.rotate(seisA, az, seisB, az+90, az+rotAzInc);
  expect(outSeismogram.radial.segments.length).toBe(1);
  expect(outSeismogram.transverse.segments.length).toBe(1);
  expect(outSeismogram.radial.segments[0].y[0]).toBeCloseTo(seisA.y[0]*Math.cos(rotRadian)+seisB.y[0]*Math.sin(rotRadian), 7);
  expect(outSeismogram.transverse.segments[0].y[0]).toBeCloseTo(-seisA.y[0]*Math.sin(rotRadian)+seisB.y[0]*Math.cos(rotRadian), 7);
});

test("simple rotation", () => {
  let az = 0;
  let rotToAz = 90;
  let now = DateTime.utc();
  let seisA = Seismogram.createFromContiguousData(a, 1.0, now);
  seisA.networkCode = "XX";
  seisA.stationCode = "AAA";
  seisA.locationCode = "00";
  seisA.channelCode = "BHE";
  let seisB = Seismogram.createFromContiguousData(b, 1.0, now);
  seisB.networkCode = "XX";
  seisB.stationCode = "AAA";
  seisB.locationCode = "00";
  seisB.channelCode = "BHN";

  let out = vector.rotate(seisA, az, seisB, az+90, rotToAz);
  expect(out.radial.y.length).toBe(3);
  expect(out.transverse.y.length).toBe(3);
  expect(out.azimuthRadial).toBe(rotToAz);
  expect(out.azimuthTransverse).toBe(rotToAz+90);
  expect(out.radial.y[0]).toBeCloseTo(2, 9);
  expect(out.radial.y[1]).toBeCloseTo(0, 9);
  expect(out.radial.y[2]).toBeCloseTo(2, 9);
  expect(out.transverse.y[0]).toBeCloseTo(-1, 9);
  expect(out.transverse.y[1]).toBeCloseTo(-1, 9);
  expect(out.transverse.y[2]).toBeCloseTo(0, 9);
  expect(out.radial.channelCode).toBe("BHR");
  expect(out.transverse.channelCode).toBe("BHT");

  // 0->360, nothing should change
  let out360 = vector.rotate(seisA, az, seisB, az+90, az+360);
  expect(out360.radial.y[0]).toBeCloseTo(seisA.y[0], 8);
  expect(out360.radial.y[1]).toBeCloseTo(seisA.y[1], 9);
  expect(out360.radial.y[2]).toBeCloseTo(seisA.y[2], 9);
  expect(out360.transverse.y[0]).toBeCloseTo(seisB.y[0], 9);
  expect(out360.transverse.y[1]).toBeCloseTo(seisB.y[1], 9);
  expect(out360.transverse.y[2]).toBeCloseTo(seisB.y[2], 9);


  // rotate to 30 az,
  let out30 = vector.rotate(seisA, az, seisB, az+90, az+30);
  let sqrt3_2 = Math.sqrt(3)/2;
  expect(out30.radial.y[0]).toBeCloseTo(sqrt3_2*seisA.y[0] + .5*seisB.y[0], 7);
  expect(out30.radial.y[1]).toBeCloseTo(sqrt3_2*seisA.y[1] + .5*seisB.y[1], 7);
  expect(out30.radial.y[2]).toBeCloseTo(sqrt3_2*seisA.y[2] + .5*seisB.y[2], 7);
  expect(out30.transverse.y[0]).toBeCloseTo(-0.5*seisA.y[0] + sqrt3_2*seisB.y[0], 7);
  expect(out30.transverse.y[1]).toBeCloseTo(-0.5*seisA.y[1] + sqrt3_2*seisB.y[1], 7);
  expect(out30.transverse.y[2]).toBeCloseTo(-0.5*seisA.y[2] + sqrt3_2*seisB.y[2], 7);
});
