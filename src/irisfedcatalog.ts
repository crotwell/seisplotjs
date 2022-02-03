/*
 * Philip Crotwell
 * University of South Carolina, 2020
 * http://www.seis.sc.edu
 */
import {Network} from "./stationxml";
import {
  LEVELS,
  LEVEL_NETWORK,
  LEVEL_STATION,
  LEVEL_CHANNEL,
  LEVEL_RESPONSE,
  StationQuery,
} from "./fdsnstation";
import {DataSelectQuery} from "./fdsndataselect";
import {SeismogramDisplayData} from "./seismogram";
import {
  TEXT_MIME,
  StartEndDuration,
  makeParam,
  doFetchWithTimeout,
  defaultFetchInitObj,
  stringify,
} from "./util";
// special due to flow
import {
  doStringGetterSetter,
  doBoolGetterSetter,
  doIntGetterSetter,
  doFloatGetterSetter,
  doMomentGetterSetter,
  checkProtocol,
  toIsoWoZ,
  isDef,
  hasArgs,
  hasNoArgs,
  isObject,
  isStringArg,
  isNonEmptyStringArg,
  isNumArg,
} from "./util";
import moment from "moment";
import RSVP from "rsvp";

/**
 * Major version of the IRIS web service supported here.
 * Currently is 1.
 */
export const SERVICE_VERSION = 1;

