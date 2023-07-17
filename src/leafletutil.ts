import {kmPerDeg} from './distaz';
import {Quake, createQuakeClickEvent} from './quakeml';
import * as import_leaflet_css from "./leaflet_css";
import {Station, createStationClickEvent} from "./stationxml";
import {SeisPlotElement} from "./spelement";
import { SeismogramDisplayData, uniqueQuakes, uniqueStations } from "./seismogram";
import { SeismographConfig} from "./seismographconfig";
import {LatLonBox, LatLonRadius} from './fdsncommon';

import * as L from "leaflet";
import {LatLngTuple} from "leaflet";

export const MAP_ELEMENT = 'sp-station-quake-map';
export const triangle = "\u25B2";
export const StationMarkerClassName = "stationMapMarker";
export const InactiveStationMarkerClassName = "inactiveStationMapMarker";
export const QuakeMarkerClassName = "quakeMapMarker";
export const stationIcon = L.divIcon({
  className: StationMarkerClassName,
});
export const inactiveStationIcon = L.divIcon({
  className: InactiveStationMarkerClassName,
});
// note currentcolor is svg var that lets use use css, otherwise leaflet will
// put its default color, blue, which can't be overridden
export const stationMarker_css = `

:host {
  display: block
}

div.wrapper {
  height: 100%;
  min-height: 100px;
}

.leaflet-container {
  height: 100%;
  width: 100%;
}

.${InactiveStationMarkerClassName} {
  color: darkgrey;
  font-size: large;
  z-index: 1;
  text-shadow: 1px 1px 0 dimgrey, -1px 1px 0 dimgrey, -2px 1px 0 dimgrey, -1px -1px 0 dimgrey, 0 -3px 0 dimgrey, 1px -1px 0 dimgrey, 2px 1px 0 dimgrey;
}
.${InactiveStationMarkerClassName}:after{
  content: "${triangle}";
}
.${StationMarkerClassName} {
  color: blue;
  font-size: large;
  z-index: 10;
  text-shadow: 1px 1px 0 dimgrey, -1px 1px 0 dimgrey, -2px 1px 0 dimgrey, -1px -1px 0 dimgrey, 0 -3px 0 dimgrey, 1px -1px 0 dimgrey, 2px 1px 0 dimgrey;
}

.${StationMarkerClassName}:after{
  content: "${triangle}";
}
.${QuakeMarkerClassName} {
  stroke: red;
  fill: #f03;
  fill-opacity: 0.15;
}
`;
export function createStationMarker(
  station: Station,
  classList?: Array<string>,
  isactive = true,
  centerLon=0,
) {
  const allClassList = classList ? classList.slice() : [];
  allClassList.push(isactive ? StationMarkerClassName : InactiveStationMarkerClassName);
  allClassList.push(station.codes(STATION_CODE_SEP));
  const icon = L.divIcon({
    className: allClassList.join(" "),
  });
  const sLon = station.longitude-centerLon <= 180 ? station.longitude : station.longitude-360;
  const m = L.marker([station.latitude, sLon], {
    icon: icon,
  });
  m.bindTooltip(station.codes());
  return m;
}
export function createQuakeMarker(quake: Quake, magScaleFactor = 5, classList?: Array<string>, centerLon=0) {
  const allClassList = classList ? classList.slice() : [];
  allClassList.push(QuakeMarkerClassName);
  allClassList.push(cssClassForQuake(quake));
  const qLon = quake.longitude-centerLon <= 180 ? quake.longitude : quake.longitude-360;
  const circle = L.circleMarker([quake.latitude, qLon], {
    color: "currentColor",
    radius: quake.magnitude
      ? quake.magnitude.mag * magScaleFactor
      : magScaleFactor,
    // in case no mag
    className: allClassList.join(" "),
  });
  circle.bindTooltip(
    `${quake.time.toISO()} ${
      quake.magnitude
        ? quake.magnitude.mag + " " + quake.magnitude.type
        : "unkn"
    }`,
  );
  return circle;
}
export const leaflet_css = import_leaflet_css.leaflet_css;
export const TILE_TEMPLATE = "tileUrl";
export const DEFAULT_TILE_TEMPLATE = "https://services.arcgisonline.com/arcgis/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}";
export const TILE_ATTRIBUTION = "tileAttribution";
export const MAX_ZOOM = "maxZoom";
export const DEFAULT_MAX_ZOOM = 17;
export const CENTER_LAT = "centerLat";
export const DEFAULT_CENTER_LAT = 35;
export const CENTER_LON = "centerLon";
export const DEFAULT_CENTER_LON = -81;
export const ZOOM_LEVEL = "zoomLevel";
export const DEFAULT_ZOOM_LEVEL = 1;
export const MAG_SCALE = "magScale";
export const DEFAULT_MAG_SCALE = 5.0;

