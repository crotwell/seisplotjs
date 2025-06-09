/*
 * Philip Crotwell
 * University of South Carolina, 2025
 * https://www.seis.sc.edu
 */
import { FDSNCommon, IRIS_HOST, IRISWS_PATH_BASE } from "./fdsncommon";
import { FORMAT_MINISEED } from "./fdsndataselect";
import { TESTING_NETWORK } from "./fdsnsourceid";
import { Quake } from "./quakeml";
import { Channel } from "./stationxml";
import { DateTime } from "luxon";
import * as miniseed from "./miniseed";
import * as mseed3 from "./mseed3";
import { SeismogramDisplayData } from "./seismogram";
import {
  doStringGetterSetter,
  doIntGetterSetter,
  doFloatGetterSetter,
  doMomentGetterSetter,
  isDef,
  isNumArg,
  isObject,
  isStringArg,
  toIsoWoZ,
  isNonEmptyStringArg,
  makeParam,
  doFetchWithTimeout,
  defaultFetchInitObj,
  TEXT_MIME
} from "./util";

/** const for service name */
export const SYNGINE_SERVICE = "syngine";

/**
 * Major version of the FDSN spec supported here.
 * Currently is 1.
 */
export const SERVICE_VERSION = 1;

/**
 * Service name as used in the FDSN DataCenters registry,
 * https://www.fdsn.org/datacenters
 */
export const SERVICE_NAME = `irisws-${SYNGINE_SERVICE}-${SERVICE_VERSION}`;

export function calcMoment(Mw: number): number {
  return 10.0 ** ((Mw / 2.0 * 3.0 + 9.1));
}

/**
 * Query to a syngine web service.
 *
 * @see https://service.iris.edu/irisws/syngine/1/
 * @param host optional host to connect to, defaults to IRIS
 */
export class SyngineQuery extends FDSNCommon {

  /** @private */
  _model: string | undefined;

  /** @private */
  _label: string | undefined;

  /** @private */
  _components: string | undefined;

  /** @private */
  _units: string | undefined;

  /** @private */
  _dt: number | undefined;

  /** @private */
  _scale: number | undefined;

  /** @private */
  _kernelwidth: number | undefined;

  /** @private */
  _sourcewidth: number | undefined;

  /** @private */
  _originTime: DateTime | undefined;

  /** @private */
  _startTime: DateTime | undefined;

  /** @private */
  _endTime: DateTime | undefined;

  /** @private */
  _receiverlatitude: number | undefined;

  /** @private */
  _receiverlongitude: number | undefined;

  /** @private */
  _network: string | undefined;

  /** @private */
  _station: string | undefined;

  /** @private */
  _networkCode: string | undefined;

  /** @private */
  _stationCode: string | undefined;

  /** @private */
  _locationCode: string | undefined;

  _channel: Channel | undefined;
  // source-options

  /** @private */
  _eventid: string | undefined;

  /** @private */
  _quake: Quake | undefined;

  /** @private */
  _sourcelatitude: number | undefined;

  /** @private */
  _sourcelongitude: number | undefined;

  /** @private */
  _sourcedepthinmeters : number | undefined;

  /** @private */
  _sourcedistanceindegrees : number | undefined;

  /** @private */
  _greensfunction : boolean | undefined;

  /** @private */
  _sourcemomenttensor: Array<number> | undefined;

  /** @private */
  _sourcedoublecouple: Array<number> | undefined;

  /** @private */
  _sourceforce: Array<number> | undefined;

  // USGS Finite Fault Model
  // Todo

  // Custom Source Time Function
  // Todo

  /** @private */
  _format: string | undefined;

  constructor(host?: string) {
    if (!isNonEmptyStringArg(host)) {
      host = IRIS_HOST;
    }
    super(SYNGINE_SERVICE, host);
    this._path_base = IRISWS_PATH_BASE;
  }


