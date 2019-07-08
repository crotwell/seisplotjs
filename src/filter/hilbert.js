//@flow

import * as OregonDSPTop from 'oregondsp';
const OregonDSP = OregonDSPTop.com.oregondsp.signalProcessing;
const CenteredHilbertTransform = OregonDSP.filter.fir.equiripple.CenteredHilbertTransform;
import {Seismogram } from '../seismogram';

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
