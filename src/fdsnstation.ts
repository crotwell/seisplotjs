/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */
import {
    CHANNEL_CODE_ELEMENT,
    ChannelCodeInput,
    LatLonChoice,
    LatLonBoxEl,
    LatLonRadiusEl,
  } from './components';
import {TimeRangeChooser,} from './datechooser';
import {
  FDSNCommon,
  IRIS_HOST,
  LatLonRegion,
  LatLonBox,
  LatLonRadius,
} from './fdsncommon';
import {NslcId} from './fdsnsourceid';
import {DateTime, Duration, Interval} from 'luxon';
import {parseStationXml, Network} from "./stationxml";
import {
  XML_MIME,
  TEXT_MIME,
  makeParam,
  makePostParam,
  doFetchWithTimeout,
  defaultFetchInitObj,
  doStringGetterSetter,
  doBoolGetterSetter,
  doIntGetterSetter,
  doFloatGetterSetter,
  doMomentGetterSetter,
  toIsoWoZ,
  isoToDateTime,
  isDef,
  isObject,
  isStringArg,
  isNumArg,
  stringify,
  validStartTime,
  validEndTime,
} from "./util";
export const LEVEL_NETWORK = "network";
export const LEVEL_STATION = "station";
export const LEVEL_CHANNEL = "channel";
export const LEVEL_RESPONSE = "response";
export const LEVELS = [
  LEVEL_NETWORK,
  LEVEL_STATION,
  LEVEL_CHANNEL,
  LEVEL_RESPONSE,
];

/**
 * Major version of the FDSN spec supported here.
 * Currently is 1.
 */
export const SERVICE_VERSION = 1;

/**
 * Service name as used in the FDSN DataCenters registry,
 * http://www.fdsn.org/datacenters
 */
export const SERVICE_NAME = `fdsnws-station-${SERVICE_VERSION}`;

/** a fake, completely empty stationxml document in case of no data. */
export const FAKE_EMPTY_XML =
  '<?xml version="1.0" encoding="ISO-8859-1"?> <FDSNStationXML xmlns="http://www.fdsn.org/xml/station/1" schemaVersion="1.0" xsi:schemaLocation="http://www.fdsn.org/xml/station/1 http://www.fdsn.org/xml/station/fdsn-station-1.0.xsd" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:iris="http://www.fdsn.org/xml/station/1/iris"> </FDSNStationXML>';

/** const for the default IRIS web service host, service.iris.edu */
export {IRIS_HOST};

/**
 * Query to a FDSN Station web service.
 *
 * @see http://www.fdsn.org/webservices/
 * @param host optional host to connect to, defaults to IRIS
 */
export class StationQuery extends FDSNCommon {

  /** @private */
  _networkCode: string|undefined;

  /** @private */
  _stationCode: string|undefined;

  /** @private */
  _locationCode: string|undefined;

  /** @private */
  _channelCode: string|undefined;

  /** @private */
  _startTime: DateTime|undefined;

  /** @private */
  _endTime: DateTime|undefined;

  /** @private */
  _startBefore: DateTime|undefined;

  /** @private */
  _endBefore: DateTime|undefined;

  /** @private */
  _startAfter: DateTime|undefined;

  /** @private */
  _endAfter: DateTime|undefined;

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
  _includeRestricted: boolean|undefined;

  /** @private */
  _includeAvailability: boolean|undefined;

  /** @private */
  _format: string|undefined;

  /** @private */
  _updatedAfter: DateTime|undefined;

  /** @private */
  _matchTimeseries: boolean|undefined;

  /**
   * Construct a query
   *
   * @param host the host to connect to , defaults to service.iris.edu
   */
  constructor(host?: string) {
    super(host);
  }

