// @flow

/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */

// special due to flow
import {checkProtocol, makeParam, isDef, hasArgs, hasNoArgs, isStringArg,
        isNonEmptyStringArg, isNumArg} from './util';

import { TEXT_MIME, JSON_MIME , doFetchWithTimeout, defaultFetchInitObj} from './util.js';

import * as fdsnavailability from './fdsnavailability.js';
import * as fdsndataselect from './fdsndataselect.js';
import * as fdsnevent from './fdsnevent.js';
import * as fdsnstation from './fdsnstation.js';

/** const for fdsn web service host, www.fdsn.org */
export const FDSN_HOST = "www.fdsn.org";

/**
 * Query to a FDSN Data Centers Registry web service.
 *
 * @see http://www.fdsn.org/webservices/
 *
 * @param host optional host to connect to, defaults to FDSN
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
    if (isNonEmptyStringArg(host)) {
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
   * @param value optional new value if setting
   * @returns the query when setting, the current value os services if no arguments
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
   * @param value optional new value if setting
   * @returns the query when setting, the current value os services if no arguments
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
   * @param value optional new value if setting
   * @returns the query when setting, the current value os services if no arguments
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
   * @param value optional new value if setting
   * @returns the query when setting, the current value os services if no arguments
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
   *
   * @param   value names to search for
   * @returns the query when setting, the current value os services if no arguments
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
   *
   * @param  value glob style pattern to match against
   * @returns the query when setting, the current value os services if no arguments
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
   *
   * @param  value true to include datasets
   * @returns the query when setting, the current value os services if no arguments
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
    *
    * @param  value timeout seconds
    * @returns the query when setting, the current value os services if no arguments
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

  /**
   * queries the fdsn registry web service, returning the result as a parsed json object.
   *
   * @returns Promise to the json object.
   */
  queryJson(): Promise<RootType> {
    const url = this.formURL();
    const fetchInit = defaultFetchInitObj(JSON_MIME);
    return doFetchWithTimeout(url, fetchInit, this._timeoutSec * 1000 )
      .then(function(response) {
        let contentType = response.headers.get('content-type');
        if(isNonEmptyStringArg(contentType) && contentType.includes(JSON_MIME)) {
          return response.json();
        }
        // $FlowFixMe
        throw new TypeError(`Oops, we did not get JSON! ${contentType}`);
      });
  }

   /**
    * queries the registry to find fdsn availability compatible web services within
    * a datacenter of the given name, optionally within the repository with
    * the repo name.
    *
    * @param   name     datacenter name
    * @param   repoName optional repository name
    * @returns           Promise to Array of fdsnavailability.AvailabilityQuery objects
    */
  findFdsnAvailability(name: string, repoName?: string): Promise<Array<fdsnavailability.AvailabilityQuery>> {
    if (name && name.length > 0) {
      this.name(name);
    }
    this.services(fdsnavailability.SERVICE_NAME);
    return this.queryJson().then(json => {
      let out = this.extractCompatibleServices(json, fdsnavailability.SERVICE_NAME, repoName);
      return out.map(service => {
        let url = new URL(service.url);
        let q = new fdsnavailability.AvailabilityQuery(url.hostname);
        if (url.port && url.port.length > 0) {q.port(Number.parseInt(url.port));}
        return q;
      });
    });
  }

   /**
    * queries the registry to find fdsn dataselect compatible web services within
    * a datacenter of the given name, optionally within the repository with
    * the repo name.
    *
    * @param   name     datacenter name
    * @param   repoName optional repository name
    * @returns           Promise to Array of fdsndataselect.DataSelectQuery objects
    */
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

  /**
   * queries the registry to find a fdsn event compatible web services within
   * a datacenter of the given name, optionally within the repository with
   * the repo name.
   *
   * @param   dcname     datacenter name
   * @param   repoName optional repository name
   * @returns           Promise to Array of fdsnevent.EventQuery objects
   */
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

   /**
    * queries the registry to find a fdsn station compatible web services within
    * a datacenter of the given name, optionally within the repository with
    * the repo name.
    *
    * @param   dcname     datacenter name
    * @param   repoName optional repository name
    * @returns           Promise to Array of fdsnstation.StationQuery objects
    */
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

/**
 * Extracts services comaptible with the given service name, optionally within
 * the given repository, from the json.
 *
 * @param   json           json containing services
 * @param   compatibleName service name to be compatible with
 * @param   repoName       optional repository within the json to search
 * @returns                array of services found
 */
  extractCompatibleServices( json: RootType, compatibleName: string, repoName?: string): Array<any> {
    let out = [];
    json.datacenters.forEach( dc => {
      dc.repositories.forEach( repo => {
        if ( ! isDef(repoName) || repoName === repo.name) {
          repo.services.forEach( service => {
            if (service.name === compatibleName || (
                isDef(service.compatibleWith) && service.compatibleWith.includes(compatibleName)) ) {
              out.push(service);
            }
          });
        }
      });
    });
    return out;
  }

