/*
 * Philip Crotwell
 * University of South Carolina, 2020
 * https://www.seis.sc.edu
 */
import { FDSNCommon } from "./fdsncommon";
import { DateTime, Interval } from "luxon";
import { Network } from "./stationxml";
import {
  LEVELS,
  LEVEL_NETWORK,
  LEVEL_STATION,
  LEVEL_CHANNEL,
  LEVEL_RESPONSE,
  StationQuery,
} from "./fdsnstation";
import { NslcId } from "./fdsnsourceid";
import { DataSelectQuery } from "./fdsndataselect";
import { SeismogramDisplayData } from "./seismogram";
import {
  TEXT_MIME,
  makeParam,
  doFetchWithTimeout,
  defaultFetchInitObj,
  stringify,
  doStringGetterSetter,
  doBoolGetterSetter,
  doIntGetterSetter,
  doFloatGetterSetter,
  doMomentGetterSetter,
  isoToDateTime,
  toIsoWoZ,
  isDef,
  isObject,
  isStringArg,
  isNonEmptyStringArg,
  isNumArg,
  validStartTime,
  validEndTime,
} from "./util";

/**
 * Major version of the IRIS web service supported here.
 * Currently is 1.
 */
export const SERVICE_VERSION = 1;

/**
 * Service name as used in the FDSN DataCenters registry,
 * https://www.fdsn.org/datacenters
 */
export const SERVICE_NAME = `irisws-fedcatalog-${SERVICE_VERSION}`;
export const IRIS_HOST = "service.iris.edu";
export const TARGET_DATASELECT = "dataselect";
export const TARGET_STATION = "station";

/** a fake, completely empty stationxml document in case of no data. */
export const FAKE_EMPTY_TEXT = "\n";

/**
 * Represents the part of the results of a fedcatalog query for a single
 * datacenter, a section of the larger FedCatalogResult.
 *
 */
export class FedCatalogDataCenter {
  dataCenter: string;
  services: Map<string, string>;
  stationService: string;
  dataSelectService: string;
  postLines: Array<string>;
  stationQuery: StationQuery | null;
  dataSelectQuery: DataSelectQuery | null;
  level: string;

  constructor() {
    this.dataCenter = "";
    this.stationService = "";
    this.dataSelectService = "";
    this.postLines = [];
    this.services = new Map();
    this.stationQuery = null;
    this.dataSelectQuery = null;
    this.level = LEVEL_NETWORK;
  }
  /**
   * Uses the response from the FedCat server to make the actual FDSNStation
   * query that returns StationXML. If the original FedCat query did not return
   * a Station service, or it was not asked for, then the array will be empty.
   *
   * @returns promise to networks
   */
  queryNetworkList(): Promise<Array<Network>> {
    if (this.stationQuery) {
      return this.stationQuery.postQuery(this.level, this.postLines);
    } else {
      return Promise.all([] as Network[]);
    }
  }
  queryStationRawXml(): Promise<Document> {
    if (isDef(this.stationQuery)) {
      return this.stationQuery.postQueryRawXml(this.level, this.postLines);
    } else {
      throw new Error("this.stationQuery does not exist.");
    }
  }
  querySDDList(): Promise<Array<SeismogramDisplayData>> {
    if (isDef(this.dataSelectQuery)) {
      const sddList = this.postLines.map((line) => {
        const items = line.split(" ");
        const start = isoToDateTime(items[4]);
        const end = isoToDateTime(items[5]);
        return SeismogramDisplayData.fromCodesAndTimes(
          items[0],
          items[1],
          items[2],
          items[3],
          start,
          end,
        );
      });

      return this.dataSelectQuery.postQuerySeismograms(sddList);
    } else {
      // dataSelectQuery missing
      return Promise.all([] as SeismogramDisplayData[]);
    }
  }
}

/**
 * Represents the results of a fedcatalog query.
 *
 */
