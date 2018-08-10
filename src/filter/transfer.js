//@flow

import * as OregonDSPTop from 'oregondsp';
import { calcDFT, inverseDFT } from './index';
import * as model from '../model/index';
import Qty from 'js-quantities';


let OregonDSP = OregonDSPTop.com.oregondsp.signalProcessing;

// if OregonDSP is loaded (here it is) we want to use
// its Complex instead of the simple one defined in model
export function createComplex(real: number, imag: number) {
  return OregonDSP.filter.iir.Complex_init(real, imag);
};

export function transfer(seis :model.Seismogram,
                        response :model.Response,
                        lowCut :number,
                        lowPass :number,
                        highPass :number,
                        highCut :number) {
        if (! response) {
          throw new Error("Response not exist???");
        }
        const sacPoleZero = convertToSacPoleZero(response);

        return transferSacPZ(seis, sacPoleZero, lowCut, lowPass, highPass, highCut);
      }

export function transferSacPZ(seis :model.Seismogram,
                              sacPoleZero,
                              lowCut :number,
                              lowPass :number,
                              highPass :number,
                              highCut :number) {
        const sampFreq = seis.sampleRate;

        let values = seis.y;
        /* sac premultiplies the data by the sample period before doing the fft. Later it
         * seems to be cancled out by premultiplying the pole zeros by a similar factor.
         * I don't understand why they do this, but am reproducing it in order to be
         * compatible.
         */
        values = values.map(d => d/sampFreq);

        let freqValues = calcDFT(values, values.length);
        freqValues = combine(freqValues, sampFreq, sacPoleZero, lowCut, lowPass, highPass, highCut);

        values = inverseDFT(freqValues, values.length);
        // a extra factor of nfft gets in somehow???
        values = values.map(d => d * freqValues.length);
        let out = seis.clone();
        out.y = values;
        //out.y_unit = UNITS.METER;
        out.yUnit = 'm';
        return out;
    }


export function combine(freqValues :Array<number>,
                        sampFreq :number,  
                        sacPoleZero,
                        lowCut :number,
                        lowPass :number,
                        highPass :number,
                        highCut :number) {
        const deltaF = sampFreq / freqValues.length;

        // handle zero freq, no imag, set real to 0
        freqValues[0] = 0;
        // handle nyquist
        let freq = sampFreq / 2;
        let respAtS = evalPoleZeroInverse(sacPoleZero, freq);
        respAtS = respAtS.timesReal(deltaF*freqTaper(freq,
                                               lowCut,
                                               lowPass,
                                               highPass,
                                               highCut));
        freqValues[freqValues.length/2 ] = respAtS.timesReal(freqValues[freqValues.length/2 ]).real();
        for(let i = 1; i < freqValues.length / 2 ; i++) {
            freq = i * deltaF;
            respAtS = evalPoleZeroInverse(sacPoleZero, freq);
            respAtS = respAtS.timesReal(deltaF*freqTaper(freq,
                                                               lowCut,
                                                               lowPass,
                                                               highPass,
                                                               highCut));
            let freqComplex = createComplex(freqValues[i], freqValues[freqValues.length-i])
                .timesComplex(respAtS);
            freqValues[i] = freqComplex.real();
            freqValues[freqValues.length-i] = freqComplex.imag();
            // fft in sac has opposite sign on imag, so take conjugate to make same
            //freqValues[freqValues.length - i] = freqValues[i].conjg();
        }
        return freqValues;
    }

    /**
     * Evaluates the poles and zeros at the given value. The return value is
     * 1/(pz(s) to avoid divide by zero issues. If there is a divide by zero
     * situation, then the response is set to be 0+0i.
     */
  export function evalPoleZeroInverse(sacPoleZero, freq :number) {
        const s = createComplex(0, 2 * Math.PI * freq);
        let zeroOut = createComplex(1, 0);
        let poleOut = createComplex(1, 0);
        for(let i = 0; i < sacPoleZero.poles.length; i++) {
            poleOut = poleOut.timesComplex( s.minusComplex(sacPoleZero.poles[i]) );
        }
        for(let i = 0; i < sacPoleZero.zeros.length; i++) {
            if(s.real() == sacPoleZero.zeros[i].real()
                    && s.imag() == sacPoleZero.zeros[i].imag()) {
                return createComplex(0,0);
            }
            zeroOut = zeroOut.timesComplex( s.minusComplex(sacPoleZero.zeros[i]) );
        }
        let out = poleOut.overComplex(zeroOut);
        return out.overReal( sacPoleZero.constant);
    }

export function freqTaper(freq :number,
                          lowCut :number,
                          lowPass :number,
                          highPass :number,
                          highCut :number) :number {
    if (lowCut > lowPass || lowPass > highPass || highPass > highCut) {
        throw new Error("must be lowCut > lowPass > highPass > highCut: "+lowCut +" "+ lowPass +" "+ highPass +" "+ highCut);
    }
    if(freq <= lowCut || freq >= highCut) {
        return 0;
    }
    if(freq >= lowPass && freq <= highPass) {
        return 1;
    }
    if(freq > lowCut && freq < lowPass) {
        return 0.5 * (1.0 + Math.cos(Math.PI * (freq - lowPass)
                / (lowCut - lowPass)));
    }
    // freq > highPass && freq < highCut
    return 0.5 * (1.0 - Math.cos(Math.PI * (freq - highCut)
            / (highPass - highCut)));
}

