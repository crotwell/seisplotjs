// @flow

/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */

 import * as OregonDSPTop from 'oregondsp';

 export const OregonDSP = OregonDSPTop.com.oregondsp.signalProcessing;
 export const Complex = OregonDSP.filter.iir.Complex;

 export function createComplex(real: number, imag: number) {
   return OregonDSP.filter.iir.Complex_init(real, imag);
 }
