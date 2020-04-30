// @flow

/*
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
import {StartEndDuration, isDef } from './util.js';

export { dataselect, miniseed, d3, RSVP, moment };

export type PlotDataType = {
  "sddList": Array<SeismogramDisplayData>,
  "svgParent": any
};

/**
 * Returns an array of Promises, one per selected element. This assumes each
 * element has some combination of start, end, duration, net, sta, loc, and chan
 * attributes sufficient to form the data query. Or an href to a miniseed file.
 *
 * @param selector css selector
 * @returns promise to array of plot data types
 */
export function createPlotsBySelectorPromise(selector: string): Promise<Array<PlotDataType>> {
  let out = [];
  d3.selectAll(selector).each(function() {
    let svgParent = d3.select(this);
    let url;
    let startAttr = svgParent.attr("start") ? svgParent.attr("start") : null;
    let endAttr = svgParent.attr("end") ? svgParent.attr("end") : null;
    let duration = svgParent.attr("duration");
    let timeWindow = null;
    if (isDef(startAttr) || isDef(endAttr) || isDef(duration)) {
      timeWindow = new StartEndDuration(startAttr, endAttr, duration);
    } else {
      throw new Error(`Need at least one of start, end, duration.`);
    }
    if (svgParent.attr("href")) {
      // url to miniseed file
      url = svgParent.attr("href");
      out.push( fetch(url)
        .then(response => {
          if (response.ok) {
            return response.arrayBuffer();
          } else {
            throw new Error("Fetching over network was not ok: "+response.status+" "+response.statusText);
          }
        })
        .then(ab => {
          let seismograms = miniseed.seismogramPerChannel(miniseed.parseDataRecords(ab));
          let sddList = seismograms.map(s => {
              let sdd = SeismogramDisplayData.fromSeismogram(s);
              if (timeWindow) {sdd.timeWindow = timeWindow;}
              return sdd;
            });
          return {
            "sddList": sddList,
            "svgParent": svgParent,
          };
        }));
    } else {
      let net = svgParent.attr("net");
      let sta = svgParent.attr("sta");
      let loc = svgParent.attr("loc");
      let chan = svgParent.attr("chan");
      if (! ( net && sta && loc && chan)) {
        throw new Error(`Must set all of net, sta, loc, chan, but got ${net}, ${sta}, ${loc}, ${chan}`);
      }
      let host = svgParent.attr("host");
      if (! host) {
          host = "service.iris.edu";
      }

      // $FlowFixMe
      let request = new dataselect.DataSelectQuery().timeWindow(timeWindow);
      if (host) { request.host(host); }
      if (net) { request.networkCode(net); }
      if (sta) { request.stationCode(sta); }
      if (loc) { request.locationCode(loc); }
      if (chan) { request.channelCode(chan); }

      out.push(request.querySeismograms().then(seismograms => {
        let sddList = seismograms.map(s => {
            let sdd = SeismogramDisplayData.fromSeismogram(s);
            if (isDef(timeWindow)) { sdd.timeWindow = timeWindow; }
            return sdd;
          });
        return {
          "sddList": sddList,
          "svgParent": svgParent
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
        if (result.sddList.length >0) {
          let svgDiv = result.svgParent.append("div");
          svgDiv.classed("svg-container-wide", true);
          let seisConfig = new SeismographConfig();
          let seismogram = new Seismograph(svgDiv, seisConfig, result.sddList);
          seismogram.draw();
        } else {
          result.svgParent.append("p").text("No Data");
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
