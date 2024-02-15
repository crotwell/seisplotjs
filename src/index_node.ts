//

/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * https://www.seis.sc.edu
 */
//import * as animatedseismograph from "./animatedseismograph";
//import * as axisutil from "./axisutil";
//import * as components from "./components";
//import * as cssutil from "./cssutil";
import * as datalink from "./datalink";
import * as dataset from "./dataset";
//import * as datechooser from "./datechooser";
import * as distaz from "./distaz";
import * as fdsnavailability from "./fdsnavailability";
import * as fdsncommon from "./fdsncommon";
import * as fdsndatacenters from "./fdsndatacenters";
import * as fdsnevent from "./fdsnevent";
import * as fdsnstation from "./fdsnstation";
import * as fdsndataselect from "./fdsndataselect";
import * as fdsnsourceid from "./fdsnsourceid";
import * as filter from "./filter";
import * as fft from "./fft";
//import * as handlebarshelpers from "./handlebarshelpers";
//import * as helicorder from "./helicorder";
//import * as infotable from "./infotable";
//import * as leafletutil from "./leafletutil";
import * as miniseed from "./miniseed";
import * as mseed3 from "./mseed3";
import * as mseedarchive from "./mseedarchive";
import * as oregondsputil from "./oregondsputil";
//import * as organizeddisplay from "./organizeddisplay";
//import * as particlemotion from "./particlemotion";
import * as quakeml from "./quakeml";
import * as ringserverweb from "./ringserverweb";
import * as sacPoleZero from "./sacpolezero";
import * as scale from "./scale";
import * as seedcodec from "./seedcodec";
import * as seedlink from "./seedlink";
import * as seedlink4 from "./seedlink4";
import * as seismogram from "./seismogram";
import * as seismogramloader from "./seismogramloader";
import * as seismogramsegment from "./seismogramsegment";
//import * as seismograph from "./seismograph";
//import * as seismographutil from "./seismographutil";
//import * as seismographconfig from "./seismographconfig";
//import * as seismographconfigeditor from "./seismographconfigeditor";
import * as sorting from './sorting';
//import * as spectraplot from "./spectraplot";
import * as stationxml from "./stationxml";
import * as taper from "./taper";
import * as transfer from "./transfer";
import * as traveltime from "./traveltime";
import * as usgsgeojson from "./usgsgeojson";
import * as util from "./util";
import { version } from "./version";
import * as vector from "./vector";
import * as OregonDSP from "oregondsp";
import * as luxon from "luxon";
//import * as leaflet from "leaflet";

// things that need browser window, etc.
// just set to null so at least there is an error?
const axisutil = null;
const animatedseismograph = null;
const components = null;
const cssutil = null;
const datechooser = null;
const infotable = null;
const fdsneventcomponent = null;
const fdsnstationcomponent = null;
const handlebarshelpers = null;
const helicorder = null;
const organizeddisplay = null;
const particlemotion = null;
const seismograph = null;
const seismographconfig = null;
const seismographutil = null;
const seismographconfigeditor = null;
const spectraplot = null;
// leaflet cannot run in node as needs window
const leaflet = null;
const leafletutil = null;

/* reexport */
export {
  animatedseismograph,
  axisutil,
  components,
  cssutil,
  datalink,
  dataset,
  datechooser,
  distaz,
  infotable,
  fdsnavailability,
  fdsncommon,
  fdsndatacenters,
  fdsnevent,
  fdsneventcomponent,
  fdsnstation,
  fdsnstationcomponent,
  fdsndataselect,
  fdsnsourceid,
  fft,
  handlebarshelpers,
  helicorder,
  filter,
  leafletutil,
  miniseed,
  mseed3,
  mseedarchive,
  oregondsputil,
  organizeddisplay,
  particlemotion,
  quakeml,
  ringserverweb,
  sacPoleZero,
  scale,
  seedcodec,
  seedlink,
  seedlink4,
  seismogram,
  seismogramloader,
  seismogramsegment,
  seismograph,
  seismographutil,
  seismographconfig,
  seismographconfigeditor,
  sorting,
  spectraplot,
  stationxml,
  taper,
  transfer,
  traveltime,
  usgsgeojson,
  util,
  vector,
  version,
  OregonDSP,
  leaflet,
  luxon,
};
