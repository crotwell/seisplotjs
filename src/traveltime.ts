/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */
import {FDSNCommon} from './fdsncommon';
import {
  doStringGetterSetter,
  doBoolGetterSetter,
  doIntGetterSetter,
  doFloatGetterSetter,
  stringify,
  isDef,
  isNonEmptyStringArg,
  JSON_MIME,
  SVG_MIME,
  TEXT_MIME,
  makeParam,
  defaultFetchInitObj,
  doFetchWithTimeout,
} from "./util";
import {Station, Channel} from "./stationxml";
import {Quake} from "./quakeml";
export const IRIS_HOST = "service.iris.edu";
export const TEXT_FORMAT = "text";
export const JSON_FORMAT = "json";
export const SVG_FORMAT = "svg";

/**
 * Type for json returned by iris traveltime web service
 *
 */
export type TraveltimeJsonType = {
  model: string;
  sourcedepth: number;
  receiverdepth: number;
  phases: Array<string>;
  arrivals: Array<TraveltimeArrivalType>;
};
export type TraveltimeArrivalType = {
  distdeg: number;
  phase: string;
  time: number;
  rayparam: number;
  takeoff: number;
  incident: number;
  puristdist: number;
  puristname: string;
};

/**
 * Verifies that JSON matches the types we expect, for typescript.
 *
 * @param  v JSON object, usually from the traveltime web service
 * @returns   true if matches expected structure
 */
export function isValidTraveltimeJsonType(v: unknown): v is TraveltimeJsonType {
  if (!v || typeof v !== 'object') {
    return false;
  }
  const object = v as Record<string, unknown>;

  // IRIS web service uses sourceDepth, TauP uses sourcedepth
  if ( ! ( typeof object.model === 'string' &&
      (typeof object.sourcedepth === 'number' ||
       typeof object.sourceDepth === 'number') &&
      (typeof object.receiverdepth === 'number' ||
      typeof object.receiverDepth === 'number'))) {
    return false;
  }
  // fix to lower d
  if (typeof object.sourceDepth === "number") {
    // fix IRIS typo D
    object.sourcedepth = object.sourceDepth;
    object.sourceDepth = undefined;
  }
  if (typeof object.receiverDepth === "number") {
    // fix IRIS typo D
    object.receiverdepth = object.receiverDepth;
    object.receiverDepth = undefined;
  }
  if ( ! Array.isArray(object.phases)) {
    return false;
  }
  if ( ! Array.isArray(object.arrivals)) {
    return false;
  }
  return true;
}
export function isValidTraveltimeArrivalType(v: unknown): v is TraveltimeArrivalType {
  if (!v || typeof v !== 'object') {
    return false;
  }
  const object = v as Record<string, unknown>;

  return typeof object.distdeg === 'number' &&
    typeof object.name === 'string' &&
    typeof object.time === 'number' &&
    typeof object.rayparam === 'number' &&
    typeof object.takeoff === 'number' &&
    typeof object.incident === 'number' &&
    typeof object.puristdist === 'number' &&
    typeof object.puristname === 'string';
}

/**
 * converts a text line from the text format into an
 *  TraveltimeArrivalType object like what is returned by the json format.
 *
 *  @param ttimeline travel time output line for an arrival
 *  @returns parsed travel time arrival
 */
export function convertTravelTimeLineToObject(
  ttimeline: string,
): TraveltimeArrivalType {
  const items = ttimeline.trim().split(/\s+/);
  return {
    distdeg: parseFloat(items[0]),
    phase: items[2],
    time: parseFloat(items[3]),
    rayparam: parseFloat(items[4]),
    takeoff: parseFloat(items[5]),
    incident: parseFloat(items[6]),
    puristdist: parseFloat(items[7]),
    puristname: items[9],
  };
}

/**
 * Creates a fake arrival for the origin time, useful to display a flag
 * at origin time similar to the P and S arrival.
 * @param  distdeg earthquake to station distance, in degrees
 * @returns      an arrival for the origin
 */
export function createOriginArrival(distdeg: number): TraveltimeArrivalType {
  return {
    distdeg: distdeg,
    phase: "origin",
    time: 0,
    rayparam: 0,
    takeoff: 0,
    incident: 0,
    puristdist: distdeg,
    puristname: "origin",
  };
}

/**
 * Query to the IRIS traveltime webservice, based on the TauP Toolkit. See
 * http://service.iris.edu/irisws/traveltime/1/ and
 * https://www.seis.sc.edu/TauP/
 *
 * @param host optional host to connect to, defaults to IRIS
 */
