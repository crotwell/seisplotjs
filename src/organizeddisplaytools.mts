import { SeisPlotElement } from "./spelement.mjs";
import {OrganizedDisplay} from "./organizeddisplay.mjs";
import {createQuakeFilterId} from "./organizeddisplayselect.mjs";
import {
  SeismogramDisplayData,
  uniqueStations,
  uniqueQuakes,
  //uniqueBandCodes,
  //uniqueSourceCodes,
  uniqueSubsourceCodes
} from "./seismogram.mjs";
import { SeismographConfig } from "./seismographconfig.mjs";

const UNDERSCORE = '_';

export const TOOLS_HTML = `
<details>
  <summary>Tools</summary>
  <form>
    <fieldset class="plottype">
      <legend>Plot</legend>
      <span>
        <input type="checkbox" name="with_seis" id="with_seis">
        <label for="with_seis">seismograph</label>
      </span>
      <span>
        <input type="checkbox" name="with_map" id="with_map">
        <label for="with_map">map</label>
      </span>
      <span>
        <input type="checkbox" name="with_info" id="with_info">
        <label for="with_info">info</label>
      </span>
    </fieldset>
    <fieldset class="overlay">
    <legend>Overlay:</legend>
    <span>
      <input type="radio" name="overlay" id="overlay_individual" value="individual" checked>
      <label for="overlay_individual">individual</label>
    </span>
    <span>
      <input type="radio" name="overlay" id="overlay_vector" value="vector">
      <label for="overlay_vector">vector</label>
    </span>
    <span>
      <input type="radio" name="overlay" id="overlay_component" value="component">
      <label for="overlay_component">component</label>
    </span>
    <span>
      <input type="radio" name="overlay" id="overlay_station_component" value="stationcomponent">
      <label for="overlay_station_component">station component</label>
    </span>
    <span>
      <input type="radio" name="overlay" id="overlay_station" value="station">
      <label for="overlay_station">station</label>
    </span>
    <span>
      <input type="radio" name="overlay" id="overlay_all" value="all">
      <label for="overlay_all">all</label>
    </span>
    <span>
      <input type="radio" name="overlay" id="overlay_none" value="none">
      <label for="overlay_none">none</label>
    </span>
  </fieldset>

  </form>
</details>
`;