/**
 * Forms the base of the url for accessing the datacenters service.
 *
 * @returns         URL
 */
  formBaseURL(): string {
      let colon = ":";
      if (this._protocol.endsWith(colon)) {
        colon = "";
      }
      return this._protocol+colon+"//"+this._host+(this._port===80?"":(":"+this._port))+"/ws/datacenters/"+this._specVersion;
  }

  /**
   * Forms version url, not part of spec and so may not be supported.
   *
   * @returns         version
   */
  formVersionURL(): string {
    return this.formBaseURL()+"/version";
  }

  /** Queries the remote web service to get its version
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
   * forms a url to the fdsn registry based on the configured parameters.
   *
   * @returns the url
   */
  formURL(): string {
    const method = "query";
    let url = this.formBaseURL()+`/${method}?`;
    if (this._name) { url = url+makeParam("name", this.name());}
    if (this._services) { url = url+makeParam("services", this.services());}
    if (this._includedatasets) { url = url+makeParam("includedatasets", this.includeDataSets());}

    if (url.endsWith('&') || url.endsWith('?')) {
      url = url.substr(0, url.length-1); // zap last & or ?
    }
    return url;
  }
}



/* original json schema from
https://github.com/FDSN/datacenter-registry

{
    "$schema": "http://json-schema.org/draft-07/schema#",
    "id": "http://www.fdsn.org/schemas/FDSN-datacenter-registry-1.0.schema.json",
    "description": "Data center registry exchange format",
    "definitions": {
        "services": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": false,
                "required": ["name"],
                "properties": {
                    "name": {
                        "description": "Service name (no white space)",
                        "type": "string",
                        "pattern": "^[-_a-zA-Z0-9]+$"
                    },
                    "description": {
                        "description": "Description of service",
                        "type": "string"
                    },
                    "url": {
                        "description": "URL to web service, ideally with documentation",
                        "type": "string",
                        "format": "uri"
                    },
                    "compatibleWith": {
                        "description": "Description of service compatibility with a standard or alternate service (e.g. fdsnws-dataselect, fdsnws-station, fdsnws-event)",
                        "type": "string"
                    }
                }
            }
        }
    },
    "type": "object",
    "required": ["version", "datacenters"],
    "properties": {
        "version": {
            "description": "Data center registry message format version",
            "const": 1.0
        },
        "datacenters": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                    "name",
                    "website"
                ],
                "properties": {
                    "name": {
                        "description": "Data center name (no white space)",
                        "type": "string",
                        "pattern": "^[-_a-zA-Z0-9]+$"
                    },
                    "website": {
                        "description": "URL to data center website",
                        "type": "string",
                        "format": "uri"
                    },
                    "fullName": {
                        "description": "Full name of data center",
                        "type": "string"
                    },
                    "summary": {
                        "description": "Summary of data center",
                        "type": "string"
                    },
                    "repositories": {
                        "description": "Repositories of data center",
                        "type": "array",
                        "items": {
                            "type": "object",
                            "additionalProperties": false,
                            "required": ["name"],
                            "properties": {
                                "name": {
                                    "description": "Repository name (no white space)",
                                    "type": "string",
                                    "pattern": "^[-_a-zA-Z0-9]+$"
                                },
                                "description": {
                                    "description": "Description of repository",
                                    "type": "string"
                                },
                                "website": {
                                    "description": "URL to repository website",
                                    "type": "string",
                                    "format": "uri"
                                },
                                "services": {"$ref": "#/definitions/services"},
                                "datasets": {
                                    "description": "Data sets offered by the data center",
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "additionalProperties": false,
                                        "properties": {
                                            "network": {"type": "string"},
                                            "station": {"type": "string"},
                                            "location": {"type": "string"},
                                            "channel": {"type": "string"},
                                            "starttime": {
                                                "type": "string",
                                                "format": "date-time"
                                            },
                                            "endtime": {
                                                "type": "string",
                                                "format": "date-time"
                                            },
                                            "priority": {
                                                "description": "Priority of data center for this data set, with 1 being highest",
                                                "type": "integer"
                                            },
                                            "description": {
                                                "description": "Description of data set",
                                                "type": "string"
                                            },
                                            "url": {
                                                "description": "URL to data set or summary page",
                                                "type": "string",
                                                "format": "uri"
                                            },
                                            "services": {
                                                "description": "Services for this data set, overriding repository service declarations",
                                                "$ref": "#/definitions/services"
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

 */

/* The below are slighly modified from json schema to flow autogenerator.
*
* */

/**
 * Root type of fdsn datacenters json query.
 */
export type RootType = {
  version: Object,
  datacenters: Array<{
    name: string,
    website: string,
    fullName?: string,
    summary?: string,
    repositories: Array<Repository>
  }>
} & Object;
export type Repository = {
  name: string,
  description?: string,
  website?: string,
  services: Array<Service>,
  datasets?: Array<Dataset>
};
export type Dataset = {
  network?: string,
  station?: string,
  location?: string,
  channel?: string,
  starttime?: string,
  endtime?: string,
  priority?: number,
  description?: string,
  url?: string,
  services?: Array<Service>
};
export type Service = {
  name: string,
  description?: string,
  url?: string,
  compatibleWith?: string
};
