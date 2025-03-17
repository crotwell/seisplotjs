import { Quake, createQuakeClickEvent } from "./quakeml";
import {
  Channel,
  Station,
  createStationClickEvent,
  createChannelClickEvent,
} from "./stationxml";
import { SeisPlotElement, addStyleToElement } from "./spelement";
import { SeismogramDisplayData } from "./seismogram";
import { SeismographConfig } from "./seismographconfig";
import { stringify, nameForTimeZone } from "./util";
import * as textformat from "./textformat";
import { Handlebars } from "./handlebarshelpers";
import {DateTime, Zone} from "luxon";

export const INFO_ELEMENT = "sp-station-quake-table";
export const QUAKE_INFO_ELEMENT = "sp-quake-table";

export enum QUAKE_COLUMN {
  LAT = "Lat",
  LON = "Lon",
  TIME = "Time",
  LOCALTIME = "Local Time",
  MAG = "Mag",
  MAGTYPE = "MagType",
  DEPTH = "Depth",
  DESC = "Description",
  EVENTID = "EventId",
}

export enum CHANNEL_COLUMN {
  LAT = "Lat",
  LON = "Lon",
  AZIMUTH = "Az",
  DIP = "Dip",
  START = "Start",
  END = "End",
  ELEVATION = "Elev",
  DEPTH = "Depth",
  SOURCEID = "SourceId",
  CODE = "Code",
  NETWORK_CODE = "NetworkCode",
  STATION_CODE = "StationCode",
  LOCATION_CODE = "LocationCode",
  CHANNEL_CODE = "ChannelCode",
}

export enum STATION_COLUMN {
  LAT = "Lat",
  LON = "Lon",
  START = "Start",
  END = "End",
  ELEVATION = "Elev",
  SOURCEID = "SourceId",
  CODE = "Code",
  NETWORK_CODE = "NetworkCode",
  STATION_CODE = "StationCode",
  DESCRIPTION = "Description",
}

export enum SEISMOGRAM_COLUMN {
  START = "Start",
  DURATION = "Duration",
  END = "End",
  NUM_POINTS = "Num Pts",
  SAMPLE_RATE = "Sample Rate",
  SAMPLE_PERIOD = "Sample Period",
  SEGMENTS = "Segments",
  SOURCEID = "SourceId",
  CODE = "Codes",
  NETWORK_CODE = "NetworkCode",
  STATION_CODE = "StationCode",
}

export const DEFAULT_TEMPLATE = `
  <table>
  <thead>
      <tr>
        <th colspan="7">Waveform</th>
        <th colspan="4">Channel</th>
        <th colspan="6">Event</th>
        <th colspan="4">DistAz</th>
      </tr>
      <tr>
        <th>Codes</th>
        <th>Start</th>
        <th>Duration</th>
        <th>End</th>
        <th>Num Pts</th>
        <th>Sample Rate</th>
        <th>YUnit</th>
        <th>Seg</th>

        <th>Lat</th>
        <th>Lon</th>
        <th>Elev</th>
        <th>Depth</th>

        <th>Time</th>
        <th>Lat</th>
        <th>Lon</th>
        <th colspan="2">Mag</th>
        <th>Depth</th>

        <th>Dist deg</th>
        <th>Dist km</th>
        <th>Azimuth</th>
        <th>Back Azimuth</th>
      </tr>
    </thead>
    <tbody>
    {{#each seisDataList as |sdd|}}
      <tr>
        <td>{{sdd.nslc}}</td>
        <td>{{formatIsoDate sdd.seismogram.startTime}}</td>
        <td>{{formatDuration sdd.seismogram.timeRange}}</td>
        <td>{{formatIsoDate sdd.seismogram.endTime}}</td>
        <td>{{sdd.seismogram.numPoints}}</td>
        <td>{{sdd.seismogram.sampleRate}}</td>
        <td>{{sdd.seismogram.yUnit}}</td>
        <td>{{sdd.seismogram.segments.length}}</td>

        {{#if sdd.channel}}
          <td>{{sdd.channel.latitude}}</td>
          <td>{{sdd.channel.longitude}}</td>
          <td>{{sdd.channel.elevation}}</td>
          <td>{{sdd.channel.depth}}</td>
        {{else}}
          <td>no channel</td>
          <td/>
          <td/>
          <td/>
        {{/if}}

        {{#if sdd.quake }}
          <td>{{formatIsoDate sdd.quake.time}}</td>
          <td>{{sdd.quake.latitude}}</td>
          <td>{{sdd.quake.longitude}}</td>
          <td>{{sdd.quake.magnitude.mag}}</td>
          <td>{{sdd.quake.magnitude.type}}</td>
          <td>{{sdd.quake.depthKm}}</td>
        {{else}}
          <td>no quake</td>
          <td/>
          <td/>
          <td/>
          <td/>
          <td/>
        {{/if}}
        {{#if sdd.quake }}
          {{#if sdd.channel }}
            <td>{{formatNumber sdd.distaz.distanceDeg 2}}</td>
            <td>{{formatNumber sdd.distaz.distanceKm 0}}</td>
            <td>{{formatNumber sdd.distaz.az 2}}</td>
            <td>{{formatNumber sdd.distaz.baz 2}}</td>
          {{/if}}
        {{/if}}
      </tr>
    {{/each}}
    </tbody>
  </table>
`;

