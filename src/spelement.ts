
import {Quake, Origin} from "./quakeml";
import {Station, Channel} from "./stationxml";
import { SeismogramDisplayData, uniqueQuakes, uniqueStations } from "./seismogram";
import { SeismographConfig } from "./seismographconfig";

export class SeisPlotElement extends HTMLElement {
  _seisDataList: Array<SeismogramDisplayData>;
  _seismographConfig: SeismographConfig;
  constructor() {
    super();
    this._seisDataList = [];
    this._seismographConfig = new SeismographConfig();
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
  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    this.draw();
  }
  draw() {
    if ( ! this.isConnected) { return; }
  }

}
