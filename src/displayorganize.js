// @flow

import { fftForward }    from './fft.js';
import { FFTPlot }       from './fftplot.js';
import { ParticleMotion }       from './particlemotion.js';
import { Quake } from './quakeml.js';
import { Station } from './stationxml.js';
import { SeismogramDisplayData } from './seismogram.js';
import {Seismograph} from './seismograph.js';
import {SeismographConfig} from './seismographconfig.js';
import {isDef} from './util.js';
import * as d3 from 'd3';
import * as L from 'leaflet';
import * as querystringify from 'querystringify';
import Handlebars from 'handlebars';

export const SEISMOGRAPH = 'seismograph';
export const SPECTRA = 'amp_spectra';
export const PARTICLE_MOTION = 'particlemotion';
export const MAP = 'map';
export const INFO = 'info';
export const QUAKE_TABLE = 'quake_table';
export const STATION_TABLE = 'station_table';

export class OrganizedDisplay {
  plottype: string;
  seisData: Array<SeismogramDisplayData>;
  seisConfig: SeismographConfig;
  seismograph: Seismograph | null;
  fftPlot: FFTPlot | null;
  particleMotionPlot: ParticleMotion | null;
  attributes: Map<string, any>;
  constructor(seisData: Array<SeismogramDisplayData>, plottype?: string = SEISMOGRAPH) {
    this.plottype = plottype;
    this.seisData = seisData;
    this.seisConfig = new SeismographConfig();
    this.seismograph = null;
    this.fftPlot = null;
    this.particleMotionPlot = null;
    this.attributes = new Map();
  }
  setAttribute(key: string, value: any) {
    this.attributes.set(key, value);
  }
  hasAttribute(key: string): boolean {
    return this.attributes.has(key);
  }
  getAttribute(key: string): any {
    if (this.attributes.has(key)) {
      return this.attributes.get(key);
    }
    return null;
  }
  plot(divElement: any) {
    let qIndex = this.plottype.indexOf('?');
    let plotstyle = this.plottype;
    let queryParams = {};
    if (qIndex !== -1) {
      queryParams = querystringify.parse(this.plottype.substring(qIndex));
      plotstyle = this.plottype.substring(0, qIndex);
    }
    divElement.attr("plottype", plotstyle);
    if (this.plottype.startsWith(SEISMOGRAPH)) {
      this.seismograph = new Seismograph(divElement, this.seisConfig, this.seisData);
      this.seismograph.draw();
    } else if (this.plottype.startsWith(SPECTRA)) {
      let loglog = getFromQueryParams(queryParams, 'loglog', 'true');
      loglog = (queryParams.loglog.toLowerCase() === 'true');
      let nonContigMsg = "non-contiguous seismograms, skipping: "+
        this.seisData.filter(sdd => !(sdd.seismogram && sdd.seismogram.isContiguous()))
        // $FlowIgnore[incompatible-use]
        .map(sdd => isDef(sdd.seismogram) ? `${sdd.codes()} ${sdd.seismogram.segments.length}` : "null").join(',');
      console.error(nonContigMsg);
      let fftList = this.seisData.map(sdd => {
        return sdd.seismogram && sdd.seismogram.isContiguous() ? fftForward(sdd) : null;
      });
      let fftListNoNull = fftList.filter(Boolean);
      this.fftPlot = new FFTPlot(divElement, this.seisConfig, fftListNoNull, loglog);
      this.fftPlot.draw();
    } else if (this.plottype.startsWith(PARTICLE_MOTION)) {
      if (this.seisData.length !== 2) {
        throw new Error(`particle motion requies exactly 2 seisData in seisDataList, ${this.seisData.length}`);
      }

      let pmpSeisConfig = this.seisConfig.clone();
      pmpSeisConfig.yLabel = this.seisData[1].channelCode;
      pmpSeisConfig.xLabel = this.seisData[0].channelCode;

      this.particleMotionPlot = new ParticleMotion(divElement, pmpSeisConfig, this.seisData[0], this.seisData[1]);
      this.particleMotionPlot.draw();
    } else if (this.plottype.startsWith(MAP)) {
      const mapid = 'map'+(((1+Math.random())*0x10000)|0).toString(16).substring(1);
      divElement.classed("map", true).attr('id', mapid);
      const centerLat = parseFloat(getFromQueryParams(queryParams, 'centerLat', '35'));
      const centerLon = parseFloat(getFromQueryParams(queryParams, 'centerLat', '-100'));
      const mapZoomLevel = parseInt(getFromQueryParams(queryParams, 'zoom', '1'));
      const magScale = parseFloat(getFromQueryParams(queryParams, 'magScale', '5.0'));
      const mymap = L.map(mapid).setView([ centerLat, centerLon], mapZoomLevel);
      L.tileLayer('http://services.arcgisonline.com/arcgis/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 17,
        attribution: 'Map data: <a href="https://services.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer">Esri, Garmin, GEBCO, NOAA NGDC, and other contributors</a>)'
      }).addTo(mymap);

      uniqueQuakes(this.seisData).forEach(q => {
        let circle = L.circleMarker([q.latitude, q.longitude], {
          color: 'red',
          fillColor: '#f03',
          fillOpacity: 0.15,
          radius: q.magnitude ? (q.magnitude.mag* magScale) : 3 // in case no mag
        }).addTo(mymap);
        circle.bindTooltip(q.time.toISOString()+" "+(q.magnitude ? (q.magnitude.mag+" "+q.magnitude.type) : "unkn"));
      });
      uniqueStations(this.seisData).forEach(s => {
        let m = L.marker([s.latitude, s.longitude]);
        m.addTo(mymap);
        m.bindTooltip(s.codes());
      });

    } else if (this.plottype.startsWith(INFO)) {
      let infoTemplate = defaultInfoTemplate;
      if (this.getAttribute("infoTemplate")) {
        infoTemplate = this.getAttribute("infoTemplate");
      }
      stationInfoPlot(divElement, this.seisConfig, this.seisData, infoTemplate);
    } else {
      throw new Error(`Unkown plottype "${this.plottype}"`);
    }
  }
}

