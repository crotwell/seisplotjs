// @flow

import * as filter from '../../src/filter/index.js';
import {SeismogramSegment} from '../../src/seismogram';
import {SacPoleZero} from '../../src/sacPoleZero';
import {readSac, parseSac, readSacPoleZero, readDataView, writeSac, replaceYData} from './sacfile';
import  {moment} from '../../src/util';

const ONE_COMPLEX = filter.createComplex(1, 0);
/**
 * @author crotwell Created on Jul 27, 2005
 */

const WRITE_TEST_DATA = false;

test("test freq Taper", () => {
    expect(filter.transfer.freqTaper(0, 1, 2, 10, 20)).toBeCloseTo(0, 5);
    expect(filter.transfer.freqTaper(.9, 1, 2, 10, 20)).toBeCloseTo(0, 5);
    expect(filter.transfer.freqTaper(1, 1, 2, 10, 20)).toBeCloseTo(0, 5);
    expect(filter.transfer.freqTaper(2, 1, 2, 10, 20)).toBeCloseTo(1, 5);
    expect(filter.transfer.freqTaper(1.01, 1, 2, 10, 20)).toBeCloseTo(0, 3);
    expect(filter.transfer.freqTaper(1.5, 1, 2, 10, 20)).toBeCloseTo(.5, 5);
    expect(filter.transfer.freqTaper(1.99, 1, 2, 10, 20)).toBeCloseTo(1, 3);
    expect(filter.transfer.freqTaper(5, 1, 2, 10, 20)).toBeCloseTo(1, 5);
    expect(filter.transfer.freqTaper(10, 1, 2, 10, 20)).toBeCloseTo(1, 5);
    expect(filter.transfer.freqTaper(20, 1, 2, 10, 20)).toBeCloseTo(0, 5);
});

test("TaperVsSac", () => {
    let sacout = [ [ 0, 0.000610352, 0 ],
                          [ 0.000610352, 0.000610352, 0 ],
                          [ 0.0012207, 0.000610352, 0 ],
                          [ 0.00183105, 0.000610352, 0 ],
                          [ 0.00244141, 0.000610352, 0 ],
                          [ 0.00305176, 0.000610352, 0 ],
                          [ 0.00366211, 0.000610352, 0 ],
                          [ 0.00427246, 0.000610352, 0 ],
                          [ 0.00488281, 0.000610352, 0 ],
                          [ 0.00549316, 0.000610352, 1.4534e-05 ],
                          [ 0.00610352, 0.000610352, 7.04641e-05 ],
                          [ 0.00671387, 0.000610352, 0.000160492 ],
                          [ 0.00732422, 0.000610352, 0.000271539 ],
                          [ 0.00793457, 0.000610352, 0.000387472 ],
                          [ 0.00854492, 0.000610352, 0.00049145 ],
                          [ 0.00915527, 0.000610352, 0.000568367 ],
                          [ 0.00976562, 0.000610352, 0.000607048 ],
                          [ 0.010376, 0.000610352, 0.000610352 ],
                          [ 0.0109863, 0.000610352, 0.000610352 ],
                          [ 0.0115967, 0.000610352, 0.000610352 ] ];
    for(let row of sacout) {
        expect(row[1]*filter.transfer.freqTaper(row[0], .005, .01, 1e5, 1e6)).toBeCloseTo(row[2], 5);

    }
});

