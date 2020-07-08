// @flow

/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */

import { StartEndDuration, isObject, isDef, isStringArg, isNonEmptyStringArg,
         isNumArg, checkStringOrDate, stringify} from './util';
import {Complex, createComplex} from './oregondsputil.js';

import moment from 'moment';

/** xml namespace for stationxml */
export const STAML_NS = 'http://www.fdsn.org/xml/station/1';


// StationXML classes

export class Network {
  networkCode: string;
  _startDate: moment;
  _endDate: moment;
  restrictedStatus: string;
  description: string;
  totalNumberStations: number;
  stations: Array<Station>;
  constructor(networkCode: string) {
    this.networkCode = networkCode;
    this.stations = [];
  }
  get startDate() {
    return this._startDate;
  }
  set startDate(value?: moment | string) {
    this._startDate = checkStringOrDate(value);
  }
  get endDate() {
    return this._endDate;
  }
  set endDate(value?: moment | string) {
    this._endDate = checkStringOrDate(value);
  }
  get timeRange(): StartEndDuration {
    return new StartEndDuration(this.startDate, this.endDate);
  }
  codes(): string {
    return this.networkCode;
  }
  isTempNet(): boolean {
    const first = this.networkCode.charAt(0);
    return first === 'X' || first === 'Y' || first === 'Z' || (first >= '0' && first <= '9');
  }
}

export class Station {
  network: Network;
  stationCode: string;
    /** @private */
  _startDate: moment;
    /** @private */
  _endDate: moment;
  restrictedStatus: string;
  name: string;
  latitude: number;
  longitude: number;
  elevation: number;
  channels: Array<Channel>;
  constructor(network: Network, stationCode: string) {
    this.network = network;
    this.stationCode = stationCode;
    this.channels = [];
  }
  get startDate(): moment {
    return this._startDate;
  }
  set startDate(value?: moment | string) {
    this._startDate = checkStringOrDate(value);
  }
  get endDate(): moment {
    return this._endDate;
  }
  set endDate(value?: moment | string) {
    this._endDate = checkStringOrDate(value);
  }
  get timeRange(): StartEndDuration {
    return new StartEndDuration(this.startDate, this.endDate);
  }
  get networkCode(): string {
    return this.network.networkCode;
  }
  codes(): string {
    return this.network.codes()+"."+this.stationCode;
  }
}

export class Channel {
  station: Station;
    /** @private */
  _locationCode: string;
  channelCode: string;
    /** @private */
  _startDate: moment;
    /** @private */
  _endDate: moment;
  restrictedStatus: string;
  latitude: number;
  longitude: number;
  elevation: number;
  depth: number;
  azimuth: number;
  dip: number;
  sampleRate: number;
  response: Response;
  constructor(station: Station, channelCode: string, locationCode: string) {
    this.station = station;
    if (channelCode.length !== 3) {
      throw new Error(`Channel code must be 3 chars: ${channelCode}`);
    }
    this.channelCode = channelCode;
    this.locationCode = locationCode;
    if (! locationCode) {
      // make sure "null" is encoded as empty string
      this.locationCode = '';
    }
    if ( ! (this.locationCode.length === 2 || this.locationCode.length === 0)) {
      throw new Error(`locationCode must be 2 chars, or empty: "${locationCode}"`);
    }
  }
  get startDate() {
    return this._startDate;
  }
  set startDate(value?: moment | string) {
    this._startDate = checkStringOrDate(value);
  }
  get endDate() {
    return this._endDate;
  }
  set endDate(value?: moment | string) {
    this._endDate = checkStringOrDate(value);
  }
  get timeRange(): StartEndDuration {
    return new StartEndDuration(this.startDate, this.endDate);
  }
  get locationCode() {
    return this._locationCode;
  }
  set locationCode(value: string) {
    this._locationCode = value;
    if (! value) {
      // make sure "null" is encoded as empty string
      this._locationCode = '';
    }
  }
  get stationCode(): string {
    return this.station.stationCode;
  }
  get networkCode(): string {
    return this.station.networkCode;
  }
  /**
   * Checks if this channel has sensitivity defined, within the response.
   *
   * @returns          true if instrumentSensitivity exits
   */
  hasInstrumentSensitivity(): boolean {
    return isDef(this.response) && isDef(this.response.instrumentSensitivity);
  }
  set instrumentSensitivity(value: InstrumentSensitivity) {
    if (typeof this.response === 'undefined') {
      this.response = new Response(value);
    } else {
      this.response.instrumentSensitivity = value;
    }
  }
  get instrumentSensitivity(): InstrumentSensitivity {
    if (this.response) {
      return this.response.instrumentSensitivity;
    } else {
      throw new Error("no Response or InstrumentSensitivity defined");
    }
  }