export function getFromQueryParams(qParams: {}, name: string, defaultValue: string = ""): string {
  if (name in qParams) {
    return qParams[name];
  }
  return defaultValue;
}

export function individualDisplay(sddList: Array<SeismogramDisplayData>): Array<OrganizedDisplay> {
  return sddList.map(sdd => new OrganizedDisplay( [ sdd ] ));
}

export function mapAndIndividualDisplay(sddList: Array<SeismogramDisplayData>): Array<OrganizedDisplay> {
  let map = new OrganizedDisplay( sddList, MAP );
  let individual = individualDisplay(sddList);
  individual.unshift(map);
  return individual;
}

export function overlayBySDDFunction(sddList: Array<SeismogramDisplayData>, key: string, sddFun: (SeismogramDisplayData => string | number | null)): Array<OrganizedDisplay> {
  let out = [];
  sddList.forEach(sdd => {
    let found = false;
    const val = sddFun(sdd);
    if (! isDef(val) ) {
      // do not add/skip sdd that sddFun returns null
      return;
    }
    out.forEach(org => {
      if (org.getAttribute(key) === val) {
        org.seisData.push(sdd);
        found = true;
      }
    });
    if (! found) {
      const org = new OrganizedDisplay( [ sdd ] );
      org.setAttribute(key, val);
      out.push(org);
    }
  });
  return sortByKey(out, key);
}

export function overlayByComponent(sddList: Array<SeismogramDisplayData>): Array<OrganizedDisplay> {
  return overlayBySDDFunction(sddList, "component", (sdd => sdd.channelCode.charAt(2)));
}

export function overlayByStation(sddList: Array<SeismogramDisplayData>): Array<OrganizedDisplay> {
  return overlayBySDDFunction(sddList, "station", (sdd => sdd.networkCode+'_'+sdd.stationCode));
}

export function overlayAll(sddList: Array<SeismogramDisplayData>): Array<OrganizedDisplay> {
  return overlayBySDDFunction(sddList, "all", (() => "all"));
}

export function sortByKey(organized: Array<OrganizedDisplay>, key: string): Array<OrganizedDisplay> {
  organized.sort((orgA, orgB) => {
    const valA = orgA.getAttribute(key);
    const valB = orgB.getAttribute(key);
    if ( ! valA && ! valB) {
      return 0;
    } else if ( ! valA) {
      return 1;
    } else if (! valB) {
      return -1;
    } else if (valA < valB) {
      return -1;
    } else if (valA > valB) {
      return 1;
    } else {
      return 0;
    }
  });
  return organized;
}

/**
 * Groups seismic data into subarrays where members of each subarray are
 * from the same network/station, have the same band and gain/instrument code
 * and overlap in time. Note, in most cases the subarrays will have
 * 1, 2 or 3 elements, but this is not checked nor guaranteed.
 *
 * @param   sddList list of SeismogramDisplayData to split
 * @returns          array of array of data, organized by component of motion
 */
export function groupComponentOfMotion(sddList: Array<SeismogramDisplayData>): Array<Array<SeismogramDisplayData>> {
  let tmpSeisDataList = Array.from(sddList);
  const bifurcate = (arr, filter) =>
      arr.reduce((acc, val) => (acc[filter(val) ? 0 : 1].push(val), acc), [[], []]);
  const byFriends = [];
  while (tmpSeisDataList.length > 0) {
    const first = tmpSeisDataList.shift();
    const isFriend = (sdddB) => first.networkCode === sdddB.networkCode
        && first.stationCode === sdddB.stationCode
        && first.locationCode === sdddB.locationCode
        && first.channelCode.slice(0,2) === sdddB.channelCode.slice(0,2)
        && first.timeWindow.overlaps(sdddB.timeWindow);
    const splitArray = bifurcate(tmpSeisDataList, isFriend);
    let nextGroup = splitArray[0];
    nextGroup.unshift(first);
    byFriends.push(nextGroup);
    tmpSeisDataList = splitArray[1];
  }
  return byFriends;
}