export const QUAKE_MARKER_STYLE_EL = "quakeMarkerStyle";
export const STATION_MARKER_STYLE_EL = "staMarkerStyle";
export const STATION_CODE_SEP = "_";

export class QuakeStationMap extends SeisPlotElement {
  quakeList: Array<Quake> = [];
  stationList: Array<Station> = [];
  geoRegionList: Array<LatLonBox | LatLonRadius> = [];
  map: L.Map | null;
  classToColor: Map<string, string>;
  stationClassMap: Map<string, Array<string>>;
  quakeClassMap: Map<string, Array<string>>;
  constructor(seisData?: Array<SeismogramDisplayData>, seisConfig?: SeismographConfig) {
    super(seisData, seisConfig);
    this.map = null;
    this.classToColor = new Map<string, string>();
    this.stationClassMap = new Map<string, Array<string>>();
    this.quakeClassMap = new Map<string, Array<string>>();

    this.addStyle(leaflet_css);
    this.addStyle(stationMarker_css);

    const wrapper = document.createElement('div');
    wrapper.setAttribute("class", "wrapper");
    this.getShadowRoot().appendChild(wrapper);
  }

  addQuake(quake: Quake | Array<Quake>, classname?: string) {
    const re = /\s+/;
    let classList: Array<string> = [];
    if (classname && classname.length > 0) {
      classList = classname.split(re);
    }
    if (Array.isArray(quake)) {
      quake.forEach(q => this.quakeList.push(q));
      classList.forEach(cn => {
        quake.forEach(q => this.quakeAddClass(q, cn));
      });
    } else {
      this.quakeList.push(quake);
      classList.forEach(cn => {
        this.quakeAddClass(quake, cn);
      });
    }
  }
  /**
   * Adds a css class for the quake icon for additional styling,
   * either via addStyle() for general or via colorClass() for just
   * simply coloring.
   *
   * @param  quake  the quake
   * @param  classname  css class name
   */
  quakeAddClass(quake: Quake, classname: string) {
    const quakeIdStr = cssClassForQuake(quake);
    const classList = this.quakeClassMap.get(quakeIdStr);
    if (classList) {
      classList.push(classname);
    } else {
      this.quakeClassMap.set(cssClassForQuake(quake), [classname]);
    }
    const circleList = this.getShadowRoot().querySelectorAll(`path.${quakeIdStr}`);
    circleList.forEach(c => {
      c.classList.add(classname);
    });
  }
  /**
   * Removes a css class from the earthquake circle.
   *
   * @param  quake  quake to remove
   * @param  classname   class to remove
   */
  quakeRemoveClass(quake: Quake, classname: string) {
    const quakeIdStr = cssClassForQuake(quake);
    let classList = this.quakeClassMap.get(quakeIdStr);
    if (classList) {
      classList = classList.filter(v => v !== classname);
      this.quakeClassMap.set(cssClassForQuake(quake), classList);
    }
    const circleList = this.getShadowRoot().querySelectorAll(`path.${quakeIdStr}`);
    circleList.forEach(c => {
      c.classList.remove(classname);
    });
  }
  /**
   * Removes a css class from all earthquake circles.
   *
   * @param  classname   class to remove
   */
  quakeRemoveAllClass(classname: string) {
    this.quakeList.forEach(q => this.quakeRemoveClass(q, classname));
  }

