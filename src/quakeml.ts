/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * https://www.seis.sc.edu
 */
import {Station, Channel} from "./stationxml";
import {
  isDef,
  isObject,
  isStringArg,
  isNonEmptyStringArg,
  isoToDateTime,
  stringify,
} from "./util";

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
 * Represent a QuakeML EventParameters.
 */
export class EventParameters extends BaseElement {
  eventList: Quake[] = [];
  description?: string;

  /**
   * Parses a QuakeML event parameters xml element into an EventParameters object.
   *
   * @param eventParametersQML the event parameters xml Element
   * @param host optional source of the xml, helpful for parsing the eventid
   * @returns EventParameters instance
   */
  static createFromXml(eventParametersQML: Element, host?: string): EventParameters {
    if (eventParametersQML.localName !== "eventParameters") {
      throw new Error(`Cannot extract, not a QuakeML event parameters: ${eventParametersQML.localName}`);
    }

    const eventEls = Array.from(eventParametersQML.getElementsByTagNameNS(BED_NS, "event"));
    const events = eventEls.map(e => Quake.createFromXml(e, host));

    const description = _grabFirstElText(eventParametersQML, "description");

    const out = new EventParameters();

    out.populate(eventParametersQML);
    out.eventList = events;
    out.description = description;

    return out;
  }
}

/**
 * Represent a QuakeML Event. Renamed to Quake as Event conflicts with
 * other uses in javascript.
 */
export class Quake extends BaseElement {
  eventId: string|undefined;
  descriptionList: EventDescription[] = [];
  amplitudeList: Array<Amplitude> = [];
  stationMagnitudeList: Array<StationMagnitude> = [];
  magnitudeList: Array<Magnitude> = [];
  originList: Array<Origin> = [];
  pickList: Array<Pick> = [];
  focalMechanismList: Array<FocalMechanism> = [];
  preferredOrigin?: Origin;
  preferredMagnitude?: Magnitude;
  preferredFocalMechanism?: FocalMechanism;
  type?: string;
  typeCertainty?: string;

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


    const out = new Quake();
    out.populate(qml);

    const descriptionEls = Array.from(qml.children).filter(e => e.tagName === "description");
    out.descriptionList = descriptionEls.map(d => EventDescription.createFromXml(d));

    //need picks before can do origins
    const allPickEls = Array.from(qml.getElementsByTagNameNS(BED_NS, "pick"));
    const allPicks = [];

    for (const pickEl of allPickEls) {
      allPicks.push(Pick.createFromXml(pickEl));
    }

    const allAmplitudeEls = Array.from(qml.getElementsByTagNameNS(BED_NS, "amplitude"));
    const allAmplitudes = [];

    for (const amplitudeEl of allAmplitudeEls) {
      allAmplitudes.push(Amplitude.createFromXml(amplitudeEl, allPicks));
    }

    const allOriginEls = Array.from(qml.getElementsByTagNameNS(BED_NS, "origin"));
    const allOrigins = [];

    for (const originEl of allOriginEls) {
      allOrigins.push(Origin.createFromXml(originEl, allPicks));
    }

    const allStationMagEls = Array.from(qml.getElementsByTagNameNS(BED_NS, "stationMagnitude"));
    const allStationMags = [];

    for (const stationMagEl of allStationMagEls) {
      allStationMags.push(StationMagnitude.createFromXml(stationMagEl, allOrigins, allAmplitudes));
    }

    const allMagEls = Array.from(qml.getElementsByTagNameNS(BED_NS, "magnitude"));
    const allMags = [];

    for (const magEl of allMagEls) {
      allMags.push(Magnitude.createFromXml(magEl, allOrigins, allStationMags));
    }

    const allFocalMechEls = Array.from(qml.getElementsByTagNameNS(BED_NS, "focalMechanism"));
    const allFocalMechs = [];

    for (const focalMechEl of allFocalMechEls) {
      allFocalMechs.push(FocalMechanism.createFromXml(focalMechEl, allOrigins, allMags));
    }

    out.originList = allOrigins;
    out.magnitudeList = allMags;
    out.pickList = allPicks;
    out.amplitudeList = allAmplitudes;
    out.stationMagnitudeList = allStationMags;
    out.focalMechanismList = allFocalMechs;
    out.eventId = Quake.extractEventId(qml, host);
    const preferredOriginId = _grabFirstElText(qml, "preferredOriginID");
    const preferredMagnitudeId = _grabFirstElText(qml, "preferredMagnitudeID");
    const preferredFocalMechId = _grabFirstElText(qml, "preferredFocalMechanismID");

    if (isNonEmptyStringArg(preferredOriginId)) {
      out.preferredOrigin = allOrigins.find(o => o.publicId === preferredOriginId);
      if (!out.preferredOrigin) {
        throw new Error(
          `no preferredOriginId match: ${preferredOriginId}`,
        );
      }
    }

    if (isNonEmptyStringArg(preferredMagnitudeId)) {
      out.preferredMagnitude = allMags.find(m => m.publicId === preferredMagnitudeId);
      if (!out.preferredMagnitude) {
        throw new Error(`no match: ${preferredMagnitudeId}`);
      }
    }

    if (isNonEmptyStringArg(preferredFocalMechId)) {
      out.preferredFocalMechanism = allFocalMechs.find(m => m.publicId === preferredFocalMechId);
      if (!out.preferredFocalMechanism) {
        throw new Error(`no match: ${preferredFocalMechId}`);
      }
    }

    out.type  =_grabFirstElText(qml, "type");
    out.typeCertainty  =_grabFirstElText(qml, "typeCertainty");

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
    return isDef(this.preferredOrigin);
  }
  hasOrigin() {
    return isDef(this.preferredOrigin) || this.originList.length > 1;
  }
  get origin(): Origin {
    if (isDef(this.preferredOrigin)) {
      return this.preferredOrigin;
    } else if (this.originList.length > 0) {
      return this.originList[0];
    } else {
      throw new Error("No origins in quake");
    }
  }
  hasPreferredMagnitude() {
    return isDef(this.preferredMagnitude);
  }
  hasMagnitude() {
    return isDef(this.preferredMagnitude) || this.magnitudeList.length > 1;
  }
  get magnitude(): Magnitude {
    if (isDef(this.preferredMagnitude)) {
      return this.preferredMagnitude;
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

  get description(): string {
    return this.descriptionList.length > 0 ? this.descriptionList[0].text : "";
  }

  get arrivals(): Array<Arrival> {
    return this.origin.arrivalList;
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
    } else if (this.eventId != null) {
      return `Event: ${this.eventId}`;
    } else {
      return `Event: unknown`;
    }
  }
}

/**
  Represents a QuakeML EventDescription.
 */
export class EventDescription {
  text: string;
  type?: string;

  constructor(text: string) {
    this.text = text;
  }

  /**
   * Parses a QuakeML description xml element into a EventDescription object.
   *
   * @param descriptionQML the description xml Element
   * @returns EventDescription instance
   */
  static createFromXml(descriptionQML: Element): EventDescription {
    if (descriptionQML.localName !== "description") {
      throw new Error(`Cannot extract, not a QuakeML description ID: ${descriptionQML.localName}`);
    }

    const text = _grabFirstElText(descriptionQML, "text");
    if (!isNonEmptyStringArg(text)) {
      throw new Error("description missing text");
    }

    const out = new EventDescription(text);

    out.type = _grabFirstElText(descriptionQML, "type");

    return out;
  }
  toString(): string {
    return this.text;
  }
}