export function createAttribute(organized: Array<OrganizedDisplay>,
                                key: string,
                                valueFun: (OrganizedDisplay => string | number | null)
                               ): Array<OrganizedDisplay> {
  organized.forEach(org => {
    if (org.seisData.length > 0) {
      const v = valueFun(org);
      org.setAttribute(key, v);
    } else {
      org.setAttribute(key, null);
    }
  });
  return organized;
}

export function sortDistance(organized: Array<OrganizedDisplay>): Array<OrganizedDisplay> {
  const key = "distance";
  createAttribute(organized, key, attributeDistance);
  return sortByKey(organized, key);
}

export function attributeDistance(orgDisp: OrganizedDisplay): number | null {
  orgDisp.seisData.forEach(sdd => {
    if (sdd.hasQuake && sdd.hasChannel ) {
      const distaz = sdd.distaz;
      return distaz ? distaz.delta : null;
    }
  });
  return null;
}

export function uniqueStations(seisData: Array<SeismogramDisplayData>): Array<Station> {
  const out = new Set();
  seisData.forEach( sdd => {
    if (sdd.channel) { out.add(sdd.channel.station);}
  });
  return Array.from(out.values());
}

export function uniqueQuakes(seisData: Array<SeismogramDisplayData>): Array<Quake> {
  const out = new Set();
  seisData.forEach( sdd => {
    sdd.quakeList.forEach( q => out.add(q));
  });
  return Array.from(out.values());
}

export function createPlots(organized: Array<OrganizedDisplay>, divElement: any) {
  // arrow function doesn't work well with d3.select(this)
  divElement.selectAll("div").data(organized)
  .enter().append("div").each(function(org) {
    const div = d3.select(this);
    org.plot(div);
  });
}

export const defaultInfoTemplate = `
  <table>
    <tr>
      <th colspan="6">Waveform</th>
      <th colspan="4">Channel</th>
      <th colspan="5">Event</th>
      <th colspan="4">DistAz</th>
    </tr>
    <tr>
      <th>Codes</th>
      <th>Start</th>
      <th>Duration</th>
      <th>End</th>
      <th>Num Pts</th>
      <th>Sample Rate</th>

      <th>Lat</th>
      <th>Lon</th>
      <th>Elev</th>
      <th>Depth</th>

      <th>Time</th>
      <th>Lat</th>
      <th>Lon</th>
      <th>Mag</th>
      <th>Depth</th>

      <th>Dist deg</th>
      <th>Dist km</th>
      <th>Azimuth</th>
      <th>Back Azimuth</th>
    </tr>
  {{#each seisDataList as |sdd|}}
    <tr>
      <td>{{sdd.nslc}}</td>
      <td>{{formatIsoDate sdd.seismogram.startTime}}</td>
      <td>{{formatDuration sdd.seismogram.timeWindow.duration}}</td>
      <td>{{formatIsoDate sdd.seismogram.endTime}}</td>
      <td>{{sdd.seismogram.numPoints}}</td>
      <td>{{sdd.seismogram.sampleRate}}</td>

      {{#if sdd.hasChannel}}
        <td>{{sdd.channel.latitude}}</td>
        <td>{{sdd.channel.longitude}}</td>
        <td>{{sdd.channel.elevation}}</td>
        <td>{{sdd.channel.depth}}</td>
      {{else}}
        <td>no channel</td>
        <td/>
        <td/>
        <td/>
      {{/if}}

      {{#if sdd.hasQuake}}
        <td>{{formatIsoDate sdd.quake.time}}</td>
        <td>{{sdd.quake.latitude}}</td>
        <td>{{sdd.quake.longitude}}</td>
        <td>{{sdd.quake.magnitude.mag}} {{sdd.quake.magnitude.type}}</td>
        <td>{{sdd.quake.depthKm}}</td>
      {{else}}
        <td>no quake</td>
        <td/>
        <td/>
        <td/>
        <td/>
      {{/if}}
      {{#if sdd.hasQuake }}
        {{#if sdd.hasChannel }}
          <td>{{formatNumber sdd.distaz.distanceDeg 2}}</td>
          <td>{{formatNumber sdd.distaz.distanceKm 0}}</td>
          <td>{{formatNumber sdd.distaz.az 2}}</td>
          <td>{{formatNumber sdd.distaz.baz 2}}</td>
        {{/if}}
      {{/if}}
    </tr>
  {{/each}}
  </table>
`;

export function stationInfoPlot(divElement: any,
                                seismographConfig: SeismographConfig,
                                seisDataList: Array<SeismogramDisplayData>,
                                handlebarsTemplate: string ) {
  if ( ! handlebarsTemplate) { handlebarsTemplate = defaultInfoTemplate; }
  let handlebarsCompiled = Handlebars.compile(handlebarsTemplate);
  divElement.html(handlebarsCompiled({
      seisDataList: seisDataList,
      seisConfig: seismographConfig
    },
    {
      allowProtoPropertiesByDefault: true // this might be a security issue???
    }));
}
