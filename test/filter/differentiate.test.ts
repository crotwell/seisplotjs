import '../jestRatioMatchers';

import * as filter from '../../src/filter';
import {isoToDateTime} from '../../src/util';
import {Seismogram } from '../../src/seismogram';
import {DateTime, Duration} from 'luxon';


test("constant", () => {
  let sampleRate = 20.0;
  let startTime = isoToDateTime("2013-02-08T09:30:26Z");
  let dataLen = 100;
  const dataVal = 100;
  let orig = Array(dataLen).fill(dataVal);
  const origseis = Seismogram.createFromContiguousData(orig, sampleRate, startTime);
  let diffseis = filter.differentiate(origseis);
  let expected = Array(dataLen-1).fill(0);
  // $FlowFixMe
  expect(diffseis.y).arrayToBeCloseToRatio(expected, 9);

  let secondStart = startTime.plus(Duration.fromMillis(1000*0.5/sampleRate));
  expect(diffseis.startTime.toISO()).toEqual(secondStart.toISO());
});


test("linear", () => {
  let sampleRate = 20.0;
  let startTime = isoToDateTime("2013-02-08T09:30:26");
  let dataLen = 100;
  const dataVal = 100;
  let orig = Array(dataLen).fill(dataVal);
  const slopePerSec = 5.5;
  orig = orig.map((d,i)=> d+i*slopePerSec/sampleRate);
  const origseis = Seismogram.createFromContiguousData(orig, sampleRate, startTime);
  let diffseis = filter.differentiate(origseis);
  expect(diffseis.y[0]).toEqual(slopePerSec);
  let expected = Array(dataLen-1).fill(slopePerSec);
  // $FlowFixMe
  expect(diffseis.y).arrayToBeCloseToRatio(expected, 9);

  let secondStart = startTime.plus(Duration.fromMillis(1000*0.5/sampleRate));
  expect(diffseis.startTime.toISO()).toEqual(secondStart.toISO());
});