export const TABLE_CSS = `
tbody tr:nth-child(even)
{
  background: var(--even-row-background, Cornsilk);
}
tbody tr:nth-child(odd)
{
  background: var(--odd-row-background);
}
table {
    display: block;
    overflow-x: auto;
    white-space: nowrap;
}
`;

/**
 * Table displaying information about waveforms, quakes, channels and stations.
 *
 * The CSS vars --even-row-background and --odd-row-background will change
 * the color of even and odd rows. Default for odd is nothing, even is Cornsilk.
 *
 * @param seisData    Array of SeismogramDisplayData for display
 * @param seisConfig  configuration
 */
export class QuakeStationTable extends SeisPlotElement {
  _template: string;
  constructor(
    seisData?: Array<SeismogramDisplayData>,
    seisConfig?: SeismographConfig,
  ) {
    super(seisData, seisConfig);
    this._template = DEFAULT_TEMPLATE;

    this.addStyle(TABLE_CSS);

    const wrapper = document.createElement("div");
    wrapper.setAttribute("class", "wrapper");
    this.getShadowRoot().appendChild(wrapper);
  }
  get template(): string {
    return this._template;
  }
  set template(t: string) {
    this._template = t;
    this.redraw();
  }
  draw() {
    if (!this.isConnected) {
      return;
    }
    const wrapper = this.getShadowRoot().querySelector("div") as HTMLDivElement;
    while (wrapper.firstChild) {
      // typescript
      if (wrapper.lastChild) {
        wrapper.removeChild(wrapper.lastChild);
      }
    }
    const handlebarsCompiled = Handlebars.compile(this.template);
    wrapper.innerHTML = handlebarsCompiled(
      {
        seisDataList: this.seisData,
        seisConfig: this.seismographConfig,
      },
      {
        allowProtoPropertiesByDefault: true, // this might be a security issue???
      },
    );
  }
}

customElements.define(INFO_ELEMENT, QuakeStationTable);

export class QuakeTable extends HTMLElement {
  _columnLabels: Map<string, string>;
  _quakeList: Array<Quake>;
  _rowToQuake: Map<HTMLTableRowElement, Quake>;
  _timezone?: Zone;
  lastSortAsc = true;
  lastSortCol: string | undefined;
  _columnValues: Map<string, (q: Quake) => string>;

  constructor(
    quakeList?: Array<Quake>,
    columnLabels?: Map<string, string>,
    columnValues?: Map<string, (q: Quake) => string>,
  ) {
    super();
    if (!quakeList) {
      quakeList = [];
    }
    if (!columnLabels) {
      columnLabels = QuakeTable.createDefaultColumnLabels();
    }
    // Column Values are optional at the individual key level.
    // For the columns that the user does not provide a function,
    // use the default display style in getQuakeValue
    if (!columnValues) {
      columnValues = new Map<string, (q: Quake) => string>();
      let defColumnValues = QuakeTable.createDefaultColumnValues();
      for (const key of columnLabels.keys()) {
        if (defColumnValues.has(key)) {
          const fn = defColumnValues.get(key);
          if (fn != null) {
            columnValues.set(key, fn);
          } else {
            throw new Error(`QuakeTable function for key is missing: ${key}`);
          }
        } else {
          throw new Error(`Unknown QuakeTable key: ${key}`);
        }
      }
    }

    this._quakeList = quakeList;
    this._columnLabels = columnLabels;
    this._columnValues = columnValues;
    this._rowToQuake = new Map();
    const shadow = this.attachShadow({ mode: "open" });
    const table = document.createElement("table");
    table.setAttribute("class", "wrapper");
    addStyleToElement(this, TABLE_CSS);

    shadow.appendChild(table);
  }
  get quakeList(): Array<Quake> {
    return this._quakeList;
  }
  set quakeList(ql: Array<Quake>) {
    this._quakeList = ql;
    this.draw();
  }
  get columnLabels(): Map<string, string> {
    return this._columnLabels;
  }
  set columnLabels(cols: Map<string, string>) {
    this._columnLabels = cols;
    this.draw();
  }
  get columnValues(): Map<string, (q: Quake) => string> {
    return this._columnValues;
  }
  set columnValues(cols: Map<string, (q: Quake) => string>) {
    this._columnValues = cols;
    this.draw();
  }
  get timeZone(): Zone|undefined {
    return this._timezone;
  }
  set timeZone(timezone: Zone|undefined) {
    this._timezone = timezone;
    this.draw();
  }
  static createDefaultColumnLabels() {
    let columnLabels = new Map();
    columnLabels.set(QUAKE_COLUMN.TIME, "Time");
    columnLabels.set(QUAKE_COLUMN.LAT, "Lat");
    columnLabels.set(QUAKE_COLUMN.LON, "Lon");
    columnLabels.set(QUAKE_COLUMN.MAG, "Mag");
    columnLabels.set(QUAKE_COLUMN.MAGTYPE, "Type");
    columnLabels.set(QUAKE_COLUMN.DEPTH, "Depth");
    columnLabels.set(QUAKE_COLUMN.DESC, "Description");
    return columnLabels;
  }

