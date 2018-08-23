// @flow

import RSVP from 'rsvp';

RSVP.on('error', function(reason) {
  console.assert(false, reason);
});

import * as model from '../model';
import * as util from './util';
import moment from 'moment';

// special due to flow
import {hasArgs, hasNoArgs, isStringArg, isNumArg, checkStringOrDate, stringify} from '../model';

export { RSVP, model };

export const LEVEL_NETWORK = 'network';
export const LEVEL_STATION = 'station';
export const LEVEL_CHANNEL = 'channel';
export const LEVEL_RESPONSE = 'response';

export const LEVELS = [ LEVEL_NETWORK, LEVEL_STATION, LEVEL_CHANNEL, LEVEL_RESPONSE];

export const IRIS_HOST = "service.iris.edu";

export const STAML_NS = 'http://www.fdsn.org/xml/station/1';

export const FAKE_EMPTY_XML = '<?xml version="1.0" encoding="ISO-8859-1"?> <FDSNStationXML xmlns="http://www.fdsn.org/xml/station/1" schemaVersion="1.0" xsi:schemaLocation="http://www.fdsn.org/xml/station/1 http://www.fdsn.org/xml/station/fdsn-station-1.0.xsd" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:iris="http://www.fdsn.org/xml/station/1/iris"> </FDSNStationXML>';



