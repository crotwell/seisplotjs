// @flow

import {SacPoleZero} from '../../src/sacPoleZero';
import {readSacPoleZero} from './sacfile';


test("parse sac polezero", () => {
  expect.assertions(17);
  return readSacPoleZero("./test/filter/data/hrv.bhe.sacpz").then(pz => {
    expect(pz).toBeInstanceOf(SacPoleZero);
    expect(pz).toBeDefined();
    expect(pz.poles.length).toEqual(3);
    expect(pz.poles[0].real()).toEqual(-0.0139);
    expect(pz.poles[0].imag()).toEqual(0.0100);
    expect(pz.poles[1].real()).toEqual(-0.0139);
    expect(pz.poles[1].imag()).toEqual(-0.0100);
    expect(pz.poles[2].real()).toEqual(-31.4160);
    expect(pz.poles[2].imag()).toEqual(0);
    expect(pz.zeros.length).toEqual(3);
    expect(pz.zeros[0].real()).toEqual(0);
    expect(pz.zeros[0].imag()).toEqual(0);
    expect(pz.zeros[1].real()).toEqual(0);
    expect(pz.zeros[1].imag()).toEqual(0);
    expect(pz.zeros[2].real()).toEqual(0);
    expect(pz.zeros[2].imag()).toEqual(0);
    expect(pz.constant).toEqual(2.94283674E10);
  });
});
