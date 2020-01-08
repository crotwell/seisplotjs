// @flow

/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */

import {checkProtocol, hasArgs, stringify, isDef, isNonEmptyStringArg } from './util';
import {Station} from './stationxml.js';
import {Quake} from './quakeml.js';

export let IRIS_HOST = "service.iris.edu";

export const TEXT_FORMAT = "text";
export const JSON_FORMAT = "json";
export const SVG_FORMAT = "svg";

/**
 * Query to the IRIS traveltime webservice, based on the TauP Toolkit. See
 * http://service.iris.edu/irisws/traveltime/1/ and
 * https://www.seis.sc.edu/TauP/
 *
 * @param host optional host to connect to, defaults to IRIS
 */
export class TraveltimeQuery {
  /** @private */
  _specVersion: string;
  /** @private */
  _protocol: string;
  /** @private */
  _host: string;
  /** @private */
  _nodata: number;
  /** @private */
  _evdepth: number;
  /** @private */
  _distdeg: number;
  /** @private */
  _model: string;
  /** @private */
  _phases: string;
  /** @private */
  _stalat: number;
  /** @private */
  _stalon: number;
  /** @private */
  _evlat: number;
  /** @private */
  _evlon: number;
  /** @private */
  _format: string;
  /** @private */
  _noheader: boolean;
  constructor(host: ?string) {
    this._specVersion = "1";
    this._protocol = checkProtocol();
    if (! isNonEmptyStringArg(host)) {
      this._host = IRIS_HOST;
    } else {
      this._host = host;
    }
    this._format = JSON_FORMAT;
    this._noheader = false; // only for text format
  }
  protocol(value?: string): string | TraveltimeQuery {
    return hasArgs(value) ? (this._protocol = value, this) : this._protocol;
  }
  host(value?: string): string | TraveltimeQuery {
    return hasArgs(value) ? (this._host = value, this) : this._host;
  }
  specVersion(value?: string): string | TraveltimeQuery {
    return hasArgs(value) ? (this._specVersion = value, this) : this._specVersion;
  }
  evdepth(value?: number): number | TraveltimeQuery {
    return hasArgs(value) ? (this._evdepth = value, this) : this._evdepth;
  }
  distdeg(value?: number): number | TraveltimeQuery {
    return hasArgs(value) ? (this._distdeg = value, this) : this._distdeg;
  }
  model(value?: string): string | TraveltimeQuery {
    return hasArgs(value) ? (this._model = value, this) : this._model;
  }
  phases(value?: string): string | TraveltimeQuery {
    return hasArgs(value) ? (this._phases = value, this) : this._phases;
  }
  stalat(value?: number): number | TraveltimeQuery {
    return hasArgs(value) ? (this._stalat = value, this) : this._stalat;
  }
  stalon(value?: number): number | TraveltimeQuery {
    return hasArgs(value) ? (this._stalon = value, this) : this._stalon;
  }
  latLonFromStation(station: Station): TraveltimeQuery {
    this.stalat(station.latitude);
    this.stalon(station.longitude);
    return this;
  }
  evlat(value?: number): number | TraveltimeQuery {
    return hasArgs(value) ? (this._evlat = value, this) : this._evlat;
  }
  evlon(value?: number): number | TraveltimeQuery {
    return hasArgs(value) ? (this._evlon = value, this) : this._evlon;
  }
  latLonFromQuake(quake: Quake): TraveltimeQuery {
    this.evlat(quake.latitude);
    this.evlon(quake.longitude);
    this.evdepth(quake.depth/1000);
    return this;
  }
  format(value?: string): string | TraveltimeQuery {
    return hasArgs(value) ? (this._format = value, this) : this._format;
  }
  noheader(value?: boolean): boolean | TraveltimeQuery {
    return hasArgs(value) ? (this._noheader = value, this) : this._noheader;
  }
  convertToArrival(ttimeline: string) {
    let items = ttimeline.trim().split(/\s+/);
    return {
      distdeg: parseFloat(items[0]),
      phase: items[2],
      time: parseFloat(items[3]),
      rayparam: parseFloat(items[4]),
      takeoff: parseFloat(items[5]),
      incident: parseFloat(items[6]),
      puristdist: parseFloat(items[7]),
      puristname: items[9]
    };
  }