  addStation(station: Station | Array<Station>, classname?: string) {
    const re = /\s+/;
    let classList: Array<string> = [];
    if (classname && classname.length > 0) {
      classList = classname.split(re);
    }
    if (Array.isArray(station)) {
      station.forEach(s => this.stationList.push(s));
      classList.forEach(cn => {
        station.forEach(s => this.stationAddClass(s, cn));
      });
    } else {
      this.stationList.push(station);
      classList.forEach(cn =>  this.stationAddClass(station, cn));
    }
  }
  /**
   * Adds a css class for the station icon for additional styling,
   * either via addStyle() for general or via colorClass() for just
   * simply coloring.
   *
   * @param  station  the station
   * @param  classname  css class name
   */
  stationAddClass(station: Station, classname: string) {
    const classList = this.stationClassMap.get(station.codes(STATION_CODE_SEP));
    if (classList) {
      classList.push(classname);
    } else {
      this.stationClassMap.set(station.codes(STATION_CODE_SEP), [classname]);
    }
    const markerList = this.getShadowRoot().querySelectorAll(`div.${station.codes(STATION_CODE_SEP)}`);
    markerList.forEach(c => {
      c.classList.add(classname);
    });
  }
  /**
   * Removes a css class from the station triangle
   *
   * @param  station   the station
   * @param  classname  css class name
   */
  stationRemoveClass(station: Station, classname: string) {
    let classList = this.stationClassMap.get(station.codes(STATION_CODE_SEP));
    if (classList) {
      classList = classList.filter(v => v !== classname);
      this.stationClassMap.set(station.codes(STATION_CODE_SEP), classList);
    }
    const markerList = this.getShadowRoot().querySelectorAll(`div.${station.codes(STATION_CODE_SEP)}`);
    markerList.forEach(c => {
      c.classList.remove(classname);
    });
  }
  /**
   * Set a color in css for the classname. This is a simple alternative
   * to full styling via addStyle().
   *
   * @param  classname  css class name
   * @param  color      color, like red
   */
  colorClass(classname: string, color: string) {
    this.classToColor.set(classname, color);
    this.updateQuakeMarkerStyle();
    this.updateStationMarkerStyle();
  }
  removeColorClass(classname: string) {
    this.classToColor.delete(classname);
    this.updateQuakeMarkerStyle();
    this.updateStationMarkerStyle();
  }
  get centerLat(): number {
    const ks = this.hasAttribute(CENTER_LAT) ? this.getAttribute(CENTER_LAT) : null;
    // typescript null
    let k;
    if (!ks) { k = DEFAULT_CENTER_LAT;} else { k= parseFloat(ks);}
    return k;
  }
  set centerLat(val: number) {
    this.setAttribute(CENTER_LAT, `${val}`);
  }
  get centerLon(): number {
    const ks = this.hasAttribute(CENTER_LON) ? this.getAttribute(CENTER_LON) : null;
    let k;
    // typescript null
    if (!ks) { k = DEFAULT_CENTER_LON;} else { k= parseFloat(ks);}
    return k;
  }
  set centerLon(val: number) {
    this.setAttribute(CENTER_LON, `${val}`);
  }
  get zoomLevel(): number {
    const ks = this.hasAttribute(ZOOM_LEVEL) ? this.getAttribute(ZOOM_LEVEL) : null;
    // typescript null
    let k;
    if (!ks) { k = DEFAULT_ZOOM_LEVEL;} else { k= parseInt(ks);}
    return k;
  }
  set zoomLevel(val: number) {
    this.setAttribute(ZOOM_LEVEL, `${val}`);
  }
  get magScale(): number {
    const ks = this.hasAttribute(MAG_SCALE) ? this.getAttribute(MAG_SCALE) : null;
    let k;
    // typescript null
    if (!ks) { k = DEFAULT_MAG_SCALE;} else { k= parseFloat(ks);}
    return k;
  }
  set magScale(val: number) {
    this.setAttribute(MAG_SCALE, `${val}`);
  }

