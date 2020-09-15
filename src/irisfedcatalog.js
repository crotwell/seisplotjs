// @flow

/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */

import {parseStationXml, Network} from './stationxml';
import {LEVELS, LEVEL_NETWORK, LEVEL_STATION, LEVEL_CHANNEL, LEVEL_RESPONSE, FAKE_EMPTY_XML, StationQuery} from './fdsnstation.js';
import {DataSelectQuery} from './fdsndataselect.js';
import {SeismogramDisplayData} from './seismogram.js';
import {XML_MIME, TEXT_MIME, StartEndDuration, makeParam, doFetchWithTimeout, defaultFetchInitObj} from './util.js';

// special due to flow
import {doStringGetterSetter, doIntGetterSetter, doFloatGetterSetter, doMomentGetterSetter,
        checkProtocol, toIsoWoZ, isDef, hasArgs, hasNoArgs, isObject, isStringArg,
        isNonEmptyStringArg, isNumArg} from './util';

import moment from 'moment';
import RSVP from 'rsvp';

/**
 * Major version of the FDSN spec supported here.
 * Currently is 1.
 */
export const SERVICE_VERSION = 1;
/**
 * Service name as used in the FDSN DataCenters registry,
 * http://www.fdsn.org/datacenters
 */
export const SERVICE_NAME = `irisws-fedcatalog-${SERVICE_VERSION}`;

export const IRIS_HOST = "service.iris.edu";

/** a fake, completely empty stationxml document in case of no data. */
export const FAKE_EMPTY_TEXT = '\n';

export class FedCatalogResult {
  dataCenter: string;
  services: Map<string,string>;
  stationService: string;
  dataSelectService: string;
  postLines: Array<string>;
  stationQuery: StationQuery | null;
  dataSelectQuery: DataSelectQuery | null;
  constructor() {
    this.dataCenter = "";
    this.stationService = "";
    this.dataSelectService = "";
    this.postLines = [];
    this.services = new Map();
    this.stationQuery = null;
    this.dataSelectQuery = null;
  }
}

export type ParsedResultType = {
  params: Map<string,string>;
  queries: Array<FedCatalogResult>;
}

/**
 * Query to a IRIS FedCatalog web service.
 *
 * @see http://www.fdsn.org/webservices/
 *
 * @param host optional host to connect to, defaults to IRIS
 */
