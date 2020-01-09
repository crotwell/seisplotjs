// @flow

/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */

import moment from 'moment';
import { checkProtocol } from './util';

// flow type for json known datacenters type
//import type { moment as momentType } from 'moment';

type SupportsType = {
  type: string,
  versions: Array<number>,
  host?: string
}
type DataCenterType = {
  "id": string,
  "name": string,
  "website": string,
  "email": string,
  "host": string,
  "region": string,
  "supports": Array<SupportsType>,
}
type KnownDCS_JSON = {
  accesstime?: moment,
  created: moment,
  datacenters: Array<DataCenterType>
}

const DS = "fdsnws-dataselect";
const EV= "fdsn-event";
const ST= "fdsn-station";
const RS= "ringserver";

const BestDCIdMap = new Map();

function initBestDCIdMap() {
  BestDCIdMap.set(knownDataCenters.DS, "IRIS");
  BestDCIdMap.set(ST, "IRIS");
  BestDCIdMap.set(RS, "IRIS");
  BestDCIdMap.set(EV, "USGS");
}

let knownDCs = null;

/**
 * Lookup system for FDSN web services, predates the new FDSN DataCenters
 * web service, which is now the preferred method, as this may be out of date.
 * 
 */
export const knownDataCenters = {
  knownDataCentersJsonURL: checkProtocol()+"//www.seis.sc.edu/fdsnServiceCheck/fdsnDataCenters.json",

  DS: DS,
  EV: EV,
  ST: ST,
  RS: RS,
  allDCTypes: [ DS, EV, ST, RS ],

  getDefaultDC(type: string) {
    return this.getDataCenter(BestDCIdMap.get(type));
  },

  /**
   * Loads all known data centers. JSON top level has:
   *  created - modification date,
   *  datacenters - array of objects, each with
   *  id, name, website, email, host, region and
   *  and supports that is an array of type and version.
   *
   *  @returns a Promise that resolves to the returned json.
   */
  getKnownDataCenters(): Promise<KnownDCS_JSON> {
    if ( ! knownDCs) {
      knownDCs = fetch(this.knownDataCentersJsonURL)
        .then(response => {
          return (response: {json(): any}).json();
        }).then(function(json: any): KnownDCS_JSON {
          json.accesstime = moment.utc();
          return json;
        });
    }
    return knownDCs;
  },

  /**
   * Forces a reload of the remote json. In general, because the data
   *  is updated infrequently, this is unlikely to be needed. However,
   *  a very long running instance may wish to update this periodically,
   *  likely at most daily.
   *
   *  @returns a Promise to known datacenters.
   */
  updateKnownDataCenters(): Promise<KnownDCS_JSON> {
    knownDCs = null;
    return this.getKnownDataCenters();
  },

  /**
   * Gets the data center associated with the id.
   *
   * @param id string id
   * @returns a Promise to data center
   */
  getDataCenter(id: string): DataCenterType {
    return this.getKnownDataCenters().then(kdcs => {
      for (const dc of kdcs.datacenters) {
        if (dc.id === id) {
          return dc;
        }
      }
      return null;
    });
  },

  /**
   *
   * @param dc data center
   * @param type type of service
   * @returns true is the dc datacenter supports type web service,
   * false otherwise.
   */
  doesSupport(dc: DataCenterType, type: string) {
    let out = dc.supports.find(function(s) { return s.type === type;});
    return typeof out !== 'undefined';
  },

  /**
   * returns the hostname for type web service. In many cases this
   *  is the same as the host for the overall datacenter, but sometimes
   *  not all web services are hosted on the same machine. For example
   *  all fdsn web services at IRIS are hosted at service.iris.edu
   *  but the ringserver is hosted at rtserve.iris.edu
   *
   * @param dc data center
   * @param type type of service
   * @returns host
   */
  serviceHost(dc: DataCenterType, type: string): string {
    let does = this.doesSupport(dc, type);
    if (does) {
      return does.host ? does.host : dc.host;
    }
    throw new Error(dc.id+" does not support "+type);
  },

  /**
   * returns the port for type web service. In many cases this
   *  is 80, but sometimes web services are hosted on alternative
   *  ports.
   *
   * @param dc data center
   * @param type type of service
   * @returns port number
   */
  servicePort(dc: DataCenterType, type: string): number {
    let does = this.doesSupport(dc, type);
    if (does) {
      return does.port ? does.port : 80;
    }
    throw new Error(dc.id+" does not support "+type);
  }

};

initBestDCIdMap();