export class StationQuery {
  /** @private */
  _specVersion: number;
  /** @private */
  _protocol: string;
  /** @private */
  _host: string;
  /** @private */
  _nodata: number;
  /** @private */
  _networkCode: string;
  /** @private */
  _stationCode: string;
  /** @private */
  _locationCode: string;
  /** @private */
  _channelCode: string;
  /** @private */
  _startTime: moment;
  /** @private */
  _endTime: moment;
  /** @private */
  _startBefore: moment;
  /** @private */
  _endBefore: moment;
  /** @private */
  _startAfter: moment;
  /** @private */
  _endAfter: moment;
  /** @private */
  _minLat: number;
  /** @private */
  _maxLat: number;
  /** @private */
  _minLon: number;
  /** @private */
  _maxLon: number;
  /** @private */
  _latitude: number;
  /** @private */
  _longitude: number;
  /** @private */
  _minRadius: number;
  /** @private */
  _maxRadius: number;
  /** @private */
  _includeRestricted: boolean;
  /** @private */
  _includeAvailability: boolean;
  /** @private */
  _format: string;
  /** @private */
  _updatedAfter: moment;
  /** @private */
  _matchTimeseries: boolean;
  constructor(host?: string) {
    this._specVersion = 1;
    this._protocol = 'http';
    if (document && document.location && "https:" == document.location.protocol) {
      this._protocol = 'https:'
    }
    this.host(host);
    if (! host) {
      this._host = IRIS_HOST;
    }
  }
  specVersion(value?: number): number | StationQuery {
    if (hasArgs(value)) {
      this._specVersion = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._specVersion;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  protocol(value?: string) :string | StationQuery {
    if (isStringArg(value)) {
      this._protocol = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._protocol;
    } else {
      throw new Error('value argument is optional or string, but was '+typeof value);
    }
  }
  host(value?: string) :string | StationQuery {
    if (isStringArg(value)) {
      this._host = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._host;
    } else {
      throw new Error('value argument is optional or string, but was '+typeof value);
    }
  }
  nodata(value?: number): number | StationQuery {
    if (hasNoArgs(value)) {
      return this._nodata;
    } else if (hasArgs(value)) {
      this._nodata = value;
      return this;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  networkCode(value?: string) :string | StationQuery {
    if (isStringArg(value)) {
      this._networkCode = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._networkCode;
    } else {
      throw new Error('value argument is optional or string, but was '+value);
    }
  }
  stationCode(value?: string) :string | StationQuery {
    if (isStringArg(value)) {
      this._stationCode = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._stationCode;
    } else {
      throw new Error('value argument is optional or string, but was '+value);
    }
  }
  locationCode(value?: string) :string | StationQuery {
    if (isStringArg(value)) {
      this._locationCode = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._locationCode;
    } else {
      throw new Error('value argument is optional or string, but was '+value);
    }
  }
  channelCode(value?: string) :string | StationQuery {
    if (isStringArg(value)) {
      this._channelCode = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._channelCode;
    } else {
      throw new Error('value argument is optional or string, but was '+value);
    }
  }
  startTime(value?: moment) :moment | StationQuery {
    if (hasNoArgs(value)) {
      return this._startTime;
    } else if (hasArgs(value)) {
      this._startTime = checkStringOrDate(value);
      return this;
    } else {
      throw new Error('value argument is optional or moment or string, but was '+typeof value);
    }
  }
  endTime(value?: moment) :moment | StationQuery {
    if (hasNoArgs(value)) {
      return this._endTime;
    } else if (hasArgs(value)) {
      this._endTime = checkStringOrDate(value);
      return this;
    } else {
      throw new Error('value argument is optional or moment or string, but was '+typeof value);
    }
  }
  startBefore(value?: moment) :moment | StationQuery {
    if (hasNoArgs(value)) {
      return this._startBefore;
    } else if (hasArgs(value)) {
      this._startBefore = checkStringOrDate(value);
      return this;
    } else {
      throw new Error('value argument is optional or moment or string, but was '+typeof value);
    }
  }
  endBefore(value?: moment) :moment | StationQuery {
    if (hasNoArgs(value)) {
      return this._endBefore;
    } else if (hasArgs(value)) {
      this._endBefore = checkStringOrDate(value);
      return this;
    } else {
      throw new Error('value argument is optional or moment or string, but was '+typeof value);
    }
  }
  startAfter(value?: moment) :moment | StationQuery {
    if (hasNoArgs(value)) {
      return this._startAfter;
    } else if (hasArgs(value)) {
      this._startAfter = checkStringOrDate(value);
      return this;
    } else {
      throw new Error('value argument is optional or moment or string, but was '+typeof value);
    }
  }
  endAfter(value?: moment) :moment | StationQuery {
    if (hasNoArgs(value)) {
      return this._endAfter;
    } else if (hasArgs(value)) {
      this._endAfter = checkStringOrDate(value);
      return this;
    } else {
      throw new Error('value argument is optional or moment or string, but was '+typeof value);
    }
  }
  minLat(value?: number): number | StationQuery {
    if (hasNoArgs(value)) {
      return this._minLat;
    } else if (isNumArg(value)) {
      this._minLat = value;
      return this;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  maxLat(value?: number): number | StationQuery {
    if (hasNoArgs(value)) {
      return this._maxLat;
    } else if (isNumArg(value)) {
      this._maxLat = value;
      return this;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  minLon(value?: number): number | StationQuery {
    if (hasNoArgs(value)) {
      return this._minLon;
    } else if (isNumArg(value)) {
      this._minLon = value;
      return this;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  maxLon(value?: number): number | StationQuery {
    if (hasNoArgs(value)) {
      return this._maxLon;
    } else if (isNumArg(value)) {
      this._maxLon = value;
      return this;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  latitude(value?: number): number | StationQuery {
    if (hasNoArgs(value)) {
      return this._latitude;
    } else if (isNumArg(value)) {
      this._latitude = value;
      return this;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  longitude(value?: number): number | StationQuery {
    if (hasNoArgs(value)) {
      return this._longitude;
    } else if (isNumArg(value)) {
      this._longitude = value;
      return this;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  minRadius(value?: number): number | StationQuery {
    if (hasNoArgs(value)) {
      return this._minRadius;
    } else if (isNumArg(value)) {
      this._minRadius = value;
      return this;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  maxRadius(value?: number): number | StationQuery {
    if (hasNoArgs(value)) {
      return this._maxRadius;
    } else if (isNumArg(value)) {
      this._maxRadius = value;
      return this;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  includeRestricted(value?: boolean): boolean | StationQuery {
    if (hasNoArgs(value)) {
      return this._includeRestricted;
    } else if (hasArgs(value)) {
      this._includeRestricted = value;
      return this;
    } else {
      throw new Error('value argument is optional or boolean, but was '+typeof value);
    }
  }
  includeAvailability(value?: boolean): boolean | StationQuery {
    if (hasNoArgs(value)) {
      return this._includeAvailability;
    } else if (hasArgs(value)) {
      this._includeAvailability = value;
      return this;
    } else {
      throw new Error('value argument is optional or boolean, but was '+typeof value);
    }
  }
  format(value?: string) :string | StationQuery {
    if (isStringArg(value)) {
      this._format = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._format;
    } else {
      throw new Error('value argument is optional or string, but was '+value);
    }
  }
  updatedAfter(value?: moment) :moment | StationQuery {
    if (hasNoArgs(value)) {
      return this._updatedAfter;
    } else if (hasArgs(value)) {
      this._updatedAfter = checkStringOrDate(value);
      return this;
    } else {
      throw new Error('value argument is optional or moment or string, but was '+typeof value);
    }
  }
  matchTimeseries(value?: boolean): boolean | StationQuery {
    if (hasNoArgs(value)) {
      return this._matchTimeseries;
    } else if (hasArgs(value)) {
      this._matchTimeseries = value;
      return this;
    } else {
      throw new Error('value argument is optional or boolean, but was '+typeof value);
    }
  }

  /** Checks to see if any parameter that would limit the data
    * returned is set. This is a crude, coarse check to make sure
    * the client doesn't ask for EVERYTHING the server has. */
  isSomeParameterSet(): boolean {
    return util._isDef(this._networkCode) ||
    util._isDef(this._stationCode) ||
    util._isDef(this._locationCode) ||
    util._isDef(this._channelCode) ||
    util._isDef(this._startTime) ||
    util._isDef(this._endTime) ||
    util._isDef(this._startBefore) ||
    util._isDef(this._endBefore) ||
    util._isDef(this._startAfter) ||
    util._isDef(this._endAfter) ||
    util._isDef(this._minLat) ||
    util._isDef(this._maxLat) ||
    util._isDef(this._minLon) ||
    util._isDef(this._maxLon) ||
    util._isDef(this._latitude) ||
    util._isDef(this._longitude) ||
    util._isDef(this._minRadius) ||
    util._isDef(this._maxRadius) ||
    util._isDef(this._updatedAfter);
  }

  convertToNetwork(xml: Element): model.Network {
    let out = new model.Network(util._grabAttribute(xml, "code"))
    out.startDate = util._grabAttribute(xml, "startDate");
    const rs = util._grabAttribute(xml, "restrictedStatus");
    if (rs) { out.restrictedStatus = rs; }
    const desc = util._grabFirstElText(xml, 'Description');
    if (desc) {out.description = desc;}
    if (util._grabAttribute(xml, "endDate")) {
      out.endDate = util._grabAttribute(xml, "endDate");
    }
    let totSta = xml.getElementsByTagNameNS(STAML_NS, "TotalNumberStations");
    if (totSta && totSta.length >0) {
      out.totalNumberStations = parseInt(util._grabFirstElText(xml, "TotalNumberStations"));
    }
    let staArray = xml.getElementsByTagNameNS(STAML_NS, "Station");
    let stations = [];
    for (let i=0; i<staArray.length; i++) {
      stations.push(this.convertToStation(out, staArray.item(i)));
    }
    out.stations = stations;
    return out;
  }
  convertToStation(network: model.Network, xml: Element): model.Station {
    let out = new model.Station(network, util._grabAttribute(xml, "code"))
    out.startDate = util._grabAttribute(xml, "startDate");
    const rs = util._grabAttribute(xml, "restrictedStatus");
    if (rs) { out.restrictedStatus = rs; }
    out.latitude = util._grabFirstElFloat(xml, 'Latitude');
    out.longitude = util._grabFirstElFloat(xml, 'Longitude');
    out.elevation = util._grabFirstElFloat(xml, 'Elevation');
    out.name = util._grabFirstElText(util._grabFirstEl(xml, 'Site'), 'Name');
    if (util._grabAttribute(xml, "endDate")) {
      out.endDate = util._grabAttribute(xml, "endDate");
    }
    let chanArray = xml.getElementsByTagNameNS(STAML_NS, "Channel");
    let channels = [];
    for (let i=0; i<chanArray.length; i++) {
      channels.push(this.convertToChannel(out, chanArray.item(i)));
    }
    out.channels = channels;
    return out;
  }
  convertToChannel(station: model.Station, xml: Element): model.Channel {
    let out = new model.Channel(station, util._grabAttribute(xml, "code"), util._grabAttribute(xml, "locationCode"))
    out.startDate = util._grabAttribute(xml, "startDate");
    const rs = util._grabAttribute(xml, "restrictedStatus");
    if (rs) { out.restrictedStatus = rs; }
    out.latitude = util._grabFirstElFloat(xml, 'Latitude');
    out.longitude = util._grabFirstElFloat(xml, 'Longitude');
    out.elevation = util._grabFirstElFloat(xml, 'Elevation');
    out.depth = util._grabFirstElFloat(xml, 'Depth');
    out.azimuth = util._grabFirstElFloat(xml, 'Azimuth');
    out.dip = util._grabFirstElFloat(xml, 'Dip');
    out.sampleRate = util._grabFirstElFloat(xml, 'SampleRate');
    if (util._grabAttribute(xml, "endDate")) {
      out.endDate = util._grabAttribute(xml, "endDate");
    }
    let responseXml = xml.getElementsByTagNameNS(STAML_NS, 'Response');
    if (responseXml && responseXml.length > 0 ) {
      out.response = this.convertToResponse(responseXml.item(0));
    }
    return out;
  }

  convertToResponse(responseXml: Element): model.Response {
    let mythis = this;
    let out;
    let inst = responseXml.getElementsByTagNameNS(STAML_NS, 'InstrumentSensitivity');
    if (inst && inst.item(0)) {
      out = new model.Response(this.convertToInstrumentSensitivity(inst.item(0)));
    } else {
      // DMC returns empty response element when they know nothing (instead
      // of just leaving it out). Return empty object in this case
      out = new model.Response();
    }
    let xmlStages = responseXml.getElementsByTagNameNS(STAML_NS, 'Stage');
    if (xmlStages && xmlStages.length > 0) {
      let jsStages = Array.from(xmlStages).map(function(stageXml) {
        return mythis.convertToStage(stageXml);
      });
      out.stages = jsStages;
    }
    return out;
  }

  convertToInstrumentSensitivity(xml: Element): model.InstrumentSensitivity {
    let sensitivity: number = util._grabFirstElFloat(xml, 'Value');
    let frequency = util._grabFirstElFloat(xml, 'Frequency');
    let inputUnits = util._grabFirstElText(util._grabFirstEl(xml, 'InputUnits'), 'Name');
    let outputUnits = util._grabFirstElText(util._grabFirstEl(xml, 'OutputUnits'), 'Name');
    return new model.InstrumentSensitivity(sensitivity, frequency, inputUnits, outputUnits);
  }

  convertToStage(stageXml: Element): model.Stage {
    let mythis = this;
    let subEl = stageXml.firstElementChild;
    if (! subEl) {
      throw new Error("Stage element has no child elements");
    }
    let filter: model.AbstractFilterType | null = null;
    let inputUnits = util._grabFirstElText(util._grabFirstEl(stageXml, 'InputUnits'), 'Name');
    let outputUnits = util._grabFirstElText(util._grabFirstEl(stageXml, 'OutputUnits'), 'Name');
    if (subEl.localName == 'PolesZeros') {
      filter = new model.PolesZeros(inputUnits, outputUnits);
      filter.pzTransferFunctionType = util._grabFirstElText(stageXml, 'PzTransferFunctionType');
      filter.normalizationFactor = util._grabFirstElFloat(stageXml, 'NormalizationFactor');
      filter.normalizationFrequency = util._grabFirstElFloat(stageXml, 'NormalizationFrequency');
      let zeros = Array.from(stageXml.getElementsByTagNameNS(STAML_NS, 'Zero'))
          .map(function(zeroEl) {
            return model.createComplex(util._grabFirstElFloat(zeroEl, 'Real'),
                               util._grabFirstElFloat(zeroEl, 'Imaginary'));
          });
      let poles = Array.from(stageXml.getElementsByTagNameNS(STAML_NS, 'Pole'))
          .map(function(poleEl) {
            return model.createComplex(util._grabFirstElFloat(poleEl, 'Real'),
                               util._grabFirstElFloat(poleEl, 'Imaginary'));
          });
      filter.zeros = zeros;
      filter.poles = poles;
    } else if (subEl.localName == 'Coefficients') {
      let coeffXml = subEl;
      filter = new model.CoefficientsFilter(inputUnits, outputUnits);
      filter.cfTransferFunction = util._grabFirstElText(coeffXml, 'CfTransferFunctionType');
      filter.numerator = Array.from(coeffXml.getElementsByTagNameNS(STAML_NS, 'Numerator'))
          .map(function(numerEl) {
            return parseFloat(numerEl.textContent);
          });
      filter.denominator = Array.from(coeffXml.getElementsByTagNameNS(STAML_NS, 'Denominator'))
          .map(function(denomEl) {
            return parseFloat(denomEl.textContent);
          });
    } else if (subEl.localName == 'ResponseList') {
      throw new Error("ResponseList not supported: ");
    } else if (subEl.localName == 'FIR') {
      let firXml = subEl;
      filter = new model.FIR(inputUnits, outputUnits);
      filter.symmetry = util._grabFirstElText(firXml, 'Symmetry');
      filter.numerator = Array.from(firXml.getElementsByTagNameNS(STAML_NS, 'NumeratorCoefficient'))
          .map(function(numerEl) {
            return parseFloat(numerEl.textContent);
          });
    } else if (subEl.localName == 'Polynomial') {
      throw new Error("Polynomial not supported: ");
    } else if (subEl.localName == 'StageGain') {
      // gain only stage, pick it up below
    } else {
      throw new Error("Unknown Stage type: "+ subEl.localName);
    }

    if (filter) {
      // add description and name if it was there
      let description = util._grabFirstElText(subEl, 'Description');
      if (description) {
        filter.description = description;
      }
      if (subEl.hasAttribute('name')) {
        filter.name = util._grabAttribute(subEl, 'name');
      }
    }
    let decimationXml = util._grabFirstEl(stageXml, 'Decimation');
    let decimation: model.Decimation | null = null;
    if (decimationXml) {
      decimation = this.convertToDecimation(decimationXml);
    }
    let gainXml = util._grabFirstEl(stageXml, 'StageGain');
    let gain = null;
    if (gainXml) {
      gain = this.convertToGain(gainXml);
    } else {
      throw new Error("Did not find Gain in stage number "+stringify(util._grabAttribute(stageXml, "number")));
    }
    let out = new model.Stage(filter, decimation, gain);

    return out;
  }

  convertToDecimation(decXml: Element): model.Decimation {
    let out = new model.Decimation();
    out.inputSampleRate = util._grabFirstElFloat(decXml, 'InputSampleRate');
    out.factor = util._grabFirstElInt(decXml, 'Factor');
    out.offset = util._grabFirstElInt(decXml, 'Offset');
    out.delay = util._grabFirstElFloat(decXml, 'Delay');
    out.correction = util._grabFirstElFloat(decXml, 'Correction');
    return out
  }

  convertToGain(gainXml: Element): model.Gain {
    let out = new model.Gain();
    out.value = util._grabFirstElFloat(gainXml, 'Value');
    out.frequency = util._grabFirstElFloat(gainXml, 'Frequency');
    return out;
  }


  queryNetworks(): Promise<Array<model.Network>> {
    return this.query(LEVEL_NETWORK);
  }
  queryStations(): Promise<Array<model.Network>> {
    return this.query(LEVEL_STATION);
  }
  queryChannels(): Promise<Array<model.Network>> {
    return this.query(LEVEL_CHANNEL);
  }
  queryResponse(): Promise<Array<model.Network>> {
    return this.query(LEVEL_RESPONSE);
  }

  query(level: string): Promise<Array<model.Network>> {
    if (! LEVELS.includes(level)) {throw new Error("Unknown level: '"+level+"'");}
    let mythis = this;
    return this.queryRawXml(level).then(function(rawXml) {
        return mythis.parseRawXml(rawXml);
    });
  }

  parseRawXml(rawXml: Document) :Array<model.Network> {
    let top = rawXml.documentElement;
    if (! top) {throw new Error("No documentElement in XML");}
    let netArray = top.getElementsByTagNameNS(STAML_NS, "Network");
    let out = [];
    for (let i=0; i<netArray.length; i++) {
      out[i] = this.convertToNetwork(netArray.item(i));
    }
    return out;
  }

  queryRawXml(level: string): Promise<Document> {
    let mythis = this;
    let mylevel = level;
    let promise = new RSVP.Promise(function(resolve, reject) {
      let client = new XMLHttpRequest();
      let url = mythis.formURL(mylevel);
      client.open("GET", url);
      client.ontimeout = function(e) {
        this.statusText = "Timeout "+this.statusText;
        reject(this);
      };
      client.onreadystatechange = handler;
      client.responseType = "text"; // use text so error isn't parsed as xml
      client.setRequestHeader("Accept", "application/xml");
      client.send();

      function handler() {
        if (this.readyState === this.DONE) {
          if (this.status === 200) {
              let out = new DOMParser().parseFromString(this.response, "text/xml");
              resolve(out);
//            resolve(this.responseXML);
          } else if (this.status === 204 || (mythis.nodata() && this.status === mythis.nodata())) {

            // 204 is nodata, so successful but empty
            if (DOMParser) {
console.log("204 nodata so return empty xml");
              resolve(new DOMParser().parseFromString(FAKE_EMPTY_XML, "text/xml"));
            } else {
              throw new Error("Got 204 but can't find DOMParser to generate empty xml");
            }
          } else {
            reject(this);
          }
        }
      }
    });
    return promise;
  }

  formVersionURL() {
      return this.formBaseURL()+"/version";
  }

  queryVersion() {
    let mythis = this;
    let promise = new RSVP.Promise(function(resolve, reject) {
      let url = mythis.formVersionURL();
      let client = new XMLHttpRequest();
      client.open("GET", url);
      client.onreadystatechange = handler;
      client.responseType = "text";
      client.setRequestHeader("Accept", "text/plain");
      client.send();

      function handler() {
        if (this.readyState === this.DONE) {
          console.log("handle version: "+stringify(mythis.host())+" "+this.status);
          if (this.status === 200) {
            resolve(this.response);
          } else {
            console.log("Reject version: "+stringify(mythis.host())+" "+this.status);
            reject(this);
          }
        }
      }
    });
    return promise;
  }

  makeParam(name: string, val: mixed) {
    return name+"="+encodeURIComponent(stringify(val))+"&";
  }

  formBaseURL() {
    let colon = ":";
    if (this._protocol.endsWith(colon)) {
      colon = "";
    }
    return this._protocol+colon+"//"+this._host+"/fdsnws/station/"+this._specVersion;
  }

  formURL(level:string) {
    let url = this.formBaseURL()+"/query?";
    if (! level) {throw new Error("level not specified, should be one of network, station, channel, response.");}
    url = url+this.makeParam("level", level);
    if (this._networkCode) { url = url+this.makeParam("net", this.networkCode());}
    if (this._stationCode) { url = url+this.makeParam("sta", this.stationCode());}
    if (this._locationCode) { url = url+this.makeParam("loc", this.locationCode());}
    if (this._channelCode) { url = url+this.makeParam("cha", this.channelCode());}
    if (this._startTime) { url = url+this.makeParam("starttime", model.toIsoWoZ(this.startTime()));}
    if (this._endTime) { url = url+this.makeParam("endtime", model.toIsoWoZ(this.endTime()));}
    if (this._startBefore) { url = url+this.makeParam("startbefore", model.toIsoWoZ(this.startBefore()));}
    if (this._startAfter) { url = url+this.makeParam("startafter", model.toIsoWoZ(this.startAfter()));}
    if (this._endBefore) { url = url+this.makeParam("endbefore", model.toIsoWoZ(this.endBefore()));}
    if (this._endAfter) { url = url+this.makeParam("endafter", model.toIsoWoZ(this.endAfter()));}
    if (this._minLat) { url = url+this.makeParam("minlat", this.minLat());}
    if (this._maxLat) { url = url+this.makeParam("maxlat", this.maxLat());}
    if (this._minLon) { url = url+this.makeParam("minlon", this.minLon());}
    if (this._maxLon) { url = url+this.makeParam("maxlon", this.maxLon());}
    if (this._latitude) { url = url+this.makeParam("lat", this.latitude());}
    if (this._longitude) { url = url+this.makeParam("lon", this.longitude());}
    if (this._minRadius) { url = url+this.makeParam("minradius", this.minRadius());}
    if (this._maxRadius) { url = url+this.makeParam("maxradius", this.maxRadius());}
    if (this._includeRestricted) { url = url+this.makeParam("includerestricted", this.includeRestricted());}
    if (this._includeAvailability) { url = url+this.makeParam("includeavailability", this.includeAvailability());}
    if (this._updatedAfter) { url = url+this.makeParam("updatedafter", model.toIsoWoZ(this.updatedAfter()));}
    if (this._matchTimeseries) { url = url+this.makeParam("matchtimeseries", this.matchTimeseries());}
    if (this._format) { url = url+this.makeParam("format", this.format());}
    if (this._nodata) { url = url+this.makeParam("nodata", this.nodata());}
    if (url.endsWith('&') || url.endsWith('?')) {
      url = url.substr(0, url.length-1); // zap last & or ?
    }
    return url;
  }

}
