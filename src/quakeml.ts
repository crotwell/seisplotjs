/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */
import {Station, Channel} from "./stationxml";
import {
  isDef,
  isObject,
  isStringArg,
  isNonEmptyStringArg,
  isNumArg,
  isoToDateTime,
  stringify,
} from "./util";
import * as util from "./util"; // for util.log

import {DateTime} from "luxon";

export const QML_NS = "http://quakeml.org/xmlns/quakeml/1.2";
export const BED_NS = "http://quakeml.org/xmlns/bed/1.2";
export const IRIS_NS = "http://service.iris.edu/fdsnws/event/1/";
export const ANSS_NS = "http://anss.org/xmlns/event/0.1";
export const ANSS_CATALOG_NS = "http://anss.org/xmlns/catalog/0.1";
export const USGS_HOST = "earthquake.usgs.gov";
export const UNKNOWN_MAG_TYPE = "unknown";
export const UNKNOWN_PUBLIC_ID = "unknownId";
export const FAKE_ORIGIN_TIME = DateTime.fromISO("1900-01-01T00:00:00Z");


export const QUAKE_CLICK_EVENT = "quakeclick";

/**
 * Utility function to create CustomEvent for clicking on a Quake, for example
 * in a map or table.
 *
 * @param  q          Quake clicked on
 * @param  mouseclick original mouse click Event
 * @returns           CustomEvent populated with quake field in detail.
 */
export function createQuakeClickEvent(q: Quake, mouseclick: Event): CustomEvent {
  const detail = {
    mouseevent: mouseclick,
    quake: q,
  };
  return new CustomEvent(QUAKE_CLICK_EVENT, { detail: detail});
}

// QuakeML classes

class BaseElement {
  publicId: string = UNKNOWN_PUBLIC_ID;
  comments: Comment[] = [];
  creationInfo?: CreationInfo;

  protected populate(qml: Element): void {
    const pid = _grabAttribute(qml, "publicID");
    if (!isNonEmptyStringArg(pid)) {
      throw new Error("missing publicID");
    }

    this.publicId = pid;
    this.comments = _grabAllElComment(qml, "comment");
    this.creationInfo = _grabFirstElCreationInfo(qml, "creationInfo");
  }
}

/**
 * Represent a QuakeML Event. Renamed to Quake as Event conflicts with
 * other uses in javascript.
 */
export class Quake {
  eventId: string|undefined;
  publicId: string;
  description = "";
  magnitudeList: Array<Magnitude> = [];
  originList: Array<Origin> = [];
  pickList: Array<Pick> = [];
  preferredOriginId: string | undefined;
  _preferredOrigin: Origin | null = null;
  preferredMagnitudeId: string | undefined;
  _preferredMagnitude: Magnitude | null = null;

  constructor(publicId: string) {
    // what is essential???
    this.publicId = publicId;
  }

  /**
   * Parses a QuakeML event xml element into a Quake object. Pass in
   * host=seisplotjs.fdsnevent.USGS_HOST for xml from the USGS service
   * in order to parse the eventid, otherwise this can be left out
   *
   * @param qml the event xml Element
   * @param host optional source of the xml, helpful for parsing the eventid
   * @returns QuakeML Quake(Event) object
   */
  static createFromXml(qml: Element, host?: string): Quake {
    if (qml.localName !== "event") {
      throw new Error(`Cannot extract, not a QuakeML Event: ${qml.localName}`);
    }


    const publicId = _requireAttribute(qml, "publicID");
    const out = new Quake(publicId);

    const desc = _grabFirstElText(_grabFirstEl(qml, "description"), "text");

    if (isStringArg(desc)) {
      out.description = desc;
    }

    //need picks before can do origins
    const allPickEls = Array.from(qml.getElementsByTagNameNS(BED_NS, "pick"));
    const allPicks = [];

    for (const pickEl of allPickEls) {
      allPicks.push(Pick.createFromXml(pickEl));
    }

    const allOriginEls = Array.from(qml.getElementsByTagNameNS(BED_NS, "origin"));
    const allOrigins = [];

    for (const originEl of allOriginEls) {
      allOrigins.push(Origin.createFromXml(originEl, allPicks));
    }

    const allMagEls = Array.from(qml.getElementsByTagNameNS(BED_NS, "magnitude"));
    const allMags = [];

    for (const magEl of allMagEls) {
      allMags.push(Magnitude.createFromXml(magEl));
    }

    out.originList = allOrigins;
    out.magnitudeList = allMags;
    out.pickList = allPicks;
    out.eventId = Quake.extractEventId(qml, host);
    out.preferredOriginId = _grabFirstElText(qml, "preferredOriginID");
    out.preferredMagnitudeId = _grabFirstElText(qml, "preferredMagnitudeID");

    if (isNonEmptyStringArg(out.preferredOriginId)) {
      for (const o of allOrigins) {
        if (o.publicId === out.preferredOriginId) {
          out._preferredOrigin = o;
        } else {
          util.log(
            `no preferredOriginId match: ${o.publicId} ${out.preferredOriginId}`,
          );
          out._preferredOrigin = null;
        }
      }
    }

    if (isNonEmptyStringArg(out.preferredMagnitudeId)) {
      for (const m of allMags) {
        if (m.publicId === out.preferredMagnitudeId) {
          out._preferredMagnitude = m;
        } else {
          util.log(`no match: ${m.publicId} ${out.preferredMagnitudeId}`);
          out._preferredMagnitude = null;
        }
      }
    }

    return out;
  }

