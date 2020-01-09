// @flow

/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */

import { isObject, isStringArg, isNonEmptyStringArg,
         isNumArg, checkStringOrDate, stringify} from './util';
import * as util from './util.js'; // for util.log
import moment from 'moment';

export const QML_NS = 'http://quakeml.org/xmlns/quakeml/1.2';
export const BED_NS = 'http://quakeml.org/xmlns/bed/1.2';
export const IRIS_NS = 'http://service.iris.edu/fdsnws/event/1/';
export const ANSS_NS = 'http://anss.org/xmlns/event/0.1';
export const ANSS_CATALOG_NS = "http://anss.org/xmlns/catalog/0.1";

export const USGS_HOST = "earthquake.usgs.gov";

export const UNKNOWN_MAG_TYPE = 'unknown';

// QuakeML classes

/**
 * Represent a QuakeML Event. Renamed to Quake as Event conflicts with
 * other uses in javascript.
 */
export class Quake {
  eventId: string;
  publicId: string;
  _time: moment;
  latitude: number;
  longitude: number;
  depth: number;
  description: string;
  magnitude: Magnitude;
  magnitudeList: Array<Magnitude>;
  originList: Array<Origin>;
  pickList: Array<Pick>;
  preferredOriginId: ?string;
  preferredOrigin: Origin;
  preferredMagnitudeId: ?string;
  preferredMagnitude: Magnitude;
  constructor() {
// what is essential???
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
    let out = new Quake();
    let s = _grabAttribute(qml, 'publicID');
    if (! isNonEmptyStringArg(s)) {throw new Error("Quake/Event does not have publicID");}
    out.publicId = s;
    const desc = _grabFirstElText(_grabFirstEl(qml, 'description'), 'text');
    if (isStringArg(desc)) {out.description = desc;}
    let otimeStr = _grabFirstElText(_grabFirstEl(_grabFirstEl(qml, 'origin'), 'time'),'value');
    if (isNonEmptyStringArg(otimeStr) ) {
      out.time = otimeStr;
    }

    //need picks before can do origins
    let allPickEls = qml.getElementsByTagNameNS(BED_NS, 'pick');
    let allPicks = [];
    for (let pickEl of allPickEls) {
      allPicks.push(Pick.createFromXml(pickEl));
    }

    let allOriginEls = qml.getElementsByTagNameNS(BED_NS, "origin");
    let allOrigins = [];
    for (let originEl of allOriginEls) {
      allOrigins.push(Origin.createFromXml(originEl, allPicks));
    }
    let allMagEls = qml.getElementsByTagNameNS(BED_NS, "magnitude");
    let allMags = [];
    for (let magEl of allMagEls) {
      allMags.push(Magnitude.createFromXml(magEl));
    }
    out.originList = allOrigins;
    out.magnitudeList = allMags;
    out.pickList = allPicks;
    out.eventId = Quake.extractEventId(qml, host);
    out.preferredOriginId = _grabFirstElText(qml, 'preferredOriginID');
    out.preferredMagnitudeId = _grabFirstElText(qml, 'preferredMagnitudeID');
    if (isNonEmptyStringArg(out.preferredOriginId)) {
      for (let o of allOrigins) {
        if (o.publicId === out.preferredOriginId) {
          out.preferredOrigin = o;
          out.latitude = o.latitude;
          out.longitude = o.longitude;
          out.depth = o.depth;
          out.time = o.time;
        } else {
          util.log(`no preferredOriginId match: ${o.publicId} ${out.preferredOriginId}`);
        }
      }
    } else if (out.originList.length > 1) {
      const o = out.originList[0];
      out.latitude = o.latitude;
      out.longitude = o.longitude;
      out.depth = o.depth;
    }
    if (allMags.length > 0) {out.magnitude = allMags[0];}
    if (isNonEmptyStringArg(out.preferredMagnitudeId)) {
      for (let m of allMags) {
        if (m.publicId === out.preferredMagnitudeId) {
          out.preferredMagnitude = m;
          out.magnitude = m;
        } else {
          util.log(`no match: ${m.publicId} ${out.preferredMagnitudeId}`);
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
    let eventId = _grabAttributeNS(qml, ANSS_CATALOG_NS, 'eventid');
    let catalogEventSource = _grabAttributeNS(qml, ANSS_CATALOG_NS, 'eventsource');
    if (isNonEmptyStringArg(eventId)) {
      if (host === USGS_HOST && isNonEmptyStringArg(catalogEventSource)) {
        // USGS, NCEDC and SCEDC use concat of eventsource and eventId as eventit, sigh...
        return catalogEventSource+eventId;
      } else {
        return eventId;
      }
    }
    let publicid = _grabAttribute(qml, 'publicID');
    if (isNonEmptyStringArg(publicid)) {
      let re = /eventid=([\w\d]+)/;
      let parsed = re.exec(publicid);
      if (parsed) { return parsed[1];}
      re = /evid=([\w\d]+)/;
      parsed = re.exec(publicid);
      if (parsed) { return parsed[1];}
    }
    return "unknownEventId";
  }
  get time(): moment {
    return this._time;
  }
  set time(value: moment | string) {
    this._time = moment.utc(value);
  }
  get arrivals(): Array<Arrival> {
    return this.preferredOrigin.arrivalList;
  }
  get picks(): Array<Pick> {
    return this.pickList;
  }
  toString() {
    return stringify(this.time)
    +' '+stringify(this.latitude)
    +" "+stringify(this.longitude)
    +' '+stringify(this.depth)
    +' '+this.magnitude.toString();
  }
}
/** Represents a QuakeML Origin. */
export class Origin {
  time: moment;
  latitude: number;
  longitude: number;
  depth: number;
  arrivalList: Array<Arrival>;
  publicId: string;

  constructor() {
// what is essential???
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
    let out = new Origin();
    let otimeStr = _grabFirstElText(_grabFirstEl(qml, 'time'),'value');
    if (isNonEmptyStringArg(otimeStr) ) {
      out.time = otimeStr;
    } else {
      util.log("origintime is missing...");
    }
    const lat = _grabFirstElFloat(_grabFirstEl(qml, 'latitude'), 'value');
    if (isNumArg(lat)) {out.latitude = lat;}
    const lon = _grabFirstElFloat(_grabFirstEl(qml, 'longitude'), 'value');
    if (isNumArg(lon)) {out.longitude = lon;}
    const depth = _grabFirstElFloat(_grabFirstEl(qml, 'depth'), 'value');
    if (isNumArg(depth)) {out.depth = depth;}
    const pid = _grabAttribute(qml, 'publicID');
    if (isNonEmptyStringArg(pid)){out.publicId = pid;}

    let allArrivalEls = qml.getElementsByTagNameNS(BED_NS, 'arrival');
    let allArrivals = [];
    for ( let arrivalEl of allArrivalEls) {
      allArrivals.push(Arrival.createFromXml(arrivalEl, allPicks));
    }
    out.arrivalList = allArrivals;
    return out;
  }
  toString() {
    return stringify(this.time)
      +' '+stringify(this.latitude)
      +" "+stringify(this.longitude)
      +' '+stringify(this.depth);
  }
  get arrivals(): Array<Arrival> {
    return this.arrivalList;
  }
}
/** Represents a QuakeML Magnitude.
 */
export class Magnitude {
  mag: number;
  type: string;
  publicId: string;

  constructor(mag: number, type: string) {
    this.mag = mag;
    this.type = type;
  }
  /**
   * Parses a QuakeML magnitude xml element into a Magnitude object.
   *
   * @param qml the magnitude xml Element
   * @returns Magnitude instance
   */
  static createFromXml(qml: Element): Magnitude {
    if (qml.localName !== "magnitude") {
      throw new Error(`Cannot extract, not a QuakeML Magnitude: ${qml.localName}`);
    }
    let mag = _grabFirstElFloat(_grabFirstElNS(qml, BED_NS, 'mag'), 'value');
    let type = _grabFirstElText(qml, 'type');
    if (isNumArg(mag)) {
      // allow type to be undef, but mag needs to be a number
      if ( ! isNonEmptyStringArg(type) ) {
        type = UNKNOWN_MAG_TYPE;
      }
      let out = new Magnitude(mag, type);
      const pid = _grabAttribute(qml, 'publicID');
      if (isNonEmptyStringArg(pid)){out.publicId = pid;}
      return out;
    } else {
      throw new Error(`Did not find mag and type in Element: ${stringify(mag)} ${stringify(type)}`);
    }
  }
  toString() {
    return stringify(this.mag)+" "+stringify(this.type);
  }
}

/** Represents a QuakeML Arrival, a combination of a Pick with a phase name.
 */
export class Arrival {
  phase: string;
  pick: Pick;
  publicId: string;

  constructor(phase: string, pick: Pick) {
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
      throw new Error(`Cannot extract, not a QuakeML Arrival: ${arrivalQML.localName}`);
    }
    let pickId = _grabFirstElText(arrivalQML, 'pickID');
    let phase = _grabFirstElText(arrivalQML, 'phase');
    if (isNonEmptyStringArg(phase) && isNonEmptyStringArg(pickId)) {
      let myPick = allPicks.find(function(p: Pick) { return p.publicId === pickId;});
      if ( ! myPick) {
        throw new Error("Can't find pick with Id="+pickId+" for Arrival");
      }
      let out = new Arrival(phase, myPick);
      const pid = _grabAttribute(arrivalQML, 'publicID');
      if (isNonEmptyStringArg(pid)){out.publicId = pid;}
      return out;
    } else {
      throw new Error("Arrival does not have phase or pickId: "+stringify(phase)+" "+stringify(pickId));
    }
  }
}

/** Represents a QuakeML Pick.
 */
export class Pick {
  time: moment;
  networkCode: string;
  stationCode: string;
  locationCode: string;
  channelCode: string;
  publicId: string;
  constructor(time: moment,
      networkCode: string,
      stationCode: string,
      locationCode: string,
      channelCode: string) {
    this.time = checkStringOrDate(time);
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
      throw new Error(`Cannot extract, not a QuakeML Pick: ${pickQML.localName}`);
    }
    let otimeStr = _grabFirstElText(_grabFirstEl(pickQML, 'time'),'value');
    let time = checkStringOrDate(otimeStr);
    let waveformIdEl = _grabFirstEl(pickQML, 'waveformID');
    let netCode = _grabAttribute(waveformIdEl, "networkCode");
    let stationCode = _grabAttribute(waveformIdEl, "stationCode");
    let locationCode = _grabAttribute(waveformIdEl, "locationCode");
    let channelCode = _grabAttribute(waveformIdEl, "channelCode");
    // handle empty loc code, it can be missing
    if ( ! isNonEmptyStringArg(locationCode)) { locationCode = '';}
    if (! isNonEmptyStringArg(netCode) || ! isNonEmptyStringArg(stationCode)
        || ! isNonEmptyStringArg(channelCode)) {
      throw new Error("missing codes: "+stringify(netCode)
                      +"."+ stringify(stationCode)
                      +"."+ stringify(locationCode)
                      +"."+ stringify(channelCode));
    }
    let out = new Pick(time, netCode, stationCode, locationCode, channelCode);
    const pid = _grabAttribute(pickQML, 'publicID');
    if (isNonEmptyStringArg(pid)){out.publicId = pid;}
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
  let top = rawXml.documentElement;
  if (! top) {
    throw new Error("Can't get documentElement");
  }
  let eventArray = top.getElementsByTagName("event");
  let out = [];
  for (let eventEl of eventArray) {
    out.push(Quake.createFromXml(eventEl, host));
  }
  return out;
}

// these are similar methods as in seisplotjs.stationxml
// duplicate here to avoid dependency and diff NS, yes that is dumb...

const _grabFirstElNS = function(xml: Element | null | void, namespace: string, tagName: string): Element | void {
  let out = undefined;
  if ( isObject(xml)) {
    let elList = xml.getElementsByTagNameNS(namespace, tagName);
    if (isObject(elList) && elList.length > 0) {
      const e = elList.item(0);
      if (e) {
        out = e;
      }
    }
  }
  return out;
};

const _grabFirstEl = function(xml: Element | null | void, tagName: string): Element | void {
  let out = undefined;
  if ( isObject(xml)) {
    let elList = xml.getElementsByTagName(tagName);
    if (isObject(elList) && elList.length > 0) {
      const e = elList.item(0);
      if (e) {
        out = e;
      }
    }
  }
  return out;
};

const _grabFirstElText = function(xml: Element | null | void, tagName: string): string | void {
  let out = undefined;
  let el = _grabFirstEl(xml, tagName);
  if (isObject(el)) {
    out = el.textContent;
  }
  return out;
};

const _grabFirstElInt = function(xml: Element | null | void, tagName: string): number | void {
  let out = undefined;
  let el = _grabFirstElText(xml, tagName);
  if (isStringArg(el)) {
    out = parseInt(el);
  }
  return out;
};

const _grabFirstElFloat = function(xml: Element | null | void, tagName: string): number | void {
  let out = undefined;
  let el = _grabFirstElText(xml, tagName);
  if (isStringArg(el)) {
    out = parseFloat(el);
  }
  return out;
};

const _grabAttribute = function(xml: Element | null | void, tagName: string): string | void {
  let out = undefined;
  if ( isObject(xml)) {
    let a = xml.getAttribute(tagName);
    if (isStringArg(a)) {
      out = a;
    }
  }
  return out;
};

const _grabAttributeNS = function(xml: Element | null | void, namespace: string, tagName: string): string | void {
  let out = undefined;
  if ( isObject(xml)) {
    let a = xml.getAttributeNS(namespace, tagName);
    if (isStringArg(a)) {
      out = a;
    }
  }
  return out;
};

export const parseUtil = {
  "_grabFirstEl": _grabFirstEl,
  "_grabFirstElNS": _grabFirstElNS,
  "_grabFirstElText": _grabFirstElText,
  "_grabFirstElFloat": _grabFirstElFloat,
  "_grabFirstElInt": _grabFirstElInt,
  "_grabAttribute": _grabAttribute,
  "_grabAttributeNS": _grabAttributeNS
};