export class TraveltimeQuery extends FDSNCommon {

  /** @private */
  _evdepth: number;

  /** @private */
  _distdeg: Array<number> | undefined;

  /** @private */
  _model: string | undefined;

  /** @private */
  _phases: string | undefined;

  /** @private */
  _stalat: number | undefined;

  /** @private */
  _stalon: number | undefined;

  /** @private */
  _receiverdepth: number | undefined;

  /** @private */
  _evlat: number | undefined;

  /** @private */
  _evlon: number | undefined;

  /** @private */
  _format: string;

  /** @private */
  _noheader: boolean;

  constructor(host?: string | null) {
    if ( ! isNonEmptyStringArg(host)) {
      host = IRIS_HOST;
    }
    super(host);
    this._evdepth = 0;
    this._format = JSON_FORMAT;
    this._noheader = false; // only for text format

  }

  protocol(value?: string): TraveltimeQuery {
    doStringGetterSetter(this, "protocol", value);
    return this;
  }

  getProtocol(): string | undefined {
    return this._protocol;
  }

  host(value?: string): TraveltimeQuery {
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
  port(value?: number): TraveltimeQuery {
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
  nodata(value?: number): TraveltimeQuery {
    doIntGetterSetter(this, "nodata", value);
    return this;
  }

  getNodata(): number | undefined {
    return this._nodata;
  }

  specVersion(value?: string): TraveltimeQuery {
    doStringGetterSetter(this, "specVersion", value);
    return this;
  }

  getSpecVersion(): string | undefined {
    return this._specVersion;
  }

  evdepth(value?: number): TraveltimeQuery {
    doFloatGetterSetter(this, "evdepth", value);
    return this;
  }

  evdepthInMeter(value?: number): TraveltimeQuery {
    doFloatGetterSetter(
      this,
      "evdepth",
      isDef(value) ? value / 1000 : value,
    );
    return this;
  }

  getEvdepth(): number | undefined {
    return this._evdepth;
  }

  distdeg(value?: number | Array<number>): TraveltimeQuery {
    if (typeof value === 'number') {
      this._distdeg = [value];
    } else {
      this._distdeg = value;
    }
    return this;
  }

  getDistdeg(): Array<number> | undefined {
    return this._distdeg;
  }

  model(value?: string): TraveltimeQuery {
    doStringGetterSetter(this, "model", value);
    return this;
  }

  getModel(): string | undefined {
    return this._model;
  }

  phases(value?: string): TraveltimeQuery {
    doStringGetterSetter(this, "phases", value);
    return this;
  }

  getPhases(): string | undefined {
    return this._phases;
  }

  stalat(value?: number): TraveltimeQuery {
    doFloatGetterSetter(this, "stalat", value);
    return this;
  }

  getStalat(): number | undefined {
    return this._stalat;
  }

  stalon(value?: number): TraveltimeQuery {
    doFloatGetterSetter(this, "stalon", value);
    return this;
  }

  getStalon(): number | undefined {
    return this._stalon;
  }

  latLonFromStation(station: Station): TraveltimeQuery {
    this.stalat(station.latitude);
    this.stalon(station.longitude);
    return this;
  }

  receiverdepth(value?: number): TraveltimeQuery {
    doFloatGetterSetter(this, "receiverdepth", value);
    return this;
  }

  receiverdepthInMeter(value?: number): TraveltimeQuery {
    doFloatGetterSetter(
      this,
      "receiverdepth",
      isDef(value) ? value / 1000 : value,
    );
    return this;
  }

  receiverdepthFromChannel(channel: Channel): TraveltimeQuery {
    return this.receiverdepth(channel.depth/1000);
  }

  getReceiverdepth(): number | undefined {
    return this._receiverdepth;
  }

  evlat(value?: number): TraveltimeQuery {
    doFloatGetterSetter(this, "evlat", value);
    return this;
  }

  getEvlat(): number | undefined {
    return this._evlat;
  }

  evlon(value?: number): TraveltimeQuery {
    doFloatGetterSetter(this, "evlon", value);
    return this;
  }

  getEvlon(): number | undefined {
    return this._evlon;
  }

  latLonFromQuake(quake: Quake): TraveltimeQuery {
    this.evlat(quake.latitude);
    this.evlon(quake.longitude);
    this.evdepthInMeter(quake.depth);
    return this;
  }

  format(value?: string): TraveltimeQuery {
    doStringGetterSetter(this, "format", value);
    return this;
  }

  getFormat(): string | undefined {
    return this._format;
  }

  noheader(value?: boolean): TraveltimeQuery {
    doBoolGetterSetter(this, "noheader", value);
    return this;
  }

  getNoheader(): boolean | undefined {
    return this._noheader;
  }

  /**
   * Get/Set the timeout in seconds for the request. Default is 30.
   *
   * @param value optional new value if setting
   * @returns new value if getting, this if setting
   */
  timeout(value?: number): TraveltimeQuery {
    doFloatGetterSetter(this, "timeoutSec", value);
    return this;
  }

  getTimeout(): number | undefined {
    return this._timeoutSec;
  }

  queryText(): Promise<string> {
    this.format(TEXT_FORMAT);
    const url = this.formURL();
    const fetchInit = defaultFetchInitObj(TEXT_MIME);
    return doFetchWithTimeout(url, fetchInit, this._timeoutSec * 1000).then(
      (response) => {
        if (
          response.status === 204 ||
          (isDef(this._nodata) && response.status === this._nodata)
        ) {
          // no data, create empty
          return (
            FAKE_EMPTY_TEXT_MODEL +
            (isDef(this._model) ? this.getModel() : "") +
            FAKE_EMPTY_TEXT_HEADERS
          );
        } else {
          return response.text();
        }
      },
    );
  }

  queryJson(): Promise<TraveltimeJsonType> {
    this.format(JSON_FORMAT);
    const url = this.formURL();
    const fetchInit = defaultFetchInitObj(JSON_MIME);
    return doFetchWithTimeout(url, fetchInit, this._timeoutSec * 1000).then(
      (response) => {
        if (
          response.status === 204 ||
          (isDef(this._nodata) && response.status === this._nodata)
        ) {
          // no data, create empty
          return createEmptyTraveltimeJson(this);
        } else {
          return response.json();
        }
      }).then(jsonValue => {
        if (isValidTraveltimeJsonType(jsonValue)) {
          return jsonValue;
        } else {
          throw new TypeError(`Oops, we did not get root traveltime JSON!`);
        }
      },
    );
  }

  querySvg(): Promise<Element> {
    this.format(SVG_FORMAT);
    const url = this.formURL();
    const fetchInit = defaultFetchInitObj(SVG_MIME);
    return doFetchWithTimeout(url, fetchInit, this._timeoutSec * 1000)
      .then((response) => {
        if (response.status === 200) {
          return response.text();
        } else if (
          response.status === 204 ||
          (isDef(this._nodata) && response.status === this._nodata)
        ) {
          // 204 is nodata, so successful but empty
          return FAKE_EMPTY_SVG;
        } else {
          throw new Error(`Status not successful: ${response.status}`);
        }
      })
      .then(function (rawXmlText) {
        return new DOMParser().parseFromString(rawXmlText, SVG_MIME);
      })
      .then(xml => {
        const elArray = xml.getElementsByTagName("svg");

        if (elArray.length > 0) {
          return elArray[0];
        } else {
          throw new Error("Can't find svg element in response");
        }
      });
  }

  queryWadl(): Promise<Document> {
    return fetch(this.formWadlURL()).then(response => {
      if (response.ok) {
        return response
          .text()
          .then(textResponse =>
            new window.DOMParser().parseFromString(textResponse, "text/xml"),
          );
      } else {
        throw new Error(
          `Fetching over network was not ok: ${response.status} ${response.statusText}`
        );
      }
    });
  }

  query(): Promise<TraveltimeJsonType | Element | string> {
    if (this._format === JSON_FORMAT) {
      return this.queryJson();
    } else if (this._format === SVG_FORMAT) {
      return this.querySvg();
    } else if (this._format === TEXT_FORMAT) {
      return this.queryText();
    } else {
      throw new Error("Unknown format: " + this._format);
    }
  }

  formBaseURL(): string {
    let colon = ":";

    if (this._protocol.endsWith(colon)) {
      colon = "";
    }

    const url =
      this._protocol +
      colon +
      "//" +
      this._host +
      (this._port === 80 ? "" : ":" + this._port) +
      "/irisws/traveltime/" +
      this._specVersion +
      "/";
    return url;
  }

  formURL(): string {
    let url = this.formBaseURL() + "query?";

    if (isDef(this._noheader) && this._noheader) {
      url = url + "noheader=true&";
    }

    if (isDef(this._evdepth) && this._evdepth !== 0) {
      url = url + makeParam("evdepth", this._evdepth);
    }

    if (isDef(this._receiverdepth) && this._receiverdepth !== 0) {
      url = url + makeParam("receiverdepth", this._receiverdepth);
    }

    if (isDef(this._stalat) && isDef(this._stalon)) {
      url =
        url +
        makeParam(
          "staloc",
          "[" + stringify(this._stalat) + "," + stringify(this._stalon) + "]",
        );
    }

    if (isDef(this._evlat) && isDef(this._evlon)) {
      url =
        url +
        makeParam(
          "evloc",
          "[" + stringify(this._evlat) + "," + stringify(this._evlon) + "]",
        );
    }

    if (isDef(this._distdeg)) {
      url = url + makeParam("distdeg", this._distdeg.join(','));
    }

    if (isDef(this._model)) {
      url = url + makeParam("model", this._model);
    }

    if (isDef(this._phases)) {
      url = url + makeParam("phases", this._phases);
    }

    if (isDef(this._format)) {
      url = url + makeParam("format", this._format);
    }

    if (isDef(this._nodata)) {
      url = url + makeParam("nodata", this._nodata);
    }

    if (url.endsWith("&") || url.endsWith("?")) {
      url = url.substr(0, url.length - 1); // zap last & or ?
    }

    return url;
  }

  queryTauPVersion(): Promise<string> {
    return fetch(this.formTauPVersionURL()).then(response => {
      if (response.ok) {
        return response.text();
      } else {
        throw new Error(
          "Fetching over network was not ok: " +
            response.status +
            " " +
            response.statusText,
        );
      }
    });
  }

  formTauPVersionURL(): string {
    return this.formBaseURL() + "taupversion";
  }

  formWadlURL(): string {
    return this.formBaseURL() + "application.wadl";
  }
}
export const FAKE_EMPTY_TEXT_MODEL = `Model: `;
export const FAKE_EMPTY_TEXT_HEADERS = `
Distance   Depth   Phase   Travel    Ray Param  Takeoff  Incident  Purist    Purist
  (deg)     (km)   Name    Time (s)  p (s/deg)   (deg)    (deg)   Distance   Name
-----------------------------------------------------------------------------------
`;

export function createEmptyTraveltimeJson(ttquery: TraveltimeQuery): TraveltimeJsonType {
  const out: TraveltimeJsonType = {
    model: isDef(ttquery._model) ? ttquery._model : "",
    sourcedepth: isDef(ttquery._evdepth) ? ttquery._evdepth : 0,
    receiverdepth: isDef(ttquery._receiverdepth) ? ttquery._receiverdepth : 0,
    phases: isDef(ttquery._phases) ? ttquery._phases.split(",") : [],
    arrivals: [],
  };
  return out;
}

export const FAKE_EMPTY_SVG = `
<svg version="1.1" baseProfile="full" xmlns="http://www.w3.org/2000/svg" width="500" height="500" viewBox="0 0 14016.2 14016.2">
<!--
 This script will plot ray paths generated by TauP using SVG. -->
<defs>
    <style type="text/css"><![CDATA[
        circle {
            vector-effect: non-scaling-stroke;
            stroke: grey;
            fill: none;
        }
        polyline {
            vector-effect: non-scaling-stroke;
            stroke: black;
            fill: none;
        }
    ]]></style>
</defs>
<g transform="translate(7008.1,7008.1)" >
<!-- draw surface and label distances.-->
<!-- tick marks every 30 degrees.-->
  <polyline points="    0.00  -6371.00,     0.00  -6689.55" />
  <polyline points=" 3185.50  -5517.45,  3344.78  -5793.32" />
  <polyline points=" 5517.45  -3185.50,  5793.32  -3344.77" />
  <polyline points=" 6371.00      0.00,  6689.55      0.00" />
  <polyline points=" 5517.45   3185.50,  5793.32   3344.77" />
  <polyline points=" 3185.50   5517.45,  3344.78   5793.32" />
  <polyline points="    0.00   6371.00,     0.00   6689.55" />
  <polyline points="-3185.50   5517.45, -3344.77   5793.32" />
  <polyline points="-5517.45   3185.50, -5793.32   3344.77" />
  <polyline points="-6371.00      0.00, -6689.55      0.00" />
  <polyline points="-5517.45  -3185.50, -5793.32  -3344.78" />
  <polyline points="-3185.50  -5517.45, -3344.78  -5793.32" />
  <circle cx="0.0" cy="0.0" r="6371.0" />
  </g>
</svg>
`;
