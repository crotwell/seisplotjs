// @flow

import {Complex, createComplex} from './filter.js';

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
  /** Parses a string in sac polezero format into a SacPoleZero.
  */
  static parse(data: string) {
      let pz = {
        zeros: [],
        poles: [],
        constant: 1
      };
      let lines = data.split('\n');
      let numZeros = 0;
      let numPoles = 0;
      let i=0;
      while (i < lines.length) {
        let l = lines[i];
        let items = l.trim().split(/ +/);
        if (items[0] === 'ZEROS') {
          numZeros = parseInt(items[1]);
          i++;
          l = lines[i];
          items = l.trim().split(/ +/);
          while (i < lines.length && pz.zeros.length < numZeros) {
            if (items[0] === 'POLES') {
              // no more zeros, fill array with 0
              for(let z = pz.zeros.length; z < numZeros; z++) {
                pz.zeros.push(createComplex(0,0));
              }
              break;
            } else {
              let real = parseFloat(items[0]);
              let imag = parseFloat(items[1]);
              pz.zeros.push(createComplex(real, imag));
            }
            i++;
            l = lines[i];
            items = l.trim().split(/ +/);
          }
        }
        if (items[0] === 'POLES') {
          numPoles = parseInt(items[1]);
          i++;
          l = lines[i];
          items = l.trim().split(/ +/);
          while (i < lines.length && pz.poles.length < numPoles) {
            if (items[0] === 'CONSTANT') {
              // no more poles, fill array with 0
              for(let z = pz.poles.length; z < numPoles; z++) {
                pz.poles.push(createComplex(0,0));
              }
              break;
            } else {
              let real = parseFloat(items[0]);
              let imag = parseFloat(items[1]);
              pz.poles.push(createComplex(real, imag));
            }
            i++;
            l = lines[i];
            items = l.trim().split(/ +/);
          }
        }
        if (items[0] === 'CONSTANT') {
          pz.constant = parseFloat(items[1]);
        }
        i++;
      }
      return new SacPoleZero(pz.poles, pz.zeros, pz.constant);
  }
}
