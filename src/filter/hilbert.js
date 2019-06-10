//@flow

import * as OregonDSPTop from 'oregondsp';
const OregonDSP = OregonDSPTop.com.oregondsp.signalProcessing;
import {createComplex, Complex } from './transfer';
import {Seismogram, Trace} from '../seismogram';

/** Calculates the envelope, y_i = sqrt( y_i * y_i + h_i * h_i)
 *  where h is the hilber transform of y. The default configuration
 *  for the hilbet transform is n=100, lowEdge=.05 and highEdge = 0.95
 */
export function envelope(seis: Seismogram): Seismogram {
  let s = hilbert(seis);
  for(let n=0; n<s.y.length; n++) {
    s.y[n] = Math.sqrt(s.y[n]*s.y[n] + seis.y[n]*seis.y[n]);
  }
  return s;
}

/** Calculates the hilbert transform using the OregonDSP library
 *  with default number of points, n=100 (to yield a 201 pt FIR transform)
 *  and default low and high edge of 0.05 and 0.95. Low and high edge are
 *  given normalized 0 to 1.
 */
export function hilbert(seis: Seismogram, n?: number, lowEdge?: number, highEdge?: number ): Seismogram {
  if (! n) { n = 100;}
  if (! lowEdge) { lowEdge = .05;}
  if (! highEdge) { highEdge = .95;}
  let hilbert = new OregonDSP.filter.fir.equiripple.CenteredHilbertTransform(100, .2, .8);
  let s = seis.clone();
  s.y = hilbert.filter(s.y);
  return s;
}