export class FedCatalogQuery {
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
  _targetService: string;
  /** @private */
  _level: string;
  /** @private */
  _networkCode: string;
  /** @private */
  _stationCode: string;
  /** @private */
  _locationCode: string;
  /** @private */
  _channelCode: string;
  /** @private */
  _startTime: moment$Moment;
  /** @private */
  _endTime: moment$Moment;
  /** @private */
  _startBefore: moment$Moment;
  /** @private */
  _endBefore: moment$Moment;
  /** @private */
  _startAfter: moment$Moment;
  /** @private */
  _endAfter: moment$Moment;
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
  _includeRestricted: boolean;
  /** @private */
  _includeAvailability: boolean;
  /** @private */
  _format: string;
  /** @private */
  _updatedAfter: moment$Moment;
  /** @private */
  _matchTimeseries: boolean;
  /** @private */
  _timeoutSec: number;
  /** Construct a query
   *
   * @param host the host to connect to , defaults to service.iris.edu
   */
  constructor(host?: string) {
    this._specVersion = 1;
    this._protocol = checkProtocol();
    this.host(host);
    if (! isNonEmptyStringArg(host)) {
      this._host = IRIS_HOST;
    }
    this._port = 80;
    this._timeoutSec = 30;
  }
  /** Gets/Sets the version of the fdsnws spec, 1 is currently the only value.
   *  Setting this is probably a bad idea as the code may not be compatible with
   *  the web service.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  specVersion(value?: number): number | FedCatalogQuery {
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
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  protocol(value?: string): string | FedCatalogQuery {
    return doStringGetterSetter(this, 'protocol', value);
  }
  /** Gets/Sets the remote host to connect to.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  host(value?: string): string | FedCatalogQuery {
    return doStringGetterSetter(this, 'host', value);
  }
  /** Gets/Sets the remote port to connect to.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  port(value?: number): number | FedCatalogQuery {
    return doIntGetterSetter(this, 'port', value);
  }
  /** Gets/Sets the nodata parameter, usually 404 or 204 (default), controlling
   * the status code when no matching data is found by the service.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  nodata(value?: number): number | FedCatalogQuery {
    return doIntGetterSetter(this, 'nodata', value);
  }
  /** Get/Set the targetservice query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  targetService(value?: string): string | FedCatalogQuery {
    return doStringGetterSetter(this, 'targetService', value);
  }
  /** Get/Set the network query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  networkCode(value?: string): string | FedCatalogQuery {
    return doStringGetterSetter(this, 'networkCode', value);
  }
  /** Get/Set the station query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  stationCode(value?: string): string | FedCatalogQuery {
    return doStringGetterSetter(this, 'stationCode', value);
  }
  /** Get/Set the location code query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  locationCode(value?: string): string | FedCatalogQuery {
    return doStringGetterSetter(this, 'locationCode', value);
  }
  /** Get/Set the channel query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  channelCode(value?: string): string | FedCatalogQuery {
    return doStringGetterSetter(this, 'channelCode', value);
  }
  /** Get/Set the starttime query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  startTime(value?: moment$Moment): moment$Moment | FedCatalogQuery {
    return doMomentGetterSetter(this, 'startTime', value);
  }
  /** Get/Set the endtime query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  endTime(value?: moment$Moment): moment$Moment | FedCatalogQuery {
    return doMomentGetterSetter(this, 'endTime', value);
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
  /** Get/Set the startbefore query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  startBefore(value?: moment$Moment): moment$Moment | FedCatalogQuery {
    return doMomentGetterSetter(this, 'startBefore', value);
  }
  /** Get/Set the endbefore query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  endBefore(value?: moment$Moment): moment$Moment | FedCatalogQuery {
    return doMomentGetterSetter(this, 'endBefore', value);
  }
  /** Get/Set the startafter query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  startAfter(value?: moment$Moment): moment$Moment | FedCatalogQuery {
    return doMomentGetterSetter(this, 'startAfter', value);
  }
  /** Get/Set the endafter query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  endAfter(value?: moment$Moment): moment$Moment | FedCatalogQuery {
    return doMomentGetterSetter(this, 'endAfter', value);
  }
  /** Get/Set the minlat query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  minLat(value?: number): number | FedCatalogQuery {
    return doFloatGetterSetter(this, 'minLat', value);
  }
  /** Get/Set the maxlon query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  maxLat(value?: number): number | FedCatalogQuery {
    return doFloatGetterSetter(this, 'maxLat', value);
  }
  /** Get/Set the minlon query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  minLon(value?: number): number | FedCatalogQuery {
    return doFloatGetterSetter(this, 'minLon', value);
  }
  /** Get/Set the maxlon query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  maxLon(value?: number): number | FedCatalogQuery {
    return doFloatGetterSetter(this, 'maxLon', value);
  }
  /** Get/Set the latitude query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  latitude(value?: number): number | FedCatalogQuery {
    return doFloatGetterSetter(this, 'latitude', value);
  }
  /** Get/Set the longitude query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  longitude(value?: number): number | FedCatalogQuery {
    return doFloatGetterSetter(this, 'longitude', value);
  }
  /** Get/Set the minradius query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  minRadius(value?: number): number | FedCatalogQuery {
    return doFloatGetterSetter(this, 'minRadius', value);
  }
  /** Get/Set the maxradius query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  maxRadius(value?: number): number | FedCatalogQuery {
    return doFloatGetterSetter(this, 'maxRadius', value);
  }
  /** Get/Set the includerestricted query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  includeRestricted(value?: boolean): boolean | FedCatalogQuery {
    if (hasNoArgs(value)) {
      return this._includeRestricted;
    } else if (hasArgs(value)) {
      this._includeRestricted = value;
      return this;
    } else {
      throw new Error('value argument is optional or boolean, but was '+typeof value);
    }
  }
  /** Get/Set the includeavailability query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  includeAvailability(value?: boolean): boolean | FedCatalogQuery {
    if (hasNoArgs(value)) {
      return this._includeAvailability;
    } else if (hasArgs(value)) {
      this._includeAvailability = value;
      return this;
    } else {
      throw new Error('value argument is optional or boolean, but was '+typeof value);
    }
  }
  /** Get/Set the format query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  format(value?: string): string | FedCatalogQuery {
    return doStringGetterSetter(this, 'format', value);
  }
  /** Get/Set the updatedafter query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  updatedAfter(value?: moment$Moment): moment$Moment | FedCatalogQuery {
    return doMomentGetterSetter(this, 'updatedAfter', value);
  }
  /** Get/Set the matchtimeseries query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  matchTimeseries(value?: boolean): boolean | FedCatalogQuery {
    if (hasNoArgs(value)) {
      return this._matchTimeseries;
    } else if (hasArgs(value)) {
      this._matchTimeseries = value;
      return this;
    } else {
      throw new Error('value argument is optional or boolean, but was '+typeof value);
    }
  }
  /** Get/Set the timeout in seconds for the request. Default is 30.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  timeout(value?: number): number | FedCatalogQuery {
    if (hasNoArgs(value)) {
      return this._timeoutSec;
    } else if (isNumArg(value)) {
      this._timeoutSec = value;
      return this;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }

  /** Checks to see if any parameter that would limit the data
   * returned is set. This is a crude, coarse check to make sure
   * the client doesn't ask for EVERYTHING the server has.
   *
   * @returns true if some parameter set
   * */
  isSomeParameterSet(): boolean {
    return isDef(this._networkCode) ||
    isDef(this._stationCode) ||
    isDef(this._locationCode) ||
    isDef(this._channelCode) ||
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
    isDef(this._updatedAfter);
  }

