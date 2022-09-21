
import { SeismogramDisplayData } from "./seismogram";
import { SeismographConfig } from "./seismographconfig";
import { isDef } from "./util";

export class SeisPlotElement extends HTMLElement {
  _seisDataList: Array<SeismogramDisplayData>;
  _seismographConfig: SeismographConfig;
  constructor(seisData?: SeismogramDisplayData | Array<SeismogramDisplayData>,
      seisConfig?: SeismographConfig) {
    super();
    if (isDef(seisData)) {
      if (seisData instanceof SeismogramDisplayData) {
        this._seisDataList = [ seisData ];
      } else if (Array.isArray(seisData) && (seisData.length === 0 || seisData[0] instanceof SeismogramDisplayData)) {
        this._seisDataList = seisData;
      } else {
        let msg = `length: ${seisData.length}  `;
        if (seisData.length > 0) {
          msg = `${msg} ${seisData[0]}`;
        }
        throw new Error(`first arg must be array of SeismogramDisplayData: ${msg}`);
      }
    } else {
      this._seisDataList = [];
    }
    if (isDef(seisConfig)) {
      this._seismographConfig = seisConfig;
    } else {
      this._seismographConfig = new SeismographConfig();
    }
    this.attachShadow({mode: 'open'});
  }
  get seisData() {
    return this._seisDataList;
  }
  set seisData(seisData: Array<SeismogramDisplayData>) {
    if (seisData instanceof SeismogramDisplayData) {
      this._seisDataList = [ seisData ];
    } else if (Array.isArray(seisData)) {
      this._seisDataList = seisData;
    } else {
      throw new Error(`Unknown type for seisData: ${seisData}`);
    }
    this.seisDataUpdated();
  }
  get seismographConfig() {
    return this._seismographConfig;
  }
  set seismographConfig(seismographConfig: SeismographConfig) {
    this._seismographConfig = seismographConfig;
    this.seisDataUpdated();
  }
  addStyle(css: string, id?: string): HTMLStyleElement {
    return addStyleToElement(this, css, id);
  }
  /**
   * Notification to the element that something about the current seismogram
   * data has changed. This could be that the actual waveform data has been updated
   * or that auxillary data like quake or channel has been added or that the
   * configuration has changed. This should trigger a redraw.
   */
  seisDataUpdated() {
    this.draw();
  }
  connectedCallback() {
    this.draw();
  }
  draw() {
    if ( ! this.isConnected) { return; }
  }

}

export function addStyleToElement(element: HTMLElement,
                                  css: string,
                                  id?: string): HTMLStyleElement {
  if ( ! element.shadowRoot) {
    element.attachShadow({mode: 'open'});
  }
  const styleEl = document.createElement("style")
  styleEl.textContent = css;
  if (id) {
    styleEl.setAttribute("id", id);
  }
  element.shadowRoot?.insertBefore(styleEl, element.shadowRoot?.firstChild);
  return styleEl;
}