export class FedCatalogResult {
  params: Map<string, string>;
  queries: Array<FedCatalogDataCenter>;

  constructor() {
    this.params = new Map();
    this.queries = [];
  }
}

/**
 * Query to a IRIS FedCatalog web service.
 *
 * @see https://service.iris.edu/irisws/fedcatalog/1/
 * @param host optional host to connect to, defaults to IRIS
 */
export class FedCatalogQuery extends FDSNCommon {
  /** @private */
  _targetService: string | undefined;

  /** @private */
  _level: string | undefined;

  /** @private */
  _networkCode: string | undefined;

  /** @private */
  _stationCode: string | undefined;

  /** @private */
  _locationCode: string | undefined;

  /** @private */
  _channelCode: string | undefined;

  /** @private */
  _startTime: DateTime | undefined;

  /** @private */
  _endTime: DateTime | undefined;

  /** @private */
  _startBefore: DateTime | undefined;

  /** @private */
  _endBefore: DateTime | undefined;

  /** @private */
  _startAfter: DateTime | undefined;

  /** @private */
  _endAfter: DateTime | undefined;

  /** @private */
  _minLat: number | undefined;

  /** @private */
  _maxLat: number | undefined;

  /** @private */
  _minLon: number | undefined;

  /** @private */
  _maxLon: number | undefined;

  /** @private */
  _latitude: number | undefined;

  /** @private */
  _longitude: number | undefined;

  /** @private */
  _minRadius: number | undefined;

  /** @private */
  _maxRadius: number | undefined;

  /** @private */
  _includeRestricted: boolean | undefined;

  /** @private */
  _includeAvailability: boolean | undefined;

  /** @private */
  _format: string | undefined;

  /** @private */
  _updatedAfter: DateTime | undefined;

  /** @private */
  _matchTimeseries: boolean | undefined;

  fedCatResult: Promise<FedCatalogResult> | null;

  /**
   * Construct a query
   *
   * @param host the host to connect to , defaults to service.iris.edu
   */
  constructor(host?: string) {
    if (!isNonEmptyStringArg(host)) {
      host = IRIS_HOST;
    }
    super(host);
    this.fedCatResult = null;
  }

  /**
   * Constructs a station FedCatalogQuery using the parameters in a StationQuery.
   *
   * @param   stationQuery query to pull parameters from
   * @returns               fedcatalog query
   */
  static fromStationQuery(stationQuery: StationQuery): FedCatalogQuery {
    const out = new FedCatalogQuery();

    if (!(stationQuery instanceof StationQuery)) {
      throw new Error(
        "1st arg must be a StationQuery: " + stringify(stationQuery),
      );
    }

    if (!stationQuery.isSomeParameterSet()) {
      throw new Error(
        "Some parameters must be set in the stationQuery to avoid asking for everything.",
      );
    }

    if (isStringArg(stationQuery._networkCode)) {
      out.networkCode(stationQuery._networkCode);
    }

    if (isStringArg(stationQuery._stationCode)) {
      out.stationCode(stationQuery._stationCode);
    }

    if (isStringArg(stationQuery._locationCode)) {
      out.locationCode(stationQuery._locationCode);
    }

    if (isStringArg(stationQuery._channelCode)) {
      out.channelCode(stationQuery._channelCode);
    }

    if (isObject(stationQuery._startTime)) {
      out.startTime(stationQuery._startTime);
    }

    if (isObject(stationQuery._endTime)) {
      out.endTime(stationQuery._endTime);
    }

    if (isObject(stationQuery._startBefore)) {
      out.startBefore(stationQuery._startBefore);
    }

    if (isObject(stationQuery._startAfter)) {
      out.startAfter(stationQuery._startAfter);
    }

    if (isObject(stationQuery._endBefore)) {
      out.endBefore(stationQuery._endBefore);
    }

    if (isObject(stationQuery._endAfter)) {
      out.endAfter(stationQuery._endAfter);
    }

    if (isNumArg(stationQuery._minLat)) {
      out.minLat(stationQuery._minLat);
    }

    if (isNumArg(stationQuery._maxLat)) {
      out.maxLat(stationQuery._maxLat);
    }

    if (isNumArg(stationQuery._minLon)) {
      out.minLon(stationQuery._minLon);
    }

    if (isNumArg(stationQuery._maxLon)) {
      out.maxLon(stationQuery._maxLon);
    }

    if (isNumArg(stationQuery._latitude)) {
      out.latitude(stationQuery._latitude);
    }

    if (isNumArg(stationQuery._longitude)) {
      out.longitude(stationQuery._longitude);
    }

    if (isNumArg(stationQuery._minRadius)) {
      out.minRadius(stationQuery._minRadius);
    }

    if (isNumArg(stationQuery._maxRadius)) {
      out.maxRadius(stationQuery._maxRadius);
    }

    if (isDef(stationQuery._includeRestricted)) {
      out.includeRestricted(stationQuery._includeRestricted);
    }

    if (isDef(stationQuery._includeAvailability)) {
      out.includeAvailability(stationQuery._includeAvailability);
    }

    if (isObject(stationQuery._updatedAfter)) {
      out.updatedAfter(stationQuery._updatedAfter);
    }

    if (isDef(stationQuery._matchTimeseries)) {
      out.matchTimeseries(stationQuery._matchTimeseries);
    }

    return out;
  }