  /**
   * Gets/Sets the version of the fdsnws spec, 1 is currently the only value.
   * Setting this is probably a bad idea as the code may not be compatible with
   * the web service.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  specVersion(value?: string): StationQuery {
    doStringGetterSetter(this, "specVersion", value);
    return this;
  }

  getSpecVersion(): string {
    return this._specVersion;
  }

  /**
   * Gets/Sets the protocol, http or https. This should match the protocol
   * of the page loaded, but is autocalculated and generally need not be set.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  protocol(value?: string): StationQuery {
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
  host(value?: string): StationQuery {
    doStringGetterSetter(this, "host", value);
    return this;
  }

  getHost(): string | undefined {
    return this._host;
  }

  /**
   * Gets/Sets the remote port to connect to.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  port(value?: number): StationQuery {
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
  nodata(value?: number): StationQuery {
    doIntGetterSetter(this, "nodata", value);
    return this;
  }

  getNodata(): number | undefined {
    return this._nodata;
  }

  /**
   * Get/Set the network query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  networkCode(value?: string): StationQuery {
    doStringGetterSetter(this, "networkCode", value);
    return this;
  }

  getNetworkCode(): string | undefined {
    return this._networkCode;
  }

  /**
   * Get/Set the station query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  stationCode(value?: string): StationQuery {
    doStringGetterSetter(this, "stationCode", value);
    return this;
  }

  getStationCode(): string | undefined {
    return this._stationCode;
  }

  /**
   * Get/Set the location code query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  locationCode(value?: string): StationQuery {
    doStringGetterSetter(this, "locationCode", value);
    return this;
  }

  getLocationCode(): string | undefined {
    return this._locationCode;
  }

  /**
   * Get/Set the channel query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  channelCode(value?: string): StationQuery {
    doStringGetterSetter(this, "channelCode", value);
    return this;
  }

  getChannelCode(): string | undefined {
    return this._channelCode;
  }

  /**
   * Get/Set the starttime query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  startTime(value?: DateTime): StationQuery {
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
  endTime(value?: DateTime): StationQuery {
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
  timeRange(se: Interval): StationQuery {
    this.startTime(validStartTime(se));
    this.endTime(validEndTime(se));
    return this;
  }

  /**
   * Get/Set the startbefore query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  startBefore(value?: DateTime): StationQuery {
    doMomentGetterSetter(this, "startBefore", value);
    return this;
  }

  getStartBefore(): DateTime | undefined {
    return this._startBefore;
  }

  /**
   * Get/Set the endbefore query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  endBefore(value?: DateTime): StationQuery {
    doMomentGetterSetter(this, "endBefore", value);
    return this;
  }

  getEndBefore(): DateTime | undefined {
    return this._endBefore;
  }

  /**
   * Get/Set the startafter query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  startAfter(value?: DateTime): StationQuery {
    doMomentGetterSetter(this, "startAfter", value);
    return this;
  }

  getStartAfter(): DateTime | undefined {
    return this._startAfter;
  }

  /**
   * Get/Set the endafter query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  endAfter(value?: DateTime): StationQuery {
    doMomentGetterSetter(this, "endAfter", value);
    return this;
  }

  getEndAfter(): DateTime | undefined {
    return this._endAfter;
  }

  /**
   * Get/Set the minlat query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  minLat(value?: number): StationQuery {
    doFloatGetterSetter(this, "minLat", value);
    return this;
  }

  getMinLat(): number | undefined {
    return this._minLat;
  }

  /**
   * Get/Set the maxlon query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  maxLat(value?: number): StationQuery {
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
  minLon(value?: number): StationQuery {
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
  maxLon(value?: number): StationQuery {
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
  latitude(value?: number): StationQuery {
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
  longitude(value?: number): StationQuery {
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
  minRadius(value?: number): StationQuery {
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
  maxRadius(value?: number): StationQuery {
    doFloatGetterSetter(this, "maxRadius", value);
    return this;
  }

  getMaxRadius(): number | undefined {
    return this._maxRadius;
  }

  /**
   * Get/Set the includerestricted query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  includeRestricted(value?: boolean): StationQuery {
    doBoolGetterSetter(this, "includeRestricted", value);
    return this;
  }

  getIncludeRestricted(): boolean | undefined {
    return this._includeRestricted;
  }

  /**
   * Get/Set the includeavailability query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  includeAvailability(value?: boolean): StationQuery {
    doBoolGetterSetter(this, "includeAvailability", value);
    return this;
  }

  getIncludeAvailability(): boolean | undefined {
    return this._includeAvailability;
  }

  /**
   * Get/Set the format query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  format(value?: string): StationQuery {
    doStringGetterSetter(this, "format", value);
    return this;
  }

  getFormat(): string | undefined {
    return this._format;
  }

  /**
   * Get/Set the updatedafter query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  updatedAfter(value?: DateTime): StationQuery {
    doMomentGetterSetter(this, "updatedAfter", value);
    return this;
  }

  getUpdatedAfter(): DateTime | undefined {
    return this._updatedAfter;
  }

  /**
   * Get/Set the matchtimeseries query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  matchTimeseries(value?: boolean): StationQuery {
    doBoolGetterSetter(this, "matchTimeseries", value);
    return this;
  }

  getMatchTimeseries(): boolean | undefined {
    return this._matchTimeseries;
  }

  latLonRegion(value: LatLonRegion | null): StationQuery {
    if (value instanceof LatLonBox) {
      this._minLat = value.south;
      this._maxLat = value.north;
      this._minLon = value.west;
      this._maxLon = value.east;
      // unset
      this._latitude = undefined;
      this._longitude = undefined;
      this._minRadius = undefined;
      this._maxRadius = undefined;
    } else if (value instanceof LatLonRadius) {
      this._latitude = value.latitude;
      this._longitude = value.longitude;
      this._minRadius = value.minRadius;
      this._maxRadius = value.maxRadius;
      // unset
      this._minLat = undefined;
      this._maxLat = undefined;
      this._minLon = undefined;
      this._maxLon = undefined;
    } else if ( ! isDef(value)) {
      // unset
      this._latitude = undefined;
      this._longitude = undefined;
      this._minRadius = undefined;
      this._maxRadius = undefined;
      this._minLat = undefined;
      this._maxLat = undefined;
      this._minLon = undefined;
      this._maxLon = undefined;
    } else {
      throw new Error(
        `value argument is optional or LatLonRegion, but was type ${typeof value}, '${stringify(value)}' `,
      );
    }
    return this;
  }

  nslcCodes(channelId: NslcId): StationQuery {
    this.networkCode(channelId.networkCode);
    this.stationCode(channelId.stationCode);
    this.locationCode(channelId.locationCode);
    this.channelCode(channelId.channelCode);
    return this;
  }

  /**
   * Get/Set the timeout in seconds for the request. Default is 30.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  timeout(value?: number): StationQuery {
    doFloatGetterSetter(this, "timeoutSec", value);
    return this;
  }

  getTimeout(): number | undefined {
    return this._timeoutSec;
  }

  /**
   * Checks to see if any parameter that would limit the data
   * returned is set. This is a crude, coarse check to make sure
   * the client doesn't ask for EVERYTHING the server has.
   *
   * @returns true if some parameter set
   */
  isSomeParameterSet(): boolean {
    return (
      (isDef(this._networkCode) && this._networkCode.length>0 && this._networkCode!=='*') ||
      (isDef(this._stationCode) && this._stationCode.length>0 && this._stationCode!=='*') ||
      (isDef(this._locationCode) && this._locationCode.length>0 && this._locationCode!=='*') ||
      (isDef(this._channelCode) && this._channelCode.length>0 && this._channelCode!=='*') ||
      isDef(this._startTime) ||
      isDef(this._endTime) ||
      isDef(this._startBefore) ||
      isDef(this._endBefore) ||
      isDef(this._startAfter) ||
      isDef(this._endAfter) ||
      isDef(this._minLat) ||
      isDef(this._maxLat) ||
      isDef(this._minLon) ||
      isDef(this._maxLon) ||
      isDef(this._latitude) ||
      isDef(this._longitude) ||
      isDef(this._minRadius) ||
      isDef(this._maxRadius) ||
      isDef(this._updatedAfter)
    );
  }

