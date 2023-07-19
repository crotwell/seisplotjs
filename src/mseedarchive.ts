/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */
import {DateTime, Duration, Interval} from "luxon";
import * as util from "./util";
import * as miniseed from "./miniseed";
import {SeismogramDisplayData} from "./seismogram";
import {Channel} from "./stationxml";
import {isDef} from "./util";

export const Allowed_Flags = ["n", "s", "l", "c", "Y", "j", "H"];

/**
 * A web based connection to an archive of miniseed files
 * arranged based on a pattern using n, s, l, c, Y, j, H
 * for network, station, locid, channel, year, day of year
 * and hour. This is a subset of the options available within
 * the IRIS Ringserver MSeedArchive option, on which this
 * is based. Retrieved seismograms are cut from the larger
 * miniseed files retrieved via http(s), and so there is
 * wasted bandwidth to the server. On the other hand this
 * requires no extra software on the server side beyond
 * a directory structure with suitably small miniseed files.
 * Generally we find channel-hour is a reasonable size for
 * most seismic channels. The URL to needed files is
 * constructed by concatenating the rootUrl with the pattern
 * using a time range large enough to get all overlaps
 * based on the smallest sample rate per channel band code
 * and record size, which defaults to 512.
 *
 */
export class MSeedArchive {
  _rootUrl: string;
  _pattern: string;
  _recordSize: number;
  _timeoutSec: number;

  constructor(rootUrl: string, pattern: string) {
    this._rootUrl = rootUrl;
    this._pattern = pattern;
    this._recordSize = 512;
    this._timeoutSec = 30;
    this.checkPattern(this._pattern);
  }

  get rootUrl(): string {
    return this._rootUrl;
  }

  get pattern(): string {
    return this._pattern;
  }

  get recordSize(): number {
    return this._recordSize;
  }

  /* eslint-disable jsdoc/no-multi-asterisks */

  /**
   * checks pattern for allowed flags as not all that are supported
   * by ringserver are supported here. Must only include:
   * * n network code, white space removed
   * * s station code, white space removed
   * * l  location code, white space removed
   * * c  channel code, white space removed
   * * Y  year, 4 digits
   * * j  day of year, 3 digits zero padded
   * * H  hour, 2 digits zero padded
   *
   * @param p mseed archive pattern string
   * @returns true if all flags are allowed
   */
  checkPattern(p: string): boolean {
    const regexp = /%[a-zA-Z]/g;
    const allFlags = p.match(regexp);

    if (!allFlags) {
      return false;
    } else {
      for (const f of allFlags) {
        if (Allowed_Flags.indexOf(f.slice(1)) === -1) {
          throw new Error(`${f} not allowed in pattern`);
        }
      }
    }

    return true;
  }

  /* eslint-enable jsdoc/no-multi-asterisks */

  /**
   * Loads seismograms from the remote miniseed archive via
   * http(s). Files downloaded include all that might overlap
   * the given time window based on record size,
   * the minimum sample rate
   * for the channel band code and the given time window.
   *
   * @param   channelTimeList requst channels and time windows
   * @returns Promise to the same SeismogramDisplayData array, but with seismograms populated
   */
  loadSeismograms(
    channelTimeList: Array<SeismogramDisplayData>,
  ): Promise<Array<SeismogramDisplayData>> {
    const promiseArray = channelTimeList.map(ct => {
      if (isDef(ct.channel)) {
        const request =  ct;
        const dataRecords = this.loadDataForChannel(
            ct.channel,
            ct.startTime,
            ct.endTime,
          );
        // this fakes an RSVP.hash call
        return Promise.all([request, dataRecords]).then((pArray) => {
          return {
            request: pArray[0],
            dataRecords: pArray[1],
          };
        });
      } else if (isDef(ct.sourceId)) {
        const request =  ct;
        const dataRecords = this.loadData(
            ct.sourceId.networkCode,
            ct.sourceId.stationCode,
            ct.sourceId.locationCode,
            ct.sourceId.formChannelCode(),
            ct.startTime,
            ct.endTime,
          );
        return Promise.all([request, dataRecords]).then((pArray) => {
          return {
            request: pArray[0],
            dataRecords: pArray[1],
          };
        });
      } else {
        throw new Error("channel is missing in loadSeismograms ");
      }
    });
    return Promise.all(promiseArray).then(pArray => {
      const out: Array<SeismogramDisplayData> = [];
      pArray.forEach(p => {
        const seisArray = miniseed.seismogramPerChannel(p.dataRecords);

        // should only be one
        for (const seis of seisArray) {
          const cutSeis = seis.cut(
            Interval.fromDateTimes(p.request.startTime, p.request.endTime),
          );
          p.request.seismogram = cutSeis;
          out.push(p.request);
        }
      });
      return out;
    });
  }

