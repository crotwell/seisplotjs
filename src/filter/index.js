// @flow

import * as OregonDSPTop from 'oregondsp';

import {Seismogram} from '../seismogram.js';
import {InstrumentSensitivity} from '../stationxml.js';

import * as transfer  from './transfer.js';
import {hilbert, envelope} from './hilbert.js';
import {calcDFT, inverseDFT, fftForward, FFTResult} from './fft.js';

import {Complex, createComplex} from './filterUtil.js';

let OregonDSP = OregonDSPTop.com.oregondsp.signalProcessing;

export { OregonDSP, Complex, createComplex,
  transfer, hilbert, envelope,
  calcDFT, inverseDFT, fftForward, FFTResult
   };