  static createDefaultColumnValues() {
    let columnValues = new Map<string, (q: Quake) => string>();
    columnValues.set(QUAKE_COLUMN.TIME, (q: Quake) => stringify(q.time.toISO()));
    columnValues.set(QUAKE_COLUMN.LOCALTIME, (q: Quake) => stringify(q.time.setZone('local').toISO()));
    columnValues.set(QUAKE_COLUMN.LAT, (q: Quake) => latlonFormat.format(q.latitude));
    columnValues.set(QUAKE_COLUMN.LON, (q: Quake) => latlonFormat.format(q.longitude));
    columnValues.set(QUAKE_COLUMN.MAG, (q: Quake) => magFormat.format(q.magnitude.mag));
    columnValues.set(QUAKE_COLUMN.MAGTYPE, (q: Quake) => q.magnitude.type ? q.magnitude.type : "");
    columnValues.set(QUAKE_COLUMN.DEPTH, (q: Quake) => depthFormat.format(q.depthKm));
    columnValues.set(QUAKE_COLUMN.EVENTID, (q: Quake) => stringify(q.eventId));
    columnValues.set(QUAKE_COLUMN.DESC,
      (q: Quake) => { const desc = q.description;
        if (desc && desc.length > 0) {
          return desc;
        } else {
          return stringify(q.time.toISO());
        }
      });
    return columnValues;
  }

  addStyle(css: string, id?: string): HTMLStyleElement {
    return addStyleToElement(this, css, id);
  }
  findRowForQuake(q: Quake): HTMLTableRowElement | null {
    let quakeRow = null;
    this._rowToQuake.forEach((v, k) => {
      if (v === q) {
        quakeRow = k;
      }
    });
    return quakeRow;
  }
  draw() {
    if (!this.isConnected) {
      return;
    }
    const table = this.shadowRoot?.querySelector("table") as HTMLTableElement;
    table.deleteTHead();
    const theader = table.createTHead().insertRow();
    this.headers().forEach((h) => {
      const cell = theader.appendChild(document.createElement("th"));
      let label = this._columnLabels.has(h) ? this._columnLabels.get(h) : h;
      cell.textContent = `${label}`;
      if (h === QUAKE_COLUMN.LOCALTIME) {
        if (this.timeZone) {
          cell.textContent = `${this._columnLabels.get(h)} ${nameForTimeZone(this.timeZone, DateTime.now())}`;
        } else {
          cell.textContent = `${this._columnLabels.get(h)} ${nameForTimeZone('local', DateTime.now())}`;
        }
      }
      cell.addEventListener("click", () => {
        this.sort(h, cell);
      });
    });
    table.querySelectorAll("tbody")?.forEach((tb: Node) => {
      table.removeChild(tb);
    });
    const tbody = table.createTBody();
    this.quakeList.forEach((q) => {
      const row = tbody.insertRow();
      this.populateRow(q, row, -1);
      row.addEventListener("click", (evt) => {
        this.dispatchEvent(createQuakeClickEvent(q, evt));
      });
    });
  }
  headers(): Array<string> {
    return Array.from(this._columnValues.keys());
  }

  populateRow(q: Quake, row: HTMLTableRowElement, index: number) {
    this._rowToQuake.set(row, q);
    this.headers().forEach((h) => {
      const cell = row.insertCell(index);
      if (h === QUAKE_COLUMN.LOCALTIME && this.timeZone) {
        // special case if set timezone
        cell.textContent = q.time.setZone(this.timeZone).toISO();
      } else {
        cell.textContent = this.getQuakeValue(q, h);
      }
      if (index !== -1) {
        index++;
      }
    });
  }

  getQuakeValue(q: Quake, h: string): string {
    let fn = this._columnValues.has(h) ? this._columnValues.get(h) : null;

    if (fn != null) {
      return fn(q);
    } else {
      return `unknown: ${String(h)}`
    }
  }
  sort(h: string, _headerCell: HTMLTableCellElement) {
    const table = this.shadowRoot?.querySelector("table") as HTMLTableElement;
    const tbody = table.querySelector("tbody");
    if (tbody) {
      const rows = Array.from(tbody.querySelectorAll("tr"));
      rows.sort((rowa, rowb) => {
        let out = 0;
        const qa = this._rowToQuake.get(rowa);
        const qb = this._rowToQuake.get(rowb);
        if (qa && qb) {
          if (h === QUAKE_COLUMN.TIME || h === QUAKE_COLUMN.LOCALTIME) {
            out = qa.time.toMillis() - qb.time.toMillis();
          } else if (h === QUAKE_COLUMN.LAT) {
            out = qa.latitude - qb.latitude;
          } else if (h === QUAKE_COLUMN.LON) {
            out = qa.longitude - qb.longitude;
          } else if (h === QUAKE_COLUMN.MAG) {
            out = qa.magnitude.mag - qb.magnitude.mag;
          } else if (h === QUAKE_COLUMN.DEPTH) {
            out = qa.depthKm - qb.depthKm;
          } else {
            // just use string
            const ta = this.getQuakeValue(qa, h);
            const tb = this.getQuakeValue(qb, h);
            if (ta < tb) {
              out = -1;
            } else if (ta > tb) {
              out = 1;
            } else {
              out = 0;
            }
          }
        } else {
          // cant find one of the quakes, oh well
        }
        return out;
      });
      if (this.lastSortCol === h) {
        if (this.lastSortAsc) {
          rows.reverse();
        }
        this.lastSortAsc = !this.lastSortAsc;
      } else {
        this.lastSortAsc = true;
      }
      // this effectively remove and then appends the rows in new order
      rows.forEach((v) => {
        tbody.appendChild(v);
      });
      this.lastSortCol = h;
    } else {
      // no tbody for table sort???
    }
  }
}

