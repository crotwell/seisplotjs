/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */
import {FDSNCommon} from './fdsncommonalities';
import {DateTime, Duration, Interval} from 'luxon';
import {Quake, USGS_HOST, parseQuakeML} from "./quakeml";
import {
  XML_MIME,
  TEXT_MIME,
  makeParam,
  doFetchWithTimeout,
  defaultFetchInitObj,
  doStringGetterSetter,
  doBoolGetterSetter,
  doIntGetterSetter,
  doFloatGetterSetter,
  doMomentGetterSetter,
  toIsoWoZ,
  isDef,
  isObject,
  isStringArg,
  isNonEmptyStringArg,
  isNumArg,
} from "./util";

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
export {USGS_HOST};
export const FAKE_EMPTY_XML =
  '<?xml version="1.0"?><q:quakeml xmlns="http://quakeml.org/xmlns/bed/1.2" xmlns:q="http://quakeml.org/xmlns/quakeml/1.2"><eventParameters publicID="quakeml:fake/empty"></eventParameters></q:quakeml>';

/**
 * Query to a FDSN Event web service.
 *
 * @see http://www.fdsn.org/webservices/
 * @param host optional host to connect to, defaults to USGS
 */
export class EventQuery extends FDSNCommon {

  /** @private */
  _eventId: string|undefined;

  /** @private */
  _startTime: DateTime|undefined;

  /** @private */
  _endTime: DateTime|undefined;

  /** @private */
  _updatedAfter: DateTime|undefined;

  /** @private */
  _minMag: number|undefined;

  /** @private */
  _maxMag: number|undefined;

  /** @private */
  _magnitudeType: string|undefined;

  /** @private */
  _minDepth: number|undefined;

  /** @private */
  _maxDepth: number|undefined;

  /** @private */
  _minLat: number|undefined;

  /** @private */
  _maxLat: number|undefined;

  /** @private */
  _minLon: number|undefined;

  /** @private */
  _maxLon: number|undefined;

  /** @private */
  _latitude: number|undefined;

  /** @private */
  _longitude: number|undefined;

  /** @private */
  _minRadius: number|undefined;

  /** @private */
  _maxRadius: number|undefined;

  /** @private */
  _includeArrivals: boolean|undefined;

  /** @private */
  _includeAllOrigins: boolean|undefined;

  /** @private */
  _includeAllMagnitudes: boolean|undefined;

  /** @private */
  _limit: number|undefined;

  /** @private */
  _offset: number|undefined;

  /** @private */
  _orderBy: string|undefined;

  /** @private */
  _contributor: string|undefined;

  /** @private */
  _catalog: string|undefined;

  /** @private */
  _format: string|undefined;

  constructor(host?: string) {
    if ( ! isNonEmptyStringArg(host)) {
      host = USGS_HOST;
    }
    super(host);
  }

  /**
   * Gets/Sets the version of the fdsnws spec, 1 is currently the only value.
   *  Setting this is probably a bad idea as the code may not be compatible with
   *  the web service.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  specVersion(value?: string): EventQuery {
    doStringGetterSetter(this, "specVersion", value);
    return this;
  }

  getSpecVersion(): string {
    return this._specVersion;
  }

  /**
   * Gets/Sets the protocol, http or https. This should match the protocol
   *  of the page loaded, but is autocalculated and generally need not be set.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  protocol(value?: string): EventQuery {
    doStringGetterSetter(this, "protocol", value);
    return this;
  }

  getProtocol(): string | undefined {
    return this._protocol;
  }

  /**
   * Gets/Sets the remote host to connect to.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  host(value?: string): EventQuery {
    doStringGetterSetter(this, "host", value);
    return this;
  }

  getHost(): string {
    return this._host;
  }

  /**
   * Gets/Sets the remote port to connect to.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  port(value?: number): EventQuery {
    doIntGetterSetter(this, "port", value);
    return this;
  }

  getPort(): number | undefined {
    return this._port;
  }

  /**
   * Gets/Sets the nodata parameter, usually 404 or 204 (default), controlling
   * the status code when no matching data is found by the service.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  nodata(value?: number): EventQuery {
    doIntGetterSetter(this, "nodata", value);
    return this;
  }

  getNodata(): number | undefined {
    return this._nodata;
  }

  /**
   * Get/Set the timeout in seconds for the request. Default is 30.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  timeout(value?: number): EventQuery {
    doFloatGetterSetter(this, "timeoutSec", value);
    return this;
  }

  getTimeout(): number | undefined {
    return this._timeoutSec;
  }

  /**
   * Get/Set the eventid query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  eventId(value?: string): EventQuery {
    doStringGetterSetter(this, "eventId", value);
    return this;
  }

  getEventId(): string | undefined {
    return this._eventId;
  }

  /**
   * Get/Set the starttime query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  startTime(value?: DateTime): EventQuery {
    doMomentGetterSetter(this, "startTime", value);
    return this;
  }

  getStartTime(): DateTime | undefined {
    return this._startTime;
  }

  /**
   * Get/Set the endtime query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  endTime(value?: DateTime): EventQuery {
    doMomentGetterSetter(this, "endTime", value);
    return this;
  }

  getEndTime(): DateTime | undefined {
    return this._endTime;
  }

  /**
   * Sets startTime and endTime using the given time window
   *
   * @param   se time window
   * @returns     this
   */
  timeRange(se: Interval): EventQuery {
    this.startTime(se.start);
    this.endTime(se.end);
    return this;
  }