  /**
   * Extracts the EventId from a QuakeML element, guessing from one of several
   * incompatible (grumble grumble) formats.
   *
   * @param   qml Quake(Event) to extract from
   * @param   host optional source of the xml to help determine the event id style
   * @returns     Extracted Id, or "unknownEventId" if we can't figure it out
   */
  static extractEventId(qml: Element, host?: string): string {
    const eventId = _grabAttributeNS(qml, ANSS_CATALOG_NS, "eventid");

    const catalogEventSource = _grabAttributeNS(
      qml,
      ANSS_CATALOG_NS,
      "eventsource",
    );

    if (isNonEmptyStringArg(eventId)) {
      if (host === USGS_HOST && isNonEmptyStringArg(catalogEventSource)) {
        // USGS, NCEDC and SCEDC use concat of eventsource and eventId as eventid, sigh...
        return catalogEventSource + eventId;
      } else {
        return eventId;
      }
    }

    const publicid = _grabAttribute(qml, "publicID");

    if (isNonEmptyStringArg(publicid)) {
      let re = /eventid=([\w\d]+)/;
      let parsed = re.exec(publicid);

      if (parsed) {
        return parsed[1];
      }

      re = /evid=([\w\d]+)/;
      parsed = re.exec(publicid);

      if (parsed) {
        return parsed[1];
      }
    }

    return UNKNOWN_PUBLIC_ID;
  }

  hasPreferredOrigin() {
    return isDef(this._preferredOrigin);
  }
  get preferredOrigin(): Origin {
    if (isDef(this._preferredOrigin)) {
      return this._preferredOrigin;
    } else {
      throw new Error("No preferred origin");
    }
  }
  hasOrigin() {
    return isDef(this._preferredOrigin) || this.originList.length > 1;
  }
  get origin(): Origin {
    if (isDef(this._preferredOrigin)) {
      return this._preferredOrigin;
    } else if (this.originList.length > 0) {
      return this.originList[0];
    } else {
      throw new Error("No origins in quake");
    }
  }
  hasPreferredMagnitude() {
    return isDef(this._preferredMagnitude);
  }
  get preferredMagnitude(): Magnitude {
    if (isDef(this._preferredMagnitude)) {
      return this._preferredMagnitude;
    } else {
      throw new Error("No preferred Magnitude");
    }
  }
  hasMagnitude() {
    return isDef(this._preferredMagnitude) || this.magnitudeList.length > 1;
  }
  get magnitude(): Magnitude {
    if (isDef(this._preferredMagnitude)) {
      return this._preferredMagnitude;
    } else if (this.magnitudeList.length > 0) {
      return this.magnitudeList[0];
    } else {
      throw new Error("No magnitudes in quake");
    }
  }
  get time(): DateTime {
    return this.origin.time;
  }
  get latitude(): number {
    return this.origin.latitude;
  }
  get longitude(): number {
    return this.origin.longitude;
  }
  get depth(): number {
    return this.origin.depth;
  }