/** Represents a QuakeML Amplitude. */
export class Amplitude extends BaseElement {
  genericAmplitude: RealQuantity;
  type?: string;
  category?: string;
  unit?: string;
  methodID?: string;
  period?: RealQuantity;
  snr?: number;
  timeWindow?: TimeWindow;
  pick?: Pick;
  waveformID?: WaveformID;
  filterID?: string;
  scalingTime?: TimeQuantity;
  magnitudeHint?: string;
  evaluationMode?: string;
  evaluationStatus?: string;

  constructor(genericAmplitude: RealQuantity) {
    super();
    this.genericAmplitude = genericAmplitude;
  }

  /**
   * Parses a QuakeML amplitude xml element into an Amplitude object.
   *
   * @param amplitudeQML the amplitude xml Element
   * @param allPicks picks already extracted from the xml for linking arrivals with picks
   * @returns Amplitude instance
   */
  static createFromXml(amplitudeQML: Element, allPicks: Pick[]): Amplitude {
    if (amplitudeQML.localName !== "amplitude") {
      throw new Error(`Cannot extract, not a QuakeML amplitude: ${amplitudeQML.localName}`);
    }

    const genericAmplitude = _grabFirstElRealQuantity(amplitudeQML, "genericAmplitude");
    if (!isDef(genericAmplitude)) {
      throw new Error("amplitude missing genericAmplitude");
    }

    const out = new Amplitude(genericAmplitude);

    out.populate(amplitudeQML);

    out.type = _grabFirstElText(amplitudeQML, "type");

    out.category = _grabFirstElText(amplitudeQML, "category");

    out.unit = _grabFirstElText(amplitudeQML, "unit");

    out.methodID = _grabFirstElText(amplitudeQML, "methodID");

    out.period = _grabFirstElRealQuantity(amplitudeQML, "period");

    out.snr = _grabFirstElFloat(amplitudeQML, "snr");

    out.timeWindow = _grabFirstElType(TimeWindow.createFromXml.bind(TimeWindow))(amplitudeQML, "timeWindow");

    const pickID = _grabFirstElText(amplitudeQML, "pickID");
    out.pick = allPicks.find(p => p.publicId === pickID);
    if (pickID && !out.pick) {
      throw new Error("No pick with ID " + pickID);
    }

    out.waveformID = _grabFirstElType(WaveformID.createFromXml.bind(WaveformID))(amplitudeQML, "waveformID");

    out.filterID = _grabFirstElText(amplitudeQML, "filterID");

    out.scalingTime = _grabFirstElTimeQuantity(amplitudeQML, "scalingTime");

    out.magnitudeHint = _grabFirstElText(amplitudeQML, "magnitudeHint");

    out.evaluationMode = _grabFirstElText(amplitudeQML, "evaluationMode");

    out.evaluationStatus = _grabFirstElText(amplitudeQML, "evaluationStatus");

    return out;
  }
}

/** Represents a QuakeML StationMagnitude. */
export class StationMagnitude extends BaseElement {
  origin: Origin;
  mag: RealQuantity;
  type?: string;
  amplitude?: Amplitude;
  methodID?: string;
  waveformID?: WaveformID;

  constructor(origin: Origin, mag: RealQuantity) {
    super();
    this.origin = origin;
    this.mag = mag;
  }

  /**
   * Parses a QuakeML station magnitude xml element into a StationMagnitude object.
   *
   * @param stationMagnitudeQML the station magnitude xml Element
   * @param allOrigins origins already extracted from the xml for linking station magnitudes with origins
   * @param allAmplitudes amplitudes already extracted from the xml for linking station magnitudes with amplitudes
   * @returns StationMagnitude instance
   */
  static createFromXml(stationMagnitudeQML: Element, allOrigins: Origin[], allAmplitudes: Amplitude[]): StationMagnitude {
    if (stationMagnitudeQML.localName !== "stationMagnitude") {
      throw new Error(`Cannot extract, not a QuakeML station magnitude: ${stationMagnitudeQML.localName}`);
    }

    const originID = _grabFirstElText(stationMagnitudeQML, "originID");
    if (!isNonEmptyStringArg(originID)) {
      throw new Error("stationMagnitude missing origin ID");
    }
    const origin = allOrigins.find(o => o.publicId === originID);
    if (!isDef(origin)) {
      throw new Error("No origin with ID " + originID);
    }

    const mag = _grabFirstElRealQuantity(stationMagnitudeQML, "mag");
    if (!isDef(mag)) {
      throw new Error("stationMagnitude missing mag");
    }

    const out = new StationMagnitude(origin, mag);

    out.populate(stationMagnitudeQML);

    out.type = _grabFirstElText(stationMagnitudeQML, "type");

    const amplitudeID = _grabFirstElText(stationMagnitudeQML, "amplitudeID");
    out.amplitude = allAmplitudes.find(a => a.publicId === amplitudeID);
    if (amplitudeID && !out.amplitude) {
      throw new Error("No amplitude with ID " + amplitudeID);
    }

    out.methodID = _grabFirstElText(stationMagnitudeQML, "methodID");

    out.waveformID = _grabFirstElType(WaveformID.createFromXml.bind(WaveformID))(stationMagnitudeQML, "waveformID");

    return out;
  }
}

/** Represents a QuakeML TimeWindow. */
export class TimeWindow {
  begin: number;
  end: number;
  reference: DateTime;

  constructor(begin: number, end: number, reference: DateTime) {
    this.begin = begin;
    this.end = end;
    this.reference = reference;
  }

  /**
   * Parses a QuakeML time window xml element into a TimeWindow object.
   *
   * @param timeWindowQML the time window xml Element
   * @returns TimeWindow instance
   */
  static createFromXml(timeWindowQML: Element): TimeWindow {
    if (timeWindowQML.localName !== "timeWindow") {
      throw new Error(`Cannot extract, not a QuakeML time window: ${timeWindowQML.localName}`);
    }

    const begin = _grabFirstElFloat(timeWindowQML, "begin");
    if (!isDef(begin)) {
      throw new Error("timeWindow missing begin");
    }

    const end = _grabFirstElFloat(timeWindowQML, "end");
    if (!isDef(end)) {
      throw new Error("timeWindow missing end");
    }

    const reference = _grabFirstElDateTime(timeWindowQML, "reference");
    if (!isDef(reference)) {
      throw new Error("timeWindow missing reference");
    }

    const out = new TimeWindow(begin, end, reference);

    return out;
  }
}

/** Represents a QuakeML Origin. */
export class Origin extends BaseElement {
  compositeTimes: Array<CompositeTime>;
  originUncertainty?: OriginUncertainty;
  arrivalList: Array<Arrival>;
  timeQuantity: TimeQuantity;
  latitudeQuantity: RealQuantity;
  longitudeQuantity: RealQuantity;
  depthQuantity?: RealQuantity;
  depthType?: string;
  timeFixed?: boolean;
  epicenterFixed?: boolean;
  referenceSystemID?: string;
  methodID?: string;
  earthModelID?: string;
  quality?: OriginQuality;
  type?: string;
  region?: string;
  evaluationMode?: string;
  evaluationStatus?: string;

