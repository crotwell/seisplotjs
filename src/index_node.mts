//

/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * https://www.seis.sc.edu
 */
//import * as animatedseismograph from "./animatedseismograph.mjs";
//import * as axisutil from "./axisutil.mjs";
//import * as components from "./components.mjs";
//import * as cssutil from "./cssutil.mjs";
import * as datalink from "./datalink.mjs";
import * as dataset from "./dataset.mjs";
//import * as datechooser from "./datechooser.mjs";
import * as distaz from "./distaz.mjs";
import * as fdsnavailability from "./fdsnavailability.mjs";
import * as fdsncommon from "./fdsncommon.mjs";
import * as fdsndatacenters from "./fdsndatacenters.mjs";
import * as fdsnevent from "./fdsnevent.mjs";
//import * as fdsneventcomponent from "./fdsneventcomponent.mjs";
import * as fdsnstation from "./fdsnstation.mjs";
//import * as fdsnstationcomponent from "./fdsnstationcomponent.mjs";
import * as fdsndataselect from "./fdsndataselect.mjs";
import * as fdsnsourceid from "./fdsnsourceid.mjs";
import * as filter from "./filter.mjs";
import * as fft from "./fft.mjs";
//import * as handlebarshelpers from "./handlebarshelpers.mjs";
//import * as helicorder from "./helicorder.mjs";
//import * as infotable from "./infotable.mjs";
//import * as leafletutil from "./leafletutil.mjs";
import * as miniseed from "./miniseed.mjs";
import * as mseed3 from "./mseed3.mjs";
import * as mseed3eh from "./mseed3eh.mjs";
import * as mseedarchive from "./mseedarchive.mjs";
import * as nws from "./nws.mjs";
import * as oregondsputil from "./oregondsputil.mjs";
//import * as organizeddisplay from "./organizeddisplay.mjs";
//import * as particlemotion from "./particlemotion.mjs";
import * as quakeml from "./quakeml.mjs";
import * as ringserverweb from "./ringserverweb.mjs";
import * as ringserverweb4 from "./ringserverweb4.mjs";
import * as sacPoleZero from "./sacpolezero.mjs";
import * as scale from "./scale.mjs";
import * as seedcodec from "./seedcodec.mjs";
import * as seedlink from "./seedlink.mjs";
import * as seedlink4 from "./seedlink4.mjs";
import * as seismogram from "./seismogram.mjs";
import * as seismogramloader from "./seismogramloader.mjs";
import * as seismogramsegment from "./seismogramsegment.mjs";
//import * as seismograph from "./seismograph.mjs";
//import * as seismographutil from "./seismographutil.mjs";
//import * as seismographconfig from "./seismographconfig.mjs";
//import * as seismographconfigeditor from "./seismographconfigeditor.mjs";
//import * as seismographmarker from "./seismographmarker.mjs";
import * as sorting from "./sorting.mjs";
//import * as spelement from "./spelement.mjs";
import * as stationxml from "./stationxml.mjs";
import * as syngine from "./syngine.mjs";
import * as taper from "./taper.mjs";
import * as taup3 from "./taup3.mjs";
import * as transfer from "./transfer.mjs";
//import * as transition from "./transition.mjs";
import * as traveltime from "./traveltime.mjs";
import * as usgsgeojson from "./usgsgeojson.mjs";
import * as util from "./util.mjs";
import { version } from "./version.mjs";
import * as vector from "./vector.mjs";
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
const seismographmarker = null;
const seismographutil = null;
const seismographconfigeditor = null;
const spectraplot = null;
const spelement = null;
const transition = null;
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
  mseed3eh,
  mseedarchive,
  nws,
  oregondsputil,
  organizeddisplay,
  particlemotion,
  quakeml,
  ringserverweb,
  ringserverweb4,
  sacPoleZero,
  scale,
  seedcodec,
  seedlink,
  seedlink4,
  seismogram,
  seismogramloader,
  seismogramsegment,
  seismograph,
  seismographmarker,
  seismographutil,
  seismographconfig,
  seismographconfigeditor,
  sorting,
  spelement,
  spectraplot,
  stationxml,
  syngine,
  taper,
  taup3,
  transfer,
  transition,
  traveltime,
  usgsgeojson,
  util,
  vector,
  version,
  OregonDSP,
  leaflet,
  luxon,
};
