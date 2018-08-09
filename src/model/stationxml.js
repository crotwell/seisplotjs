// @flow

import { checkStringOrDate, hasArgs, hasNoArgs, isStringArg, isNumArg } from './util';


// flow type for moment type
import { moment } from './util';
//import type { moment as momentType } from 'moment';
import type {ComplexType } from './util';



// StationXML classes

export class Network {
  /** @private */
  _networkCode: string;
    /** @private */
  _startDate: moment;
    /** @private */
  _endDate: moment;
    /** @private */
  _restrictedStatus: string;
    /** @private */
  _description: string;
    /** @private */
  _stations: Array<Station>;
  constructor(networkCode: string) {
    this.networkCode(networkCode);
    this._stations = [];
  }
  /** gets or sets the networkCode.
   *  @param value set the networkCode
   *  @returns Network if a value is passed in, networkCode if no arguments
  */
  networkCode(value?: string): string | Network {
    if (isStringArg(value)) {
      this._networkCode = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._networkCode;
    } else {
      throw new Error('value argument is optional or string, but was '+typeof value);
    }
  }

  /** gets or sets the startDate.
   *  @param value set the startDate
   *  @returns Network if a value is passed in, startDate if no arguments
  */
  startDate(value?: moment | string): moment | Network {
    if (hasNoArgs(value)) {
      return this._startDate;
    } else if (hasArgs(value)) {
      this._startDate = checkStringOrDate(value);
      return this;
    } else {
      throw new Error('value argument is optional or moment or string, but was '+typeof value);
    }
  }
  endDate(value?: moment): moment | Network {
    if (hasNoArgs(value)) {
      return this._endDate;
    } else if (hasArgs(value)) {
      this._endDate = checkStringOrDate(value);
      return this;
    } else {
      throw new Error('value argument is optional or moment or string, but was '+typeof value);
    }
  }
  restrictedStatus(value?: string): string | Network {
    if (isStringArg(value)) {
      this._restrictedStatus = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._restrictedStatus;
    } else {
      throw new Error('value argument is optional or string, but was '+typeof value);
    }
  }
  description(value?: string): string | Network {
    if (isStringArg(value)) {
      this._description = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._description;
    } else {
      throw new Error('value argument is optional or string, but was '+typeof value);
    }
  }
  stations(value?: Array<Station>): Array<Station> | Network {
    return (value instanceof Array) ? (this._stations = value, this) : this._stations;
  }
  codes(): string {
    return this._networkCode;
  }
  isTempNet(): boolean {
    const first = this._networkCode.charAt(0);
    return first === 'X' || first === 'Y' || first === 'Z' || (first >= '0' && first <= '9');
  }
}