  /**
   * Queries the remote web service for networks.
   *
   * @returns a Promise to an Array of Network objects.
   */
  queryNetworks(): Promise<Array<Network>> {
    return this.query(LEVEL_NETWORK);
  }

  /**
   * Queries the remote web service for stations. The stations
   * are contained within their respective Networks.
   *
   * @returns a Promise to an Array of Network objects.
   */
  queryStations(): Promise<Array<Network>> {
    return this.query(LEVEL_STATION);
  }

  /**
   * Queries the remote web service for channels. The Channels
   * are contained within their respective Stations which are in Networks.
   *
   * @returns a Promise to an Array of Network objects.
   */
  queryChannels(): Promise<Array<Network>> {
    return this.query(LEVEL_CHANNEL);
  }

  /**
   * Queries the remote web service for responses. The Responses
   * are contained within their respective Channels,
   * which are in Stations which are in Networks.
   *
   * @returns a Promise to an Array of Network objects.
   */
  queryResponses(): Promise<Array<Network>> {
    return this.query(LEVEL_RESPONSE);
  }

  /**
   * Queries the remote web service at the given level.
   *
   * @param level the level to query at, networ, station, channel or response.
   * @returns a Promise to an Array of Network objects.
   */
  query(level: string): Promise<Array<Network>> {
    if (!LEVELS.includes(level)) {
      throw new Error("Unknown level: '" + level + "'");
    }

    return this.queryRawXml(level).then(function (rawXml) {
      return parseStationXml(rawXml);
    });
  }