  constructor(time: TimeQuantity | DateTime,
              latitude: RealQuantity | number,
              longitude: RealQuantity | number) {
    super();
    this.compositeTimes = [];
    this.arrivalList = [];

    if (time instanceof DateTime) {
      this.timeQuantity = new Quantity(time);
    } else {
      this.timeQuantity = time;
    }
    if (typeof latitude == "number") {
      this.latitudeQuantity = new Quantity(latitude);
    } else {
      this.latitudeQuantity = latitude;
    }
    if (typeof longitude == "number") {
      this.longitudeQuantity = new Quantity(longitude);
    } else {
      this.longitudeQuantity = longitude;
    }
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

    const time = _grabFirstElTimeQuantity(qml, "time");
    if (!isObject(time)) {
      throw new Error("origin missing time");
    }

    const lat = _grabFirstElRealQuantity(qml, "latitude");
    if (!isObject(lat)) {
      throw new Error("origin missing latitude");
    }

    const lon = _grabFirstElRealQuantity(qml, "longitude");
    if (!isObject(lon)) {
      throw new Error("origin missing longitude");
    }

    const out = new Origin(time, lat, lon);

    out.populate(qml);

    out.originUncertainty = _grabFirstElType(OriginUncertainty.createFromXml.bind(OriginUncertainty))(qml, "originUncertainty");

    const allArrivalEls = Array.from(qml.getElementsByTagNameNS(BED_NS, "arrival"));
    out.arrivalList = allArrivalEls.map(arrivalEl => Arrival.createFromXml(arrivalEl, allPicks));

    out.depthQuantity = _grabFirstElRealQuantity(qml, "depth");

    out.depthType = _grabFirstElText(qml, "depthType");

    out.timeFixed = _grabFirstElBool(qml, "timeFixed");

    out.epicenterFixed = _grabFirstElBool(qml, "epicenterFixed");

    out.referenceSystemID = _grabFirstElText(qml, "referenceSystemID");

    out.methodID = _grabFirstElText(qml, "methodID");

    out.earthModelID = _grabFirstElText(qml, "earthModelID");

    out.quality = _grabFirstElType(OriginQuality.createFromXml.bind(OriginQuality))(qml, "quality");

    out.type = _grabFirstElText(qml, "type");

    out.region = _grabFirstElText(qml, "region");

    out.evaluationMode = _grabFirstElText(qml, "evaluationMode");

    out.evaluationStatus = _grabFirstElText(qml, "evaluationStatus");

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

  get time(): DateTime {
    return this.timeQuantity.value;
  }
  set time(t: TimeQuantity | DateTime) {
    if (t instanceof DateTime) {
      this.timeQuantity.value = t;
    } else {
      this.timeQuantity = t;
    }
  }

  get latitude(): number {
    return this.latitudeQuantity.value;
  }
  set latitude(lat: RealQuantity | number) {
    if (typeof lat == "number") {
      this.latitudeQuantity.value = lat;
    } else {
      this.latitudeQuantity = lat;
    }
  }

  get longitude(): number {
    return this.longitudeQuantity.value;
  }
  set longitude(lon: RealQuantity | number) {
    if (typeof lon == "number") {
      this.longitudeQuantity.value = lon;
    } else {
      this.longitudeQuantity = lon;
    }
  }

  get depth(): number {
    return this.depthQuantity?.value ?? NaN;
  }
  set depth(depth: RealQuantity | number) {
    if (typeof depth == "number") {
      if ( ! this.depthQuantity) {
        this.depthQuantity = new Quantity(depth);
      } else {
        this.depthQuantity.value = depth;
      }
    } else {
      this.depthQuantity = depth;
    }
  }


  get arrivals(): Array<Arrival> {
    return this.arrivalList;
  }
}

/** Represents a QuakeML CompositeTime. */
export class CompositeTime {
  year?: IntegerQuantity;
  month?: IntegerQuantity;
  day?: IntegerQuantity;
  hour?: IntegerQuantity;
  minute?: IntegerQuantity;
  second?: RealQuantity;

  /**
   * Parses a QuakeML composite time xml element into an CompositeTime object.
   *
   * @param qml the composite time xml Element
   * @returns CompositeTime instance
   */
  static createFromXml(qml: Element): CompositeTime {
    if (qml.localName !== "compositeTime") {
      throw new Error(`Cannot extract, not a QuakeML Composite Time: ${qml.localName}`);
    }

    const out = new CompositeTime();

    out.year = _grabFirstElIntegerQuantity(qml, "year");

    out.month = _grabFirstElIntegerQuantity(qml, "month");

    out.day = _grabFirstElIntegerQuantity(qml, "day");

    out.hour = _grabFirstElIntegerQuantity(qml, "hour");

    out.minute = _grabFirstElIntegerQuantity(qml, "minute");

    out.second = _grabFirstElIntegerQuantity(qml, "second");

    return out;
  }
}

/** Represents a QuakeML OriginUncertainty. */
export class OriginUncertainty {
  horizontalUncertainty?: number;
  minHorizontalUncertainty?: number;
  maxHorizontalUncertainty?: number;
  azimuthMaxHorizontalUncertainty?: number;
  confidenceEllipsoid?: ConfidenceEllipsoid;
  preferredDescription?: string;
  confidenceLevel?: number;

  /**
   * Parses a QuakeML origin uncertainty xml element into an OriginUncertainty object.
   *
   * @param qml the origin uncertainty xml Element
   * @returns OriginUncertainty instance
   */
  static createFromXml(qml: Element): OriginUncertainty {
    if (qml.localName !== "originUncertainty") {
      throw new Error(`Cannot extract, not a QuakeML Origin Uncertainty: ${qml.localName}`);
    }

    const out = new OriginUncertainty();

    out.horizontalUncertainty = _grabFirstElFloat(qml, "horizontalUncertainty");

    out.minHorizontalUncertainty = _grabFirstElFloat(qml, "minHorizontalUncertainty");

    out.maxHorizontalUncertainty = _grabFirstElFloat(qml, "maxHorizontalUncertainty");

    out.azimuthMaxHorizontalUncertainty = _grabFirstElFloat(qml, "azimuthMaxHorizontalUncertainty");

    out.confidenceEllipsoid = _grabFirstElType(ConfidenceEllipsoid.createFromXml.bind(ConfidenceEllipsoid))(qml, "confidenceEllipsoid");

    out.preferredDescription = _grabFirstElText(qml, "preferredDescription");

    out.confidenceLevel = _grabFirstElFloat(qml, "confidenceLevel");

    return out;
  }
}

/** Represents a QuakeML ConfidenceEllipsoid. */
export class ConfidenceEllipsoid {
  semiMajorAxisLength: number;
  semiMinorAxisLength: number;
  semiIntermediateAxisLength: number;
  majorAxisPlunge: number;
  majorAxisAzimuth: number;
  majorAxisRotation: number;

