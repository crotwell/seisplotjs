/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */
import {Duration} from "luxon";
import {Seismogram} from "./seismogram";
import {InstrumentSensitivity} from "./stationxml";
import {
  Butterworth,
  ChebyshevI,
  ChebyshevII,
  PassbandType,
  IIRFilter,
  CenteredHilbertTransform,
  LOWPASS, BANDPASS, HIGHPASS
} from "./oregondsputil";
import {isDef} from "./util";

/**
 * Constant for bandpass OregonDSP filter creation.
 */
export const BAND_PASS = 'BANDPASS';

/**
 * Constant for lowpass OregonDSP filter creation.
 */
export const LOW_PASS = "LOWPASS";

/**
 * Constant for highpass OregonDSP filter creation.
 */
export const HIGH_PASS = "HIGHPASS";

export function amplitude(real: number, imag: number): number {
  return Math.hypot(real, imag);
}

/**
 * Remove the mean from a seismogram. Subtract the mean from each data point.
 *
 * @param   seis input seismogram
 * @returns       seismogram with mean of zero
 */
export function rMean(seis: Seismogram): Seismogram {
  if (seis instanceof Seismogram) {
    const meanVal = seis.mean();
    const rmeanSeismogram = new Seismogram(
      seis.segments.map(s => {
        const demeanY = s.y.map(function (d) {
          return d - meanVal;
        });
        const out = s.cloneWithNewData(demeanY);
        return out;
      }),
    );
    return rmeanSeismogram;
  } else {
    throw new Error("rMean arg not a Seismogram");
  }
}

/**
 * Apply the frequency independent overall gain to a seismogram. This does not
 * do a full transfer using poles and zero, this only applies the scalar conversion
 * factor to convert counts back to original real world units and update the units.
 *
 * @param   seis                  the seismogram to correct
 * @param   instrumentSensitivity overall gain object, usually pulled from stationxml
 * @returns                        new seismogram with original units, like m/s and gain applied.
 */
