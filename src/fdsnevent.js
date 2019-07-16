// @flow

import { moment } from 'moment';
import { Quake, Origin, Magnitude, Arrival, Pick } from './quakeml';

// special due to flow
import {checkProtocol, toIsoWoZ, hasArgs, hasNoArgs, isDef, isObject, isStringArg, isNumArg, checkStringOrDate, stringify} from './util';


import RSVP from 'rsvp';

RSVP.on('error', function(reason) {
  console.assert(false, reason);
});


export let QML_NS = 'http://quakeml.org/xmlns/quakeml/1.2';
export let BED_NS = 'http://quakeml.org/xmlns/bed/1.2';
export let IRIS_NS = 'http://service.iris.edu/fdsnws/event/1/';
export let ANSS_NS = 'http://anss.org/xmlns/event/0.1';
export let ANSS_CATALOG_NS = "http://anss.org/xmlns/catalog/0.1";

export let USGS_HOST = "earthquake.usgs.gov";

export const FAKE_EMPTY_XML = '<?xml version="1.0"?><q:quakeml xmlns="http://quakeml.org/xmlns/bed/1.2" xmlns:q="http://quakeml.org/xmlns/quakeml/1.2"><eventParameters publicID="quakeml:fake/empty"></eventParameters></q:quakeml>';

