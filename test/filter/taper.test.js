// @flow

import * as filter from '../../src/filter/index.js';
import {Seismogram, ensureIsSeismogram } from '../../src/seismogram';
import {readSac} from './sacfile';
import  {moment} from '../../src/util';

test("simple value taper", () => {
  let taperLen = 10;
  let coeff = filter.taper.getCoefficients(filter.taper.HANNING, taperLen);
  expect(coeff[0]).toBeCloseTo(Math.PI / taperLen, 9);
  expect(coeff[1]).toBeCloseTo(.5, 9);
  expect(coeff[2]).toBeCloseTo(.5, 9);
});

test("constant", () => {
  let dataLen = 100;
  let taperWidth = 0.05;
  const dataVal = 100;
  let orig = Array(dataLen).fill(dataVal);
  const origseis = Seismogram.createFromContiguousData(orig, 1, moment.utc());
  let bagtaper = filter.taper.taper(origseis, taperWidth);
  const omega = Math.PI / (dataLen * taperWidth);
  const f0 = .5;
  const f1 = .5;
  let expected = Array(dataLen).fill(dataVal);
  for (let i=0; i<dataLen*taperWidth; i++) {
    expected[i] = orig[i] * (f0 - f1 * Math.cos(omega * i));
    expected[dataLen-i-1] = orig[i] * (f0 - f1 * Math.cos(omega * i));
    if (i < 10) {
      console.log(`expect: ${expected[i]}  === ${bagtaper.y[i]}`);
    }
  }
  // $FlowFixMe
  expect(bagtaper.y).arrayToBeCloseToRatio(expected, 5);
});


test("const100 taper", () => {
 return Promise.all([readSac("./test/filter/data/const100.sac"),
                     readSac("./test/filter/data/taper100.sac")])
 .then ( result => {
     let orig = result[0];
     let sactaper = result[1];
     const origseis = Seismogram.createFromContiguousData(orig.y, 1/orig.delta, moment.utc());
     let bagtaper = filter.taper.taper(origseis);
     const sacdata = sactaper.y;
     const bagdata = bagtaper.y;
     // index 5 not effected by taper
     expect(sacdata[5]).toBeCloseTo(100, 5);
     expect(bagdata[5]).toBeCloseTo(100, 5);
     // taper effects index 0-4
     expect(sacdata[0]).toBeCloseTo(0, 5);
     expect(bagdata[0]).toBeCloseTo(0, 5);
     expect(sacdata[1]).toBeCloseTo(9.549150, 5);
     expect(bagdata[1]).toBeCloseTo(9.549150, 5);
     expect(sacdata[2]).toBeCloseTo(34.54915, 5);
     expect(bagdata[2]).toBeCloseTo(34.54915, 5);
     expect(sacdata[3]).toBeCloseTo(65.45085, 5);
     expect(bagdata[3]).toBeCloseTo(65.45085, 5);
     expect(sacdata[4]).toBeCloseTo(90.45085, 5);
     expect(bagdata[4]).toBeCloseTo(90.45085, 5);
     // $FlowFixMe
     expect(bagdata).arrayToBeCloseToRatio(sacdata, 5);

     for(let i = 0; i < bagdata.length; i++) {
       // $FlowFixMe
         expect(bagdata[i]).toBeCloseToRatio(sacdata[i], 5);
     }
   });
 });

/*
 r IU.HRV.__.BHE.SAC.0
 rmean
 w 1_rmean.sac
 taper type hanning width 0.05
 w 2_taper.sac
 transfer from polezero subtype hrv.bhe.sacpz to none freqlimits 0.005 0.01 1e5 1e6
 w 3_transfer.sac
 */
test("HRV taper", () => {
  return Promise.all([readSac("./test/filter/data/2_taper.sac"),
                      readSac("./test/filter/data/IU.HRV.__.BHE.SAC")])
  .then ( result => {
      let sactaper = result[0];
      let orig = result[1];
      const origseis = Seismogram.createFromContiguousData(orig.y, 1/orig.delta, moment.utc());
      let bagtaper = filter.taper.taper(filter.rMean(ensureIsSeismogram(origseis)));
      const sacdata = sactaper.y;
      const bagdata = bagtaper.y;
      // $FlowFixMe
      expect(bagdata).arrayToBeCloseToRatio(sacdata, 5);

      for(let i = 0; i < bagdata.length; i++) {
        // $FlowFixMe
          expect(bagdata[i]).toBeCloseToRatio(sacdata[i], 5);
            //  assertEquals("data", 1, sacdata[i] / bagdata[i], 0.0001);

      }
  });

});
