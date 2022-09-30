import {kmPerDeg} from './distaz';
import {Quake} from "./quakeml";
import {Station} from "./stationxml";
import {SeisPlotElement} from "./spelement";
import { SeismogramDisplayData, uniqueQuakes, uniqueStations } from "./seismogram";
import { SeismographConfig} from "./seismographconfig";
import {LatLonBox, LatLonRadius} from './fdsncommon';

import * as L from "leaflet";
import {LatLngTuple} from "leaflet";

export const MAP_ELEMENT = 'sp-station-event-map';
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
) {
  let allClassList = classList ? classList.slice() : [];
  allClassList.push(isactive ? StationMarkerClassName : InactiveStationMarkerClassName);
  allClassList.push(station.codes(STATION_CODE_SEP));
  const icon = L.divIcon({
    className: allClassList.join(" "),
  });

  const m = L.marker([station.latitude, station.longitude], {
    icon: icon,
  });
  m.bindTooltip(station.codes());
  return m;
}
export function createQuakeMarker(quake: Quake, magScaleFactor = 5, classList?: Array<string>) {
  let allClassList = classList ? classList.slice() : [];
  allClassList.push(QuakeMarkerClassName);
  allClassList.push(cssClassForQuake(quake));
  const circle = L.circleMarker([quake.latitude, quake.longitude], {
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
export const leaflet_css = `
/* required styles */

.leaflet-pane,
.leaflet-tile,
.leaflet-marker-icon,
.leaflet-marker-shadow,
.leaflet-tile-container,
.leaflet-pane > svg,
.leaflet-pane > canvas,
.leaflet-zoom-box,
.leaflet-image-layer,
.leaflet-layer {
	position: absolute;
	left: 0;
	top: 0;
	}
.leaflet-container {
	overflow: hidden;
	}
.leaflet-tile,
.leaflet-marker-icon,
.leaflet-marker-shadow {
	-webkit-user-select: none;
	   -moz-user-select: none;
	        user-select: none;
	  -webkit-user-drag: none;
	}
/* Prevents IE11 from highlighting tiles in blue */
.leaflet-tile::selection {
	background: transparent;
}
/* Safari renders non-retina tile on retina better with this, but Chrome is worse */
.leaflet-safari .leaflet-tile {
	image-rendering: -webkit-optimize-contrast;
	}
/* hack that prevents hw layers "stretching" when loading new tiles */
.leaflet-safari .leaflet-tile-container {
	width: 1600px;
	height: 1600px;
	-webkit-transform-origin: 0 0;
	}
.leaflet-marker-icon,
.leaflet-marker-shadow {
	display: block;
	}
/* .leaflet-container svg: reset svg max-width decleration shipped in Joomla! (joomla.org) 3.x */
/* .leaflet-container img: map is broken in FF if you have max-width: 100% on tiles */
.leaflet-container .leaflet-overlay-pane svg {
	max-width: none !important;
	max-height: none !important;
	}
.leaflet-container .leaflet-marker-pane img,
.leaflet-container .leaflet-shadow-pane img,
.leaflet-container .leaflet-tile-pane img,
.leaflet-container img.leaflet-image-layer,
.leaflet-container .leaflet-tile {
	max-width: none !important;
	max-height: none !important;
	width: auto;
	padding: 0;
	}

.leaflet-container.leaflet-touch-zoom {
	-ms-touch-action: pan-x pan-y;
	touch-action: pan-x pan-y;
	}
.leaflet-container.leaflet-touch-drag {
	-ms-touch-action: pinch-zoom;
	/* Fallback for FF which doesn't support pinch-zoom */
	touch-action: none;
	touch-action: pinch-zoom;
}
.leaflet-container.leaflet-touch-drag.leaflet-touch-zoom {
	-ms-touch-action: none;
	touch-action: none;
}
.leaflet-container {
	-webkit-tap-highlight-color: transparent;
}
.leaflet-container a {
	-webkit-tap-highlight-color: rgba(51, 181, 229, 0.4);
}
.leaflet-tile {
	filter: inherit;
	visibility: hidden;
	}
.leaflet-tile-loaded {
	visibility: inherit;
	}
.leaflet-zoom-box {
	width: 0;
	height: 0;
	-moz-box-sizing: border-box;
	     box-sizing: border-box;
	z-index: 800;
	}
/* workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=888319 */
.leaflet-overlay-pane svg {
	-moz-user-select: none;
	}

.leaflet-pane         { z-index: 400; }

.leaflet-tile-pane    { z-index: 200; }
.leaflet-overlay-pane { z-index: 400; }
.leaflet-shadow-pane  { z-index: 500; }
.leaflet-marker-pane  { z-index: 600; }
.leaflet-tooltip-pane   { z-index: 650; }
.leaflet-popup-pane   { z-index: 700; }

.leaflet-map-pane canvas { z-index: 100; }
.leaflet-map-pane svg    { z-index: 200; }

.leaflet-vml-shape {
	width: 1px;
	height: 1px;
	}
.lvml {
	behavior: url(#default#VML);
	display: inline-block;
	position: absolute;
	}


/* control positioning */

.leaflet-control {
	position: relative;
	z-index: 800;
	pointer-events: visiblePainted; /* IE 9-10 doesn't have auto */
	pointer-events: auto;
	}
.leaflet-top,
.leaflet-bottom {
	position: absolute;
	z-index: 1000;
	pointer-events: none;
	}
.leaflet-top {
	top: 0;
	}
.leaflet-right {
	right: 0;
	}
.leaflet-bottom {
	bottom: 0;
	}
.leaflet-left {
	left: 0;
	}
.leaflet-control {
	float: left;
	clear: both;
	}
.leaflet-right .leaflet-control {
	float: right;
	}
.leaflet-top .leaflet-control {
	margin-top: 10px;
	}
.leaflet-bottom .leaflet-control {
	margin-bottom: 10px;
	}
.leaflet-left .leaflet-control {
	margin-left: 10px;
	}
.leaflet-right .leaflet-control {
	margin-right: 10px;
	}


/* zoom and fade animations */

.leaflet-fade-anim .leaflet-popup {
	opacity: 0;
	-webkit-transition: opacity 0.2s linear;
	   -moz-transition: opacity 0.2s linear;
	        transition: opacity 0.2s linear;
	}
.leaflet-fade-anim .leaflet-map-pane .leaflet-popup {
	opacity: 1;
	}
.leaflet-zoom-animated {
	-webkit-transform-origin: 0 0;
	    -ms-transform-origin: 0 0;
	        transform-origin: 0 0;
	}
svg.leaflet-zoom-animated {
	will-change: transform;
}

.leaflet-zoom-anim .leaflet-zoom-animated {
	-webkit-transition: -webkit-transform 0.25s cubic-bezier(0,0,0.25,1);
	   -moz-transition:    -moz-transform 0.25s cubic-bezier(0,0,0.25,1);
	        transition:         transform 0.25s cubic-bezier(0,0,0.25,1);
	}
.leaflet-zoom-anim .leaflet-tile,
.leaflet-pan-anim .leaflet-tile {
	-webkit-transition: none;
	   -moz-transition: none;
	        transition: none;
	}

.leaflet-zoom-anim .leaflet-zoom-hide {
	visibility: hidden;
	}


/* cursors */

.leaflet-interactive {
	cursor: pointer;
	}
.leaflet-grab {
	cursor: -webkit-grab;
	cursor:    -moz-grab;
	cursor:         grab;
	}
.leaflet-crosshair,
.leaflet-crosshair .leaflet-interactive {
	cursor: crosshair;
	}
.leaflet-popup-pane,
.leaflet-control {
	cursor: auto;
	}
.leaflet-dragging .leaflet-grab,
.leaflet-dragging .leaflet-grab .leaflet-interactive,
.leaflet-dragging .leaflet-marker-draggable {
	cursor: move;
	cursor: -webkit-grabbing;
	cursor:    -moz-grabbing;
	cursor:         grabbing;
	}

/* marker & overlays interactivity */
.leaflet-marker-icon,
.leaflet-marker-shadow,
.leaflet-image-layer,
.leaflet-pane > svg path,
.leaflet-tile-container {
	pointer-events: none;
	}

.leaflet-marker-icon.leaflet-interactive,
.leaflet-image-layer.leaflet-interactive,
.leaflet-pane > svg path.leaflet-interactive,
svg.leaflet-image-layer.leaflet-interactive path {
	pointer-events: visiblePainted; /* IE 9-10 doesn't have auto */
	pointer-events: auto;
	}

/* visual tweaks */

.leaflet-container {
	background: #ddd;
	outline-offset: 1px;
	}
.leaflet-container a {
	color: #0078A8;
	}
.leaflet-zoom-box {
	border: 2px dotted #38f;
	background: rgba(255,255,255,0.5);
	}


/* general typography */
.leaflet-container {
	font-family: "Helvetica Neue", Arial, Helvetica, sans-serif;
	font-size: 12px;
	font-size: 0.75rem;
	line-height: 1.5;
	}


/* general toolbar styles */

.leaflet-bar {
	box-shadow: 0 1px 5px rgba(0,0,0,0.65);
	border-radius: 4px;
	}
.leaflet-bar a {
	background-color: #fff;
	border-bottom: 1px solid #ccc;
	width: 26px;
	height: 26px;
	line-height: 26px;
	display: block;
	text-align: center;
	text-decoration: none;
	color: black;
	}
.leaflet-bar a,
.leaflet-control-layers-toggle {
	background-position: 50% 50%;
	background-repeat: no-repeat;
	display: block;
	}
.leaflet-bar a:hover,
.leaflet-bar a:focus {
	background-color: #f4f4f4;
	}
.leaflet-bar a:first-child {
	border-top-left-radius: 4px;
	border-top-right-radius: 4px;
	}
.leaflet-bar a:last-child {
	border-bottom-left-radius: 4px;
	border-bottom-right-radius: 4px;
	border-bottom: none;
	}
.leaflet-bar a.leaflet-disabled {
	cursor: default;
	background-color: #f4f4f4;
	color: #bbb;
	}

.leaflet-touch .leaflet-bar a {
	width: 30px;
	height: 30px;
	line-height: 30px;
	}
.leaflet-touch .leaflet-bar a:first-child {
	border-top-left-radius: 2px;
	border-top-right-radius: 2px;
	}
.leaflet-touch .leaflet-bar a:last-child {
	border-bottom-left-radius: 2px;
	border-bottom-right-radius: 2px;
	}

/* zoom control */

.leaflet-control-zoom-in,
.leaflet-control-zoom-out {
	font: bold 18px 'Lucida Console', Monaco, monospace;
	text-indent: 1px;
	}

.leaflet-touch .leaflet-control-zoom-in, .leaflet-touch .leaflet-control-zoom-out  {
	font-size: 22px;
	}


/* layers control */

.leaflet-control-layers {
	box-shadow: 0 1px 5px rgba(0,0,0,0.4);
	background: #fff;
	border-radius: 5px;
	}
.leaflet-control-layers-toggle {
	background-image: url(images/layers.png);
	width: 36px;
	height: 36px;
	}
.leaflet-retina .leaflet-control-layers-toggle {
	background-image: url(images/layers-2x.png);
	background-size: 26px 26px;
	}
.leaflet-touch .leaflet-control-layers-toggle {
	width: 44px;
	height: 44px;
	}
.leaflet-control-layers .leaflet-control-layers-list,
.leaflet-control-layers-expanded .leaflet-control-layers-toggle {
	display: none;
	}
.leaflet-control-layers-expanded .leaflet-control-layers-list {
	display: block;
	position: relative;
	}
.leaflet-control-layers-expanded {
	padding: 6px 10px 6px 6px;
	color: #333;
	background: #fff;
	}
.leaflet-control-layers-scrollbar {
	overflow-y: scroll;
	overflow-x: hidden;
	padding-right: 5px;
	}
.leaflet-control-layers-selector {
	margin-top: 2px;
	position: relative;
	top: 1px;
	}
.leaflet-control-layers label {
	display: block;
	font-size: 13px;
	font-size: 1.08333em;
	}
.leaflet-control-layers-separator {
	height: 0;
	border-top: 1px solid #ddd;
	margin: 5px -10px 5px -6px;
	}

/* Default icon URLs */
.leaflet-default-icon-path { /* used only in path-guessing heuristic, see L.Icon.Default */
	background-image: url(images/marker-icon.png);
	}


/* attribution and scale controls */

.leaflet-container .leaflet-control-attribution {
	background: #fff;
	background: rgba(255, 255, 255, 0.8);
	margin: 0;
	}
.leaflet-control-attribution,
.leaflet-control-scale-line {
	padding: 0 5px;
	color: #333;
	line-height: 1.4;
	}
.leaflet-control-attribution a {
	text-decoration: none;
	}
.leaflet-control-attribution a:hover,
.leaflet-control-attribution a:focus {
	text-decoration: underline;
	}
.leaflet-control-attribution svg {
	display: inline !important;
	}
.leaflet-left .leaflet-control-scale {
	margin-left: 5px;
	}
.leaflet-bottom .leaflet-control-scale {
	margin-bottom: 5px;
	}
.leaflet-control-scale-line {
	border: 2px solid #777;
	border-top: none;
	line-height: 1.1;
	padding: 2px 5px 1px;
	white-space: nowrap;
	overflow: hidden;
	-moz-box-sizing: border-box;
	     box-sizing: border-box;

	background: #fff;
	background: rgba(255, 255, 255, 0.5);
	}
.leaflet-control-scale-line:not(:first-child) {
	border-top: 2px solid #777;
	border-bottom: none;
	margin-top: -2px;
	}
.leaflet-control-scale-line:not(:first-child):not(:last-child) {
	border-bottom: 2px solid #777;
	}

.leaflet-touch .leaflet-control-attribution,
.leaflet-touch .leaflet-control-layers,
.leaflet-touch .leaflet-bar {
	box-shadow: none;
	}
.leaflet-touch .leaflet-control-layers,
.leaflet-touch .leaflet-bar {
	border: 2px solid rgba(0,0,0,0.2);
	background-clip: padding-box;
	}


/* popup */

.leaflet-popup {
	position: absolute;
	text-align: center;
	margin-bottom: 20px;
	}
.leaflet-popup-content-wrapper {
	padding: 1px;
	text-align: left;
	border-radius: 12px;
	}
.leaflet-popup-content {
	margin: 13px 24px 13px 20px;
	line-height: 1.3;
	font-size: 13px;
	font-size: 1.08333em;
	min-height: 1px;
	}
.leaflet-popup-content p {
	margin: 17px 0;
	margin: 1.3em 0;
	}
.leaflet-popup-tip-container {
	width: 40px;
	height: 20px;
	position: absolute;
	left: 50%;
	margin-top: -1px;
	margin-left: -20px;
	overflow: hidden;
	pointer-events: none;
	}
.leaflet-popup-tip {
	width: 17px;
	height: 17px;
	padding: 1px;

	margin: -10px auto 0;
	pointer-events: auto;

	-webkit-transform: rotate(45deg);
	   -moz-transform: rotate(45deg);
	    -ms-transform: rotate(45deg);
	        transform: rotate(45deg);
	}
.leaflet-popup-content-wrapper,
.leaflet-popup-tip {
	background: white;
	color: #333;
	box-shadow: 0 3px 14px rgba(0,0,0,0.4);
	}
.leaflet-container a.leaflet-popup-close-button {
	position: absolute;
	top: 0;
	right: 0;
	border: none;
	text-align: center;
	width: 24px;
	height: 24px;
	font: 16px/24px Tahoma, Verdana, sans-serif;
	color: #757575;
	text-decoration: none;
	background: transparent;
	}
.leaflet-container a.leaflet-popup-close-button:hover,
.leaflet-container a.leaflet-popup-close-button:focus {
	color: #585858;
	}
.leaflet-popup-scrolled {
	overflow: auto;
	border-bottom: 1px solid #ddd;
	border-top: 1px solid #ddd;
	}

.leaflet-oldie .leaflet-popup-content-wrapper {
	-ms-zoom: 1;
	}
.leaflet-oldie .leaflet-popup-tip {
	width: 24px;
	margin: 0 auto;

	-ms-filter: "progid:DXImageTransform.Microsoft.Matrix(M11=0.70710678, M12=0.70710678, M21=-0.70710678, M22=0.70710678)";
	filter: progid:DXImageTransform.Microsoft.Matrix(M11=0.70710678, M12=0.70710678, M21=-0.70710678, M22=0.70710678);
	}

.leaflet-oldie .leaflet-control-zoom,
.leaflet-oldie .leaflet-control-layers,
.leaflet-oldie .leaflet-popup-content-wrapper,
.leaflet-oldie .leaflet-popup-tip {
	border: 1px solid #999;
	}


/* div icon */

.leaflet-div-icon {
	background: #fff;
	border: 1px solid #666;
	}


/* Tooltip */
/* Base styles for the element that has a tooltip */
.leaflet-tooltip {
	position: absolute;
	padding: 6px;
	background-color: #fff;
	border: 1px solid #fff;
	border-radius: 3px;
	color: #222;
	white-space: nowrap;
	-webkit-user-select: none;
	-moz-user-select: none;
	-ms-user-select: none;
	user-select: none;
	pointer-events: none;
	box-shadow: 0 1px 3px rgba(0,0,0,0.4);
	}
.leaflet-tooltip.leaflet-interactive {
	cursor: pointer;
	pointer-events: auto;
	}
.leaflet-tooltip-top:before,
.leaflet-tooltip-bottom:before,
.leaflet-tooltip-left:before,
.leaflet-tooltip-right:before {
	position: absolute;
	pointer-events: none;
	border: 6px solid transparent;
	background: transparent;
	content: "";
	}

/* Directions */

.leaflet-tooltip-bottom {
	margin-top: 6px;
}
.leaflet-tooltip-top {
	margin-top: -6px;
}
.leaflet-tooltip-bottom:before,
.leaflet-tooltip-top:before {
	left: 50%;
	margin-left: -6px;
	}
.leaflet-tooltip-top:before {
	bottom: 0;
	margin-bottom: -12px;
	border-top-color: #fff;
	}
.leaflet-tooltip-bottom:before {
	top: 0;
	margin-top: -12px;
	margin-left: -6px;
	border-bottom-color: #fff;
	}
.leaflet-tooltip-left {
	margin-left: -6px;
}
.leaflet-tooltip-right {
	margin-left: 6px;
}
.leaflet-tooltip-left:before,
.leaflet-tooltip-right:before {
	top: 50%;
	margin-top: -6px;
	}
.leaflet-tooltip-left:before {
	right: 0;
	margin-right: -12px;
	border-left-color: #fff;
	}
.leaflet-tooltip-right:before {
	left: 0;
	margin-left: -12px;
	border-right-color: #fff;
	}

/* Printing */

@media print {
	/* Prevent printers from removing background-images of controls. */
	.leaflet-control {
		-webkit-print-color-adjust: exact;
		color-adjust: exact;
		}
	}
`;

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
        this.quakeAddClass(quake, cn)
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
    const classList = this.quakeClassMap.get(cssClassForQuake(quake));
    if (classList) {
      classList.push(classname);
    } else {
      this.quakeClassMap.set(cssClassForQuake(quake), [classname]);
    }
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
    console.log(`search for div.${classname}.${quakeIdStr}`)
    let circleList = this.getShadowRoot().querySelectorAll(`path.${quakeIdStr}`);
    circleList.forEach(triangle => {
      let classList = triangle.getAttribute("class");
      if (classList) {
        classList = classList.split(/\s+/).filter(s => s !== classname).join(" ");
        triangle.setAttribute("class", classList);
      }
    });
    if(circleList.length === 0) {
      console.log("didn't find quake to remove clsas")
    }
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
  }
  /**
   * Removes a css class from the station triangle
   * @param  station   the station
   * @param  classname  css class name
   */
  stationRemoveClass(station: Station, classname: string) {
    let classList = this.stationClassMap.get(station.codes(STATION_CODE_SEP));
    if (classList) {
      classList = classList.filter(v => v !== classname);
      this.stationClassMap.set(station.codes(STATION_CODE_SEP), classList);
    }
    console.log(`search for div.${classname}.${station.codes(STATION_CODE_SEP)}`)
    let triangleList = this.getShadowRoot().querySelectorAll(`div.${station.codes(STATION_CODE_SEP)}`);
    triangleList.forEach(triangle => {
      let classList = triangle.getAttribute("class");
      if (classList) {
        classList = classList.split(/\s+/).filter(s => s !== classname).join(" ");
        triangle.setAttribute("class", classList);
      }
    });
    if(triangleList.length === 0) {
      console.log("didn't find station to remove clsas")
    }
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
      const circle = createQuakeMarker(q, magScale, this.quakeClassMap.get(cssClassForQuake(q)));
      circle.addTo(mymap);
      mapItems.push([q.latitude, q.longitude]);
    });
    this.stationList.concat(uniqueStations(this.seisData)).forEach(s => {
      const m = createStationMarker(s, this.stationClassMap.get(s.codes(STATION_CODE_SEP)));
      m.addTo(mymap);
      mapItems.push([s.latitude, s.longitude]);
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
    let outLatLon: Array<[number, number]> = [];
    this.geoRegionList.forEach(gr => {
      if (gr instanceof LatLonBox) {
        const llbox = gr as LatLonBox;
        const bounds = llbox.asLeafletBounds();
        const rect = L.rectangle(bounds, {color: "red", weight: 1});
        rect.addTo(map);
        outLatLon.push(bounds[0]);
        outLatLon.push(bounds[1]);
      } else if (gr instanceof LatLonRadius) {
        const llrad = gr as LatLonRadius;
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
      } else {
        // unknown region type?
        console.assert(false, "unknown regino type");
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
    out = `${q.origin.time.toISO()}_${q.magnitude}`;
  }
  return out.replaceAll(badCSSChars, '_')
}
