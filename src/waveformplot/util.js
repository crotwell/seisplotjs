// @flow

import moment from 'moment';
import RSVP from 'rsvp';
import * as d3 from 'd3';
import * as dataselect from '../fdsndataselect';
import * as miniseed from '../miniseed';
import {SeismogramSegment, Seismogram} from '../seismogram';
import {SeismographConfig} from './seismographconfig';
import {CanvasSeismograph} from './canvasSeismograph';

export { dataselect, miniseed, d3, RSVP, moment };

export type PlotDataType = {
  "traceMap": Map<String, Seismogram>,
  "startDate": moment,
  "endDate": moment,
  "request": dataselect.DataSelectQuery,
  "svgParent": any,
  "responseText": string,
  "statusCode": number
};

/** Returns an array of Promises, one per selected element.
*/
export function createPlotsBySelectorPromise(selector: string): Promise<Array<PlotDataType>> {
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
            "traceMap": miniseed.mergeByChannel(miniseed.parseDataRecords(ab)),
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

      let seisDates = new dataselect.StartEndDuration(start, end, duration, clockOffset);
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
      out.push(request.querySeismograms().then(function(traceMap) {
        return {
          "traceMap": traceMap,
          "startDate": startDate,
          "endDate": endDate,
          "request": request,
          "svgParent": svgParent
        };
      }, function(result) {
        // rejection, so no inSegments
        // but may need others to display message
        return {
          "traceMap": new Map(),
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


export function createPlotsBySelector(selector: string) {
  return createPlotsBySelectorPromise(selector).then(function(resultArray){
    resultArray.forEach(function(result: PlotDataType) {
      result.svgParent.append("p").text("Build plot");
        if (result.traceMap.size >0) {
          let svgDiv = result.svgParent.append("div");
          svgDiv.classed("svg-container-wide", true);
          let seisConfig = new SeismographConfig();
          let seismogram = new CanvasSeismograph(svgDiv, seisConfig, Array.from(result.traceMap.values()), result.startDate, result.endDate);
          seismogram.draw();
        } else {
          result.svgParent.append("p").text("No Data");
          if (result.statusCode || result.responseText) {
            result.svgParent.append("p").text(result.statusCode +" "+ result.responseText);
          }
        }
      });
      return resultArray;
  });
}

export function calcClockOffset(serverTime: moment) {
  return dataselect.calcClockOffset(serverTime);
}

export type TimeWindow = {start: moment, end: moment};
import type {TimeRangeType} from '../seismogram';
