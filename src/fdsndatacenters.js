// @flow

import moment from 'moment';
import RSVP from 'rsvp';

RSVP.on('error', function(reason: string) {
  console.assert(false, reason);
});

// special due to flow
import {checkProtocol, toIsoWoZ, isDef, hasArgs, hasNoArgs, isStringArg, isNumArg, checkStringOrDate, stringify} from './util';
import type {RootType} from './FDSN-datacenter-registry-1.0.schema.json.flow.js';

import {SeismogramDisplayData } from './seismogram.js';
import { TEXT_MIME, JSON_MIME, StartEndDuration , doFetchWithTimeout, defaultFetchInitObj} from './util.js';
import {Network, Station, Channel} from './stationxml.js';

import * as fdsnavailability from './fdsnavailability.js';
import * as fdsndataselect from './fdsndataselect.js';
import * as fdsnevent from './fdsnevent.js';
import * as fdsnstation from './fdsnstation.js';


export const FDSN_HOST = "www.fdsn.org";

/**
 * Query to a FDSN Availability web service.
 * @see http://www.fdsn.org/webservices/
*/
export class DataCentersQuery {
  /** @private */
  _specVersion: number;
  /** @private */
  _protocol: string;
  /** @private */
  _host: string;
  /** @private */
  _nodata: number;
  /** @private */
  _port: number;
  /** @private */
  _name: string;
  /** @private */
  _services: string;
  /** @private */
  _includedatasets: boolean;
  /** @private */
  _timeoutSec: number;
  constructor(host?: string) {
    this._specVersion = 1;
    this._protocol = checkProtocol();
    if (host) {
      this._host = host;
    } else {
      this._host = FDSN_HOST;
    }
    this._port = 80;
    this._timeoutSec = 30;
  }
  /** Gets/Sets the version of the fdsnws spec, 1 is currently the only value.
   *  Setting this is probably a bad idea as the code may not be compatible with
   *  the web service.
   *
   * @return the query when setting, the current value os services if no arguments
  */
  specVersion(value?: number): number | DataCentersQuery {
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
   * @return the query when setting, the current value os services if no arguments
  */
  protocol(value?: string): string | DataCentersQuery {
    if (isStringArg(value)) {
      this._protocol = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._protocol;
    } else {
      throw new Error('value argument is optional or string, but was '+typeof value);
    }
  }
  /** Gets/Sets the remote host to connect to. This defaults to
   * www.fdsn.org and generally should not be set.
   *
   * @return the query when setting, the current value os services if no arguments
  */
  host(value?: string): string | DataCentersQuery {
    if (isStringArg(value)) {
      this._host = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._host;
    } else {
      throw new Error('value argument is optional or string, but was '+typeof value);
    }
  }
  /** Gets/Sets the remote port to connect to. This defaults to
   * the standard port for the protocol and generally should not be set.
   *
   * @return the query when setting, the current value os services if no arguments
  */
  port(value?: number): number | DataCentersQuery {
    if (hasNoArgs(value)) {
      return this._port;
    } else if (hasArgs(value)) {
      this._port = value;
      return this;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  /**
   * limits results to the named data center, default is all data centers
   * @param   value names to
   * @return the query when setting, the current value os services if no arguments
   */
  name(value?: string): string | DataCentersQuery {
    if (isStringArg(value)) {
      this._name = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._name;
    } else {
      throw new Error('value argument is optional or string, but was '+value);
    }
  }
  /**
   * limits results to services that match the glob style pattern
   * @param  value glob style pattern to match against
   * @return the query when setting, the current value os services if no arguments
   */
  services(value?: string): string | DataCentersQuery {
    if (isStringArg(value)) {
      this._services = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._services;
    } else {
      throw new Error('value argument is optional or string, but was '+value);
    }
  }
  /**
   * whether the results include detailed information about
   * the data sets offered by each center, default is false
   * @param  {[type]} value true to include datasets
   * @return the query when setting, the current value os services if no arguments
   */
  includeDataSets(value?: boolean): boolean | DataCentersQuery {
    if (hasNoArgs(value)) {
      return this._includedatasets;
    } else if (hasArgs(value)) {
      this._includedatasets = value;
      return this;
    } else {
      throw new Error('value argument is optional or boolean, but was '+typeof value);
    }
  }

  /** Get/Set the timeout in seconds for the request. Default is 30.
  * @param  {[type]} value timeout seconds
  * @return the query when setting, the current value os services if no arguments
  */
  timeout(value?: number): number | DataCentersQuery {
    if (hasNoArgs(value)) {
      return this._timeoutSec;
    } else if (isNumArg(value)) {
      this._timeoutSec = value;
      return this;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }

  queryJson(): Promise<RootType> {
    const mythis = this;
    const url = this.formURL();
    const fetchInit = defaultFetchInitObj(JSON_MIME);
    return doFetchWithTimeout(url, fetchInit, this._timeoutSec * 1000 )
      .then(function(response) {
        let contentType = response.headers.get('content-type');
        if(contentType && contentType.includes(JSON_MIME)) {
          return response.json();
        }
        // $FlowFixMe
        throw new TypeError(`Oops, we did not get JSON! ${contentType}`);
      });
  }

  findFdsnDataSelect(name: string, repoName?: string): Promise<Array<fdsndataselect.DataSelectQuery>> {
    if (name && name.length > 0) {
      this.name(name);
    }
    this.services(fdsndataselect.SERVICE_NAME);
    return this.queryJson().then(json => {
      let out = this.extractCompatibleServices(json, fdsndataselect.SERVICE_NAME, repoName);
      return out.map(service => {
        let url = new URL(service.url);
        let q = new fdsndataselect.DataSelectQuery(url.hostname);
        if (url.port && url.port.length > 0) {q.port(Number.parseInt(url.port));}
        return q;
      });
    });
  }

  findFdsnEvent(dcname: string, repoName?: string ): Promise<Array<fdsnevent.EventQuery>> {
    if (dcname && dcname.length > 0) {
      this.name(dcname);
    }
    this.services(fdsnevent.SERVICE_NAME);
    return this.queryJson().then(json => {
      let out = this.extractCompatibleServices(json, fdsnevent.SERVICE_NAME, repoName);
      return out.map(service => {
        let url = new URL(service.url);
        let q = new fdsnevent.EventQuery(url.hostname);
        if (url.port && url.port.length > 0) {q.port(Number.parseInt(url.port));}
        return q;
      });
    });
  }


  findFdsnStation(dcname: string, repoName?: string ): Promise<Array<fdsnstation.StationQuery>> {
    if (dcname && dcname.length > 0) {
      this.name(dcname);
    }
    this.services(fdsnstation.SERVICE_NAME);
    return this.queryJson().then(json => {
      let out = this.extractCompatibleServices(json, fdsnstation.SERVICE_NAME, repoName);
      return out.map(service => {
        let url = new URL(service.url);
        let q = new fdsnstation.StationQuery(url.hostname);
        if (url.port && url.port.length > 0) {q.port(Number.parseInt(url.port));}
        return q;
      });
    });
  }

  extractCompatibleServices( json: JSON, compatibleName: string, repoName?: string): Array<> {
    let out = [];
      console.log(`json dc ${json.datacenters.length}`)
    json.datacenters.forEach( dc => {
      console.log(`dc repos ${dc.repositories.length}`)
      dc.repositories.forEach( repo => {
        if (repoName && repoName === repo.name) {
          console.log(`repo servicess ${repo.services.length}`)
          repo.services.forEach( service => {
            if (service.name === compatibleName || service.compatibleWith.includes(compatibleName)) {
              out.push(service);
            }
          });
        }
      });
    });
    return out;
  }


  formBaseURL(): string {
      let colon = ":";
      if (this._protocol.endsWith(colon)) {
        colon = "";
      }
      return this._protocol+colon+"//"+this._host+(this._port===80?"":(":"+this._port))+"/ws/datacenters/"+this._specVersion;
  }

  formVersionURL(): string {
    return this.formBaseURL()+"/version";
  }
  /** Queries the remote web service to get its version
   * @return Promise to version string
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

  makeParam(name: string, val: mixed): string {
    return name+"="+encodeURIComponent(stringify(val))+"&";
  }

  formURL(): string {
    const method = "query";
    let url = this.formBaseURL()+`/${method}?`;
    if (this._name) { url = url+this.makeParam("name", this.name());}
    if (this._services) { url = url+this.makeParam("services", this.services());}
    if (this._includedatasets) { url = url+this.makeParam("includedatasets", this.includeDataSets());}

    if (url.endsWith('&') || url.endsWith('?')) {
      url = url.substr(0, url.length-1); // zap last & or ?
    }
    return url;
  }
}