  /**
   * Gets/Sets the version of the fdsnws spec, 1 is currently the only value.
   *  Setting this is probably a bad idea as the code may not be compatible with
   *  the web service.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  specVersion(value?: string): FedCatalogQuery {
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
  protocol(value?: string): FedCatalogQuery {
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
  host(value?: string): FedCatalogQuery {
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
  port(value?: number): FedCatalogQuery {
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
  nodata(value?: number): FedCatalogQuery {
    doIntGetterSetter(this, "nodata", value);
    return this;
  }

  getNodata(): number | undefined {
    return this._nodata;
  }

  /**
   * Get/Set the targetservice query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  targetService(value?: string): FedCatalogQuery {
    doStringGetterSetter(this, "targetService", value);
    return this;
  }

  getTargetService(): string | undefined {
    return this._targetService;
  }

  /**
   * Get/Set the network query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  networkCode(value?: string): FedCatalogQuery {
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
  stationCode(value?: string): FedCatalogQuery {
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
  locationCode(value?: string): FedCatalogQuery {
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
  channelCode(value?: string): FedCatalogQuery {
    doStringGetterSetter(this, "channelCode", value);
    return this;
  }

  getChannelCode(): string | undefined {
    return this._channelCode;
  }

  nslcCodes(channelId: NslcId): FedCatalogQuery {
    this.networkCode(channelId.networkCode);
    this.stationCode(channelId.stationCode);
    this.locationCode(channelId.locationCode);
    this.channelCode(channelId.channelCode);
    return this;
  }

  /**
   * Get/Set the starttime query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  startTime(value?: DateTime | string): FedCatalogQuery {
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
  endTime(value?: DateTime | string): FedCatalogQuery {
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
  timeRange(se: Interval): FedCatalogQuery {
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
  startBefore(value?: DateTime | string): FedCatalogQuery {
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
  endBefore(value?: DateTime | string): FedCatalogQuery {
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
  startAfter(value?: DateTime | string): FedCatalogQuery {
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
  endAfter(value?: DateTime | string): FedCatalogQuery {
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
  minLat(value?: number): FedCatalogQuery {
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
  maxLat(value?: number): FedCatalogQuery {
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
  minLon(value?: number): FedCatalogQuery {
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
  maxLon(value?: number): FedCatalogQuery {
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
  latitude(value?: number): FedCatalogQuery {
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
  longitude(value?: number): FedCatalogQuery {
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
  minRadius(value?: number): FedCatalogQuery {
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
  maxRadius(value?: number): FedCatalogQuery {
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
  includeRestricted(value?: boolean): FedCatalogQuery {
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
  includeAvailability(value?: boolean): FedCatalogQuery {
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
  format(value?: string): FedCatalogQuery {
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
  updatedAfter(value?: DateTime): FedCatalogQuery {
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
  matchTimeseries(value?: boolean): FedCatalogQuery {
    doBoolGetterSetter(this, "matchTimeseries", value);
    return this;
  }

  getMatchTimeseries(): boolean | undefined {
    return this._matchTimeseries;
  }

  /**
   * Get/Set the timeout in seconds for the request. Default is 30.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  timeout(value?: number): FedCatalogQuery {
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
      (isDef(this._networkCode) &&
        this._networkCode.length > 0 &&
        this._networkCode !== "*") ||
      (isDef(this._stationCode) &&
        this._stationCode.length > 0 &&
        this._stationCode !== "*") ||
      (isDef(this._locationCode) &&
        this._locationCode.length > 0 &&
        this._locationCode !== "*") ||
      (isDef(this._channelCode) &&
        this._channelCode.length > 0 &&
        this._channelCode !== "*") ||
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
    return this.setupQueryFdsnStation(level)
      .then((fedCatalogResult) => {
        return Promise.all(
          fedCatalogResult.queries.map((query) => query.queryNetworkList()),
        );
      })
      .then((netArrayArray) => {
        const out: Array<Network> = [];
        netArrayArray.forEach((netArray) => {
          netArray.forEach((net) => {
            out.push(net);
          });
        });
        return out;
      });
  }

  setupQueryFdsnStation(level: string): Promise<FedCatalogResult> {
    if (!LEVELS.includes(level)) {
      throw new Error("Unknown level: '" + level + "'");
    }

    this._level = level;
    this.targetService("station");
    return this.queryRaw().then(function (fedCatalogResult) {
      for (const r of fedCatalogResult.queries) {
        const stationQuery = new StationQuery();
        r.stationQuery = stationQuery;
        fedCatalogResult.params.forEach((v, k) => {
          const field = `_${k}`;
          if (field === "_level") {
            // skip, level handled separately
          } else if (field in stationQuery) {
            // @ts-expect-error reflection on class breaks typescript
            stationQuery[field] = v;
          } else {
            throw new Error(
              `field ${field} does not exist in StationQuery class`,
            );
          }
        });

        if (
          !r.services.has("STATIONSERVICE") ||
          !isDef(r.services.get("STATIONSERVICE"))
        ) {
          throw new Error(
            "QueryResult does not have STATIONSERVICE in services",
          );
        }

        const urlString = r.services.get("STATIONSERVICE");

        if (isDef(urlString)) {
          const serviceURL = new URL(urlString);
          stationQuery.host(serviceURL.hostname);

          if (serviceURL.port) {
            stationQuery.port(parseInt(serviceURL.port));
          }
        } else {
          throw new Error(
            "QueryResult does have STATIONSERVICE in services, but is undef",
          );
        }
      }

      return fedCatalogResult;
    });
  }

  /**
   * For each item in a parsed result returned from a FedCat service, create a
   * DataSelectQuery with host and port, or url filled in correctly, ready to
   * be called with the result lines.
   *
   * @param   fedCatalogResult result from a FedCat web service
   * @returns               result with dataSelectQuery added to each item
   */
  setupForFdnsDataSelect(fedCatalogResult: FedCatalogResult): FedCatalogResult {
    for (const r of fedCatalogResult.queries) {
      const dataSelectQuery = new DataSelectQuery();
      r.dataSelectQuery = dataSelectQuery;
      fedCatalogResult.params.forEach((k, v) => {
        const field = `_${k}`;
        if (field in dataSelectQuery) {
          // @ts-expect-error reflection on class breaks typescript
          dataSelectQuery[field] = v;
        } else {
          throw new Error(
            `field ${field} does not exist in DataSelectQuery class`,
          );
        }
      });

      if (!r.services.has("DATASELECTSERVICE")) {
        throw new Error(
          "QueryResult does not have DATASELECTSERVICE in services",
        );
      }

      const urlString = r.services.get("DATASELECTSERVICE");

      if (isDef(urlString)) {
        const serviceURL = new URL(urlString);
        dataSelectQuery.host(serviceURL.hostname);

        if (serviceURL.port) {
          dataSelectQuery.port(parseInt(serviceURL.port));
        }
      } else {
        throw new Error(
          "QueryResult does have DATASELECTSERVICE in services, but is undef",
        );
      }
    }

    return fedCatalogResult;
  }

