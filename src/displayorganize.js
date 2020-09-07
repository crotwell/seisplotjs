// @flow

import { SeismogramDisplayData } from './seismogram.js';
import {Seismograph} from './seismograph.js';
import {SeismographConfig} from './seismographconfig.js';
import {isDef} from './util.js';
import * as d3 from 'd3';
import * as L from 'leaflet';

export const SEISMOGRAPH = 'seismograph';
export const SPECTRA = 'amp_spectra';
export const PARTICLE_MOTION = 'particlemotion';
export const MAP = 'map';
export const QUAKE_TABLE = 'quake_table';
export const STATION_TABLE = 'station_table';

export class OrganizedDisplay {
  plottype: string;
  seisData: Array<SeismogramDisplayData>;
  seisConfig: SeismographConfig;
  seismograph: Seismograph | null;
  attributes: Map<string, any>;
  constructor(seisData: Array<SeismogramDisplayData>, plottype?: string = 'seismograph') {
    this.plottype = plottype;
    this.seisData = seisData;
    this.seisConfig = new SeismographConfig();
    this.seismograph = null;
    this.attributes = new Map();
  }
  setAttribute(key: string, value: any) {
    this.attributes.set(key, value);
  }
  getAttribute(key: string) {
    if (this.attributes.has(key)) {
      return this.attributes.get(key);
    }
    return null;
  }
  plot(divElement: any) {
    if (this.plottype === SEISMOGRAPH) {
      const innerDiv = divElement.append("div");
      this.seismograph = new Seismograph(innerDiv, this.seisConfig, this.seisData);
      this.seismograph.draw();
    } else if (this.plottype === SPECTRA) {
      const loglog = true;
      const innerDiv = divElement.append("div");
      let fftList = this.seisData.map(sd => seisplotjs.fft.fftForward(sd.seismogram));
      let fftPlot = new seisplotjs.fftplot.FFTPlot(innerDiv, this.seisConfig, fftList, loglog);
      fftPlot.draw();
    } else if (this.plottype === PARTICLE_MOTION) {
      const innerDiv = divElement.append("div");
      this.seismograph = new Seismograph(innerDiv, this.seisConfig, this.seisData);
      this.seismograph.draw();
    } else if (this.plottype === MAP) {
      const mapid = 'map'+(((1+Math.random())*0x10000)|0).toString(16).substring(1);
      const innerDiv = divElement.append("div").classed("map", true).attr('id', mapid);
      const centerLat = 35;
      const centerLon = -100;
      const mapZoomLevel = 1;
      const mymap = L.map(mapid).setView([ centerLat, centerLon], mapZoomLevel);
      let OpenTopoMap = L.tileLayer('http://services.arcgisonline.com/arcgis/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 17,
        attribution: 'Map data: <a href="https://services.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer">Esri, Garmin, GEBCO, NOAA NGDC, and other contributors</a>)'
      }).addTo(mymap);
      this.seisData.forEach(sdd => {
        for (const q of sdd.quakeList) {
          let circle = L.circleMarker([q.latitude, q.longitude], {
            color: 'red',
            fillColor: '#f03',
            fillOpacity: 0.15,
            radius: q.magnitude ? (q.magnitude.mag*5) : 3 // in case no mag
          }).addTo(mymap);
          circle.bindTooltip(q.time.toISOString()+" "+(q.magnitude ? (q.magnitude.mag+" "+q.magnitude.type) : "unkn"));
        }
        let s = sdd.channel.station;
          let m = L.marker([s.latitude, s.longitude]);
          m.addTo(mymap);
          m.bindTooltip(s.codes());

      });

    } else if (this.plottype === QUAKE_TABLE) {
      const innerDiv = divElement.append("div");
      this.seismograph = new Seismograph(innerDiv, this.seisConfig, this.seisData);
      this.seismograph.draw();
    } else if (this.plottype === STATION_TABLE) {
      const innerDiv = divElement.append("div");
      this.seismograph = new Seismograph(innerDiv, this.seisConfig, this.seisData);
      this.seismograph.draw();
    } else {
      throw new Error(`Unkown plottype ${this.plottype}`);
    }
  }
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
  console.log(`overlayBy ${key}  ${sddList.length}`);
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
        console.log(`    found, push ${val} ${sdd.codes()}`);
      }
    });
    if (! found) {
      const org = new OrganizedDisplay( [ sdd ] );
      org.setAttribute(key, val);
      out.push(org);
      console.log(`not found, create ${val} ${sdd.codes()}`);
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

export function overlayByComponentOld(sddList: Array<SeismogramDisplayData>): Array<OrganizedDisplay> {
  console.log(`overlayByComponent  ${sddList.length}`);
  let out = [];
  const KEY = "component";
  sddList.forEach(sdd => {
    let found = false;
    const orientCode = sdd.channelCode.charAt(2);
    out.forEach(org => {
      if (org.getAttribute(KEY) === orientCode) {
        org.seisData.push(sdd);
        found = true;
        console.log(`    found, push ${orientCode} ${sdd.codes()}`);
      }
    });
    if (! found) {
      const org = new OrganizedDisplay( [ sdd ] );
      org.setAttribute(KEY, orientCode);
      out.push(org);
      console.log(`not found, create ${orientCode} ${sdd.codes()}`);
    }
  });
  return sortByKey(out, KEY);
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
    if (sdd.hasQuake() && sdd.hasChannel() ) {
      const distaz = sdd.distaz;
      return distaz ? distaz.delta : null;
    }
  });
  return null;
}

export function createPlots(organized: Array<OrganizedDisplay>, divElement: any) {
  // arrow function doesn't work well with d3.select(this)
  divElement.selectAll("div").data(organized)
  .enter().append("div").each(function(org) {
    const div = d3.select(this);
    div.attr("plottype", org.plottype);
    org.plot(div);
  });
}
