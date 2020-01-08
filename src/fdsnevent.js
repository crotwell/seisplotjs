// @flow

/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */

import { moment } from 'moment';
import { Quake, USGS_HOST, parseQuakeML } from './quakeml';
import {XML_MIME, TEXT_MIME, StartEndDuration, makeParam, doFetchWithTimeout, defaultFetchInitObj} from './util.js';

// special due to flow
import {checkProtocol, toIsoWoZ, hasArgs, hasNoArgs, isDef, isObject,
        isStringArg, isNonEmptyStringArg, isNumArg, checkStringOrDate} from './util';

/**
 * Major version of the FDSN spec supported here.
 * Currently is 1.
 */
export const SERVICE_VERSION = 1;
/**
 * Service name as used in the FDSN DataCenters registry,
 * http://www.fdsn.org/datacenters
 */
export const SERVICE_NAME = `fdsnws-event-${SERVICE_VERSION}`;

export { USGS_HOST };

export const FAKE_EMPTY_XML = '<?xml version="1.0"?><q:quakeml xmlns="http://quakeml.org/xmlns/bed/1.2" xmlns:q="http://quakeml.org/xmlns/quakeml/1.2"><eventParameters publicID="quakeml:fake/empty"></eventParameters></q:quakeml>';

/**
 * Query to a FDSN Event web service.
 *
 * @see http://www.fdsn.org/webservices/
 *
 * @param host optional host to connect to, defaults to USGS
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
  /** @private */
  _timeoutSec: number;
  constructor(host?: string) {
    this._specVersion = 1;
    this._protocol = checkProtocol();
    this.host(host);
    if (! isNonEmptyStringArg(host)) {
      this._host = USGS_HOST;
    }
    this._port = 80;
    this._timeoutSec = 30;
  }
  /**
   * Gets/Sets the version of the fdsnws spec, 1 is currently the only value.
   *  Setting this is probably a bad idea as the code may not be compatible with
   *  the web service.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
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
  /**
   * Gets/Sets the protocol, http or https. This should match the protocol
   *  of the page loaded, but is autocalculated and generally need not be set.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
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
  /**
   * Gets/Sets the remote host to connect to.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
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
  /**
   * Gets/Sets the remote port to connect to.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  port(value?: number): number | EventQuery {
    if (hasNoArgs(value)) {
      return this._port;
    } else if (isNumArg(value)) {
      this._port = value;
      return this;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  /**
   * Gets/Sets the nodata parameter, usually 404 or 204 (default), controlling
   * the status code when no matching data is found by the service.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
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
  /**
   * Get/Set the eventid query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
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
  /**
   * Get/Set the starttime query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
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
  /**
   * Get/Set the endtime query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
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
  /**
   * Sets startTime and endTime using the given time window
   *
   * @param   se time window
   * @returns     this
   */
  timeWindow(se: StartEndDuration) {
    this.startTime(se.startTime);
    this.endTime(se.endTime);
    return this;
  }
  /**
   * Get/Set the updatedafter query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
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
  /**
   * Get/Set the minmag query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
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
  /**
   * Get/Set the maxmag query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
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
  /**
   * Get/Set the magnitudetype query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
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
  /**
   * Get/Set the mindepth query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
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
  /**
   * Get/Set the maxdepth query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
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
  /**
   * Get/Set the minlat query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
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
  /**
   * Get/Set the maxlat query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
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
  /**
   * Get/Set the minlon query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
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
  /**
   * Get/Set the maxlon query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
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
  /**
   * Get/Set the latitude query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
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
  /**
   * Get/Set the longitude query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
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
  /**
   * Get/Set the minradius query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
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
  /**
   * Get/Set the maxradius query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
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
  /**
   * Get/Set the includearrivals query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
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
  /**
   * Get/Set the includeallorigins query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
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
  /**
   * Get/Set the includeallmagnitudes query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
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
  /**
   * Get/Set the format query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
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
  /**
   * Get/Set the limit query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
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
  /**
   * Get/Set the offset query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
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
  /**
   * Get/Set the orderby query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
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
  /**
   * Get/Set the catalog query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
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
  /**
   * Get/Set the contributor query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
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
  /**
   * Get/Set the timeout in seconds for the request. Default is 30.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  timeout(value?: number): number | EventQuery {
    if (hasNoArgs(value)) {
      return this._timeoutSec;
    } else if (isNumArg(value)) {
      this._timeoutSec = value;
      return this;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  /**
   * Checks to see if any parameter that would limit the data
   * returned is set. This is a crude, coarse check to make sure
   * the client doesn't ask for EVERYTHING the server has.
   *
   * @returns true is some parameter is set
   */
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
  /**
   * Queries the remote service and parses the returned xml.
   *
   *  @returns Promise to an Array of Quake objects.
   */
  query(): Promise<Array<Quake>> {
    return this.queryRawXml().then(rawXml => {
        return parseQuakeML(rawXml, this._host);
    });
  }
  /**
   * Queries the remote server, to get QuakeML xml.
   *
   * @returns xml Document
   */
  queryRawXml(): Promise<Document> {
    let mythis = this;
    const url = this.formURL();
    const fetchInit = defaultFetchInitObj(XML_MIME);
    return doFetchWithTimeout(url, fetchInit, this._timeoutSec * 1000 )
    .then(response => {
        if (response.status === 200) {
          return response.text();
        } else if (response.status === 204 || (mythis.nodata() && response.status === mythis.nodata())) {
          // 204 is nodata, so successful but empty
          return FAKE_EMPTY_XML;
        } else {
          throw new Error(`Status not successful: ${response.status}`);
        }
    }).then(function(rawXmlText) {
      return new DOMParser().parseFromString(rawXmlText, XML_MIME);
    });
  }
  /**
   * Forms the basic URL to contact the web service, without any query paramters
   *
   * @returns the url
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
  /**
   * Forms the URL to get catalogs from the web service, without any query paramters
   *
   * @returns the url
   */
  formCatalogsURL(): string {
    return this.formBaseURL()+"/catalogs";
  }
  /**
   * Queries the remote web service to get known catalogs
   *
   * @returns Promise to Array of catalog names
   */
  queryCatalogs(): Promise<Array<string>> {
    let mythis = this;
    let url = mythis.formCatalogsURL();
    const fetchInit = defaultFetchInitObj(XML_MIME);
    return doFetchWithTimeout(url, fetchInit, this._timeoutSec * 1000 )
      .then(response => {
          if (response.status === 200) {
            return response.text();
          } else {
            throw new Error(`Status not 200: ${response.status}`);
          }
      }).then(function(rawXmlText) {
        return new DOMParser().parseFromString(rawXmlText, XML_MIME);
      }).then(function(rawXml) {
          // for flow
          if ( ! rawXml) { throw new Error("raw xml from DOMParser is null.");}
          let top = rawXml.documentElement;
          // for flow
          if ( ! top) { throw new Error("documentElement in xml from DOMParser is null.");}
          let catalogArray = top.getElementsByTagName("Catalog");
          let out = [];
          if (catalogArray){
            for (let i=0; i<catalogArray.length; i++) {
              // for flow
              let item = catalogArray.item(i);
              if (item) {
                out.push(item.textContent);
              }
            }
          }
          return out;
      });
  }
  /**
   * Forms the URL to get contributors from the web service, without any query paramters
   *
   * @returns the url
   */
  formContributorsURL(): string {
    return this.formBaseURL()+"/contributors";
  }
  /**
   * Queries the remote web service to get known contributors
   *
   * @returns Promise to Array of contributor names
   */
  queryContributors(): Promise<Array<string>> {
    let url = this.formContributorsURL();
    const fetchInit = defaultFetchInitObj(XML_MIME);
    return doFetchWithTimeout(url, fetchInit, this._timeoutSec * 1000 )
      .then(response => {
          if (response.status === 200) {
            return response.text();
          } else {
            throw new Error(`Status not 200: ${response.status}`);
          }
      }).then(function(rawXmlText) {
        return new DOMParser().parseFromString(rawXmlText, XML_MIME);
      }).then(function(rawXml) {
          let top = rawXml.documentElement;
          // for flow
          if ( ! top) { throw new Error("documentElement in xml from DOMParser is null.");}
          let contributorArray = top.getElementsByTagName("Contributor");
          let out = [];
          if (contributorArray){
            for (let i=0; i<contributorArray.length; i++) {
              // for flow
              let item = contributorArray.item(i);
              if (item) {
                out.push(item.textContent);
              }
            }
          }
          return out;
      });
  }
  /**
   * Forms the URL to get version from the web service, without any query paramters
   *
   * @returns the url
   */
  formVersionURL(): string {
    return this.formBaseURL()+"/version";
  }
  /**
   * Queries the remote web service to get its version
   *
   * @returns Promise to version string
   */
  queryVersion(): Promise<string> {
    let url = this.formVersionURL();
    const fetchInit = defaultFetchInitObj(TEXT_MIME);
    return doFetchWithTimeout(url, fetchInit, this._timeoutSec * 1000 )
      .then(response => {
          if (response.status === 200) {
            return response.text();
          } else {
            throw new Error(`Status not 200: ${response.status}`);
          }
      });
  }
  /**
   * Form URL to query the remote web service, encoding the query parameters.
   *
   * @returns url
   */
  formURL(): string {
    let colon = ":";
    if (this._protocol.endsWith(colon)) {
      colon = "";
    }
    let url = this.formBaseURL()+"/query?";
    if (this._eventId) { url = url+makeParam("eventid", this.eventId());}
    if (this._startTime) { url = url+makeParam("starttime", toIsoWoZ(this.startTime()));}
    if (this._endTime) { url = url+makeParam("endtime", toIsoWoZ(this.endTime()));}
    if (isNumArg(this._minMag)) { url = url+makeParam("minmag", this.minMag());}
    if (isNumArg(this._maxMag)) { url = url+makeParam("maxmag", this.maxMag());}
    if (isStringArg(this._magnitudeType)) { url = url+makeParam("magnitudetype", this.magnitudeType());}
    if (isNumArg(this._minDepth)) { url = url+makeParam("mindepth", this.minDepth());}
    if (isNumArg(this._maxDepth)) { url = url+makeParam("maxdepth", this.maxDepth());}
    if (isNumArg(this._minLat)) { url = url+makeParam("minlat", this.minLat());}
    if (isNumArg(this._maxLat)) { url = url+makeParam("maxlat", this.maxLat());}
    if (isNumArg(this._minLon)) { url = url+makeParam("minlon", this.minLon());}
    if (isNumArg(this._maxLon)) { url = url+makeParam("maxlon", this.maxLon());}
    if (isNumArg(this._minRadius) || isNumArg(this._maxRadius)) {
      if (isNumArg(this._latitude) && isNumArg(this._longitude)) {
        url = url+makeParam("latitude", this.latitude())+makeParam("longitude", this.longitude());
        if (isNumArg(this._minRadius)) { url = url+makeParam("minradius", this.minRadius());}
        if (isNumArg(this._maxRadius)) { url = url+makeParam("maxradius", this.maxRadius());}
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
    if (isObject(this._updatedAfter)) { url = url+makeParam("updatedafter", this.updatedAfter());}
    if (isDef(this._includeAllOrigins)) { url = url+makeParam("includeallorigins", this.includeAllOrigins());}
    if (isDef(this._includeAllMagnitudes)) { url = url+makeParam("includeallmagnitudes", this.includeAllMagnitudes());}
    if (isStringArg(this._format)) { url = url+makeParam("format", this.format());}
    if (isNumArg(this._limit)) { url = url+makeParam("limit", this.limit());}
    if (isNumArg(this._offset)) { url = url+makeParam("offset", this.offset());}
    if (isStringArg(this._orderBy)) { url = url+makeParam("orderby", this.orderBy());}
    if (isStringArg(this._catalog)) { url = url+makeParam("catalog", this.catalog());}
    if (isStringArg(this._contributor)) { url = url+makeParam("contributor", this.contributor());}

    if (isDef(this._nodata)) { url = url+makeParam("nodata", this.nodata());}
    if (url.endsWith('&') || url.endsWith('?')) {
      url = url.substr(0, url.length-1); // zap last & or ?
    }
    return url;
  }

}