customElements.define(QUAKE_INFO_ELEMENT, QuakeTable);

export class ChannelTable extends HTMLElement {
  _columnLabels: Map<CHANNEL_COLUMN, string>;
  _channelList: Array<Channel>;
  _rowToChannel: Map<HTMLTableRowElement, Channel>;
  lastSortAsc = true;
  lastSortCol: CHANNEL_COLUMN | undefined;
  constructor(
    channelList?: Array<Channel>,
    columnLabels?: Map<CHANNEL_COLUMN, string>,
  ) {
    super();
    if (!channelList) {
      channelList = [];
    }
    if (!columnLabels) {
      columnLabels = new Map();
      columnLabels.set(CHANNEL_COLUMN.CODE, "Code");
      columnLabels.set(CHANNEL_COLUMN.START, "Start");
      columnLabels.set(CHANNEL_COLUMN.END, "End");
      columnLabels.set(CHANNEL_COLUMN.LAT, "Lat");
      columnLabels.set(CHANNEL_COLUMN.LON, "Lon");
      columnLabels.set(CHANNEL_COLUMN.AZIMUTH, "Az");
      columnLabels.set(CHANNEL_COLUMN.DIP, "Dip");
      columnLabels.set(CHANNEL_COLUMN.DEPTH, "Depth");
      columnLabels.set(CHANNEL_COLUMN.ELEVATION, "Evel");
      columnLabels.set(CHANNEL_COLUMN.SOURCEID, "SourceId");
    }
    this._channelList = channelList;
    this._columnLabels = columnLabels;
    this._rowToChannel = new Map();

    const shadow = this.attachShadow({ mode: "open" });
    const table = document.createElement("table");
    table.setAttribute("class", "wrapper");
    addStyleToElement(this, TABLE_CSS);

    shadow.appendChild(table);
  }
  get channelList(): Array<Channel> {
    return this._channelList;
  }
  set channelList(ql: Array<Channel>) {
    this._channelList = ql;
    this.draw();
  }
  get columnLabels(): Map<CHANNEL_COLUMN, string> {
    return this._columnLabels;
  }
  set columnLabels(cols: Map<CHANNEL_COLUMN, string>) {
    this._columnLabels = cols;
    this.draw();
  }
  addStyle(css: string, id?: string): HTMLStyleElement {
    return addStyleToElement(this, css, id);
  }
  draw() {
    if (!this.isConnected) {
      return;
    }
    const table = this.shadowRoot?.querySelector("table") as HTMLTableElement;
    table.deleteTHead();
    const theader = table.createTHead().insertRow();
    this.headers().forEach((h) => {
      const cell = theader.appendChild(document.createElement("th"));
      cell.textContent = h;
      cell.addEventListener("click", () => {
        this.sort(h, cell);
      });
    });
    table.querySelectorAll("tbody")?.forEach((tb: Node) => {
      table.removeChild(tb);
    });
    const tbody = table.createTBody();
    this.channelList.forEach((c) => {
      const row = tbody.insertRow();
      this.populateRow(c, row, -1);
      row.addEventListener("click", (evt) => {
        this.dispatchEvent(createChannelClickEvent(c, evt));
      });
    });
  }
  headers(): Array<CHANNEL_COLUMN> {
    return Array.from(this._columnLabels.keys());
  }
  populateRow(q: Channel, row: HTMLTableRowElement, index: number) {
    this._rowToChannel.set(row, q);
    this.headers().forEach((h) => {
      const cell = row.insertCell(index);
      cell.textContent = ChannelTable.getChannelValue(q, h);
      if (index !== -1) {
        index++;
      }
    });
  }
  static getChannelValue(q: Channel, h: CHANNEL_COLUMN): string {
    if (h === CHANNEL_COLUMN.START) {
      return stringify(q.startDate.toISO());
    } else if (h === CHANNEL_COLUMN.END) {
      return q.endDate ? stringify(q.endDate.toISO()) : "";
    } else if (h === CHANNEL_COLUMN.LAT) {
      return latlonFormat.format(q.latitude);
    } else if (h === CHANNEL_COLUMN.LON) {
      return latlonFormat.format(q.longitude);
    } else if (h === CHANNEL_COLUMN.ELEVATION) {
      return depthMeterFormat.format(q.elevation);
    } else if (h === CHANNEL_COLUMN.DEPTH) {
      return depthMeterFormat.format(q.depth);
    } else if (h === CHANNEL_COLUMN.AZIMUTH) {
      return latlonFormat.format(q.azimuth);
    } else if (h === CHANNEL_COLUMN.DIP) {
      return latlonFormat.format(q.dip);
    } else if (h === CHANNEL_COLUMN.SOURCEID) {
      return `${q.sourceId.toString()}`;
    } else if (h === CHANNEL_COLUMN.CODE) {
      return `${q.codes()}`;
    } else if (h === CHANNEL_COLUMN.NETWORK_CODE) {
      return `${q.networkCode}`;
    } else if (h === CHANNEL_COLUMN.STATION_CODE) {
      return `${q.stationCode}`;
    } else if (h === CHANNEL_COLUMN.LOCATION_CODE) {
      return `${q.locationCode}`;
    } else if (h === CHANNEL_COLUMN.CHANNEL_CODE) {
      return `${q.channelCode}`;
    } else {
      return `unknown: ${String(h)}`;
    }
  }
  sort(h: CHANNEL_COLUMN, _headerCell: HTMLTableCellElement) {
    const table = this.shadowRoot?.querySelector("table") as HTMLTableElement;
    const tbody = table.querySelector("tbody");
    if (tbody) {
      const rows = Array.from(tbody.querySelectorAll("tr"));
      rows.sort((rowa, rowb) => {
        let out = 0;
        const qa = this._rowToChannel.get(rowa);
        const qb = this._rowToChannel.get(rowb);
        if (qa && qb) {
          if (h === CHANNEL_COLUMN.START) {
            out = qa.startDate.toMillis() - qb.startDate.toMillis();
          } else if (h === CHANNEL_COLUMN.END) {
            if (qa.endDate && qb.endDate) {
              out = qa.endDate.toMillis() - qb.endDate.toMillis();
            } else if (qb.endDate) {
              return 1;
            } else {
              return -1;
            }
          } else if (h === CHANNEL_COLUMN.LAT) {
            out = qa.latitude - qb.latitude;
          } else if (h === CHANNEL_COLUMN.LON) {
            out = qa.longitude - qb.longitude;
          } else if (h === CHANNEL_COLUMN.AZIMUTH) {
            out = qa.azimuth - qb.azimuth;
          } else if (h === CHANNEL_COLUMN.DIP) {
            out = qa.dip - qb.dip;
          } else if (h === CHANNEL_COLUMN.DEPTH) {
            out = qa.depth - qb.depth;
          } else if (h === CHANNEL_COLUMN.ELEVATION) {
            out = qa.elevation - qb.elevation;
          } else {
            // just use string
            const ta = ChannelTable.getChannelValue(qa, h);
            const tb = ChannelTable.getChannelValue(qb, h);
            if (ta < tb) {
              out = -1;
            } else if (ta > tb) {
              out = 1;
            } else {
              out = 0;
            }
          }
        } else {
          // cant find one of the Channels, oh well
        }
        return out;
      });
      if (this.lastSortCol === h) {
        if (this.lastSortAsc) {
          rows.reverse();
        }
        this.lastSortAsc = !this.lastSortAsc;
      } else {
        this.lastSortAsc = true;
      }
      // this effectively remove and then appends the rows in new order
      rows.forEach((v) => {
        tbody.appendChild(v);
      });
      this.lastSortCol = h;
    } else {
      // no tbody for table sort??
    }
  }
}