// common units
export const UNITS = {
  COUNT: new Qty('count'),
  METER: new Qty('m'),
  METER_PER_SECOND: new Qty('m/s'),
  METER_PER_SECOND_PER_SECOND: new Qty('m/s2'),
};

/** Converts a StationXML response to SAC PoleZero style. This
  * converts the analog to digital stage (usually 0) along
  * with the overall gain, but does not include later FIR stages.
  */
export function convertToSacPoleZero( response :model.Response) {
    let polesZeros :model.PolesZeros;
    if (response.stages[0].filter instanceof model.PolesZeros) {
      polesZeros = response.stages[0].filter;
    } else {
      throw new Error("can't find PolesZeros");
    }
    let unit = response.instrumentSensitivity.inputUnits;
    if (unit === "M/S" || unit === "M/SEC") {
      unit = "m/s";
    }
    const unitQty = new Qty(unit);
    let scaleUnit = new Qty(1, unit);
    let gamma = 0;
    if (unitQty.isCompatible(UNITS.METER)) {
        gamma = 0;
        scaleUnit = scaleUnit.to(UNITS.METER);
    } else if (unitQty.isCompatible(UNITS.METER_PER_SECOND)) {
        gamma = 1;
        scaleUnit = scaleUnit.to(UNITS.METER_PER_SECOND);
    } else if (unitQty.isCompatible(UNITS.METER_PER_SECOND_PER_SECOND)) {
        gamma = 2;
        scaleUnit = scaleUnit.to(UNITS.METER_PER_SECOND_PER_SECOND);
    } else {
        throw new Error("response unit is not displacement, velocity or acceleration: "+unit);
    }

    let mulFactor = 1;
    if (polesZeros.pzTransferFunctionType === "LAPLACE (HERTZ)") {
        mulFactor = 2 * Math.PI;
    }
    let zeros = [];
    // extra gamma zeros are (0,0)
    for (let i = 0; i < polesZeros.zeros.length; i++) {
        zeros[i] = createComplex(polesZeros.zeros[i].real * mulFactor,
                               polesZeros.zeros[i].imag * mulFactor);
    }
    for (let i=0; i<gamma; i++) {
      zeros.push(createComplex(0,0));
    }
    let poles = [];
    for (let i = 0; i < polesZeros.poles.length; i++) {
        poles[i] = createComplex(polesZeros.poles[i].real * mulFactor,
                               polesZeros.poles[i].imag * mulFactor);
    }
    let constant = polesZeros.normalizationFactor;
    let sd = response.instrumentSensitivity.sensitivity;
    let fs = response.instrumentSensitivity.frequency;
    sd *= Math.pow(2 * Math.PI * fs, gamma);
    let A0 = polesZeros.normalizationFactor;
    let fn = polesZeros.normalizationFrequency;
    A0 = A0 / Math.pow(2 * Math.PI * fn, gamma);
    if (polesZeros.pzTransferFunctionType === "LAPLACE (HERTZ)") {
        A0 *= Math.pow(2 * Math.PI, polesZeros.poles.length - polesZeros.zeros.length);
    }
    if (poles.length == 0 && zeros.length == 0) {
        constant = (sd * A0);
    } else {
        constant = (sd * calc_A0(poles, zeros, fs));
    }
    constant *= scaleUnit.scalar;
    return {
      poles:poles,
      zeros: zeros,
      constant: constant,
      toString: function() {
        let s = ["sacPoleZero:"];
        s.push("  poles: "+this.poles.length);
        for(let i=0; i<this.poles.length; i++ ) {
          s.push("    "+this.poles[i].real()+" "+this.poles[i].imag());
        }
        s.push("  zeros: "+this.zeros.length);
        for(let i=0; i<this.zeros.length; i++ ) {
          s.push("    "+this.zeros[i].real()+" "+this.zeros[i].imag());
        }
        s.push("  constant: "+this.constant);
        if (this.debug) {
          s.push("    gamma: "+this.debug.gamma);
          s.push("    mulFactor: "+this.debug.mulFactor);
          s.push("    sd: "+this.debug.sd);
          s.push("    A0: "+this.debug.A0);
        }
        return s.join('\n');
      },
      debug: {
        gamma: gamma,
        mulFactor: mulFactor,
        sd: sd,
        A0: A0
      }
    };
}

export function calc_A0(poles :Array<Complex>, zeros :Array<Complex>, ref_freq :number) {
    let numer = createComplex(1, 0);
    let denom = createComplex(1, 0);
    let f0;
    let a0;
    f0 = createComplex(0, 2 * Math.PI * ref_freq);
    for (let i = 0; i < zeros.length; i++) {
        denom = denom.timesComplex( f0.minusComplex(zeros[i]));
    }
    for (let i = 0; i < poles.length; i++) {
        numer = numer.timesComplex( f0.minusComplex(poles[i]));
    }
    a0 = numer.overComplex(denom).abs();
    return a0;
}
