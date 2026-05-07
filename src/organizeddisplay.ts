import { INFO_ELEMENT, QuakeStationTable } from "./infotable";
import {
  MAP_ELEMENT,
  QuakeStationMap,
} from "./leafletutil";
import { SeisPlotElement } from "./spelement";
import { SeismogramDisplayData, uniqueStations, uniqueQuakes } from "./seismogram";
import { SeismographConfig } from "./seismographconfig";
import { isDef } from "./util";

import {OrganizedDisplayTools, ORG_DISP_TOOLS_ELEMENT} from "./organizeddisplaytools";
import {OrganizedDisplayItem, ORG_DISP_ITEM, SEISMOGRAPH, MAP} from "./organizeddisplayitem";

export {
  OrganizedDisplayTools, ORG_DISP_TOOLS_ELEMENT,
  OrganizedDisplayItem, ORG_DISP_ITEM, SEISMOGRAPH, MAP
};

export const ORG_DISPLAY = "sp-organized-display";

export const ORG_TYPE = "orgtype";

export const WITH_INFO = "info";
export const DEFAULT_WITH_INFO = "false";
export const WITH_MAP = "map";
export const DEFAULT_WITH_MAP = "false";
export const WITH_TOOLS = "tools";
export const DEFAULT_WITH_TOOLS = "true";

export const OVERLAY_BY = "overlay";
export const OVERLAY_NONE = "none";
export const OVERLAY_INDIVIDUAL = "individual";
export const OVERLAY_VECTOR = "vector";
export const OVERLAY_COMPONENT = "component";
export const OVERLAY_STATION = "station";
export const OVERLAY_STATION_COMPONENT = "stationcomponent";
export const OVERLAY_ALL = "all";
export const OVERLAY_FUNCTION = "function";

export class OrganizedDisplay extends SeisPlotElement {
  bottomSeismographConfig: SeismographConfig|null;
  topSeismographConfig: SeismographConfig|null;
  constructor(
    seisData?: Array<SeismogramDisplayData>,
    seisConfig?: SeismographConfig,
  ) {
    super(seisData, seisConfig);
    this.bottomSeismographConfig = null;
    this.topSeismographConfig = null;
    const wrapper = document.createElement("div");
    wrapper.setAttribute("class", "wrapper");
    this.addStyle(`
    :host {
      display: block;
      min-height: 50px;
      height: 100%;
    }
    @property --sp-seismograph-height {
      syntax: "<length>";
      inherits: true;
      initial-value: 200px;
    }
    sp-station-quake-map {
      height: var(--map-height, 400px);
    }
    sp-organized-display-item {
      min-height: var(--sp-seismograph-height, 200px);
    }
    div.wrapper {
      height: 100%;
    }
    `);
    this.getShadowRoot().appendChild(wrapper);
  }
  static get observedAttributes() {
    const sup = super.observedAttributes;
    const mine = sup.concat([
      ORG_TYPE,
      WITH_TOOLS,
      WITH_MAP,
      WITH_INFO,
      OVERLAY_BY,
    ]);
    const map = QuakeStationMap.observedAttributes;
    return mine.concat(map);
  }

  getDisplayItems(): Array<OrganizedDisplayItem> {
    const wrapper = this.getShadowRoot().querySelector("div") as HTMLDivElement;
    let dispItems = Array.from(wrapper.children);
    dispItems = dispItems.filter((el) => el instanceof OrganizedDisplayItem);
    return dispItems as Array<OrganizedDisplayItem>;
  }

