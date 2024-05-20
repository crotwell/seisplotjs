import '../jestRatioMatchers';

import * as filter from '../../src/filter';
import {isoToDateTime} from '../../src/util';
import {Seismogram } from '../../src/seismogram';



test("constant", () => {
  const sampleRate = 20.0;
  const startTime = isoToDateTime("2013-02-08T09:30:26Z");
  const dataLen = 100;
  const dataVal = 100;
  const orig = new Float32Array(dataLen).fill(dataVal);
  const origseis = Seismogram.fromContiguousData(orig, sampleRate, startTime);
  const diffseis = filter.differentiate(origseis);
  const intseis = filter.integrate(diffseis, origseis.y[0]);
  expect(intseis.y).arrayToBeCloseToRatio(origseis.y, 9);
  expect(intseis.sampleRate).toEqual(origseis.sampleRate);
  expect(intseis.startTime.toISO()).toEqual(origseis.startTime.toISO());
});

test("sine", () => {
  const sampleRate = 20.0;
  const startTime = isoToDateTime("2013-02-08T09:30:26Z");
  const dataLen = 100;
  const dataVal = 100;
  const orig = new Float32Array(dataLen).fill(dataVal);
  for (let i=0; i< orig.length; i++) {
    orig[i] += 10*Math.sin(2*Math.PI*i/sampleRate);
  }
  const origseis = Seismogram.fromContiguousData(orig, sampleRate, startTime);
  const diffseis = filter.differentiate(origseis);
  const intseis = filter.integrate(diffseis, origseis.y[0]);
  expect(intseis.y).arrayToBeCloseToRatio(origseis.y, 9);
  expect(intseis.sampleRate).toEqual(origseis.sampleRate);
  expect(intseis.startTime.toISO()).toEqual(origseis.startTime.toISO());
});