  draw() {
    if ( ! this.isConnected) { return; }
    this.updateQuakeMarkerStyle();
    this.updateStationMarkerStyle();
    const wrapper = (this.getShadowRoot().querySelector('div') as HTMLDivElement);

    while (wrapper.firstChild) {
      // @ts-ignore
      wrapper.removeChild(wrapper.lastChild);
    }
    const divElement = wrapper.appendChild(document.createElement("div"));
    const mymap = L.map(divElement).setView([this.centerLat, this.centerLon], this.zoomLevel);
    this.map = mymap;
    if (this.seismographConfig.wheelZoom) {
      mymap.scrollWheelZoom.enable();
    } else {
      mymap.scrollWheelZoom.disable();
    }
    let tileUrl = DEFAULT_TILE_TEMPLATE;
    let maxZoom = DEFAULT_MAX_ZOOM;
    const tileUrlAttr = this.getAttribute(TILE_TEMPLATE);
    if (tileUrlAttr) {
      tileUrl = tileUrlAttr;
    }
    const maxZoomAttr = this.getAttribute(MAX_ZOOM);
    if (maxZoomAttr) {
      maxZoom = Number.parseInt(maxZoomAttr);
    }
    const tileOptions: L.TileLayerOptions = {
      maxZoom: maxZoom
    };
    const tileAttributionAttr = this.getAttribute(TILE_ATTRIBUTION);
    if (tileAttributionAttr) {
      tileOptions.attribution = tileAttributionAttr;
    }
    L.tileLayer(tileUrl, tileOptions).addTo(mymap);
    const magScale = this.magScale;
    const mapItems: Array<LatLngTuple> = [];
    this.quakeList.concat(uniqueQuakes(this.seisData)).forEach(q => {
      const circle = createQuakeMarker(q, magScale, this.quakeClassMap.get(cssClassForQuake(q)), this.centerLon);
      circle.addTo(mymap);
      mapItems.push([q.latitude, q.longitude]);
      circle.addEventListener('click', evt => {
        const ce = createQuakeClickEvent(q, evt.originalEvent);
        this.dispatchEvent(ce);
      });
    });
    this.stationList.concat(uniqueStations(this.seisData)).forEach(s => {
      const m = createStationMarker(s, this.stationClassMap.get(s.codes(STATION_CODE_SEP)), true, this.centerLon);
      m.addTo(mymap);
      mapItems.push([s.latitude, s.longitude]);
      m.addEventListener('click', evt => {
        const ce = createStationClickEvent(s, evt.originalEvent);
        this.dispatchEvent(ce);
      });
    });
    const regionBounds = this.drawGeoRegions(mymap);
    regionBounds.forEach(b => mapItems.push(b));
    if (mapItems.length > 1) {
      mymap.fitBounds(mapItems);
    }
  }
  updateQuakeMarkerStyle() {
    const quakeMarkerStyle = this.createQuakeMarkerColorStyle();
    const quakeMarkerStyleEl = this.getShadowRoot().querySelector(`style#${QUAKE_MARKER_STYLE_EL}`);
    if (quakeMarkerStyleEl) {
      quakeMarkerStyleEl.textContent = quakeMarkerStyle;
    } else {
      this.addStyle(quakeMarkerStyle, QUAKE_MARKER_STYLE_EL);
    }

  }
  updateStationMarkerStyle() {
    const staMarkerStyle = this.createStationMarkerColorStyle();
    const staMarkerStyleEl = this.getShadowRoot().querySelector(`style#${STATION_MARKER_STYLE_EL}`);
    if (staMarkerStyleEl) {
      staMarkerStyleEl.textContent = staMarkerStyle;
    } else {
      this.addStyle(staMarkerStyle, STATION_MARKER_STYLE_EL);
    }
  }
  drawGeoRegions(map: L.Map): Array<[number, number]> {
    const outLatLon: Array<[number, number]> = [];
    this.geoRegionList.forEach(gr => {
      if (gr instanceof LatLonBox) {
        const llbox = gr ;
        const bounds = llbox.asLeafletBounds();
        const rect = L.rectangle(bounds, {color: "red", weight: 1});
        rect.addTo(map);
        outLatLon.push(bounds[0]);
        outLatLon.push(bounds[1]);
      } else if (gr instanceof LatLonRadius) {
        const llrad = gr ;
        outLatLon.push([llrad.latitude, llrad.longitude]);
        if (llrad.minRadius > 0) {
          L.circle([llrad.latitude, llrad.longitude], {radius: llrad.minRadius*1000*kmPerDeg}).addTo(map);
          outLatLon.push([llrad.latitude+llrad.minRadius, llrad.longitude]);
          outLatLon.push([llrad.latitude-llrad.minRadius, llrad.longitude]);
          outLatLon.push([llrad.latitude, llrad.longitude+llrad.minRadius]);
          outLatLon.push([llrad.latitude, llrad.longitude-llrad.minRadius]);
        }
        if (llrad.maxRadius < 180) {
          L.circle([llrad.latitude, llrad.longitude], {radius: llrad.maxRadius*1000*kmPerDeg}).addTo(map);
          outLatLon.push([llrad.latitude+llrad.maxRadius, llrad.longitude]);
          outLatLon.push([llrad.latitude-llrad.maxRadius, llrad.longitude]);
          outLatLon.push([llrad.latitude, llrad.longitude+llrad.maxRadius]);
          outLatLon.push([llrad.latitude, llrad.longitude-llrad.maxRadius]);
        }
      } else if (gr === null) {
        // null means whole world
      } else {
        // unknown region type?
        throw new Error(`unknown region type: ${String(gr)}`);
      }
    });
    return outLatLon;
  }
  createStationMarkerColorStyle() {
    let style = "";
    this.classToColor.forEach((color, classname) => {
        style = `${style}
div.leaflet-marker-icon.${classname} {
  color: ${color};
}
`;
    });
    return style;
  }
  createQuakeMarkerColorStyle() {
    let style = "";
    this.classToColor.forEach((color, classname) => {
        style = `${style}
path.${classname} {
    stroke: ${color};
    fill: ${color};
}
`;
    });
    return style;
  }
  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    this.draw();
  }
  static get observedAttributes() {
    return [TILE_TEMPLATE,
      TILE_ATTRIBUTION,
      MAX_ZOOM,
      CENTER_LAT,
      CENTER_LON,
      ZOOM_LEVEL,
      MAG_SCALE];
  }
}

customElements.define(MAP_ELEMENT, QuakeStationMap);

export function cssClassForQuake(q: Quake): string {
  const badCSSChars = /[^A-Za-z0-9_-]/g;
  let out;
  if (q.eventId && q.eventId.length > 0) {
    out = q.eventId;
  } else {
    out = `${q.origin.time.toISO()}_${q.magnitude.toString()}`;
  }
  return "qid_"+out.replaceAll(badCSSChars, '_');
}