test("testEvalPoleZero", () => {
    // array is freq, real, imag from sac genran.c
    const sacout =  [ [0, 0, 0],
                      [0.000610352, -63356.3, -165446],
                      [0.0012207, -897853, -986468],
                      [0.00183105, -3.56033e+06, -1.78889e+06],
                      [0.00244141, -7.78585e+06, -1.05324e+06],
                      [0.00305176, -1.21507e+07, 1.70486e+06],
                      [0.00366211, -1.56945e+07, 5.80921e+06],
                      [0.00427246, -1.82753e+07, 1.04878e+07],
                      [0.00488281, -2.00925e+07, 1.52973e+07],
                      [0.00549316, -2.13745e+07, 2.00495e+07],
                      [0.00610352, -2.22939e+07, 2.46831e+07],
                      [0.00671387, -2.29672e+07, 2.91893e+07],
                      [0.00732422, -2.34707e+07, 3.35782e+07],
                      [0.00793457, -2.38545e+07, 3.78652e+07],
                      [0.00854492, -2.4152e+07, 4.20655e+07],
                      [0.00915527, -2.43859e+07, 4.61927e+07],
                      [5.04028, 1.48193e+10, 1.47267e+10],
                      [5.04089, 1.48211e+10, 1.47267e+10],
                      [5.0415, 1.48229e+10, 1.47267e+10],
                      [5.04211, 1.48246e+10, 1.47267e+10],
                      [5.04272, 1.48264e+10, 1.47267e+10],
                      [5.04333, 1.48282e+10, 1.47266e+10],
                      [5.04395, 1.483e+10, 1.47266e+10],
                      [5.04456, 1.48318e+10, 1.47266e+10],
                      [5.04517, 1.48336e+10, 1.47266e+10],
                      [5.04578, 1.48353e+10, 1.47266e+10],
                      [5.04639, 1.48371e+10, 1.47266e+10],
                      [5.047, 1.48389e+10, 1.47266e+10],
                      [5.04761, 1.48407e+10, 1.47265e+10],
                      [5.04822, 1.48425e+10, 1.47265e+10],
                      [5.04883, 1.48442e+10, 1.47265e+10],
                      [5.04944, 1.4846e+10, 1.47265e+10],
                      [5.05005, 1.48478e+10, 1.47265e+10],
                      [9.99084, 2.35288e+10, 1.17883e+10],
                      [9.99145, 2.35294e+10, 1.17878e+10],
                      [9.99207, 2.353e+10, 1.17874e+10],
                      [9.99268, 2.35306e+10, 1.1787e+10],
                      [9.99329, 2.35311e+10, 1.17865e+10],
                      [9.9939, 2.35317e+10, 1.17861e+10],
                      [9.99451, 2.35323e+10, 1.17857e+10],
                      [9.99512, 2.35329e+10, 1.17852e+10],
                      [9.99573, 2.35334e+10, 1.17848e+10],
                      [9.99634, 2.3534e+10, 1.17844e+10],
                      [9.99695, 2.35346e+10, 1.17839e+10],
                      [9.99756, 2.35352e+10, 1.17835e+10],
                      [9.99817, 2.35357e+10, 1.17831e+10],
                      [9.99878, 2.35363e+10, 1.17826e+10],
                      [9.99939, 2.35369e+10, 1.17822e+10],
                      [10, 2.35375e+10, 1.17818e+10]];
    // IU.HRV.BHE response
    const zeros =  [filter.createComplex(0, 0),
                    filter.createComplex(0, 0),
                    filter.createComplex(0, 0) ];
    const poles =  [filter.createComplex(-0.0139, 0.0100),
                    filter.createComplex(-0.0139, -0.0100),
                    filter.createComplex(-31.4160, 0.0000) ];
    let sacPoleZero = new SacPoleZero(poles, zeros, 2.94283674E10);

    // separate test for zero freq due to polezero gives 0 here
    let dhi = filter.transfer.evalPoleZeroInverse(sacPoleZero, sacout[0][0]);
    expect(dhi.real()).toBeCloseTo(sacout[0][1], 4);
    expect(dhi.imag()).toBeCloseTo(sacout[0][2], 4);
    for(let i = 1; i < sacout.length; i++) {
        let dhi = filter.transfer.evalPoleZeroInverse(sacPoleZero, sacout[i][0]);
        dhi = ONE_COMPLEX.overComplex(dhi);
        // $FlowFixMe
        expect(dhi.real).toBeCloseToRatio(sacout[i][1], 5);
        // $FlowFixMe
        expect(dhi.imag).toBeCloseToRatio(sacout[i][2], 5);
        // if (sacout[i][1] === 0) {
        //   expect(sacout[i][1] / dhi.real()).toBeCloseTo(1.0, 6);
        // } else {
        //   expect((sacout[i][1] - dhi.real())/sacout[i][1]).toBeCloseTo(0.0, 6);
        // }
        // if (sacout[i][2] === 0) {
        //   expect(sacout[i][2] / dhi.imag()).toBeCloseTo(1.0, 4);
        // } else {
        //   expect((sacout[i][2] - dhi.imag())/sacout[i][2]).toBeCloseTo(0.0, 6);
        // }
    }
});

