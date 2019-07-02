// @flow

import * as filter from '../../src/filter/index.js';
import {Seismogram} from '../../src/seismogram';
import {readSac} from './sacfile';
import  {moment} from '../../src/util';
import * as OregonDSPTop from 'oregondsp';
const OregonDSP = OregonDSPTop.com.oregondsp.signalProcessing;

test("init hilbert filter", () => {
  const seisLen = 1024;
  let seisY = Array[seisLen];
  for(let i=0; i<seisLen; i++) {
    seisY[i] = Math.sin(47*i)+Math.sin(173*i);
  }
  let n = 100;
  let lowEdge = .05;
  let highEdge = .95;
  let hilbert = new OregonDSP.filter.fir.equiripple.CenteredHilbertTransform(100, .2, .8);
  let coeff = hilbert.getCoefficients();
  for (let c of coeff) {
    console.log(`hilbert: ${c}`);

  }
  coeff.forEach( c => {
    expect(c).toBeFinite();
  });
  let hilbertY = hilbert.filter(seisY);

  hilbertY.forEach( c => {
    expect(c).toBeFinite();
  });
});

test("simple hilbert", () => {
    return readSac("./test/filter/data/IU.HRV.__.BHE.SAC")
      .then( orig => {
        const origseis = Seismogram.createFromArray(orig.y, 1/orig.delta, moment.utc());

        let hilbertSeismogram = filter.hilbert(origseis);
        expect(hilbertSeismogram.y.length).toBe(origseis.y.length);
      });
});


test("simple envelope", () => {
    return readSac("./test/filter/data/IU.HRV.__.BHE.SAC")
      .then( orig => {
        const origseis = Seismogram.createFromArray(orig.y, 1/orig.delta, moment.utc());

        let envelopeSeis = filter.envelope(origseis);
        expect(envelopeSeis.y.length).toBe(origseis.y.length);
        for(let i=0; i<envelopeSeis.y.length; i++) {
          expect(envelopeSeis.y[i]).toBeGreaterThanOrEqual(0);
        }
      });
});