  constructor(
    semiMajorAxisLength: number,
    semiMinorAxisLength: number,
    semiIntermediateAxisLength: number,
    majorAxisPlunge: number,
    majorAxisAzimuth: number,
    majorAxisRotation: number,
  ) {
    this.semiMajorAxisLength = semiMajorAxisLength;
    this.semiMinorAxisLength = semiMinorAxisLength;
    this.semiIntermediateAxisLength = semiIntermediateAxisLength;
    this.majorAxisPlunge = majorAxisPlunge;
    this.majorAxisAzimuth = majorAxisAzimuth;
    this.majorAxisRotation = majorAxisRotation;
  }

  /**
   * Parses a QuakeML confidence ellipsoid xml element into an ConfidenceEllipsoid object.
   *
   * @param qml the confidence ellipsoid xml Element
   * @returns ConfidenceEllipsoid instance
   */
  static createFromXml(qml: Element): ConfidenceEllipsoid {
    if (qml.localName !== "confidenceEllipsoid") {
      throw new Error(`Cannot extract, not a QuakeML Confidence Ellipsoid: ${qml.localName}`);
    }

    const semiMajorAxisLength = _grabFirstElFloat(qml, "semiMajorAxisLength");
    if (semiMajorAxisLength === undefined) {
      throw new Error("confidenceEllipsoid missing semiMajorAxisLength");
    }

    const semiMinorAxisLength = _grabFirstElFloat(qml, "semiMinorAxisLength");
    if (semiMinorAxisLength === undefined) {
      throw new Error("confidenceEllipsoid missing semiMinorAxisLength");
    }

    const semiIntermediateAxisLength = _grabFirstElFloat(qml, "semiIntermediateAxisLength");
    if (semiIntermediateAxisLength === undefined) {
      throw new Error("confidenceEllipsoid missing semiIntermediateAxisLength");
    }

    const majorAxisPlunge = _grabFirstElFloat(qml, "majorAxisPlunge");
    if (majorAxisPlunge === undefined) {
      throw new Error("confidenceEllipsoid missing majorAxisPlunge");
    }

    const majorAxisAzimuth = _grabFirstElFloat(qml, "majorAxisAzimuth");
    if (majorAxisAzimuth === undefined) {
      throw new Error("confidenceEllipsoid missing majorAxisAzimuth");
    }

    const majorAxisRotation = _grabFirstElFloat(qml, "majorAxisRotation");
    if (majorAxisRotation === undefined) {
      throw new Error("confidenceEllipsoid missing majorAxisRotation");
    }

    const out = new ConfidenceEllipsoid(
      semiMajorAxisLength,
      semiMinorAxisLength,
      semiIntermediateAxisLength,
      majorAxisPlunge,
      majorAxisAzimuth,
      majorAxisRotation,
    );

    return out;
  }
}

/** Represents a QuakeML OriginQuality. */
export class OriginQuality {
  associatedPhaseCount?: number;
  usedPhaseCount?: number;
  associatedStationCount?: number;
  usedStationCount?: number;
  depthPhaseCount?: number;
  standardError?: number;
  azimuthalGap?: number;
  secondaryAzimuthalGap?: number;
  groundTruthLevel?: string;
  maximumDistance?: number;
  minimumDistance?: number;
  medianDistance?: number;

  /**
   * Parses a QuakeML origin quality xml element into an OriginQuality object.
   *
   * @param qml the origin quality xml Element
   * @returns OriginQuality instance
   */
  static createFromXml(qml: Element): OriginQuality {
    if (qml.localName !== "quality") {
      throw new Error(`Cannot extract, not a QuakeML Origin Quality: ${qml.localName}`);
    }

    const out = new OriginQuality();

    out.associatedPhaseCount = _grabFirstElInt(qml, "associatedPhaseCount");

    out.usedPhaseCount = _grabFirstElInt(qml, "usedPhaseCount");

    out.associatedStationCount = _grabFirstElInt(qml, "associatedStationCount");

    out.usedStationCount = _grabFirstElInt(qml, "usedStationCount");

    out.standardError = _grabFirstElFloat(qml, "standardError");

    out.azimuthalGap = _grabFirstElFloat(qml, "azimuthalGap");

    out.secondaryAzimuthalGap = _grabFirstElFloat(qml, "secondaryAzimuthalGap");

    out.groundTruthLevel = _grabFirstElText(qml, "groundTruthLevel");

    out.maximumDistance = _grabFirstElFloat(qml, "maximumDistance");

    out.minimumDistance = _grabFirstElFloat(qml, "minimumDistance");

    out.medianDistance = _grabFirstElFloat(qml, "medianDistance");

    return out;
  }
}

/**
  Represents a QuakeML Magnitude.
 */
export class Magnitude extends BaseElement {
  stationMagnitudeContributions: StationMagnitudeContribution[] = [];
  magQuantity: RealQuantity;
  type?: string;
  origin?: Origin;
  methodID?: string;
  stationCount?: number;
  azimuthalGap?: number;
  evaluationMode?: string;
  evaluationStatus?: string;

  constructor(mag: RealQuantity | number, type?: string) {
    super();
    if (typeof mag === "number" ) {
      this.magQuantity = new Quantity(mag);
    } else {
      this.magQuantity = mag;
    }
    if (type) {
      this.type = type;
    }
  }

  /**
   * Parses a QuakeML magnitude xml element into a Magnitude object.
   *
   * @param qml the magnitude xml Element
   * @param allOrigins origins already extracted from the xml for linking magnitudes with origins
   * @param allStationMagnitudes station magnitudes already extracted from the xml
   * @returns Magnitude instance
   */
  static createFromXml(qml: Element, allOrigins: Origin[], allStationMagnitudes: StationMagnitude[]): Magnitude {
    if (qml.localName !== "magnitude") {
      throw new Error(
        `Cannot extract, not a QuakeML Magnitude: ${qml.localName}`,
      );
    }

    const mag = _grabFirstElRealQuantity(qml, "mag");
    if (!mag) {
      throw new Error("magnitude missing mag");
    }

    const out = new Magnitude(mag);

    out.populate(qml);

    const stationMagnitudeContributionEls = Array.from(qml.getElementsByTagNameNS(BED_NS, "stationMagnitudeContribution"));
    out.stationMagnitudeContributions = stationMagnitudeContributionEls.map(smc => StationMagnitudeContribution.createFromXml(smc, allStationMagnitudes));

    out.type = _grabFirstElText(qml, "type");

    const originID = _grabFirstElText(qml, "originID");
    out.origin = allOrigins.find(o => o.publicId === originID);
    if (originID && !out.origin) {
      throw new Error("No origin with ID " + originID);
    }

    out.methodID = _grabFirstElText(qml, "methodID");

    out.stationCount = _grabFirstElInt(qml, "stationCount");

    out.azimuthalGap = _grabFirstElFloat(qml, "azimuthalGap");

    out.evaluationMode = _grabFirstElText(qml, "evaluationMode");

    out.evaluationStatus = _grabFirstElText(qml, "evaluationStatus");

    return out;
  }

  toString(): string {
    return `${this.mag} ${this.type?this.type:""}`;
  }
  get mag(): number {
    return this.magQuantity.value;
  }
  set mag(value: RealQuantity | number) {
    if (typeof value === "number" ) {
      this.magQuantity.value = value;
    } else {
      this.magQuantity = value;
    }
  }
}

/**
  Represents a QuakeML StationMagnitudeContribution.
 */
export class StationMagnitudeContribution {
  stationMagnitude: StationMagnitude;
  residual?: number;
  weight?: number;