  /**
   * Execute POST request for networks, using params defined in this, and with
   * channel lines of the form:
   *
   * NET STA LOC CHA STARTTIME ENDTIME
   *
   * Note that empty LOC should be encoded as dash-dash
   *
   * @param  postLines array of channel selection lines
   * @returns a Promise to an Array of Network objects.
   */
  postQueryNetworks(postLines: Array<string>): Promise<Array<Network>> {
    return this.postQueryRawXml(LEVEL_NETWORK, postLines).then(function (
      rawXml,
    ) {
      return parseStationXml(rawXml);
    });
  }

  /**
   * Execute POST request for stations, using params defined in this, and with
   * channel lines of the form:
   *
   * NET STA LOC CHA STARTTIME ENDTIME
   *
   * Note that empty LOC should be encoded as dash-dash
   *
   * @param  postLines array of channel selection lines
   * @returns a Promise to an Array of Network objects.
   */
  postQueryStations(postLines: Array<string>): Promise<Array<Network>> {
    return this.postQueryRawXml(LEVEL_STATION, postLines).then(function (
      rawXml,
    ) {
      return parseStationXml(rawXml);
    });
  }

  /**
   * Execute POST request for channels, using params defined in this, and with
   * channel lines of the form:
   *
   * NET STA LOC CHA STARTTIME ENDTIME
   *
   * Note that empty LOC should be encoded as dash-dash
   *
   * @param  postLines array of channel selection lines
   * @returns a Promise to an Array of Network objects.
   */
  postQueryChannels(postLines: Array<string>): Promise<Array<Network>> {
    return this.postQueryRawXml(LEVEL_CHANNEL, postLines).then(function (
      rawXml,
    ) {
      return parseStationXml(rawXml);
    });
  }

  /**
   * Execute POST request for responses, using params defined in this, and with
   * channel lines of the form:
   *
   * NET STA LOC CHA STARTTIME ENDTIME
   *
   * Note that empty LOC should be encoded as dash-dash
   *
   * @param  postLines array of channel selection lines
   * @returns a Promise to an Array of Network objects.
   */
  postQueryResponses(postLines: Array<string>): Promise<Array<Network>> {
    return this.postQueryRawXml(LEVEL_RESPONSE, postLines).then(function (
      rawXml,
    ) {
      return parseStationXml(rawXml);
    });
  }