  get depthKm(): number {
    return this.depth / 1000;
  }

  get arrivals(): Array<Arrival> {
    return this.preferredOrigin.arrivalList;
  }

  get picks(): Array<Pick> {
    return this.pickList;
  }

  toString(): string {
    if (this.hasOrigin()) {
      const magStr = this.hasMagnitude() ? this.magnitude.toString() : "";
      return (
        stringify(this.time) +
        " " +
        stringify(this.latitude) +
        "/" +
        stringify(this.longitude) +
        " " +
        stringify(this.depth / 1000) +
        " km" +
        " " +
        magStr
      );
    } else {
      return `Event: ${this.eventId}`;
    }
  }
}

/** Represents a QuakeML Origin. */
export class Origin {
  time: DateTime;
  latitude: number;
  longitude: number;
  depth: number;
  arrivalList: Array<Arrival>;
  publicId: string;

  constructor() {
    // what is essential???
    this.time = FAKE_ORIGIN_TIME;
    this.latitude = Number.NaN;
    this.longitude = Number.NaN;
    this.depth = 0;
    this.arrivalList = [];
    this.publicId = UNKNOWN_PUBLIC_ID;
  }

  /**
   * Parses a QuakeML origin xml element into a Origin object.
   *
   * @param qml the origin xml Element
   * @param allPicks picks already extracted from the xml for linking arrivals with picks
   * @returns Origin instance
   */
  static createFromXml(qml: Element, allPicks: Array<Pick>): Origin {
    if (qml.localName !== "origin") {
      throw new Error(`Cannot extract, not a QuakeML Origin: ${qml.localName}`);
    }

    const out = new Origin();

    const otimeStr = _grabFirstElText(_grabFirstEl(qml, "time"), "value");

    if (isNonEmptyStringArg(otimeStr)) {
      out.time = isoToDateTime(otimeStr);
    } else {
      util.log("origintime is missing...");
    }

    const lat = _grabFirstElFloat(_grabFirstEl(qml, "latitude"), "value");

    if (isNumArg(lat)) {
      out.latitude = lat;
    }

    const lon = _grabFirstElFloat(_grabFirstEl(qml, "longitude"), "value");

    if (isNumArg(lon)) {
      out.longitude = lon;
    }

    const depth = _grabFirstElFloat(_grabFirstEl(qml, "depth"), "value");

    if (isNumArg(depth)) {
      out.depth = depth;
    }

    const pid = _grabAttribute(qml, "publicID");

    if (isNonEmptyStringArg(pid)) {
      out.publicId = pid;
    }

    const allArrivalEls = Array.from(qml.getElementsByTagNameNS(BED_NS, "arrival"));
    const allArrivals = [];

    for (const arrivalEl of allArrivalEls) {
      allArrivals.push(Arrival.createFromXml(arrivalEl, allPicks));
    }

    out.arrivalList = allArrivals;
    return out;
  }

  toString(): string {
    return (
      stringify(this.time) +
      " " +
      stringify(this.latitude) +
      " " +
      stringify(this.longitude) +
      " " +
      stringify(this.depth)
    );
  }

  get arrivals(): Array<Arrival> {
    return this.arrivalList;
  }
}

/**
  Represents a QuakeML Magnitude.
 */
export class Magnitude extends BaseElement {
  mag: RealQuantity;
  type?: string;
  stationCount?: number;
  azimuthalGap?: number;
  evaluationMode?: string;
  evaluationStatus?: string;

  constructor(mag: RealQuantity) {
    super();
    this.mag = mag;
  }