  codes(): string {
    return this.station.codes()+"."+this.locationCode+"."+this.channelCode;
  }
}

export class InstrumentSensitivity {
  sensitivity: number;
  frequency: number;
  inputUnits: string;
  outputUnits: string;
  constructor(sensitivity: number, frequency: number, inputUnits: string, outputUnits: string) {
    this.sensitivity = sensitivity;
    this.frequency = frequency;
    this.inputUnits = inputUnits;
    this.outputUnits = outputUnits;
  }
}

export class Response {
  instrumentSensitivity: InstrumentSensitivity;
  stages: Array<Stage>;
  constructor(instrumentSensitivity?: InstrumentSensitivity, stages?: Array<Stage>) {
    if (instrumentSensitivity) {
      this.instrumentSensitivity = instrumentSensitivity;
    }
    if (stages) {
      this.stages = stages;
    }
  }
}

export class Stage {
  filter: AbstractFilterType | null;
  decimation: Decimation | null;
  gain: Gain;
  constructor(filter: AbstractFilterType | null, decimation: Decimation | null, gain: Gain) {
    this.filter = filter;
    this.decimation = decimation;
    this.gain = gain;
  }
}

export class AbstractFilterType {
  inputUnits: string;
  outputUnits: string;
  name: string;
  description: string;
  constructor(inputUnits: string, outputUnits: string) {
    this.inputUnits = inputUnits;
    this.outputUnits = outputUnits;
  }
}
export class PolesZeros extends AbstractFilterType {
  pzTransferFunctionType: string;
  normalizationFactor: number;
  normalizationFrequency: number;
  zeros: Array<Complex>;
  poles: Array<Complex>;
  constructor(inputUnits: string, outputUnits: string) {
    super(inputUnits, outputUnits);
  }
}

export class FIR extends AbstractFilterType {
  symmetry: string;
  numerator: Array<number>;
  constructor(inputUnits: string, outputUnits: string) {
    super(inputUnits, outputUnits);
  }
}

export class CoefficientsFilter extends AbstractFilterType {
  cfTransferFunction: string;
  numerator: Array<number>;
  denominator: Array<number>;
  constructor(inputUnits: string, outputUnits: string) {
    super(inputUnits, outputUnits);
  }
}

export class Decimation {
  inputSampleRate: number;
  factor: number;
  offset: ?number;
  delay: ?number;
  correction: ?number;
}

export class Gain {
  value: number;
  frequency: number;
}

/**
 * Parses the FDSN StationXML returned from a query.
 *
 * @param rawXml parsed xml to extract objects from
 * @returns an Array of Network objects.
 */
export function parseStationXml(rawXml: Document): Array<Network> {
    let top = rawXml.documentElement;
    if (! top) {throw new Error("No documentElement in XML");}
    let netArray = top.getElementsByTagNameNS(STAML_NS, "Network");
    let out = [];
    for (let n of netArray) {
      out.push(convertToNetwork(n));
    }
    return out;
  }

  /** Parses a FDSNStationXML Network xml element into a Network object.
   *
   * @param xml the network xml Element
   * @returns Network instance
   */
