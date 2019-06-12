

const OregonDSP = OregonDSPTop.com.oregondsp.signalProcessing;
export const Complex = OregonDSP.filter.iir.Complex;

// if OregonDSP is loaded (here it is) we want to use
// its Complex instead of the simple one defined in model
export function createComplex(real: number, imag: number) {
  return OregonDSP.filter.iir.Complex_init(real, imag);
}