  /**
   * Queries the remote web service for networks.
   *
   * @returns a Promise to an Array of Network objects.
   */
  queryNetworks(): Promise<Array<Network>> {
    return this.queryFdsnStation(LEVEL_NETWORK);
  }
  /**
   * Queries the remote web service for stations. The stations
   * are contained within their respective Networks.
   *
   * @returns a Promise to an Array of Network objects.
   */
  queryStations(): Promise<Array<Network>> {
    return this.queryFdsnStation(LEVEL_STATION);
  }
  /**
   * Queries the remote web service for channels. The Channels
   * are contained within their respective Stations which are in Networks.
   *
   * @returns a Promise to an Array of Network objects.
   */
  queryChannels(): Promise<Array<Network>> {
    return this.queryFdsnStation(LEVEL_CHANNEL);
  }
  /**
   * Queries the remote web service for responses. The Responses
   * are contained within their respective Channels,
   * which are in Stations which are in Networks.
   *
   * @returns a Promise to an Array of Network objects.
   */
  queryResponses(): Promise<Array<Network>> {
    return this.queryFdsnStation(LEVEL_RESPONSE);
  }

  /**
   * Queries the remote station web service at the given level.
   *
   * @param level the level to query at, networ, station, channel or response.
   * @returns a Promise to an Array of Network objects.
   */
  queryFdsnStation(level: string): Promise<Array<Network>> {
    return this.setupQueryFdsnStation(level).then(parsedResult => {
      return RSVP.all(parsedResult.queries.map(query => query.stationQuery.postQuery(level, query.postLines)));
    }).then(netArrayArray => {
      let out = [];
      netArrayArray.forEach(netArray => {
        netArray.forEach(net => {
          out.push(net);
        });
      });
      return out;
    });
  }


