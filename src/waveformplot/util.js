// @flow

import * as dataselect from '../fdsndataselect';
import * as miniseed from '../miniseed';
import * as d3 from 'd3';
let RSVP = dataselect.RSVP;
const moment = miniseed.model.moment;

export { dataselect, miniseed, d3, RSVP, moment };

/** deprecated - use createPlotsBySelectorPromise instead.
  *
  * create seismogram plots by selecting elements using the supplied
  * css selector. Each element is expected to have attributes defined
  * for net, sta, loc, chan and two of start, end and duration.
  * Optionally, end will default to NOW if neither start or end are
  * given, so only giving duration shows the most recent duration seconds
  * from current time. Optionally, host may be given to choose an Fdsn
  * FDSN dataselect web service for data retrieval, which defaults to
  * service.iris.edu.
  *
  * Note that css style for the selector should set both stoke to a color
  * and fill to none in order for the seismogram to display.
  * This can be done by: <br>
  * yourselector {
  *   stroke: skyblue;
  *   fill: none;
  * }<br/>
  * @deprecated use seisplotjs-fdsndataselect to load data records
  */
export function createPlotsBySelectorWithCallback(selector :string, callback: ( error ?: Error, dataRecords ?: Array<miniseed.DataRecord>) => void) {
   createPlotsBySelectorPromise(selector)
   .then(function(plotData: PlotDataType) {
     return plotData.segments;
   })
     .then(function(dataRecords :Array<miniseed.DataRecord>) {
       callback(undefined, dataRecords);
     }).catch(function(error :Error) {
       callback(error, undefined);
     });
}

export type PlotDataType = {
  "segments": Array<Array<miniseed.model.Seismogram>>,
  "startDate": moment,
  "endDate": moment,
  "request": dataselect.DataSelectQuery,
  "svgParent": any,
  "responseText": string,
  "statusCode": number
};

/** Returns an array of Promises, one per selected element.
*/
export function createPlotsBySelectorPromise(selector :string) :Promise<Array<PlotDataType>> {
  let clockOffset = 0; // should set from server
  let out = [];
  d3.selectAll(selector).each(function() {
    let svgParent = d3.select(this);
    let url;
    let start = svgParent.attr("start") ? svgParent.attr("start") : null;
    let end = svgParent.attr("end") ? svgParent.attr("end") : null;
    console.log("start end attr: "+start+" "+end+" "+(typeof end));
    let duration = svgParent.attr("duration");
    let startDate = null;
    let endDate = null;
    if (svgParent.attr("href")) {
      url = svgParent.attr("href");
      out.push(new RSVP.Promise(function(resolve, reject) {
      loadParseSplitUrl(url,
        function(error, segments) {
          if ( ! error) {
            return {
              "segments": segments,
              "startDate": startDate,
              "endDate": endDate,
              "request": null,
              "svgParent": svgParent
            };
          } else {
            throw reject(error);
          }
        });
        }));
    } else {
      let net = svgParent.attr("net");
      let sta = svgParent.attr("sta");
      let loc = svgParent.attr("loc");
      let chan = svgParent.attr("chan");
      let host = svgParent.attr("host");
      let protocol = 'http:';
      if (! host) {
          host = "service.iris.edu";
      }
      if (document && "https:" == document.location.protocol) {
        protocol = 'https:';
      }

      let seisDates = dataselect.calcStartEndDates(start, end, duration, clockOffset);
      startDate = seisDates.start;
      endDate = seisDates.end;
      let request = formRequest(protocol, host, net, sta, loc, chan, startDate, endDate);
      out.push(request.query().then(function(dataRecords) {
        let byChannel = miniseed.byChannel(dataRecords);
        let keys = Array.from(byChannel.keys());
        let segments = [];
        for(let i=0; i<keys.length; i++) {
          let key = keys[i];
          segments.push(miniseed.merge(byChannel.get(key)));
        }
        return segments;
      }).then(function(segments) {
        return {
          "segments": segments,
          "startDate": startDate,
          "endDate": endDate,
          "request": request,
          "svgParent": svgParent
        };
      }, function(result) {
        // rejection, so no inSegments
        // but may need others to display message
        return {
          "segments": [],
          "startDate": start,
          "endDate": end,
          "request": request,
          "svgParent": svgParent,
          "responseText": String.fromCharCode.apply(null, new Uint8Array(result.response)),
          "statusCode": result.status
        };
      }));
    }
  });
  return RSVP.all(out);
}

