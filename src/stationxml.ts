/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * https://www.seis.sc.edu
 */
import {
  isObject,
  isDef,
  isStringArg,
  isNonEmptyStringArg,
  isNumArg,
  checkStringOrDate,
  stringify,
  reErrorWithMessage,
  WAY_FUTURE,
} from "./util";
import { Complex } from "./oregondsputil";
import { FDSNSourceId, NetworkSourceId, StationSourceId, NslcId, SourceIdSorter } from "./fdsnsourceid";
import { DateTime, Interval } from "luxon";

/** xml namespace for stationxml */
export const STAML_NS = "http://www.fdsn.org/xml/station/1";
export const COUNT_UNIT_NAME = "count";
export const FIX_INVALID_STAXML = true;
export const INVALID_NUMBER = -99999;
export const FAKE_START_DATE = DateTime.fromISO("1900-01-01T00:00:00Z");


export const CHANNEL_CLICK_EVENT = "channelclick";
export const STATION_CLICK_EVENT = "stationclick";

/**
 * Utility function to create CustomEvent for clicking on a Channel, for example
 * in a map or table.
 *
 * @param  sta          Channel clicked on
 * @param  mouseclick original mouse click Event
 * @returns            CustomEvent populated with channel field in detail.
 */
export function createChannelClickEvent(sta: Channel, mouseclick: Event): CustomEvent {
  const detail = {
    mouseevent: mouseclick,
    channel: sta,
  };
  return new CustomEvent(CHANNEL_CLICK_EVENT, { detail: detail });
}

/**
 * Utility function to create CustomEvent for clicking on a Station, for example
 * in a map or table.
 *
 * @param  sta          Station clicked on
 * @param  mouseclick original mouse click Event
 * @returns            CustomEvent populated with station field in detail.
 */
export function createStationClickEvent(sta: Station, mouseclick: Event): CustomEvent {
  const detail = {
    mouseevent: mouseclick,
    station: sta,
  };
  return new CustomEvent(STATION_CLICK_EVENT, { detail: detail });
}


// StationXML classes

export class Network {
  networkCode: string;
  _startDate: DateTime;
  _endDate: DateTime | null;
  restrictedStatus: string;
  description: string;
  totalNumberStations: number | null;
  stations: Array<Station>;

  constructor(networkCode: string) {
    this.networkCode = networkCode;
    this._startDate = FAKE_START_DATE;
    this._endDate = null;
    this.description = "";
    this.restrictedStatus = "";
    this.stations = [];
    this.totalNumberStations = null;
  }

  get sourceId(): NetworkSourceId {
    return new NetworkSourceId(this.networkCode ? this.networkCode : "");
  }

  get startDate(): DateTime {
    return this._startDate;
  }

  set startDate(value: DateTime | string) {
    this._startDate = checkStringOrDate(value);
  }

  get endDate(): null | DateTime {
    return this._endDate;
  }

  set endDate(value: DateTime | string | null) {
    if (!isDef(value)) {
      this._endDate = null;
    } else {
      this._endDate = checkStringOrDate(value);
    }
  }

  get timeRange(): Interval {
    return createInterval(this.startDate, this.endDate);
  }

  codes(): string {
    return this.networkCode;
  }

  isActiveAt(d?: DateTime): boolean {
    if (!isDef(d)) {
      d = DateTime.utc();
    }
    return this.timeRange.contains(d);
  }

  isTempNet(): boolean {
    const first = this.networkCode.charAt(0);
    return (
      first === "X" ||
      first === "Y" ||
      first === "Z" ||
      (first >= "0" && first <= "9")
    );
  }
}
export class Station {
  network: Network;
  stationCode: string;
  sourceID: string | null;

  /** @private */
  _startDate: DateTime;

  /** @private */
  _endDate: DateTime | null;
  restrictedStatus: string;
  name: string;
  latitude: number;
  longitude: number;
  elevation: number;
  waterLevel: number | null;
  comments: Array<Comment>;
  equipmentList: Array<Equipment>;
  dataAvailability: DataAvailability | null;
  identifierList: Array<string>;
  description: string;
  geology: string;
  vault: string;
  channels: Array<Channel>;

  constructor(network: Network, stationCode: string) {
    this.network = network;
    this.name = "";
    this.description = "";
    this.sourceID = null;
    this.restrictedStatus = "";
    this._startDate = FAKE_START_DATE;
    this._endDate = null;
    this.stationCode = stationCode;
    this.channels = [];
    this.latitude = INVALID_NUMBER;
    this.longitude = INVALID_NUMBER;
    this.elevation = 0;
    this.waterLevel = null;
    this.comments = [];
    this.equipmentList = [];
    this.dataAvailability = null;
    this.geology = "";
    this.vault = "";
    this.identifierList = [];
  }

  get sourceId(): StationSourceId {
    return new StationSourceId(this.networkCode ? this.networkCode : "",
      (this.stationCode ? this.stationCode : ""));
  }

  get startDate(): DateTime {
    return this._startDate;
  }

  set startDate(value: DateTime | string) {
    this._startDate = checkStringOrDate(value);
  }

  get endDate(): DateTime | null {
    return this._endDate;
  }

  set endDate(value: DateTime | string | null) {
    if (!isDef(value)) {
      this._endDate = null;
    } else {
      this._endDate = checkStringOrDate(value);
    }
  }

