import OregonDSPTop from "oregondsp";
export const OregonDSP = OregonDSPTop.com.oregondsp.signalProcessing;
const fft = OregonDSP.fft;
const equiripple = OregonDSP.filter.fir.equiripple;
const fir = OregonDSP.filter.fir;
const iir = OregonDSP.filter.iir;
export const CDFT = fft.CDFT;
export const RDFT = fft.RDFT;
export const CenteredDifferentiator = equiripple.CenteredDifferentiator;
export const CenteredHilbertTransform = equiripple.CenteredHilbertTransform;
export const EquirippleBandpass = equiripple.EquirippleBandpass;
export const EquirippleFIRFilter = equiripple.EquirippleFIRFilter;
export const EquirippleHalfBand = equiripple.EquirippleHalfBand;
export const EquirippleHighpass = equiripple.EquirippleHighpass;
export const EquirippleLowpass = equiripple.EquirippleLowpass;
export const FIRTypeI = equiripple.FIRTypeI;
export const FIRTypeII = equiripple.FIRTypeII;
export const FIRTypeIII = equiripple.FIRTypeIII;
export const StaggeredDifferentiator = equiripple.StaggeredDifferentiator;
export const StaggeredHilbertTranform = equiripple.StaggeredHilbertTranform;
export const ComplexAnalyticSignal = fir.ComplexAnalyticSignal;
export const Interpolator = fir.Interpolator;
export const OverlapAdd = fir.OverlapAdd;
export const Allpass = iir.Allpass;
export const AnalogPrototype = iir.AnalogPrototype;
export const Butterworth = iir.Butterworth;
export const ChebyshevI = iir.ChebyshevI;
export const ChebyshevII = iir.ChebyshevII;
export const Complex = iir.Complex;
//export {com.oregondsp.signalProcessing.filter.iir.Complex as Complex} from "./kotlin/oregondsp.js";
export const IIRFilter = iir.IIRFilter;
export const PassbandType = iir.PassbandType;
export const ThiranAllpass = iir.ThiranAllpass;
export const LOWPASS = iir.PassbandType.LOWPASS;
export const BANDPASS = iir.PassbandType.BANDPASS;
export const HIGHPASS = iir.PassbandType.HIGHPASS;
export const LagrangePolynomial = OregonDSP.filter.LagrangePolynomial;
export const Polynomial = OregonDSP.filter.Polynomial;
export const Rational = OregonDSP.filter.Rational;
export const HammingWindow = OregonDSP.HammingWindow;
export const HanningWindow = OregonDSP.HanningWindow;
export const Sequence = OregonDSP.Sequence;
export const Window = OregonDSP.Window;
export function complexFromPolar(amp: number, phase: number) {
  const real = amp * Math.cos(phase);
  const imag = amp * Math.sin(phase);
  return new OregonDSPTop.com.oregondsp.signalProcessing.filter.iir.Complex(
    real,
    imag,
  );
}
export function createComplex(real: number, imag: number) {
  return new OregonDSPTop.com.oregondsp.signalProcessing.filter.iir.Complex(
    real,
    imag,
  );
}