export function convertToNetwork(xml: Element): Network {
    const netCode = _grabAttribute(xml, "code");
    if (! isNonEmptyStringArg(netCode)) {throw new Error("network code missing in network!");}
    let out = new Network(netCode);
    out.startDate = _grabAttribute(xml, "startDate");
    const rs = _grabAttribute(xml, "restrictedStatus");
    if (isNonEmptyStringArg(rs)) { out.restrictedStatus = rs; }
    const desc = _grabFirstElText(xml, 'Description');
    if (isNonEmptyStringArg(desc)) {out.description = desc;}
    if (_grabAttribute(xml, "endDate")) {
      out.endDate = _grabAttribute(xml, "endDate");
    }
    let totSta = xml.getElementsByTagNameNS(STAML_NS, "TotalNumberStations");
    if (totSta && totSta.length >0) {
      out.totalNumberStations = parseInt(_grabFirstElText(xml, "TotalNumberStations"));
    }
    let staArray = xml.getElementsByTagNameNS(STAML_NS, "Station");
    let stations = [];
    for (let s of staArray) {
      stations.push(convertToStation(out, s));
    }
    out.stations = stations;
    return out;
  }
  /**
   * Parses a FDSNStationXML Station xml element into a Station object.
   *
   * @param network the containing network
   * @param xml the station xml Element
   * @returns Station instance
   */
export function convertToStation(network: Network, xml: Element): Station {
    let staCode = _grabAttribute(xml, "code");
    if (! isNonEmptyStringArg(staCode)) {throw new Error("station code missing in station!");}
    let out = new Station(network, staCode);
    out.startDate = _grabAttribute(xml, "startDate");
    const rs = _grabAttribute(xml, "restrictedStatus");
    if (isNonEmptyStringArg(rs)) { out.restrictedStatus = rs; }
    const lat =  _grabFirstElFloat(xml, 'Latitude');
    if (isNumArg(lat)) {out.latitude = lat;}
    const lon = _grabFirstElFloat(xml, 'Longitude');
    if (isNumArg(lon)) {out.longitude = lon;}
    const elev = _grabFirstElFloat(xml, 'Elevation');
    if (isNumArg(elev)) {out.elevation = elev;}
    const name = _grabFirstElText(_grabFirstEl(xml, 'Site'), 'Name');
    if (isStringArg(name)) {out.name = name;}
    const endDate = _grabAttribute(xml, "endDate");
    if (isDef(endDate)) {out.endDate = _grabAttribute(xml, "endDate"); }
    let chanArray = xml.getElementsByTagNameNS(STAML_NS, "Channel");
    let channels = [];
    for (let c of chanArray) {
      channels.push(convertToChannel(out, c));
    }
    out.channels = channels;
    return out;
  }
  /**
   * Parses a FDSNStationXML Channel xml element into a Channel object.
   *
   * @param station the containing staton
   * @param xml the channel xml Element
   * @returns Channel instance
   */
export function convertToChannel(station: Station, xml: Element): Channel {
    let locCode = _grabAttribute(xml, "locationCode");
    if (! isNonEmptyStringArg(locCode)) {locCode = '';}
    let chanCode = _grabAttribute(xml, "code");
    if (! isNonEmptyStringArg(chanCode)) {throw new Error("channel code missing in channel!");}

    let out = new Channel(station, chanCode, locCode);
    out.startDate = _grabAttribute(xml, "startDate");
    const rs = _grabAttribute(xml, "restrictedStatus");
    if (isNonEmptyStringArg(rs)) { out.restrictedStatus = rs; }

    const lat =  _grabFirstElFloat(xml, 'Latitude');
    if (isNumArg(lat)) {out.latitude = lat;}
    const lon = _grabFirstElFloat(xml, 'Longitude');
    if (isNumArg(lon)) {out.longitude = lon;}
    const elev = _grabFirstElFloat(xml, 'Elevation');
    if (isNumArg(elev)) {out.elevation = elev;}
    const depth = _grabFirstElFloat(xml, 'Depth');
    if (isNumArg(depth)) {out.depth = depth;}

    const azimuth = _grabFirstElFloat(xml, 'Azimuth');
    if (isNumArg(azimuth)) {out.azimuth = azimuth;}
    const dip = _grabFirstElFloat(xml, 'Dip');
    if (isNumArg(dip)) {out.dip = dip;}
    const sampleRate = _grabFirstElFloat(xml, 'SampleRate');
    if (isNumArg(sampleRate)) {out.sampleRate = sampleRate;}
    if (_grabAttribute(xml, "endDate")) {
      out.endDate = _grabAttribute(xml, "endDate");
    }
    let responseXml = xml.getElementsByTagNameNS(STAML_NS, 'Response');
    if (responseXml && responseXml.length > 0 ) {
      const r = responseXml.item(0);
      if (r) {out.response = convertToResponse(r);}
    }
    return out;
  }

  /** Parses a FDSNStationXML Response xml element into a Response object.
   *
   * @param responseXml the response xml Element
   * @returns Response instance
   */
