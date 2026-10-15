import {describe, expect, test} from 'vitest';


import * as miniseed from "../../src/miniseed.mjs";
import  {Duration} from "luxon";


test("time of sample", () => {
  const dh = new miniseed.DataHeader();
  dh.sampleRate = 1;
  dh.numSamples = 100;
  expect(dh.timeOfSample(1)).toEqual(dh.startTime.plus(Duration.fromMillis(1000)));
});

test("contig", () => {
  const dhFirst = new miniseed.DataHeader();
  dhFirst.sampleRate = 1;
  dhFirst.numSamples = 100;
  dhFirst.endTime = dhFirst.timeOfSample(dhFirst.numSamples-1);
  const fakeData = new DataView(new ArrayBuffer(4*dhFirst.numSamples));
  const drFirst = new miniseed.DataRecord(dhFirst, fakeData);
  const dhSecond = new miniseed.DataHeader();
  dhSecond.sampleRate = 1;
  dhSecond.numSamples = 100;
  dhSecond.startTime = dhFirst.startTime.plus(Duration.fromMillis(1000*dhFirst.numSamples));//seconds
  dhSecond.endTime = dhSecond.timeOfSample(dhSecond.numSamples-1);
  const drSecond = new miniseed.DataRecord(dhSecond, fakeData);
  expect(dhFirst.timeOfSample(dhFirst.numSamples)).toEqual(dhSecond.startTime);
  expect(miniseed.areContiguous(drFirst, drSecond)).toBe(true);
});

test("tenth millis 9999", () => {
  const btime = new miniseed.BTime(1999, 365, 23, 59, 59, 9999);
  const dt = btime.toDateTime();
  expect(dt.year).toEqual(2000);
  expect(dt.month).toEqual(1);
  expect(dt.day).toEqual(1);
  expect(dt.hour).toEqual(0);
  expect(dt.minute).toEqual(0);
  expect(dt.second).toEqual(0);
  expect(dt.millisecond).toEqual(0);

});

test("timecorr", () => {
  const btime = new miniseed.BTime(1999, 365, 23, 59, 59, 9999);
  btime.microsecond = 49;
  const dhFirst = new miniseed.DataHeader();
  dhFirst.startBTime = btime;
  dhFirst.sampleRate = 1;
  dhFirst.numSamples = 100;
  dhFirst.endTime = dhFirst.timeOfSample(dhFirst.numSamples-1);
  dhFirst.activityFlags = 2;
  dhFirst.timeCorrection = 10*1000; // one sec, tenth milli
  const dt = btime.toDateTime();

  expect(dt.year).toEqual(2000);
  expect(dt.month).toEqual(1);
  expect(dt.day).toEqual(1);
  expect(dt.hour).toEqual(0);
  expect(dt.minute).toEqual(0);
  expect(dt.second).toEqual(0);
  expect(dt.millisecond).toEqual(0);
  const corrBTime = dhFirst.startBTime.applyTimeCorrection(dhFirst.timeCorrection);
  expect(corrBTime.microsecond).toEqual(btime.microsecond);
  expect(corrBTime.tenthMilli).toEqual(btime.tenthMilli);
  const ht = corrBTime.toDateTime();

  expect(ht.year).toEqual(2000);
  expect(ht.month).toEqual(1);
  expect(ht.day).toEqual(1);
  expect(ht.hour).toEqual(0);
  expect(ht.minute).toEqual(0);
  expect(ht.second).toEqual(1);
  expect(ht.millisecond).toEqual(0);
});


test("timecorrBTime", () => {
  const btime = new miniseed.BTime(1999, 365, 23, 59, 59, 9999);
  btime.microsecond = 49;
  const corrBtime = btime.applyTimeCorrection(12345);

  expect(corrBtime.year).toEqual(2000);
  expect(corrBtime.jday).toEqual(1);
  expect(corrBtime.hour).toEqual(0);
  expect(corrBtime.min).toEqual(0);
  expect(corrBtime.sec).toEqual(1);
  expect(corrBtime.tenthMilli).toEqual(2344);
  expect(corrBtime.microsecond).toEqual(btime.microsecond);
});

test("timecorrBTimeMicro", () => {
  const btime = new miniseed.BTime(2020, 100, 0, 0, 0, 0);
  btime.microsecond = -1;
  const corrBtime = btime.applyTimeCorrection(0);

  expect(corrBtime.year).toEqual(2020);
  expect(corrBtime.jday).toEqual(100);
  expect(corrBtime.hour).toEqual(0);
  expect(corrBtime.min).toEqual(0);
  expect(corrBtime.sec).toEqual(0);
  expect(corrBtime.tenthMilli).toEqual(0);
  expect(corrBtime.microsecond).toEqual(btime.microsecond);
  const dt = btime.toDateTime();
  expect(dt.toISO()).toEqual("2020-04-09T00:00:00.000Z");
});