  /**
   * Parses a QuakeML magnitude xml element into a Magnitude object.
   *
   * @param qml the magnitude xml Element
   * @returns Magnitude instance
   */
  static createFromXml(qml: Element): Magnitude {
    if (qml.localName !== "magnitude") {
      throw new Error(
        `Cannot extract, not a QuakeML Magnitude: ${qml.localName}`,
      );
    }

    const mag = _grabFirstElRealQuantity(qml, "mag");
    if (!mag) {
      throw new Error("magnitude missing mag");
    }

    const type = _grabFirstElText(qml, "type");

    const stationCount = _grabFirstElInt(qml, "stationCount");

    const azimuthalGap = _grabFirstElFloat(qml, "azimuthalGap");

    const evaluationMode = _grabFirstElText(qml, "evaluationMode");

    const evaluationStatus = _grabFirstElText(qml, "evaluationStatus");

    const out = new Magnitude(mag);

    out.populate(qml);
    out.type = type;
    out.stationCount = stationCount;
    out.azimuthalGap = azimuthalGap;
    out.evaluationMode = evaluationMode;
    out.evaluationStatus = evaluationStatus;

    return out;
  }

  toString(): string {
    return stringify(this.mag) + " " + stringify(this.type);
  }
}

/**
  Represents a QuakeML Arrival, a combination of a Pick with a phase name.
 */
export class Arrival extends BaseElement {
  phase: string;
  pick: Pick;
  timeCorrection?: number;
  azimuth?: number;
  distance?: number;
  takeoffAngle?: RealQuantity;
  timeResidual?: number;
  horizontalSlownessResidual?: number;
  backazimuthResidual?: number;
  timeWeight?: number;
  horizontalSlownessWeight?: number;
  backazimuthWeight?: number;

  constructor(phase: string, pick: Pick) {
    super();
    this.phase = phase;
    this.pick = pick;
  }

  /**
   * Parses a QuakeML arrival xml element into a Arrival object.
   *
   * @param arrivalQML the arrival xml Element
   * @param allPicks picks already extracted from the xml for linking arrivals with picks
   * @returns Arrival instance
   */
  static createFromXml(arrivalQML: Element, allPicks: Array<Pick>): Arrival {
    if (arrivalQML.localName !== "arrival") {
      throw new Error(
        `Cannot extract, not a QuakeML Arrival: ${arrivalQML.localName}`,
      );
    }

    const pickId = _grabFirstElText(arrivalQML, "pickID");

    const phase = _grabFirstElText(arrivalQML, "phase");

    const timeCorrection = _grabFirstElFloat(arrivalQML, "timeCorrection");

    const azimuth = _grabFirstElFloat(arrivalQML, "azimuth");

    const distance = _grabFirstElFloat(arrivalQML, "distance");

    const takeoffAngle = _grabFirstElRealQuantity(arrivalQML, "takeoffAngle");

    const timeResidual = _grabFirstElFloat(arrivalQML, "timeResidual");

    const horizontalSlownessResidual = _grabFirstElFloat(arrivalQML, "horizontalSlownessResidual");

    const backazimuthResidual = _grabFirstElFloat(arrivalQML, "backazimuthResidual");

    const timeWeight = _grabFirstElFloat(arrivalQML, "timeWeight");

    const horizontalSlownessWeight = _grabFirstElFloat(arrivalQML, "horizontalSlownessWeight");

    const backazimuthWeight = _grabFirstElFloat(arrivalQML, "backazimuthWeight");

    if (isNonEmptyStringArg(phase) && isNonEmptyStringArg(pickId)) {
      const myPick = allPicks.find(function (p: Pick) {
        return p.publicId === pickId;
      });

      if (!myPick) {
        throw new Error("Can't find pick with Id=" + pickId + " for Arrival");
      }

      const out = new Arrival(phase, myPick);

      out.populate(arrivalQML);
      out.timeCorrection = timeCorrection;
      out.azimuth = azimuth;
      out.distance = distance;
      out.takeoffAngle = takeoffAngle;
      out.timeResidual = timeResidual;
      out.horizontalSlownessResidual = horizontalSlownessResidual;
      out.backazimuthResidual = backazimuthResidual;
      out.timeWeight = timeWeight;
      out.horizontalSlownessWeight = horizontalSlownessWeight;
      out.backazimuthWeight = backazimuthWeight;

      return out;
    } else {
      throw new Error(
        "Arrival does not have phase or pickId: " +
          stringify(phase) +
          " " +
          stringify(pickId),
      );
    }
  }
}

/**
  Represents a QuakeML Pick.
 */