export function gainCorrect(
  seis: Seismogram,
  instrumentSensitivity: InstrumentSensitivity,
): Seismogram {
  if (seis instanceof Seismogram) {
    const gain = instrumentSensitivity.sensitivity;
    const gainSeismogram = new Seismogram(
      seis.segments.map(s => {
        let gainY;

        if (s.y instanceof Int32Array || s.y instanceof Float32Array) {
          gainY = Float32Array.from(s.y);
        } else {
          gainY = Float64Array.from(s.y);
        }

        gainY = gainY.map(function (d) {
          return d / gain;
        });
        const outS = s.cloneWithNewData(gainY);
        outS.yUnit = instrumentSensitivity.inputUnits;
        return outS;
      }),
    );
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

export function getPassband(type: string): (typeof LOWPASS | typeof BANDPASS | typeof HIGHPASS) {
  if (type === LOW_PASS) {
    return LOWPASS;
  } else if (type === BAND_PASS) {
    return PassbandType.BANDPASS;
  } else if (type === HIGH_PASS) {
    return PassbandType.HIGHPASS;
  } else {
    throw new Error(`unknown pass band: ${type}`);
  }
}
/**
 * Creates a Butterworth IIR filter using the OregonDSP library.
 *
 * @param   numPoles       number of poles
 * @param   passband       type, use constants of BAND_PASS, LOW_PASS, HIGH_PASS
 * @param   lowFreqCorner  low corner frequency
 * @param   highFreqCorner high corner frequency
 * @param   delta          delta, period, of timeseries
 * @returns                 Butterworth IIR filter
 */
export function createButterworth(
  numPoles: number,
  passband: string,
  lowFreqCorner: number,
  highFreqCorner: number,
  delta: number,
): InstanceType<typeof Butterworth> {
  const passbandtype = getPassband(passband);
  return new Butterworth(
    numPoles,
    passbandtype,
    lowFreqCorner,
    highFreqCorner,
    delta,
  );
}

/**
 * Creates a Chebyshev I IIR filter using the OregonDSP library.
 *
 * @param   numPoles       number of poles
 * @param   epsilon        Chebyshev epsilon value
 * @param   passband       type, use constants of BAND_PASS, LOW_PASS, HIGH_PASS
 * @param   lowFreqCorner  low corner frequency
 * @param   highFreqCorner high corner frequency
 * @param   delta          delta, period, of timeseries
 * @returns                 Chebyshev I IIR filter
 */
export function createChebyshevI(
  numPoles: number,
  epsilon: number,
  passband: string,
  lowFreqCorner: number,
  highFreqCorner: number,
  delta: number,
): InstanceType<typeof ChebyshevI> {
  const passbandtype = getPassband(passband);
  return new ChebyshevI(
    numPoles,
    epsilon,
    passbandtype,
    lowFreqCorner,
    highFreqCorner,
    delta,
  );
}

/**
 * Creates a Chebyshev II IIR filter using the OregonDSP library.
 *
 * @param   numPoles       number of poles
 * @param   epsilon        Chebyshev epsilon value
 * @param   passband       type, use constants of BAND_PASS, LOW_PASS, HIGH_PASS
 * @param   lowFreqCorner  low corner frequency
 * @param   highFreqCorner high corner frequency
 * @param   delta          delta, period, of timeseries
 * @returns                 Chebyshev II IIR filter
 */
export function createChebyshevII(
  numPoles: number,
  epsilon: number,
  passband: string,
  lowFreqCorner: number,
  highFreqCorner: number,
  delta: number,
): InstanceType<typeof ChebyshevII> {
  const passbandtype = getPassband(passband);
  return new ChebyshevII(
    numPoles,
    epsilon,
    passbandtype,
    lowFreqCorner,
    highFreqCorner,
    delta,
  );
}

/**
 * Applies the filter to the given seismogram.
 *
 * @param   iirFilter filter to apply
 * @param   seis      seismogram to apply filter to
 * @returns            filtered seismogram
 */
export function applyFilter(
  iirFilter: InstanceType<typeof IIRFilter>,
  seis: Seismogram,
): Seismogram {
  // check delta and samplePeriod with 0.1% of each other
  if (Math.abs(iirFilter.getDelta() - seis.samplePeriod)/seis.samplePeriod > 0.001) {
    throw new Error(`Filter, delta=${iirFilter.getDelta()}, has different delta from seis, ${1/seis.sampleRate}`);
  }
  const filteredSegments = [];

  for (let i = 0; i < seis.segments.length; i++) {
    const outData = Float32Array.from(seis.segments[i].y);
    iirFilter.filterInPlace(outData);
    filteredSegments.push(seis.segments[i].cloneWithNewData(outData));
  }

  return new Seismogram(filteredSegments);
}

/**
 * Calculates the envelope, y_i = sqrt( y_i * y_i + h_i * h_i)
 *  where h is the hilber transform of y. The default configuration
 *  for the hilbet transform is n=100, lowEdge=.05 and highEdge = 0.95
 *
 * @param seis seismogram to apply envelope to
 * @returns seismogram cloned but with data as the envelope
 */
export function envelope(seis: Seismogram): Seismogram {
  if (seis.isContiguous()) {
    const seisY = seis.y;
    const s = hilbert(seis);
    const hilbertY = s.y;
    let outY;

    if (seis.y instanceof Int32Array || seis.y instanceof Float32Array) {
      outY = new Float32Array(seisY.length);
    } else {
      outY = new Float64Array(seisY.length);
    }

    for (let n = 0; n < seisY.length; n++) {
      outY[n] = Math.sqrt(hilbertY[n] * hilbertY[n] + seisY[n] * seisY[n]);
    }

    return seis.cloneWithNewData(outY);
  } else {
    throw new Error("Cannot take envelope of non-contiguous seismogram");
  }
}

/**
 * Calculates the hilbert transform using the OregonDSP library
 *  with default number of points, n=10 (to yield a 21 pt FIR transform)
 *  and default low and high edge of 0.05 and 0.95. Low and high edge are
 *  given normalized 0 to 1.
 *
 * Note this uses Float32Array, other array types will be converted,
 * possibly losing precision.
 *
 * @param seis seismogram to calculate from
 * @param n optional number of points in transform, default is 10
 * @param lowEdge low edge of filter, normailized to 0-1, default is 0.05
 * @param highEdge high edge of filter, normailized to 0-1, default is 0.95
 * @returns hilbert transformed data
 */
export function hilbert(
  seis: Seismogram,
  n?: number,
  lowEdge?: number,
  highEdge?: number,
): Seismogram {
  if (seis.isContiguous()) {
    let seisY: Float32Array;
    if (seis.y instanceof Float32Array){
      seisY = seis.y;
    } else {
      seisY = Float32Array.from(seis.y);
    }

    if (!isDef(n)) {
      n = 10;
    }

    if (!isDef(lowEdge)) {
      lowEdge = 0.05;
    }

    if (!isDef(highEdge)) {
      highEdge = 0.95;
    }

    const hilbert = new CenteredHilbertTransform(n, lowEdge, highEdge);

    const coeff = hilbert.getCoefficients();

    for (const c of coeff) {
      if (Number.isNaN(c)) {
        throw new Error(`Hilbert FIR coeff includes NaN: ${coeff.join()}`);
      }
    }

    const hilbertY = hilbert.filter(seisY);
    const s = seis.cloneWithNewData(hilbertY);
    return s;
  } else {
    throw new Error("Cannot take hilbert of non-contiguous seismogram");
  }
}

/**
 * Differentiate a seismogram.
 *
 * @param   seis input seismogram
 * @returns       differentiated seismogram
 */
export function differentiate(seis: Seismogram): Seismogram {
  if (seis instanceof Seismogram) {
    const diffSeismogram = new Seismogram(
      seis.segments.map(s => {
        const origY = s.y;
        const sampRate = 1.0 * s.sampleRate; // same as 1/delta

        const diffY = new Float32Array(origY.length - 1);

        for (let i = 0; i < diffY.length; i++) {
          diffY[i] = (origY[i + 1] - origY[i]) * sampRate;
        }

        const out = s.cloneWithNewData(diffY);
        out.startTime = out.startTime.plus(Duration.fromMillis(1000 / out.sampleRate / 2));// second
        out.yUnit = out.yUnit + "/s";
        return out;
      }),
    );
    return diffSeismogram;
  } else {
    throw new Error("diff arg not a Seismogram");
  }
}