export const CHANNEL_INFO_ELEMENT = "sp-channel-table";
customElements.define(CHANNEL_INFO_ELEMENT, ChannelTable);

export class StationTable extends HTMLElement {
  _columnLabels: Map<string, string> = new Map();
  _stationList: Array<Station>;
  _rowToStation: Map<HTMLTableRowElement, Station>;
  lastSortAsc = true;
  lastSortCol: string | undefined;
  _columnValues: Map<string, (sta: Station) => string>;
  constructor(
    stationList?: Array<Station>,
    columnLabels?: Map<string, string>,
    columnValues?: Map<string, (sta: Station) => string>
  ) {
    super();
    if (!stationList) {
      stationList = [];
    }

    if (!columnLabels) {
      columnLabels = StationTable.createDefaultColumnLabels();
    }
    this._columnLabels = columnLabels;

    if (!columnValues) {
      columnValues = new Map<string, (sta: Station) => string>();
      let defColumnValues = StationTable.createDefaultColumnValues();
      for (const key of columnLabels.keys()) {
        if (defColumnValues.has(key)) {
          const fn = defColumnValues.get(key);
          if (fn != null) {
            columnValues.set(key, fn);
          } else {
            throw new Error(`StationTable function for key is missing: ${key}`);
          }
        } else {
          throw new Error(`Unknown StationTable key: ${key}`);
        }
      }
    }
    this._columnValues = columnValues;

    this._stationList = stationList;

    this._rowToStation = new Map();

    const shadow = this.attachShadow({ mode: "open" });
    const table = document.createElement("table");
    table.setAttribute("class", "wrapper");
    addStyleToElement(this, TABLE_CSS);

    shadow.appendChild(table);
  }
  get stationList(): Array<Station> {
    return this._stationList;
  }
  set stationList(ql: Array<Station>) {
    this._stationList = ql;
    this.draw();
  }
  get columnLabels(): Map<string, string> {
    return this._columnLabels;
  }
  set columnLabels(cols: Map<string, string>) {
    this._columnLabels = cols;
    this.draw();
  }
  get columnValues(): Map<string, (sta: Station) => string> {
    return this._columnValues;
  }
  set columnValues(cols: Map<string, (sta: Station) => string>) {
    this._columnValues = cols;
    this.draw();
  }

