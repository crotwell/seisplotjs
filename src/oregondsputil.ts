/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */
import * as OregonDSPTop from "oregondsp";
//import type {Complex} from "oregondsp.com.oregondsp.signalProcessing.filter.iir";
export type Complex = typeof OregonDSPTop.com.oregondsp.signalProcessing.filter.iir.Complex;
//import Complex=OregonDSPTop.com.oregondsp.signalProcessing.filter.iir.Complex;
export const OregonDSP = OregonDSPTop.com.oregondsp.signalProcessing;
//export const Complex = OregonDSP.filter.iir.Complex;
export function createComplex(real: number, imag: number): OregonDSPTop.com.oregondsp.signalProcessing.filter.iir.Complex {
  return OregonDSPTop.com.oregondsp.signalProcessing.filter.iir.Complex.Complex_init(real, imag);
}
export function complexFromPolar(amp: number, phase: number): OregonDSPTop.com.oregondsp.signalProcessing.filter.iir.Complex {
  const real = amp*Math.cos(phase);
  const imag = amp*Math.sin(phase);
  return OregonDSPTop.com.oregondsp.signalProcessing.filter.iir.Complex.Complex_init(real, imag);
}
//export {Complex};