  get orgtype(): string {
    let k = this.hasAttribute(ORG_TYPE)
      ? this.getAttribute(ORG_TYPE)
      : OVERLAY_INDIVIDUAL;
    // typescript null
    if (!k) {
      k = SEISMOGRAPH;
    }
    return k;
  }
  set orgtype(val: string) {
    this.setAttribute(ORG_TYPE, val);
    this.redraw();
  }
  get tools(): string {
    let k = this.hasAttribute(WITH_TOOLS)
      ? this.getAttribute(WITH_TOOLS)
      : DEFAULT_WITH_TOOLS;
    // typescript null
    if (!isDef(k)) {
      k = DEFAULT_WITH_TOOLS;
    }
    k = k.trim().toLowerCase();
    return k;
  }
  set tools(val: string) {
    this.setAttribute(WITH_TOOLS, val);
  }
  get map(): string {
    let k = this.hasAttribute(WITH_MAP)
      ? this.getAttribute(WITH_MAP)
      : DEFAULT_WITH_MAP;
    // typescript null
    if (!isDef(k)) {
      k = DEFAULT_WITH_MAP;
    }
    k = k.trim().toLowerCase();
    return k;
  }
  set map(val: string) {
    this.setAttribute(WITH_MAP, val);
  }
  get info(): string {
    let k = this.hasAttribute(WITH_INFO)
      ? this.getAttribute(WITH_INFO)
      : DEFAULT_WITH_INFO;
    // typescript null
    if (!isDef(k)) {
      k = DEFAULT_WITH_INFO;
    }
    k = k.trim().toLowerCase();
    return k;
  }
  set info(val: string) {
    this.setAttribute(WITH_INFO, val.toLowerCase().trim());
  }
  get overlayby(): string {
    let k = this.hasAttribute(OVERLAY_BY)
      ? this.getAttribute(OVERLAY_BY)
      : OVERLAY_INDIVIDUAL;
    // typescript null
    if (!k) {
      k = OVERLAY_INDIVIDUAL;
    }
    return k;
  }
  set overlayby(val: string) {
    this.setAttribute(OVERLAY_BY, val);
  }

