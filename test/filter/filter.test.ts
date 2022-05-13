
import * as filter from '../../src/filter';
import {Seismogram} from '../../src/seismogram';
import {readSeismogram} from './sacfile';
import {checkStringOrDate} from "../../src/util"

test("init butterworth filter", () => {
  let n= 2;
  let type = filter.HIGH_PASS;
  let lowCut = 10;
  let highCut = 20;
  let delta = 1;
  let butterworth = filter.createButterworth(n, type, lowCut, highCut, delta);
  expect(butterworth).toBeTruthy();
});


test("simple butterworth", () => {
    return readSeismogram("./test/filter/data/IU.HRV.__.BHE.SAC")
      .then( origseis => {
        expect(origseis.y).toHaveLength(31450);

        let n= 2;
        let type = filter.BAND_PASS;
        let lowCut = 1;
        let highCut = 5;
        let butterworth = filter.createButterworth(n, type, lowCut, highCut, origseis.samplePeriod);
        expect(butterworth).toBeTruthy();
        let butterSeismogram = filter.applyFilter(butterworth, origseis);
        // check first for NaN before array length
        expect(butterSeismogram.y[0]).toBeFinite();
        expect(butterSeismogram.y).toHaveLength(origseis.y.length);
      });
});

test("bad delta butterworth", () => {
  const origseis = Seismogram.createFromContiguousData(new Float32Array(10), 0.1, checkStringOrDate("now"));
  let n= 2;
  let type = filter.LOW_PASS;
  let lowCut = 1;
  let highCut = 5;
  let delta = 1;
  let butterworth = filter.createButterworth(n, type, lowCut, highCut, delta);
  expect(butterworth).toBeTruthy();
  expect(() => {filter.applyFilter(butterworth, origseis)}).toThrow();
});