  addStyle(css: string, id?: string): HTMLStyleElement {
    return addStyleToElement(this, css, id);
  }
  draw() {
    if (!this.isConnected) {
      return;
    }
    const table = this.shadowRoot?.querySelector("table") as HTMLTableElement;
    table.deleteTHead();
    const theader = table.createTHead().insertRow();
    this.headers().forEach((h) => {
      const cell = theader.appendChild(document.createElement("th"));
      cell.textContent = h;
      cell.addEventListener("click", () => {
        this.sort(h, cell);
      });
    });
    table.querySelectorAll("tbody")?.forEach((tb: Node) => {
      table.removeChild(tb);
    });
    const tbody = table.createTBody();
    this.stationList.forEach((s) => {
      const row = tbody.insertRow();
      this.populateRow(s, row, -1);
      row.addEventListener("click", (evt) => {
        this.dispatchEvent(createStationClickEvent(s, evt));
      });
    });
  }
  headers(): Array<string> {
    return Array.from(this._columnValues.keys());
  }
  populateRow(q: Station, row: HTMLTableRowElement, index: number) {
    this._rowToStation.set(row, q);
    this.headers().forEach((h) => {
      const cell = row.insertCell(index);
      cell.textContent = this.getStationValue(q, h);
      if (index !== -1) {
        index++;
      }
    });
  }

  static createDefaultColumnLabels() {
    const columnLabels = new Map<string, string>();
    columnLabels.set(STATION_COLUMN.CODE, "Code");
    columnLabels.set(STATION_COLUMN.START, "Start");
    columnLabels.set(STATION_COLUMN.END, "End");
    columnLabels.set(STATION_COLUMN.LAT, "Lat");
    columnLabels.set(STATION_COLUMN.LON, "Lon");
    columnLabels.set(STATION_COLUMN.ELEVATION, "Evel");
    columnLabels.set(STATION_COLUMN.SOURCEID, "SourceId");
    return columnLabels;
  }
  static createDefaultColumnValues() {
    const columnValues = new Map<string, (sta: Station) => string>();
    columnValues.set(STATION_COLUMN.START, (sta: Station) => stringify(sta.startDate.toISO()));
    columnValues.set(STATION_COLUMN.END, (sta: Station) => sta.endDate ? stringify(sta.endDate.toISO()) : "");
    columnValues.set(STATION_COLUMN.LAT, (sta: Station) => latlonFormat.format(sta.latitude));
    columnValues.set(STATION_COLUMN.LON, (sta: Station) => latlonFormat.format(sta.longitude));
    columnValues.set(STATION_COLUMN.ELEVATION, (sta: Station) => depthMeterFormat.format(sta.elevation));
    columnValues.set(STATION_COLUMN.SOURCEID, (sta: Station) => `${sta.sourceId.toString()}`);
    columnValues.set(STATION_COLUMN.CODE, (sta: Station) => `${sta.codes()}`);
    columnValues.set(STATION_COLUMN.NETWORK_CODE, (sta: Station) => `${sta.networkCode}`);
    columnValues.set(STATION_COLUMN.STATION_CODE, (sta: Station) => `${sta.stationCode}`);
    columnValues.set(STATION_COLUMN.DESCRIPTION, (sta: Station) => `${sta.description}`);
    return columnValues;
  }
  getStationValue(q: Station, h: string): string {
    if (this._columnValues.has(h)) {
      const fn = this._columnValues.get(h);
      if (fn != null) {
        return fn(q);
      }
    }
    if (h === STATION_COLUMN.START) {
      return stringify(q.startDate.toISO());
    } else if (h === STATION_COLUMN.END) {
      return q.endDate ? stringify(q.endDate.toISO()) : "";
    } else if (h === STATION_COLUMN.LAT) {
      return latlonFormat.format(q.latitude);
    } else if (h === STATION_COLUMN.LON) {
      return latlonFormat.format(q.longitude);
    } else if (h === STATION_COLUMN.ELEVATION) {
      return depthMeterFormat.format(q.elevation);
    } else if (h === STATION_COLUMN.SOURCEID) {
      return `${q.sourceId.toString()}`;
    } else if (h === STATION_COLUMN.CODE) {
      return `${q.codes()}`;
    } else if (h === STATION_COLUMN.NETWORK_CODE) {
      return `${q.networkCode}`;
    } else if (h === STATION_COLUMN.STATION_CODE) {
      return `${q.stationCode}`;
    } else if (h === STATION_COLUMN.DESCRIPTION) {
      return `${q.description}`;
    } else {
      return `unknown: ${String(h)}`;
    }
  }
  sort(h: string, _headerCell: HTMLTableCellElement) {
    const table = this.shadowRoot?.querySelector("table") as HTMLTableElement;
    const tbody = table.querySelector("tbody");
    if (tbody) {
      const rows = Array.from(tbody.querySelectorAll("tr"));
      rows.sort((rowa, rowb) => {
        let out = 0;
        const qa = this._rowToStation.get(rowa);
        const qb = this._rowToStation.get(rowb);
        if (qa && qb) {
          if (h === STATION_COLUMN.START) {
            out = qa.startDate.toMillis() - qb.startDate.toMillis();
          } else if (h === STATION_COLUMN.END) {
            if (qa.endDate && qb.endDate) {
              out = qa.endDate.toMillis() - qb.endDate.toMillis();
            } else if (qb.endDate) {
              return 1;
            } else {
              return -1;
            }
          } else if (h === STATION_COLUMN.LAT) {
            out = qa.latitude - qb.latitude;
          } else if (h === STATION_COLUMN.LON) {
            out = qa.longitude - qb.longitude;
          } else if (h === STATION_COLUMN.ELEVATION) {
            out = qa.elevation - qb.elevation;
          } else {
            // just use string
            const ta = this.getStationValue(qa, h);
            const tb = this.getStationValue(qb, h);
            if (ta < tb) {
              out = -1;
            } else if (ta > tb) {
              out = 1;
            } else {
              out = 0;
            }
          }
        } else {
          // cant find one of the Stations, oh well
        }
        return out;
      });
      if (this.lastSortCol === h) {
        if (this.lastSortAsc) {
          rows.reverse();
        }
        this.lastSortAsc = !this.lastSortAsc;
      } else {
        this.lastSortAsc = true;
      }
      // this effectively remove and then appends the rows in new order
      rows.forEach((v) => {
        tbody.appendChild(v);
      });
      this.lastSortCol = h;
    } else {
      // no tbody for table sort???
    }
  }
}

