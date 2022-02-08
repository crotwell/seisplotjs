// @flow

import * as fft from '../../src/fft';
import {Seismogram } from '../../src/seismogram';
import {readSac, parseSac, readDataView, writeSac, replaceYData, asSeismogram} from './sacfile';
import moment from 'moment';

const OVERWRITE_OUTPUT = false;

test("real small fft, Lyons p 64-72", () => {
  // OregonDSP smallest is 16 point FFT, so pad and only look at even indices
  const data =  Float32Array.from([ 0.3535, 0.3535, 0.6464, 1.0607, 0.3535, -1.0607, -1.3535, -0.3535, 0, 0, 0, 0, 0, 0, 0, 0]);
  const ansReal =  Float32Array.from([ 0.0, 0.0, 1.414, 0.0, 0.0, 0.0, 1.414, 0.0]);
  const ansImg =  Float32Array.from([ 0.0, -4.0, 1.414, 0.0, 0.0, 0.0, -1.414, 4.0]);
  const fftout = fft.calcDFT(data);
  expect(fftout[0]).toBeCloseTo(ansReal[0], 3);
  expect(fftout[2]).toBeCloseTo(ansReal[1], 3);
  expect(fftout[4]).toBeCloseTo(ansReal[2], 3);
  expect(fftout[6]).toBeCloseTo(ansReal[3], 3);
  expect(fftout[8]).toBeCloseTo(ansReal[4], 3);
  expect(fftout[16-2]).toBeCloseTo(ansImg[1], 3);
  expect(fftout[16-4]).toBeCloseTo(ansImg[2], 3);
  expect(fftout[16-6]).toBeCloseTo(ansImg[3], 3);

  const out = fft.inverseDFT(fftout, data.length);
  for(let i=0; i<out.length; i++) {
    expect(out[i]).toBeCloseTo(data[i], 3);
  }
});

test("Round Trip FFT, Spike", () => {
  const data = new Float32Array(128).fill(1/10000);
  data[1] = 1/100;
  const fftout = fft.calcDFT(data);
  const out = fft.inverseDFT(fftout, data.length);
  expect(out).toHaveLength(data.length);
  for(let i=0; i<out.length; i++) {
    expect(out[i]/data[i]).toBeCloseTo(1, 5);
  }
  let sampleRate = 1;
  let start = moment.utc();
  let seis = Seismogram.createFromContiguousData(data, sampleRate, start);
  const fftresult = fft.fftForward(seis);
  for(let i=0; i<fftresult.packedFreq.length; i++) {
      expect(fftresult.packedFreq[i]).toBeCloseTo(fftout[i], 5);
  }
  const invresult = fftresult.fftInverse();
  for(let i=0; i<invresult.length; i++) {
    expect(invresult[i]).toBeCloseTo(data[i], 5);
    //  expect(invresult[i]/data[i]).toBeCloseTo(1, 5);
  }
});


test("Round Trip FFT HRV", () => {
  return readSac("./test/filter/data/IU.HRV.__.BHE.SAC")
  .then(data => {
    const fftout = fft.calcDFT(data.y);
    const out = fft.inverseDFT(fftout, data.y.length);
    for(let i=0; i<out.length; i++) {
      expect(out[i]).toBeCloseTo(data.y[i], 2);
    }
  });
});


test("FFT", () => {
  return Promise.all([readSac("./test/filter/data/IU.HRV.__.BHE.SAC"),
                      readSac("./test/filter/data/IU.HRV.__.BHE_fft.sac.am"),
                      readSac("./test/filter/data/IU.HRV.__.BHE_fft.sac.ph")])
  .then ( result => {
      let sac = asSeismogram(result[0]);
      let sacAmp = asSeismogram(result[1]);
      let sacPhase = asSeismogram(result[2]);
      const samprate = sac.sampleRate;
      let data = sac.y;
      /* sac premultiplies the data by the sample period before doing the fft. Later it
       * seems to be cancled out by premultiplying the pole zeros by a similar factor.
       * I don't understand why they do this, but am reporducing it in order to be
       * compatible.
       */
      for(let i = 0; i < data.length; i++) {
          data[i] /= samprate;
      }
      const fftRes = fft.fftForward(sac);

      let saveDataPromise = Promise.resolve(null);
      if (OVERWRITE_OUTPUT) {
        saveDataPromise = readDataView("./test/filter/data/IU.HRV.__.BHE_fft.sac.am").then(dataView => {
          let inSac = parseSac(dataView);
          if (fftRes.amp.length !== inSac.npts) {
            throw new Error(`npts not same: ${fftRes.amp.length}  ${inSac.npts}, not writing.`);
          }
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
        //let sac = result[0];
        let sacAmp = result[1];
        let sacPhase = result[2];
        let bagAmp= result[3];
        let bagPhase = result[4];
        let fftRes: fft.FFTResult = result[5];
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


test("fftForward", () => {
  const dataLen = 1000;
  const nextPowerTwo = 1024;
  let rawData = new Float32Array(dataLen);
  rawData[500] = 1;
  const sampleRate = 1;
  const start = moment.utc();
  const origseis = Seismogram.createFromContiguousData(rawData, sampleRate, start);
  const freqData = fft.fftForward(origseis);
  expect(freqData.origLength).toEqual(dataLen);
  expect(freqData.numPoints).toEqual(nextPowerTwo);
  expect(freqData.sampleRate).toEqual(origseis.sampleRate);
  expect(freqData.fundamentalFrequency).toBeCloseTo(sampleRate/nextPowerTwo);
  expect(freqData.amp.length).toEqual(nextPowerTwo/2 +1);
});