export function convertToResponse(responseXml: Element): Response {
    let out;
    let inst = responseXml.getElementsByTagNameNS(STAML_NS, 'InstrumentSensitivity');
    if (inst && inst.item(0)) {
      const i = inst.item(0);
      if (i) {out = new Response(convertToInstrumentSensitivity(i));}
    }
    if (! out) {
      // DMC returns empty response element when they know nothing (instead
      // of just leaving it out). Return empty object in this case
      out = new Response();
    }
    let xmlStages = responseXml.getElementsByTagNameNS(STAML_NS, 'Stage');
    if (xmlStages && xmlStages.length > 0) {
      let jsStages = Array.from(xmlStages).map(function(stageXml) {
        return convertToStage(stageXml);
      });
      out.stages = jsStages;
    }
    return out;
  }

  /**
   * Parses a FDSNStationXML InstrumentSensitivity xml element into a InstrumentSensitivity object.
   *
   * @param xml the InstrumentSensitivity xml Element
   * @returns InstrumentSensitivity instance
   */
export function convertToInstrumentSensitivity(xml: Element): InstrumentSensitivity {
    let sensitivity = _grabFirstElFloat(xml, 'Value');
    let frequency = _grabFirstElFloat(xml, 'Frequency');
    let inputUnits = _grabFirstElText(_grabFirstEl(xml, 'InputUnits'), 'Name');
    let outputUnits = _grabFirstElText(_grabFirstEl(xml, 'OutputUnits'), 'Name');
    if (! (isDef(sensitivity) && isDef(frequency) && isDef(inputUnits) && isDef(outputUnits))) {
      // $FlowFixMe
      throw new Error(`Not all elements of Sensitivity exist: ${sensitivity} ${frequency} ${inputUnits} ${outputUnits}`);
    }
    return new InstrumentSensitivity(sensitivity, frequency, inputUnits, outputUnits);
  }

  /**
   * Parses a FDSNStationXML Stage xml element into a Stage object.
   *
   * @param stageXml the Stage xml Element
   * @returns Stage instance
   */
