
import * as filter from '../../src/filter';
import {Seismogram } from '../../src/seismogram';
import {DateTime} from 'luxon';

test("lineFit", () => {
  const dataLen = 10;
  const dataVal = 100;
  const orig = Array(dataLen).fill(dataVal);
  const origseis = Seismogram.fromContiguousData(orig, 1, DateTime.utc());
  const lf = filter.lineFit(origseis);
  expect(lf.slope).toBeCloseTo(0);
  expect(lf.intercept).toBeCloseTo(dataVal);
});

test("constant", () => {
  const dataLen = 10;
  const dataVal = 100;
  const orig = Array(dataLen).fill(dataVal);
  const origseis = Seismogram.fromContiguousData(orig, 1, DateTime.utc());
  const bagrtr = filter.removeTrend(origseis);
  for (let i=0; i<dataLen; i++) {
//    expect(bagrtr.y[i], `index ${i}`).toBeCloseTo(0);
    expect(bagrtr.y[i]).toBeCloseTo(0);
  }
});


test("linear", () => {
  const dataLen = 10;
  const dataVal = 100;
  const slope = 3;
  const orig = Array(dataLen).fill(dataVal).map((d,idx) => d+idx*slope);
  const origseis = Seismogram.fromContiguousData(orig, 1, DateTime.utc());
  const bagrtr = filter.removeTrend(origseis);
  const lf = filter.lineFit(origseis);
  expect(lf.slope).toBeCloseTo(slope);
  expect(lf.intercept).toBeCloseTo(dataVal);
  for (let i=0; i<dataLen; i++) {
//    expect(bagrtr.y[i], `index ${i}`).toBeCloseTo(0);
    expect(bagrtr.y[i]).toBeCloseTo(0);
  }
});