  get timeRange(): Interval {
    return createInterval(this.startDate, this.endDate);
  }

  get networkCode(): string {
    return this.network.networkCode;
  }

  isActiveAt(d?: DateTime): boolean {
    if (!isDef(d)) {
      d = DateTime.utc();
    }
    return this.timeRange.contains(d);
  }

  codes(sep = "."): string {
    return this.network.codes() + sep + this.stationCode;
  }
}
export class Channel {
  station: Station;

  /** @private */
  _locationCode: string;
  channelCode: string;
  /** @private */
  _sourceId: FDSNSourceId | undefined;
  /** @private */
  _startDate: DateTime;

  /** @private */
  _endDate: DateTime | null;
  restrictedStatus: string;
  latitude: number;
  longitude: number;
  elevation: number;
  depth: number;
  azimuth: number;
  dip: number;
  sampleRate: number;
  waterLevel: number | null = null;
  comments: Array<Comment> = [];
  equipmentList: Array<Equipment> = [];
  dataAvailability: DataAvailability | null = null;
  identifierList: Array<string> = [];
  description: string = "";
  response: Response | null;
  sensor: Equipment | null;
  preamplifier: Equipment | null;
  datalogger: Equipment | null;

  constructor(station: Station, channelCode: string, locationCode: string) {
    this.station = station;
    this._startDate = FAKE_START_DATE;
    this._endDate = null;
    this.response = null;
    this.sensor = null;
    this.preamplifier = null;
    this.datalogger = null;
    this.restrictedStatus = "";
    this.azimuth = INVALID_NUMBER;
    this.dip = INVALID_NUMBER;
    this.latitude = INVALID_NUMBER;
    this.longitude = INVALID_NUMBER;
    this.depth = 0;
    this.elevation = 0;
    this.sampleRate = 0;


    if (channelCode.length !== 3) {
      throw new Error(`Channel code must be 3 chars: ${channelCode}`);
    }

    this.channelCode = channelCode;
    this._locationCode = locationCode;

    if (!locationCode) {
      // make sure "null" is encoded as empty string
      this._locationCode = "";
    }

    if (!(this._locationCode.length === 2 || this._locationCode.length === 0)) {
      throw new Error(
        `locationCode must be 2 chars, or empty: "${locationCode}"`,
      );
    }
  }

  get sourceId(): FDSNSourceId {
    if (this._sourceId) {
      return this._sourceId;
    }
    return FDSNSourceId.fromNslc(this.networkCode,
      this.stationCode,
      this.locationCode,
      this.channelCode);
  }

  get nslcId(): NslcId {
    return new NslcId(
      this.networkCode ? this.networkCode : "",
      this.stationCode ? this.stationCode : "",
      (this.locationCode && this.locationCode !== "--") ? this.locationCode : "",
      this.channelCode ? this.channelCode : ""
    );
  }

  get startDate(): DateTime {
    return this._startDate;
  }

  set startDate(value: DateTime | string) {
    this._startDate = checkStringOrDate(value);
  }

  get endDate(): null | DateTime {
    return this._endDate;
  }

  set endDate(value: DateTime | string | null) {
    if (!isDef(value)) {
      this._endDate = null;
    } else {
      this._endDate = checkStringOrDate(value);
    }
  }

  get timeRange(): Interval {
    return createInterval(this.startDate, this.endDate);
  }

  get locationCode(): string {
    return this._locationCode;
  }

  set locationCode(value: string) {
    this._locationCode = value;

    if (!value) {
      // make sure "null" is encoded as empty string
      this._locationCode = "";
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
    if (!isDef(this.response)) {
      this.response = new Response(value);
    } else {
      this.response.instrumentSensitivity = value;
    }
  }

  get instrumentSensitivity(): InstrumentSensitivity {
    if (isDef(this.response) && isDef(this.response.instrumentSensitivity)) {
      return this.response.instrumentSensitivity;
    } else {
      throw new Error("no Response or InstrumentSensitivity defined");
    }
  }

  /**
   * return network, station, location and channels codes as one string.
   *
   * @returns net.sta.loc.chan
   */
  get nslc(): string {
    return this.codes();
  }

  /**
   * return network, station, location and channels codes as one string.
   *
   * @param sep separator, defaults to dot '.'
   * @returns net.sta.loc.chan
   */
  codes(sep = "."): string {
    return (
      this.station.codes(sep) + sep + this.locationCode + sep + this.channelCode
    );
  }

  isActiveAt(d?: DateTime): boolean {
    if (!isDef(d)) {
      d = DateTime.utc();
    }
    return this.timeRange.contains(d);
  }
}

export class InstrumentSensitivity {
  sensitivity: number;
  frequency: number;
  inputUnits: string;
  outputUnits: string;

  constructor(
    sensitivity: number,
    frequency: number,
    inputUnits: string,
    outputUnits: string,
  ) {
    this.sensitivity = sensitivity;
    this.frequency = frequency;
    this.inputUnits = inputUnits;
    this.outputUnits = outputUnits;
  }
}
export class Equipment {
  resourceId: string;
  type: string;
  description: string;
  manufacturer: string;
  vendor: string;
  model: string;
  serialNumber: string;
  installationDate: DateTime | null;
  removalDate: DateTime | null;
  calibrationDateList: Array<DateTime>;
  constructor() {
    this.resourceId = "";
    this.type = "";
    this.description = "";
    this.manufacturer = "";
    this.vendor = "";
    this.model = "";
    this.serialNumber = "";
    this.installationDate = null;
    this.removalDate = null;
    this.calibrationDateList = [];
  }
}
export class Response {
  instrumentSensitivity: InstrumentSensitivity | null;
  stages: Array<Stage>;