/**
 * Service name as used in the FDSN DataCenters registry,
 * http://www.fdsn.org/datacenters
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
  networkList: Promise<Array<Network>> | null;
  sddList: Promise<Array<SeismogramDisplayData>> | null;

  constructor() {
    this.dataCenter = "";
    this.stationService = "";
    this.dataSelectService = "";
    this.postLines = [];
    this.services = new Map();
    this.stationQuery = null;
    this.dataSelectQuery = null;
    this.networkList = null;
    this.sddList = null;
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
 * @see http://service.iris.edu/irisws/fedcatalog/1/
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
  _nodata: number|undefined;

  /** @private */
  _targetService: string|undefined;

  /** @private */
  _level: string|undefined;

  /** @private */
  _networkCode: string|undefined;

  /** @private */
  _stationCode: string|undefined;

  /** @private */
  _locationCode: string|undefined;

  /** @private */
  _channelCode: string|undefined;

  /** @private */
  _startTime: moment.Moment|undefined;

  /** @private */
  _endTime: moment.Moment|undefined;

  /** @private */
  _startBefore: moment.Moment|undefined;

  /** @private */
  _endBefore: moment.Moment|undefined;

  /** @private */
  _startAfter: moment.Moment|undefined;

  /** @private */
  _endAfter: moment.Moment|undefined;

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
  _updatedAfter: moment.Moment|undefined;

  /** @private */
  _matchTimeseries: boolean|undefined;

  /** @private */
  _timeoutSec: number;
  fedCatResult: Promise<FedCatalogResult> | null;

  /**
   * Construct a query
   *
   * @param host the host to connect to , defaults to service.iris.edu
   */
  constructor(host?: string) {
    this._specVersion = 1;
    this._protocol = checkProtocol();

    this._host = IRIS_HOST;
    if (isNonEmptyStringArg(host)) {
      this.host(host);
    }

    this._port = 80;
    this._timeoutSec = 30;
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
        "1st arg must be a StationQuery: " +
          stringify(stationQuery),
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
  specVersion(value?: number): number | FedCatalogQuery {
    return doIntGetterSetter(this, "specVersion", value);
  }

  /**
   * Gets/Sets the protocol, http or https. This should match the protocol
   *  of the page loaded, but is autocalculated and generally need not be set.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  protocol(value?: string): string | FedCatalogQuery {
    return doStringGetterSetter(this, "protocol", value);
  }

  /**
   * Gets/Sets the remote host to connect to.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  host(value?: string): string | FedCatalogQuery {
    return doStringGetterSetter(this, "host", value);
  }

  /**
   * Gets/Sets the remote port to connect to.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  port(value?: number): number | FedCatalogQuery {
    return doIntGetterSetter(this, "port", value);
  }

  /**
   * Gets/Sets the nodata parameter, usually 404 or 204 (default), controlling
   * the status code when no matching data is found by the service.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  nodata(value?: number): number | FedCatalogQuery {
    return doIntGetterSetter(this, "nodata", value);
  }

  /**
   * Get/Set the targetservice query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  targetService(value?: string): string | FedCatalogQuery {
    return doStringGetterSetter(this, "targetService", value);
  }

  /**
   * Get/Set the network query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  networkCode(value?: string): string | FedCatalogQuery {
    return doStringGetterSetter(this, "networkCode", value);
  }

  /**
   * Get/Set the station query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  stationCode(value?: string): string | FedCatalogQuery {
    return doStringGetterSetter(this, "stationCode", value);
  }

  /**
   * Get/Set the location code query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  locationCode(value?: string): string | FedCatalogQuery {
    return doStringGetterSetter(this, "locationCode", value);
  }

  /**
   * Get/Set the channel query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  channelCode(value?: string): string | FedCatalogQuery {
    return doStringGetterSetter(this, "channelCode", value);
  }

  /**
   * Get/Set the starttime query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  startTime(value?: moment.Moment): moment.Moment | FedCatalogQuery {
    return doMomentGetterSetter(this, "startTime", value);
  }

  /**
   * Get/Set the endtime query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  endTime(value?: moment.Moment): moment.Moment | FedCatalogQuery {
    return doMomentGetterSetter(this, "endTime", value);
  }

  /**
   * Sets startTime and endTime using the given time window
   *
   * @param   se time window
   * @returns     this
   */
  timeWindow(se: StartEndDuration): FedCatalogQuery {
    this.startTime(se.startTime);
    this.endTime(se.endTime);
    return this;
  }

  /**
   * Get/Set the startbefore query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  startBefore(value?: moment.Moment): moment.Moment | FedCatalogQuery {
    return doMomentGetterSetter(this, "startBefore", value);
  }

  /**
   * Get/Set the endbefore query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  endBefore(value?: moment.Moment): moment.Moment | FedCatalogQuery {
    return doMomentGetterSetter(this, "endBefore", value);
  }

  /**
   * Get/Set the startafter query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  startAfter(value?: moment.Moment): moment.Moment | FedCatalogQuery {
    return doMomentGetterSetter(this, "startAfter", value);
  }

  /**
   * Get/Set the endafter query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  endAfter(value?: moment.Moment): moment.Moment | FedCatalogQuery {
    return doMomentGetterSetter(this, "endAfter", value);
  }

  /**
   * Get/Set the minlat query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  minLat(value?: number): number | FedCatalogQuery {
    return doFloatGetterSetter(this, "minLat", value);
  }

  /**
   * Get/Set the maxlon query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  maxLat(value?: number): number | FedCatalogQuery {
    return doFloatGetterSetter(this, "maxLat", value);
  }

  /**
   * Get/Set the minlon query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  minLon(value?: number): number | FedCatalogQuery {
    return doFloatGetterSetter(this, "minLon", value);
  }

  /**
   * Get/Set the maxlon query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  maxLon(value?: number): number | FedCatalogQuery {
    return doFloatGetterSetter(this, "maxLon", value);
  }

  /**
   * Get/Set the latitude query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  latitude(value?: number): number | FedCatalogQuery {
    return doFloatGetterSetter(this, "latitude", value);
  }

  /**
   * Get/Set the longitude query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  longitude(value?: number): number | FedCatalogQuery {
    return doFloatGetterSetter(this, "longitude", value);
  }

  /**
   * Get/Set the minradius query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  minRadius(value?: number): number | FedCatalogQuery {
    return doFloatGetterSetter(this, "minRadius", value);
  }

  /**
   * Get/Set the maxradius query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  maxRadius(value?: number): number | FedCatalogQuery {
    return doFloatGetterSetter(this, "maxRadius", value);
  }

  /**
   * Get/Set the includerestricted query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  includeRestricted(value?: boolean): boolean | FedCatalogQuery {
    return doBoolGetterSetter(this, "includeRestricted", value);
  }

  /**
   * Get/Set the includeavailability query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  includeAvailability(value?: boolean): boolean | FedCatalogQuery {
    return doBoolGetterSetter(this, "includeAvailability", value);
  }

  /**
   * Get/Set the format query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  format(value?: string): string | FedCatalogQuery {
    return doStringGetterSetter(this, "format", value);
  }

  /**
   * Get/Set the updatedafter query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  updatedAfter(value?: moment.Moment): moment.Moment | FedCatalogQuery {
    return doMomentGetterSetter(this, "updatedAfter", value);
  }

  /**
   * Get/Set the matchtimeseries query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  matchTimeseries(value?: boolean): boolean | FedCatalogQuery {
    return doBoolGetterSetter(this, "matchTimeseries", value);
  }

  /**
   * Get/Set the timeout in seconds for the request. Default is 30.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  timeout(value?: number): number | FedCatalogQuery {
    return doFloatGetterSetter(this, "timeoutSec", value);
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
      isDef(this._networkCode) ||
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
      .then(fedCatalogResult => {
        return RSVP.all(
          fedCatalogResult.queries.map(query => {
            if (isDef(query.stationQuery)) {
              query.networkList = query.stationQuery.postQuery(
                level,
                query.postLines,
              );
              return query.networkList;
            } else {
              // could return [];
              throw new Error("stationQuery missing");
            }
          }),
        );
      })
      .then(netArrayArray => {
        let out: Array<Network> = [];
        netArrayArray.forEach(netArray => {
          netArray.forEach(net => {
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
      for (let r of fedCatalogResult.queries) {
        const stationQuery = new StationQuery();
        r.stationQuery = stationQuery;
        fedCatalogResult.params.forEach((v, k) => {
          const field = `_${k}`;
          // @ts-ignore
          stationQuery[field] = v;
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
    for (let r of fedCatalogResult.queries) {
      const dataSelectQuery = new DataSelectQuery();
      r.dataSelectQuery = dataSelectQuery;
      fedCatalogResult.params.forEach((k, v) => {
        const field = `_${k}`;
        // @ts-ignore
        dataSelectQuery[field] = v;
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
    const mythis = this;
    this.targetService(TARGET_DATASELECT);
    return this.queryRaw()
      .then(fedCatalogResult => {
        return mythis.setupForFdnsDataSelect(fedCatalogResult);
      })
      .then(fedCatalogResult => {
        return mythis.postFdsnDataselectForFedCatResult(fedCatalogResult);
      });
  }

  postFdsnDataselectForFedCatResult(
    fedCatalogResult: FedCatalogResult,
  ): Promise<Array<SeismogramDisplayData>> {
    return RSVP.all(
      fedCatalogResult.queries.map(query => {
        let sddList = query.postLines.map(line => {
          const items = line.split(" ");
          const start = moment.utc(items[4]);
          const end = moment.utc(items[5]);
          return SeismogramDisplayData.fromCodesAndTimes(
            items[0],
            items[1],
            items[2],
            items[3],
            start,
            end,
          );
        });

        if (isDef(query.dataSelectQuery)) {
          query.sddList = query.dataSelectQuery.postQuerySeismograms(sddList);
          return query.sddList;
        } else {
          // could return [];
          throw new Error("dataSelectQuery missing");
        }
      }),
    ).then(sddArrayArray => {
      let out: Array<SeismogramDisplayData> = [];
      sddArrayArray.forEach(sddArray => {
        sddArray.forEach(sdd => {
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
        for (let sdd of sddList) {
          let codes = sdd.codes();
          let matchSdd = sddResultArray.find(
            s => s.codes() === codes && s.timeWindow.overlaps(sdd.timeWindow),
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
      return RSVP.hash(this.parseRequest(FAKE_EMPTY_TEXT));
    } else {
      let body =
        `targetservice=${targetService}\n` +
        DataSelectQuery.createPostBody(sddList);
      return this.postQueryRawWithBody(body);
    }
  }

  postQueryRawWithBody(body: string): Promise<FedCatalogResult> {
    const mythis = this;
    const fetchInit = defaultFetchInitObj(TEXT_MIME);
    fetchInit.method = "POST";
    fetchInit.body = body;
    return doFetchWithTimeout(
      this.formURL(),
      fetchInit,
      this._timeoutSec * 1000,
    )
      .then(response => {
        return this.handleHttpResponseCodes(response);
      })
      .then(rawText => {
        return mythis.parseRequest(rawText);
      });
  }

  /**
   * Queries the remote web service.
   *
   * @returns a Promise to an parsed result.
   */
  queryRaw(): Promise<FedCatalogResult> {
    const mythis = this;
    const url = this.formURL();
    const fetchInit = defaultFetchInitObj(TEXT_MIME);
    this.fedCatResult = doFetchWithTimeout(
      url,
      fetchInit,
      this._timeoutSec * 1000,
    )
      .then(response => {
        return this.handleHttpResponseCodes(response);
      })
      .then(function (rawText) {
        return mythis.parseRequest(rawText);
      });
    return this.fedCatResult;
  }

  handleHttpResponseCodes(response: Response): Promise<string> {
    if (response.status === 200) {
      return response.text();
    } else if (
      response.status === 204 ||
      (isDef(this._nodata) && response.status === this.nodata())
    ) {
      // 204 is nodata, so successful but empty
      return Promise.resolve(FAKE_EMPTY_TEXT);
    } else {
      throw new Error(`Status not successful: ${response.status}`);
    }
  }

  parseRequest(requestText: string): FedCatalogResult {
    let out = new FedCatalogResult();
    let lines = requestText.split("\n");
    let inParams = true;
    let query = null;

    for (let l of lines) {
      l = l.trim();

      if (inParams) {
        if (l.length === 0) {
          //empty line, end of section
          inParams = false;
        } else {
          let keyval = l.split("=");
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
  formVersionURL(): string {
    return this.formBaseURL() + "/version";
  }

  /**
   * Queries the remote web service to get its version
   *
   * @returns Promise to version string
   */
  queryVersion(): Promise<string> {
    let url = this.formVersionURL();
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
      (this._port === 80 ? "" : ":" + this._port) +
      "/irisws/fedcatalog/" +
      this._specVersion
    );
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
      url = url + makeParam("targetservice", this.targetService());
    }

    if (isStringArg(this._networkCode)) {
      url = url + makeParam("net", this.networkCode());
    } else {
      // this is dumb, just to workaround a bug with IRIS fedcat server requiring one
      // of net, sta, loc, chan, but net=* seems to satisfy this
      url = url + makeParam("net", "*");
    }

    if (isStringArg(this._stationCode)) {
      url = url + makeParam("sta", this.stationCode());
    }

    if (isStringArg(this._locationCode)) {
      url = url + makeParam("loc", this.locationCode());
    }

    if (isStringArg(this._channelCode)) {
      url = url + makeParam("cha", this.channelCode());
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
      url = url + makeParam("minlat", this.minLat());
    }

    if (isNumArg(this._maxLat)) {
      url = url + makeParam("maxlat", this.maxLat());
    }

    if (isNumArg(this._minLon)) {
      url = url + makeParam("minlon", this.minLon());
    }

    if (isNumArg(this._maxLon)) {
      url = url + makeParam("maxlon", this.maxLon());
    }

    if (isNumArg(this._latitude)) {
      url = url + makeParam("lat", this.latitude());
    }

    if (isNumArg(this._longitude)) {
      url = url + makeParam("lon", this.longitude());
    }

    if (isNumArg(this._minRadius)) {
      url = url + makeParam("minradius", this.minRadius());
    }

    if (isNumArg(this._maxRadius)) {
      url = url + makeParam("maxradius", this.maxRadius());
    }

    if (isDef(this._includeRestricted)) {
      url = url + makeParam("includerestricted", this.includeRestricted());
    }

    if (isDef(this._includeAvailability)) {
      url = url + makeParam("includeavailability", this.includeAvailability());
    }

    if (isObject(this._updatedAfter)) {
      url = url + makeParam("updatedafter", toIsoWoZ(this._updatedAfter));
    }

    if (isDef(this._matchTimeseries)) {
      url = url + makeParam("matchtimeseries", this.matchTimeseries());
    }

    if (isStringArg(this._format)) {
      url = url + makeParam("format", this.format());
    }

    if (isNumArg(this._nodata)) {
      url = url + makeParam("nodata", this.nodata());
    }

    if (url.endsWith("&") || url.endsWith("?")) {
      url = url.substr(0, url.length - 1); // zap last & or ?
    }

    return url;
  }
}