export class OrganizedDisplayTools extends SeisPlotElement {
  _organizedDisplay: OrganizedDisplay | null;
  constructor(
    seisData?: Array<SeismogramDisplayData>,
    seisConfig?: SeismographConfig,
  ) {
    super(seisData, seisConfig);
    const wrapper = document.createElement("div");
    wrapper.setAttribute("class", "wrapper");
    wrapper.innerHTML = TOOLS_HTML;
    this.getShadowRoot().appendChild(wrapper);
    this._organizedDisplay = null;
  }
  get organizedDisplay() {
    return this._organizedDisplay;
  }
  set organizedDisplay(orgdisp: OrganizedDisplay | null) {
    this._organizedDisplay = orgdisp;
    this.initCheckboxes(orgdisp);
  }
  initCheckboxes(orgdisp: OrganizedDisplay | null) {
    if (orgdisp) {
      const shadow = this.shadowRoot;
      const doSeisCB = shadow?.querySelector(
        "input#with_seis",
      ) as HTMLInputElement;
      if (doSeisCB) {
        doSeisCB.checked = orgdisp.map === "true";
      }
      const doMapCB = shadow?.querySelector(
        "input#with_map",
      ) as HTMLInputElement;
      if (doMapCB) {
        doMapCB.checked = orgdisp.map === "true";
      }
      const doInfoCB = shadow?.querySelector(
        "input#with_info",
      ) as HTMLInputElement;
      if (doInfoCB) {
        doInfoCB.checked = orgdisp.info === "true";
      }
      shadow?.querySelectorAll("fieldset.overlay input").forEach((i) => {
        const inEl = i as HTMLInputElement;
        inEl.checked = orgdisp.overlayby === inEl.value;
      });
      const details = shadow?.querySelector("div.wrapper details");
      details?.querySelector("fieldset.sort")?.remove();
      details?.appendChild(this.createSortCheckboxes(orgdisp));
      const select = document.createElement("fieldset");
      select.classList.add("selection");
      const selectlegend = document.createElement("legend");
      selectlegend.textContent = "Select:";
      select.appendChild(selectlegend);
      details?.appendChild(select);
      select.querySelector("fieldset.stations")?.remove();
      select.appendChild(this.createStationCheckboxes(orgdisp));
      select.querySelector("fieldset.orientations")?.remove();
      select.appendChild(this.createOrientationCheckboxes(orgdisp));
      select.querySelector("fieldset.quakes")?.remove();
      select.appendChild(this.createQuakeCheckboxes(orgdisp));
    }
  }
  createSortCheckboxes(orgdisp: OrganizedDisplay) {
    const sortFS = document.createElement("fieldset");
    sortFS.classList.add("sort");
    const legend = document.createElement("legend");
    legend.textContent = "Sort:";
    sortFS.appendChild(legend);
    const sortKeyList = Array.from(orgdisp._sorting.keys());
    sortKeyList.push("none");
    for (const sortKey of sortKeyList) {
      const span = document.createElement("span");
      const input = document.createElement("input");
      input.setAttribute("type", "radio");
      input.setAttribute("name", "sort");
      input.setAttribute("id", `sort_${sortKey}`);
      input.setAttribute("value", sortKey);
      input.checked = orgdisp.sortby === input.value;
      input.addEventListener("change", (_e) => {
        if (this._organizedDisplay) {
          this._organizedDisplay?.setAttribute("sort", input.value);
        }
      });
      span.appendChild(input);
      const label = document.createElement("label");
      label.setAttribute("for", `sort_${sortKey}`);
      label.textContent = sortKey;
      span.appendChild(label);
      sortFS.appendChild(span);
    }
    return sortFS;
  }
  createStationCheckboxes(orgdisp: OrganizedDisplay) {
    const staDiv = document.createElement("fieldset");
    staDiv.classList.add("stations");
    const staDivLabel = document.createElement("legend");
    staDivLabel.textContent = "Station:";
    staDiv.appendChild(staDivLabel);
    this.updateStationCheckboxes(orgdisp);
    return staDiv;
  }
  updateCheckboxes(orgdisp: OrganizedDisplay) {
    this.updateStationCheckboxes(orgdisp);
    this.updateOrientationCheckboxes(orgdisp);
    this.updateQuakeCheckboxes(orgdisp);
  }
  allStationCheckboxes() {
    const div = this.shadowRoot?.querySelector("fieldset.stations") as HTMLElement;
    if (div == null) {
      // ???
      return [];
    }
    return div.querySelectorAll("input");
  }
  updateStationCheckboxes(orgdisp: OrganizedDisplay) {
    const staDiv = this.shadowRoot?.querySelector("fieldset.stations") as HTMLElement;
    if (staDiv === null) {
      // ???
      return;
    }

    const stations = uniqueStations(orgdisp.sortedSeisData());
    stations.forEach(sta => {
      const display = sta.codes(UNDERSCORE);
      const key = `station_${display}`;
      const name = "station";
      let foundSta = false;
      staDiv.querySelectorAll("input").forEach((cb: HTMLInputElement) => {
        if (cb.value === key) {foundSta = true;}
      });
      if (!foundSta) {
        this.createCheckbox(staDiv, name, key, display);
      }
    });
  }