export class Pick extends BaseElement {
  time: TimeQuantity;
  networkCode: string;
  stationCode: string;
  locationCode: string;
  channelCode: string;
  horizontalSlowness?: RealQuantity;
  backazimuth?: RealQuantity;
  onset?: string;
  phaseHint?: string;
  polarity?: string;
  evaluationMode?: string;
  evaluationStatus?: string;

  constructor(
    time: TimeQuantity,
    networkCode: string,
    stationCode: string,
    locationCode: string,
    channelCode: string,
  ) {
    super();
    this.time = time;
    this.networkCode = networkCode;
    this.stationCode = stationCode;
    this.locationCode = locationCode;
    this.channelCode = channelCode;
  }

  /**
   * Parses a QuakeML pick xml element into a Pick object.
   *
   * @param pickQML the pick xml Element
   * @returns Pick instance
   */
  static createFromXml(pickQML: Element): Pick {
    if (pickQML.localName !== "pick") {
      throw new Error(
        `Cannot extract, not a QuakeML Pick: ${pickQML.localName}`,
      );
    }

    const time = _grabFirstElTimeQuantity(pickQML, "time");
    if (! isDef(time)) {throw new Error("Missing time");}

    const waveformIdEl = _grabFirstEl(pickQML, "waveformID");

    const netCode = _grabAttribute(waveformIdEl, "networkCode");

    const stationCode = _grabAttribute(waveformIdEl, "stationCode");

    let locationCode = _grabAttribute(waveformIdEl, "locationCode");

    const channelCode = _grabAttribute(waveformIdEl, "channelCode");

    const horizontalSlowness = _grabFirstElRealQuantity(pickQML, "horizontalSlowness");

    const backazimuth = _grabFirstElRealQuantity(pickQML, "backazimuth");

    const onset = _grabFirstElText(pickQML, "onset");

    const phaseHint = _grabFirstElText(pickQML, "phaseHint");

    const polarity = _grabFirstElText(pickQML, "polarity");

    const evaluationMode = _grabFirstElText(pickQML, "evaluationMode");

    const evaluationStatus = _grabFirstElText(pickQML, "evaluationStatus");

    // handle empty loc code, it can be missing
    if (!isNonEmptyStringArg(locationCode)) {
      locationCode = "";
    }

    if (
      !isNonEmptyStringArg(netCode) ||
      !isNonEmptyStringArg(stationCode) ||
      !isNonEmptyStringArg(channelCode)
    ) {
      throw new Error(
        "missing codes: " +
          stringify(netCode) +
          "." +
          stringify(stationCode) +
          "." +
          stringify(locationCode) +
          "." +
          stringify(channelCode),
      );
    }

    const out = new Pick(time, netCode, stationCode, locationCode, channelCode);

    out.populate(pickQML);
    out.horizontalSlowness = horizontalSlowness;
    out.backazimuth = backazimuth;
    out.onset = onset;
    out.phaseHint = phaseHint;
    out.polarity = polarity;
    out.evaluationMode = evaluationMode;
    out.evaluationStatus = evaluationStatus;

    return out;
  }

  isAtStation(station: Station): boolean {
    return (
      this.networkCode === station.networkCode &&
      this.stationCode === station.stationCode
    );
  }

  isOnChannel(channel: Channel): boolean {
    return (
      this.networkCode === channel.station.networkCode &&
      this.stationCode === channel.station.stationCode &&
      this.locationCode === channel.locationCode &&
      this.channelCode === channel.channelCode
    );
  }
  toString(): string {
    return stringify(this.time) + ` ${this.networkCode}.${this.stationCode}.${this.locationCode}.${this.channelCode}`;
  }
}

class Quantity<T> {
  value: T;
  uncertainty?: number;
  lowerUncertainty?: number;
  upperUncertainty?: number;
  confidenceLevel?: number;

  constructor(value: T) {
    this.value = value;
  }

