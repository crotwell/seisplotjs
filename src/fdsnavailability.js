// @flow

import RSVP from 'rsvp';

RSVP.on('error', function(reason: string) {
  console.assert(false, reason);
});

// special due to flow
import {checkProtocol, moment, toIsoWoZ, hasArgs, hasNoArgs, isStringArg, isNumArg, checkStringOrDate, stringify} from './util';

import {ChannelTimeRange } from './fdsndataselect';

export const FORMAT_JSON = 'json';

export const IRIS_HOST = "service.iris.edu";

export class AvailabilityQuery {
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
  _networkCode: string;
  /** @private */
  _stationCode: string;
  /** @private */
  _locationCode: string;
  /** @private */
  _channelCode: string;
  /** @private */
  _startTime: moment;
  /** @private */
  _endTime: moment;
  /** @private */
  _quality: string;
  /** @private */
  _merge: string;
  /** @private */
  _limit: number;
  /** @private */
  _orderby: string;
  /** @private */
  _includerestricted: boolean;
  /** @private */
  _format: string;
  constructor(host?: string) {
    this._specVersion = 1;
    this._protocol = checkProtocol();
    if (host) {
      this._host = host;
    } else {
      this._host = IRIS_HOST;
    }
    this._port = 80;
  }
  /** Gets/Sets the version of the fdsnws spec, 1 is currently the only value.
   *  Setting this is probably a bad idea as the code may not be compatible with
   *  the web service.
  */
  specVersion(value?: number): number | AvailabilityQuery {
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
  */
  protocol(value?: string) :string | AvailabilityQuery {
    if (isStringArg(value)) {
      this._protocol = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._protocol;
    } else {
      throw new Error('value argument is optional or string, but was '+typeof value);
    }
  }
  /** Gets/Sets the remote host to connect to.
  */
  host(value?: string) :string | AvailabilityQuery {
    if (isStringArg(value)) {
      this._host = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._host;
    } else {
      throw new Error('value argument is optional or string, but was '+typeof value);
    }
  }
  /** Gets/Sets the nodata parameter, usually 404 or 204 (default), controlling
   * the status code when no matching data is found by the service.
   */
  nodata(value?: number): number | AvailabilityQuery {
    if (hasNoArgs(value)) {
      return this._nodata;
    } else if (hasArgs(value)) {
      this._nodata = value;
      return this;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  port(value?: number): number | AvailabilityQuery {
    if (hasNoArgs(value)) {
      return this._port;
    } else if (hasArgs(value)) {
      this._port = value;
      return this;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  networkCode(value?: string) :string | AvailabilityQuery {
    if (isStringArg(value)) {
      this._networkCode = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._networkCode;
    } else {
      throw new Error('value argument is optional or string, but was '+value);
    }
  }
  stationCode(value?: string) :string | AvailabilityQuery {
    if (isStringArg(value)) {
      this._stationCode = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._stationCode;
    } else {
      throw new Error('value argument is optional or string, but was '+value);
    }
  }
  locationCode(value?: string) :string | AvailabilityQuery {
    if (isStringArg(value)) {
      this._locationCode = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._locationCode;
    } else {
      throw new Error('value argument is optional or string, but was '+value);
    }
  }
  channelCode(value?: string) :string | AvailabilityQuery {
    if (isStringArg(value)) {
      this._channelCode = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._channelCode;
    } else {
      throw new Error('value argument is optional or string, but was '+value);
    }
  }
  startTime(value?: moment) :moment | AvailabilityQuery {
    if (hasNoArgs(value)) {
      return this._startTime;
    } else if (hasArgs(value)) {
      this._startTime = checkStringOrDate(value);
      return this;
    } else {
      throw new Error('value argument is optional or moment or string, but was '+typeof value);
    }
  }
  endTime(value?: moment) :moment | AvailabilityQuery {
    if (hasNoArgs(value)) {
      return this._endTime;
    } else if (hasArgs(value)) {
      this._endTime = checkStringOrDate(value);
      return this;
    } else {
      throw new Error('value argument is optional or moment or string, but was '+typeof value);
    }
  }
  quality(value?: string) :string | AvailabilityQuery {
    if (isStringArg(value)) {
      this._quality = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._quality;
    } else {
      throw new Error('value argument is optional or string, but was '+value);
    }
  }
  merge(value?: string) :string | AvailabilityQuery {
    if (isStringArg(value)) {
      this._merge = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._merge;
    } else {
      throw new Error('value argument is optional or string, but was '+value);
    }
  }
  limit(value?: number): number | AvailabilityQuery {
    if (hasNoArgs(value)) {
      return this._limit;
    } else if (hasArgs(value)) {
      this._limit = value;
      return this;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  orderby(value?: string) :string | AvailabilityQuery {
    if (isStringArg(value)) {
      this._orderby = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._orderby;
    } else {
      throw new Error('value argument is optional or string, but was '+value);
    }
  }
  includeResticted(value?: boolean): boolean | AvailabilityQuery {
    if (hasNoArgs(value)) {
      return this._includerestricted;
    } else if (hasArgs(value)) {
      this._includerestricted = value;
      return this;
    } else {
      throw new Error('value argument is optional or boolean, but was '+typeof value);
    }
  }

  format(value?: string) :string | AvailabilityQuery {
    if (isStringArg(value)) {
      this._format = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._format;
    } else {
      throw new Error('value argument is optional or string, but was '+value);
    }
  }
  computeStartEnd(start ?:moment, end ?:moment, duration ?:number, clockOffset ?:number) :DataSelectQuery {
    let se = new StartEndDuration(start, end, duration, clockOffset);
    this.startTime(se.start);
    this.endTime(se.end);
    return this;
  }

  query() :Promise<Array<ChannelTimeRange>> {
    return this.queryRaw().then(function(rawBuffer) {
        let dataRecords = miniseed.parseDataRecords(rawBuffer);
        return dataRecords;
    });
  }
  queryRaw() {
    let mythis = this;
    let promise = new RSVP.Promise(function(resolve, reject) {
      let client = new XMLHttpRequest();
      let url = mythis.formURL();
console.log("fdsnDataSelect URL: "+url);
      client.open("GET", url);
      client.ontimeout = function(e) {
        this.statusText = "Timeout "+this.statusText;
        reject(this);
      };
      client.onreadystatechange = handler;
      client.responseType = "arraybuffer";
      client.setRequestHeader("Accept", "application/vnd.fdsn.mseed");
      client.send();

      function handler() {
        if (this.readyState === this.DONE) {
          if (this.status === 200) {
            resolve(this.response);
          } else if (this.status === 204 || (mythis.nodata() && this.status === mythis.nodata())) {
            // no data, so resolve success but with empty array
            resolve( new ArrayBuffer(0) );
          } else {
            reject(this);
          }
        }
      }
    });
    return promise;
  }

  postQueryDataRecords(channelTimeList: Array<ChannelTimeRange>) :Promise<Array<miniseed.DataRecord>> {
    return this.postQueryRaw(channelTimeList)
    .then( fetchResponse => {
      if(fetchResponse.ok) {
        return fetchResponse.arrayBuffer().then(ab => {
          console.log(`fetch response ok, bytes=${ab.byteLength}  ${(typeof ab)}`)
          return miniseed.parseDataRecords(ab);
        });
      } else {
        console.log("fetchRespone not ok");
        return [];
      }
    });
  }
  postQuery(channelTimeList: Array<ChannelTimeRange>) :Promise<Map<string, Array<seismogram.Seismogram>>> {
    return this.postQueryRaw(channelTimeList).then(jsonChanTimes => {
      return miniseed.mergeByChannel(dataRecords);
    });
  }
  postExtent(channelTimeList: Array<ChannelTimeRange>) :Promise<Map<string, Array<seismogram.Trace>>> {
    return this.postExtentRaw(channelTimeList).then(jsonChanTimes => {
      return miniseed.tracePerChannel(dataRecords);
    });
  }

  postExtentRaw(channelTimeList: Array<ChannelTimeRange>) :Promise<Response> {
    return postRaw(channelTimeList, 'extent');
  }
  postQueryRaw(channelTimeList: Array<ChannelTimeRange>) :Promise<Response> {
    return postRaw(channelTimeList, 'query');
  }
  postRaw(channelTimeList: Array<ChannelTimeRange>, method: String) :Promise<Response> {
    if (channelTimeList.length === 0) {
      // return promise faking an not ok fetch response
      console.log("Empty chan length so return fake fetch promise");
      return RSVP.hash({
        ok: false
      });
    } else {
      return fetch(this.formBaseURL()+`/${method}?`, {
          method: "POST",
          mode: "cors",
          referrer: "seisplotjs",
          body: this.createPostBody(channelTimeList),
        });
    }
  }

  extractFromJson(jsonChanTimes) {
    let out = [];
    let knownNets = new Map();
    for (let ds of jsonChanTimes.datasources) {
      if ( ! knownNets.has(ds.network)) {
        knownNets.set(ds.network, new Network())
      }
      let n = knownNets.get(ds.network);
      let s = null;
      for (let ss of n.stations) {
        if (ss.stationCode === ds.station) {
          s = ss;
        }
      }
      if ( ! s) {
        s = new Station(n, ds.station);
        n.stations.push(s);
      }
      let fake = new seisplotjs.stationxml.Channel(s, ds.channel, ds.locationCode);
      if (ds.earliest && ds.latest){
        out.push(new ChannelTimeRange(c, moment.utc(ds.earliest), moment.utc(ds.latest)));
      } else if (ds.timespans) {
        for (let ts of ds.timespans) {
          out.push(new ChannelTimeRange(c, moment.utc(ts[0]), moment.utc(ts[1])));
        }
      }
    }
  }

  createPostBody(channelTimeList: Array<ChannelTimeRange>) :string {
    let out = "";
    for (let ct of channelTimeList) {
      let sta = ct.channel.station;
      let net = sta.network;
      out += `${net.networkCode} ${sta.stationCode} ${ct.channel.locationCode} ${ct.channel.channelCode} ${ct.startTime.toISOString()} ${ct.endTime.toISOString()}`;
      out += '\n';
    }
    return out;
  }

  formBaseURL() :string {
      let colon = ":";
      if (this._protocol.endsWith(colon)) {
        colon = "";
      }
      return this._protocol+colon+"//"+this._host+(this._port==80?"":(":"+this._port))+"/fdsnws/availability/"+this._specVersion;
  }

  formVersionURL() :string {
    return this.formBaseURL()+"/version";
  }

  queryVersion() :Promise<string> {
    let mythis = this;
    let promise = new RSVP.Promise(function(resolve, reject) {
      let url = mythis.formVersionURL();
      let client = new XMLHttpRequest();
      client.open("GET", url);
      client.onreadystatechange = handler;
      client.responseType = "text";
      client.setRequestHeader("Accept", "text/plain");
      client.send();

      function handler() {
        if (this.readyState === this.DONE) {
          if (this.status === 200) {
            resolve(this.response);
          } else {
            reject(this);
          }
        }
      }
    });
    return promise;
  }

  makeParam(name :string, val :mixed) :string {
    return name+"="+encodeURIComponent(stringify(val))+"&";
  }

  formURL(method :string) :string {
    if (hasNoArgs(method)) {
      method = "query";
    }
    let url = this.formBaseURL()+`/${method}?`;
    if (this._networkCode) { url = url+this.makeParam("net", this.networkCode());}
    if (this._stationCode) { url = url+this.makeParam("sta", this.stationCode());}
    if (this._locationCode) { url = url+this.makeParam("loc", this.locationCode());}
    if (this._channelCode) { url = url+this.makeParam("cha", this.channelCode());}
    if (this._startTime) { url = url+this.makeParam("starttime", toIsoWoZ(this.startTime()));}
    if (this._endTime) { url = url+this.makeParam("endtime", toIsoWoZ(this.endTime()));}
    if (this._quality) { url = url+this.makeParam("quality", this.quality());}
    if (this._merge) { url = url+this.makeParam("merge", this.merge());}
    if (this._limit && this._limit>0) { url = url+this.makeParam("limit", this.limit());}
    if (this._orderby) { url = url+this.makeParam("orderby", this.orderby());}
    if (this._includerestricted) { url = url+this.makeParam("includerestricted", this.includeRestriced());}
    if (this._minimumLength) { url = url+this.makeParam("minimumlength", this.minimumLength());}
    if (this._repository) { url = url+this.makeParam("repository", this.repository());}
    if (this._longestOnly) { url = url+this.makeParam("longestonly", this.longestOnly());}
    if (this._format) { url = url+this.makeParam("format", this.format());}
    if (this._nodata) { url = url+this.makeParam("nodata", this.nodata());}

    if (url.endsWith('&') || url.endsWith('?')) {
      url = url.substr(0, url.length-1); // zap last & or ?
    }
    return url;
  }
}