/**
 * Query to a FDSN Event web service.
 * @see http://www.fdsn.org/webservices/
*/
export class EventQuery {
  /** @private */
  _specVersion: number;
  /** @private */
  _protocol: string;
  /** @private */
  _host: string;
  /** @private */
  _port: number;
  /** @private */
  _nodata: number;
  /** @private */
  _eventId: string;
  /** @private */
  _startTime: moment;
  /** @private */
  _endTime: moment;
  /** @private */
  _updatedAfter: moment;
  /** @private */
  _minMag: number;
  /** @private */
  _maxMag: number;
  /** @private */
  _magnitudeType: string;
  /** @private */
  _minDepth: number;
  /** @private */
  _maxDepth: number;
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
  _includeArrivals: boolean;
  /** @private */
  _includeAllOrigins: boolean;
  /** @private */
  _includeAllMagnitudes: boolean;
  /** @private */
  _limit: number;
  /** @private */
  _offset: number;
  /** @private */
  _orderBy: string;
  /** @private */
  _contributor: string;
  /** @private */
  _catalog: string;
  /** @private */
  _format: string;
  constructor(host?: string) {
    this._specVersion = 1;
    this._protocol = checkProtocol();
    this.host(host);
    if (! host) {
      this._host = USGS_HOST;
    }
    this._port = 80;
  }
  /** Gets/Sets the version of the fdsnws spec, 1 is currently the only value.
   *  Setting this is probably a bad idea as the code may not be compatible with
   *  the web service.
  */
  specVersion(value?: number): number | EventQuery {
    if (hasArgs(value)) {
      this._specVersion = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._specVersion;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  /** Gets/Sets the protocol, http or https. This should match the protocol
   *  of the page loaded, but is autocalculated and generally need not be set.
  */
  protocol(value?: string): string | EventQuery {
    if (isStringArg(value)) {
      this._protocol = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._protocol;
    } else {
      throw new Error('value argument is optional or string, but was '+typeof value);
    }
  }
  /** Gets/Sets the remote host to connect to.
  */
  host(value?: string): string | EventQuery {
    if (isStringArg(value)) {
      this._host = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._host;
    } else {
      throw new Error('value argument is optional or string, but was '+typeof value);
    }
  }
  /** Gets/Sets the remote port to connect to.
  */
  port(value?: number): number | EventQuery {
    if (hasNoArgs(value)) {
      return this._port;
    } else if (hasArgs(value)) {
      this._port = value;
      return this;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  /** Gets/Sets the nodata parameter, usually 404 or 204 (default), controlling
   * the status code when no matching data is found by the service.
   */
  nodata(value?: number): number | EventQuery {
    if (hasNoArgs(value)) {
      return this._nodata;
    } else if (hasArgs(value)) {
      this._nodata = value;
      return this;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  /** Get/Set the eventid query parameter.
  */
  eventId(value?: string): string | EventQuery {
    if (hasNoArgs(value)) {
      return this._eventId;
    } else if (isStringArg(value)) {
      this._eventId = value;
      return this;
    } else  {
      throw new Error('value argument is optional or string, but was '+typeof value);
    }
  }
  /** Get/Set the starttime query parameter.
  */
  startTime(value?: moment): moment | EventQuery {
    if (hasNoArgs(value)) {
      return this._startTime;
    } else if (hasArgs(value)) {
      this._startTime = checkStringOrDate(value);
      return this;
    } else {
      throw new Error('value argument is optional or moment or string, but was '+typeof value);
    }
  }
  /** Get/Set the endtime query parameter.
  */
  endTime(value?: moment): moment | EventQuery {
    if (hasNoArgs(value)) {
      return this._endTime;
    } else if (hasArgs(value)) {
      this._endTime = checkStringOrDate(value);
      return this;
    } else {
      throw new Error('value argument is optional or moment or string, but was '+typeof value);
    }
  }
  /** Get/Set the updatedafter query parameter.
  */
  updatedAfter(value?: moment): moment | EventQuery {
    if (hasNoArgs(value)) {
      return this._updatedAfter;
    } else if (hasArgs(value)) {
      this._updatedAfter = checkStringOrDate(value);
      return this;
    } else {
      throw new Error('value argument is optional or moment or string, but was '+typeof value);
    }
  }
  /** Get/Set the minmag query parameter.
  */
  minMag(value?: number): number | EventQuery {
    if (hasNoArgs(value)) {
      return this._minMag;
    } else if (isNumArg(value)) {
      this._minMag = value;
      return this;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  /** Get/Set the maxmag query parameter.
  */
  maxMag(value?: number): number | EventQuery {
    if (hasNoArgs(value)) {
      return this._maxMag;
    } else if (isNumArg(value)) {
      this._maxMag = value;
      return this;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  /** Get/Set the magnitudetype query parameter.
  */
  magnitudeType(value?: string): string | EventQuery {
    if (hasNoArgs(value)) {
      return this._magnitudeType;
    } else if (isStringArg(value)) {
      this._magnitudeType = value;
      return this;
    } else {
      throw new Error('value argument is optional or string, but was '+typeof value);
    }
  }
  /** Get/Set the mindepth query parameter.
  */
  minDepth(value?: number): number | EventQuery {
    if (hasNoArgs(value)) {
      return this._minDepth;
    } else if (isNumArg(value)) {
      this._minDepth = value;
      return this;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  /** Get/Set the maxdepth query parameter.
  */
  maxDepth(value?: number): number | EventQuery {
    if (hasNoArgs(value)) {
      return this._maxDepth;
    } else if (isNumArg(value)) {
      this._maxDepth = value;
      return this;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  /** Get/Set the minlat query parameter.
  */
  minLat(value?: number): number | EventQuery {
    if (hasNoArgs(value)) {
      return this._minLat;
    } else if (isNumArg(value)) {
      this._minLat = value;
      return this;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  /** Get/Set the maxlat query parameter.
  */
  maxLat(value?: number): number | EventQuery {
    if (hasNoArgs(value)) {
      return this._maxLat;
    } else if (isNumArg(value)) {
      this._maxLat = value;
      return this;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  /** Get/Set the minlon query parameter.
  */
  minLon(value?: number): number | EventQuery {
    if (hasNoArgs(value)) {
      return this._minLon;
    } else if (isNumArg(value)) {
      this._minLon = value;
      return this;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  /** Get/Set the maxlon query parameter.
  */
  maxLon(value?: number): number | EventQuery {
    if (hasNoArgs(value)) {
      return this._maxLon;
    } else if (isNumArg(value)) {
      this._maxLon = value;
      return this;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  /** Get/Set the latitude query parameter.
  */
  latitude(value?: number): number | EventQuery {
    if (hasNoArgs(value)) {
      return this._latitude;
    } else if (isNumArg(value)) {
      this._latitude = value;
      return this;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  /** Get/Set the longitude query parameter.
  */
  longitude(value?: number): number | EventQuery {
    if (hasNoArgs(value)) {
      return this._longitude;
    } else if (isNumArg(value)) {
      this._longitude = value;
      return this;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  /** Get/Set the minradius query parameter.
  */
  minRadius(value?: number): number | EventQuery {
    if (hasNoArgs(value)) {
      return this._minRadius;
    } else if (isNumArg(value)) {
      this._minRadius = value;
      return this;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  /** Get/Set the maxradius query parameter.
  */
  maxRadius(value?: number): number | EventQuery {
    if (hasNoArgs(value)) {
      return this._maxRadius;
    } else if (isNumArg(value)) {
      this._maxRadius = value;
      return this;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  /* @deprecated */
  includearrivals(value?: boolean): boolean | EventQuery {
    return this.includeArrivals(value);
  }
  /** Get/Set the includearrivals query parameter.
  */
  includeArrivals(value?: boolean): boolean | EventQuery {
    if (hasNoArgs(value)) {
      return this._includeArrivals;
    } else if (hasArgs(value)) {
      this._includeArrivals = value;
      return this;
    } else {
      throw new Error('value argument is optional or boolean, but was '+typeof value);
    }
  }
  /** Get/Set the includeallorigins query parameter.
  */
  includeAllOrigins(value?: boolean): boolean | EventQuery {
    if (hasNoArgs(value)) {
      return this._includeAllOrigins;
    } else if (hasArgs(value)) {
      this._includeAllOrigins = value;
      return this;
    } else {
      throw new Error('value argument is optional or boolean, but was '+typeof value);
    }
  }
  /** Get/Set the includeallmagnitudes query parameter.
  */
  includeAllMagnitudes(value?: boolean): boolean | EventQuery {
    if (hasNoArgs(value)) {
      return this._includeAllMagnitudes;
    } else if (hasArgs(value)) {
      this._includeAllMagnitudes = value;
      return this;
    } else {
      throw new Error('value argument is optional or boolean, but was '+typeof value);
    }
  }
  /** Get/Set the format query parameter.
  */
  format(value?: string): string | EventQuery {
    if (hasNoArgs(value)) {
      return this._format;
    } else if (isStringArg(value)) {
      this._format = value;
      return this;
    } else {
      throw new Error('value argument is optional or string, but was '+typeof value);
    }
  }
  /** Get/Set the limit query parameter.
  */
  limit(value?: number): number | EventQuery {
    if (hasNoArgs(value)) {
      return this._limit;
    } else if (isNumArg(value)) {
      this._limit = value;
      return this;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  /** Get/Set the offset query parameter.
  */
  offset(value?: number): number | EventQuery {
    if (hasNoArgs(value)) {
      return this._offset;
    } else if (isNumArg(value)) {
      this._offset = value;
      return this;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  /** Get/Set the orderby query parameter.
  */
  orderBy(value?: string): string | EventQuery {
    if (hasNoArgs(value)) {
      return this._orderBy;
    } else if (isStringArg(value)) {
      this._orderBy = value;
      return this;
    } else {
      throw new Error('value argument is optional or string, but was '+typeof value);
    }
  }
  /** Get/Set the catalog query parameter.
  */
  catalog(value?: string): string | EventQuery {
    if (hasNoArgs(value)) {
      return this._catalog;
    } else if (isStringArg(value)) {
      this._catalog = value;
      return this;
    } else {
      throw new Error('value argument is optional or string, but was '+typeof value);
    }
  }
  /** Get/Set the contributor query parameter.
  */
  contributor(value?: string): string | EventQuery {
    if (hasNoArgs(value)) {
      return this._contributor;
    } else if (isStringArg(value)) {
      this._contributor = value;
      return this;
    } else {
      throw new Error('value argument is optional or string, but was '+typeof value);
    }
  }

  /** Checks to see if any parameter that would limit the data
    * returned is set. This is a crude, coarse check to make sure
    * the client doesn't ask for EVERYTHING the server has. */
  isSomeParameterSet(): boolean {
    return isDef(this._eventId) ||
      isDef(this._startTime) ||
      isDef(this._endTime) ||
      isDef(this._minLat) ||
      isDef(this._maxLat) ||
      isDef(this._minLon) ||
      isDef(this._maxLon) ||
      isDef(this._latitude) ||
      isDef(this._longitude) ||
      isDef(this._minRadius) ||
      isDef(this._maxRadius) ||
      isDef(this.minDepth) ||
      isDef(this.maxDepth) ||
      isDef(this.limit) ||
      isDef(this.minMag) ||
      isDef(this.maxMag) ||
      isDef(this.updatedAfter) ||
      isDef(this.catalog) ||
      isDef(this.contributor);
  }

  /** Parses a QuakeML event xml element into a Quake object.
   * @param qml the event xml Element
  */
  convertToQuake(qml: Element): Quake {
    let out = new Quake();
    let s = _grabAttribute(qml, 'publicID');
    if (! s) {throw new Error("Quake/Event does not have publicID");}
    out.publicId = s;
    const desc = _grabFirstElText(_grabFirstEl(qml, 'description'), 'text');
    if (isStringArg(desc)) {out.description = desc;}
    let otimeStr = _grabFirstElText(_grabFirstEl(_grabFirstEl(qml, 'origin'), 'time'),'value');
    if (otimeStr ) {
      out.time = otimeStr;
    } else {
      console.log("origintime is missing..."+out.description);
    }

    //need picks before can do origins
    let allPickEls = qml.getElementsByTagNameNS(BED_NS, 'pick');
    let allPicks = [];
    for (let pickEl of allPickEls) {
      allPicks.push(this.convertToPick(pickEl));
    }

    let allOriginEls = qml.getElementsByTagNameNS(BED_NS, "origin");
    let allOrigins = [];
    for (let originEl of allOriginEls) {
      allOrigins.push(this.convertToOrigin(originEl, allPicks));
    }
    let allMagEls = qml.getElementsByTagNameNS(BED_NS, "magnitude");
    let allMags = [];
    for (let magEl of allMagEls) {
      allMags.push(this.convertToMagnitude(magEl));
    }
    out.originList = allOrigins;
    out.magnitudeList = allMags;
    out.pickList = allPicks;
    out.eventId = this.extractEventId(qml);
    out.preferredOriginId = _grabFirstElText(qml, 'preferredOriginID');
    out.preferredMagnitudeId = _grabFirstElText(qml, 'preferredMagnitudeID');
    if (out.preferredOriginId) {
      for (let o of allOrigins) {
        if (o.publicId === out.preferredOriginId) {
          out.preferredOrigin = o;
          out.latitude = o.latitude;
          out.longitude = o.longitude;
          out.depth = o.depth;
        } else {
          console.log(`no match: ${o.publicId} ${out.preferredOriginId}`);
        }
      }
    } else if (out.originList.length > 1) {
      const o = out.originList[0];
      out.latitude = o.latitude;
      out.longitude = o.longitude;
      out.depth = o.depth;
    }
    if (allMags.length > 0) {out.magnitude = allMags[0];}
    if (out.preferredMagnitudeId) {
      for (let m of allMags) {
        if (m.publicId === out.preferredMagnitudeId) {
          out.preferredMagnitude = m;
          out.magnitude = m;
        } else {
          console.log(`no match: ${m.publicId} ${out.preferredMagnitudeId}`);
        }
      }
    }
    return out;
  }
  extractEventId(qml: Element): string {
    let eventId = _grabAttributeNS(qml, ANSS_CATALOG_NS, 'eventid');
    let catalogEventSource = _grabAttributeNS(qml, ANSS_CATALOG_NS, 'eventsource');
    if (eventId) {
      if (this.host() === USGS_HOST && catalogEventSource) {
        // USGS, NCEDC and SCEDC use concat of eventsource and eventId as eventit, sigh...
        return catalogEventSource+eventId;
      } else {
        return eventId;
      }
    }
    let publicid = _grabAttribute(qml, 'publicID');
    if (publicid) {
      let re = /eventid=([\w\d]+)/;
      let parsed = re.exec(publicid);
      if (parsed) { return parsed[1];}
      re = /evid=([\w\d]+)/;
      parsed = re.exec(publicid);
      if (parsed) { return parsed[1];}
    }
    return "unknownEventId";
  }
  /** Parses a QuakeML origin xml element into a Origin object.
   * @param qml the origin xml Element
   * @param allPicks picks already extracted from the xml for linking arrivals with picks
  */
  convertToOrigin(qml: Element, allPicks: Array<Pick>): Origin {
    let out = new Origin();
    let otimeStr = _grabFirstElText(_grabFirstEl(qml, 'time'),'value');
    if (otimeStr ) {
      out.time = otimeStr;
    } else {
      console.log("origintime is missing...");
    }
    const lat = _grabFirstElFloat(_grabFirstEl(qml, 'latitude'), 'value');
    if (isNumArg(lat)) {out.latitude = lat;}
    const lon = _grabFirstElFloat(_grabFirstEl(qml, 'longitude'), 'value');
    if (isNumArg(lon)) {out.longitude = lon;}
    const depth = _grabFirstElFloat(_grabFirstEl(qml, 'depth'), 'value');
    if (isNumArg(depth)) {out.depth = depth;}
    const pid = _grabAttribute(qml, 'publicID');
    if (pid){out.publicId = pid;}

    let allArrivalEls = qml.getElementsByTagNameNS(BED_NS, 'arrival');
    let allArrivals = [];
    for ( let arrivalEl of allArrivalEls) {
      allArrivals.push(this.convertToArrival(arrivalEl, allPicks));
    }
    out.arrivalList = allArrivals;
    return out;
  }
  /** Parses a QuakeML magnitude xml element into a Magnitude object.
   * @param qml the magnitude xml Element
  */
  convertToMagnitude(qml: Element): Magnitude {
    let mag = _grabFirstElFloat(_grabFirstElNS(qml, BED_NS, 'mag'), 'value');
    let type = _grabFirstElText(qml, 'type');
    if (mag && type) {
      let out = new Magnitude(mag, type);
      const pid = _grabAttribute(qml, 'publicID');
      if (pid){out.publicId = pid;}
      return out;
    }
    throw new Error("Did not find mag and type in Element: ${mag} ${type}");
  }
  /** Parses a QuakeML arrival xml element into a Arrival object.
   * @param arrivalQML the arrival xml Element
   * @param allPicks picks already extracted from the xml for linking arrivals with picks
  */
  convertToArrival(arrivalQML: Element, allPicks: Array<Pick>): Arrival {
    let pickId = _grabFirstElText(arrivalQML, 'pickID');
    let phase = _grabFirstElText(arrivalQML, 'phase');
    if (phase && pickId) {
      let myPick = allPicks.find(function(p: Pick) { return p.publicId === pickId;});
      if ( ! myPick) {
        throw new Error("Can't find pick with Id="+pickId+" for Arrival");
      }
      let out = new Arrival(phase, myPick);
      const pid = _grabAttribute(arrivalQML, 'publicID');
      if (pid){out.publicId = pid;}
      return out;
    } else {
      throw new Error("Arrival does not have phase or pickId: "+stringify(phase)+" "+stringify(pickId));
    }
  }
  /** Parses a QuakeML pick xml element into a Pick object.
   * @param pickQML the pick xml Element
  */
  convertToPick(pickQML: Element): Pick {
    let otimeStr = _grabFirstElText(_grabFirstEl(pickQML, 'time'),'value');
    let time = checkStringOrDate(otimeStr);
    let waveformIdEl = _grabFirstEl(pickQML, 'waveformID');
    let netCode = _grabAttribute(waveformIdEl, "networkCode");
    let stationCode = _grabAttribute(waveformIdEl, "stationCode");
    let locationCode = _grabAttribute(waveformIdEl, "locationCode");
    let channelCode = _grabAttribute(waveformIdEl, "channelCode");
    // handle empty loc code, it can be missing
    if ( ! locationCode) { locationCode = '';}
    if (! netCode || ! stationCode || ! channelCode) {
      throw new Error("missing codes: "+stringify(netCode)
                      +"."+ stringify(stationCode)
                      +"."+ stringify(locationCode)
                      +"."+ stringify(channelCode));
    }
    let out = new Pick(time, netCode, stationCode, locationCode, channelCode);
    const pid = _grabAttribute(pickQML, 'publicID');
    if (pid){out.publicId = pid;}
    return out;
  }

  /** Queries the remote service and parses the returned xml.
   *  @return Promise to an Array of Quake objects.
  */
  query(): Promise<Array<Quake>> {
    let mythis = this;
    return this.queryRawXml().then(function(rawXml) {
        return mythis.parseQuakeML(rawXml);
    });
  }

  /** Parses a QuakeML xml document into seisplotjs objects
  *  @param rawXml the xml Document to parse
  *  @return array of Quake objects
  */
  parseQuakeML(rawXml: Document): Array<Quake> {
    let top = rawXml.documentElement;
    if (! top) {
      throw new Error("Can't get documentElement");
    }
    let eventArray = top.getElementsByTagName("event");
    let out = [];
    for (let eventEl of eventArray) {
      out.push(this.convertToQuake(eventEl));
    }
    return out;
  }

  /** Queries the remote server, to get QuakeML xml.
  * @return xml Document
  */
  queryRawXml(): Promise<Document> {
    let mythis = this;
    let promise = new RSVP.Promise(function(resolve, reject) {
      let client = new XMLHttpRequest();
      let url = mythis.formURL();
      client.open("GET", url);
      client.ontimeout = function() {
        this.statusText = "Timeout "+this.statusText;
        reject(this);
      };
      client.onreadystatechange = handler;
      client.responseType = "text";
      client.setRequestHeader("Accept", "application/xml");
      client.send();

      function handler() {
        if (this.readyState === this.DONE) {
          if (this.status === 200) {
            let out = new DOMParser().parseFromString(this.response, "text/xml");
            if (! out) {reject("out of DOMParser not defined");}
            resolve(out);
//            resolve(this.responseXML);
          } else if (this.status === 204 || (mythis.nodata() && this.status === mythis.nodata())) {

            // 204 is nodata, so successful but empty
            if (DOMParser) {
              resolve(new DOMParser().parseFromString(FAKE_EMPTY_XML, "text/xml"));
            } else {
              throw new Error("Got 204 but can't find DOMParser to generate empty xml");
            }
          } else {
            console.log("Reject: "+stringify(mythis.host())+" "+this.status);reject(this);
          }
        }
      }
    });
    return promise;
  }

  /** Forms the basic URL to contact the web service, without any query paramters
   * @return the url
  */
  formBaseURL(): string {
      let colon = ":";
      if (! this.host || this._host === USGS_HOST) {
        this._host = USGS_HOST;
        // usgs does 301 moved permanently to https
        this._protocol = 'https:';
      }
      if (this._protocol.endsWith(colon)) {
        colon = "";
      }
      return this._protocol+colon+"//"+this._host+(this._port===80?"":(":"+this._port))+"/fdsnws/event/"+this._specVersion;
  }

  /** Forms the URL to get catalogs from the web service, without any query paramters
   * @return the url
  */
  formCatalogsURL(): string {
    return this.formBaseURL()+"/catalogs";
  }
  /** Queries the remote web service to get known catalogs
   * @return Promise to Array of catalog names
  */
  queryCatalogs(): Promise<Array<string>> {
    let mythis = this;
    let promise = new RSVP.Promise(function(resolve, reject) {
      let url = mythis.formCatalogsURL();
      let client = new XMLHttpRequest();
      client.open("GET", url);
      client.onreadystatechange = handler;
      client.responseType = "document";
      client.setRequestHeader("Accept", "application/xml");
      client.send();

      function handler() {
        if (this.readyState === this.DONE) {
          if (this.status === 200) {
            resolve(this.response);
          } else {
            reject(this);
          }
        }
      }
    });
    return promise.then(function(rawXml) {
        let top = rawXml.documentElement;
        let catalogArray = top.getElementsByTagName("Catalog");
        let out = [];
        for (let i=0; i<catalogArray.length; i++) {
          out[i] = catalogArray.item(i).textContent;
        }
        return out;
    });
  }

  /** Forms the URL to get contributors from the web service, without any query paramters
   * @return the url
  */
  formContributorsURL(): string {
    return this.formBaseURL()+"/contributors";
  }
  /** Queries the remote web service to get known contributors
   * @return Promise to Array of contributor names
  */
  queryContributors(): Promise<Array<string>> {
    let mythis = this;
    let promise = new RSVP.Promise(function(resolve, reject) {
      let url = mythis.formContributorsURL();
      let client = new XMLHttpRequest();
      client.open("GET", url);
      client.onreadystatechange = handler;
      client.responseType = "document";
      client.setRequestHeader("Accept", "application/xml");
      client.send();

      function handler() {
        if (this.readyState === this.DONE) {
          if (this.status === 200) { resolve(this.response); }
          else {
            console.log("Reject contributors: "+stringify(mythis.host())+" "+this.status);reject(this); }
        }
      }
    });
    return promise.then(function(rawXml) {
        let top = rawXml.documentElement;
        let contribArray = top.getElementsByTagName("Contributor");
        let out = [];
        for (let i=0; i<contribArray.length; i++) {
          out[i] = contribArray.item(i).textContent;
        }
        return out;
    });
  }

  /** Forms the URL to get version from the web service, without any query paramters
   * @return the url
  */
  formVersionURL(): string {
    return this.formBaseURL()+"/version";
  }

  /** Queries the remote web service to get its version
   * @return Promise to version string
  */
  queryVersion(): Promise<string>{
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
          if (this.status === 200) { resolve(this.response); }
          else {
            console.log("Reject version: "+stringify(mythis.host())+" "+this.status);reject(this); }
        }
      }
    });
    return promise;
  }

  /**
  * Create a name=value parameter to add to a URL, including trailing ampersand
  */
  makeParam(name: string, val: mixed): string {
    return name+"="+encodeURIComponent(stringify(val))+"&";
  }

  /** Form URL to query the remote web service, encoding the query parameters.
  */
  formURL(): string {
    let colon = ":";
    if (this._protocol.endsWith(colon)) {
      colon = "";
    }
    let url = this.formBaseURL()+"/query?";
    if (this._eventId) { url = url+this.makeParam("eventid", this.eventId());}
    if (this._startTime) { url = url+this.makeParam("starttime", toIsoWoZ(this.startTime()));}
    if (this._endTime) { url = url+this.makeParam("endtime", toIsoWoZ(this.endTime()));}
    if (isNumArg(this._minMag)) { url = url+this.makeParam("minmag", this.minMag());}
    if (isNumArg(this._maxMag)) { url = url+this.makeParam("maxmag", this.maxMag());}
    if (isStringArg(this._magnitudeType)) { url = url+this.makeParam("magnitudetype", this.magnitudeType());}
    if (isNumArg(this._minDepth)) { url = url+this.makeParam("mindepth", this.minDepth());}
    if (isNumArg(this._maxDepth)) { url = url+this.makeParam("maxdepth", this.maxDepth());}
    if (isNumArg(this._minLat)) { url = url+this.makeParam("minlat", this.minLat());}
    if (isNumArg(this._maxLat)) { url = url+this.makeParam("maxlat", this.maxLat());}
    if (isNumArg(this._minLon)) { url = url+this.makeParam("minlon", this.minLon());}
    if (isNumArg(this._maxLon)) { url = url+this.makeParam("maxlon", this.maxLon());}
    if (isNumArg(this._minRadius) || isNumArg(this._maxRadius)) {
      if (isNumArg(this._latitude) && isNumArg(this._longitude)) {
        url = url+this.makeParam("latitude", this.latitude())+this.makeParam("longitude", this.longitude());
        if (isNumArg(this._minRadius)) { url = url+this.makeParam("minradius", this.minRadius());}
        if (isNumArg(this._maxRadius)) { url = url+this.makeParam("maxradius", this.maxRadius());}
      } else {
        throw new Error("Cannot use minRadius or maxRadius without latitude and longitude: lat="+this._latitude+" lon="+this._longitude);
      }
    }
    if (this._includeArrivals) {
      if (this._host !== USGS_HOST) {
        url = url+"includearrivals=true&";
      } else {
        // USGS does not support includearrivals, but does actually
        // include the arrivals for an eventid= style query
        if (this._eventId) {
          // ok, works without the param
        } else {
          throw new Error("USGS host, earthquake.usgs.gov, does not support includearrivals parameter.");
        }
      }
    }
    if (isObject(this._updatedAfter)) { url = url+this.makeParam("updatedafter", this.updatedAfter());}
    if (isDef(this._includeAllOrigins)) { url = url+this.makeParam("includeallorigins", this.includeAllOrigins());}
    if (isDef(this._includeAllMagnitudes)) { url = url+this.makeParam("includeallmagnitudes", this.includeAllMagnitudes());}
    if (isStringArg(this._format)) { url = url+this.makeParam("format", this.format());}
    if (isNumArg(this._limit)) { url = url+this.makeParam("limit", this.limit());}
    if (isNumArg(this._offset)) { url = url+this.makeParam("offset", this.offset());}
    if (isStringArg(this._orderBy)) { url = url+this.makeParam("orderby", this.orderBy());}
    if (isStringArg(this._catalog)) { url = url+this.makeParam("catalog", this.catalog());}
    if (isStringArg(this._contributor)) { url = url+this.makeParam("contributor", this.contributor());}

    if (isDef(this._nodata)) { url = url+this.makeParam("nodata", this.nodata());}
    if (url.endsWith('&') || url.endsWith('?')) {
      url = url.substr(0, url.length-1); // zap last & or ?
    }
    return url;
  }

}


// these are similar methods as in seisplotjs-fdsnstation
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

export const util = {
  "_grabFirstEl": _grabFirstEl,
  "_grabFirstElNS": _grabFirstElNS,
  "_grabFirstElText": _grabFirstElText,
  "_grabFirstElFloat": _grabFirstElFloat,
  "_grabFirstElInt": _grabFirstElInt,
  "_grabAttribute": _grabAttribute,
  "_grabAttributeNS": _grabAttributeNS
};