  draw() {
    if (!this.isConnected) {
      return;
    }
    const wrapper = this.getShadowRoot().querySelector("div") as HTMLDivElement;
    wrapper
      .querySelectorAll(ORG_DISP_ITEM)
      .forEach((item) => wrapper.removeChild(item));

    const sortedData = this.sortedSeisData();
    let seisDispItems = new Array<OrganizedDisplayItem>();
    this.drawTools(sortedData);
    this.drawMap(sortedData);
    this.drawInfo(sortedData);
    if (this.overlayby === OVERLAY_INDIVIDUAL) {
      sortedData.forEach((sdd) => {
        const oi = new OrganizedDisplayItem([sdd], this.seismographConfig);
        oi.plottype = SEISMOGRAPH;
        seisDispItems.push(oi);
      });
    } else if (this.overlayby === OVERLAY_VECTOR) {
      const groupedSDD = groupComponentOfMotion(sortedData);
      groupedSDD.forEach((gsdd) => {
        const oi = new OrganizedDisplayItem(gsdd, this.seismographConfig);
        seisDispItems.push(oi);
      });
    } else if (this.overlayby === OVERLAY_COMPONENT) {
      const oitems = overlayByComponent(sortedData, this.seismographConfig);
      seisDispItems = seisDispItems.concat(oitems);
    } else if (this.overlayby === OVERLAY_STATION_COMPONENT) {
      const oitems = overlayByStationComponent(sortedData, this.seismographConfig);
      seisDispItems = seisDispItems.concat(oitems);
    } else if (this.overlayby === OVERLAY_STATION) {
      const oitems = overlayByStation(sortedData, this.seismographConfig);
      seisDispItems = seisDispItems.concat(oitems);
    } else if (this.overlayby === OVERLAY_ALL) {
      const oi = new OrganizedDisplayItem(sortedData, this.seismographConfig);
      seisDispItems.push(oi);
    } else if (this.overlayby === OVERLAY_NONE) {
      // nothing to do here
    } else {
      throw new Error(`Unknown overlay: ${this.overlayby}`);
    }

    if (this.topSeismographConfig != null && seisDispItems.length > 0) {
      seisDispItems[0].seismographConfig = this.topSeismographConfig;
      if (this.topSeismographConfig.margin.top > this.seismographConfig.margin.top) {
        const sp_height = getComputedStyle(seisDispItems[0]).getPropertyValue("--sp-seismograph-height");
        if (sp_height !== "") {
          seisDispItems[0].addStyle(`sp-seismograph {
            height: ${sp_height};
          }`);
        }
      }
    }
    if (this.bottomSeismographConfig != null && seisDispItems.length > 1) {
      seisDispItems[seisDispItems.length-1].seismographConfig = this.bottomSeismographConfig;
    }

    // mouse hover over seismogram highlights station if map show
    seisDispItems.forEach((odi: OrganizedDisplayItem) => {
      if (odi.plottype === SEISMOGRAPH) {
        odi.addEventListener("mouseenter", (_evt) => {
          const mapElement = wrapper.querySelector(MAP_ELEMENT) as QuakeStationMap;
          if (mapElement ) {
            mapElement.stationHighlight(uniqueStations(odi.seisData));
            mapElement.quakeHighlight(uniqueQuakes(odi.seisData));
          }
        });
        odi.addEventListener("mouseleave", (_evt) => {
          const mapElement = wrapper.querySelector(MAP_ELEMENT) as QuakeStationMap;
          if (mapElement ) {
            mapElement.stationUnhighlight();
            mapElement.quakeUnhighlight();
          }
        });
      }
    });

    let allOrgDispItems = new Array<OrganizedDisplayItem>();
    allOrgDispItems = allOrgDispItems.concat(seisDispItems);
    allOrgDispItems.forEach((oi) => {
      wrapper.appendChild(oi);
      oi.draw();
    });
    return;
  }
  drawTools(sortedData: Array<SeismogramDisplayData>) {
    if (!this.isConnected) {
      return;
    }
    const wrapper = this.getShadowRoot().querySelector("div") as HTMLDivElement;
    const toolsElement = wrapper.querySelector(ORG_DISP_TOOLS_ELEMENT);
    if (this.tools !== "true" && toolsElement) {
      wrapper.removeChild(toolsElement);
    } else if (this.tools === "true" ) {
      if (!isDef(toolsElement)) {
        if (sortedData == null)  {sortedData = this.sortedSeisData();}
        const toolsdisp = new OrganizedDisplayTools(
          sortedData,
          this.seismographConfig,
        );
        toolsdisp.organizedDisplay = this;
        // tools is first
        wrapper.insertBefore(toolsdisp, wrapper.firstElementChild);
      } else {
        const orgDispTools = toolsElement as OrganizedDisplayTools;
        orgDispTools.updateStationCheckboxes(this);
      }
    }
  }
  drawMap(sortedData: Array<SeismogramDisplayData>) {
    if (!this.isConnected) {
      return;
    }
    const wrapper = this.getShadowRoot().querySelector("div") as HTMLDivElement;
    const mapElement = wrapper.querySelector(MAP_ELEMENT) as QuakeStationMap;
    if (this.map !== "true" && mapElement) {
      wrapper.removeChild(mapElement);
    } else if (this.map === "true" && !isDef(mapElement)) {
      const mapdisp = new QuakeStationMap(sortedData, this.seismographConfig);
      QuakeStationMap.observedAttributes.forEach((a) => {
        const my_attr = this.getAttribute(a);
        if (my_attr) {
          mapdisp.setAttribute(a, my_attr);
        }
      });
      // map is first
      const toolsElement = wrapper.querySelector(ORG_DISP_TOOLS_ELEMENT);
      // info second after map
      if (toolsElement) {
        if (toolsElement.nextElementSibling) {
          wrapper.insertBefore(mapdisp, toolsElement.nextElementSibling);
        } else {
          wrapper.appendChild(mapdisp);
        }
      } else {
        wrapper.insertBefore(mapdisp, wrapper.firstElementChild);
      }
    } else if (this.map === "true" && isDef(mapElement)) {
      mapElement.seisData = sortedData;
    }
  }
  drawInfo(sortedData: Array<SeismogramDisplayData>) {
    if (!this.isConnected) {
      return;
    }
    const wrapper = this.getShadowRoot().querySelector("div") as HTMLDivElement;
    const infoElement = wrapper.querySelector(
      INFO_ELEMENT,
    ) as QuakeStationTable;
    if (this.info !== "true" && infoElement) {
      wrapper.removeChild(infoElement);
    } else if (this.info === "true" && !isDef(infoElement)) {
      const sortedData = this.sortedSeisData();
      const infoDisp = new QuakeStationTable(
        sortedData,
        this.seismographConfig,
      );
      const toolsElement = wrapper.querySelector(ORG_DISP_TOOLS_ELEMENT);
      const mapElement = wrapper.querySelector(MAP_ELEMENT);
      // info after tools and map
      if (mapElement) {
        if (mapElement.nextElementSibling) {
          wrapper.insertBefore(infoDisp, mapElement.nextElementSibling);
        } else {
          wrapper.appendChild(infoDisp);
        }
      } else if (toolsElement) {
        if (toolsElement.nextElementSibling) {
          wrapper.insertBefore(infoDisp, toolsElement.nextElementSibling);
        } else {
          wrapper.appendChild(infoDisp);
        }
      } else {
        wrapper.insertBefore(infoDisp, wrapper.firstElementChild);
      }
    } else if (this.info === "true" && isDef(infoElement)) {
      infoElement.seisData = sortedData;
    }
  }
  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (name === WITH_MAP) {
      const sortedData = this.sortedSeisData();
      this.drawMap(sortedData);
    } else if (name === WITH_INFO) {
      const sortedData = this.sortedSeisData();
      this.drawInfo(sortedData);
    } else if (QuakeStationMap.observedAttributes.includes(name)) {
      const wrapper = this.getShadowRoot().querySelector(
        "div",
      ) as HTMLDivElement;
      const mapElement = wrapper?.querySelector(MAP_ELEMENT) as QuakeStationMap;
      if (mapElement) {
        mapElement.setAttribute(name, newValue);
      }
    } else {
      this.redraw();
    }
  }
}
customElements.define(ORG_DISPLAY, OrganizedDisplay);

