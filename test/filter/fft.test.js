import * as filter from '../../src/filter/index.js';
import {readSac, parseSac, readSacPoleZero, readDataView, writeSac, replaceYData} from './sacfile';



test("Round Trip FFT, Spike", () => {
  const data = Array(128).fill(0);
  data[1] = 1/100;
  const fft = filter.calcDFT(data, data.length);
  const out = filter.inverseDFT(fft, data.length);
  expect(out.length).toBe(data.length);
  for(let i=0; i<out.length; i++) {
    if (data[i] === 0) {
      expect(out[i]).toBeCloseTo(data[i], 3);
    } else {
      expect(out[i]/data[i]).toBeCloseTo(1, 5);
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
  })
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
      const out = filter.calcDFT(data, data.length);
      const bagAmPh = filter.ampPhase(out);

      let saveDataPromise = Promise.resolve(null);
      if (false) {
        saveDataPromise = readDataView("./test/filter/data/IU.HRV.__.BHE_fft.sac.am").then(dataView => {
          let inSac = parseSac(dataView);
          expect(bagAmPh.amp.length).toBe(inSac.npts);
          return Promise.all([
              writeSac(replaceYData(dataView, bagAmPh.amp), "./test/filter/data/IU.HRV.__.BHE_fft.bag.am"),
              writeSac(replaceYData(dataView, bagAmPh.phase), "./test/filter/data/IU.HRV.__.BHE_fft.bag.ph")
            ]);
        });
      }

      return Promise.all([
        sac,
        sacAmp,
        sacPhase,
        bagAmPh.amp,
        bagAmPh.phase,
        out,
        saveDataPromise
      ]);
    }).then(result => {
        let sac = result[0];
        let sacAmp = result[1];
        let sacPhase = result[2];
        let bagAmp= result[3];
        let bagPhase = result[4];
        let out = result[5];
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
      expect(out[0]).toBeCloseTo(sacout[0][0], 0);
      //imag
      //expect(out[0].imag()).toBeCloseTo(sacout[0][1], 5);
      // assertEquals("real " + 0 + " " + out[0].real(), 1, sacout[0][0]
      //         / out[0].real() , 0.00001);
      // assertEquals("imag " + 0 + " " + out[0].imag(),
      //              sacout[0][1],
      //              -out[0].imag() ,
      //              0.00001);
      for(let i = 1; i < sacout.length; i++) {
        //real
        expect(out[i]).toBeCloseTo(sacout[i][0], 1);
        //imag
        expect(out[out.length-i]).toBeCloseTo(sacout[i][1], 1);
          // assertEquals("real " + i + " " + out[i].real(), 1, sacout[i][0]
          //         / out[i].real(), 0.00001);
          // // sac fft is opposite sign imag, so ratio is -1
          // assertEquals("imag " + i + " " + out[i].imag(), -1, sacout[i][1]
          //         / out[i].imag(), 0.00001);
      }
      expect(bagAmp.length).toBe(sacAmp.y.length);
      expect(bagAmp).arrayToBeCloseToRatio(sacAmp.y, 2);
      expect(bagPhase.length).toBe(sacPhase.y.length);
      expect(bagPhase).arrayToBeCloseTo(sacPhase.y, 2);
    });
});