test("ReadPoleZero", () => {
  return readSacPoleZero("./test/filter/data/hrv.bhe.sacpz")
  .then( pz => {

    // IU.HRV.BHE response
    const zeros =  [filter.createComplex(0, 0),
      filter.createComplex(0, 0),
      filter.createComplex(0, 0) ];
    const poles =  [filter.createComplex(-0.0139, 0.0100),
      filter.createComplex(-0.0139, -0.0100),
      filter.createComplex(-31.4160, 0.0000) ];
    let sacPoleZero = {
    poles: poles,
    zeros: zeros,
    constant: 2.94283674E10
    };
    expect(pz.zeros.length).toBe(sacPoleZero.zeros.length);
    for (let i=0; i<pz.zeros.length; i++) {
      expect(pz.zeros[i].real()).toBeCloseTo(sacPoleZero.zeros[i].real(), 9);
      expect(pz.zeros[i].imag()).toBeCloseTo(sacPoleZero.zeros[i].imag(), 9);
    }
    expect(pz.poles.length).toBe(sacPoleZero.poles.length);
    for (let i=0; i<pz.poles.length; i++) {
      expect(pz.poles[i].real()).toBeCloseTo(sacPoleZero.poles[i].real(), 9);
      expect(pz.poles[i].imag()).toBeCloseTo(sacPoleZero.poles[i].imag(), 9);
    }
    expect(pz.constant).toBe(sacPoleZero.constant);
  });
});

test("PoleZeroTaper", () => {
    return Promise.all([readSac("./test/filter/data/IU.HRV.__.BHE.SAC"),
                        readSacPoleZero("./test/filter/data/hrv.bhe.sacpz")])
    .then( result => {
      let sac = result[0];
      let poleZero = result[1];
      let data = sac.y;
      let samprate = 1 / sac.delta;
      for(let i = 0; i < data.length; i++) {
          data[i] /= samprate;
      }
      let out = filter.calcDFT(data, data.length);
      const sacout = [ [0, 0, 0],
                       [0.000610352, -0, 0],
                       [0.0012207, -0, 0],
                       [0.00183105, -0, 0],
                       [0.00244141, -0, 0],
                       [0.00305176, -0, -0],
                       [0.00366211, -0, -0],
                       [0.00427246, -0, -0],
                       [0.00488281, -0, -0],
                       [0.00549316, -3.61712e-13, -3.39289e-13],
                       [0.00610352, -1.42001e-12, -1.57219e-12],
                       [0.00671387, -2.67201e-12, -3.39588e-12],
                       [0.00732422, -3.79726e-12, -5.43252e-12],
                       [0.00793457, -4.615e-12, -7.32556e-12],
                       [0.00854492, -5.04479e-12, -8.7865e-12],
                       [0.00915527, -5.07988e-12, -9.62251e-12],
                       [0.00976562, -4.7661e-12, -9.74839e-12],
                       [0.010376, -4.24248e-12, -9.31375e-12],
                       [0.0109863, -3.78195e-12, -8.86666e-12],
                       [0.0115967, -3.3922e-12, -8.4564e-12]];
      const lowCut = .005;
      const lowPass = 0.01;
      const highPass = 1e5;
      const highCut = 1e6;
      const deltaF = samprate / out.length;
      let freq;
      let respAtS;
      // put into form for arrayToBeCloseTo matcher
      let sacFreqArray = [];
      let sacRealArray = [];
      let sacImagArray = [];
      let calcRealArray = [];
      let calcImagArray = [];
      for(let i = 0; i < sacout.length; i++) {
          freq = i * deltaF;
          // $FlowFixMe
          expect(freq).toBeCloseToRatio(sacout[i][0], 5);
          respAtS = filter.transfer.evalPoleZeroInverse(poleZero, freq);
          respAtS = respAtS.timesReal(deltaF*filter.transfer.freqTaper(freq,
                                                 lowCut,
                                                 lowPass,
                                                 highPass,
                                                 highCut));
          sacFreqArray.push(freq);
          sacRealArray.push(sacout[i][1]);
          sacImagArray.push(sacout[i][2]);
          calcRealArray.push(respAtS.real());
          calcImagArray.push(respAtS.imag());
      }
      // $FlowFixMe
      expect(calcRealArray).arrayToBeCloseToRatio(sacRealArray, 5);
      // $FlowFixMe
      expect(calcImagArray).arrayToBeCloseToRatio(sacImagArray, 5);
/*
          if(sacout[i][0] == 0 || respAtS.real() == 0) {
            expect(respAtS.real()).toBeCloseTo(sacout[i][1], 5);
              // assertEquals("real " + i + " " + respAtS.real()+"   "+sacout[i][1],
              //              sacout[i][1],
              //              respAtS.real() ,
              //              0.00001);
          } else {
              expect(respAtS.real()).toBeCloseToRatio(sacout[i][1], 5);
              // assertEquals("real " + i + " " + respAtS.real()+"   "+sacout[i][1], 1, sacout[i][1]
              //         / respAtS.real(), 0.00001);
          }
          if(sacout[i][1] == 0 || respAtS.imag() == 0) {
            expect(respAtS.imag()).toBeCloseTo(sacout[i][2], 5);
              // assertEquals("imag " + i + " " + respAtS.imag(),
              //              sacout[i][2],
              //              respAtS.imag() ,
              //              0.00001);
          } else {
            expect(respAtS.imag()).toBeCloseToRatio(sacout[i][2], 5);
              // assertEquals("imag " + i + " " + respAtS.imag(),
              //              -1,
              //              sacout[i][2] / respAtS.imag() ,
              //              0.00001);
          }
      }
      */
    });
});