  /**
   * Loads miniseed records based on channel and time window.
   *
   * @param   channel   channel to request
   * @param   startTime start time
   * @param   endTime   end time
   * @returns Promise to array of miniseed records
   */
  loadDataForChannel(
    channel: Channel,
    startTime: DateTime,
    endTime: DateTime,
  ): Promise<Array<miniseed.DataRecord>> {
    return this.loadData(
      channel.station.network.networkCode,
      channel.station.stationCode,
      channel.locationCode,
      channel.channelCode,
      startTime,
      endTime,
      channel.sampleRate,
    );
  }

  /**
   * Loads miniseed records based on string channel codes.
   *
   * @param   net        network code
   * @param   sta        station code
   * @param   loc        location code
   * @param   chan       channel code
   * @param   startTime  start time
   * @param   endTime    end time
   * @param   sampleRate known sample rate for this channel
   * @returns             Promise to array of miniseed records
   */
  loadData(
    net: string,
    sta: string,
    loc: string,
    chan: string,
    startTime: DateTime,
    endTime: DateTime,
    sampleRate?: number,
  ): Promise<Array<miniseed.DataRecord>> {
    const basePattern = this.fillBasePattern(net, sta, loc, chan);

    if (!util.isDef(sampleRate)) {
      sampleRate = minSampleRate(chan);
    }

    const recordTime = maxTimeForRecord(this._recordSize, sampleRate);
    let t = startTime.minus(recordTime);
    const urlList = [];

    while (t < endTime) {
      const url = this.rootUrl + "/" + this.fillTimePattern(basePattern, t);
      t = t.plus(Duration.fromObject({hour: 1,}));
      urlList.push(url);
    }

    if (t.plus(recordTime) > endTime) {
      const url = this.rootUrl + "/" + this.fillTimePattern(basePattern, t);
      urlList.push(url);
    }

    return loadDataRecords(urlList).then(dataRecords => {
      if (dataRecords) {
        dataRecords = dataRecords.filter(
          dr =>
            dr.header.endTime >= startTime &&
            dr.header.startTime <= endTime
        );
      } else {
        dataRecords = [];
      }

      return dataRecords;
    });
  }

  /**
   * Replaces codes from channel in base pattern.
   *
   * @param   net  string to replace '%n'
   * @param   sta  string to replace '%s'
   * @param   loc  string to replace '%l'
   * @param   chan string to replace '%c'
   * @returns       new string with channel replacements made
   */
  fillBasePattern(net: string, sta: string, loc: string, chan: string): string {
    return this.pattern
      .replace(/%n/g, net)
      .replace(/%s/g, sta)
      .replace(/%l/g, loc)
      .replace(/%c/g, chan);
  }