export const STATION_INFO_ELEMENT = "sp-station-table";
customElements.define(STATION_INFO_ELEMENT, StationTable);

export class SeismogramTable extends HTMLElement {
  _columnLabels: Map<SEISMOGRAM_COLUMN, string>;
  _sddList: Array<SeismogramDisplayData>;
  _rowToSDD: Map<HTMLTableRowElement, SeismogramDisplayData>;
  lastSortAsc = true;
  lastSortCol: string | undefined;
  constructor(
    sddList?: Array<SeismogramDisplayData>,
    columnLabels?: Map<SEISMOGRAM_COLUMN, string>,
  ) {
    super();
    if (!sddList) {
      sddList = [];
    }
    if (!columnLabels) {
      columnLabels = new Map();
      columnLabels.set(SEISMOGRAM_COLUMN.CODE, "Code");
      columnLabels.set(SEISMOGRAM_COLUMN.START, "Start");
      columnLabels.set(SEISMOGRAM_COLUMN.END, "End");
      columnLabels.set(SEISMOGRAM_COLUMN.DURATION, "Dur");
      columnLabels.set(SEISMOGRAM_COLUMN.SAMPLE_RATE, "Sample Rate");
      columnLabels.set(SEISMOGRAM_COLUMN.SAMPLE_PERIOD, "Sample Period");
      columnLabels.set(SEISMOGRAM_COLUMN.NUM_POINTS, "Npts");
      columnLabels.set(SEISMOGRAM_COLUMN.SEGMENTS, "Segments");
      columnLabels.set(SEISMOGRAM_COLUMN.SOURCEID, "SourceId");
    }
    this._sddList = sddList;
    this._columnLabels = columnLabels;
    this._rowToSDD = new Map();

    const shadow = this.attachShadow({ mode: "open" });
    const table = document.createElement("table");
    table.setAttribute("class", "wrapper");
    addStyleToElement(this, TABLE_CSS);

    shadow.appendChild(table);
  }
  get seisData(): Array<SeismogramDisplayData> {
    return this._sddList;
  }
  set seisData(ql: Array<SeismogramDisplayData>) {
    this._sddList = ql;
    this.draw();
  }
  get columnLabels(): Map<SEISMOGRAM_COLUMN, string> {
    return this._columnLabels;
  }
  set columnLabels(cols: Map<SEISMOGRAM_COLUMN, string>) {
    this._columnLabels = cols;
    this.draw();
  }
  addStyle(css: string, id?: string): HTMLStyleElement {
    return addStyleToElement(this, css, id);
  }
  draw() {
    if (!this.isConnected) {
      return;
    }
    const table = this.shadowRoot?.querySelector("table") as HTMLTableElement;
    table.deleteTHead();
    const theader = table.createTHead().insertRow();
    this.headers().forEach((h) => {
      const cell = theader.appendChild(document.createElement("th"));
      cell.textContent = h;
      cell.addEventListener("click", () => {
        this.sort(h, cell);
      });
    });
    table.querySelectorAll("tbody")?.forEach((tb: Node) => {
      table.removeChild(tb);
    });
    const tbody = table.createTBody();
    this._sddList.forEach((q) => {
      const row = tbody.insertRow();
      this.populateRow(q, row, -1);
    });
  }
  headers(): Array<SEISMOGRAM_COLUMN> {
    return Array.from(this._columnLabels.keys());
  }
  populateRow(
    q: SeismogramDisplayData,
    row: HTMLTableRowElement,
    index: number,
  ) {
    this._rowToSDD.set(row, q);
    this.headers().forEach((h) => {
      const cell = row.insertCell(index);
      cell.textContent = SeismogramTable.getSeismogramValue(q, h);
      if (index !== -1) {
        index++;
      }
    });
  }
  static getSeismogramValue(
    q: SeismogramDisplayData,
    h: SEISMOGRAM_COLUMN,
  ): string {
    if (h === SEISMOGRAM_COLUMN.START) {
      return stringify(q.start.toISO());
    } else if (h === SEISMOGRAM_COLUMN.END) {
      return stringify(q.end.toISO());
    } else if (h === SEISMOGRAM_COLUMN.DURATION) {
      return stringify(q.timeRange.toDuration().toISO());
    } else if (h === SEISMOGRAM_COLUMN.NUM_POINTS) {
      return `${q.numPoints}`;
    } else if (h === SEISMOGRAM_COLUMN.SAMPLE_RATE) {
      return q._seismogram ? `${q._seismogram.sampleRate}` : "";
    } else if (h === SEISMOGRAM_COLUMN.SAMPLE_PERIOD) {
      return q._seismogram ? `${q._seismogram.samplePeriod}` : "";
    } else if (h === SEISMOGRAM_COLUMN.SEGMENTS) {
      return q._seismogram ? `${q._seismogram.segments.length}` : "";
    } else if (h === SEISMOGRAM_COLUMN.SOURCEID) {
      return `${q.sourceId.toString()}`;
    } else if (h === SEISMOGRAM_COLUMN.CODE) {
      return `${q.codes()}`;
    } else if (h === SEISMOGRAM_COLUMN.NETWORK_CODE) {
      return `${q.networkCode}`;
    } else if (h === SEISMOGRAM_COLUMN.STATION_CODE) {
      return `${q.stationCode}`;
    } else {
      return `unknown: ${String(h)}`;
    }
  }
  sort(h: SEISMOGRAM_COLUMN, _headerCell: HTMLTableCellElement) {
    const table = this.shadowRoot?.querySelector("table") as HTMLTableElement;
    const tbody = table.querySelector("tbody");
    if (tbody) {
      const rows = Array.from(tbody.querySelectorAll("tr"));
      rows.sort((rowa, rowb) => {
        let out = 0;
        const qa = this._rowToSDD.get(rowa);
        const qb = this._rowToSDD.get(rowb);
        if (qa && qb) {
          if (h === SEISMOGRAM_COLUMN.START) {
            out = qa.start.toMillis() - qb.start.toMillis();
          } else if (h === SEISMOGRAM_COLUMN.END) {
            out = qa.end.toMillis() - qb.end.toMillis();
          } else if (h === SEISMOGRAM_COLUMN.DURATION) {
            out =
              qa.timeRange.toDuration().toMillis() -
              qb.timeRange.toDuration().toMillis();
          } else if (h === SEISMOGRAM_COLUMN.NUM_POINTS) {
            out = qa.numPoints - qb.numPoints;
          } else if (h === SEISMOGRAM_COLUMN.SAMPLE_RATE) {
            out =
              (qa._seismogram ? qa._seismogram.sampleRate : 0) -
              (qb._seismogram ? qb._seismogram.sampleRate : 0);
          } else if (h === SEISMOGRAM_COLUMN.SAMPLE_PERIOD) {
            out =
              (qa._seismogram ? qa._seismogram.samplePeriod : 0) -
              (qb._seismogram ? qb._seismogram.samplePeriod : 0);
          } else if (h === SEISMOGRAM_COLUMN.SEGMENTS) {
            out =
              (qa._seismogram ? qa._seismogram.segments.length : 0) -
              (qb._seismogram ? qb._seismogram.segments.length : 0);
          } else {
            // just use string
            const ta = SeismogramTable.getSeismogramValue(qa, h);
            const tb = SeismogramTable.getSeismogramValue(qb, h);
            if (ta < tb) {
              out = -1;
            } else if (ta > tb) {
              out = 1;
            } else {
              out = 0;
            }
          }
        } else {
          // cant find one of the items, oh well
        }
        return out;
      });
      if (this.lastSortCol === h) {
        if (this.lastSortAsc) {
          rows.reverse();
        }
        this.lastSortAsc = !this.lastSortAsc;
      } else {
        this.lastSortAsc = true;
      }
      // this effectively remove and then appends the rows in new order
      rows.forEach((v) => {
        tbody.appendChild(v);
      });
      this.lastSortCol = h;
    } else {
      // no tbody for table sort???
    }
  }
}

export const SDD_INFO_ELEMENT = "sp-seismogram-table";
customElements.define(SDD_INFO_ELEMENT, SeismogramTable);

export const latlonFormat = textformat.latlonFormat;
export const magFormat = textformat.magFormat;
export const depthFormat = textformat.depthFormat;
export const depthNoUnitFormat = textformat.depthNoUnitFormat;
export const depthMeterFormat = textformat.depthMeterFormat;