export function individualDisplay(
  sddList: Array<SeismogramDisplayData>,
  seisConfig?: SeismographConfig,
): Array<OrganizedDisplayItem> {
  if (!seisConfig) {
    seisConfig = new SeismographConfig();
  }
  return sddList.map((sdd) => {
    const odisp = new OrganizedDisplayItem([sdd], seisConfig);
    return odisp;
  });
}
export function mapAndIndividualDisplay(
  sddList: Array<SeismogramDisplayData>,
  seisConfig?: SeismographConfig,
): Array<OrganizedDisplayItem> {
  if (!seisConfig) {
    seisConfig = new SeismographConfig();
  }
  const map = new OrganizedDisplayItem(sddList, seisConfig);
  map.plottype = MAP;
  const individual = individualDisplay(sddList);
  individual.unshift(map);
  return individual;
}
export function overlayBySDDFunction(
  sddList: Array<SeismogramDisplayData>,
  key: string,
  sddFun: (arg0: SeismogramDisplayData) => string | number | null,
  seisConfig?: SeismographConfig,
): Array<OrganizedDisplayItem> {
  if (!seisConfig) {
    seisConfig = new SeismographConfig();
  }
  const out: Array<OrganizedDisplayItem> = [];
  sddList.forEach((sdd) => {
    let found = false;
    const val = sddFun(sdd);

    if (!isDef(val)) {
      // do not add/skip sdd that sddFun returns null
      return;
    }

    out.forEach((org) => {
      if (org.getExtra(key) === val) {
        org.seisData.push(sdd);
        found = true;
      }
    });

    if (!found) {
      const org = new OrganizedDisplayItem([sdd], seisConfig);
      org.setExtra(key, val);
      out.push(org);
    }
  });
  return out;
}
export function overlayByComponent(
  sddList: Array<SeismogramDisplayData>,
  seisConfig?: SeismographConfig,
): Array<OrganizedDisplayItem> {
  return overlayBySDDFunction(
    sddList,
    "component",
    (sdd) => sdd.sourceId.subsourceCode,
    seisConfig,
  );
}
export function overlayByStationComponent(
  sddList: Array<SeismogramDisplayData>,
  seisConfig?: SeismographConfig,
): Array<OrganizedDisplayItem> {
  return overlayBySDDFunction(
    sddList,
    "stationcomponent",
    (sdd) => `${sdd.sourceId.stationSourceId().toStringNoPrefix()} ${sdd.sourceId.subsourceCode}`,
    seisConfig,
  );
}
export function overlayByStation(
  sddList: Array<SeismogramDisplayData>,
  seisConfig?: SeismographConfig,
): Array<OrganizedDisplayItem> {
  return overlayBySDDFunction(
    sddList,
    "station",
    (sdd) => sdd.sourceId.stationSourceId().toStringNoPrefix(),
    seisConfig,
  );
}
export function overlayAll(
  sddList: Array<SeismogramDisplayData>,
  seisConfig?: SeismographConfig,
): Array<OrganizedDisplayItem> {
  return overlayBySDDFunction(sddList, "all", () => "all", seisConfig);
}