  /**
   * Replaces time entries ( %Y, %j, %H ) in pattern.
   *
   * @param   basePattern pattern to replace in
   * @param   t           DateTime in time
   * @returns              string with time replaces
   */
  fillTimePattern(basePattern: string, t: DateTime): string {
    return basePattern
      .replace(/%Y/g, t.toFormat("yyyy"))
      .replace(/%j/g, t.toFormat("ooo"))
      .replace(/%H/g, t.toFormat("HH"));
  }
}
export function loadDataRecords(
  urlList: Array<string>,
  fetchInit?: RequestInit,
  timeoutSec?: number,
): Promise<Array<miniseed.DataRecord>> {
  const promiseArray = urlList.map(url => {
    return util
      .doFetchWithTimeout(url, fetchInit, timeoutSec)
      .then(fetchResponse => {
        if (fetchResponse.ok) {
          if (fetchResponse.status === 200 || fetchResponse.status === 304) {
            return fetchResponse.arrayBuffer().then(ab => {
              let dataRecords: Array<miniseed.DataRecord> = [];

              if (ab.byteLength > 0) {
                dataRecords = miniseed.parseDataRecords(ab);
              }

              return dataRecords;
            });
          } else if (fetchResponse.status === 404) {
            return []; // empty array means no data
          } else {
            util.log(
              "no data: status=" +
                fetchResponse.status +
                " " +
                fetchResponse.url,
            );
            return [];
          }
        } else if (fetchResponse.status === 404) {
          return []; // empty array means no data
        } else {
          throw new Error(
            "fetch error: " +
              fetchResponse.ok +
              " " +
              fetchResponse.status +
              " " +
              fetchResponse.url,
          );
        }
      })
      .catch(err => {
        util.log("caught fetch err, continuing with empty: " + String(err));
        return [];
      });
  });
  return Promise.all(promiseArray).then(pArray => {
    let dataRecords: Array<miniseed.DataRecord> = [];
    pArray.forEach(p => {
      dataRecords = dataRecords.concat(p);
    });
    return dataRecords;
  });
}

/**
 * Gives the maximum sample rate for the channel, based on the
 * band code, first char, of the channel code.
 *
 * @param chan channel code like BHZ, only the first letter is used
 * @returns mimumum sample rate this could be
 */
export function maxSampleRate(chan: string): number {
  const f = chan.slice(0, 1);

  switch (f) {
    case "F":
    case "G":
      return 5000;

    case "D":
    case "C":
      return 1000;

    case "E":
    case "H":
      return 250;

    case "S":
    case "B":
      return 80;

    case "M":
      return 10;

    case "L":
      return 1;

    case "V":
      return 0.1;

    case "U":
      return 0.01;

    case "R":
      return 0.001;

    case "P":
      return 0.0001;

    case "Q":
      return 0.000001;

    default:
      throw new Error("Unknown band code " + f + " in " + chan);
  }
}

/**
 * Gives the minimum sample rate for the channel, based on the
 * band code, first char, of the channel code.
 *
 * @param chan channel code like BHZ, only the first letter is used
 * @returns mimumum sample rate this could be
 */
export function minSampleRate(chan: string): number {
  const f = chan.slice(0, 1);

  switch (f) {
    case "F":
    case "G":
      return 1000;

    case "D":
    case "C":
      return 2500;

    case "E":
    case "H":
      return 80;

    case "S":
    case "B":
      return 10;

    case "M":
      return 1;

    case "L":
      return 1;

    // maybe wrong, seed manual not clear
    case "V":
      return 0.1;

    // maybe wrong, seed manual not clear
    case "U":
      return 0.01;

    // maybe wrong, seed manual not clear
    case "R":
      return 0.0001;

    case "P":
      return 0.00001;

    case "Q":
      return 0.0000001;

    default:
      throw new Error("Unknown band code " + f + " in " + chan);
  }
}

/**
 * Calculates the maximum time coverage for a single miniseed record
 * given the record size (usually 512 or 4096) and the sample rate (Hertz).
 * This assumes 40 bytes of header and maximum compression of 2 samples
 * per byte (4 bit per sample) which is the best Steim2.
 *
 * @param recordSize record size (usually 512 or 4096)
 * @param sampleRate sample rate of record
 * @returns maximum interval of time that a full record could cover when
 * compression is at its most efficient
 */
export function maxTimeForRecord(
  recordSize: number,
  sampleRate: number,
): Duration {
  return Duration.fromMillis(1000*((recordSize - 40) * 2) / sampleRate);
}
