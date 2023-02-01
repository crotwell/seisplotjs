
import * as filter from '../../src/filter';
import {readSeismogram} from './sacfile';
import * as OregonDSPTop from 'oregondsp';
const OregonDSP = OregonDSPTop.com.oregondsp.signalProcessing;

test("init hilbert filter", () => {
  const seisLen = 1024;
  const seisY = new Float32Array(seisLen);
  for(let i=0; i<seisLen; i++) {
    seisY[i] = Math.sin(47*i)+Math.sin(173*i);
  }
  const n = 10;
  const lowEdge = .05;
  const highEdge = .95;
  const hilbert = new OregonDSP.filter.fir.equiripple.CenteredHilbertTransform(n, lowEdge, highEdge);

  const coeff = hilbert.getCoefficients();

  coeff.forEach( (c: number) => {
    expect(c).toBeFinite();
  });
  const hilbertY = hilbert.filter(seisY);

  hilbertY.forEach( (c: number) => {
    expect(c).toBeFinite();
  });
});

test("simple hilbert", () => {
    return readSeismogram("./test/filter/data/IU.HRV.__.BHE.SAC")
      .then( origseis => {
        expect(origseis.y).toHaveLength(31450);
        const hilbertSeismogram = filter.hilbert(origseis);
        // check first for NaN before array length
        expect(hilbertSeismogram.y[0]).toBeFinite();
        expect(hilbertSeismogram.y).toHaveLength(origseis.y.length+20);
      });
});


test("simple envelope", () => {
  return readSeismogram("./test/filter/data/IU.HRV.__.BHE.SAC")
    .then( origseis => {
        expect(origseis.y).toHaveLength(31450);

        const envelopeSeis = filter.envelope(origseis);
        expect(envelopeSeis.y.length).toBe(origseis.y.length);
        for(let i=0; i<envelopeSeis.y.length; i++) {
          expect(envelopeSeis.y[i]).toBeGreaterThanOrEqual(0);
        }
      });
});
