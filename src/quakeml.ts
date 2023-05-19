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
      allMags.push(Magnitude.createFromXml(magEl, allOrigins));
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
    return this.origin.time.value;
  }
  get latitude(): number {
    return this.origin.latitude.value;
  }
  get longitude(): number {
    return this.origin.longitude.value;
  }
  get depth(): number {
    return this.origin.depth?.value ?? NaN;
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
export class Origin extends BaseElement {
  compositeTimes: Array<CompositeTime>;
  originUncertainty?: OriginUncertainty;
  arrivalList: Array<Arrival>;
  time: TimeQuantity;
  latitude: RealQuantity;
  longitude: RealQuantity;
  depth?: RealQuantity;
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

  constructor(time: TimeQuantity, latitude: RealQuantity, longitude: RealQuantity) {
    super();
    this.compositeTimes = [];
    this.arrivalList = [];
    this.time = time;
    this.latitude = latitude;
    this.longitude = longitude;
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

    const uncertainty = _grabFirstElType(OriginUncertainty.createFromXml.bind(OriginUncertainty))(qml, "originUncertainty");

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

    const depth = _grabFirstElRealQuantity(qml, "depth");

    const depthType = _grabFirstElText(qml, "depthType");

    const timeFixed = _grabFirstElBool(qml, "timeFixed");

    const epicenterFixed = _grabFirstElBool(qml, "epicenterFixed");

    const referenceSystemID = _grabFirstElText(qml, "referenceSystemID");

    const methodID = _grabFirstElText(qml, "methodID");

    const earthModelID = _grabFirstElText(qml, "earthModelID");

    const quality = _grabFirstElType(OriginQuality.createFromXml.bind(OriginQuality))(qml, "quality");

    const type = _grabFirstElText(qml, "type");

    const region = _grabFirstElText(qml, "region");

    const evaluationMode = _grabFirstElText(qml, "evaluationMode");

    const evaluationStatus = _grabFirstElText(qml, "evaluationStatus");

    const allArrivalEls = Array.from(qml.getElementsByTagNameNS(BED_NS, "arrival"));
    const allArrivals = [];

    for (const arrivalEl of allArrivalEls) {
      allArrivals.push(Arrival.createFromXml(arrivalEl, allPicks));
    }

    const out = new Origin(time, lat, lon);

    out.populate(qml);
    out.originUncertainty = uncertainty;
    out.arrivalList = allArrivals;
    out.depth = depth;
    out.depthType = depthType;
    out.timeFixed = timeFixed;
    out.epicenterFixed = epicenterFixed;
    out.referenceSystemID = referenceSystemID;
    out.methodID = methodID;
    out.earthModelID = earthModelID;
    out.quality = quality;
    out.type = type;
    out.region = region;
    out.evaluationMode = evaluationMode;
    out.evaluationStatus = evaluationStatus;

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

    const year = _grabFirstElIntegerQuantity(qml, "year");
    const month = _grabFirstElIntegerQuantity(qml, "month");
    const day = _grabFirstElIntegerQuantity(qml, "day");
    const hour = _grabFirstElIntegerQuantity(qml, "hour");
    const minute = _grabFirstElIntegerQuantity(qml, "minute");
    const second = _grabFirstElIntegerQuantity(qml, "second");

    const out = new CompositeTime();

    out.year = year;
    out.month = month;
    out.day = day;
    out.hour = hour;
    out.minute = minute;
    out.second = second;

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

    const horizontalUncertainty = _grabFirstElFloat(qml, "horizontalUncertainty");

    const minHorizontalUncertainty = _grabFirstElFloat(qml, "minHorizontalUncertainty");

    const maxHorizontalUncertainty = _grabFirstElFloat(qml, "maxHorizontalUncertainty");

    const azimuthMaxHorizontalUncertainty = _grabFirstElFloat(qml, "azimuthMaxHorizontalUncertainty");

    const confidenceEllipsoid = _grabFirstElType(ConfidenceEllipsoid.createFromXml.bind(ConfidenceEllipsoid))(qml, "confidenceEllipsoid");

    const preferredDescription = _grabFirstElText(qml, "preferredDescription");

    const confidenceLevel = _grabFirstElFloat(qml, "confidenceLevel");

    const out = new OriginUncertainty();

    out.horizontalUncertainty = horizontalUncertainty;
    out.minHorizontalUncertainty = minHorizontalUncertainty;
    out.maxHorizontalUncertainty = maxHorizontalUncertainty;
    out.azimuthMaxHorizontalUncertainty = azimuthMaxHorizontalUncertainty;
    out.confidenceEllipsoid = confidenceEllipsoid;
    out.preferredDescription = preferredDescription;
    out.confidenceLevel = confidenceLevel;

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

    const associatedPhaseCount = _grabFirstElInt(qml, "associatedPhaseCount");

    const usedPhaseCount = _grabFirstElInt(qml, "usedPhaseCount");

    const associatedStationCount = _grabFirstElInt(qml, "associatedStationCount");

    const usedStationCount = _grabFirstElInt(qml, "usedStationCount");

    const standardError = _grabFirstElFloat(qml, "standardError");

    const azimuthalGap = _grabFirstElFloat(qml, "azimuthalGap");

    const secondaryAzimuthalGap = _grabFirstElFloat(qml, "secondaryAzimuthalGap");

    const groundTruthLevel = _grabFirstElText(qml, "groundTruthLevel");

    const maximumDistance = _grabFirstElFloat(qml, "maximumDistance");

    const minimumDistance = _grabFirstElFloat(qml, "minimumDistance");

    const medianDistance = _grabFirstElFloat(qml, "medianDistance");

    const out = new OriginQuality();

    out.associatedPhaseCount = associatedPhaseCount;
    out.usedPhaseCount = usedPhaseCount;
    out.associatedStationCount = associatedStationCount;
    out.usedStationCount = usedStationCount;
    out.standardError = standardError;
    out.azimuthalGap = azimuthalGap;
    out.secondaryAzimuthalGap = secondaryAzimuthalGap;
    out.groundTruthLevel = groundTruthLevel;
    out.maximumDistance = maximumDistance;
    out.minimumDistance = minimumDistance;
    out.medianDistance = medianDistance;

    return out;
  }
}

/**
  Represents a QuakeML Magnitude.
 */
export class Magnitude extends BaseElement {
  mag: RealQuantity;
  type?: string;
  origin?: Origin;
  methodID?: string;
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
   * @param allOrigins origins already extracted from the xml for linking magnitudes with origins
   * @returns Magnitude instance
   */
  static createFromXml(qml: Element, allOrigins: Origin[]): Magnitude {
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

    const originID = _grabFirstElText(qml, "originID");
    const origin = allOrigins.find(o => o.publicId === originID);
    if (originID && !origin) {
      throw new Error("No origin with ID " + originID);
    }

    const methodID = _grabFirstElText(qml, "methodID");

    const stationCount = _grabFirstElInt(qml, "stationCount");

    const azimuthalGap = _grabFirstElFloat(qml, "azimuthalGap");

    const evaluationMode = _grabFirstElText(qml, "evaluationMode");

    const evaluationStatus = _grabFirstElText(qml, "evaluationStatus");

    const out = new Magnitude(mag);

    out.populate(qml);
    out.type = type;
    out.origin = origin;
    out.methodID = methodID;
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

    const earthModelID = _grabFirstElText(arrivalQML, "earthModelID");

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
      out.earthModelID = earthModelID;

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

    const filterID = _grabFirstElText(pickQML, "filterID");

    const methodID = _grabFirstElText(pickQML, "methodID");

    const horizontalSlowness = _grabFirstElRealQuantity(pickQML, "horizontalSlowness");

    const backazimuth = _grabFirstElRealQuantity(pickQML, "backazimuth");

    const slownessMethodID = _grabFirstElText(pickQML, "slownessMethodID");

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
    out.filterID = filterID;
    out.methodID = methodID;
    out.horizontalSlowness = horizontalSlowness;
    out.backazimuth = backazimuth;
    out.slownessMethodID = slownessMethodID;
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

    const uncertainty = grabUncertainty(quantityQML, "uncertainty");

    const lowerUncertainty = grabUncertainty(quantityQML, "lowerUncertainty");

    const upperUncertainty = grabUncertainty(quantityQML, "upperUncertainty");

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
    return Quantity._createFromXml(realQuantityQML, _grabFirstElFloat, _grabFirstElFloat);
  }

  /**
   * Parses a QuakeML integer quantity xml element into a RealQuantity object.
   *
   * @param integerQuantityQML the integer quantity xml Element
   * @returns IntegerQuantity instance
   */
  static createIntegerQuantityFromXml(integerQuantityQML: Element): RealQuantity {
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
    const origin = new Origin(
      new Quantity(time),
      new Quantity(latitude),
      new Quantity(longitude)
    );
    origin.depth = new Quantity(depth);
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