  queryFdsnDataselect(): Promise<Array<SeismogramDisplayData>> {
    this.targetService(TARGET_DATASELECT);
    return this.queryRaw()
      .then((fedCatalogResult) => {
        return this.setupForFdnsDataSelect(fedCatalogResult);
      })
      .then((fedCatalogResult) => {
        return this.postFdsnDataselectForFedCatResult(fedCatalogResult);
      });
  }

  postFdsnDataselectForFedCatResult(
    fedCatalogResult: FedCatalogResult,
  ): Promise<Array<SeismogramDisplayData>> {
    return Promise.all(
      fedCatalogResult.queries.map((query) => query.querySDDList()),
    ).then((sddArrayArray) => {
      const out: Array<SeismogramDisplayData> = [];
      sddArrayArray.forEach((sddArray) => {
        sddArray.forEach((sdd) => {
          out.push(sdd);
        });
      });
      return out;
    });
  }

  /**
   * query the fed cat server for dataselect using post, which allows for multiple
   * channel-timeranges at once. This assumes that there are not multiple
   * time ranges for the same channel as the results, encapsulated as
   * SeismogramDisplayData objects, are returned one seismogram
   * per channel, which may contain gaps. The original channel and timerange are
   * also populated with each result.
   *
   * @param   sddList array of SeismogramDisplayData objects
   * that will be filled in with the resulting seismogram
   * @returns Promise to the input Array of SeismogramDisplayData objects, each with the
   * seismogram containing the data returned from the server
   */
  postQuerySeismograms(
    sddList: Array<SeismogramDisplayData>,
  ): Promise<Array<SeismogramDisplayData>> {
    return this.postQueryRaw(sddList, TARGET_DATASELECT)
      .then((fedCatalogResult: FedCatalogResult) => {
        this.setupForFdnsDataSelect(fedCatalogResult);
        return this.postFdsnDataselectForFedCatResult(fedCatalogResult);
      })
      .then((sddResultArray: Array<SeismogramDisplayData>) => {
        for (const sdd of sddList) {
          const codes = sdd.codes();
          const matchSdd = sddResultArray.find(
            (s) => s.codes() === codes && s.timeRange.overlaps(sdd.timeRange),
          );

          if (matchSdd) {
            // copy seismogram from remote service into original sdd
            // that requested it
            sdd.seismogram = matchSdd.seismogram;
          }
        }

        return sddList;
      });
  }