 setupQueryFdsnStation(level: string): Promise<Array<FedCatalogResult>> {
    if (! LEVELS.includes(level)) {throw new Error("Unknown level: '"+level+"'");}
    this._level = level;
    this.targetService('station');
    return this.queryRaw().then(function(parsedResult) {
      for (let r of parsedResult.queries) {
        r.stationQuery = new StationQuery();
        parsedResult.params.forEach( (v, k) => {
          const field = `_${k}`;
          console.log(`set StationQuery field: ${field}=${v}`);
          r.stationQuery[field] = v;
        });
        if (! r.services.has('STATIONSERVICE')) {
          console.log(`${parsedResult.queries.length} ${r.dataCenter} services.size: ${r.services.size}`);
          r.services.forEach((v,k) => console.log(`service: ${k}  ${v}`));
          throw new Error("QueryResult does not have STATIONSERVICE in services");
        }
        const serviceURL = new URL(r.services.get('STATIONSERVICE'));
        r.stationQuery.host(serviceURL.hostname);
        if (serviceURL.port) {
          r.stationQuery.port(serviceURL.port);
        }
      }
      return parsedResult;
    });
  }

  setupQueryFdnsDataSelect(): Promise<Array<SeismogramDisplayData>> {
    this.targetService('dataselect');
    return this.queryRaw().then(function(parsedResult) {
      let out = [];
      for (let r of parsedResult.queries) {
        r.dataSelectQuery = new DataSelectQuery();
        parsedResult.params.forEach( (k,v) => {
          const field = `_${k}`;
            r.dataSelectQuery[field] = v;
        });
        if (! r.services.has('DATASELECTSERVICE')) {
          throw new Error("QueryResult does not have DATASELECTSERVICE in services");
        }
        const serviceURL = new URL(r.services.get('DATASELECTSERVICE'));
        r.dataSelectQuery.host(serviceURL.hostname);
        if (serviceURL.port) {
          stationQuery.port(serviceURL.port);
        }
      }
      return parsedResult;
    });
  }

  queryFdsnDataselect() {
    return this.setupQueryFdnsDataSelect()
    .then(parsedResult => {

      return RSVP.all(parsedResult.queries.map(query => {
        let sddList = query.postLines.map(line => {
          const items = line.split(" ");
          const start = moment.utc(items[4]);
          const end = moment.utc(items[5]);
          return SeismogramDisplayData.fromCodesAndTimes(items[0], items[1], items[2], items[3], start, end);
          });
        sddList.forEach(sdd => console.log(`queryFdsnDataselect sdd: ${sdd.networkCode} ${sdd.stationCode} ${sdd.locationCode} ${sdd.channelCode}`))
        return query.dataSelectQuery.postQuerySeismograms(sddList);
      }));
    }).then(sddArrayArray => {
      let out = [];
      sddArrayArray.forEach(sddArray => {
        sddArray.forEach(sdd => {
          out.push(sdd);
        });
      });
      return out;
    });
  }

  /**
   * Queries the remote web service at the given level for raw xml.
   *
   * @param level the level to query at, network, station, channel or response.
   * @returns a Promise to an xml Document.
   */
  queryRaw(): Promise<ParsedResultType> {
    const mythis = this;
    const url = this.formURL();
    const fetchInit = defaultFetchInitObj(TEXT_MIME);
    return doFetchWithTimeout(url, fetchInit, this._timeoutSec * 1000 )
      .then(response => {
          if (response.status === 200) {
            return response.text();
          } else if (response.status === 204 || (mythis.nodata() && response.status === mythis.nodata())) {
            // 204 is nodata, so successful but empty
            return FAKE_EMPTY_TEXT;
          } else {
            throw new Error(`Status not successful: ${response.status}`);
          }
      }).then(function(rawText) {
        console.log(rawText);
        return mythis.parseRequest(rawText);
      });
  }

  parseRequest(requestText: string): ParsedResultType {
    let out = {
      params: new Map(),
      queries: []
    };
    let lines = requestText.split('\n');
    let inParams = true;
    let query = null;
    for (let l of lines) {
      l = l.trim();
      if (inParams) {
        if (l.length === 0) {
          //empty line, end of section
          inParams = false;
        } else {
          let keyval = l.split('=');
          out.params.set(keyval[0], keyval[1]);
        }
      } else {
        if (l.length === 0) {
          // empty line, end of section
          query = null;
        } else {
          if (query === null) {
            // first line of next response section
            console.log(`first line of next query: ${l}`);
            query = new FedCatalogResult();
            out.queries.push(query);
          }
          if (l.indexOf("=") !== -1) {
            let keyval = l.split("=");
            if (keyval[0] === "DATACENTER") {
              query.dataCenter = keyval[1];
            } else if (keyval[0].endsWith("SERVICE")) {
              query.services.set(keyval[0], keyval[1]);
            } else {
              throw new Error(`Unexpected line in FedCatalog response: '${l}'`);
            }
          } else {
            query.postLines.push(l);
          }
        }
      }
    }
    return out;
  }

