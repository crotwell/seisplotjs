// @flow


import * as OregonDSPTop from 'oregondsp';

const OregonDSP = OregonDSPTop.com.oregondsp.signalProcessing;
const CenteredHilbertTransform = OregonDSP.filter.fir.equiripple.CenteredHilbertTransform;
export const Complex = OregonDSP.filter.iir.Complex;

export function createComplex(real: number, imag: number) {
  return OregonDSP.filter.iir.Complex_init(real, imag);
}


export let BAND_PASS = OregonDSP.filter.iir.PassbandType.BANDPASS;
export let LOW_PASS = OregonDSP.filter.iir.PassbandType.LOWPASS;
export let HIGH_PASS = OregonDSP.filter.iir.PassbandType.HIGHPASS;

export function amplitude(real: number, imag: number) {
  return Math.hypot(real, imag);
}

export function rMean(seis: Seismogram): Seismogram {
  console.log(`rMean input class is: ${(seis.constructor.name)}`);
  if (seis instanceof Seismogram) {
    let meanVal = mean(seis);
    let rmeanSeismogram = new Seismogram(seis.segments.map(s =>{
        let demeanY = s.y.map(function(d) {
          return d-meanVal;
        });
        let out = s.cloneWithNewData(demeanY);
        return out;
      }));
    return rmeanSeismogram;
  } else {
    throw new Error("rMean arg not a Seismogram");
  }
}

export function gainCorrect(instrumentSensitivity: InstrumentSensitivity, seis: Seismogram): Seismogram {
  if (seis instanceof Seismogram) {
    let gain = instrumentSensitivity.sensitivity;
    let gainSeismogram = new Seismogram(seis.segments.map(s =>{
      let gainY = s.y.map(function(d) {
        return d/gain;
      });
      let outS = s.cloneWithNewData(gainY);
      outS.yUnit = instrumentSensitivity.inputUnits;
      return outS;
      }));
    return gainSeismogram;
  } else {
      throw new Error(`Expected Seismogram but was ${typeof seis}`);
  }
}

export type MinMaxMean = {
  min: number;
  max: number;
  mean: number;
};

export function minMaxMean(seis: Seismogram): MinMaxMean {
  let meanVal = 0;
  let minVal = 9999999999;
  let maxVal = -9999999999;
  if (seis instanceof Seismogram) {
    for (let s of seis.segments) {
      minVal = s.y.reduce((acc, val) => {return Math.min(acc, val);}, minVal);
      maxVal = s.y.reduce((acc, val) => {return Math.max(acc, val);}, maxVal);
    }
    meanVal = mean(seis);
  } else {
    throw new Error("seis not instance of Seismogram");
  }
  return {
    min: minVal,
    max: maxVal,
    mean: meanVal
  };
}
export function mean(seis: Seismogram): number {
  if (seis instanceof Seismogram) {
    let meanVal = 0;

    let npts = seis.numPoints;
    for (let s of seis.segments) {
      meanVal += meanOfSlice(s.y, s.y.length)*s.numPoints;
    }
    meanVal = meanVal / npts;
    return meanVal;
  } else {
    throw new Error("seis not instance of Seismogram "+(typeof seis)+" "+(seis.constructor.name));
  }
}

function meanOfSlice(dataSlice: Int32Array | Float32Array | Float64Array, totalPts: number ): number {
  if (dataSlice.length < 8) {
    return dataSlice.reduce(function(acc, val) {
       return acc + val;
    }, 0) / totalPts;
  } else {
    let byTwo = Math.floor(dataSlice.length / 2);
    return meanOfSlice(dataSlice.slice(0, byTwo), totalPts) + meanOfSlice(dataSlice.slice(byTwo, dataSlice.length), totalPts);
  }
}


export function createButterworth(numPoles: number,
                                  passband: string,
                                  lowFreqCorner: number,
                                  highFreqCorner: number,
                                  delta: number) {
  return new OregonDSP.filter.iir.Butterworth(numPoles,
                                     passband,
                                     lowFreqCorner,
                                     highFreqCorner,
                                     delta);
}

export function createChebyshevI(numPoles: number,
                                  epsilon: number,
                                  passband: string,
                                  lowFreqCorner: number,
                                  highFreqCorner: number,
                                  delta: number) {
  return new OregonDSP.filter.iir.ChebyshevI(numPoles,
                                    epsilon,
                                    passband,
                                    lowFreqCorner,
                                    highFreqCorner,
                                    delta);
}

export function createChebyshevII(numPoles: number,
                                  epsilon: number,
                                  passband: string,
                                  lowFreqCorner: number,
                                  highFreqCorner: number,
                                  delta: number) {
  return new OregonDSP.filter.iir.ChebyshevII(numPoles,
                                     epsilon,
                                     passband,
                                     lowFreqCorner,
                                     highFreqCorner,
                                     delta);
}


/** Calculates the envelope, y_i = sqrt( y_i * y_i + h_i * h_i)
 *  where h is the hilber transform of y. The default configuration
 *  for the hilbet transform is n=100, lowEdge=.05 and highEdge = 0.95
 */
export function envelope(seis: Seismogram): Seismogram {
  if (seis.isContiguous()) {
    let seisY = seis.merge();
    let s = hilbert(seis);
    let hilbertY = s.y;
    let out = seisY.slice();
    for(let n=0; n<seisY.length; n++) {
      out[n] = Math.sqrt(hilbertY[n]*hilbertY[n] + seisY[n]*seisY[n]);
    }
    return seis.cloneWithNewData(out);
  } else {
    throw new Error("Cannot take envelope of non-contiguous seismogram");
  }
}

/** Calculates the hilbert transform using the OregonDSP library
 *  with default number of points, n=10 (to yield a 21 pt FIR transform)
 *  and default low and high edge of 0.05 and 0.95. Low and high edge are
 *  given normalized 0 to 1.
 */
export function hilbert(seis: Seismogram, n?: number, lowEdge?: number, highEdge?: number ): Seismogram {
  if (seis.isContiguous()) {
    let seisY = seis.y;
    if (! n) { n = 10;}
    if (! lowEdge) { lowEdge = .05;}
    if (! highEdge) { highEdge = .95;}
    console.log(`hilbert: ${n}  ${lowEdge}  ${highEdge}`);
    let hilbert = new CenteredHilbertTransform(n, lowEdge, highEdge);
    let coeff = hilbert.getCoefficients();
    for (let c of coeff) {
      console.log(`coeff: ${c}`);
      if ( Number.isNaN(c)) {
        throw new Error("Hilbert FIR coeff includes NaN: ${coeff.join()}");
      }
    }
    let hilbertY = hilbert.filter(seisY);
    let s = seis.cloneWithNewData(hilbertY);
    return s;
  } else {
    throw new Error("Cannot take hilbert of non-contiguous seismogram");
  }
}
