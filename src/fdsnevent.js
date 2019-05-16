// @flow

import * as model from '../model';
import { moment } from '../model';
import checkProtocol from '../checkProtocol.js';

// special due to flow
import {hasArgs, hasNoArgs, isStringArg, isNumArg, checkStringOrDate, stringify} from '../model';


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
      // usgs does 301 moved permanently to https
      this._protocol = 'https:';
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
  protocol(value?: string) :string | EventQuery {
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
  host(value?: string) :string | EventQuery {
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
  port(value?: number): number | DataSelectQuery {
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
  eventId(value?: string) :string | EventQuery {
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
  startTime(value?: moment) :moment | EventQuery {
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
  endTime(value?: moment) :moment | EventQuery {
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
  updatedAfter(value?: moment) :moment | EventQuery {
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
    return _isDef(this._eventId) ||
      _isDef(this._startTime) ||
      _isDef(this._endTime) ||
      _isDef(this._minLat) ||
      _isDef(this._maxLat) ||
      _isDef(this._minLon) ||
      _isDef(this._maxLon) ||
      _isDef(this._latitude) ||
      _isDef(this._longitude) ||
      _isDef(this._minRadius) ||
      _isDef(this._maxRadius) ||
      _isDef(this.minDepth) ||
      _isDef(this.maxDepth) ||
      _isDef(this.limit) ||
      _isDef(this.minMag) ||
      _isDef(this.maxMag) ||
      _isDef(this.updatedAfter) ||
      _isDef(this.catalog) ||
      _isDef(this.contributor);
  }

  /** Parses a QuakeML event xml element into a Quake object.
   * @param qml the event xml Element
  */
  convertToQuake(qml: Element) :model.Quake {
    let out = new model.Quake();
    out.publicId = _grabAttribute(qml, 'publicID');
    out.description = _grabFirstElText(_grabFirstEl(qml, 'description'), 'text');
    let otimeStr = _grabFirstElText(_grabFirstEl(_grabFirstEl(qml, 'origin'), 'time'),'value');
    if (otimeStr ) {
      out.time = otimeStr;
    } else {
      console.log("origintime is missing..."+out.description);
    }
    out.latitude = _grabFirstElFloat(_grabFirstEl(_grabFirstEl(qml, 'origin'), 'latitude'), 'value');
    out.longitude = _grabFirstElFloat(_grabFirstEl(_grabFirstEl(qml, 'origin'), 'longitude'), 'value');
    out.depth = _grabFirstElFloat(_grabFirstEl(_grabFirstEl(qml, 'origin'), 'depth'), 'value');

    //need picks before can do origins
    let allPickEls = qml.getElementsByTagNameNS(BED_NS, 'pick');
    let allPicks = [];
    for (let pNum=0; pNum < allPickEls.length; pNum++) {
      allPicks.push(this.convertToPick(allPickEls.item(pNum)));
    }
    console.log(`convert ${allPicks.length} picks for quake`);

    let allOriginEls = qml.getElementsByTagNameNS(BED_NS, "origin");
    let allOrigins = [];
    for (let oNum=0; oNum < allOriginEls.length; oNum++) {
      allOrigins.push(this.convertToOrigin(allOriginEls.item(oNum), allPicks));
    }
    let allMagEls = qml.getElementsByTagNameNS(BED_NS, "magnitude");
    let allMags = [];
    for (let mNum=0; mNum < allMagEls.length; mNum++) {
      allMags.push(this.convertToMagnitude(allMagEls.item(mNum)));
    }
    out.originList = allOrigins;
    out.magnitudeList = allMags;
    out.pickList = allPicks;
    out.eventId = this.extractEventId(qml);
    out.preferredOriginId = _grabFirstElText(qml, 'preferredOriginID');
    out.preferredMagnitudeId = _grabFirstElText(qml, 'preferredMagnitudeID');
    for (let o of allOrigins) {
      if (o.publicId === out.preferredOriginId) {
        out.preferredOrigin = o;
      } else {
        console.log(`no match: ${o.publicId} ${out.preferredOriginId}`)
      }
    }
    if (allMags.length > 0) {out.magnitude = allMags[0];}
    for (let m of allMags) {
      if (m.publicId === out.preferredMagnitudeId) {
        out.preferredMagnitude = m;
        out.magnitude = m;
      } else {
        console.log(`no match: ${m.publicId} ${out.preferredMagnitudeId}`)
      }
    }
    return out;
  }
  extractEventId(qml: Element) :string {
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
    let publicid = _grabAttribute(qml, 'publicId');
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
  convertToOrigin(qml: Element, allPicks) :model.Origin {
    let out = new model.Origin();
    let otimeStr = _grabFirstElText(_grabFirstEl(qml, 'time'),'value');
    if (otimeStr ) {
      out.time = otimeStr;
    } else {
      console.log("origintime is missing...");
    }
    out.latitude = _grabFirstElFloat(_grabFirstEl(qml, 'latitude'), 'value');
    out.longitude = _grabFirstElFloat(_grabFirstEl(qml, 'longitude'), 'value');
    out.depth = _grabFirstElFloat(_grabFirstEl(qml, 'depth'), 'value');
    out.publicId = _grabAttribute(qml, 'publicID');

    let allArrivalEls = qml.getElementsByTagNameNS(BED_NS, 'arrival');
    console.log(`found ${allArrivalEls.length} arrival in origin`);
    let allArrivals = [];
    for ( let aNum=0; aNum < allArrivalEls.length; aNum++) {
      allArrivals.push(this.convertToArrival(allArrivalEls.item(aNum), allPicks));
    }
    out.arrivalList = allArrivals;
    return out;
  }
  /** Parses a QuakeML magnitude xml element into a Magnitude object.
   * @param qml the magnitude xml Element
  */
  convertToMagnitude(qml: Element) :model.Magnitude {
    let mag = _grabFirstElFloat(_grabFirstElNS(qml, BED_NS, 'mag'), 'value');
    let type = _grabFirstElText(qml, 'type');
    if (mag && type) {
      let out = new model.Magnitude(mag, type);
      out.publicId = _grabAttribute(qml, 'publicID');
      console.log(`convertToMagnitude ${out.publicId}`);
      return out;
    }
    throw new Error("Did not find mag and type in Element: ${mag} ${type}");
  }
  /** Parses a QuakeML arrival xml element into a Arrival object.
   * @param arrivalQML the arrival xml Element
   * @param allPicks picks already extracted from the xml for linking arrivals with picks
  */
  convertToArrival(arrivalQML: Element, allPicks: Array<model.Pick>) :model.Arrival {
    let pickId = _grabFirstElText(arrivalQML, 'pickID');
    let phase = _grabFirstElText(arrivalQML, 'phase');
    if (phase && pickId) {
      let myPick = allPicks.find(function(p: model.Pick) { return p.publicId === pickId;});
      if ( ! myPick) {
        throw new Error("Can't find pick with Id="+pickId+" for Arrival");
      }
      let out = new model.Arrival(phase, myPick);
      out.publicId = _grabAttribute(arrivalQML, 'publicID');
      return out;
    } else {
      throw new Error("Arrival does not have phase or pickId: "+stringify(phase)+" "+stringify(pickId));
    }
  }
  /** Parses a QuakeML pick xml element into a Pick object.
   * @param pickQML the pick xml Element
  */
  convertToPick(pickQML: Element) :model.Pick {
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
    let out = new model.Pick(time, netCode, stationCode, locationCode, channelCode);
    out.publicId = _grabAttribute(pickQML, "publicID");
    return out;
  }

  /** Queries the remote service and parses the returned xml.
   *  @return Promise to an Array of Quake objects.
  */
  query(): Promise<Array<model.Quake>> {
    let mythis = this;
    return this.queryRawXml().then(function(rawXml) {
        return mythis.parseQuakeML(rawXml);
    });
  }

  /** Parses a QuakeML xml document into seisplotjs objects
  *  @param rawXml the xml Document to parse
  *  @return array of Quake objects
  */
  parseQuakeML(rawXml: Document) :Array<model.Quake> {
    let top = rawXml.documentElement;
    if (! top) {
      throw new Error("Can't get documentElement");
    }
    let eventArray = top.getElementsByTagName("event");
    let out = [];
    for (let i=0; i<eventArray.length; i++) {
      out[i] = this.convertToQuake(eventArray.item(i));
    }
    return out;
  }

  /** Queries the remote server, to get QuakeML xml.
  * @return xml Document
  */
  queryRawXml() :Promise<Document> {
    let mythis = this;
    let promise = new RSVP.Promise(function(resolve, reject) {
      let client = new XMLHttpRequest();
      let url = mythis.formURL();
      client.open("GET", url);
      client.ontimeout = function(e) {
        this.statusText = "Timeout "+this.statusText;
        reject(this);
      };
      client.onreadystatechange = handler;
      client.responseType = "text";
      client.setRequestHeader("Accept", "application/xml");
      client.send();

      function handler() {
        if (this.readyState === this.DONE) {
          console.log("handle: "+stringify(mythis.host())+" "+this.status);
          if (this.status === 200) {
            let out = new DOMParser().parseFromString(this.response, "text/xml");
            if (! out) {reject("out of DOMParser not defined");}
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
  formBaseURL() :string {
      let colon = ":";
      if (this._protocol.endsWith(colon)) {
        colon = "";
      }
      return this._protocol+colon+"//"+this._host+(this._port==80?"":(":"+this._port))+"/fdsnws/event/"+this._specVersion;
  }

  /** Forms the URL to get catalogs from the web service, without any query paramters
   * @return the url
  */
  formCatalogsURL() :string {
    return this.formBaseURL()+"/catalogs";
  }
  /** Queries the remote web service to get known catalogs
   * @return Promise to Array of catalog names
  */
  queryCatalogs() :Promise<Array<string>> {
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
          console.log("handle catalogs: "+stringify(mythis.host())+" "+this.status);
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
  formContributorsURL() :string {
    return this.formBaseURL()+"/contributors";
  }
  /** Queries the remote web service to get known contributors
   * @return Promise to Array of contributor names
  */
  queryContributors() :Promise<Array<string>> {
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
          console.log("handle contributors: "+stringify(mythis.host())+" "+this.status);
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
  formVersionURL() :string {
    return this.formBaseURL()+"/version";
  }

  /** Queries the remote web service to get its version
   * @return Promise to version string
  */
  queryVersion() :Promise<string>{
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
  makeParam(name: string, val: mixed) :string {
    return name+"="+encodeURIComponent(stringify(val))+"&";
  }

  /** Form URL to query the remote web service, encoding the query parameters.
  */
  formURL() :string {
    let colon = ":";
    if (this._protocol.endsWith(colon)) {
      colon = "";
    }
    let url = this.formBaseURL()+"/query?";
    if (this._eventId) { url = url+this.makeParam("eventid", this.eventId());}
    if (this._startTime) { url = url+this.makeParam("starttime", model.toIsoWoZ(this.startTime()));}
    if (this._endTime) { url = url+this.makeParam("endtime", model.toIsoWoZ(this.endTime()));}
    if (_isDef(this._minMag)) { url = url+this.makeParam("minmag", this.minMag());}
    if (_isDef(this._maxMag)) { url = url+this.makeParam("maxmag", this.maxMag());}
    if (_isDef(this._magnitudeType)) { url = url+this.makeParam("magnitudetype", this.magnitudeType());}
    if (_isDef(this._minDepth)) { url = url+this.makeParam("mindepth", this.minDepth());}
    if (_isDef(this._maxDepth)) { url = url+this.makeParam("maxdepth", this.maxDepth());}
    if (_isDef(this._minLat)) { url = url+this.makeParam("minlat", this.minLat());}
    if (_isDef(this._maxLat)) { url = url+this.makeParam("maxlat", this.maxLat());}
    if (_isDef(this._minLon)) { url = url+this.makeParam("minlon", this.minLon());}
    if (_isDef(this._maxLon)) { url = url+this.makeParam("maxlon", this.maxLon());}
    if (_isDef(this._minRadius) || _isDef(this._maxRadius)) {
      if (_isDef(this._latitude) && _isDef(this._longitude)) {
        url = url+this.makeParam("latitude", this.latitude())+this.makeParam("longitude", this.longitude());
        if (_isDef(this._minRadius)) { url = url+this.makeParam("minradius", this.minRadius());}
        if (_isDef(this._maxRadius)) { url = url+this.makeParam("maxradius", this.maxRadius());}
      } else {
        console.log("Cannot use minRadius or maxRadius without latitude and longitude: lat="+this._latitude+" lon="+this._longitude);
        throw new Error("Cannot use minRadius or maxRadius without latitude and longitude: lat="+this._latitude+" lon="+this._longitude);
      }
    }
    if (this._includeArrivals) {
      if (this._host != USGS_HOST) {
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
    if (_isDef(this._updatedAfter)) { url = url+this.makeParam("updatedafter", this.updatedAfter());}
    if (_isDef(this._includeAllOrigins)) { url = url+this.makeParam("includeallorigins", this.includeAllOrigins());}
    if (_isDef(this._includeAllMagnitudes)) { url = url+this.makeParam("includeallmagnitudes", this.includeAllMagnitudes());}
    if (_isDef(this._format)) { url = url+this.makeParam("format", this.format());}
    if (_isDef(this._limit)) { url = url+this.makeParam("limit", this.limit());}
    if (_isDef(this._offset)) { url = url+this.makeParam("offset", this.offset());}
    if (_isDef(this._orderBy)) { url = url+this.makeParam("orderby", this.orderBy());}
    if (_isDef(this._catalog)) { url = url+this.makeParam("catalog", this.catalog());}
    if (_isDef(this._contributor)) { url = url+this.makeParam("contributor", this.contributor());}

    if (_isDef(this._nodata)) { url = url+this.makeParam("nodata", this.nodata());}
    if (url.endsWith('&') || url.endsWith('?')) {
      url = url.substr(0, url.length-1); // zap last & or ?
    }
    return url;
  }

}


// these are similar methods as in seisplotjs-fdsnstation
// duplicate here to avoid dependency and diff NS, yes that is dumb...


const _isDef = function(v: mixed) :boolean %checks {
  return typeof v !== 'undefined' && v !== null;
}


const _grabFirstElNS = function(xml: Element | null | void, namespace: string, tagName: string) :Element | void {
  let out = undefined;
  if ( _isDef(xml)) {
    let elList = xml.getElementsByTagNameNS(namespace, tagName);
    if (_isDef(elList) && elList.length > 0) {
      out = elList.item(0);
    }
  }
  return out;
}

const _grabFirstEl = function(xml: Element | null | void, tagName: string) :Element | void {
  let out = undefined;
  if ( _isDef(xml)) {
    let elList = xml.getElementsByTagName(tagName);
    if (_isDef(elList) && elList.length > 0) {
      out = elList.item(0);
    }
  }
  return out;
}

const _grabFirstElText = function(xml: Element | null | void, tagName: string) :string | void {
  let out = undefined;
  let el = _grabFirstEl(xml, tagName);
  if (_isDef(el)) {
    out = el.textContent;
  }
  return out;
}

const _grabFirstElFloat = function(xml: Element | null | void, tagName: string) :number | void {
  let out = undefined;
  let el = _grabFirstElText(xml, tagName);
  if (_isDef(el)) {
    out = parseFloat(el);
  }
  return out;
}

const _grabAttribute = function(xml: Element | null | void, tagName: string) :string | void {
  let out = undefined;
  if ( _isDef(xml)) {
    let a = xml.getAttribute(tagName);
    if (_isDef(a)) {
      out = a;
    }
  }
  return out;
}

const _grabAttributeNS = function(xml: Element | null | void, namespace: string, tagName: string) :string | void {
  let out = undefined;
  if ( _isDef(xml)) {
    let a = xml.getAttributeNS(namespace, tagName);
    if (_isDef(a)) {
      out = a;
    }
  }
  return out;
}