test("Combine", () => {
  return Promise.all([readSac("./test/filter/data/IU.HRV.__.BHE.SAC"),
                      readSacPoleZero("./test/filter/data/hrv.bhe.sacpz")])
  .then ( result => {
      let sac = result[0];
      let pz = result[1];
      const samprate = 1/ sac.delta;
      let data = sac.y;
      for(let i = 0; i < data.length; i++) {
          data[i] /= samprate;
      }


      const outfft = filter.calcDFT(data, data.length);
      expect(outfft.length).toBe(32768);
      //assertEquals("nfft", 32768, out.length);
      expect(samprate/outfft.length).toBeCloseTo(0.000610352, 9);
      //assertEquals("delfrq ", 0.000610352, samprate/out.length, 0.00001);
      const out = filter.transfer.combine(outfft, samprate, pz, 0.005, 0.01, 1e5, 1e6);
      const sacout = [ [0, 0],
                           [0, -0],
                           [0, 0],
                           [0, 0],
                           [0, 0],
                           [0, 0],
                           [0, 0],
                           [0, 0],
                           [0, 0],
                           [-6.40312e-09, 1.35883e-08],
                           [-1.30956e-09, 1.31487e-08],
                           [-5.95957e-08, 1.88837e-07],
                           [-3.14161e-07, 2.18147e-08],
                           [-1.0857e-07, -2.75118e-07],
                           [3.90054e-07, 1.87374e-07],
                           [-7.00704e-07, 5.70641e-07],
                           [-4.03496e-07, -7.36036e-07],
                           [3.24801e-07, -8.71389e-08],
                           [8.35641e-08, 7.97482e-08],
                           [-1.5673e-07, 2.15609e-07]];

      for(let i = 0; i < sacout.length; i++) {
          if(sacout[i][0] == 0 || out[i] == 0) {
            expect(out[i]).toBeCloseTo(sacout[i][0]);
            //  assertEquals("real " + i + " " + out[i].real()+"  "+sacout[i][0],
            //               sacout[i][0],
            //               out[i].real() ,
            //               0.00001);
          } else {
            expect(out[i]).toBeCloseTo(sacout[i][0], 9);
            expect(sacout[i][0]/ out[i]).toBeCloseTo(1, 5);
              // assertEquals("real " + i + " " + out[i].real()+"  "+sacout[i][0], 1, sacout[i][0]
              //         / out[i].real(), 0.00001);
          }
        }
        for(let i = 1; i < sacout.length; i++) {
          if(sacout[i][1] == 0 || out[out.length-i] == 0) {
            expect(out[out.length-i]).toBeCloseTo(sacout[i][1]);
              // assertEquals("imag " + i + " " + out[i].imag()+"  "+sacout[i][1],
              //              sacout[i][1],
              //              out[i].imag() ,
              //              0.00001);
          } else {
            expect(out[out.length-i]).toBeCloseTo(sacout[i][1], 9);
            expect(sacout[i][1]/ out[out.length-i]).toBeCloseTo(1, 5);
              // assertEquals("imag " + i + " " + out[i].imag()+"  "+sacout[i][1],
              //              -1,
              //              sacout[i][1] / out[i].imag(),
              //              0.00001);
          }
      }
    });
});