  constructor(
    instrumentSensitivity?: InstrumentSensitivity,
    stages?: Array<Stage>,
  ) {
    if (instrumentSensitivity) {
      this.instrumentSensitivity = instrumentSensitivity;
    } else {
      this.instrumentSensitivity = null;
    }

    if (stages) {
      this.stages = stages;
    } else {
      this.stages = [];
    }
  }
}
export class Stage {
  filter: AbstractFilterType | null;
  decimation: Decimation | null;
  gain: Gain;

  constructor(
    filter: AbstractFilterType | null,
    decimation: Decimation | null,
    gain: Gain,
  ) {
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
    this.description = "";
    this.name = "";
  }
}
export class PolesZeros extends AbstractFilterType {
  pzTransferFunctionType: string;
  normalizationFactor: number;
  normalizationFrequency: number;
  zeros: Array<InstanceType<typeof Complex>>;
  poles: Array<InstanceType<typeof Complex>>;

  constructor(inputUnits: string, outputUnits: string) {
    super(inputUnits, outputUnits);
    this.pzTransferFunctionType = "";
    this.normalizationFactor = 1;
    this.normalizationFrequency = 0;
    this.zeros = new Array<InstanceType<typeof Complex>>(0);
    this.poles = new Array<InstanceType<typeof Complex>>(0);
  }
}
export class FIR extends AbstractFilterType {
  symmetry: string;
  numerator: Array<number>;

  constructor(inputUnits: string, outputUnits: string) {
    super(inputUnits, outputUnits);
    this.symmetry = "none";
    this.numerator = [1];
  }
}
export class CoefficientsFilter extends AbstractFilterType {
  cfTransferFunction: string;
  numerator: Array<number>;
  denominator: Array<number>;

