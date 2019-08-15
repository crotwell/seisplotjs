// @flow
import {Seismogram } from './seismogram.js';

export function taper(seis: Seismogram, width: number = 0.05, taperType: string = HANNING): Seismogram {
  if (width > 0.5) {
    throw new Error("Taper width cannot be larger than 0.5, width="+width);
  }
  if (seis.isContiguous()) {
    let data = seis.y;
    let outData = Float32Array.from(data);
    let w = Math.floor(data.length * width);
    let coeff = getCoefficients(taperType, w);
    const omega = coeff[0];
    const f0 = coeff[1];
    const f1 = coeff[2];
    for(let i = 0; i < w; i++) {
      const taperFactor = (f0 - f1 * Math.cos(omega * i));
      outData[i] = outData[i] * taperFactor;
      outData[outData.length - i - 1] = outData[outData.length - i - 1] * taperFactor;
    }
    return seis.cloneWithNewData(outData);
  } else {
    throw new Error("Cannot take taper of non-contiguous seismogram");
  }
}


/**
 * Calculates the coefficients for tapering, [omega, f0, f1]
 */
export function getCoefficients(type: string, length: number ): Array<number> {
  let omega, f0, f1;
  if(type === HANNING) {
      omega = Math.PI / length;
      f0 = .5;
      f1 = .5;
  } else if(type === HAMMING) {
      omega = Math.PI / length;
      f0 = .54;
      f1 = .46;
  } else {
      // cosine
      omega = Math.PI / 2 / length;
      f0 = 1;
      f1 = 1;
  }
  return [ omega, f0, f1 ];
}

export const HANNING = "HANNING";
export const HAMMING = "HAMMING";
export const COSINE = "COSINE";
