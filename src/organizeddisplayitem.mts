import { fftForward } from "./fft";
import * as spectraplot from "./spectraplot";
import { ParticleMotion, createParticleMotionConfig } from "./particlemotion";
import { Seismograph } from "./seismograph";
import * as querystringify from "querystringify";
import { SeisPlotElement } from "./spelement";
import { SeismogramDisplayData } from "./seismogram";
import { SeismographConfig } from "./seismographconfig";
import { QuakeStationTable } from "./infotable";
import {
  QuakeStationMap,
} from "./leafletutil";
import { isDef, isStringArg, stringify } from "./util";


export const ORG_DISP_ITEM = "sp-organized-display-item";

export const PLOT_TYPE = "plottype";
export const SEISMOGRAPH = "seismograph";
export const SPECTRA = "amp_spectra";
export const PARTICLE_MOTION = "particlemotion";
export const MAP = "map";
export const INFO = "info";
export const QUAKE_TABLE = "quake_table";
export const STATION_TABLE = "station_table";

export class OrganizedDisplayItem extends SeisPlotElement {
  extras: Map<string, unknown>;

  constructor(
    seisData?: Array<SeismogramDisplayData>,
    seisConfig?: SeismographConfig,
  ) {
    super(seisData, seisConfig);
    if (this.plottype.startsWith(PARTICLE_MOTION)) {
      this._seismographConfig = createParticleMotionConfig(null, seisConfig);
    }

    this.extras = new Map();

    this.addStyle(`
    :host {
      display: block;
      min-height: 50px;

    }
    sp-station-quake-map {
      height: 400px;
    }
    sp-seismograph {
      height: var(--sp-seismograph-height, 200px);
    }
    div.wrapper {
      height: 100%;
    }
    `);
    const wrapper = document.createElement("div");
    wrapper.setAttribute("class", "wrapper");
    this.getShadowRoot().appendChild(wrapper);
  }
  get plottype(): string {
    let k = this.hasAttribute(PLOT_TYPE)
      ? this.getAttribute(PLOT_TYPE)
      : SEISMOGRAPH;
    // typescript null
    if (!k) {
      k = SEISMOGRAPH;
    }
    return k;
  }
  set plottype(val: string) {
    this.setAttribute(PLOT_TYPE, val);
    this.redraw();
  }


  set seismographConfig(seismographConfig: SeismographConfig) {
    super.seismographConfig = seismographConfig;
    this.getContainedPlotElements().forEach( (spe: SeisPlotElement) => {
      spe.seismographConfig = seismographConfig;
    });
    this.seisDataUpdated();

  }

  static get observedAttributes() {
    return [PLOT_TYPE];
  }
  attributeChangedCallback(_name: string, _oldValue: unknown, _newValue: unknown) {
    this.redraw();
  }
  setExtra(key: string, value: unknown) {
    this.extras.set(key, value);
  }

  hasExtra(key: string): boolean {
    return this.extras.has(key);
  }

  getExtra(key: string): unknown {
    if (this.extras.has(key)) {
      return this.extras.get(key);
    }
    return null;
  }
  getContainedPlotElements(): Array<SeisPlotElement> {
    const wrapper = this.getShadowRoot().querySelector("div") as HTMLDivElement;
    let dispItems = Array.from(wrapper.children);
    dispItems = dispItems.filter((el) => el instanceof SeisPlotElement);
    return dispItems as Array<SeisPlotElement>;
  }

  draw(): void {
    if (!this.isConnected) {
      return;
    }
    const wrapper = this.getShadowRoot().querySelector("div") as HTMLDivElement;

    while (wrapper.firstChild) {
      // @ts-expect-error if there is a firstChild, there is also lastChild
      wrapper.removeChild(wrapper.lastChild);
    }
    const qIndex = this.plottype.indexOf("?");
    let queryParams: Record<string, unknown>;

    if (qIndex !== -1) {
      queryParams = querystringify.parse(
        this.plottype.substring(qIndex),
      ) as Record<string, unknown>;
    } else {
      queryParams = {};
    }

    if (this.plottype.startsWith(SEISMOGRAPH)) {
      const seismograph = new Seismograph(
        this.seisData,
        this._seismographConfig,
      );
      wrapper.appendChild(seismograph);

    } else if (this.plottype.startsWith(SPECTRA)) {
      const loglog = getFromQueryParams(queryParams, "loglog", "true");
      const nonContigList = this.seisData.filter(
        (sdd) => !(sdd.seismogram && sdd.seismogram.isContiguous()),
      );

      if (nonContigList.length > 0) {
        const nonContigMsg =
          "non-contiguous seismograms, skipping: " +
          nonContigList
            .map((sdd) =>
              isDef(sdd.seismogram)
                ? `${sdd.codes()} ${sdd.seismogram.segments.length}`
                : "null",
            )
            .join(",");
        const p = wrapper.appendChild(document.createElement("p"));
        p.textContent = nonContigMsg;
      }

      const fftList = this.seisData.map((sdd) => {
        return sdd.seismogram && sdd.seismogram.isContiguous()
          ? fftForward(sdd)
          : null;
      });
      const fftListNoNull = fftList.filter(isDef);
      const spectraPlot = new spectraplot.SpectraPlot(
        fftListNoNull,
        this._seismographConfig,
      );
      spectraPlot.setAttribute(spectraplot.LOGFREQ, loglog);
      wrapper.appendChild(spectraPlot);
    } else if (this.plottype.startsWith(PARTICLE_MOTION)) {
      if (this.seisData.length !== 2) {
        throw new Error(
          `particle motion requies exactly 2 seisData in seisDataList, ${this.seisData.length}`,
        );
      }

      const pmpSeisConfig = this._seismographConfig.clone();
      const particleMotionPlot = new ParticleMotion(
        [this.seisData[0]],
        [this.seisData[1]],
        pmpSeisConfig,
      );
      wrapper.appendChild(particleMotionPlot);
    } else if (this.plottype.startsWith(MAP)) {
      const mapid =
        "map" + (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);

      const seismap = new QuakeStationMap(this.seisData);
      seismap.setAttribute("id", mapid);
      for (const mapAttr of QuakeStationMap.observedAttributes) {
        if (queryParams[mapAttr]) {
          seismap.setAttribute(mapAttr, getFromQueryParams(queryParams, mapAttr));
        }
      }
      wrapper.appendChild(seismap);
    } else if (this.plottype.startsWith(INFO)) {
      const infotable = new QuakeStationTable(
        this.seisData,
        this._seismographConfig,
      );
      wrapper.appendChild(infotable);
    } else {
      throw new Error(`Unkown plottype "${this.plottype}"`);
    }
  }
}

customElements.define(ORG_DISP_ITEM, OrganizedDisplayItem);


export function getFromQueryParams(
  qParams: Record<string, unknown>,
  name: string,
  defaultValue = "",
): string {
  if (name in qParams) {
    const v = qParams[name];
    if (isStringArg(v)) {
      return v;
    } else {
      throw new Error(
        `param ${name} exists but is not string: ${stringify(qParams[name])}`,
      );
    }
  }

  return defaultValue;
}
