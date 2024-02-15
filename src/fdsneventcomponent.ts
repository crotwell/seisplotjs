import { EventQuery } from "./fdsnevent";
import {
  LatLonChoice,
  LatLonBoxEl,
  LatLonRadiusEl,
  LabeledMinMax,
} from "./components";
import { TimeRangeChooser } from "./datechooser";
import { isoToDateTime } from "./util";
import { DateTime, Duration } from "luxon";

const eqsearchHtml = `
<div class="wrapper">
  <div>
  <label>Time Range </label>
  <sp-timerange duration="P7D"></sp-timerange>
  <button id="now">Now</button></div>
  <div>
  <button id="today">Today</button>
  <button id="week">Week</button>
  <button id="month">Month</button>
  <button id="year">Year</button>
  </div>
  <div>
    <label>Geo:</label>
    <sp-latlon-choice></sp-latlon-choice>
  </div>
  <div><label>Magnitude</label><sp-minmax id="magnitude" min="-1" max="10"></sp-minmax></div>
  <div><label>Depth</label><sp-minmax id="depth" min="0" max="1000"></sp-minmax><label>km</label></div>
</div>
`;

export class EarthquakeSearch extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: "open" });
    this.draw_element(shadow);
  }
  _registerEvent(wrapper: HTMLElement, sel: string) {
    const component = wrapper.querySelector(sel) as HTMLElement;
    if (!component) {
      throw new Error(`can't find ${sel}`);
    }
    component.addEventListener("change", () =>
      this.dispatchEvent(new Event("change")),
    );
  }
  draw_element(shadow: ShadowRoot) {
    const wrapper = document.createElement("div");
    wrapper.setAttribute("class", "wrapper");
    wrapper.innerHTML = eqsearchHtml;
    shadow.appendChild(wrapper);
    this._registerEvent(wrapper, "sp-timerange");
    this._registerEvent(wrapper, "sp-latlon-choice");
    this._registerEvent(wrapper, "sp-minmax#magnitude");
    this._registerEvent(wrapper, "sp-minmax#depth");

    const trChooser = wrapper.querySelector("sp-timerange") as TimeRangeChooser;
    if (!trChooser) {
      throw new Error("can't find sp-timerange");
    }
    if (this.hasAttribute("start")) {
      const s = this.getAttribute("start");
      if (s !== null) {
        trChooser.start = isoToDateTime(s);
      }
    }
    if (this.hasAttribute("end")) {
      const e = this.getAttribute("end");
      if (e !== null) {
        trChooser.end = isoToDateTime(e);
      }
    }
    if (this.hasAttribute("duration")) {
      const d = this.getAttribute("duration");
      if (d !== null) {
        trChooser.duration = Duration.fromISO("" + d);
      }
    }

    const magChooser = wrapper.querySelector(
      "sp-minmax#magnitude",
    ) as LabeledMinMax;
    if (!magChooser) {
      throw new Error("can't find sp-minmax#magnitude");
    }
    if (this.hasAttribute("mag-min")) {
      const m = this.getAttribute("mag-min");
      if (m !== null) {
        magChooser.min = parseFloat(m);
      }
    }
    if (this.hasAttribute("mag-max")) {
      const m = this.getAttribute("mag-max");
      if (m !== null) {
        magChooser.max = parseFloat(m);
      }
    }

    const depthChooser = wrapper.querySelector(
      "sp-minmax#depth",
    ) as LabeledMinMax;
    if (!depthChooser) {
      throw new Error("can't find sp-minmax#depth");
    }
    if (this.hasAttribute("depth-min")) {
      const m = this.getAttribute("depth-min");
      if (m !== null) {
        depthChooser.min = parseFloat(m);
      }
    }
    if (this.hasAttribute("depth-max")) {
      const m = this.getAttribute("depth-max");
      if (m !== null) {
        depthChooser.max = parseFloat(m);
      }
    }

    const latlonChooser = wrapper.querySelector(
      "sp-latlon-choice",
    ) as LatLonChoice;
    if (!latlonChooser) {
      throw new Error("can't find sp-latlon-choice");
    }
    LatLonChoice.observedAttributes.forEach((attr) => {
      if (this.hasAttribute(attr)) {
        // typescript
        const attrVal = this.getAttribute(attr);
        if (attrVal) {
          latlonChooser.setAttribute(attr, attrVal);
        }
      }
    });

    const nowBtn = wrapper.querySelector("#now");
    if (!nowBtn) {
      throw new Error("can't find button#now");
    }
    nowBtn.addEventListener("click", (event) => {
      trChooser.end = DateTime.utc();
    });

    const todayBtn = wrapper.querySelector("#today");
    if (!todayBtn) {
      throw new Error("can't find button#today");
    }
    todayBtn.addEventListener("click", (event) => {
      trChooser.duration = Duration.fromISO("P1D");
    });

    const weekBtn = wrapper.querySelector("#week");
    if (!weekBtn) {
      throw new Error("can't find button#week");
    }
    weekBtn.addEventListener("click", (event) => {
      trChooser.duration = Duration.fromISO("P7D");
    });

    const monthBtn = wrapper.querySelector("#month");
    if (!monthBtn) {
      throw new Error("can't find button#month");
    }
    monthBtn.addEventListener("click", (event) => {
      trChooser.duration = Duration.fromISO("P1M");
    });

    const yearBtn = wrapper.querySelector("#year");
    if (!yearBtn) {
      throw new Error("can't find button#year");
    }
    yearBtn.addEventListener("click", (event) => {
      trChooser.duration = Duration.fromISO("P1Y");
    });
  }
  populateQuery(query?: EventQuery): EventQuery {
    if (!query) {
      query = new EventQuery();
    }
    const wrapper = this.shadowRoot?.querySelector("div") as HTMLDivElement;
    const trChooser = wrapper.querySelector("sp-timerange") as TimeRangeChooser;
    if (!trChooser) {
      throw new Error("can't find sp-timerange");
    }
    query.startTime(trChooser.start);
    query.endTime(trChooser.end);
    const latlonchoice = wrapper.querySelector(
      "sp-latlon-choice",
    ) as LatLonChoice;
    const choosenLatLon = latlonchoice.choosen();
    if (choosenLatLon instanceof LatLonBoxEl) {
      const latlonbox = choosenLatLon;
      if (latlonbox.south > -90) {
        query.minLat(latlonbox.south);
      }
      if (latlonbox.north < 90) {
        query.maxLat(latlonbox.north);
      }
      if (latlonbox.west > -180 && latlonbox.west + 360 !== latlonbox.east) {
        query.minLon(latlonbox.west);
      }
      if (latlonbox.east < 360 && latlonbox.west + 360 !== latlonbox.east) {
        query.maxLon(latlonbox.east);
      }
    } else if (choosenLatLon instanceof LatLonRadiusEl) {
      const latlonrad = choosenLatLon;
      if (latlonrad.minRadius > 0 || latlonrad.maxRadius < 180) {
        query.latitude(latlonrad.latitude);
        query.longitude(latlonrad.longitude);
        if (latlonrad.minRadius > 0) {
          query.minRadius(latlonrad.minRadius);
        }
        if (latlonrad.maxRadius < 180) {
          query.maxRadius(latlonrad.maxRadius);
        }
      }
    } else {
      // null means all, whole world
    }
    const mag = wrapper.querySelector("sp-minmax#magnitude") as LabeledMinMax;
    if (mag.min > 0) {
      query.minMag(mag.min);
    }
    if (mag.max < 10) {
      query.maxMag(mag.max);
    }
    const depth = wrapper.querySelector("sp-minmax#depth") as LabeledMinMax;
    if (depth.min > 0) {
      query.minDepth(depth.min);
    }
    if (depth.max < 1000) {
      query.maxDepth(depth.max);
    }
    return query;
  }
}

customElements.define("sp-earthquake-search", EarthquakeSearch);
