/**
 * commonalities with all types of FDSN Web Services
 */

import { isNonEmptyStringArg, checkProtocol } from "./util.mjs";
import {USGS_HOST} from './quakeml.mjs';

export const EARTHSCOPE_HOST = "service.earthscope.org";
export const IRIS_HOST = EARTHSCOPE_HOST;

/** const for fdsn web service host, www.fdsn.org */
export const FDSN_HOST = "www.fdsn.org";

export const FDSNWS_PATH_BASE = "fdsnws";
export const IRISWS_PATH_BASE = "irisws";
export const USCWS_PATH_BASE = "uscws";
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
    this._host = EARTHSCOPE_HOST;
    this._protocol = checkProtocol();
    this._path_base = FDSNWS_PATH_BASE;
    this._service = service;

    if (isNonEmptyStringArg(host)) {
      this._host = host;
    }

    this._port = 80;
    this._timeoutSec = 30;
  }

  defaultPortStringForProtocol(protocol: string) {
    return defaultPortStringForProtocol(protocol, this._port);

  }
}

/**
 * Gets https or http for known FDSN WS hosts. Some, like Earthscope
 * only use https, so using this avoids the redirect.
 * @param  host  hostname, like service.earthscope.org
 * @return     either https for know or default for others
 */
export function protocolForKnownHost(host: string, defaultProtocol: string) {
  switch(host.toLowerCase()) {
    case EARTHSCOPE_HOST:
    case USGS_HOST:
    case FDSN_HOST:
      return "https";
    default:
      return defaultProtocol;
  }
}


export function defaultPortStringForProtocol(protocol: string, port: number) {
  return (( protocol === "http" || protocol === "http:" ||
              protocol === "https" || protocol === "https:")
            && (port === 80 || port === 443)
        ) ? "" : ":" + String(port);
}

/**
 * Appends a path segment to a base URL, checking that there is one,
 * and only one, slash between the two.
 * @param  baseUrl   base url, possibly ending in a slash
 * @param  addPath   path to add, possibly starting with a slash
 * @return  merged path, with exactly one slash between
 */
export function appendToPath(baseUrl: string, addPath: string): string {
  let out = baseUrl + (baseUrl.endsWith("/")?"":"/");
  if (addPath.startsWith("/")) {
    out += addPath.substring(1);
  } else {
    out += addPath;
  }
  return out;
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
