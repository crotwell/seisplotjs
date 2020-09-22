// @flow

/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */

 import * as OregonDSPTop from 'oregondsp';

import type { Complex } from 'oregondsp/com/oregondsp/signalProcessing/filter/iir';
export type { Complex };

 export const OregonDSP = OregonDSPTop.com.oregondsp.signalProcessing;
// export class Complex = OregonDSP.filter.iir.Complex;

 export function createComplex(real: number, imag: number): Complex {
   return OregonDSP.filter.iir.Complex_init(real, imag);
 }