  /**
   * Execute POST request using params defined in this, for given level, and with
   * channel lines of the form:
   *
   * NET STA LOC CHA STARTTIME ENDTIME
   *
   * Note that empty LOC should be encoded as dash-dash
   *
   * @param  level     level to request, one of network, station, channel, response
   * @param  postLines array of channel selection lines
   * @returns a Promise to an Array of Network objects.
   */
  postQuery(level: string, postLines: Array<string>): Promise<Array<Network>> {
    if (!LEVELS.includes(level)) {
      throw new Error("Unknown level: '" + level + "'");
    }

    return this.postQueryRawXml(level, postLines).then(function (rawXml) {
      return parseStationXml(rawXml);
    });
  }

  /**
   * Queries the remote web service at the given level for raw xml.
   * Note that in the case of a nodata status code, xml that represents a
   * valid stationxml but with zero &lt;Network&gt; elements will be returned
   * as this simplifies parsing.
   *
   * @param level the level to query at, network, station, channel or response.
   * @returns a Promise to an xml Document.
   */
  queryRawXml(level: string): Promise<Document> {
    return this.queryRawXmlText(level)
      .then(function (rawXmlText) {
        return new DOMParser().parseFromString(rawXmlText, "text/xml");
      });
  }

  /**
   * Queries the remote web service at the given level for unparsed xml as text.
   * Note that in the case of a nodata status code, text that represents a
   * valid stationxml but with zero &lt;Network&gt; elements will be returned
   * as this simplifies parsing.
   *
   * @param level the level to query at, network, station, channel or response.
   * @returns a Promise to string.
   */
   queryRawXmlText(level: string): Promise<string> {
    if (!this.isSomeParameterSet()) {
      throw new Error(
        "Must set some parameter to avoid asking for everything.",
      );
    }

    const url = this.formURL(level);
    const fetchInit = defaultFetchInitObj(XML_MIME);
    return doFetchWithTimeout(url, fetchInit, this._timeoutSec * 1000)
      .then(response => {
        if (response.status === 200) {
          return response.text();
        } else if (
          response.status === 204 ||
          (isDef(this._nodata) && response.status === this._nodata)
        ) {
          // 204 is nodata, so successful but empty
          return FAKE_EMPTY_XML;
        } else {
          throw new Error(`Status not successful: ${response.status}`);
        }
      });
  }

  /**
   * Execute POST request using params defined in this, for given level, and with
   * channel lines of the form:
   *
   * NET STA LOC CHA STARTTIME ENDTIME
   *
   * Note that empty LOC should be encoded as dash-dash
   *
   * @param  level     level to request, one of network, station, channel, response
   * @param  postLines array of channel selection lines
   * @returns           string suitable for POST to fdsn station web service.
   */
  postQueryRawXml(level: string, postLines: Array<string>): Promise<Document> {
    if (postLines.length === 0) {
      // return promise faking an not ok fetch response
      return Promise.resolve(FAKE_EMPTY_XML)
      .then(function (rawXmlText) {
        return new DOMParser().parseFromString(rawXmlText, "text/xml");
      });
    } else {
      const fetchInit = defaultFetchInitObj(XML_MIME);
      fetchInit.method = "POST";
      fetchInit.body = this.createPostBody(level, postLines);
      return doFetchWithTimeout(
        this.formPostURL(),
        fetchInit,
        this._timeoutSec * 1000,
      )
        .then(response => {
          if (response.status === 200) {
            return response.text();
          } else if (
            response.status === 204 ||
            (isDef(this._nodata) && response.status === this._nodata)
          ) {
            // 204 is nodata, so successful but empty
            return FAKE_EMPTY_XML;
          } else {
            throw new Error(`Status not successful: ${response.status}`);
          }
        })
        .then(function (rawXmlText) {
          return new DOMParser().parseFromString(rawXmlText, "text/xml");
        });
    }
  }