  constructor(stationMagnitude: StationMagnitude) {
    this.stationMagnitude = stationMagnitude;
  }

  /**
   * Parses a QuakeML station magnitude contribution xml element into a StationMagnitudeContribution object.
   *
   * @param qml the station magnitude contribution xml Element
   * @param allStationMagnitudes station magnitudes already extracted from the xml for linking station magnitudes with station magnitude contributions
   * @returns StationMagnitudeContribution instance
   */
  static createFromXml(qml: Element, allStationMagnitudes: Array<StationMagnitude>): StationMagnitudeContribution {
    if (qml.localName !== "stationMagnitudeContribution") {
      throw new Error(`Cannot extract, not a QuakeML StationMagnitudeContribution: ${qml.localName}`);
    }

    const stationMagnitudeID = _grabFirstElText(qml, "stationMagnitudeID");
    if (!isNonEmptyStringArg(stationMagnitudeID)) {
      throw new Error("stationMagnitudeContribution missing stationMagnitude");
    }
    const stationMagnitude = allStationMagnitudes.find(sm => sm.publicId === stationMagnitudeID);
    if (!isDef(stationMagnitude)) {
      throw new Error("No stationMagnitude with ID " + stationMagnitudeID);
    }

    const out = new StationMagnitudeContribution(stationMagnitude);

    out.residual = _grabFirstElFloat(qml, "residual");

    out.weight = _grabFirstElFloat(qml, "weight");

    return out;
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
  earthModelID?: string;

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

    if (isNonEmptyStringArg(phase) && isNonEmptyStringArg(pickId)) {
      const myPick = allPicks.find(function (p: Pick) {
        return p.publicId === pickId;
      });

      if (!myPick) {
        throw new Error("Can't find pick with Id=" + pickId + " for Arrival");
      }

      const out = new Arrival(phase, myPick);

      out.populate(arrivalQML);

      out.timeCorrection = _grabFirstElFloat(arrivalQML, "timeCorrection");

      out.azimuth = _grabFirstElFloat(arrivalQML, "azimuth");

      out.distance = _grabFirstElFloat(arrivalQML, "distance");

      out.takeoffAngle = _grabFirstElRealQuantity(arrivalQML, "takeoffAngle");

      out.timeResidual = _grabFirstElFloat(arrivalQML, "timeResidual");

      out.horizontalSlownessResidual = _grabFirstElFloat(arrivalQML, "horizontalSlownessResidual");

      out.backazimuthResidual = _grabFirstElFloat(arrivalQML, "backazimuthResidual");

      out.timeWeight = _grabFirstElFloat(arrivalQML, "timeWeight");

      out.horizontalSlownessWeight = _grabFirstElFloat(arrivalQML, "horizontalSlownessWeight");

      out.backazimuthWeight = _grabFirstElFloat(arrivalQML, "backazimuthWeight");

      out.earthModelID = _grabFirstElText(arrivalQML, "earthModelID");

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
  timeQuantity: TimeQuantity;
  waveformID: WaveformID;
  filterID?: string;
  methodID?: string;
  horizontalSlowness?: RealQuantity;
  backazimuth?: RealQuantity;
  slownessMethodID?: string;
  onset?: string;
  phaseHint?: string;
  polarity?: string;
  evaluationMode?: string;
  evaluationStatus?: string;

  constructor(time: TimeQuantity | DateTime, waveformID: WaveformID) {
    super();
    if (time instanceof DateTime) {
      this.timeQuantity = new Quantity(time);
    } else {
      this.timeQuantity = time;
    }
    this.waveformID = waveformID;
  }
  get time(): DateTime {
    return this.timeQuantity.value;
  }
  set time(t: Quantity<DateTime> | DateTime) {
    if (t instanceof DateTime) {
      this.timeQuantity.value = t;
    } else {
      this.timeQuantity = t;
    }
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

    const waveformId = _grabFirstElType(WaveformID.createFromXml.bind(WaveformID))(pickQML, "waveformID");
    if (!isObject(waveformId)) {
      throw new Error("pick missing waveformID");
    }

    const out = new Pick(time, waveformId);

    out.populate(pickQML);

    out.filterID = _grabFirstElText(pickQML, "filterID");

    out.methodID = _grabFirstElText(pickQML, "methodID");

    out.horizontalSlowness = _grabFirstElRealQuantity(pickQML, "horizontalSlowness");

    out.backazimuth = _grabFirstElRealQuantity(pickQML, "backazimuth");

    out.slownessMethodID = _grabFirstElText(pickQML, "slownessMethodID");

    out.onset = _grabFirstElText(pickQML, "onset");

    out.phaseHint = _grabFirstElText(pickQML, "phaseHint");

    out.polarity = _grabFirstElText(pickQML, "polarity");

    out.evaluationMode = _grabFirstElText(pickQML, "evaluationMode");

    out.evaluationStatus = _grabFirstElText(pickQML, "evaluationStatus");

    return out;
  }

  get networkCode(): string {
    return this.waveformID.networkCode;
  }

  get stationCode(): string {
    return this.waveformID.stationCode;
  }

  get locationCode(): string {
    return this.waveformID.locationCode || '--';
  }

  get channelCode(): string {
    return this.waveformID.channelCode || '---';
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

/**
  Represents a QuakeML Focal Mechanism.
 */
export class FocalMechanism extends BaseElement {
  waveformIDList: WaveformID[] = [];
  momentTensorList: MomentTensor[] = [];
  triggeringOrigin?: Origin;
  nodalPlanes?: NodalPlanes;
  principalAxes?: PrincipalAxes;
  azimuthalGap?: number;
  stationPolarityCount?: number;
  misfit?: number;
  stationDistributionRatio?: number;
  methodID?: string;
  evaluationMode?: string;
  evaluationStatus?: string;


  /**
   * Parses a QuakeML focal mechanism xml element into a FocalMechanism object.
   *
   * @param focalMechQML the focal mechanism xml Element
   * @param allOrigins origins already extracted from the xml for linking focal mechanisms with origins
   * @param allMagnitudes magnitudes already extracted from the xml for linking moment tensors with magnitudes
   * @returns FocalMechanism instance
   */
  static createFromXml(focalMechQML: Element, allOrigins: Origin[], allMagnitudes: Magnitude[]): FocalMechanism {
    if (focalMechQML.localName !== "focalMechanism") {
      throw new Error(`Cannot extract, not a QuakeML focalMechanism: ${focalMechQML.localName}`);
    }

    const out = new FocalMechanism();

    out.populate(focalMechQML);

    const waveformIDEls = Array.from(focalMechQML.getElementsByTagNameNS(BED_NS, "waveformID"));
    out.waveformIDList = waveformIDEls.map(wid => WaveformID.createFromXml(wid));

    const momentTensorEls = Array.from(focalMechQML.getElementsByTagNameNS(BED_NS, "momentTensor"));
    out.momentTensorList = momentTensorEls.map(mt => MomentTensor.createFromXml(mt, allOrigins, allMagnitudes));

    const triggeringOriginID = _grabFirstElText(focalMechQML, "triggeringOriginID");
    out.triggeringOrigin = allOrigins.find(o => o.publicId === triggeringOriginID);
    if (triggeringOriginID && !out.triggeringOrigin) {
      throw new Error("No origin with ID " + triggeringOriginID);
    }

    out.nodalPlanes = _grabFirstElType(NodalPlanes.createFromXml.bind(NodalPlanes))(focalMechQML, "nodalPlanes");

    out.principalAxes = _grabFirstElType(PrincipalAxes.createFromXml.bind(PrincipalAxes))(focalMechQML, "principalAxes");

    out.azimuthalGap = _grabFirstElFloat(focalMechQML, "azimuthalGap");

    out.stationPolarityCount = _grabFirstElInt(focalMechQML, "stationPolarityCount");

    out.misfit = _grabFirstElFloat(focalMechQML, "misfit");

    out.stationDistributionRatio = _grabFirstElFloat(focalMechQML, "stationDistributionRatio");

    out.methodID = _grabFirstElText(focalMechQML, "methodID");

    out.evaluationMode = _grabFirstElText(focalMechQML, "evaluationMode");

    out.evaluationStatus = _grabFirstElText(focalMechQML, "evaluationStatus");

    return out;
  }
}

/**
  Represents a QuakeML NodalPlanes.
 */
export class NodalPlanes {
  nodalPlane1?: NodalPlane;
  nodalPlane2?: NodalPlane;
  preferredPlane?: number;

  /**
   * Parses a QuakeML nodal planes xml element into a NodalPlanes object.
   *
   * @param nodalPlanesQML the nodal planes xml Element
   * @returns NodalPlanes instance
   */
  static createFromXml(nodalPlanesQML: Element): NodalPlanes {
    const out = new NodalPlanes();

    out.nodalPlane1 = _grabFirstElType(NodalPlane.createFromXml.bind(NodalPlane))(nodalPlanesQML, "nodalPlane1");

    out.nodalPlane2 = _grabFirstElType(NodalPlane.createFromXml.bind(NodalPlane))(nodalPlanesQML, "nodalPlane2");

    const preferredPlaneString = _grabAttribute(nodalPlanesQML, "preferredPlane");
    out.preferredPlane = isNonEmptyStringArg(preferredPlaneString) ? parseInt(preferredPlaneString) : undefined;

    return out;
  }
}

/**
  Represents a QuakeML NodalPlane.
 */
export class NodalPlane {
  strike: RealQuantity;
  dip: RealQuantity;
  rake: RealQuantity;

  constructor(strike: RealQuantity, dip: RealQuantity, rake: RealQuantity) {
    this.strike = strike;
    this.dip = dip;
    this.rake = rake;
  }

  /**
   * Parses a QuakeML nodal plane xml element into a NodalPlane object.
   *
   * @param nodalPlaneQML the nodal plane xml Element
   * @returns NodalPlane instance
   */
  static createFromXml(nodalPlaneQML: Element): NodalPlane {
    const strike = _grabFirstElRealQuantity(nodalPlaneQML, "strike");
    if (!isObject(strike)) {
      throw new Error("nodal plane missing strike");
    }

    const dip = _grabFirstElRealQuantity(nodalPlaneQML, "dip");
    if (!isObject(dip)) {
      throw new Error("nodal plane missing dip");
    }

    const rake = _grabFirstElRealQuantity(nodalPlaneQML, "rake");
    if (!isObject(rake)) {
      throw new Error("nodal plane missing rake");
    }

    const out = new NodalPlane(strike, dip, rake);

    return out;
  }
}

/**
  Represents a QuakeML PrincipalAxes.
 */
export class PrincipalAxes {
  tAxis: Axis;
  pAxis: Axis;
  nAxis?: Axis;

  constructor(tAxis: Axis, pAxis: Axis) {
    this.tAxis = tAxis;
    this.pAxis = pAxis;
  }

  /**
   * Parses a QuakeML princpalAxes element into a PrincipalAxes object.
   *
   * @param princpalAxesQML the princpalAxes xml Element
   * @returns PrincipalAxes instance
   */
  static createFromXml(princpalAxesQML: Element): PrincipalAxes {
    if (princpalAxesQML.localName !== "principalAxes") {
      throw new Error(`Cannot extract, not a QuakeML princpalAxes: ${princpalAxesQML.localName}`);
    }

    const tAxis = _grabFirstElType(Axis.createFromXml.bind(Axis))(princpalAxesQML, "tAxis");
    if (!isObject(tAxis)) {
      throw new Error("nodal plane missing tAxis");
    }

    const pAxis = _grabFirstElType(Axis.createFromXml.bind(Axis))(princpalAxesQML, "pAxis");
    if (!isObject(pAxis)) {
      throw new Error("nodal plane missing pAxis");
    }

    const out = new PrincipalAxes(tAxis, pAxis);

    out.nAxis = _grabFirstElType(Axis.createFromXml.bind(Axis))(princpalAxesQML, "nAxis");

    return out;
  }
}

/**
  Represents a QuakeML Axis.
 */
export class Axis {
  azimuth: RealQuantity;
  plunge: RealQuantity;
  length: RealQuantity;

  constructor(azimuth: RealQuantity, plunge: RealQuantity, length: RealQuantity) {
    this.azimuth = azimuth;
    this.plunge = plunge;
    this.length = length;
  }

  /**
   * Parses a QuakeML axis xml element into a Axis object.
   *
   * @param axisQML the axis xml Element
   * @returns Axis instance
   */
  static createFromXml(axisQML: Element): Axis {
    const azimuth = _grabFirstElRealQuantity(axisQML, "azimuth");
    if (!isObject(azimuth)) {
      throw new Error("nodal plane missing azimuth");
    }

    const plunge = _grabFirstElRealQuantity(axisQML, "plunge");
    if (!isObject(plunge)) {
      throw new Error("nodal plane missing plunge");
    }

    const length = _grabFirstElRealQuantity(axisQML, "length");
    if (!isObject(length)) {
      throw new Error("nodal plane missing length");
    }

    const out = new Axis(azimuth, plunge, length);

    return out;
  }
}

/**
  Represents a QuakeML MomentTensor.
 */
export class MomentTensor extends BaseElement {
  dataUsedList: DataUsed[] = [];
  derivedOrigin: Origin;
  momentMagnitude?: Magnitude;
  scalarMoment?: RealQuantity;
  tensor?: Tensor;
  variance?: number;
  varianceReduction?: number;
  doubleCouple?: number;
  clvd?: number;
  iso?: number;
  greensFunctionID?: string;
  filterID?: string;
  sourceTimeFunction?: SourceTimeFunction;
  methodID?: string;
  category?: string;
  inversionType?: string;

  constructor(derivedOrigin: Origin) {
    super();
    this.derivedOrigin = derivedOrigin;
  }

  /**
   * Parses a QuakeML momentTensor xml element into a MomentTensor object.
   *
   * @param momentTensorQML the momentTensor xml Element
   * @param allOrigins origins already extracted from the xml for linking moment tensors with origins
   * @param allMagnitudes magnitudes already extracted from the xml for linking moment tensors with magnitudes
   * @returns MomentTensor instance
   */
  static createFromXml(momentTensorQML: Element, allOrigins: Origin[], allMagnitudes: Magnitude[]): MomentTensor {
    if (momentTensorQML.localName !== "momentTensor") {
      throw new Error(`Cannot extract, not a QuakeML momentTensor: ${momentTensorQML.localName}`);
    }

    const derivedOriginID = _grabFirstElText(momentTensorQML, "derivedOriginID");
    if (!isNonEmptyStringArg(derivedOriginID)) {
      throw new Error("momentTensor missing derivedOriginID");
    }
    const derivedOrigin = allOrigins.find(o => o.publicId === derivedOriginID);
    if (!isDef(derivedOrigin)) {
      throw new Error("No origin with ID " + derivedOriginID);
    }

    const out = new MomentTensor(derivedOrigin);

    out.populate(momentTensorQML);

    const dataUsedEls = Array.from(momentTensorQML.getElementsByTagNameNS(BED_NS, "dataUsed"));
    out.dataUsedList = dataUsedEls.map(DataUsed.createFromXml.bind(DataUsed));

    const momentMagnitudeID = _grabFirstElText(momentTensorQML, "momentMagnitudeID");
    out.momentMagnitude = allMagnitudes.find(o => o.publicId === momentMagnitudeID);
    if (momentMagnitudeID && !out.momentMagnitude) {
      throw new Error("No magnitude with ID " + momentMagnitudeID);
    }

    out.scalarMoment = _grabFirstElRealQuantity(momentTensorQML, "scalarMoment");

    out.tensor = _grabFirstElType(Tensor.createFromXml.bind(Tensor))(momentTensorQML, "tensor");

    out.variance = _grabFirstElFloat(momentTensorQML, "variance");

    out.varianceReduction = _grabFirstElFloat(momentTensorQML, "varianceReduction");

    out.doubleCouple = _grabFirstElFloat(momentTensorQML, "doubleCouple");

    out.clvd = _grabFirstElFloat(momentTensorQML, "clvd");

    out.iso = _grabFirstElFloat(momentTensorQML, "iso");

    out.greensFunctionID = _grabFirstElText(momentTensorQML, "greensFunctionID");

    out.filterID = _grabFirstElText(momentTensorQML, "filterID");

    out.sourceTimeFunction = _grabFirstElType(SourceTimeFunction.createFromXml.bind(SourceTimeFunction))(momentTensorQML, "sourceTimeFunction");

    out.methodID = _grabFirstElText(momentTensorQML, "methodID");

    out.category = _grabFirstElText(momentTensorQML, "category");

    out.inversionType = _grabFirstElText(momentTensorQML, "inversionType");

    return out;
  }
}

/**
  Represents a QuakeML Tensor.
 */
export class Tensor {
  Mrr: RealQuantity;
  Mtt: RealQuantity;
  Mpp: RealQuantity;
  Mrt: RealQuantity;
  Mrp: RealQuantity;
  Mtp: RealQuantity;

  constructor(
    Mrr: RealQuantity,
    Mtt: RealQuantity,
    Mpp: RealQuantity,
    Mrt: RealQuantity,
    Mrp: RealQuantity,
    Mtp: RealQuantity
  ) {
    this.Mrr = Mrr;
    this.Mtt = Mtt;
    this.Mpp = Mpp;
    this.Mrt = Mrt;
    this.Mrp = Mrp;
    this.Mtp = Mtp;
  }

  /**
   * Parses a QuakeML tensor xml element into a Tensor object.
   *
   * @param tensorQML the tensor xml Element
   * @returns Tensor instance
   */
  static createFromXml(tensorQML: Element): Tensor {
    if (tensorQML.localName !== "tensor") {
      throw new Error(`Cannot extract, not a QuakeML tensor: ${tensorQML.localName}`);
    }

    const Mrr = _grabFirstElRealQuantity(tensorQML, "Mrr");
    if (!isObject(Mrr)) {
      throw new Error("tensor missing Mrr");
    }

    const Mtt = _grabFirstElRealQuantity(tensorQML, "Mtt");
    if (!isObject(Mtt)) {
      throw new Error("tensor missing Mtt");
    }

    const Mpp = _grabFirstElRealQuantity(tensorQML, "Mpp");
    if (!isObject(Mpp)) {
      throw new Error("tensor missing Mpp");
    }

    const Mrt = _grabFirstElRealQuantity(tensorQML, "Mrt");
    if (!isObject(Mrt)) {
      throw new Error("tensor missing Mrt");
    }

    const Mrp = _grabFirstElRealQuantity(tensorQML, "Mrp");
    if (!isObject(Mrp)) {
      throw new Error("tensor missing Mrp");
    }

    const Mtp = _grabFirstElRealQuantity(tensorQML, "Mtp");
    if (!isObject(Mtp)) {
      throw new Error("tensor missing Mtp");
    }

    const out = new Tensor(Mrr, Mtt, Mpp, Mrt, Mrp, Mtp);

    return out;
  }
}

/**
  Represents a QuakeML SourceTimeFunction.
 */
export class SourceTimeFunction {
  type: string;
  duration: number;
  riseTime?: number;
  decayTime?: number;

  constructor(type: string, duration: number) {
    this.type = type;
    this.duration = duration;
  }

  /**
   * Parses a QuakeML sourceTimeFunction xml element into a SourceTimeFunction object.
   *
   * @param sourceTimeFunctionQML the sourceTimeFunction xml Element
   * @returns SourceTimeFunction instance
   */
  static createFromXml(sourceTimeFunctionQML: Element): SourceTimeFunction {
    if (sourceTimeFunctionQML.localName !== "sourceTimeFunction") {
      throw new Error(`Cannot extract, not a QuakeML sourceTimeFunction: ${sourceTimeFunctionQML.localName}`);
    }

    const type = _grabFirstElText(sourceTimeFunctionQML, "type");
    if (!isNonEmptyStringArg(type)) {
      throw new Error("sourceTimeFunction missing type");
    }

    const duration = _grabFirstElFloat(sourceTimeFunctionQML, "duration");
    if (!isDef(duration)) {
      throw new Error("sourceTimeFunction missing duration");
    }

    const out = new SourceTimeFunction(type, duration);

    out.riseTime = _grabFirstElFloat(sourceTimeFunctionQML, "riseTime");

    out.decayTime = _grabFirstElFloat(sourceTimeFunctionQML, "decayTime");

    return out;
  }
}

/**
  Represents a QuakeML DataUsed.
 */
export class DataUsed {
  waveType: string;
  stationCount?: number;
  componentCount?: number;
  shortestPeriod?: number;
  longestPeriod?: number;

  constructor(waveType: string) {
    this.waveType = waveType;
  }

  /**
   * Parses a QuakeML dataUsed xml element into a DataUsed object.
   *
   * @param dataUsedQML the dataUsed xml Element
   * @returns SourceTimeFunction instance
   */
  static createFromXml(dataUsedQML: Element): DataUsed {
    if (dataUsedQML.localName !== "dataUsed") {
      throw new Error(`Cannot extract, not a QuakeML dataUsed: ${dataUsedQML.localName}`);
    }

    const waveType = _grabFirstElText(dataUsedQML, "waveType");
    if (!isNonEmptyStringArg(waveType)) {
      throw new Error("dataUsed missing waveType");
    }

    const out = new DataUsed(waveType);

    out.stationCount = _grabFirstElInt(dataUsedQML, "stationCount");

    out.componentCount = _grabFirstElInt(dataUsedQML, "componentCount");

    out.shortestPeriod = _grabFirstElFloat(dataUsedQML, "shortestPeriod");

    out.longestPeriod = _grabFirstElFloat(dataUsedQML, "longestPeriod");

    return out;
  }
}

/**
  Represents a QuakeML WaveformID.
 */
export class WaveformID {
  networkCode: string;
  stationCode: string;
  channelCode?: string;
  locationCode?: string;

  constructor(networkCode: string, stationCode: string) {
    this.networkCode = networkCode;
    this.stationCode = stationCode;
  }

  /**
   * Parses a QuakeML waveform ID xml element into a WaveformID object.
   *
   * @param waveformQML the waveform ID xml Element
   * @returns WaveformID instance
   */
  static createFromXml(waveformQML: Element): WaveformID {
    if (waveformQML.localName !== "waveformID") {
      throw new Error(`Cannot extract, not a QuakeML waveform ID: ${waveformQML.localName}`);
    }

    const networkCode = _grabAttribute(waveformQML, "networkCode");
    if (!isNonEmptyStringArg(networkCode)) {
      throw new Error("waveformID missing networkCode");
    }

    const stationCode = _grabAttribute(waveformQML, "stationCode");
    if (!isNonEmptyStringArg(stationCode)) {
      throw new Error("waveformID missing stationCode");
    }

    const out = new WaveformID(networkCode, stationCode);

    out.channelCode = _grabAttribute(waveformQML, "channelCode");

    out.locationCode = _grabAttribute(waveformQML, "locationCode");

    return out;
  }

  toString(): string {
    return `${this.networkCode}.${this.stationCode}.${this.locationCode || '--'}.${this.channelCode || '---'}`;
  }
}

export class Quantity<T> {
  value: T;
  uncertainty?: number;
  lowerUncertainty?: number;
  upperUncertainty?: number;
  confidenceLevel?: number;

  constructor(value: T) {
    this.value = value;
  }

  /**
   * Parses a QuakeML quantity xml element into a Quantity object.
   *
   * @param quantityQML the quantity xml Element
   * @param grab a callback to obtain the value
   * @param grabUncertainty a callback to obtain the uncertainties
   * @returns Quantity instance
   */
  static _createFromXml<T>(
    quantityQML: Element,
    grab: (xml: Element | null | void, tagName: string) => T | undefined,
    grabUncertainty: (xml: Element | null | void, tagName: string) => number | undefined,
  ): Quantity<T> {
    const value = grab(quantityQML, "value");
    if (value === undefined) {
      throw new Error("missing value");
    }

    const out = new Quantity<T>(value);

    out.uncertainty = grabUncertainty(quantityQML, "uncertainty");

    out.lowerUncertainty = grabUncertainty(quantityQML, "lowerUncertainty");

    out.upperUncertainty = grabUncertainty(quantityQML, "upperUncertainty");

    out.confidenceLevel = _grabFirstElFloat(quantityQML, "confidenceLevel");

    return out;
  }

  /**
   * Parses a QuakeML real quantity xml element into a RealQuantity object.
   *
   * @param realQuantityQML the real quantity xml Element
   * @returns RealQuantity instance
   */
  static createRealQuantityFromXml(realQuantityQML: Element): RealQuantity {
    return Quantity._createFromXml(realQuantityQML, _grabFirstElFloat, _grabFirstElFloat);
  }

  /**
   * Parses a QuakeML integer quantity xml element into a RealQuantity object.
   *
   * @param integerQuantityQML the integer quantity xml Element
   * @returns IntegerQuantity instance
   */
  static createIntegerQuantityFromXml(integerQuantityQML: Element): IntegerQuantity {
    return Quantity._createFromXml(integerQuantityQML, _grabFirstElFloat, _grabFirstElInt);
  }

  /**
   * Parses a QuakeML time quantity xml element into a TimeQuantity object.
   *
   * @param timeQuantityQML the time quantity xml Element
   * @returns TimeQuantity instance
   */
  static createTimeQuantityFromXml(timeQuantityQML: Element): TimeQuantity {
    return Quantity._createFromXml(timeQuantityQML, _grabFirstElDateTime, _grabFirstElFloat);
  }
}

export type IntegerQuantity = Quantity<number>;
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
    if (text === undefined) {
      throw new Error("missing value");
    }

    const out = new Comment(text);

    out.creationInfo = _grabFirstElCreationInfo(commentQML, "creationInfo");

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
    const out = new CreationInfo();

    out.agencyID = _grabFirstElText(creationInfoQML, "agencyID");

    out.agencyURI = _grabFirstElText(creationInfoQML, "agencyURI");

    out.author = _grabFirstElText(creationInfoQML, "author");

    out.authorURI = _grabFirstElText(creationInfoQML, "authorURI");

    out.creationTime = _grabFirstElDateTime(creationInfoQML, "creationTime");

    out.version = _grabFirstElText(creationInfoQML, "version");

    return out;
  }
}

/**
 * Parses a QuakeML xml document into seisplotjs objects
 *
 *  @param rawXml the xml Document to parse
 *  @param host optional source of the xml, helpful for parsing the eventid
 *  @returns EventParameters object
 */
export function parseQuakeML(rawXml: Document, host?: string): EventParameters {
  const top = rawXml.documentElement;

  if (!top) {
    throw new Error("Can't get documentElement");
  }

  const eventParametersArray = Array.from(top.getElementsByTagName("eventParameters"));
  if (eventParametersArray.length !== 1) {
    throw new Error(`Document has ${eventParametersArray.length} eventParameters elements`);
  }

  return EventParameters.createFromXml(eventParametersArray[0], host);
}

export function createQuakeFromValues(publicId: string,
  time: DateTime,
  latitude: number,
  longitude: number,
  depth: number): Quake {
    const origin = new Origin(
      new Quantity(time),
      new Quantity(latitude),
      new Quantity(longitude)
    );
    origin.depth = new Quantity(depth);
    const quake = new Quake();
    quake.publicId = publicId;
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
    const elList = Array.from(xml.children).filter(e => e.tagName === tagName);
    for (const el of elList) {
      if (isObject(el)) {
        out.push(Comment.createFromXml(el));
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
  if (isObject(xml)) {
    const elList = Array.from(xml.children).filter(e => e.tagName === tagName);

    if (elList.length > 0) {
      const e = elList[0];

      if (e) {
        return e;
      }
    }
  }

  return undefined;
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

const _grabFirstElBool = function (
  xml: Element | null | void,
  tagName: string,
): boolean | undefined {

  const el = _grabFirstElText(xml, tagName);

  if (!isStringArg(el)) {
    return undefined;
  }

  switch (el) {
    case "true":
    case "1":
      return true;
    case "false":
    case "0":
      return false;
  }
  throw new Error("Invalid boolean: " + el);
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
const _grabFirstElIntegerQuantity = _grabFirstElType(Quantity.createIntegerQuantityFromXml.bind(Quantity));
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