  constructor(inputUnits: string, outputUnits: string) {
    super(inputUnits, outputUnits);
    this.cfTransferFunction = "";
    this.numerator = [1];
    this.denominator = new Array<number>(0);
  }
}
export class Decimation {
  inputSampleRate: number;
  factor: number;
  offset: number | null | undefined;
  delay: number | null | undefined;
  correction: number | null | undefined;
  constructor(inputSampleRate: number, factor: number) {
    this.inputSampleRate = inputSampleRate;
    this.factor = factor;
  }
}
export class Gain {
  value: number;
  frequency: number;
  constructor(value: number, frequency: number) {
    this.value = value;
    this.frequency = frequency;
  }
}

export class Span {
  interval: Interval;
  numberSegments = 0;
  maximumTimeTear: number | null;
  constructor(interval: Interval) {
    this.maximumTimeTear = null;
    this.interval = interval;
  }
}
export class DataAvailability {
  extent: Interval | null;
  spanList: Array<Span>;
  constructor() {
    this.extent = null;
    this.spanList = [];
  }
}

export class Comment {
  id: string | null = null;
  subject: string | null = null;
  value: string;
  beginEffectiveTime: DateTime | null = null;
  endEffectiveTime: DateTime | null = null;
  authorList: Array<Author> = [];
  constructor(value: string) {
    this.value = value;
  }
}

export class Author {
  name: string | null = null;
  agency: string | null = null;
  email: string | null = null;
  phone: string | null = null;
}

/**
 * Parses the FDSN StationXML returned from a query.
 *
 * @param rawXml parsed xml to extract objects from
 * @returns an Array of Network objects.
 */
export function parseStationXml(rawXml: Document): Array<Network> {
  const top = rawXml.documentElement;

  if (!top) {
    throw new Error("No documentElement in XML");
  }

  const netArray = Array.from(top.getElementsByTagNameNS(STAML_NS, "Network"));
  const out = [];

  for (const n of netArray) {
    out.push(convertToNetwork(n));
  }

  return out;
}

/**
 * Parses a FDSNStationXML Network xml element into a Network object.
 *
 * @param xml the network xml Element
 * @returns Network instance
 */
export function convertToNetwork(xml: Element): Network {
  let netCode = "";

  try {
    netCode = _requireAttribute(xml, "code");

    const out = new Network(netCode);
    out.startDate = _requireAttribute(xml, "startDate");

    const rs = _grabAttribute(xml, "restrictedStatus");

    if (isNonEmptyStringArg(rs)) {
      out.restrictedStatus = rs;
    }

    const desc = _grabFirstElText(xml, "Description");

    if (isNonEmptyStringArg(desc)) {
      out.description = desc;
    }

    if (_grabAttribute(xml, "endDate")) {
      out.endDate = _grabAttribute(xml, "endDate");
    }

    const totSta = xml.getElementsByTagNameNS(STAML_NS, "TotalNumberStations");

    if (totSta && totSta.length > 0) {
      out.totalNumberStations = _grabFirstElInt(xml, "TotalNumberStations");
    }

    const staArray = Array.from(xml.getElementsByTagNameNS(STAML_NS, "Station"));
    const stations = [];

    for (const s of staArray) {
      stations.push(convertToStation(out, s));
    }

    out.stations = stations;
    return out;
  } catch (err) {
    throw reErrorWithMessage(err, netCode);
  }
}

/**
 * Parses a FDSNStationXML Station xml element into a Station object.
 *
 * @param network the containing network
 * @param xml the station xml Element
 * @returns Station instance
 */
export function convertToStation(network: Network, xml: Element): Station {
  let staCode = ""; // so can use in rethrow exception

  try {
    staCode = _requireAttribute(xml, "code");

    if (!isNonEmptyStringArg(staCode)) {
      throw new Error("station code missing in station!");
    }

    const out = new Station(network, staCode);
    out.startDate = _requireAttribute(xml, "startDate");

    const rs = _grabAttribute(xml, "restrictedStatus");
    if (isNonEmptyStringArg(rs)) {
      out.restrictedStatus = rs;
    }

    const lat = _grabFirstElFloat(xml, "Latitude");
    if (isNumArg(lat)) {
      out.latitude = lat;
    }

    const lon = _grabFirstElFloat(xml, "Longitude");
    if (isNumArg(lon)) {
      out.longitude = lon;
    }

    const elev = _grabFirstElFloat(xml, "Elevation");
    if (isNumArg(elev)) {
      out.elevation = elev;
    }

    const waterLevel = _grabFirstElFloat(xml, "WaterLevel");
    if (isNumArg(waterLevel)) {
      out.waterLevel = waterLevel;
    }

    const vault = _grabFirstElText(xml, "Vault");
    if (isStringArg(vault)) {
      out.vault = vault;
    }

    const geology = _grabFirstElText(xml, "Geology");
    if (isStringArg(geology)) {
      out.geology = geology;
    }

    const name = _grabFirstElText(_grabFirstEl(xml, "Site"), "Name");
    if (isStringArg(name)) {
      out.name = name;
    }

    const endDate = _grabAttribute(xml, "endDate");
    if (isDef(endDate)) {
      out.endDate = _grabAttribute(xml, "endDate");
    }

    const description = _grabFirstElText(xml, "Description");
    if (isDef(description)) {
      out.description = description;
    }

    const identifierList = Array.from(xml.getElementsByTagNameNS(STAML_NS, "Identifier"));
    out.identifierList = identifierList.map(el => { return el.textContent ? el.textContent : ""; });

    const dataAvailEl = _grabFirstEl(xml, "DataAvailability");
    if (isDef(dataAvailEl)) {
      out.dataAvailability = convertToDataAvailability(dataAvailEl);
    }

    const commentArray = Array.from(xml.getElementsByTagNameNS(STAML_NS, "Comment"));
    const comments = [];
    for (const c of commentArray) {
      comments.push(convertToComment(c));
    }
    out.comments = comments;

    const equipmentArray = Array.from(xml.getElementsByTagNameNS(STAML_NS, "Equipment"));
    const equipmentList = [];
    for (const c of equipmentArray) {
      equipmentList.push(convertToEquipment(c));
    }
    out.equipmentList = equipmentList;

    const chanArray = Array.from(xml.getElementsByTagNameNS(STAML_NS, "Channel"));
    const channels = [];
    for (const c of chanArray) {
      channels.push(convertToChannel(out, c));
    }
    out.channels = channels;

    return out;
  } catch (err) {
    throw reErrorWithMessage(err, staCode);
  }
}

/**
 * Parses a FDSNStationXML Channel xml element into a Channel object.
 *
 * @param station the containing staton
 * @param xml the channel xml Element
 * @returns Channel instance
 */
export function convertToChannel(station: Station, xml: Element): Channel {
  let locCode: string | null = ""; // so can use in rethrow exception

  const chanCode = "";

  try {
    locCode = _grabAttribute(xml, "locationCode");

    if (!isNonEmptyStringArg(locCode)) {
      locCode = "";
    }

    const chanCode = _requireAttribute(xml, "code");

    const out = new Channel(station, chanCode, locCode);
    out.startDate = checkStringOrDate(_requireAttribute(xml, "startDate"));

    const rs = _grabAttribute(xml, "restrictedStatus");

    if (isNonEmptyStringArg(rs)) {
      out.restrictedStatus = rs;
    }

    const lat = _grabFirstElFloat(xml, "Latitude");

    if (isNumArg(lat)) {
      out.latitude = lat;
    }

    const lon = _grabFirstElFloat(xml, "Longitude");

    if (isNumArg(lon)) {
      out.longitude = lon;
    }

    const elev = _grabFirstElFloat(xml, "Elevation");

    if (isNumArg(elev)) {
      out.elevation = elev;
    }

    const depth = _grabFirstElFloat(xml, "Depth");

    if (isNumArg(depth)) {
      out.depth = depth;
    }

    const waterLevel = _grabFirstElFloat(xml, "WaterLevel");
    if (isNumArg(waterLevel)) {
      out.waterLevel = waterLevel;
    }

    const azimuth = _grabFirstElFloat(xml, "Azimuth");

    if (isNumArg(azimuth)) {
      out.azimuth = azimuth;
    }

    const dip = _grabFirstElFloat(xml, "Dip");

    if (isNumArg(dip)) {
      out.dip = dip;
    }

    const desc = _grabFirstElText(xml, "Description");
    if (desc) { out.description = desc; }

    const sampleRate = _grabFirstElFloat(xml, "SampleRate");

    if (isNumArg(sampleRate)) {
      out.sampleRate = sampleRate;
    }

    if (_grabAttribute(xml, "endDate")) {
      out.endDate = _grabAttribute(xml, "endDate");
    }

    const sensor = xml.getElementsByTagNameNS(STAML_NS, "Sensor");

    if (sensor && sensor.length > 0) {
      const sensorTmp = sensor.item(0);

      if (isDef(sensorTmp)) {
        out.sensor = convertToEquipment(sensorTmp);
      }
    }

    const preamp = xml.getElementsByTagNameNS(STAML_NS, "PreAmplifier");

    if (preamp && preamp.length > 0) {
      const preampTmp = sensor.item(0);

      if (isDef(preampTmp)) {
        out.preamplifier = convertToEquipment(preampTmp);
      }
    }

    const datalogger = xml.getElementsByTagNameNS(STAML_NS, "DataLogger");

    if (datalogger && datalogger.length > 0) {
      const dataloggerTmp = sensor.item(0);

      if (isDef(dataloggerTmp)) {
        out.datalogger = convertToEquipment(dataloggerTmp);
      }
    }

    const description = _grabFirstElText(xml, "Description");
    if (isDef(description)) {
      out.description = description;
    }

    const identifierList = Array.from(xml.getElementsByTagNameNS(STAML_NS, "Identifier"));
    out.identifierList = identifierList.map(el => { return el.textContent ? el.textContent : ""; });

    const dataAvailEl = _grabFirstEl(xml, "DataAvailability");
    if (isDef(dataAvailEl)) {
      out.dataAvailability = convertToDataAvailability(dataAvailEl);
    }

    const commentArray = Array.from(xml.getElementsByTagNameNS(STAML_NS, "Comment"));
    const comments = [];
    for (const c of commentArray) {
      comments.push(convertToComment(c));
    }
    out.comments = comments;

    const equipmentArray = Array.from(xml.getElementsByTagNameNS(STAML_NS, "Equipment"));
    const equipmentList = [];
    for (const c of equipmentArray) {
      equipmentList.push(convertToEquipment(c));
    }
    out.equipmentList = equipmentList;

    const responseXml = xml.getElementsByTagNameNS(STAML_NS, "Response");

    if (responseXml && responseXml.length > 0) {
      const r = responseXml.item(0);

      if (r) {
        out.response = convertToResponse(r);
      }
    }

    return out;
  } catch (err) {
    throw reErrorWithMessage(err, `${locCode}.${chanCode}`);
  }
}

export function convertToDataAvailability(xml: Element): DataAvailability {
  const out = new DataAvailability();
  const extent = _grabFirstEl(xml, "Extent");
  if (extent && "start" in extent && "end" in extent) {
    const s = _grabAttribute(extent, "start");
    const e = _grabAttribute(extent, "end");
    if (s && e) {
      out.extent = Interval.fromDateTimes(DateTime.fromISO(s), DateTime.fromISO(e));
    }
  }

  const spanArray = Array.from(xml.getElementsByTagNameNS(STAML_NS, "Span"));
  const spanList = [];
  for (const c of spanArray) {
    const s = _grabAttribute(c, "start");
    const e = _grabAttribute(c, "end");
    if (s && e) {
      const span = new Span(Interval.fromDateTimes(DateTime.fromISO(s), DateTime.fromISO(e)));
      const numSeg = _grabAttribute(c, "numberSegments");
      if (numSeg) { span.numberSegments = parseInt(numSeg); }
      const maxTear = _grabAttribute(c, "maximumTimeTear");
      if (maxTear) { span.maximumTimeTear = parseFloat(maxTear); }
      spanList.push(span);
    }
  }
  out.spanList = spanList;

  return out;
}

export function convertToComment(xml: Element): Comment {
  let val = _grabFirstElText(xml, "Value");
  if (!val) { val = ""; }
  const out = new Comment(val);
  const id = _grabAttribute(xml, "id");
  if (id) { out.id = id; }
  const subject = _grabAttribute(xml, "subject");
  if (subject) { out.subject = subject; }
  const b = _grabFirstElText(xml, "BeginEffectiveTime");
  if (b) { out.beginEffectiveTime = DateTime.fromISO(b); }
  const e = _grabFirstElText(xml, "EndEffectiveTime");
  if (e) { out.endEffectiveTime = DateTime.fromISO(e); }
  const authList = Array.from(xml.getElementsByTagNameNS(STAML_NS, "Author"));
  out.authorList = authList.map(aEl => convertToAuthor(aEl));
  return out;
}

export function convertToAuthor(xml: Element): Author {
  const out = new Author();
  const name = _grabFirstElText(xml, "Name");
  if (name) { out.name = name; }
  const agency = _grabFirstElText(xml, "Agency");
  if (agency) { out.agency = agency; }
  const phEl = _grabFirstEl(xml, "Phone");
  if (phEl) {
    out.phone = `${_grabFirstElText(phEl, "CountryCode")}-${_grabFirstElText(phEl, "AreaCode")}-${_grabFirstElText(phEl, "PhoneNumber")}`;
  }
  return out;
}

export function convertToEquipment(xml: Element): Equipment {
  const out = new Equipment();
  let val;
  val = _grabFirstElText(xml, "Type");

  if (isNonEmptyStringArg(val)) {
    out.type = val;
  }

  val = _grabFirstElText(xml, "Description");

  if (isNonEmptyStringArg(val)) {
    out.description = val;
  }

  val = _grabFirstElText(xml, "Manufacturer");

  if (isNonEmptyStringArg(val)) {
    out.manufacturer = val;
  }

  val = _grabFirstElText(xml, "Vendor");

  if (isNonEmptyStringArg(val)) {
    out.vendor = val;
  }

  val = _grabFirstElText(xml, "Model");

  if (isNonEmptyStringArg(val)) {
    out.model = val;
  }

  val = _grabFirstElText(xml, "SerialNumber");

  if (isNonEmptyStringArg(val)) {
    out.serialNumber = val;
  }

  val = _grabFirstElText(xml, "InstallationDate");

  if (isNonEmptyStringArg(val)) {
    out.installationDate = checkStringOrDate(val);
  }

  val = _grabFirstElText(xml, "RemovalDate");

  if (isNonEmptyStringArg(val)) {
    out.removalDate = checkStringOrDate(val);
  }

  const calibXml = Array.from(xml.getElementsByTagNameNS(STAML_NS, "CalibrationDate"));
  out.calibrationDateList = [];

  for (const cal of calibXml) {
    if (isDef(cal.textContent)) {
      const d = checkStringOrDate(cal.textContent);
      if (isDef(d)) { out.calibrationDateList.push(d); }
    }
  }

  return out;
}

/**
 * Parses a FDSNStationXML Response xml element into a Response object.
 *
 * @param responseXml the response xml Element
 * @returns Response instance
 */
export function convertToResponse(responseXml: Element): Response {
  let out = new Response();
  const inst = responseXml.getElementsByTagNameNS(
    STAML_NS,
    "InstrumentSensitivity",
  );

  if (inst && inst.item(0)) {
    const i = inst.item(0);

    if (i) {
      out = new Response(convertToInstrumentSensitivity(i));
    }
  }

  if (!isDef(out)) {
    // DMC returns empty response element when they know nothing (instead
    // of just leaving it out). Return empty object in this case
    out = new Response();
  }

  const xmlStages = responseXml.getElementsByTagNameNS(STAML_NS, "Stage");

  if (xmlStages && xmlStages.length > 0) {
    const jsStages = Array.from(xmlStages).map(function(stageXml) {
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
export function convertToInstrumentSensitivity(
  xml: Element,
): InstrumentSensitivity {
  const sensitivity = _grabFirstElFloat(xml, "Value");

  const frequency = _grabFirstElFloat(xml, "Frequency");

  const inputUnits = _grabFirstElText(_grabFirstEl(xml, "InputUnits"), "Name");

  let outputUnits = _grabFirstElText(_grabFirstEl(xml, "OutputUnits"), "Name");

  if (FIX_INVALID_STAXML && !isDef(outputUnits)) {
    // assume last output unit is count?
    outputUnits = COUNT_UNIT_NAME;
  }

  if (
    !(
      isDef(sensitivity) &&
      isDef(frequency) &&
      isDef(inputUnits) &&
      isDef(outputUnits)
    )
  ) {
    throw new Error(
      `Not all elements of Sensitivity exist: ${sensitivity} ${frequency} ${inputUnits} ${outputUnits}`,
    );
  }

  return new InstrumentSensitivity(
    sensitivity,
    frequency,
    inputUnits,
    outputUnits,
  );
}

/**
 * Parses a FDSNStationXML Stage xml element into a Stage object.
 *
 * @param stageXml the Stage xml Element
 * @returns Stage instance
 */
export function convertToStage(stageXml: Element): Stage {
  const subEl = stageXml.firstElementChild;
  let filter: AbstractFilterType | null = null;

  if (!subEl) {
    throw new Error("Stage element has no child elements");
  } else if (
    stageXml.childElementCount === 1 &&
    subEl.localName === "StageGain"
  ) {
    // degenerate case of a gain only stage
    // fix the lack of units after all stages are converted.
  } else {
    // shoudl be a filter of some kind, check for units
    const inputUnits = _grabFirstElText(
      _grabFirstEl(stageXml, "InputUnits"),
      "Name",
    );

    const outputUnits = _grabFirstElText(
      _grabFirstEl(stageXml, "OutputUnits"),
      "Name",
    );

    if (!isNonEmptyStringArg(inputUnits)) {
      throw new Error("Stage inputUnits required");
    }

    if (!isNonEmptyStringArg(outputUnits)) {
      throw new Error("Stage outputUnits required");
    }

    // here we assume there must be a filter, and so must have units
    if (subEl.localName === "PolesZeros") {
      const pzFilter = new PolesZeros(inputUnits, outputUnits);

      const pzt = _grabFirstElText(stageXml, "PzTransferFunctionType");

      if (isNonEmptyStringArg(pzt)) {
        pzFilter.pzTransferFunctionType = pzt;
      }

      const nfa = _grabFirstElFloat(stageXml, "NormalizationFactor");

      if (isNumArg(nfa)) {
        pzFilter.normalizationFactor = nfa;
      }

      const nfr = _grabFirstElFloat(stageXml, "NormalizationFrequency");

      if (isNumArg(nfr)) {
        pzFilter.normalizationFrequency = nfr;
      }

      const zeros = Array.from(
        stageXml.getElementsByTagNameNS(STAML_NS, "Zero"),
      ).map(function(zeroEl) {
        return extractComplex(zeroEl);
      });
      const poles = Array.from(
        stageXml.getElementsByTagNameNS(STAML_NS, "Pole"),
      ).map(function(poleEl) {
        return extractComplex(poleEl);
      });
      pzFilter.zeros = zeros;
      pzFilter.poles = poles;
      filter = pzFilter;
    } else if (subEl.localName === "Coefficients") {
      const coeffXml = subEl;
      const cFilter = new CoefficientsFilter(inputUnits, outputUnits);

      const cft = _grabFirstElText(coeffXml, "CfTransferFunctionType");

      if (isNonEmptyStringArg(cft)) {
        cFilter.cfTransferFunction = cft;
      }

      cFilter.numerator = Array.from(
        coeffXml.getElementsByTagNameNS(STAML_NS, "Numerator"),
      ).map(function(numerEl) {
        return isNonEmptyStringArg(numerEl.textContent) ? parseFloat(numerEl.textContent) : null;
      }).filter(isDef);
      cFilter.denominator = Array.from(
        coeffXml.getElementsByTagNameNS(STAML_NS, "Denominator"),
      ).map(function(denomEl) {
        return isNonEmptyStringArg(denomEl.textContent) ? parseFloat(denomEl.textContent) : null;
      }).filter(isDef);
      filter = cFilter;
    } else if (subEl.localName === "ResponseList") {
      throw new Error("ResponseList not supported: ");
    } else if (subEl.localName === "FIR") {
      const firXml = subEl;
      const firFilter = new FIR(inputUnits, outputUnits);

      const s = _grabFirstElText(firXml, "Symmetry");

      if (isNonEmptyStringArg(s)) {
        firFilter.symmetry = s;
      }

      firFilter.numerator = Array.from(
        firXml.getElementsByTagNameNS(STAML_NS, "NumeratorCoefficient"),
      ).map(function(numerEl) {
        return isNonEmptyStringArg(numerEl.textContent) ? parseFloat(numerEl.textContent) : null;
      }).filter(isDef);
      filter = firFilter;
    } else if (subEl.localName === "Polynomial") {
      throw new Error("Polynomial not supported: ");
    } else if (subEl.localName === "StageGain") {
      // gain only stage, pick it up below
    } else {
      throw new Error("Unknown Stage type: " + subEl.localName);
    }

    if (filter) {
      // add description and name if it was there
      const description = _grabFirstElText(subEl, "Description");

      if (isNonEmptyStringArg(description)) {
        filter.description = description;
      }

      if (subEl.hasAttribute("name")) {
        const n = _grabAttribute(subEl, "name");

        if (isNonEmptyStringArg(n)) {
          filter.name = n;
        }
      }
    }
  }

  const decimationXml = _grabFirstEl(stageXml, "Decimation");

  let decimation: Decimation | null = null;

  if (decimationXml) {
    decimation = convertToDecimation(decimationXml);
  }

  const gainXml = _grabFirstEl(stageXml, "StageGain");

  let gain = null;

  if (gainXml) {
    gain = convertToGain(gainXml);
  } else {
    throw new Error(
      "Did not find Gain in stage number " +
      stringify(_grabAttribute(stageXml, "number")),
    );
  }

  const out = new Stage(filter, decimation, gain);
  return out;
}

/**
 * Parses a FDSNStationXML Decimation xml element into a Decimation object.
 *
 * @param decXml the Decimation xml Element
 * @returns Decimation instance
 */
export function convertToDecimation(decXml: Element): Decimation {
  let out: Decimation;

  const insr = _grabFirstElFloat(decXml, "InputSampleRate");
  const fac = _grabFirstElInt(decXml, "Factor");

  if (isNumArg(insr) && isNumArg(fac)) {
    out = new Decimation(insr, fac);
  } else {
    throw new Error(`Decimation without InputSampleRate and Factor: ${insr} ${fac}`);
  }

  out.offset = _grabFirstElInt(decXml, "Offset");
  out.delay = _grabFirstElFloat(decXml, "Delay");
  out.correction = _grabFirstElFloat(decXml, "Correction");
  return out;
}

/**
 * Parses a FDSNStationXML Gain xml element into a Gain object.
 *
 * @param gainXml the Gain xml Element
 * @returns Gain instance
 */
export function convertToGain(gainXml: Element): Gain {
  let out: Gain;

  const v = _grabFirstElFloat(gainXml, "Value");
  const f = _grabFirstElFloat(gainXml, "Frequency");

  if (isNumArg(v) && isNumArg(f)) {
    out = new Gain(v, f);
  } else {
    throw new Error(`Gain does not have value and frequency: ${v} ${f}`);
  }
  return out;
}

export function createInterval(start: DateTime, end: null | DateTime): Interval {
  if (end) {
    return Interval.fromDateTimes(start, end);
  } else {
    return Interval.fromDateTimes(start, WAY_FUTURE);
  }
}
/**
 * Extracts a complex number from an stationxml element.
 *
 * @param   el xml element
 * @returns     Complex instance
 */
export function extractComplex(el: Element): InstanceType<typeof Complex> {
  const re = _grabFirstElFloat(el, "Real");

  const im = _grabFirstElFloat(el, "Imaginary");

  if (isNumArg(re) && isNumArg(im)) {
    return new Complex(re, im);
  } else {
    throw new Error(`Both Real and Imaginary required: ${re} ${im}`);
  }
}

/**
 * Generator function to access all stations within all networks in the array.
 *
 * @param      networks array of Networks
 * @yields           generator yeiding stations
 */
export function* allStations(
  networks: Array<Network>,
): Generator<Station, void, any> {
  for (const n of networks) {
    for (const s of n.stations) {
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
export function* allChannels(
  networks: Array<Network>,
): Generator<Channel, void, any> {
  for (const s of allStations(networks)) {
    for (const c of s.channels) {
      yield c;
    }
  }
}

/**
 * Extract all channels from all stations from all networks in the input array.
 * Regular expressions may be used instaed of exact code matchs.
 *
 * @param   networks Array of networks.
 * @param   netCode network code to match
 * @param   staCode station code to match
 * @param   locCode location code to match
 * @param   chanCode channel code to match
 * @yields           Array of channels.
 */
export function* findChannels(
  networks: Array<Network>,
  netCode: string,
  staCode: string,
  locCode: string,
  chanCode: string,
): Generator<Channel, void, any> {
  const netRE = new RegExp(`^${netCode}$`);
  const staRE = new RegExp(`^${staCode}$`);
  const locRE = new RegExp(`^${locCode}$`);
  const chanRE = new RegExp(`^${chanCode}$`);

  for (const n of networks.filter(n => netRE.test(n.networkCode))) {
    for (const s of n.stations.filter(s => staRE.test(s.stationCode))) {
      for (const c of s.channels.filter(
        c => locRE.test(c.locationCode) && chanRE.test(c.channelCode),
      )) {
        yield c;
      }
    }
  }
}

export function uniqueSourceIds(channelList: Iterable<Channel>): Array<FDSNSourceId> {
  const out = new Map<string, FDSNSourceId>();
  for (const c of channelList) {
    if (c) {
      out.set(c.sourceId.toString(), c.sourceId);
    }
  }
  return Array.from(out.values()).sort(SourceIdSorter);
}

export function uniqueStations(
  channelList: Iterable<Channel>,
): Array<Station> {
  const out = new Set<Station>();
  for (const c of channelList) {
    if (c) {
      out.add(c.station);
    }
  }
  return Array.from(out.values());
}

export function uniqueNetworks(
  channelList: Iterable<Channel>,
): Array<Network> {
  const out = new Set<Network>();
  for (const c of channelList) {
    if (c) {
      out.add(c.station.network);
    }
  }
  return Array.from(out.values());
}


// these are similar methods as in seisplotjs.quakeml
// duplicate here to avoid dependency and diff NS, yes that is dumb...
const _grabFirstEl = function(
  xml: Element | null | void,
  tagName: string,
): Element | null {
  let out = null;

  if (xml instanceof Element) {
    const el = xml.getElementsByTagName(tagName);

    if (isObject(el) && el.length > 0) {
      const e = el.item(0);

      if (e) {
        out = e;
      }
    }
  }

  return out;
};

const _grabFirstElText = function _grabFirstElText(
  xml: Element | null | void,
  tagName: string,
): string | null {
  let out = null;

  const el = _grabFirstEl(xml, tagName);

  if (el instanceof Element) {
    out = el.textContent;
  }

  return out;
};

const _grabFirstElFloat = function _grabFirstElFloat(
  xml: Element | null | void,
  tagName: string,
): number | null {
  let out = null;

  const elText = _grabFirstElText(xml, tagName);

  if (isStringArg(elText)) {
    out = parseFloat(elText);
  }

  return out;
};

const _grabFirstElInt = function _grabFirstElInt(
  xml: Element | null | void,
  tagName: string,
): number | null {
  let out = null;

  const elText = _grabFirstElText(xml, tagName);

  if (isStringArg(elText)) {
    out = parseInt(elText);
  }

  return out;
};

const _grabAttribute = function _grabAttribute(
  xml: Element | null | void,
  tagName: string,
): string | null {
  let out = null;

  if (xml instanceof Element) {
    const a = xml.getAttribute(tagName);

    if (isStringArg(a)) {
      out = a;
    }
  }

  return out;
};

const _requireAttribute = function _requireAttribute(
  xml: Element | null | void,
  tagName: string,
): string {
  const out = _grabAttribute(xml, tagName);
  if (typeof out !== "string") {
    throw new Error(`Attribute ${tagName} not found.`);
  }
  return out;
};

const _grabAttributeNS = function(
  xml: Element | null | void,
  namespace: string,
  tagName: string,
): string | null {
  let out = null;

  if (xml instanceof Element) {
    const a = xml.getAttributeNS(namespace, tagName);

    if (isStringArg(a)) {
      out = a;
    }
  }

  return out;
};

export const parseUtil = {
  _grabFirstEl: _grabFirstEl,
  _grabFirstElText: _grabFirstElText,
  _grabFirstElFloat: _grabFirstElFloat,
  _grabFirstElInt: _grabFirstElInt,
  _grabAttribute: _grabAttribute,
  _requireAttribute: _requireAttribute,
  _grabAttributeNS: _grabAttributeNS,
};