/**
 * Groups seismic data into subarrays where members of each subarray are
 * from the same network/station, have the same band and gain/instrument code
 * and overlap in time. Note, in most cases the subarrays will have
 * 1, 2 or 3 elements, but this is not checked nor guaranteed.
 *
 * @param   sddList list of SeismogramDisplayData to split
 * @returns          array of array of data, organized by component of motion
 */
export function groupComponentOfMotion(
  sddList: Array<SeismogramDisplayData>,
): Array<Array<SeismogramDisplayData>> {
  let tmpSeisDataList = Array.from(sddList);

  const bifurcate = (
    arr: Array<SeismogramDisplayData>,
    filter: (arg0: SeismogramDisplayData) => boolean,
  ) =>
    arr.reduce(
      (
        acc: Array<Array<SeismogramDisplayData>>,
        val: SeismogramDisplayData,
      ) => (acc[filter(val) ? 0 : 1].push(val), acc),
      [[], []],
    );

  const byFriends = [];
  let first = tmpSeisDataList.shift();
  while (isDef(first)) {
    const isFriend = (sdddB: SeismogramDisplayData) =>
      isDef(first) /* dumb, typescript */ &&
      first.networkCode === sdddB.networkCode &&
      first.stationCode === sdddB.stationCode &&
      first.locationCode === sdddB.locationCode &&
      first.channelCode.slice(0, 2) === sdddB.channelCode.slice(0, 2) &&
      first.timeRange.overlaps(sdddB.timeRange);

    const splitArray = bifurcate(tmpSeisDataList, isFriend);
    const nextGroup = splitArray[0];
    nextGroup.unshift(first);
    byFriends.push(nextGroup);
    tmpSeisDataList = splitArray[1];
    first = tmpSeisDataList.shift();
  }

  return byFriends;
}

export function createAttribute(
  organized: Array<OrganizedDisplayItem>,
  key: string,
  valueFun: (arg0: OrganizedDisplayItem) => string | number | null,
): Array<OrganizedDisplayItem> {
  organized.forEach((org) => {
    if (org.seisData.length > 0) {
      const v = valueFun(org);
      org.setExtra(key, v);
    } else {
      org.setExtra(key, null);
    }
  });
  return organized;
}
export function createPlots(
  organized: Array<OrganizedDisplayItem>,
  divElement: HTMLElement,
) {
  organized.forEach((org) => {
    divElement.appendChild(org);
  });
}
