

import * as miniseed from '../../src/miniseed';
import  {Duration} from 'luxon';


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