  /**
   * Creates post body using params defined in this, for given level, and with
   * optional channel lines of the form:
   *
   * NET STA LOC CHA STARTTIME ENDTIME
   *
   * Note that empty LOC should be encoded as dash-dash
   *
   * @param  level     level to request, one of network, station, channel, response
   * @param  postLines optional array of channel selection lines
   * @returns           string suitable for POST to fdsn station web service.
   */
  createPostBody(level: string, postLines: Array<string> = []): string {
    let out = "";

    if (!isStringArg(level)) {
      throw new Error(
        "level not specified, should be one of network, station, channel, response.",
      );
    }

    out = out + makePostParam("level", level);

    if (isObject(this._startBefore)) {
      out = out + makePostParam("startbefore", toIsoWoZ(this._startBefore));
    }

    if (isObject(this._startAfter)) {
      out = out + makePostParam("startafter", toIsoWoZ(this._startAfter));
    }

    if (isObject(this._endBefore)) {
      out = out + makePostParam("endbefore", toIsoWoZ(this._endBefore));
    }

    if (isObject(this._endAfter)) {
      out = out + makePostParam("endafter", toIsoWoZ(this._endAfter));
    }

    if (isNumArg(this._minLat)) {
      out = out + makePostParam("minlat", this._minLat);
    }

    if (isNumArg(this._maxLat)) {
      out = out + makePostParam("maxlat", this._maxLat);
    }

    if (isNumArg(this._minLon)) {
      out = out + makePostParam("minlon", this._minLon);
    }

    if (isNumArg(this._maxLon)) {
      out = out + makePostParam("maxlon", this._maxLon);
    }

    if (isNumArg(this._latitude)) {
      out = out + makePostParam("lat", this._latitude);
    }

    if (isNumArg(this._longitude)) {
      out = out + makePostParam("lon", this._longitude);
    }

    if (isNumArg(this._minRadius)) {
      out = out + makePostParam("minradius", this._minRadius);
    }

    if (isNumArg(this._maxRadius)) {
      out = out + makePostParam("maxradius", this._maxRadius);
    }

    if (isDef(this._includeRestricted)) {
      out = out + makePostParam("includerestricted", this._includeRestricted);
    }

    if (isDef(this._includeAvailability)) {
      out =
        out + makePostParam("includeavailability", this._includeAvailability);
    }

    if (isObject(this._updatedAfter)) {
      out = out + makePostParam("updatedafter", toIsoWoZ(this._updatedAfter));
    }

    if (isDef(this._matchTimeseries)) {
      out = out + makePostParam("matchtimeseries", this._matchTimeseries);
    }

    if (isStringArg(this._format)) {
      out = out + makePostParam("format", this._format);
    }

    if (isNumArg(this._nodata)) {
      out = out + makePostParam("nodata", this._nodata);
    }

    postLines.forEach(line => (out = out + line.trim() + "\n"));
    return out;
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
   * Forms the basic URL to contact the web service, without any query paramters
   *
   * @returns the url
   */
  formBaseURL(): string {
    let colon = ":";

    if (this._protocol.endsWith(colon)) {
      colon = "";
    }

    return (
      this._protocol +
      colon +
      "//" +
      this._host +
      (this._port === 80 ? "" : ":" + String(this._port)) +
      "/fdsnws/station/" +
      this._specVersion
    );
  }

  formPostURL(): string {
    return this.formBaseURL() + "/query";
  }

  /**
   * Form URL to query the remote web service, encoding the query parameters.
   *
   * @param level network, station, channel or response
   * @returns url
   */
  formURL(level: string): string {
    let url = this.formBaseURL() + "/query?";

    if (!isStringArg(level)) {
      throw new Error(
        "level not specified, should be one of network, station, channel, response.",
      );
    }

    url = url + makeParam("level", level);

    if (isStringArg(this._networkCode) && this._networkCode.length>0 && this._networkCode!=='*') {
      url = url + makeParam("net", this._networkCode);
    }

    if (isStringArg(this._stationCode) && this._stationCode.length>0 && this._stationCode!=='*') {
      url = url + makeParam("sta", this._stationCode);
    }

    if (isStringArg(this._locationCode) && this._locationCode.length>0 && this._locationCode!=='*') {
      url = url + makeParam("loc", this._locationCode);
    }

    if (isStringArg(this._channelCode) && this._channelCode.length>0 && this._channelCode!=='*') {
      url = url + makeParam("cha", this._channelCode);
    }

    if (isObject(this._startTime)) {
      url = url + makeParam("starttime", toIsoWoZ(this._startTime));
    }

    if (isObject(this._endTime)) {
      url = url + makeParam("endtime", toIsoWoZ(this._endTime));
    }

    if (isObject(this._startBefore)) {
      url = url + makeParam("startbefore", toIsoWoZ(this._startBefore));
    }

    if (isObject(this._startAfter)) {
      url = url + makeParam("startafter", toIsoWoZ(this._startAfter));
    }

    if (isObject(this._endBefore)) {
      url = url + makeParam("endbefore", toIsoWoZ(this._endBefore));
    }

    if (isObject(this._endAfter)) {
      url = url + makeParam("endafter", toIsoWoZ(this._endAfter));
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

    if (isNumArg(this._latitude)) {
      url = url + makeParam("lat", this._latitude);
    }

    if (isNumArg(this._longitude)) {
      url = url + makeParam("lon", this._longitude);
    }

    if (isNumArg(this._minRadius)) {
      url = url + makeParam("minradius", this._minRadius);
    }

    if (isNumArg(this._maxRadius)) {
      url = url + makeParam("maxradius", this._maxRadius);
    }

    if (isDef(this._includeRestricted)) {
      url = url + makeParam("includerestricted", this._includeRestricted);
    }

    if (isDef(this._includeAvailability)) {
      url = url + makeParam("includeavailability", this._includeAvailability);
    }

    if (isObject(this._updatedAfter)) {
      url = url + makeParam("updatedafter", toIsoWoZ(this._updatedAfter));
    }

    if (isDef(this._matchTimeseries)) {
      url = url + makeParam("matchtimeseries", this._matchTimeseries);
    }

    if (isStringArg(this._format)) {
      url = url + makeParam("format", this._format);
    }

    if (isNumArg(this._nodata)) {
      url = url + makeParam("nodata", this._nodata);
    }

    if (url.endsWith("&") || url.endsWith("?")) {
      url = url.substr(0, url.length - 1); // zap last & or ?
    }

    return url;
  }
}

const channelsearchHtml = `
<div class="wrapper">
  <sp-channel-code-input></sp-channel-code-input>
  <div>
    <label>Time Range </label>
    <sp-timerange duration="P1Y" prev-next=true ></sp-timerange>
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
</div>
`;

export class ChannelSearch extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({mode: 'open'});
    this.draw_element(shadow);
  }
  _registerEvent(wrapper: HTMLElement, sel: string) {
    const component = wrapper.querySelector(sel) as HTMLElement;
    if ( ! component) {throw new Error(`can't find ${sel}`);}
    component.addEventListener("change", () => this.dispatchEvent(new Event("change")));
  }
  draw_element(shadow: ShadowRoot) {
    const wrapper = document.createElement('div');
    wrapper.setAttribute('class','wrapper');
    wrapper.innerHTML = channelsearchHtml;
    shadow.appendChild(wrapper);
    this._registerEvent(wrapper, 'sp-timerange');
    this._registerEvent(wrapper, 'sp-latlon-choice');

    const chanCodeEl = shadow.querySelector('sp-channel-code-input') as ChannelCodeInput;
    if (chanCodeEl) { //typescript
      if (this.hasAttribute("network")) {
        const v = this.getAttribute("network");
        if (v) {chanCodeEl.network = v;}
      }
      if (this.hasAttribute("station")) {
        const v = this.getAttribute("station");
        if (v) {chanCodeEl.station = v;}
      }
      if (this.hasAttribute("location")) {
        const v = this.getAttribute("location");
        if (v) {chanCodeEl.location = v;}
      }
      if (this.hasAttribute("channel")) {
        const v = this.getAttribute("channel");
        if (v) {chanCodeEl.channel = v;}
      }
    }
    const trChooser = wrapper.querySelector('sp-timerange') as TimeRangeChooser;
    if ( ! trChooser) {throw new Error("can't find sp-timerange");}
    if (this.hasAttribute("start")) {
      const s = this.getAttribute("start");
      if (s !== null) {
        trChooser.start = isoToDateTime(s);
      }
    }
    if (this.hasAttribute("end")) {
      const e = this.getAttribute("end");
      if (e !== null) {
        trChooser.end = isoToDateTime(e);
      }
    }
    if (this.hasAttribute("duration")) {
      const d = this.getAttribute("duration");
      if (d !== null) {
        trChooser.duration = Duration.fromISO(""+d);
      }
    }

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
    const latlonChooser = wrapper.querySelector('sp-latlon-choice') as LatLonChoice;
    if ( ! latlonChooser) {throw new Error("can't find sp-latlon-choice");}
    LatLonChoice.observedAttributes.forEach(attr => {
      if (this.hasAttribute(attr)) {
        // typescript
        const attrVal = this.getAttribute(attr);
        if (attrVal) {latlonChooser.setAttribute(attr, attrVal);}
      }
    });
  }
  populateQuery(query?: StationQuery): StationQuery {
    if ( ! query) {
      query = new StationQuery();
    }
    const wrapper = (this.shadowRoot?.querySelector('div') as HTMLDivElement);
    const codeChooser = wrapper.querySelector(CHANNEL_CODE_ELEMENT) as ChannelCodeInput;
    query.networkCode(codeChooser.network);
    query.stationCode(codeChooser.station);
    query.locationCode(codeChooser.location);
    query.channelCode(codeChooser.channel);

    const trChooser = wrapper.querySelector('sp-timerange') as TimeRangeChooser;
    if ( ! trChooser) {throw new Error("can't find sp-timerange");}
    query.startTime(trChooser.start);
    query.endTime(trChooser.end);
    const latlonchoice = wrapper.querySelector('sp-latlon-choice') as LatLonChoice;
    const choosenLatLon = latlonchoice.choosen();
    if (choosenLatLon instanceof LatLonBoxEl) {
      const latlonbox = choosenLatLon.asLatLonBox();
      if (latlonbox.south > -90) {query.minLat(latlonbox.south);}
      if (latlonbox.north < 90) {query.maxLat(latlonbox.north);}
      if (latlonbox.west > -180 && latlonbox.west+360 !==latlonbox.east) {query.minLon(latlonbox.west);}
      if (latlonbox.east < 360 && latlonbox.west+360 !==latlonbox.east) {query.maxLon(latlonbox.east);}
    } else if (choosenLatLon instanceof LatLonRadiusEl) {
      const latlonrad = choosenLatLon ;
      if (latlonrad.minRadius>0 || latlonrad.maxRadius<180) {
        query.latitude(latlonrad.latitude);
        query.longitude(latlonrad.longitude);
        if (latlonrad.minRadius>0) {query.minRadius(latlonrad.minRadius);}
        if (latlonrad.maxRadius<180) {query.maxRadius(latlonrad.maxRadius);}
      }
    } else {
      // null means all, whole world
    }
    return query;
  }
  getGeoChoiceElement(): LatLonChoice {
    const wrapper = (this.shadowRoot?.querySelector('div') as HTMLDivElement);
    const latlonchoice = wrapper.querySelector('sp-latlon-choice') as LatLonChoice;
    return latlonchoice;
  }
}

export const CHANNEL_SEARCH_ELEMENT = 'sp-channel-search';
customElements.define(CHANNEL_SEARCH_ELEMENT, ChannelSearch);
