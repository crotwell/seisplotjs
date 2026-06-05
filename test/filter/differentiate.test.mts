import '../jestRatioMatchers';

import * as filter from '../../src/filter';
import {isoToDateTime} from '../../src/util';
import {Seismogram } from '../../src/seismogram';
import { Duration} from 'luxon';


test("constant", () => {
  const sampleRate = 20.0;
  const startTime = isoToDateTime("2013-02-08T09:30:26Z");
  const dataLen = 100;
  const dataVal = 100;
  const orig = new Float32Array(dataLen).fill(dataVal);
  const origseis = Seismogram.fromContiguousData(orig, sampleRate, startTime);
  const diffseis = filter.differentiate(origseis);
  const expected = new Float32Array(dataLen-1).fill(0);
  expect(diffseis.y).arrayToBeCloseToRatio(expected, 9);

  const secondStart = startTime.plus(Duration.fromMillis(1000*0.5/sampleRate));
  expect(diffseis.startTime.toISO()).toEqual(secondStart.toISO());
});


test("linear", () => {
  const sampleRate = 20.0;
  const startTime = isoToDateTime("2013-02-08T09:30:26");
  const dataLen = 100;
  const dataVal = 100;
  let orig = new Float64Array(dataLen).fill(dataVal);
  const slopePerSec = 5.5;
  orig = orig.map((d,i): number => d+i*slopePerSec/sampleRate);
  expect(orig[1]).toEqual(100 + 0.275);
  const origseis = Seismogram.fromContiguousData(orig, sampleRate, startTime);
  const diffseis = filter.differentiate(origseis);
  expect(diffseis.y[0]).toEqual(slopePerSec);
  const expected = new Float64Array(dataLen-1).fill(slopePerSec);
  expect(diffseis.y).arrayToBeCloseToRatio(expected, 9);

  const secondStart = startTime.plus(Duration.fromMillis(1000*0.5/sampleRate));
  expect(diffseis.startTime.toISO()).toEqual(secondStart.toISO());
});