export function convertToStage(stageXml: Element): Stage {
    let subEl = stageXml.firstElementChild;
    let filter: AbstractFilterType | null = null;
    if (! subEl) {
      throw new Error("Stage element has no child elements");
    } else if (stageXml.childElementCount === 1 && subEl.localName === 'StageGain') {
      // degenerate case of a gain only stage
      // fix the lack of units after all stages are converted.
    } else {
      // shoudl be a filter of some kind, check for units
      let inputUnits = _grabFirstElText(_grabFirstEl(stageXml, 'InputUnits'), 'Name');
      let outputUnits = _grabFirstElText(_grabFirstEl(stageXml, 'OutputUnits'), 'Name');
      if (! isNonEmptyStringArg(inputUnits)) {
        throw new Error("Stage inputUnits required");
      }
      if (! isNonEmptyStringArg(outputUnits)) {
        throw new Error("Stage outputUnits required");
      }
      // here we assume there must be a filter, and so must have units

      if (subEl.localName === 'PolesZeros') {
        filter = new PolesZeros(inputUnits, outputUnits);
        const pzt = _grabFirstElText(stageXml, 'PzTransferFunctionType');
        if (isNonEmptyStringArg(pzt)) { filter.pzTransferFunctionType = pzt; }
        const nfa = _grabFirstElFloat(stageXml, 'NormalizationFactor');
        if (isNumArg(nfa)) { filter.normalizationFactor = nfa;}
        const nfr = _grabFirstElFloat(stageXml, 'NormalizationFrequency');
        if (isNumArg(nfr)) {filter.normalizationFrequency = nfr;}
        let zeros = Array.from(stageXml.getElementsByTagNameNS(STAML_NS, 'Zero'))
            .map(function(zeroEl) {
              return extractComplex(zeroEl);
            });
        let poles = Array.from(stageXml.getElementsByTagNameNS(STAML_NS, 'Pole'))
            .map(function(poleEl) {
              return extractComplex(poleEl);
            });
        filter.zeros = zeros;
        filter.poles = poles;
      } else if (subEl.localName === 'Coefficients') {
        let coeffXml = subEl;
        filter = new CoefficientsFilter(inputUnits, outputUnits);
        const cft = _grabFirstElText(coeffXml, 'CfTransferFunctionType');
        if (isNonEmptyStringArg(cft)) {filter.cfTransferFunction = cft;}
        filter.numerator = Array.from(coeffXml.getElementsByTagNameNS(STAML_NS, 'Numerator'))
            .map(function(numerEl) {
              return parseFloat(numerEl.textContent);
            });
        filter.denominator = Array.from(coeffXml.getElementsByTagNameNS(STAML_NS, 'Denominator'))
            .map(function(denomEl) {
              return parseFloat(denomEl.textContent);
            });
      } else if (subEl.localName === 'ResponseList') {
        throw new Error("ResponseList not supported: ");
      } else if (subEl.localName === 'FIR') {
        let firXml = subEl;
        filter = new FIR(inputUnits, outputUnits);
        const s = _grabFirstElText(firXml, 'Symmetry');
        if (isNonEmptyStringArg(s)) {filter.symmetry = s;}
        filter.numerator = Array.from(firXml.getElementsByTagNameNS(STAML_NS, 'NumeratorCoefficient'))
            .map(function(numerEl) {
              return parseFloat(numerEl.textContent);
            });
      } else if (subEl.localName === 'Polynomial') {
        throw new Error("Polynomial not supported: ");
      } else if (subEl.localName === 'StageGain') {
        // gain only stage, pick it up below
      } else {
        throw new Error("Unknown Stage type: "+ subEl.localName);
      }

      if (filter) {
        // add description and name if it was there
        let description = _grabFirstElText(subEl, 'Description');
        if (isNonEmptyStringArg(description)) {
          filter.description = description;
        }
        if (subEl.hasAttribute('name')) {
          const n = _grabAttribute(subEl, 'name');
          if (isNonEmptyStringArg(n)) {filter.name = n;}
        }
      }
    }
    let decimationXml = _grabFirstEl(stageXml, 'Decimation');
    let decimation: Decimation | null = null;
    if (decimationXml) {
      decimation = convertToDecimation(decimationXml);
    }
    let gainXml = _grabFirstEl(stageXml, 'StageGain');
    let gain = null;
    if (gainXml) {
      gain = convertToGain(gainXml);
    } else {
      throw new Error("Did not find Gain in stage number "+stringify(_grabAttribute(stageXml, "number")));
    }
    let out = new Stage(filter, decimation, gain);

    return out;
  }

  /**
   * Parses a FDSNStationXML Decimation xml element into a Decimation object.
   *
   * @param decXml the Decimation xml Element
   * @returns Decimation instance
   */
export function convertToDecimation(decXml: Element): Decimation {
    let out = new Decimation();
    const insr = _grabFirstElFloat(decXml, 'InputSampleRate');
    if (isNumArg(insr)) {out.inputSampleRate = insr;}
    const fac = _grabFirstElInt(decXml, 'Factor');
    if (isNumArg(fac)) {out.factor = fac;}
    out.offset = _grabFirstElInt(decXml, 'Offset');
    out.delay = _grabFirstElFloat(decXml, 'Delay');
    out.correction = _grabFirstElFloat(decXml, 'Correction');
    return out;
  }

  /**
   * Parses a FDSNStationXML Gain xml element into a Gain object.
   *
   * @param gainXml the Gain xml Element
   * @returns Gain instance
   */
export function convertToGain(gainXml: Element): Gain {
    let out = new Gain();
    const v = _grabFirstElFloat(gainXml, 'Value');
    if (isNumArg(v)) {out.value = v;}
    const f = _grabFirstElFloat(gainXml, 'Frequency');
    if (isNumArg(f)) {out.frequency = f;}
    return out;
  }

  /**
   * Extracts a complex number from an stationxml element.
   *
   * @param   el xml element
   * @returns     Complex instance
   */
