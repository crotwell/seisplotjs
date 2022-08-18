
import * as filter from '../../src/filter';
import * as taper from '../../src/taper';
import {Seismogram, ensureIsSeismogram } from '../../src/seismogram';
import {readSac} from './sacfile';
import {DateTime} from 'luxon';

test("lineFit", () => {
  let dataLen = 10;
  const dataVal = 100;
  let orig = Array(dataLen).fill(dataVal);
  const origseis = Seismogram.createFromContiguousData(orig, 1, DateTime.utc());
  const lf = filter.lineFit(origseis);
  expect(lf.slope).toBeCloseTo(0);
  expect(lf.intercept).toBeCloseTo(dataVal);
});

test("constant", () => {
  let dataLen = 10;
  const dataVal = 100;
  let orig = Array(dataLen).fill(dataVal);
  const origseis = Seismogram.createFromContiguousData(orig, 1, DateTime.utc());
  let bagrtr = filter.removeTrend(origseis);
  for (let i=0; i<dataLen; i++) {
    expect(bagrtr.y[i], `index ${i}`).toBeCloseTo(0);
  }
});


test("linear", () => {
  let dataLen = 10;
  const dataVal = 100;
  const slope = 3;
  let orig = Array(dataLen).fill(dataVal).map((d,idx) => d+idx*slope);
  const origseis = Seismogram.createFromContiguousData(orig, 1, DateTime.utc());
  let bagrtr = filter.removeTrend(origseis);
  const lf = filter.lineFit(origseis);
  expect(lf.slope).toBeCloseTo(slope);
  expect(lf.intercept).toBeCloseTo(dataVal);
  for (let i=0; i<dataLen; i++) {
    expect(bagrtr.y[i], `index ${i}`).toBeCloseTo(0);
  }
});