  /**
   *@deprecated
   * @param  se   time interval
   * @returns    this
   */
  timeWindow(se: Interval): EventQuery {
    return this.timeRange(se);
  }

  /**
   * Get/Set the updatedafter query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  updatedAfter(value?: DateTime): EventQuery {
    doMomentGetterSetter(this, "updatedAfter", value);
    return this;
  }

  getUpdatedAfter(): DateTime | undefined {
    return this._updatedAfter;
  }

  /**
   * Get/Set the minmag query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  minMag(value?: number): EventQuery {
    doFloatGetterSetter(this, "minMag", value);
    return this;
  }

  getMinMag(): number | undefined {
    return this._minMag;
  }

  /**
   * Get/Set the maxmag query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  maxMag(value?: number): EventQuery {
    doFloatGetterSetter(this, "maxMag", value);
    return this;
  }

  getMaxMag(): number | undefined {
    return this._maxMag;
  }

  /**
   * Get/Set the magnitudetype query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  magnitudeType(value?: string): EventQuery {
    doStringGetterSetter(this, "magnitudeType", value);
    return this;
  }

  getMagnitudeType(): string | undefined {
    return this._magnitudeType;
  }

  /**
   * Get/Set the mindepth query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  minDepth(value?: number): EventQuery {
    doFloatGetterSetter(this, "minDepth", value);
    return this;
  }

  getMinDepth(): number | undefined {
    return this._minDepth;
  }

  /**
   * Get/Set the maxdepth query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  maxDepth(value?: number): EventQuery {
    doFloatGetterSetter(this, "maxDepth", value);
    return this;
  }

  getMaxDepth(): number | undefined {
    return this._maxDepth;
  }

  /**
   * Get/Set the minlat query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  minLat(value?: number): EventQuery {
    doFloatGetterSetter(this, "minLat", value);
    return this;
  }

  getMinLat(): number | undefined {
    return this._minLat;
  }

  /**
   * Get/Set the maxlat query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  maxLat(value?: number): EventQuery {
    doFloatGetterSetter(this, "maxLat", value);
    return this;
  }

  getMaxLat(): number | undefined {
    return this._maxLat;
  }

  /**
   * Get/Set the minlon query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  minLon(value?: number): EventQuery {
    doFloatGetterSetter(this, "minLon", value);
    return this;
  }

  getMinLon(): number | undefined {
    return this._minLon;
  }

  /**
   * Get/Set the maxlon query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  maxLon(value?: number): EventQuery {
    doFloatGetterSetter(this, "maxLon", value);
    return this;
  }

  getMaxLon(): number | undefined {
    return this._maxLon;
  }

  /**
   * Get/Set the latitude query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  latitude(value?: number): EventQuery {
    doFloatGetterSetter(this, "latitude", value);
    return this;
  }

  getLatitude(): number | undefined {
    return this._latitude;
  }

  /**
   * Get/Set the longitude query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  longitude(value?: number): EventQuery {
    doFloatGetterSetter(this, "longitude", value);
    return this;
  }

  getLongitude(): number | undefined {
    return this._longitude;
  }

  /**
   * Get/Set the minradius query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  minRadius(value?: number): EventQuery {
    doFloatGetterSetter(this, "minRadius", value);
    return this;
  }

  getMinRadius(): number | undefined {
    return this._minRadius;
  }

  /**
   * Get/Set the maxradius query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  maxRadius(value?: number): EventQuery {
    doFloatGetterSetter(this, "maxRadius", value);
    return this;
  }

  getMaxRadius(): number | undefined {
    return this._maxRadius;
  }

  /**
   * Get/Set the includearrivals query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  includeArrivals(value?: boolean): EventQuery {
    doBoolGetterSetter(this, "includeArrivals", value);
    return this;
  }

  getIncludeArrivals(): boolean | undefined {
    return this._includeArrivals;
  }

  /**
   * Get/Set the includeallorigins query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  includeAllOrigins(value?: boolean): EventQuery {
    doBoolGetterSetter(this, "includeAllOrigins", value);
    return this;
  }

  getIncludeAllOrigins(): boolean | undefined {
    return this._includeAllOrigins;
  }

  /**
   * Get/Set the includeallmagnitudes query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  includeAllMagnitudes(value?: boolean): EventQuery {
    doBoolGetterSetter(this, "includeAllMagnitudes", value);
    return this;
  }

  getIncludeAllMagnitudes(): boolean | undefined {
    return this._includeAllMagnitudes;
  }

  /**
   * Get/Set the format query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  format(value?: string): EventQuery {
    doStringGetterSetter(this, "format", value);
    return this;
  }

  getFormat(): string | undefined {
    return this._format;
  }

  /**
   * Get/Set the limit query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  limit(value?: number): EventQuery {
    doIntGetterSetter(this, "limit", value);
    return this;
  }

  getLimit(): number | undefined {
    return this._limit;
  }

  /**
   * Get/Set the offset query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  offset(value?: number): EventQuery {
    doIntGetterSetter(this, "offset", value);
    return this;
  }

  getOffset(): number | undefined {
    return this._offset;
  }

  /**
   * Get/Set the orderby query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  orderBy(value?: string): EventQuery {
    doStringGetterSetter(this, "orderBy", value);
    return this;
  }

  getOrderBy(): string | undefined {
    return this._orderBy;
  }

  /**
   * Get/Set the catalog query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  catalog(value?: string): EventQuery {
    doStringGetterSetter(this, "catalog", value);
    return this;
  }

  getCatalog(): string | undefined {
    return this._catalog;
  }

  /**
   * Get/Set the contributor query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  contributor(value?: string): EventQuery {
    doStringGetterSetter(this, "contributor", value);
    return this;
  }

  getContributor(): string | undefined {
    return this._contributor;
  }


  /**
   * Checks to see if any parameter that would limit the data
   * returned is set. This is a crude, coarse check to make sure
   * the client doesn't ask for EVERYTHING the server has.
   *
   * @returns true is some parameter is set
   */
  isSomeParameterSet(): boolean {
    return (
      isDef(this._eventId) ||
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
      isDef(this._minDepth) ||
      isDef(this._maxDepth) ||
      isDef(this._limit) ||
      isDef(this._minMag) ||
      isDef(this._maxMag) ||
      isDef(this._updatedAfter) ||
      isDef(this._catalog) ||
      isDef(this._contributor)
    );
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
    const mythis = this;

    if (!this.isSomeParameterSet()) {
      throw new Error(
        "Must set some parameter to avoid asking for everything.",
      );
    }

    const url = this.formURL();
    const fetchInit = defaultFetchInitObj(XML_MIME);
    return doFetchWithTimeout(url, fetchInit, this._timeoutSec * 1000)
      .then(response => {
        if (response.status === 200) {
          return response.text();
        } else if (
          response.status === 204 ||
          (isDef(mythis._nodata) && response.status === mythis._nodata)
        ) {
          // 204 is nodata, so successful but empty
          return FAKE_EMPTY_XML;
        } else {
          throw new Error(`Status not successful: ${response.status}`);
        }
      })
      .then(function (rawXmlText) {
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

    if (!this._host || this._host === USGS_HOST) {
      this._host = USGS_HOST;
      // usgs does 301 moved permanently to https
      this._protocol = "https:";
    }

    if (this._protocol.endsWith(colon)) {
      colon = "";
    }

    return (
      this._protocol +
      colon +
      "//" +
      this._host +
      (this._port === 80 ? "" : ":" + this._port) +
      "/fdsnws/event/" +
      this._specVersion
    );
  }

  /**
   * Forms the URL to get catalogs from the web service, without any query paramters
   *
   * @returns the url
   */
  formCatalogsURL(): string {
    return this.formBaseURL() + "/catalogs";
  }

  /**
   * Queries the remote web service to get known catalogs
   *
   * @returns Promise to Array of catalog names
   */
  queryCatalogs(): Promise<Array<string>> {
    const mythis = this;
    const url = mythis.formCatalogsURL();
    const fetchInit = defaultFetchInitObj(XML_MIME);
    return doFetchWithTimeout(url, fetchInit, this._timeoutSec * 1000)
      .then(response => {
        if (response.status === 200) {
          return response.text();
        } else {
          throw new Error(`Status not 200: ${response.status}`);
        }
      })
      .then(function (rawXmlText) {
        return new DOMParser().parseFromString(rawXmlText, XML_MIME);
      })
      .then(function (rawXml) {
        if (!rawXml) {
          throw new Error("raw xml from DOMParser is null.");
        }

        const top = rawXml.documentElement;

        if (!top) {
          throw new Error("documentElement in xml from DOMParser is null.");
        }

        const catalogArray = top.getElementsByTagName("Catalog");
        const out: Array<string> = [];

        if (catalogArray) {
          for (let i = 0; i < catalogArray.length; i++) {
            const item = catalogArray.item(i);

            if (item && isDef(item.textContent)) {
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
    return this.formBaseURL() + "/contributors";
  }

  /**
   * Queries the remote web service to get known contributors
   *
   * @returns Promise to Array of contributor names
   */
  queryContributors(): Promise<Array<string>> {
    const url = this.formContributorsURL();
    const fetchInit = defaultFetchInitObj(XML_MIME);
    return doFetchWithTimeout(url, fetchInit, this._timeoutSec * 1000)
      .then(response => {
        if (response.status === 200) {
          return response.text();
        } else {
          throw new Error(`Status not 200: ${response.status}`);
        }
      })
      .then(function (rawXmlText) {
        return new DOMParser().parseFromString(rawXmlText, XML_MIME);
      })
      .then(function (rawXml) {
        const top = rawXml.documentElement;

        if (!top) {
          throw new Error("documentElement in xml from DOMParser is null.");
        }

        const contributorArray = top.getElementsByTagName("Contributor");
        const out: Array<string> = [];

        if (contributorArray) {
          for (let i = 0; i < contributorArray.length; i++) {
            const item = contributorArray.item(i);

            if (item && isDef(item.textContent)) {
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
    return this.formBaseURL() + "/version";
  }

  /**
   * Queries the remote web service to get its version
   *
   * @returns Promise to version string
   */
  queryVersion(): Promise<string> {
    const url = this.formVersionURL();
    const fetchInit = defaultFetchInitObj(TEXT_MIME);
    return doFetchWithTimeout(url, fetchInit, this._timeoutSec * 1000).then(
      response => {
        if (response.status === 200) {
          return response.text();
        } else {
          throw new Error(`Status not 200: ${response.status}`);
        }
      },
    );
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

    let url = this.formBaseURL() + "/query?";

    if (this._eventId) {
      url = url + makeParam("eventid", this._eventId);
    }

    if (this._startTime) {
      url = url + makeParam("starttime", toIsoWoZ(this._startTime));
    }

    if (this._endTime) {
      url = url + makeParam("endtime", toIsoWoZ(this._endTime));
    }

    if (isNumArg(this._minMag)) {
      url = url + makeParam("minmag", this._minMag);
    }

    if (isNumArg(this._maxMag)) {
      url = url + makeParam("maxmag", this._maxMag);
    }

    if (isStringArg(this._magnitudeType)) {
      url = url + makeParam("magnitudetype", this._magnitudeType);
    }

    if (isNumArg(this._minDepth)) {
      url = url + makeParam("mindepth", this._minDepth);
    }

    if (isNumArg(this._maxDepth)) {
      url = url + makeParam("maxdepth", this._maxDepth);
    }

    if (isNumArg(this._minLat)) {
      url = url + makeParam("minlat", this._minLat);
    }

    if (isNumArg(this._maxLat)) {
      url = url + makeParam("maxlat", this._maxLat);
    }

    if (isNumArg(this._minLon)) {
      url = url + makeParam("minlon", this._minLon);
    }

    if (isNumArg(this._maxLon)) {
      url = url + makeParam("maxlon", this._maxLon);
    }

    if (isNumArg(this._minRadius) || isNumArg(this._maxRadius)) {
      if (isNumArg(this._latitude) && isNumArg(this._longitude)) {
        url =
          url +
          makeParam("latitude", this._latitude) +
          makeParam("longitude", this._longitude);

        if (isNumArg(this._minRadius)) {
          url = url + makeParam("minradius", this._minRadius);
        }

        if (isNumArg(this._maxRadius)) {
          url = url + makeParam("maxradius", this._maxRadius);
        }
      } else {
        throw new Error(
          "Cannot use minRadius or maxRadius without latitude and longitude: lat=" +
            this._latitude +
            " lon=" +
            this._longitude,
        );
      }
    }

    if (this._includeArrivals) {
      if (this._host !== USGS_HOST) {
        url = url + "includearrivals=true&";
      } else {
        // USGS does not support includearrivals, but does actually
        // include the arrivals for an eventid= style query
        if (this._eventId) {
          // ok, works without the param
        } else {
          throw new Error(
            "USGS host, earthquake.usgs.gov, does not support includearrivals parameter.",
          );
        }
      }
    }

    if (isObject(this._updatedAfter)) {
      url = url + makeParam("updatedafter", this._updatedAfter);
    }

    if (isDef(this._includeAllOrigins)) {
      url = url + makeParam("includeallorigins", this._includeAllOrigins);
    }

    if (isDef(this._includeAllMagnitudes)) {
      url =
        url + makeParam("includeallmagnitudes", this._includeAllMagnitudes);
    }

    if (isStringArg(this._format)) {
      url = url + makeParam("format", this._format);
    }

    if (isNumArg(this._limit)) {
      url = url + makeParam("limit", this._limit);
    }

    if (isNumArg(this._offset)) {
      url = url + makeParam("offset", this._offset);
    }

    if (isStringArg(this._orderBy)) {
      url = url + makeParam("orderby", this._orderBy);
    }

    if (isStringArg(this._catalog)) {
      url = url + makeParam("catalog", this._catalog);
    }

    if (isStringArg(this._contributor)) {
      url = url + makeParam("contributor", this._contributor);
    }

    if (isDef(this._nodata)) {
      url = url + makeParam("nodata", this._nodata);
    }

    if (url.endsWith("&") || url.endsWith("?")) {
      url = url.substr(0, url.length - 1); // zap last & or ?
    }

    return url;
  }
}

//@ts-ignore
import {LatLonChoice,
  LatLonBoxEl,
  LatLonRadiusEl,
  LabeledMinMax} from './components';
import {TimeRangeChooser,} from './datechooser';

const eqsearchHtml = `
<div class="wrapper">
  <div>
  <label>Time Range </label>
  <sp-timerange duration="P7D"></sp-timerange>
  <button id="now">Now</button></div>
  <div>
  <button id="today">Today</button>
  <button id="week">Week</button>
  <button id="month">Month</button>
  <button id="year">Year</button>
  </div>
  <div>
    <label>Geo:</label>
    <sp-latlon-choice></sp-latlon-choice>
  </div>
  <div><label>Magnitude</label><sp-minmax id="magnitude" min="-1" max="10"></sp-minmax></div>
  <div><label>Depth</label><sp-minmax id="depth" min="0" max="1000"></sp-minmax><label>km</label></div>
</div>
`;

export class EarthquakeSearch extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({mode: 'open'});
    this.draw_element(shadow);
  }
  _registerEvent(wrapper: HTMLElement, sel: string) {
    const mythis = this;
    const component = wrapper.querySelector(sel) as HTMLElement;
    if ( ! component) {throw new Error(`can't find ${sel}`);}
    component.addEventListener("change", () => mythis.dispatchEvent(new Event("change")));
  }
  draw_element(shadow: ShadowRoot) {
    const wrapper = document.createElement('div');
    wrapper.setAttribute('class','wrapper');
    wrapper.innerHTML = eqsearchHtml;
    shadow.appendChild(wrapper);
    this._registerEvent(wrapper, 'sp-timerange');
    this._registerEvent(wrapper, 'sp-latlon-choice');
    this._registerEvent(wrapper, 'sp-minmax#magnitude');
    this._registerEvent(wrapper, 'sp-minmax#depth');

    const trChooser = wrapper.querySelector('sp-timerange') as TimeRangeChooser;
    if ( ! trChooser) {throw new Error("can't find sp-timerange");}

    const nowBtn = wrapper.querySelector('#now');
    if ( ! nowBtn) {throw new Error("can't find button#now");}
    nowBtn.addEventListener('click', event => {
      trChooser.end = DateTime.utc();
    });

    const todayBtn = wrapper.querySelector('#today');
    if ( ! todayBtn) {throw new Error("can't find button#today");}
    todayBtn.addEventListener('click', event => {
      trChooser.duration = Duration.fromISO('P1D');
    });

    const weekBtn = wrapper.querySelector('#week');
    if ( ! weekBtn) {throw new Error("can't find button#week");}
    weekBtn.addEventListener('click', event => {
      trChooser.duration = Duration.fromISO('P7D');
    });

    const monthBtn = wrapper.querySelector('#month');
    if ( ! monthBtn) {throw new Error("can't find button#month");}
    monthBtn.addEventListener('click', event => {
      trChooser.duration = Duration.fromISO('P1M');
    });

    const yearBtn = wrapper.querySelector('#year');
    if ( ! yearBtn) {throw new Error("can't find button#year");}
    yearBtn.addEventListener('click', event => {
      trChooser.duration = Duration.fromISO('P1Y');
    });
  }
  populateQuery(query?: EventQuery): EventQuery {
    if ( ! query) {
      query = new EventQuery();
    }
    const wrapper = (this.shadowRoot?.querySelector('div') as HTMLDivElement);
    const trChooser = wrapper.querySelector('sp-timerange') as TimeRangeChooser;
    if ( ! trChooser) {throw new Error("can't find sp-timerange");}
    query.startTime(trChooser.start);
    query.endTime(trChooser.end);
    const latlonchoice = wrapper.querySelector('sp-latlon-choice') as LatLonChoice;
    const choosenLatLon = latlonchoice.choosen();
    if (choosenLatLon instanceof LatLonBoxEl) {
      const latlonbox = choosenLatLon;
      if (latlonbox.south > -90) {query.minLat(latlonbox.south);}
      if (latlonbox.north < 90) {query.maxLat(latlonbox.north);}
      if (latlonbox.west > -180 && latlonbox.west+360 !==latlonbox.east) {query.minLon(latlonbox.west);}
      if (latlonbox.east < 360 && latlonbox.west+360 !==latlonbox.east) {query.maxLon(latlonbox.east);}
    } else if (choosenLatLon instanceof LatLonRadiusEl) {
      const latlonrad = choosenLatLon;
      if (latlonrad.minRadius>0 || latlonrad.maxRadius<180) {
        query.latitude(latlonrad.latitude);
        query.longitude(latlonrad.longitude);
        if (latlonrad.minRadius>0) {query.minRadius(latlonrad.minRadius);}
        if (latlonrad.maxRadius<180) {query.maxRadius(latlonrad.maxRadius);}
      }
    } else {
      console.log(`latlon choice is: ${choosenLatLon}`)
    }
    const mag = wrapper.querySelector('sp-minmax#magnitude') as LabeledMinMax;
    if (mag.min > 0) {query.minMag(mag.min);}
    if (mag.max < 10) {query.maxMag(mag.max);}
    const depth = wrapper.querySelector('sp-minmax#depth') as LabeledMinMax;
    if (depth.min > 0) {query.minDepth(depth.min);}
    if (depth.max < 1000) {query.maxDepth(depth.max);}
    return query;
  }
}

customElements.define('sp-earthquake-search', EarthquakeSearch);
