// @flow

import * as dataselect from '../fdsndataselect';
import * as miniseed from '../miniseed';
import * as d3 from 'd3';
let RSVP = dataselect.RSVP;
const moment = miniseed.model.moment;

export { dataselect, miniseed, d3, RSVP, moment };

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
    console.log("start end attr: ${start} ${end} "+(typeof end));
    let duration = svgParent.attr("duration");
    let startDate = null;
    let endDate = null;
    if (svgParent.attr("href")) {
      url = svgParent.attr("href");
      return fetch(url)
        .then(response => {
          if (response.ok) {
            return response.arrayBuffer();
          } else {
            throw new Error("Fetching over network was not ok: "+response.status+" "+response.statusText);
          }
        })
        .then(ab => {
          return {
            "segments": miniseed.mergeByChannel(miniseed.parseDataRecords(ab)),
            "startDate": startDate,
            "endDate": endDate,
            "request": null,
            "svgParent": svgParent
          };
        });
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
      let request = new dataselect.DataSelectQuery()
        .protocol(protocol)
        .host(host)
        .networkCode(net)
        .stationCode(sta)
        .locationCode(loc)
        .channelCode(chan)
        .startTime(startDate)
        .endTime(endDate);
      out.push(request.query().then(function(dataRecords) {
        return miniseed.mergeByChannel(dataRecords);
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

export type TimeWindow = {start: moment, end: moment};
import type {TimeRangeType} from './chooser';

export function findStartEnd(data: Array<miniseed.model.Seismogram> | miniseed.model.Seismogram, accumulator?: TimeRangeType) :TimeRangeType {
    let out :TimeRangeType;
    if ( ! accumulator && ! data) {
      throw new Error("data and accumulator are not defined");
    } else if ( ! accumulator) {
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


       if ( ! accumulator || data.start < accumulator.start) {
         out.start = data.start;
       }
       if ( ! accumulator || accumulator.end < data.end ) {
         out.end = data.end;
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