export class Station {
    /** @private */
  _network: Network;
    /** @private */
  _stationCode: string;
    /** @private */
  _startDate: moment;
    /** @private */
  _endDate: moment;
    /** @private */
  _restrictedStatus: string;
    /** @private */
  _name: string;
    /** @private */
  _latitude: number;
    /** @private */
  _longitude: number;
    /** @private */
  _elevation: number;
    /** @private */
  _channels: Array<Channel>;
  constructor(network: Network, stationCode: string) {
    this._network = network;
    this._stationCode = stationCode;
    this._channels = [];
  }
  /** Gets or sets the network. */
  network(value?: Network): Network | Station {
    return (value instanceof Network) ? (this._network = value, this) : this._network;
  }
  stationCode(value?: string): string | Station {
    if (isStringArg(value)) {
      this._stationCode = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._stationCode;
    } else {
      throw new Error('value argument is optional or string, but was '+typeof value);
    }
  }
  startDate(value?: moment): moment | Station {
    if (hasNoArgs(value)) {
      return this._startDate;
    } else if (hasArgs(value)) {
      this._startDate = checkStringOrDate(value);
      return this;
    } else {
      throw new Error('value argument is optional or moment or string, but was '+typeof value);
    }
  }
  endDate(value?: moment): moment | Station {
    if (hasNoArgs(value)) {
      return this._endDate;
    } else if (hasArgs(value)) {
      this._endDate = checkStringOrDate(value);
      return this;
    } else {
      throw new Error('value argument is optional or moment or string, but was '+typeof value);
    }
  }
  restrictedStatus(value?: string): string | Station {
    if (isStringArg(value)) {
      this._restrictedStatus = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._restrictedStatus;
    } else {
      throw new Error('value argument is optional or string, but was '+typeof value);
    }
  }
  name(value?: string): string | Station {
    if (isStringArg(value)) {
      this._name = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._name;
    } else {
      throw new Error('value argument is optional or string, but was '+typeof value);
    }
  }
  latitude(value?: number): number | Station {
    if (isNumArg(value)) {
      this._latitude = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._latitude;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  longitude(value?: number): number | Station {
    if (isNumArg(value)) {
      this._longitude = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._longitude;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  elevation(value?: number): number | Station {
    if (isNumArg(value)) {
      this._elevation = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._elevation;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  channels(value?: Array<Channel>): Array<Channel> | Station {
    return (value instanceof Array) ? (this._channels = value, this) : this._channels;
  }
  codes():string {
    return this.network().codes()+"."+this._stationCode;
  }
}

export class Channel {
    /** @private */
  _station: Station;
    /** @private */
  _locationCode: string;
    /** @private */
  _channelCode: string;
    /** @private */
  _startDate: moment;
    /** @private */
  _endDate: moment;
    /** @private */
  _restrictedStatus: string;
    /** @private */
  _latitude: number;
    /** @private */
  _longitude: number;
    /** @private */
  _elevation: number;
    /** @private */
  _depth: number;
    /** @private */
  _azimuth: number;
    /** @private */
  _dip: number;
    /** @private */
  _sampleRate: number;
    /** @private */
  _response: Response;
  constructor(station: Station, channelCode: string, locationCode: string) {
    this._station = station;
    this._channelCode = channelCode;
    this._locationCode = locationCode;
    if (! locationCode) {
      // make sure "null" is encoded as empty string
      this._locationCode = '';
    }
  }
  station(value?: Station): Station | Channel {
    return (value instanceof Station) ? (this._station = value, this) : this._station;
  }
  channelCode(value?: string): string | Channel {
    if (isStringArg(value)) {
      this._channelCode = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._channelCode;
    } else {
      throw new Error('value argument is optional or string, but was '+typeof value);
    }
  }
  locationCode(value?: string): string | Channel {
    if (isStringArg(value)) {
      this._locationCode = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._locationCode;
    } else {
      throw new Error('value argument is optional or string, but was '+typeof value);
    }
  }
  locationId(value?: string): string | Channel {
    return this.locationCode(value);
  }
  startDate(value: moment): moment | Channel {
    if (hasNoArgs(value)) {
      return this._startDate;
    } else if (hasArgs(value)) {
      this._startDate = checkStringOrDate(value);
      return this;
    } else {
      throw new Error('value argument is optional or moment or string, but was '+typeof value);
    }
  }
  endDate(value: moment): moment | Channel {
    if (hasNoArgs(value)) {
      return this._endDate;
    } else if (hasArgs(value)) {
      this._endDate = checkStringOrDate(value);
      return this;
    } else {
      throw new Error('value argument is optional or moment or string, but was '+typeof value);
    }
  }
  restrictedStatus(value?: string): string | Channel {
    if (isStringArg(value)) {
      this._restrictedStatus = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._restrictedStatus;
    } else {
      throw new Error('value argument is optional or string, but was '+typeof value);
    }
  }
  latitude(value?: number): number | Channel {
    if (isNumArg(value)) {
      this._latitude = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._latitude;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  longitude(value?: number): number | Channel {
    if (isNumArg(value)) {
      this._longitude = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._longitude;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  elevation(value?: number): number | Channel {
    if (isNumArg(value)) {
      this._elevation = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._elevation;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  depth(value?: number): number | Channel {
    if (isNumArg(value)) {
      this._depth = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._depth;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  azimuth(value?: number): number | Channel {
    if (isNumArg(value)) {
      this._azimuth = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._azimuth;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  dip(value?: number): number | Channel {
    if (isNumArg(value)) {
      this._dip = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._dip;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  sampleRate(value?: number): number | Channel {
    if (isNumArg(value)) {
      this._sampleRate = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._sampleRate;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  instrumentSensitivity(value: InstrumentSensitivity): InstrumentSensitivity | Channel {
    if (value instanceof InstrumentSensitivity) {
      // setter
      if (typeof this._response == 'undefined') {
        this._response = new Response(value);
      } else {
        this._response._instrumentSensitivity = value;
      }
      return this;
    } else {
      if (this._response) {
        return this._response._instrumentSensitivity;
      } else {
        throw new Error("no Response or InstrumentSensitivity defined");
      }
    }
  }
  response(value: Response): Response | Channel {
    return (value instanceof Response) ? (this._response = value, this) : this._response;
  }

  codes(): string {
    return this.station().codes()+"."+this._locationCode+"."+this._channelCode;
  }
}

export class InstrumentSensitivity {
    /** @private */
  _sensitivity: number;
    /** @private */
  _frequency: number;
    /** @private */
  _inputUnits: string;
    /** @private */
  _outputUnits: string;
  constructor(sensitivity: number, frequency: number, inputUnits: string, outputUnits: string) {
    this._sensitivity = sensitivity;
    this._frequency = frequency;
    this._inputUnits = inputUnits;
    this._outputUnits = outputUnits;
  }
  sensitivity(value?: number): number | InstrumentSensitivity {
    if (isNumArg(value)) {
      this._sensitivity = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._sensitivity;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  frequency(value?: number): number | InstrumentSensitivity {
    if (isNumArg(value)) {
      this._frequency = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._frequency;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  inputUnits(value?: string): string | InstrumentSensitivity {
    if (isStringArg(value)) {
      this._inputUnits = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._inputUnits;
    } else {
      throw new Error('value argument is optional or string, but was '+typeof value);
    }
  }
  outputUnits(value?: string): string | InstrumentSensitivity {
    if (isStringArg(value)) {
      this._outputUnits = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._outputUnits;
    } else {
      throw new Error('value argument is optional or string, but was '+typeof value);
    }
  }

}

export class Response {
    /** @private */
  _instrumentSensitivity: InstrumentSensitivity;
    /** @private */
  _stages: Array<Stage>;
  constructor(instrumentSensitivity?: InstrumentSensitivity, stages?: Array<Stage>) {
    if (instrumentSensitivity) {
      this._instrumentSensitivity = instrumentSensitivity;
    }
    if (stages) {
      this._stages = stages;
    }
  }
  instrumentSensitivity(value?: InstrumentSensitivity) {
    return (value instanceof InstrumentSensitivity) ? (this._instrumentSensitivity = value, this) : this._instrumentSensitivity;
  }
  stages(value?: Array<Stage>) {
    return (value instanceof Array) ? (this._stages = value, this) : this._stages;
  }
}

export class Stage {
    /** @private */
  _filter: AbstractFilterType;
    /** @private */
  _decimation: Decimation | null;
    /** @private */
  _gain: Gain;
  constructor(filter: AbstractFilterType, decimation: Decimation | null, gain: Gain) {
    this._filter = filter;
    this._decimation = decimation;
    this._gain = gain;
  }
  filter(value?: AbstractFilterType) {
    return (value instanceof AbstractFilterType) ? (this._filter = value, this) : this._filter;
  }
  decimation(value?: Decimation) {
    return (value instanceof Decimation) ? (this._decimation = value, this) : this._decimation;
  }
  gain(value?: Gain) {
    return (value instanceof Gain) ? (this._gain = value, this) : this._gain;
  }
}

export class AbstractFilterType {
    /** @private */
  _inputUnits: string;
    /** @private */
  _outputUnits: string;
    /** @private */
  _name: string;
    /** @private */
  _description: string;
  constructor(inputUnits: string, outputUnits: string) {
    this._inputUnits = inputUnits;
    this._outputUnits = outputUnits;
  }
  name(value?: string) {
    if (isStringArg(value)) {
      this._name = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._name;
    } else {
      throw new Error('value argument is optional or string, but was '+typeof value);
    }
  }
  description(value?: string) {
    if (isStringArg(value)) {
      this._description = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._description;
    } else {
      throw new Error('value argument is optional or string, but was '+typeof value);
    }
  }
  inputUnits(value?: string) {
    if (isStringArg(value)) {
      this._inputUnits = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._inputUnits;
    } else {
      throw new Error('value argument is optional or string, but was '+typeof value);
    }
  }
  outputUnits(value?: string) {
    if (isStringArg(value)) {
      this._outputUnits = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._outputUnits;
    } else {
      throw new Error('value argument is optional or string, but was '+typeof value);
    }
  }
}
export class PolesZeros extends AbstractFilterType {
    /** @private */
  _pzTransferFunctionType: string;
    /** @private */
  _normalizationFactor: number;
    /** @private */
  _normalizationFrequency: number;
    /** @private */
  _zeros: Array<ComplexType>;
    /** @private */
  _poles: Array<ComplexType>;
  constructor(inputUnits: string, outputUnits: string) {
    super(inputUnits, outputUnits);
  }
  pzTransferFunctionType(value?: string) {
    if (isStringArg(value)) {
      this._pzTransferFunctionType = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._pzTransferFunctionType;
    } else {
      throw new Error('value argument is optional or string, but was '+typeof value);
    }
  }
  normalizationFactor(value?: number) {
    if (isNumArg(value)) {
      this._normalizationFactor = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._normalizationFactor;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  normalizationFrequency(value?: number) {
    if (isNumArg(value)) {
      this._normalizationFrequency = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._normalizationFrequency;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  zeros(value: Array<ComplexType>) {
    return (value instanceof Array) ? (this._zeros = value, this) : this._zeros;
  }
  poles(value: Array<ComplexType>) {
    return (value instanceof Array) ? (this._poles = value, this) : this._poles;
  }
}

export class FIR extends AbstractFilterType {
  /** @private */
  _symmetry: string;
    /** @private */
  _numerator: Array<number>;
  constructor(inputUnits: string, outputUnits: string) {
    super(inputUnits, outputUnits);
  }
  symmetry(value?: string) {
    if (isStringArg(value)) {
      this._symmetry = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._symmetry;
    } else {
      throw new Error('value argument is optional or string, but was '+typeof value);
    }
  }
  numerator(value: Array<number>) {
    return arguments.length ? (this._numerator = value, this) : this._numerator;
  }
}

export class CoefficientsFilter extends AbstractFilterType {
  /** @private */
  _cfTransferFunction: string;
  /** @private */
  _numerator: Array<number>;
  /** @private */
  _denominator: Array<number>;
  constructor(inputUnits: string, outputUnits: string) {
    super(inputUnits, outputUnits);
  }
  cfTransferFunction(value?: string) {
    if (isStringArg(value)) {
      this._cfTransferFunction = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._cfTransferFunction;
    } else {
      throw new Error('value argument is optional or string, but was '+typeof value);
    }
  }
  numerator(value: Array<number>) {
    return arguments.length ? (this._numerator= value, this) : this._numerator;
  }
  denominator(value: Array<number>) {
    return arguments.length ? (this._denominator= value, this) : this._denominator;
  }
}

export class Decimation {
  /** @private */
  _inputSampleRate: number;
  /** @private */
  _factor: number;
  /** @private */
  _offset: number;
  /** @private */
  _delay: number;
  /** @private */
  _correction: number;
  inputSampleRate(value?: number) {
    if (isNumArg(value)) {
      this._inputSampleRate = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._inputSampleRate;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  factor(value?: number) {
    if (isNumArg(value)) {
      this._factor = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._factor;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  offset(value?: number) {
    if (isNumArg(value)) {
      this._offset = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._offset;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  delay(value?: number) {
    if (isNumArg(value)) {
      this._delay = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._delay;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  correction(value?: number) {
    if (isNumArg(value)) {
      this._correction = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._correction;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
}

export class Gain {
  /** @private */
  _value: number;
  /** @private */
  _frequency: number;
  value(value?: number) {
    if (isNumArg(value)) {
      this._value = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._value;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  frequency(value?: number) {
    if (isNumArg(value)) {
      this._frequency = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._frequency;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }

}
