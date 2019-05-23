// @flow

import type {Complex } from 'oregondsp/com/oregondsp/signalProcessing/filter/iir';
//import { Complex_init } from 'oregondsp/com/oregondsp/signalProcessing/filter/iir';
import * as OregonDSPTop from 'oregondsp';
const OregonDSP = OregonDSPTop.com.oregondsp.signalProcessing;
const Complex_init = OregonDSP.filter.iir.Complex_init;

export class SacPoleZero {
  poles: Array<Complex>;
  zeros: Array<Complex>;
  constant: number;
  /** for debugging */
  gamma: number;
  mulFactor: number;
  sd: number;
  A0: number;
  constructor(poles: Array<Complex>, zeros: Array<Complex>, constant: number) {
    this.poles = poles;
    this.zeros = zeros;
    this.constant = constant;
  }
  toString(): string {
    let s = ["sacPoleZero:"];
    s.push("ZEROS "+this.zeros.length);
    for(let i=0; i<this.zeros.length; i++ ) {
      s.push("    "+this.zeros[i].real()+" "+this.zeros[i].imag());
    }
    s.push("POLES "+this.poles.length);
    for(let i=0; i<this.poles.length; i++ ) {
      s.push("    "+this.poles[i].real()+" "+this.poles[i].imag());
    }
    s.push("CONSTANT "+this.constant);
    if (this.gamma && this.mulFactor && this.sd && this.A0) {
      s.push("*    gamma: "+this.gamma);
      s.push("*    mulFactor: "+this.mulFactor);
      s.push("*    sd: "+this.sd);
      s.push("*    A0: "+this.A0);
    }
    return s.join('\n');
  }
  toText(): string {
    let s = [];
    s.push("ZEROS "+this.zeros.length);
    for(let i=0; i<this.zeros.length; i++ ) {
      s.push("    "+this.zeros[i].real()+" "+this.zeros[i].imag());
    }
    s.push("POLES "+this.poles.length);
    for(let i=0; i<this.poles.length; i++ ) {
      s.push("    "+this.poles[i].real()+" "+this.poles[i].imag());
    }
    s.push("CONSTANT "+this.constant);
    return s.join('\n');
  }
}