  /**
   * Parses a QuakeML quantity xml element into a RealQuantity object.
   *
   * @param quantityQML the quantity xml Element
   * @param grab a callback to obtain the value
   * @returns RealQuantity instance
   */
  static _createFromXml<T>(quantityQML: Element, grab: (xml: Element | null | void, tagName: string) => T | undefined): Quantity<T> {
    const value = grab(quantityQML, "value");

    const uncertainty = _grabFirstElFloat(quantityQML, "uncertainty");

    const lowerUncertainty = _grabFirstElFloat(quantityQML, "lowerUncertainty");

    const upperUncertainty = _grabFirstElFloat(quantityQML, "upperUncertainty");

    const confidenceLevel = _grabFirstElFloat(quantityQML, "confidenceLevel");

    if (value === undefined) {
      throw new Error("missing value");
    }

    const out = new Quantity<T>(value);

    out.uncertainty = uncertainty;
    out.lowerUncertainty = lowerUncertainty;
    out.upperUncertainty = upperUncertainty;
    out.confidenceLevel = confidenceLevel;

    return out;
  }

  /**
   * Parses a QuakeML real quantity xml element into a RealQuantity object.
   *
   * @param realQuantityQML the real quantity xml Element
   * @returns RealQuantity instance
   */
  static createRealQuantityFromXml(realQuantityQML: Element): RealQuantity {
    return Quantity._createFromXml(realQuantityQML, _grabFirstElFloat);
  }

  /**
   * Parses a QuakeML real quantity xml element into a RealQuantity object.
   *
   * @param timeQuantityQML the time quantity xml Element
   * @returns TimeQuantity instance
   */
  static createTimeQuantityFromXml(timeQuantityQML: Element): TimeQuantity {
    return Quantity._createFromXml(timeQuantityQML, _grabFirstElDateTime);
  }
}

export type RealQuantity = Quantity<number>;
export type TimeQuantity = Quantity<DateTime>;

/**
  Represents a QuakeML comment.
 */
export class Comment {
  text: string;
  creationInfo?: CreationInfo;

  constructor(text: string) {
    this.text = text;
  }

  /**
   * Parses a QuakeML comment xml element into a Comment object.
   *
   * @param commentQML the comment xml Element
   * @returns Comment instance
   */
  static createFromXml(commentQML: Element): Comment {
    const text = _grabFirstElText(commentQML, "text");

    const creationInfo = _grabFirstElCreationInfo(commentQML, "creationInfo");

    if (text === undefined) {
      throw new Error("missing value");
    }

    const out = new Comment(text);

    out.creationInfo = creationInfo;

    return out;
  }
}

export class CreationInfo {
  agencyID?: string;
  agencyURI?: string;
  author?: string;
  authorURI?: string;
  creationTime?: DateTime;
  version?: string;

  /**
   * Parses a QuakeML creation info xml element into a CreationInfo object.
   *
   * @param creationInfoQML the creation info xml Element
   * @returns CreationInfo instance
   */
  static createFromXml(creationInfoQML: Element): CreationInfo {
    const agencyID = _grabFirstElText(creationInfoQML, "agencyID");

    const agencyURI = _grabFirstElText(creationInfoQML, "agencyURI");

    const author = _grabFirstElText(creationInfoQML, "author");

    const authorURI = _grabFirstElText(creationInfoQML, "authorURI");

    const creationTime = _grabFirstElDateTime(creationInfoQML, "creationTime");

    const version = _grabFirstElText(creationInfoQML, "version");

    const out = new CreationInfo();

    out.agencyID = agencyID;
    out.agencyURI = agencyURI;
    out.author = author;
    out.authorURI = authorURI;
    out.creationTime = creationTime;
    out.version = version;

    return out;
  }
}

/**
 * Parses a QuakeML xml document into seisplotjs objects
 *
 *  @param rawXml the xml Document to parse
 *  @param host optional source of the xml, helpful for parsing the eventid
 *  @returns array of Quake objects
 */
export function parseQuakeML(rawXml: Document, host?: string): Array<Quake> {
  const top = rawXml.documentElement;

  if (!top) {
    throw new Error("Can't get documentElement");
  }

  const eventArray = Array.from(top.getElementsByTagName("event"));
  const out = [];

  for (const eventEl of eventArray) {
    out.push(Quake.createFromXml(eventEl, host));
  }

  return out;
}

export function createQuakeFromValues(publicId: string,
  time: DateTime,
  latitude: number,
  longitude: number,
  depth: number): Quake {
    const origin = new Origin();
    origin.time = time;
    origin.latitude =  latitude;
    origin.longitude = longitude;
    origin.depth = depth;
    const quake = new Quake(publicId);
    quake.originList.push(origin);
    return quake;
}

