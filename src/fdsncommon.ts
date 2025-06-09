/**
 * commonalities with all types of FDSN Web Services
 */

import { isNonEmptyStringArg, checkProtocol } from "./util";

export const IRIS_HOST = "service.iris.edu";

export const FDSNWS_PATH_BASE = "fdsnws";
export const IRISWS_PATH_BASE = "irisws";
export const LOCALWS_PATH_BASE = "localws";

export class FDSNCommon {
  /** @private */
  _specVersion: string;

  /** @private */
  _protocol: string;

  /** @private */
  _host: string;

  /** @private */
  _path_base: string;

  /** @private */
  _service: string;

  /** @private */
  _port: number;

  /** @private */
  _nodata: number | undefined;

  /** @private */
  _timeoutSec: number;

  constructor(service: string, host?: string) {
    this._specVersion = "1";
    this._host = IRIS_HOST;
    this._protocol = checkProtocol();
    this._path_base = FDSNWS_PATH_BASE;
    this._service = service;

    if (isNonEmptyStringArg(host)) {
      this._host = host;
    }

    this._port = 80;
    this._timeoutSec = 30;
  }
}

export class LatLonRegion {}
export class LatLonBox extends LatLonRegion {
  west: number;
  east: number;
  south: number;
  north: number;
  constructor(west: number, east: number, south: number, north: number) {
    super();
    this.west = west;
    this.east = east;
    this.south = south;
    this.north = north;
  }
  asLeafletBounds(): [[number, number], [number, number]] {
    return [
      [this.south, this.west],
      [this.north, this.east],
    ];
  }
}
export class LatLonRadius extends LatLonRegion {
  latitude: number;
  longitude: number;
  minRadius: number;
  maxRadius: number;
  constructor(
    latitude: number,
    longitude: number,
    minRadius: number,
    maxRadius: number,
  ) {
    super();
    this.latitude = latitude;
    this.longitude = longitude;
    this.minRadius = minRadius;
    this.maxRadius = maxRadius;
  }
}
