//@flow

import * as OregonDSPTop from 'oregondsp';
const OregonDSP = OregonDSPTop.com.oregondsp.signalProcessing;
const CenteredHilbertTransform = OregonDSP.filter.fir.equiripple.CenteredHilbertTransform;
import {Seismogram } from '../seismogram';
