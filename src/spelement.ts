import { SeismogramDisplayData } from "./seismogram";
import { SeismographConfig } from "./seismographconfig";
import { isDef, stringify } from "./util";

export class SeisPlotElement extends HTMLElement {
  _seisDataList: Array<SeismogramDisplayData>;
  _seismographConfig: SeismographConfig;
  onRedraw: (el: SeisPlotElement) => void;
  _throttleRedraw: ReturnType<typeof requestAnimationFrame> | null;

  constructor(
    seisData?: SeismogramDisplayData | Array<SeismogramDisplayData>,
    seisConfig?: SeismographConfig,
  ) {
    super();
    this.onRedraw = (el: SeisPlotElement) => {};
    this._throttleRedraw = null;
    if (isDef(seisData)) {
      if (seisData instanceof SeismogramDisplayData) {
        this._seisDataList = [seisData];
      } else if (
        Array.isArray(seisData) &&
        (seisData.length === 0 || seisData[0] instanceof SeismogramDisplayData)
      ) {
        this._seisDataList = seisData;
      } else {
        let msg = `length: ${seisData.length}  `;
        if (seisData.length > 0) {
          msg = `${msg} ${seisData[0].toString()}`;
        }
        throw new Error(
          `first arg must be array of SeismogramDisplayData: ${msg}`,
        );
      }
    } else {
      this._seisDataList = [];
    }
    if (isDef(seisConfig)) {
      this._seismographConfig = seisConfig;
    } else {
      this._seismographConfig = new SeismographConfig();
    }
    this.attachShadow({ mode: "open" });
  }
  get seisData() {
    return this._seisDataList;
  }
  set seisData(seisData: Array<SeismogramDisplayData>) {
    if (seisData instanceof SeismogramDisplayData) {
      this._seisDataList = [seisData];
    } else if (Array.isArray(seisData)) {
      this._seisDataList = seisData;
    } else {
      throw new Error(`Unknown type for seisData: ${stringify(seisData)}`);
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
    this.redraw();
  }
  connectedCallback() {
    this.redraw();
  }
  /**
   * Redraw the element. This implements a throttle so that many redraws
   * are coelsced into a single actual draw if they occur before the
   * next animation frame.
   */
  redraw() {
    if (this._throttleRedraw !== null) {
      cancelAnimationFrame(this._throttleRedraw);
    }
    this._throttleRedraw = requestAnimationFrame(() => {
      this.draw();
      this.onRedraw(this);
      this._throttleRedraw = null;
    });
  }
  /**
   * Draw the element, overridden by subclasses. Generally outside callers
   * should prefer calling redraw() as it handles throttling and calls the
   * onRedraw callback.
   */
  draw() {
    if (!this.isConnected) {
      return;
    }
  }
  getShadowRoot(autoAdd = true): ShadowRoot {
    if (!this.shadowRoot) {
      if (autoAdd) {
        this.attachShadow({ mode: "open" });
        return this.getShadowRoot(false); // prevent inf recur
      } else {
        throw new Error("shadowRoot is missing");
      }
    } else {
      return this.shadowRoot;
    }
  }
}

export function addStyleToElement(
  element: HTMLElement,
  css: string,
  id?: string,
): HTMLStyleElement {
  if (!element.shadowRoot) {
    element.attachShadow({ mode: "open" });
  }
  const styleEl = document.createElement("style");
  styleEl.textContent = css;
  if (id) {
    styleEl.setAttribute("id", id);
  }
  element.shadowRoot?.insertBefore(styleEl, element.shadowRoot?.firstChild);
  return styleEl;
}
