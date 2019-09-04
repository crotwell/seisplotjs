// @flow

/**
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */

import moment from 'moment';
import RSVP from 'rsvp';
import * as d3 from 'd3';
import * as dataselect from './fdsndataselect.js';
import * as miniseed from './miniseed.js';
import {Seismogram, SeismogramDisplayData} from './seismogram.js';
import { SeismographConfig } from './seismographconfig';
import {Seismograph} from './seismograph.js';
import {StartEndDuration} from './util.js';

export { dataselect, miniseed, d3, RSVP, moment };

export type PlotDataType = {
  "seismograms": Array<Seismogram>,
  "startTime": moment,
  "endTime": moment,
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
    let startAttr = svgParent.attr("start") ? svgParent.attr("start") : null;
    let endAttr = svgParent.attr("end") ? svgParent.attr("end") : null;
    console.log("start end attr: ${startAttr} ${endAttr} "+(typeof endAttr));
    let duration = svgParent.attr("duration");
    let startTime = null;
    let endTime = null;
    if (svgParent.attr("href")) {
      // url to miniseed file
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
            "seismograms": miniseed.seismogramPerChannel(miniseed.parseDataRecords(ab)),
            "startTime": startTime,
            "endTime": endTime,
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
      if (document && "https:" === document.location.protocol) {
        protocol = 'https:';
      }

      let seisDates = new StartEndDuration(startAttr, endAttr, duration, clockOffset);
      startTime = seisDates.startTime;
      endTime = seisDates.endTime;
      // $FlowFixMe
      let request = new dataselect.DataSelectQuery()
        .protocol(protocol)
        .host(host)
        .networkCode(net)
        .stationCode(sta)
        .locationCode(loc)
        .channelCode(chan)
        .startTime(startTime)
        .endTime(endTime);
      out.push(request.querySeismograms().then(seismograms => {
        return {
          "seismograms": seismograms,
          "startTime": startTime,
          "endTime": endTime,
          "request": request,
          "svgParent": svgParent
        };
      }, function(result) {
        // rejection, so no inSegments
        // but may need others to display message
        return {
          "seismograms": [],
          "startTime": startAttr,
          "endTime": endAttr,
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
        if (result.seismograms.length >0) {
          let svgDiv = result.svgParent.append("div");
          svgDiv.classed("svg-container-wide", true);
          let seisConfig = new SeismographConfig();
          seisConfig.fixedTimeScale = new StartEndDuration(result.startTime, result.endTime);
          let seisData = result.seismograms.map(s => SeismogramDisplayData.fromSeismogram(s));
          let seismogram = new Seismograph(svgDiv, seisConfig, seisData);
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

export function alphabeticalSort(traceA: Seismogram, traceB: Seismogram) {
  if (traceA.codes() < traceB.codes()) {
    return -1;
  } else {
    return 1;
  }
}


export function insertCSS(cssText: string) {
  let head = document.head;
  if (head === null) {throw new Error("document.head is null");}
  let styleElement = document.createElement('style');
  styleElement.type = 'text/css';
  styleElement.appendChild(document.createTextNode(cssText));
  head.insertBefore(styleElement, head.firstChild);
}

export type TimeWindow = {startTime: moment, endTime: moment};
