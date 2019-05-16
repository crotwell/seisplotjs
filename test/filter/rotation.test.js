import {rotate, rotateSeismograms } from '../../src/filter/vector.js';
import { Seismogram, Trace }  from "../../src/seismogram";

test("trace rotation", () => {
  let a = [ 1, 1, 0];
  let b = [ 2, 0, 2];
  let az = 0;
  let rotToAz = 90;
  let now = new Date();
  let seisA = new Seismogram(a, 1.0, now);
  seisA.networkCode = "XX";
  seisA.stationCode = "AAA";
  seisA.locationCode = "00";
  seisA.channelCode = "BHE";
  let seisB = new Seismogram(b, 1.0, now);
  seisB.networkCode = "XX";
  seisB.stationCode = "AAA";
  seisB.locationCode = "00";
  seisB.channelCode = "BHN";
  let traceA = new Trace(seisA);
  let traceB = new Trace(seisB);
  let outTrace = rotate(traceA, az, traceB, az+90, az+30);
  let outSeis = rotateSeismograms(seisA, az, seisB, az+90, az+30);
  expect(outTrace.radial.segments.length).toBe(1);
  expect(outTrace.transverse.segments.length).toBe(1);
});

test("simple rotation", () => {
  let a = [ 1, 1, 0];
  let b = [ 2, 0, 2];
  let az = 0;
  let rotToAz = 90;
  let now = new Date();
  let seisA = new Seismogram(a, 1.0, now);
  seisA.networkCode = "XX";
  seisA.stationCode = "AAA";
  seisA.locationCode = "00";
  seisA.channelCode = "BHE";
  let seisB = new Seismogram(b, 1.0, now);
  seisB.networkCode = "XX";
  seisB.stationCode = "AAA";
  seisB.locationCode = "00";
  seisB.channelCode = "BHN";

  let out = rotateSeismograms(seisA, az, seisB, az+90, 90);
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
  let out360 = rotateSeismograms(seisA, az, seisB, az+90, az+360);
  expect(out360.radial.yAtIndex(0)).toBeCloseTo(seisA.yAtIndex(0), 9);
  expect(out360.radial.yAtIndex(1)).toBeCloseTo(seisA.yAtIndex(1), 9);
  expect(out360.radial.yAtIndex(2)).toBeCloseTo(seisA.yAtIndex(2), 9);
  expect(out360.transverse.yAtIndex(0)).toBeCloseTo(seisB.yAtIndex(0), 9);
  expect(out360.transverse.yAtIndex(1)).toBeCloseTo(seisB.yAtIndex(1), 9);
  expect(out360.transverse.yAtIndex(2)).toBeCloseTo(seisB.yAtIndex(2), 9);


  // rotate to 30 az,
  let out30 = rotateSeismograms(seisA, az, seisB, az+90, az+30);
  let sqrt3_2 = Math.sqrt(3)/2;
  expect(out30.radial.yAtIndex(0)).toBeCloseTo(sqrt3_2*seisA.yAtIndex(0) + .5*seisB.yAtIndex(0), 9);
  expect(out30.radial.yAtIndex(1)).toBeCloseTo(sqrt3_2*seisA.yAtIndex(1) + .5*seisB.yAtIndex(1), 9);
  expect(out30.radial.yAtIndex(2)).toBeCloseTo(sqrt3_2*seisA.yAtIndex(2) + .5*seisB.yAtIndex(2), 9);
  expect(out30.transverse.yAtIndex(0)).toBeCloseTo(-0.5*seisA.yAtIndex(0) + sqrt3_2*seisB.yAtIndex(0), 9);
  expect(out30.transverse.yAtIndex(1)).toBeCloseTo(-0.5*seisA.yAtIndex(1) + sqrt3_2*seisB.yAtIndex(1), 9);
  expect(out30.transverse.yAtIndex(2)).toBeCloseTo(-0.5*seisA.yAtIndex(2) + sqrt3_2*seisB.yAtIndex(2), 9);
});