  postQueryRaw(
    sddList: Array<SeismogramDisplayData>,
    targetService: string,
  ): Promise<FedCatalogResult> {
    if (sddList.length === 0) {
      // return promise faking an empty response
      return Promise.resolve(this.parseRequest(FAKE_EMPTY_TEXT));
    } else {
      const body =
        `targetservice=${targetService}\n` +
        DataSelectQuery.createPostBody(sddList);
      return this.postQueryRawWithBody(body);
    }
  }

  postQueryRawWithBody(body: string): Promise<FedCatalogResult> {
    const fetchInit = defaultFetchInitObj(TEXT_MIME);
    fetchInit.method = "POST";
    fetchInit.body = body;
    return doFetchWithTimeout(
      this.formPostURL(),
      fetchInit,
      this._timeoutSec * 1000,
    )
      .then((response) => {
        return this.handleHttpResponseCodes(response);
      })
      .then((rawText) => {
        return this.parseRequest(rawText);
      });
  }

  /**
   * Queries the remote web service.
   *
   * @returns a Promise to an parsed result.
   */
  queryRaw(): Promise<FedCatalogResult> {
    if (!this.isSomeParameterSet()) {
      throw new Error(
        "Must set some parameter to avoid asking for everything.",
      );
    }

    const url = this.formURL();
    const fetchInit = defaultFetchInitObj(TEXT_MIME);
    this.fedCatResult = doFetchWithTimeout(
      url,
      fetchInit,
      this._timeoutSec * 1000,
    )
      .then((response) => {
        return this.handleHttpResponseCodes(response);
      })
      .then((rawText) => {
        return this.parseRequest(rawText);
      });
    return this.fedCatResult;
  }

