
import {Quake, Origin} from "./quakeml";
import {Station, Channel} from "./stationxml";
import { SeismogramDisplayData, uniqueQuakes, uniqueStations } from "./seismogram";
import { SeismographConfig } from "./seismographconfig";
import { isDef } from "./util";

export class SeisPlotElement extends HTMLElement {
  _seisDataList: Array<SeismogramDisplayData>;
  _seismographConfig: SeismographConfig;
  constructor(seisData?: Array<SeismogramDisplayData>, seisConfig?: SeismographConfig) {
    super();
    if (isDef(seisData)) {
      if (Array.isArray(seisData) && (seisData.length === 0 || seisData[0] instanceof SeismogramDisplayData)) {
        this._seisDataList = seisData;
      } else {
        throw new Error("first arg must be array of SeismogramDisplayData");
      }
    } else {
      this._seisDataList = [];
    }
    if (isDef(seisConfig)) {
      this._seismographConfig = seisConfig;
    } else {
      this._seismographConfig = new SeismographConfig();
    }
  }
  get seisData() {
    return this._seisDataList;
  }
  set seisData(seisData: Array<SeismogramDisplayData>) {
    this._seisDataList = seisData;
    this.draw();
  }
  get seismographConfig() {
    return this._seismographConfig;
  }
  set seismographConfig(seismographConfig: SeismographConfig) {
    this._seismographConfig = seismographConfig;
    this.draw();
  }
  connectedCallback() {
    this.draw();
  }
  draw() {
    if ( ! this.isConnected) { return; }
  }

}