export function calcClockOffset(serverTime :moment) {
  return dataselect.calcClockOffset(serverTime);
}

/**
Any two of start, end and duration can be specified, or just duration which
then assumes end is now.
start and end are Moment objects, duration is in seconds.
clockOffset is the milliseconds that should be subtracted from the local time
 to get real world time, ie local - UTC
 or new Date().getTime() - serverDate.getTime()
 default is zero.
*/
export function calcStartEndDates(start?: moment, end?: moment, duration?: number, clockOffset?: number) {
  return dataselect.calcStartEndDates(start, end, duration, clockOffset);
}

/**
* @deprecated use seisplotjs-fdsndataselect directly to create request
*/
export function formRequest(protocol, host, net, sta, loc, chan, startDate, endDate) {
  let dsQuery = new dataselect.DataSelectQuery()
      .protocol(protocol)
      .host(host)
      .networkCode(net)
      .stationCode(sta)
      .locationCode(loc)
      .channelCode(chan)
      .startTime(startDate)
      .endTime(endDate);
  return dsQuery;
}

/**
* @deprecated use seisplotjs-fdsndataselect to load data records
*/
export function formRequestUrl(protocol, host, net, sta, loc, chan, startDate, endDate) {
   return formRequest(protocol, host, net, sta, loc, chan, startDate, endDate).formURL();
}

/**
* @deprecated use seisplotjs-fdsndataselect to load data records
*/
export function loadParseSplit(protocol, host, net, sta, loc, chan, startDate, endDate, callback) {
  let url = formRequestUrl(protocol, host, net, sta, loc, chan, startDate, endDate);
  loadParseSplitUrl(url, callback);
}


/** loads and parses data into an array of miniseed records
 * @deprecated use seisplotjs-fdsndataselect to load data records
 */
export function loadParse(url, callback) {
  console.warn("seisplotjs-waveformplot.loadParse is deprecated, use seisplotjs-fdsndataselect instead");
  d3.buffer(url)
    .responseType("arraybuffer")
    .get(null,
        function(error, data) {
          if (error) {
            callback(error, null);
          } else if (data) {
            let dataRecords = miniseed.parseDataRecords(data.response);
            callback(null, dataRecords);
          } else {
            callback(new Error("Data is null"), null);
          }
        });
}

/**
* @deprecated use seisplotjs-fdsndataselect to load data records
*/
export function loadParseSplitUrl(url, callback) {
  loadParse(url, function(error, dataRecords) {
      if (error) {
        callback(error, null);
      } else {
        let byChannel = miniseed.byChannel(dataRecords);
        let keys = Array.from(byChannel.keys());
        let segments = [];
        for(let i=0; i<keys.length; i++) {
          let key = keys[i];
          segments.push(miniseed.merge(byChannel.get(key)));
        }
        callback(null, segments);
      }
  });
}

export type TimeWindow = {start: moment, end: moment};
import type {TimeRangeType} from './chooser';

export function findStartEnd(data: Array<miniseed.model.Seismogram> | miniseed.model.Seismogram, accumulator?: TimeRangeType) :TimeRangeType {
    let out :TimeRangeType;
    if ( ! accumulator) {
      out = {start: moment.utc('2500-01-01'), end: moment.utc('1001-01-01'), duration: 0 };
    } else {
      out = accumulator;
    }
    if ( Array.isArray(data)) {
       for(let i=0; i< data.length; i++) {
         out = findStartEnd(data[i], out);
       }
    } else {
       // assume single segment object


       if ( ! accumulator || data.start() < accumulator.start) {
         out.start = data.start();
       }
       if ( ! accumulator || accumulator.end < data.end() ) {
         out.end = data.end();
       }
       accumulator = out;
    }
    return out;
  }

export function findMinMax(data: Array<miniseed.model.Seismogram> | miniseed.model.Seismogram, minMaxAccumulator ?: Array<number>) :Array<number> {
    if ( Array.isArray(data)) {
       for(let i=0; i< data.length; i++) {
         minMaxAccumulator = findMinMax(data[i], minMaxAccumulator);
       }
    } else {
       // assume single segment object
       minMaxAccumulator = miniseed.segmentMinMax(data, minMaxAccumulator);
    }
    if (minMaxAccumulator) {
      return minMaxAccumulator;
    } else {
      return [-1, 1];
    }
  }
