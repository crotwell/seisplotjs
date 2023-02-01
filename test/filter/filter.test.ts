
import * as filter from '../../src/filter';
import {Seismogram} from '../../src/seismogram';
import {readSeismogram} from './sacfile';
import {checkStringOrDate} from "../../src/util";

test("init butterworth filter", () => {
  const n= 2;
  const type = filter.HIGH_PASS;
  const lowCut = 10;
  const highCut = 20;
  const delta = 1;
  const butterworth = filter.createButterworth(n, type, lowCut, highCut, delta);
  expect(butterworth).toBeTruthy();
});


test("simple butterworth", () => {
    return readSeismogram("./test/filter/data/IU.HRV.__.BHE.SAC")
      .then( origseis => {
        expect(origseis.y).toHaveLength(31450);

        const n= 2;
        const type = filter.BAND_PASS;
        const lowCut = 1;
        const highCut = 5;
        const butterworth = filter.createButterworth(n, type, lowCut, highCut, origseis.samplePeriod);
        expect(butterworth).toBeTruthy();
        const butterSeismogram = filter.applyFilter(butterworth, origseis);
        // check first for NaN before array length
        expect(butterSeismogram.y[0]).toBeFinite();
        expect(butterSeismogram.y).toHaveLength(origseis.y.length);
      });
});

test("bad delta butterworth", () => {
  const origseis = Seismogram.fromContiguousData(new Float32Array(10), 0.1, checkStringOrDate("now"));
  const n= 2;
  const type = filter.LOW_PASS;
  const lowCut = 1;
  const highCut = 5;
  const delta = 1;
  const butterworth = filter.createButterworth(n, type, lowCut, highCut, delta);
  expect(butterworth).toBeTruthy();
  expect(() => {filter.applyFilter(butterworth, origseis);}).toThrow();
});
