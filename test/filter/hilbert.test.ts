
import * as filter from '../../src/filter';
import {Seismogram} from '../../src/seismogram';
import {readSeismogram} from './sacfile';
import {DateTime} from 'luxon';
import * as OregonDSPTop from 'oregondsp';
const OregonDSP = OregonDSPTop.com.oregondsp.signalProcessing;

test("init hilbert filter", () => {
  const seisLen = 1024;
  let seisY = new Float32Array(seisLen);
  for(let i=0; i<seisLen; i++) {
    seisY[i] = Math.sin(47*i)+Math.sin(173*i);
  }
  let n = 10;
  let lowEdge = .05;
  let highEdge = .95;
  let hilbert = new OregonDSP.filter.fir.equiripple.CenteredHilbertTransform(n, lowEdge, highEdge);

  let coeff = hilbert.getCoefficients();

  coeff.forEach( (c: number) => {
    expect(c).toBeFinite();
  });
  let hilbertY = hilbert.filter(seisY);

  hilbertY.forEach( (c: number) => {
    expect(c).toBeFinite();
  });
});

test("simple hilbert", () => {
    return readSeismogram("./test/filter/data/IU.HRV.__.BHE.SAC")
      .then( origseis => {
        expect(origseis.y).toHaveLength(31450);
        let hilbertSeismogram = filter.hilbert(origseis);
        // check first for NaN before array length
        expect(hilbertSeismogram.y[0]).toBeFinite();
        expect(hilbertSeismogram.y).toHaveLength(origseis.y.length+20);
      });
});


test("simple envelope", () => {
  return readSeismogram("./test/filter/data/IU.HRV.__.BHE.SAC")
    .then( origseis => {
        expect(origseis.y).toHaveLength(31450);

        let envelopeSeis = filter.envelope(origseis);
        expect(envelopeSeis.y.length).toBe(origseis.y.length);
        for(let i=0; i<envelopeSeis.y.length; i++) {
          expect(envelopeSeis.y[i]).toBeGreaterThanOrEqual(0);
        }
      });
});
