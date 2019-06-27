// @flow

import * as filter from '../../src/filter/index.js';
import {Seismogram} from '../../src/seismogram';
import {readSac} from './sacfile';
import  {moment} from '../../src/util';

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
