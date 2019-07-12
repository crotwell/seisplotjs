// @flow

import * as filter from '../../src/filter/index.js';
import {readSac, parseSac, readDataView, writeSac, replaceYData} from './sacfile';



test("Round Trip FFT, Spike", () => {
  const data = new Float32Array(128).fill(0);
  data[1] = 1/100;
  const fft = filter.calcDFT(data, data.length);
  const out = filter.inverseDFT(fft, data.length);
  expect(out).toHaveLength(data.length);
  for(let i=0; i<out.length; i++) {
    if (data[i] === 0) {
      expect(out[i]).toBeCloseTo(data[i], 3);
    } else {
      expect(out[i]/data[i]).toBeCloseTo(1, 5);
    }
  }
  const fftresult = filter.fftForward(data)
  for(let i=0; i<fftresult.packedFreq.length; i++) {
      expect(fftresult.packedFreq[i]).toBeCloseTo(fft[i], 5);
  }
  const invresult = fftresult.fftInverse()
  for(let i=0; i<invresult.length; i++) {
    if (data[i] === 0) {
      expect(invresult[i]).toBeCloseTo(data[i], 3);
    } else {
      expect(invresult[i]/data[i]).toBeCloseTo(1, 5);
    }
  }
});


test("Round Trip FFT HRV", () => {
  return readSac("./test/filter/data/IU.HRV.__.BHE.SAC")
  .then(data => {

    const fft = filter.calcDFT(data.y, data.y.length);
    const out = filter.inverseDFT(fft, data.y.length);
    for(let i=0; i<out.length; i++) {
      if (data.y[i] === 0) {
        expect(out[i]).toBeCloseTo(data.y[i], 3);
      } else {
        expect(out[i]/data.y[i]).toBeCloseTo(1, 3);
      }
    }
  });
});


test("FFT", () => {
  return Promise.all([readSac("./test/filter/data/IU.HRV.__.BHE.SAC"),
                      readSac("./test/filter/data/IU.HRV.__.BHE_fft.sac.am"),
                      readSac("./test/filter/data/IU.HRV.__.BHE_fft.sac.ph")])
  .then ( result => {
      let sac = result[0];
      let sacAmp = result[1];
      let sacPhase = result[2];
      const samprate = 1/ sac.delta;
      let data = sac.y;
      /* sac premultiplies the data by the sample period before doing the fft. Later it
       * seems to be cancled out by premultiplying the pole zeros by a similar factor.
       * I don't understand why they do this, but am reporducing it in order to be
       * compatible.
       */
      for(let i = 0; i < data.length; i++) {
          data[i] /= samprate;
      }
      const fftRes = filter.fftForward(data);

      let saveDataPromise = Promise.resolve(null);
      if (false) {
        saveDataPromise = readDataView("./test/filter/data/IU.HRV.__.BHE_fft.sac.am").then(dataView => {
          let inSac = parseSac(dataView);
          expect(fftRes.amp.length).toBe(inSac.npts);
          return Promise.all([
              writeSac(replaceYData(dataView, fftRes.amp), "./test/filter/data/IU.HRV.__.BHE_fft.bag.am"),
              writeSac(replaceYData(dataView, fftRes.phase), "./test/filter/data/IU.HRV.__.BHE_fft.bag.ph")
            ]);
        });
      }
      return Promise.all([
        sac,
        sacAmp,
        sacPhase,
        fftRes.amp,
        fftRes.phase,
        fftRes,
        saveDataPromise
      ]);
    }).then(result => {
        let sac = result[0];
        let sacAmp = result[1];
        let sacPhase = result[2];
        let bagAmp= result[3];
        let bagPhase = result[4];
        let fftRes: filter.FFTResult = result[5];
      const sacout =  [ [695917, 0],
                        [-34640.4, 7593.43],
                        [-28626.7, -34529.8],
                        [-28644.3, -18493.2],
                        [-17856.8, -14744.9],
                        [-26180.4, -13016],
                        [-35773.7, -28250.8],
                        [-3204.24, -39020.9],
                        [-6523.97, -9036.16],
                        [-9328.12, -28816.7],
                        [-4191.56, -4618.8],
                        [-25816.1, -37862.5],
                        [24457.3, -40734.5],
                        [33569.6, 6327.69],
                        [-35207.2, 24178.2],
                        [-16313.6, -81431.5],
                        [77269.7, -3612.97],
                        [-5407.14, 32410.2],
                        [-11010.8, 4728.02],
                        [-15558.3, -24774.9]];
      // real
      expect(fftRes.packedFreq[0]).toBeCloseTo(sacout[0][0], 0);
      //imag
      for(let i = 1; i < sacout.length; i++) {
        //real
        expect(fftRes.packedFreq[i]).toBeCloseTo(sacout[i][0], 0);
        //imag
        expect(fftRes.packedFreq[fftRes.packedFreq.length-i]).toBeCloseTo(sacout[i][1], 0);

      }
      expect(bagAmp).toHaveLength(sacAmp.y.length);
      // $FlowFixMe
      expect(bagAmp).arrayToBeCloseToRatio(sacAmp.y, 2);
      expect(bagPhase).toHaveLength(sacPhase.y.length);
      // $FlowFixMe
      expect(bagPhase).arrayToBeCloseTo(sacPhase.y, 2);
    });
});