// these are similar methods as in seisplotjs.stationxml
// duplicate here to avoid dependency and diff NS, yes that is dumb...

const _grabAllElComment = function (
  xml: Element | null | void,
  tagName: string,
): Comment[] {

  const out = [];

  if (isObject(xml)) {
    const elList = xml.getElementsByTagName(tagName);
    if (isObject(elList) && elList.length > 0) {
      for (let i = 0; i < elList.length; ++i) {
        const el = elList.item(i);
        if (isObject(el)) {
          out.push(Comment.createFromXml(el));
        }
      }
    }
  }

  return out;
};

const _grabFirstElNS = function (
  xml: Element | null | void,
  namespace: string,
  tagName: string,
): Element | undefined {
  let out = undefined;

  if (isObject(xml)) {
    const elList = xml.getElementsByTagNameNS(namespace, tagName);

    if (isObject(elList) && elList.length > 0) {
      const e = elList.item(0);

      if (e) {
        out = e;
      }
    }
  }

  return out;
};

const _grabFirstEl = function (
  xml: Element | null | void,
  tagName: string,
): Element | undefined {
  let out = undefined;

  if (isObject(xml)) {
    const elList = xml.getElementsByTagName(tagName);

    if (isObject(elList) && elList.length > 0) {
      const e = elList.item(0);

      if (e) {
        out = e;
      }
    }
  }

  return out;
};

const _grabFirstElText = function (
  xml: Element | null | void,
  tagName: string,
): string | undefined {
  let out = undefined;

  const el = _grabFirstEl(xml, tagName);

  if (isObject(el)) {
    out = el.textContent;
    if (out === null) {out = undefined;}
  }

  return out;
};

const _grabFirstElInt = function (
  xml: Element | null | void,
  tagName: string,
): number | undefined {
  let out = undefined;

  const el = _grabFirstElText(xml, tagName);

  if (isStringArg(el)) {
    out = parseInt(el);
  }

  return out;
};

const _grabFirstElFloat = function (
  xml: Element | null | void,
  tagName: string,
): number | undefined {
  let out = undefined;

  const el = _grabFirstElText(xml, tagName);

  if (isStringArg(el)) {
    out = parseFloat(el);
  }

  return out;
};

const _grabFirstElDateTime = function (
  xml: Element | null | void,
  tagName: string,
): DateTime | undefined {
  let out = undefined;

  const el = _grabFirstElText(xml, tagName);

  if (isStringArg(el)) {
    out = isoToDateTime(el);
  }

  return out;
};

const _grabFirstElType = function<T>(createFromXml: (el: Element) => T) {
  return function(
    xml: Element | null | void,
    tagName: string,
  ): T | undefined {
    let out = undefined;

    const el = _grabFirstEl(xml, tagName);

    if (isObject(el)) {
      out = createFromXml(el);
    }

    return out;
  };
};

const _grabFirstElRealQuantity = _grabFirstElType(Quantity.createRealQuantityFromXml.bind(Quantity));
const _grabFirstElTimeQuantity = _grabFirstElType(Quantity.createTimeQuantityFromXml.bind(Quantity));

const _grabFirstElCreationInfo = _grabFirstElType(CreationInfo.createFromXml.bind(CreationInfo));

const _grabAttribute = function (
  xml: Element | null | void,
  tagName: string,
): string | undefined {
  let out = undefined;

  if (isObject(xml)) {
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

const _grabAttributeNS = function (
  xml: Element | null | void,
  namespace: string,
  tagName: string,
): string | undefined {
  let out = undefined;

  if (isObject(xml)) {
    const a = xml.getAttributeNS(namespace, tagName);

    if (isStringArg(a)) {
      out = a;
    }
  }

  return out;
};

export const parseUtil = {
  _grabFirstEl: _grabFirstEl,
  _grabFirstElNS: _grabFirstElNS,
  _grabFirstElText: _grabFirstElText,
  _grabFirstElFloat: _grabFirstElFloat,
  _grabFirstElInt: _grabFirstElInt,
  _grabAttribute: _grabAttribute,
  _requireAttribute: _requireAttribute,
  _grabAttributeNS: _grabAttributeNS,
};