  queryText(): Promise<string> {
    this.format(TEXT_FORMAT);
    return fetch(this.formURL())
      .then(response => {
        if (response.ok) {
          return response.text();
        } else {
          throw new Error("Fetching over network was not ok: "+response.status+" "+response.statusText);
        }
      });
  }
  queryJson(): Promise<any> {
    this.format(JSON_FORMAT);
    return fetch(this.formURL())
      .then(response => {
        if (response.ok) {
          return response.json();
        } else {
          throw new Error("Fetching over network was not ok: "+response.status+" "+response.statusText);
        }
      });
  }
  querySvg(): Promise<Element> {
    this.format(SVG_FORMAT);
    return fetch(this.formURL())
      .then(response => {
        if (response.ok) {
          return response.text()
            .then(textResponse => (new window.DOMParser()).parseFromString(textResponse, "text/xml"))
            .then(xml => {
              let elArray = xml.getElementsByTagName("svg");
              if (elArray.length > 0) {
                return elArray[0];
              } else {
                throw new Error("Can't find svg element in response");
              }
            });

        } else {
          throw new Error("Fetching over network was not ok: "+response.status+" "+response.statusText);
        }
      });
  }
  queryWadl(): Promise<Element> {
    return fetch(this.formWadlURL())
      .then(response => {
        if (response.ok) {
          return response.text()
            .then(textResponse => (new window.DOMParser()).parseFromString(textResponse, "text/xml"));
        } else {
          throw new Error("Fetching over network was not ok: "+response.status+" "+response.statusText);
        }
      });
  }
  query(): Promise<any> {
    if (this._format === JSON_FORMAT) {
      return this.queryJson();
    } else if (this._format === SVG_FORMAT) {
      return this.querySvg();
    } else if (this._format === TEXT_FORMAT) {
      return this.queryText();
    } else {
      throw new Error("Unknown format: "+this._format);
    }
  }

  makeParam(name: string, val: mixed): string {
    return name+"="+encodeURIComponent(stringify(val))+"&";
  }

  formBaseURL(): string {
    let colon = ":";
    if (this._protocol.endsWith(colon)) {
      colon = "";
    }
    let url = this._protocol+colon+"//"+this._host+"/irisws/traveltime/"+this._specVersion+"/";
    return url;
  }

  formURL(): string {
    let url = this.formBaseURL()+'query?';
    if (isDef(this._noheader) && this._noheader) {
      url = url +"noheader=true&";
    }
    if (isDef(this._evdepth)) { url = url+this.makeParam("evdepth", this.evdepth()); }
    if (isDef(this._stalat) && isDef(this._stalon)) {
      url = url+this.makeParam("staloc", "["+stringify(this.stalat())+","+stringify(this.stalon())+"]");
    }
    if (isDef(this._evlat) && isDef(this._evlon)) {
      url = url+this.makeParam("evloc", "["+stringify(this.evlat())+","+stringify(this.evlon())+"]");
    }
    if (isDef(this._distdeg)) { url = url+this.makeParam("distdeg", this.distdeg());}
    if (isDef(this._model)) { url = url+this.makeParam("model", this.model());}
    if (isDef(this._phases)) { url = url+this.makeParam("phases", this.phases());}
    if (isDef(this._format)) { url = url+this.makeParam("format", this.format());}
    if (url.endsWith('&') || url.endsWith('?')) {
      url = url.substr(0, url.length-1); // zap last & or ?
    }
    return url;
  }


  queryTauPVersion(): Promise<string> {
    return fetch(this.formTauPVersionURL())
      .then(response => {
        if (response.ok) {
          return response.text();
        } else {
          throw new Error("Fetching over network was not ok: "+response.status+" "+response.statusText);
        }
      });
  }

  formTauPVersionURL(): string {
    return this.formBaseURL()+'taupversion';
  }


  formWadlURL(): string {
    return this.formBaseURL()+'application.wadl';
  }
}