  /**
   * Gets/Sets the version of the syngine spec, 1 is currently the only value.
   *  Setting this is probably a bad idea as the code may not be compatible with
   *  the web service.
   *
   * @param value spec version, usually 1
   * @returns new value if getting, this if setting
   */
  specVersion(value?: string): SyngineQuery {
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
  protocol(value?: string): SyngineQuery {
    doStringGetterSetter(this, "protocol", value);
    return this;
  }

  getProtocol(): string {
    return this._protocol;
  }

  /**
   * Gets/Sets the remote host to connect to.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  host(value?: string): SyngineQuery {
    doStringGetterSetter(this, "host", value);
    return this;
  }

  getHost(): string {
    return this._host;
  }

  /**
   * Gets/Sets the nodata parameter, usually 404 or 204 (default), controlling
   * the status code when no matching data is found by the service.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  nodata(value?: number): SyngineQuery {
    doIntGetterSetter(this, "nodata", value);
    return this;
  }

  getNodata(): number | undefined {
    return this._nodata;
  }

  /**
   * Gets/Sets the remote port to connect to.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  port(value?: number): SyngineQuery {
    doIntGetterSetter(this, "port", value);
    return this;
  }

  getPort(): number | undefined {
    return this._port;
  }

  pathBase(value?: string): SyngineQuery {
    doStringGetterSetter(this, "path_base", value);
    return this;
  }

  getPathBase(): string {
    return this._path_base;
  }

  format(value?: string): SyngineQuery {
    doStringGetterSetter(this, "format", value);
    return this;
  }

  getFormat(): string | undefined {
    return this._label;
  }


  /**
   * Get/Set the model query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  model(value?: string): SyngineQuery {
    doStringGetterSetter(this, "model", value);
    return this;
  }

  getModel(): string | undefined {
    return this._model;
  }

  /**
   * Get/Set the label query parameter, used for file names.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  label(value?: string): SyngineQuery {
    doStringGetterSetter(this, "label", value);
    return this;
  }

  getLabel(): string | undefined {
    return this._label;
  }

  /**
   * Get/Set the components query parameter, used for file names.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  components(value?: string): SyngineQuery {
    doStringGetterSetter(this, "components", value);
    return this;
  }

  getComponents(): string | undefined {
    return this._components;
  }

  /**
   * Get/Set the units query parameter, displacement, velocity or acceleration.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  units(value?: string): SyngineQuery {
    doStringGetterSetter(this, "units", value);
    return this;
  }

  getUnits(): string | undefined {
    return this._units;
  }

  /**
   * Gets/Sets the dt query parameter, for upsampling.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  dt(value?: number): SyngineQuery {
    doIntGetterSetter(this, "dt", value);
    return this;
  }

  getDt(): number | undefined {
    return this._dt;
  }

  /**
   * Gets/Sets the scale query parameter, for upsampling.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  scale(value?: number): SyngineQuery {
    doFloatGetterSetter(this, "scale", value);
    return this;
  }

  getscale(): number | undefined {
    return this._scale;
  }

  /**
   * Gets/Sets the kernelwidth query parameter, for upsampling.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  kernelWidth(value?: number): SyngineQuery {
    doFloatGetterSetter(this, "kernelwidth", value);
    return this;
  }

  getKernelWidth(): number | undefined {
    return this._kernelwidth;
  }

  /**
   * Gets/Sets the sourcewidth query parameter, for upsampling.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  sourceWidth(value?: number): SyngineQuery {
    doFloatGetterSetter(this, "sourcewidth", value);
    return this;
  }

  getSourceWidth(): number | undefined {
    return this._sourcewidth;
  }

  /**
   * Get/Set the origintime query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  originTime(value?: DateTime): SyngineQuery {
    doMomentGetterSetter(this, "originTime", value);
    return this;
  }

  getOriginTime(): DateTime | undefined {
    return this._originTime;
  }

  /**
   * Get/Set the starttime query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  startTime(value?: DateTime): SyngineQuery {
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
  endTime(value?: DateTime): SyngineQuery {
    doMomentGetterSetter(this, "endTime", value);
    return this;
  }

  getEndTime(): DateTime | undefined {
    return this._endTime;
  }

  /**
   * Get/Set the network query parameter, used for receiver location.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  network(value?: string): SyngineQuery {
    doStringGetterSetter(this, "network", value);
    return this;
  }

  getNetwork(): string | undefined {
    return this._network;
  }

  /**
   * Get/Set the station query parameter, used for receiver location.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  station(value?: string): SyngineQuery {
    doStringGetterSetter(this, "station", value);
    return this;
  }

  getStation(): string | undefined {
    return this._station;
  }

  /**
   * Get/Set the network query parameter, code used for synthetics.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  networkCode(value?: string): SyngineQuery {
    doStringGetterSetter(this, "networkCode", value);
    return this;
  }

  getNetworkCode(): string | undefined {
    return this._networkCode;
  }

  /**
   * Get/Set the station query parameter, code used for synthetics.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  stationCode(value?: string): SyngineQuery {
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
  locationCode(value?: string): SyngineQuery {
    doStringGetterSetter(this, "locationCode", value);
    return this;
  }

  getLocationCode(): string | undefined {
    return this._locationCode;
  }

  /**
   * Get/Set the receiverlatitude query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  receiverLatitude(value?: number): SyngineQuery {
    doFloatGetterSetter(this, "receiverlatitude", value);
    return this;
  }

  getReceiverLatitude(): number | undefined {
    return this._receiverlatitude;
  }

  /**
   * Get/Set the receiverlongitude query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  receiverLongitude(value?: number): SyngineQuery {
    doFloatGetterSetter(this, "receiverlongitude", value);
    return this;
  }

  getReceiverLongitude(): number | undefined {
    return this._receiverlongitude;
  }

  channel(chan: Channel): SyngineQuery {
    this._channel = chan;
    return this;
  }

  getChannel(): Channel | undefined {
    return this._channel;
  }

  /**
   * Get/Set the eventid query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  eventId(value?: string): SyngineQuery {
    doStringGetterSetter(this, "eventid", value);
    return this;
  }

  getEventId(): string | undefined {
    return this._eventid;
  }

  quake(quake: Quake): SyngineQuery {
    this._quake = quake;
    return this;
  }

  getQuake(): Quake | undefined {
    return this._quake;
  }

  /**
   * Get/Set the sourcelatitude query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  sourceLatitude(value?: number): SyngineQuery {
    doFloatGetterSetter(this, "sourcelatitude", value);
    return this;
  }

  getSourceLatitude(): number | undefined {
    return this._sourcelatitude;
  }

  /**
   * Get/Set the longitude query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  sourceLongitude(value?: number): SyngineQuery {
    doFloatGetterSetter(this, "sourcelongitude", value);
    return this;
  }

  getSourceLongitude(): number | undefined {
    return this._sourcelongitude;
  }

  /**
   * Get/Set the sourcedepthinmeters query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  sourceDepthInMeters(value?: number): SyngineQuery {
    doFloatGetterSetter(this, "sourcedepthinmeters", value);
    return this;
  }

  getSourceDepthInMeters(): number | undefined {
    return this._sourcedepthinmeters;
  }

  /**
   * Get/Set the sourcedistanceindegrees query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  sourceDistanceInDegrees(value?: number): SyngineQuery {
    doFloatGetterSetter(this, "sourcedistanceindegrees", value);
    return this;
  }

  getSourceDistanceInDegrees(): number | undefined {
    return this._sourcedistanceindegrees;
  }

  /**
   * Get/Set the sourcemomenttensorb query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  sourceMomentTensor(value?: Array<number>): SyngineQuery {
    if (value && value.length !== 6) {
      throw new Error(`Moment tensor must be 6 numbers, but given ${value.length}`);
    }
    this._sourcemomenttensor = value;
    return this;
  }

  getSourceMomentTensor(): Array<number> | undefined {
    return this._sourcemomenttensor;
  }


  /**
   * Get/Set the sourcedoublecouple query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  sourceDoubleCouple(value?: Array<number>): SyngineQuery {
    if (value && (value.length !== 3 && value.length !== 4)) {
      throw new Error(`Moment tensor must be 3-4 numbers, but given ${value.length}`);
    }
    this._sourcedoublecouple = value;
    return this;
  }


  getSourceDoubleCouple(): Array<number> | undefined {
    return this._sourcedoublecouple;
  }

  /**
   * Get/Set the sourceforce query parameter.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  sourceForce(value?: Array<number>): SyngineQuery {
    if (value && value.length !== 3) {
      throw new Error(`sourceforce must be 3 numbers, but given ${value.length}`);
    }
    this._sourceforce = value;
    return this;
  }

  getSsourceForce(): Array<number> | undefined {
    return this._sourceforce;
  }

  // USGS Finite Fault
  // Todo

  // Custom Source Time Function
  // Todo


  /**
   * queries the web service using the configured parameters, parsing the response
   * into miniseed data records.
   *
   * @returns Promise to Array of miniseed.DataRecords
   */
  queryDataRecords(): Promise<Array<miniseed.DataRecord>> {
    this.format(FORMAT_MINISEED);
    const url = this.formURL();
    const fetchInit = defaultFetchInitObj(miniseed.MINISEED_MIME);
    return doFetchWithTimeout(url, fetchInit, this._timeoutSec * 1000)
      .then((response) => {
        if (
          response.status === 204 ||
          (isDef(this._nodata) && response.status === this.getNodata())
        ) {
          // no data
          return new ArrayBuffer(0);
        } else {
          return response.arrayBuffer();
        }
      })
      .then(function (rawBuffer) {
        const dataRecords = miniseed.parseDataRecords(rawBuffer);
        for (const dr of dataRecords) {
          const ms2Data = dr.decompress();
          let max=0;
          for (let i=0; i<ms2Data.length; i++) {
            if (ms2Data[i] > max) { max = ms2Data[i];}
          }
        }
        return dataRecords;
      });
  }




  /**
   * queries the web service using the configured parameters, parsing the response
   * into miniseed2 data records, then convert to MSeed3Records populating
   * extra headers.
   *
   * @returns Promise to Array of mseed3.MSeed3Record
   */
  queryMS3Records(): Promise<Array<mseed3.MSeed3Record>> {
    return this.queryDataRecords().then(msList => {
      const ms3List = mseed3.convertMS2toMSeed3(msList);
      return ms3List;
    });
  }

  /**
   * queries the web service using the configured parameters, parsing the response
   * into miniseed data records and then combining the data records into
   * SeismogramDisplayData objects.
   *
   * @returns Promise to Array of SeismogramDisplayData objects
   */
  querySeismograms(): Promise<Array<SeismogramDisplayData>> {
    return this.queryMS3Records().then((dataRecords) => {
      const sddList = mseed3.sddPerChannel(dataRecords);
      const quake = this.getQuake();
      let yunit = "count";
      const queryUnits = this.getUnits();
      if (queryUnits === "displacement") {
        yunit = "m";
      } else if (queryUnits === "velocity") {
        yunit = "m/s";
      } else if (queryUnits === "acceleration") {
        yunit = "m/s2";
      }
      for (const sdd of sddList) {
        if (quake) {
          sdd.addQuake(quake);
        }
        const segments = sdd.seismogram?sdd.seismogram.segments:[]; // null check
        for (const seg of segments) {
          seg.yUnit = yunit;
        }
      }
      return sddList;
    });
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
    const port = (this._port === 80 ? "" : ":" + String(this._port));
    const path = `${this._path_base}/${this._service}/${this._specVersion}`;
    return `${this._protocol}${colon}//${this._host}${port}/${path}`;
  }

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


  formURL(): string {
    let url = this.formBaseURL() + "/query?";

    if (isStringArg(this._model) && this._model.length > 0 ) {
      url = url + makeParam("model", this._model);
    }
    if (isStringArg(this._label) && this._label.length > 0 ) {
      url = url + makeParam("label", this._label);
    }
    if (isStringArg(this._components) && this._components.length > 0 ) {
      url = url + makeParam("components", this._components);
    }
    if (isStringArg(this._units) && this._units.length > 0 ) {
      url = url + makeParam("units", this._units);
    }
    if (isNumArg(this._dt)) {
      url = url + makeParam("dt", this._dt);
    }
    if (isNumArg(this._scale)) {
      url = url + makeParam("scale", this._scale);
    }
    if (isNumArg(this._kernelwidth)) {
      url = url + makeParam("kernelwidth", this._kernelwidth);
    }
    if (isNumArg(this._sourcewidth)) {
      url = url + makeParam("sourcewidth", this._sourcewidth);
    }
    if (isObject(this._startTime)) {
      url = url + makeParam("starttime", toIsoWoZ(this._startTime));
    }
    if (isObject(this._endTime)) {
      url = url + makeParam("endtime", toIsoWoZ(this._endTime));
    }

    if (this._channel && this._channel.networkCode !== TESTING_NETWORK) {
      url = url + makeParam("network", this._channel.networkCode)
        + makeParam("station", this._channel.stationCode);
    } else if (isNumArg(this._receiverlatitude) && isNumArg(this._receiverlongitude)) {
      url = url + makeParam("receiverlatitude", this._receiverlatitude)
        + makeParam("receiverlongitude", this._receiverlongitude);
    } else if (
      isStringArg(this._network) &&
      this._network.length > 0 &&
      isStringArg(this._station) &&
      this._station.length > 0
    ) {
      url = url + makeParam("network", this._network)
        + makeParam("station", this._station);
    } else {
      if (
        isStringArg(this._networkCode) &&
        this._networkCode.length > 0 &&
        this._networkCode !== "*"
      ) {
        url = url + makeParam("networkcode", this._networkCode);
      }
      if (
        isStringArg(this._stationCode) &&
        this._stationCode.length > 0 &&
        this._stationCode !== "*"
      ) {
        url = url + makeParam("stationcode", this._stationCode);
      }
    }

    if (
      isStringArg(this._locationCode) &&
      this._locationCode.length > 0 &&
      this._locationCode !== "*"
    ) {
      url = url + makeParam("loc", this._locationCode);
    }



    if (this._quake) {
      url = url + makeParam("origintime", this._quake.time);
      url = url + makeParam("sourcelatitude", this._quake.latitude)
        + makeParam("sourcelongitude", this._quake.longitude);
      url = url + makeParam("sourcedepthinmeters", this._quake.depth);
    } else if (isStringArg(this._eventid)) {
      url = url + makeParam("eventid", this._eventid);
    } else {
      if (isObject(this._originTime)) {
        url = url + makeParam("origintime", toIsoWoZ(this._originTime));
      }
      if (isNumArg(this._sourcelatitude) && isNumArg(this._sourcelongitude)) {
        url = url + makeParam("sourcelatitude", this._sourcelatitude)
          + makeParam("sourcelongitude", this._sourcelongitude);
      } else if (isNumArg(this._sourcedistanceindegrees)) {
        url = url + makeParam("sourcedistanceindegrees", this._sourcedistanceindegrees);
      }
      if (isNumArg(this._sourcedepthinmeters)) {
        url = url + makeParam("sourcedepthinmeters", this._sourcedepthinmeters);
      }
    }

    if (isDef(this._sourcemomenttensor)) {
      url = url + makeParam("sourcemomenttensor", this._sourcemomenttensor.join(","));
    } else if (isDef(this._sourcedoublecouple)) {
      url = url + makeParam("sourcedoublecouple", this._sourcedoublecouple.join(","));
    } else if (isDef(this._sourceforce)) {
      url = url + makeParam("sourceforce", this._sourceforce.join(","));
    } else if (isDef(this._quake)) {
      if(isDef(this._quake.preferredFocalMechanism?.momentTensorList)
          && this._quake.preferredFocalMechanism.momentTensorList.length > 0) {
        const focMech = this._quake.preferredFocalMechanism;
        const mt = focMech.momentTensorList[0];
        if (isDef(mt.tensor)) {
          const t = mt.tensor;
          url = url + makeParam("sourcemomenttensor", `${t.Mrr},${t.Mtt},${t.Mpp},${t.Mrt},${t.Mrp},${t.Mtp}`);
        }
      } else if (isDef(this._quake?.preferredFocalMechanism?.nodalPlanes)) {
        const np = this._quake?.preferredFocalMechanism?.nodalPlanes.nodalPlane1;
        const magVal= this._quake?.preferredMagnitude?.magQuantity?.value;
        const momentArg = isDef(magVal) ? `,${calcMoment(magVal)}` : "";
        if (isDef(np)) {
          url = url + makeParam("sourcedoublecouple", `${np.strike},${np.dip},${np.rake}${momentArg}`);
        }
      }
    }


    if (this._format) {
      url = url + makeParam("format", this._format);
    }

    if (this._nodata) {
      url = url + makeParam("nodata", this._nodata);
    }

    if (url.endsWith("&") || url.endsWith("?")) {
      url = url.substr(0, url.length - 1); // zap last & or ?
    }

    return url;
  }
}