  /**
   * Forms the URL to get version from the web service, without any query paramters
   *
   * @returns the url
   */
  formVersionURL() {
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
   * Forms the basic URL to contact the web service, without any query paramters
   *
   * @returns the url
   */
  formBaseURL() {
    let colon = ":";
    if (this._protocol.endsWith(colon)) {
      colon = "";
    }
    return this._protocol+colon+"//"+this._host+(this._port===80?"":(":"+this._port))+"/irisws/fedcatalog/"+this._specVersion;
  }
  /**
   * Form URL to query the remote web service, encoding the query parameters.
   *
   * @param level network, station, channel or response
   * @returns url
   */
  formURL() {
    let url = this.formBaseURL()+"/query?";
    if (isStringArg(this._level)) { url = url+makeParam("level", this._level);}
    if (isStringArg(this._targetService)) { url = url+makeParam("targetservice", this.targetService());}
    if (isStringArg(this._networkCode)) { url = url+makeParam("net", this.networkCode());}
    if (isStringArg(this._stationCode)) { url = url+makeParam("sta", this.stationCode());}
    if (isStringArg(this._locationCode)) { url = url+makeParam("loc", this.locationCode());}
    if (isStringArg(this._channelCode)) { url = url+makeParam("cha", this.channelCode());}
    if (isObject(this._startTime)) { url = url+makeParam("starttime", toIsoWoZ(this._startTime));}
    if (isObject(this._endTime)) { url = url+makeParam("endtime", toIsoWoZ(this._endTime));}
    if (isObject(this._startBefore)) { url = url+makeParam("startbefore", toIsoWoZ(this._startBefore));}
    if (isObject(this._startAfter)) { url = url+makeParam("startafter", toIsoWoZ(this._startAfter));}
    if (isObject(this._endBefore)) { url = url+makeParam("endbefore", toIsoWoZ(this._endBefore));}
    if (isObject(this._endAfter)) { url = url+makeParam("endafter", toIsoWoZ(this._endAfter));}
    if (isNumArg(this._minLat)) { url = url+makeParam("minlat", this.minLat());}
    if (isNumArg(this._maxLat)) { url = url+makeParam("maxlat", this.maxLat());}
    if (isNumArg(this._minLon)) { url = url+makeParam("minlon", this.minLon());}
    if (isNumArg(this._maxLon)) { url = url+makeParam("maxlon", this.maxLon());}
    if (isNumArg(this._latitude)) { url = url+makeParam("lat", this.latitude());}
    if (isNumArg(this._longitude)) { url = url+makeParam("lon", this.longitude());}
    if (isNumArg(this._minRadius)) { url = url+makeParam("minradius", this.minRadius());}
    if (isNumArg(this._maxRadius)) { url = url+makeParam("maxradius", this.maxRadius());}
    if (isDef(this._includeRestricted)) { url = url+makeParam("includerestricted", this.includeRestricted());}
    if (isDef(this._includeAvailability)) { url = url+makeParam("includeavailability", this.includeAvailability());}
    if (isObject(this._updatedAfter)) { url = url+makeParam("updatedafter", toIsoWoZ(this._updatedAfter));}
    if (isDef(this._matchTimeseries)) { url = url+makeParam("matchtimeseries", this.matchTimeseries());}
    if (isStringArg(this._format)) { url = url+makeParam("format", this.format());}
    if (isNumArg(this._nodata)) { url = url+makeParam("nodata", this.nodata());}
    if (url.endsWith('&') || url.endsWith('?')) {
      url = url.substr(0, url.length-1); // zap last & or ?
    }
    return url;
  }

}