/*
fg IMPULSE NPTS 1024
w impulse.sac
transfer from polezero subtype onezero.sacpz to none freqlimits 0.005 0.01 1e5 1e6
fft
wsp am impulse_onezero_fftam.sac
*/
test("impulse one zero combina amp", () => {
  return Promise.all([readSac("./test/filter/data/impulse.sac"),
                      readSac("./test/filter/data/impulse_onezero.sac"),
                      readSacPoleZero("./test/filter/data/onezero.sacpz"),
                      readSac("./test/filter/data/impulse_onezero_fftam.sac.am")])
  .then ( result => {
      let orig = result[0];
      let sactfr = result[1];
      let pz = result[2];
      let sacAmp = result[3];
      const origseis = new SeismogramSegment(orig.y, 1/orig.delta, moment.utc());

      expect(orig.y.length).toBe(1024);
      expect(orig.delta).toBe(1);
      expect(sacAmp.y.length).toBe(1024/2+1);
      const samprate = 1/ orig.delta;
      let data = orig.y;
      // for(let i = 0; i < data.length; i++) {
      //     data[i] /= samprate;
      // }


      const outfft = filter.calcDFT(data, data.length);
      expect(outfft.length).toBe(1024);
      expect(samprate/outfft.length/2).toBeCloseTo(1/1024/2, 9);
      //assertEquals("delfrq ", 0.000610352, samprate/out.length, 0.00001);
      const out = filter.transfer.combine(outfft.slice(), samprate, pz, 0.005, 0.01, 1e5, 1e6);
      expect(out.length).toBe(1024);
      // sac and oregondsp differ by const len in fft
      let outMulLength = out.map(d => d * out.length);
      const bagAmPh = filter.ampPhase(outMulLength);

      let saveDataPromise = null;
      if (WRITE_TEST_DATA) {
        // for debugging, save data as sac file
        saveDataPromise = readDataView("./test/filter/data/impulse_onezero_fftam.sac.am").then(dataView => {
            let inSac = parseSac(dataView);
            expect(bagAmPh.amp.length).toBe(inSac.npts);
            return writeSac(replaceYData(dataView, bagAmPh.amp), "./test/filter/data/impulse_onezero_fftam.bag.am");
          });
      }

      return Promise.all([
        orig,
        sactfr,
        pz,
        sacAmp,
        bagAmPh.amp,
        bagAmPh.phase,
        out,
        saveDataPromise
      ]);
    }).then(result => {
        let orig = result[0];
        let sactfr = result[1];
        let pz = result[2];
        let sacAmp = result[3];
        let bagAmp= result[4];
        let bagPhase = result[5];
        let out = result[6];
      // freq below lowcut should be zero, but sac has very small non-zero value,
      // so check first 6 values (all below lowcut) and last value separately
      expect(bagAmp[0]).toBeCloseTo(sacAmp.y[0], 9);
      expect(bagAmp[1]).toBeCloseTo(sacAmp.y[1], 8);
      expect(bagAmp[2]).toBeCloseTo(sacAmp.y[2], 8);
      expect(bagAmp[3]).toBeCloseTo(sacAmp.y[3], 7);
      expect(bagAmp[4]).toBeCloseTo(sacAmp.y[4], 7);
      expect(bagAmp[5]).toBeCloseTo(sacAmp.y[5], 7);

      // $FlowFixMe
      expect(bagAmp.slice(6, bagAmp.length-6)).arrayToBeCloseToRatio(sacAmp.y.slice(6, sacAmp.y.length-6), 5);

      expect(bagAmp[bagAmp.length-1]).toBeCloseTo(sacAmp.y[sacAmp.y.length-1], 9);

  });
});

