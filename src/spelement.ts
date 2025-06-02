import type { DateTime } from "luxon";
import { SeismogramDisplayData } from "./seismogram";
import { SeismographConfig } from "./seismographconfig";
import {
  createDefaultSortingOptions,
  SORT_NONE,
  createSortValueFunction,
  sortByFunction
} from "./sorting";
import { isDef, stringify } from "./util";

export const SORT_BY = "sort";

export class SeisPlotElement extends HTMLElement {
  _seisDataList: Array<SeismogramDisplayData>;
  _seismographConfig: SeismographConfig;
  onRedraw: (el: SeisPlotElement) => void;
  _throttleRedraw: ReturnType<typeof requestAnimationFrame> | null;
  _sorting: Map<string,(sdd: SeismogramDisplayData) => number | string | DateTime>;


  constructor(
    seisData?: SeismogramDisplayData | Array<SeismogramDisplayData>,
    seisConfig?: SeismographConfig,
  ) {
    super();
    this.onRedraw = (_el: SeisPlotElement) => {};
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
    this._sorting = createDefaultSortingOptions();
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

  /**
   * The sorting type to optionally sort the data by. New sort types may be
   * added by supplying a key and function that takes an SeismogramDisplayData
   * and returns a number, string or date. Sort of data is done using the
   * calculated value for each waveform. This is stored as an attribute on
   * the element, so changing the attribute has the same effect.
   * Default is SORT_NONE = "none".
   * @return sorting key
   */
  get sortby(): string {
    let k = this.hasAttribute(SORT_BY) ? this.getAttribute(SORT_BY) : SORT_NONE;
    // typescript null
    if (!k) {
      k = SORT_NONE;
    }
    return k;
  }
  set sortby(val: string) {
    this.setAttribute(SORT_BY, val);
  }
  addSortingFunction(key: string, sddFunction: (sdd: SeismogramDisplayData) => number | string | DateTime) {
    this._sorting.set(key, sddFunction);
  }
  getSortingFunction(key: string): (sdd: SeismogramDisplayData) => number | string | DateTime {
    const sortFun = this._sorting.get(key);
    if (sortFun) {
      return sortFun;
    }
    return createSortValueFunction(key); // check for default sortings or error
  }
  /**
   * Sorts seisData by the this.sortby sorting type.
   * @return this.seisData sorted
   */
  sortedSeisData() {
    if (this.sortby === SORT_NONE) {
      return this.seisData;
    }
    return sortByFunction(this.seisData, this.getSortingFunction(this.sortby));
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

  static get observedAttributes() {
    const mine = [
      SORT_BY,
    ];
    return mine;
  }
}

export function addStyleToElement(
  element: HTMLElement,
  css: string,
  id?: string,
): HTMLStyleElement {
  let shadowRoot = element.shadowRoot;
  if (!shadowRoot) {
    shadowRoot = element.attachShadow({ mode: "open" });
  }
  const styleEl = document.createElement("style");
  styleEl.textContent = css;
  if (id) {
    styleEl.setAttribute("id", id);
  }
  //Insert style at the end of the list of styles to maintain
  //the typical css precedence rule (styles added later override previous)
  let styleNodes = shadowRoot.querySelectorAll("style");
  let lastStyle = styleNodes[styleNodes.length-1];
  if (lastStyle) {
    lastStyle.after(styleEl);
  }
  else {
    shadowRoot.insertBefore(styleEl, shadowRoot.firstChild);
  }
  return styleEl;
}