export function extractComplex(el: Element) {
    const re = _grabFirstElFloat(el, 'Real');
    const im = _grabFirstElFloat(el, 'Imaginary');
    if (isNumArg(re) && isNumArg(im)) {
      return createComplex(re, im);
    } else {
      // $FlowFixMe
      throw new Error(`Both Real and Imaginary required: ${re} ${im}`);
    }
  }

/**
 * Generator function to access all stations within all networks in the array.
 *
 * @param      networks array of Networks
 * @yields           generator yeiding stations
 */
export function* allStations(networks: Array<Network>): Generator<Station, void, any> {
  for (let n of networks) {
    for (let s of n.stations) {
        yield s;
    }
  }
}

/**
 * Generator function to access all channels within all stations
 * within all networks in the array.
 *
 * @param      networks array of Networks
 * @yields           generator yeiding channels
 */
export function* allChannels(networks: Array<Network>): Generator<Channel, void, any> {
  for (let s of allStations(networks)) {
    for (let c of s.channels) {
      yield c;
    }
  }
}

/**
 * Extract all channels from all stations from all networks in the input array.
 *
 * @param   networks Array of networks.
 * @param   netCode network code to match
 * @param   staCode station code to match
 * @param   locCode location code to match
 * @param   chanCode channel code to match
 * @yields           Array of channels.
 */
export function* findChannels(networks: Array<Network>, netCode: string, staCode: string, locCode: string, chanCode: string): Generator<Channel, void, any> {
    for (let n of networks.filter(n => n.networkCode ===  netCode)) {
      for (let s of n.stations.filter(s => s.stationCode ===  staCode)) {
        for (let c of s.channels.filter(c => c.locationCode ===  locCode && c.channelCode === chanCode)) {
          yield c;
        }
      }
    }
}

// these are similar methods as in seisplotjs.quakeml
// duplicate here to avoid dependency and diff NS, yes that is dumb...

const _grabFirstEl = function(xml: Element | null | void, tagName: string): Element | void {
  let out = undefined;
  if (isObject(xml)) {
    let el = xml.getElementsByTagName(tagName);
    if (isObject(el) && el.length > 0) {
      const e = el.item(0);
      if (e) {
        out = e;
      }
    }
  }
  return out;
};

const _grabFirstElText = function _grabFirstElText(xml: Element | null | void, tagName: string): string | void {
  let out = undefined;
  let el = _grabFirstEl(xml, tagName);
  if (isObject(el)) {
    out = el.textContent;
  }
  return out;
};

const _grabFirstElFloat = function _grabFirstElFloat(xml: Element | null | void, tagName: string): number | void {
  let out = undefined;
  let elText = _grabFirstElText(xml, tagName);
  if (isStringArg(elText)) {
    out = parseFloat(elText);
  }
  return out;
};

const _grabFirstElInt = function _grabFirstElInt(xml: Element | null | void, tagName: string): number | void {
  let out = undefined;
  let elText = _grabFirstElText(xml, tagName);
  if (isStringArg(elText)) {
    out = parseInt(elText);
  }
  return out;
};

const _grabAttribute = function _grabAttribute(xml: Element | null | void, tagName: string): string | void {
  let out = undefined;
  if (isObject(xml)) {
    let a = xml.getAttribute(tagName);
    if (isStringArg(a)) {
      out = a;
    }
  }
  return out;
};

const _grabAttributeNS = function(xml: Element | null | void, namespace: string, tagName: string): string | void {
  let out = undefined;
  if (isObject(xml)) {
    let a = xml.getAttributeNS(namespace, tagName);
    if (isStringArg(a)) {
      out = a;
    }
  }
  return out;
};


export const parseUtil = {
  "_grabFirstEl": _grabFirstEl,
  "_grabFirstElText": _grabFirstElText,
  "_grabFirstElFloat": _grabFirstElFloat,
  "_grabFirstElInt": _grabFirstElInt,
  "_grabAttribute": _grabAttribute,
  "_grabAttributeNS": _grabAttributeNS
};