  createCheckbox(staDiv: HTMLElement, name: string, key: string, display?: string|null) {
    if (display == null) {display = key;}
    const span = document.createElement("span");
    const input = document.createElement("input");
    input.setAttribute("type", "checkbox");
    input.setAttribute("name", name);
    input.setAttribute("id", key);
    input.setAttribute("value", key);
    input.checked = true;
    input.addEventListener("change", (_e) => {
      if (this._organizedDisplay) {
        this._organizedDisplay.redraw();
      }
    });
    span.appendChild(input);
    const label = document.createElement("label");
    label.setAttribute("for", key);
    label.textContent = display;
    span.appendChild(label);
    staDiv.appendChild(span);
    return input;
  }
  createOrientationCheckboxes(orgdisp: OrganizedDisplay) {
    const orientDiv = document.createElement("fieldset");
    orientDiv.classList.add("orientations");
    const orientDivLabel = document.createElement("legend");
    orientDivLabel.textContent = "Orientation:";
    orientDiv.appendChild(orientDivLabel);
    this.updateOrientationCheckboxes(orgdisp);
    return orientDiv;
  }
  allOrientationCheckboxes() {
    const div = this.shadowRoot?.querySelector("fieldset.orientations") as HTMLElement;
    if (div == null) {
      // ???
      return [];
    }
    return div.querySelectorAll("input");
  }
  updateOrientationCheckboxes(orgdisp: OrganizedDisplay) {
    const div = this.shadowRoot?.querySelector("fieldset.orientations") as HTMLElement;
    if (div == null) {
      // ???
      return;
    }

    let orientations = uniqueSubsourceCodes(orgdisp.sortedSeisData()).sort();
    orientations.forEach(orient => {
      const key = `orient_${orient}`;
      const name = "orientation";
      let found = false;
      div.querySelectorAll("input").forEach((cb: HTMLInputElement) => {
        if (cb.value === key) {found = true;}
      });
      if (!found) {
        this.createCheckbox(div, name, key, orient);
      }
    });

  }
  createQuakeCheckboxes(orgdisp: OrganizedDisplay) {
    const quakeDiv = document.createElement("fieldset");
    quakeDiv.classList.add("quakes");
    const quakeDivLabel = document.createElement("legend");
    quakeDivLabel.textContent = "Earthquake:";
    quakeDiv.appendChild(quakeDivLabel);
    this.updateQuakeCheckboxes(orgdisp);

    return quakeDiv;
  }
  allQuakeCheckboxes() {
    const div = this.shadowRoot?.querySelector("fieldset.quakes") as HTMLElement;
    if (div == null) {
      // ???
      return [];
    }
    return div.querySelectorAll("input");
  }
  updateQuakeCheckboxes(orgdisp: OrganizedDisplay) {
    const div = this.shadowRoot?.querySelector("fieldset.quakes") as HTMLElement;
    if (div === null) {
      // ???
      return;
    }

    const quakes = uniqueQuakes(orgdisp.sortedSeisData());
    quakes.forEach(quake => {
      const key = createQuakeFilterId(quake);
      const name = "quake";
      let found = false;
      div.querySelectorAll("input").forEach((cb: HTMLInputElement) => {
        if (cb.value === key) {found = true;}
      });
      if (!found) {
        this.createCheckbox(div, name, key,
          `${quake.hasMagnitude()?quake.magnitude.mag:""} ${quake.time.toISO({ includeOffset: false })}`);
      }
    });
  }

  draw() {
    const wrapper = this.getShadowRoot().querySelector("div") as HTMLDivElement;

    wrapper.innerHTML = TOOLS_HTML;
    this.wireComponents();
  }
  wireComponents() {
    const shadow = this.shadowRoot;
    const doMapCB = shadow?.querySelector("input#with_map") as HTMLInputElement;
    doMapCB?.addEventListener("change", () => {
      if (this._organizedDisplay) {
        this._organizedDisplay.map = doMapCB.checked ? "true" : "false";
      }
    });
    const doInfoCB = shadow?.querySelector(
      "input#with_info",
    ) as HTMLInputElement;
    doInfoCB?.addEventListener("change", () => {
      if (this._organizedDisplay) {
        this._organizedDisplay.info = `${doInfoCB.checked}`;
      }
    });
    shadow?.querySelectorAll("fieldset.overlay input").forEach((i) => {
      const inEl = i as HTMLInputElement;
      inEl.addEventListener("change", (_e) => {
        if (this._organizedDisplay) {
          this._organizedDisplay?.setAttribute("overlay", inEl.value);
        }
      });
    });
    shadow?.querySelectorAll("fieldset.sort input").forEach((i) => {
      const inEl = i as HTMLInputElement;
      inEl.addEventListener("change", (_e) => {
        if (this._organizedDisplay) {
          this._organizedDisplay?.setAttribute("sort", inEl.value);
        }
      });
    });
    // sort wired in initCheckboxes as is dynamic,so must be done later
    this.initCheckboxes(this._organizedDisplay);
  }
}
export const ORG_DISP_TOOLS_ELEMENT = "sp-orgdisp-tools";
customElements.define(ORG_DISP_TOOLS_ELEMENT, OrganizedDisplayTools);