  handleHttpResponseCodes(response: Response): Promise<string> {
    if (response.status === 200) {
      return response.text();
    } else if (
      response.status === 204 ||
      (isDef(this._nodata) && response.status === this._nodata)
    ) {
      // 204 is nodata, so successful but empty
      return Promise.resolve(FAKE_EMPTY_TEXT);
    } else {
      throw new Error(`Status not successful: ${response.status}`);
    }
  }

  parseRequest(requestText: string): FedCatalogResult {
    const out = new FedCatalogResult();
    const lines = requestText.split("\n");
    let inParams = true;
    let query = null;

    for (let l of lines) {
      l = l.trim();

      if (inParams) {
        if (l.length === 0) {
          //empty line, end of section
          inParams = false;
        } else {
          const keyval = l.split("=");
          out.params.set(keyval[0], keyval[1]);
        }
      } else {
        if (l.length === 0) {
          // empty line, end of section
          query = null;
        } else {
          if (query === null) {
            // first line of next response section
            query = new FedCatalogDataCenter();
            if (this._level) {
              // in case FDSNStation query
              query.level = this._level;
            }
            out.queries.push(query);
          }

          if (l.indexOf("=") !== -1) {
            const keyval = l.split("=");

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
      (response) => {
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
      "/irisws/fedcatalog/" +
      this._specVersion
    );
  }

  /**
   * Form URL to post the remote web service. No parameters are added
   * to the URL as those will be in the body of the post.
   *
   * @returns the URL for posting
   */
  formPostURL(): string {
    return this.formBaseURL() + "/query";
  }

  /**
   * Form URL to query the remote web service, encoding the query parameters.
   *
   * @returns url
   */
  formURL(): string {
    let url = this.formBaseURL() + "/query?";

    if (isStringArg(this._level)) {
      url = url + makeParam("level", this._level);
    }

    if (isStringArg(this._targetService)) {
      url = url + makeParam("targetservice", this._targetService);
    }

    if (
      isStringArg(this._networkCode) &&
      this._networkCode.length > 0 &&
      this._networkCode !== "*"
    ) {
      url = url + makeParam("net", this._networkCode);
    } else {
      // this is dumb, just to workaround a bug with IRIS fedcat server requiring one
      // of net, sta, loc, chan, but net=* seems to satisfy this
      url = url + makeParam("net", "*");
    }

    if (
      isStringArg(this._stationCode) &&
      this._stationCode.length > 0 &&
      this._stationCode !== "*"
    ) {
      url = url + makeParam("sta", this._stationCode);
    }

    if (
      isStringArg(this._locationCode) &&
      this._locationCode.length > 0 &&
      this._locationCode !== "*"
    ) {
      url = url + makeParam("loc", this._locationCode);
    }

    if (
      isStringArg(this._channelCode) &&
      this._channelCode.length > 0 &&
      this._channelCode !== "*"
    ) {
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