/*
fg IMPULSE NPTS 1024
w impulse.sac
transfer from polezero subtype onezero.sacpz to none freqlimits 0.005 0.01 1e5 1e6
w impulse_corrected.sac
*/
test("impulse one zero", () => {
  return Promise.all([readSac("./test/filter/data/impulse.sac"),
                      readSac("./test/filter/data/impulse_onezero.sac"),
                      readSacPoleZero("./test/filter/data/onezero.sacpz"),
                      readSacPoleZero("./test/filter/data/impulse_onezero_fftam.sac.am")])
  .then ( result => {
      let orig = result[0];
      let sactfr = result[1];
      let pz = result[2];
      let sacAm = result[3];
      const origseis = new SeismogramSegment(orig.y, 1/orig.delta, moment.utc());
      let bagtfr = filter.transfer.transferSacPZ(origseis,
                                      pz,
                                      .005,
                                      0.01,
                                      1e5,
                                      1e6);
      const sacdata = sactfr.y;
      const bagdata = bagtfr.y;

      let saveDataPromise = Promise.resolve(null);
      if (WRITE_TEST_DATA) {
        // for debugging, save data to sac file
        saveDataPromise = saveDataPromise.then(() => {
          return readDataView("./test/filter/data/impulse_onezero.sac").then(dataView => {
            return writeSac(replaceYData(dataView, bagdata), "./test/filter/data/impulse_onezero.bag");
          });
        });
      }
      return saveDataPromise.then( () => {
      // $FlowFixMe
        expect(bagdata).arrayToBeCloseToRatio(sacdata, 2 , 1e-2, 1e-3);
      }).catch(err => {
        console.log("Error write sac "+err);
      });
    });

});
/*
fg IMPULSE NPTS 1024
w impulse.sac
transfer from polezero subtype hrv.bhe.sacpz to none freqlimits 0.005 0.01 1e5 1e6
w impulse_corrected.sac
*/
test("impulse", () => {
  return Promise.all([readSac("./test/filter/data/impulse.sac"),
                      readSac("./test/filter/data/impulse_corrected.sac"),
                      readSacPoleZero("./test/filter/data/hrv.bhe.sacpz")])
  .then ( result => {
      let orig = result[0];
      let sactfr = result[1];
      let pz = result[2];
      const origseis = new SeismogramSegment(orig.y, 1/orig.delta, moment.utc());
      let bagtfr = filter.transfer.transferSacPZ(origseis,
                                      pz,
                                      .005,
                                      0.01,
                                      1e5,
                                      1e6);
      const sacdata = sactfr.y;
      const bagdata = bagtfr.y;

      let saveDataPromise = Promise.resolve(null);
      if (WRITE_TEST_DATA) {
        // for debugging, save data to sac file
        saveDataPromise = saveDataPromise.then(() => {
          return readDataView("./test/filter/data/impulse.sac").then(dataView => {
            return writeSac(replaceYData(dataView, bagdata), "./test/filter/data/impulse_bag.sac");
          });
        });
      }
      return saveDataPromise.then( () => {
      // $FlowFixMe
        expect(bagdata).arrayToBeCloseToRatio(sacdata, 6);
      }).catch(err => {
        console.log("Error write sac "+err);
      });

  });

});


/*
 *
  r IU.HRV.__.BHE.SAC.0
  rmean
  w 1_rmean.sac
  taper type hanning width 0.05
  w 2_taper.sac
  transfer from polezero subtype hrv.bhe.sacpz to none freqlimits 0.005 0.01 1e5 1e6
  w 3_transfer.sac
*/
test("HRV test", () => {
  return Promise.all([readSac("./test/filter/data/IU.HRV.__.BHE.SAC"),
                      readSacPoleZero("./test/filter/data/hrv.bhe.sacpz"),
                      readSac("./test/filter/data/1_rmean.sac"),
                      readSac("./test/filter/data/2_taper.sac"),
                      readSac("./test/filter/data/3_transfer.sac"),
                    ])
  .then ( result => {
      let orig = result[0];
      let pz = result[1];
      let rmean = result[2];
      let taper = result[3];
      let transfer = result[4];
      const origseis = new SeismogramSegment(orig.y, 1/orig.delta, moment.utc());
      const bag_rmean = filter.rMean(origseis);
      const rmean_data = bag_rmean.y;
      let sacdata = rmean.y;
      // $FlowFixMe
      expect(rmean_data).arrayToBeCloseToRatio(sacdata, 5);

      const bag_taper = filter.taper.taper(bag_rmean, 0.05, filter.taper.HANNING);
      const taper_data = bag_taper.y;
      sacdata = taper.y;

      // $FlowFixMe
      expect(taper_data).arrayToBeCloseToRatio(sacdata, 5);

      let bagtfr = filter.transfer.transferSacPZ(bag_taper,
                                      pz,
                                      .005,
                                      0.01,
                                      1e5,
                                      1e6);
      const bagdata = bagtfr.y;
      sacdata = transfer.y;
      // $FlowFixMe
      expect(bagdata).arrayToBeCloseToRatio(sacdata, 5, .0001, 5);

      let saveDataPromise = Promise.resolve(null);
      if (WRITE_TEST_DATA) {
        // for debugging, save data to sac file
        saveDataPromise = saveDataPromise.then(() => {
          return readDataView("./test/filter/data/IU.HRV.__.BHE.SAC").then(dataView => {
            return writeSac(replaceYData(dataView, bagdata), "./test/filter/data/iu_hrv_transfer.bag");
          });
        });
      }
      return saveDataPromise.then( () => {
      // $FlowFixMe
        expect(bagdata).arrayToBeCloseToRatio(sacdata, 5, .0001, 5);
      });
  });

});
