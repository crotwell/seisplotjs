
import {Quake, createQuakeClickEvent} from './quakeml';
import {Channel, Station, createStationClickEvent, createChannelClickEvent} from './stationxml';
import {SeisPlotElement, addStyleToElement} from "./spelement";
import { SeismogramDisplayData } from "./seismogram";
import {SeismographConfig} from "./seismographconfig";

import {Handlebars} from "./handlebarshelpers";


export const INFO_ELEMENT = 'sp-station-quake-table';
export const QUAKE_INFO_ELEMENT = 'sp-quake-table';

export enum QUAKE_COLUMN {
    LAT = "Lat",
    LON = "Lon",
    TIME = "Time",
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
  constructor(seisData?: Array<SeismogramDisplayData>, seisConfig?: SeismographConfig) {
    super(seisData, seisConfig);
    this._template = DEFAULT_TEMPLATE;

    this.addStyle(TABLE_CSS);

    const wrapper = document.createElement('div');
    wrapper.setAttribute("class", "wrapper");
    this.getShadowRoot().appendChild(wrapper);
  }
  get template(): string {
    return this._template;
  }
  set template(t: string) {
    this._template = t;
    this.draw();
  }
  draw() {
    if ( ! this.isConnected) { return; }
    const mythis = this;
    const wrapper = (this.getShadowRoot().querySelector('div') as HTMLDivElement);
    while (wrapper.firstChild) {
      // @ts-ignore
      wrapper.removeChild(wrapper.lastChild);
    }
    const handlebarsCompiled = Handlebars.compile(this.template);
    wrapper.innerHTML = handlebarsCompiled(
        {
          seisDataList: mythis.seisData,
          seisConfig: mythis.seismographConfig,
        },
        {
          allowProtoPropertiesByDefault: true, // this might be a security issue???
        },
      );
  }

}

customElements.define(INFO_ELEMENT, QuakeStationTable);



export class QuakeTable extends HTMLElement {
  _columnLabels: Map<QUAKE_COLUMN, string>;
  _quakeList: Array<Quake>;
  _rowToQuake: Map<HTMLTableRowElement, Quake>;
  lastSortAsc = true;
  lastSortCol: QUAKE_COLUMN | undefined;
  constructor(quakeList?: Array<Quake>, columnLabels?: Map<QUAKE_COLUMN, string>) {
    super();
    if ( ! quakeList) {
      quakeList = [];
    }
    if ( ! columnLabels) {
      columnLabels = new Map();
      columnLabels.set(QUAKE_COLUMN.TIME, "Time");
      columnLabels.set(QUAKE_COLUMN.LAT, "Lat");
      columnLabels.set(QUAKE_COLUMN.LON,  "Lon");
      columnLabels.set(QUAKE_COLUMN.MAG, "Mag");
      columnLabels.set(QUAKE_COLUMN.MAGTYPE, "Type");
      columnLabels.set(QUAKE_COLUMN.DEPTH, "Depth");
      columnLabels.set(QUAKE_COLUMN.DESC, "Description");
    }
    this._quakeList = quakeList;
    this._columnLabels = columnLabels;
    this._rowToQuake = new Map();

    const shadow = this.attachShadow({mode: 'open'});
    const table = document.createElement('table');
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
  get columnLabels(): Map<QUAKE_COLUMN, string> {
    return this._columnLabels;
  }
  set columnLabels(cols: Map<QUAKE_COLUMN, string>) {
    this._columnLabels = cols;
    this.draw();
  }
  addStyle(css: string, id?: string): HTMLStyleElement {
    return addStyleToElement(this, css, id);
  }
  findRowForQuake(q: Quake): HTMLTableRowElement | null {
    let quakeRow = null;
    this._rowToQuake.forEach( (v,k) => {
      if (v === q) {quakeRow = k;}
    });
    return quakeRow;
  }
  draw() {
    if ( ! this.isConnected) { return; }
    const table = (this.shadowRoot?.querySelector('table') as HTMLTableElement);
    table.deleteTHead();
    const theader = table.createTHead().insertRow();
    this.headers().forEach(h => {
      const cell = theader.appendChild(document.createElement("th"));
      cell.textContent = h;
      cell.addEventListener('click', () => {this.sort(h, cell);});
    });
    table.querySelectorAll("tbody")?.forEach( (tb: Node) => {
      table.removeChild(tb);
    });
    const tbody = table.createTBody();
    this.quakeList.forEach(q => {
      const row = tbody.insertRow();
      this.populateRow(q, row, -1);
      row.addEventListener('click', evt => {
        this.dispatchEvent(createQuakeClickEvent(q, evt));
      });

    });
  }
  headers(): Array<QUAKE_COLUMN> {
    return Array.from(this._columnLabels.keys());
  }
  populateRow(q: Quake, row: HTMLTableRowElement, index: number) {
    this._rowToQuake.set(row, q);
    this.headers().forEach(h => {
      const cell = row.insertCell(index);
      cell.textContent = QuakeTable.getQuakeValue(q, h);
      if (index !== -1) { index++;}
    });
  }
  static getQuakeValue(q: Quake, h: QUAKE_COLUMN): string {
    if (h === QUAKE_COLUMN.TIME) {
      return q.time.toISO();
    } else if (h === QUAKE_COLUMN.LAT) {
      return latlonFormat.format(q.latitude);
    } else if (h === QUAKE_COLUMN.LON) {
      return latlonFormat.format(q.longitude);
    } else if (h === QUAKE_COLUMN.DEPTH) {
      return depthFormat.format(q.depthKm);
    } else if (h === QUAKE_COLUMN.MAG) {
      return magFormat.format(q.magnitude.mag);
    } else if (h === QUAKE_COLUMN.MAGTYPE) {
      return q.magnitude.type;
    } else if (h === QUAKE_COLUMN.DESC) {
      return q.description;
    } else if (h === QUAKE_COLUMN.EVENTID) {
      return `${q.eventId}`;
    } else {
      return `unknown: ${h}`;
    }
  }
  sort(h: QUAKE_COLUMN, headerCell: HTMLTableCellElement) {
    const table = (this.shadowRoot?.querySelector('table') as HTMLTableElement);
    const tbody = table.querySelector("tbody");
    if (tbody) {
      const rows = Array.from(tbody.querySelectorAll("tr") as NodeListOf<HTMLTableRowElement>);
      rows.sort((rowa,rowb) => {
        let out = 0;
        const qa = this._rowToQuake.get(rowa);
        const qb = this._rowToQuake.get(rowb);
        if (qa && qb) {
          if (h === QUAKE_COLUMN.TIME) {
            out = qa.time.toMillis()-qb.time.toMillis();
          } else if (h === QUAKE_COLUMN.LAT) {
            out =  qa.latitude - qb.latitude;
          } else if (h === QUAKE_COLUMN.LON) {
            out =  qa.longitude - qb.longitude;
          } else if (h === QUAKE_COLUMN.MAG) {
            out =  qa.magnitude.mag - qb.magnitude.mag;
          } else if (h === QUAKE_COLUMN.DEPTH) {
            out =  qa.depthKm - qb.depthKm;
          } else {
            // just use string
            const ta = QuakeTable.getQuakeValue(qa, h);
            const tb = QuakeTable.getQuakeValue(qb, h);
            if (ta < tb) {
              out =  -1;
            } else if (ta > tb) {
              out =  1;
            } else {
              out =  0;
            }
          }
        } else {
          // cant find one of the quakes, oh well
          console.log(`can't find qa or qb: ${qa} ${qb}`);
        }
        return out;
      });
      if (this.lastSortCol === h) {
        if (this.lastSortAsc) {
          rows.reverse();
        }
        this.lastSortAsc = ! this.lastSortAsc;
      } else {
        this.lastSortAsc = true;
      }
      // this effectively remove and then appends the rows in new order
      rows.forEach( v => {
        tbody.appendChild(v);
      });
      this.lastSortCol = h;
    } else {
      console.log("no tbody for table sort");
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
  constructor(channelList?: Array<Channel>, columnLabels?: Map<CHANNEL_COLUMN, string>) {
    super();
    if ( ! channelList) {
      channelList = [];
    }
    if ( ! columnLabels) {
      columnLabels = new Map();
      columnLabels.set(CHANNEL_COLUMN.CODE, "Code");
      columnLabels.set(CHANNEL_COLUMN.START, "Start");
      columnLabels.set(CHANNEL_COLUMN.END, "End");
      columnLabels.set(CHANNEL_COLUMN.LAT, "Lat");
      columnLabels.set(CHANNEL_COLUMN.LON,  "Lon");
      columnLabels.set(CHANNEL_COLUMN.AZIMUTH, "Az");
      columnLabels.set(CHANNEL_COLUMN.DIP, "Dip");
      columnLabels.set(CHANNEL_COLUMN.DEPTH, "Depth");
      columnLabels.set(CHANNEL_COLUMN.ELEVATION, "Evel");
      columnLabels.set(CHANNEL_COLUMN.SOURCEID, "SourceId");
    }
    this._channelList = channelList;
    this._columnLabels = columnLabels;
    this._rowToChannel = new Map();

    const shadow = this.attachShadow({mode: 'open'});
    const table = document.createElement('table');
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
    if ( ! this.isConnected) { return; }
    const table = (this.shadowRoot?.querySelector('table') as HTMLTableElement);
    table.deleteTHead();
    const theader = table.createTHead().insertRow();
    this.headers().forEach(h => {
      const cell = theader.appendChild(document.createElement("th"));
      cell.textContent = h;
      cell.addEventListener('click', () => {this.sort(h, cell);});
    });
    table.querySelectorAll("tbody")?.forEach( (tb: Node) => {
      table.removeChild(tb);
    });
    const tbody = table.createTBody();
    this.channelList.forEach(c => {
      const row = tbody.insertRow();
      this.populateRow(c, row, -1);
      row.addEventListener('click', evt => {
        this.dispatchEvent(createChannelClickEvent(c, evt));
      });
    });
  }
  headers(): Array<CHANNEL_COLUMN> {
    return Array.from(this._columnLabels.keys());
  }
  populateRow(q: Channel, row: HTMLTableRowElement, index: number) {
    this._rowToChannel.set(row, q);
    this.headers().forEach(h => {
      const cell = row.insertCell(index);
      cell.textContent = ChannelTable.getChannelValue(q, h);
      if (index !== -1) { index++;}
    });
  }
  static getChannelValue(q: Channel, h: CHANNEL_COLUMN): string {
    if (h === CHANNEL_COLUMN.START) {
      return q.startDate.toISO();
    } else if (h === CHANNEL_COLUMN.END) {
      return q.endDate ? q.endDate.toISO() : "";
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
      return `${q.sourceId}`;
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
      return `unknown: ${h}`;
    }
  }
  sort(h: CHANNEL_COLUMN, headerCell: HTMLTableCellElement) {
    const table = (this.shadowRoot?.querySelector('table') as HTMLTableElement);
    const tbody = table.querySelector("tbody");
    if (tbody) {
      const rows = Array.from(tbody.querySelectorAll("tr") as NodeListOf<HTMLTableRowElement>);
      rows.sort((rowa,rowb) => {
        let out = 0;
        const qa = this._rowToChannel.get(rowa);
        const qb = this._rowToChannel.get(rowb);
        if (qa && qb) {
          if (h === CHANNEL_COLUMN.START) {
            out = qa.startDate.toMillis()-qb.startDate.toMillis();
          } else if (h === CHANNEL_COLUMN.END) {
            if (qa.endDate && qb.endDate ) {
              out = qa.endDate.toMillis()-qb.endDate.toMillis();
            } else if (qb.endDate) {
              return 1;
            } else {
              return -1;
            }
          } else if (h === CHANNEL_COLUMN.LAT) {
            out =  qa.latitude - qb.latitude;
          } else if (h === CHANNEL_COLUMN.LON) {
            out =  qa.longitude - qb.longitude;
          } else if (h === CHANNEL_COLUMN.AZIMUTH) {
            out =  qa.azimuth - qb.azimuth;
          } else if (h === CHANNEL_COLUMN.DIP) {
            out =  qa.dip - qb.dip;
          } else if (h === CHANNEL_COLUMN.DEPTH) {
            out =  qa.depth - qb.depth;
          } else if (h === CHANNEL_COLUMN.ELEVATION) {
            out =  qa.elevation - qb.elevation;
          } else {
            // just use string
            const ta = ChannelTable.getChannelValue(qa, h);
            const tb = ChannelTable.getChannelValue(qb, h);
            if (ta < tb) {
              out =  -1;
            } else if (ta > tb) {
              out =  1;
            } else {
              out =  0;
            }
          }
        } else {
          // cant find one of the Channels, oh well
          console.log(`can't find qa or qb: ${qa} ${qb}`);
        }
        return out;
      });
      if (this.lastSortCol === h) {
        if (this.lastSortAsc) {
          rows.reverse();
        }
        this.lastSortAsc = ! this.lastSortAsc;
      } else {
        this.lastSortAsc = true;
      }
      // this effectively remove and then appends the rows in new order
      rows.forEach( v => {
        tbody.appendChild(v);
      });
      this.lastSortCol = h;
    } else {
      console.log("no tbody for table sort");
    }
  }
}

export const CHANNEL_INFO_ELEMENT = 'sp-channel-table';
customElements.define(CHANNEL_INFO_ELEMENT, ChannelTable);


export class StationTable extends HTMLElement {
  _columnLabels: Map<STATION_COLUMN, string>;
  _stationList: Array<Station>;
  _rowToStation: Map<HTMLTableRowElement, Station>;
  lastSortAsc = true;
  lastSortCol: STATION_COLUMN | undefined;
  constructor(stationList?: Array<Station>, columnLabels?: Map<STATION_COLUMN, string>) {
    super();
    if ( ! stationList) {
      stationList = [];
    }
    if ( ! columnLabels) {
      columnLabels = new Map();
      columnLabels.set(STATION_COLUMN.CODE, "Code");
      columnLabels.set(STATION_COLUMN.START, "Start");
      columnLabels.set(STATION_COLUMN.END, "End");
      columnLabels.set(STATION_COLUMN.LAT, "Lat");
      columnLabels.set(STATION_COLUMN.LON,  "Lon");
      columnLabels.set(STATION_COLUMN.ELEVATION, "Evel");
      columnLabels.set(STATION_COLUMN.SOURCEID, "SourceId");
    }
    this._stationList = stationList;
    this._columnLabels = columnLabels;
    this._rowToStation = new Map();

    const shadow = this.attachShadow({mode: 'open'});
    const table = document.createElement('table');
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
  get columnLabels(): Map<STATION_COLUMN, string> {
    return this._columnLabels;
  }
  set columnLabels(cols: Map<STATION_COLUMN, string>) {
    this._columnLabels = cols;
    this.draw();
  }
  addStyle(css: string, id?: string): HTMLStyleElement {
    return addStyleToElement(this, css, id);
  }
  draw() {
    if ( ! this.isConnected) { return; }
    const table = (this.shadowRoot?.querySelector('table') as HTMLTableElement);
    table.deleteTHead();
    const theader = table.createTHead().insertRow();
    this.headers().forEach(h => {
      const cell = theader.appendChild(document.createElement("th"));
      cell.textContent = h;
      cell.addEventListener('click', () => {this.sort(h, cell);});
    });
    table.querySelectorAll("tbody")?.forEach( (tb: Node) => {
      table.removeChild(tb);
    });
    const tbody = table.createTBody();
    this.stationList.forEach(s => {
      const row = tbody.insertRow();
      this.populateRow(s, row, -1);
      row.addEventListener('click', evt => {
        this.dispatchEvent(createStationClickEvent(s, evt));
      });
    });
  }
  headers(): Array<STATION_COLUMN> {
    return Array.from(this._columnLabels.keys());
  }
  populateRow(q: Station, row: HTMLTableRowElement, index: number) {
    this._rowToStation.set(row, q);
    this.headers().forEach(h => {
      const cell = row.insertCell(index);
      cell.textContent = StationTable.getStationValue(q, h);
      if (index !== -1) { index++;}
    });
  }
  static getStationValue(q: Station, h: STATION_COLUMN): string {
    if (h === STATION_COLUMN.START) {
      return q.startDate.toISO();
    } else if (h === STATION_COLUMN.END) {
      return q.endDate ? q.endDate.toISO() : "";
    } else if (h === STATION_COLUMN.LAT) {
      return latlonFormat.format(q.latitude);
    } else if (h === STATION_COLUMN.LON) {
      return latlonFormat.format(q.longitude);
    } else if (h === STATION_COLUMN.ELEVATION) {
      return depthMeterFormat.format(q.elevation);
    } else if (h === STATION_COLUMN.SOURCEID) {
      return `${q.sourceId}`;
    } else if (h === STATION_COLUMN.CODE) {
      return `${q.codes()}`;
    } else if (h === STATION_COLUMN.NETWORK_CODE) {
      return `${q.networkCode}`;
    } else if (h === STATION_COLUMN.STATION_CODE) {
      return `${q.stationCode}`;
    } else {
      return `unknown: ${h}`;
    }
  }
  sort(h: STATION_COLUMN, headerCell: HTMLTableCellElement) {
    const table = (this.shadowRoot?.querySelector('table') as HTMLTableElement);
    const tbody = table.querySelector("tbody");
    if (tbody) {
      const rows = Array.from(tbody.querySelectorAll("tr") as NodeListOf<HTMLTableRowElement>);
      rows.sort((rowa,rowb) => {
        let out = 0;
        const qa = this._rowToStation.get(rowa);
        const qb = this._rowToStation.get(rowb);
        if (qa && qb) {
          if (h === STATION_COLUMN.START) {
            out = qa.startDate.toMillis()-qb.startDate.toMillis();
          } else if (h === STATION_COLUMN.END) {
            if (qa.endDate && qb.endDate ) {
              out = qa.endDate.toMillis()-qb.endDate.toMillis();
            } else if (qb.endDate) {
              return 1;
            } else {
              return -1;
            }
          } else if (h === STATION_COLUMN.LAT) {
            out =  qa.latitude - qb.latitude;
          } else if (h === STATION_COLUMN.LON) {
            out =  qa.longitude - qb.longitude;
          } else if (h === STATION_COLUMN.ELEVATION) {
            out =  qa.elevation - qb.elevation;
          } else {
            // just use string
            const ta = StationTable.getStationValue(qa, h);
            const tb = StationTable.getStationValue(qb, h);
            if (ta < tb) {
              out =  -1;
            } else if (ta > tb) {
              out =  1;
            } else {
              out =  0;
            }
          }
        } else {
          // cant find one of the Stations, oh well
          console.log(`can't find qa or qb: ${qa} ${qb}`);
        }
        return out;
      });
      if (this.lastSortCol === h) {
        if (this.lastSortAsc) {
          rows.reverse();
        }
        this.lastSortAsc = ! this.lastSortAsc;
      } else {
        this.lastSortAsc = true;
      }
      // this effectively remove and then appends the rows in new order
      rows.forEach( v => {
        tbody.appendChild(v);
      });
      this.lastSortCol = h;
    } else {
      console.log("no tbody for table sort");
    }
  }
}

export const STATION_INFO_ELEMENT = 'sp-station-table';
customElements.define(STATION_INFO_ELEMENT, StationTable);





export class SeismogramTable extends HTMLElement {
  _columnLabels: Map<SEISMOGRAM_COLUMN, string>;
  _sddList: Array<SeismogramDisplayData>;
  _rowToSDD: Map<HTMLTableRowElement, SeismogramDisplayData>;
  lastSortAsc = true;
  lastSortCol: SEISMOGRAM_COLUMN | undefined;
  constructor(sddList?: Array<SeismogramDisplayData>, columnLabels?: Map<SEISMOGRAM_COLUMN, string>) {
    super();
    if ( ! sddList) {
      sddList = [];
    }
    if ( ! columnLabels) {
      columnLabels = new Map();
      columnLabels.set(SEISMOGRAM_COLUMN.CODE, "Code");
      columnLabels.set(SEISMOGRAM_COLUMN.START, "Start");
      columnLabels.set(SEISMOGRAM_COLUMN.END, "End");
      columnLabels.set(SEISMOGRAM_COLUMN.DURATION, "Dur");
      columnLabels.set(SEISMOGRAM_COLUMN.SAMPLE_RATE, "Sample Rate");
      columnLabels.set(SEISMOGRAM_COLUMN.SAMPLE_PERIOD, "Sample Period");
      columnLabels.set(SEISMOGRAM_COLUMN.NUM_POINTS,  "Npts");
      columnLabels.set(SEISMOGRAM_COLUMN.SEGMENTS, "Segments");
      columnLabels.set(SEISMOGRAM_COLUMN.SOURCEID, "SourceId");
    }
    this._sddList = sddList;
    this._columnLabels = columnLabels;
    this._rowToSDD = new Map();

    const shadow = this.attachShadow({mode: 'open'});
    const table = document.createElement('table');
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
    if ( ! this.isConnected) { return; }
    const table = (this.shadowRoot?.querySelector('table') as HTMLTableElement);
    table.deleteTHead();
    const theader = table.createTHead().insertRow();
    this.headers().forEach(h => {
      const cell = theader.appendChild(document.createElement("th"));
      cell.textContent = h;
      cell.addEventListener('click', () => {this.sort(h, cell);});
    });
    table.querySelectorAll("tbody")?.forEach( (tb: Node) => {
      table.removeChild(tb);
    });
    const tbody = table.createTBody();
    this._sddList.forEach(q => {
      const row = tbody.insertRow();
      this.populateRow(q, row, -1);
    });
  }
  headers(): Array<SEISMOGRAM_COLUMN> {
    return Array.from(this._columnLabels.keys());
  }
  populateRow(q: SeismogramDisplayData, row: HTMLTableRowElement, index: number) {
    this._rowToSDD.set(row, q);
    this.headers().forEach(h => {
      const cell = row.insertCell(index);
      cell.textContent = SeismogramTable.getSeismogramValue(q, h);
      if (index !== -1) { index++;}
    });
  }
  static getSeismogramValue(q: SeismogramDisplayData, h: SEISMOGRAM_COLUMN): string {
    if (h === SEISMOGRAM_COLUMN.START) {
      return q.start.toISO();
    } else if (h === SEISMOGRAM_COLUMN.END) {
      return q.end.toISO();
    } else if (h === SEISMOGRAM_COLUMN.DURATION) {
      return q.timeRange.toDuration().toISO();
    } else if (h === SEISMOGRAM_COLUMN.NUM_POINTS) {
      return `${q.numPoints}`;
    } else if (h === SEISMOGRAM_COLUMN.SAMPLE_RATE) {
      return q._seismogram ? `${q._seismogram.sampleRate}` : "";
    } else if (h === SEISMOGRAM_COLUMN.SAMPLE_PERIOD) {
      return q._seismogram ? `${q._seismogram.samplePeriod}` : "";
    } else if (h === SEISMOGRAM_COLUMN.SEGMENTS) {
      return q._seismogram ? `${q._seismogram.segments.length}` : "";
    } else if (h === SEISMOGRAM_COLUMN.SOURCEID) {
      return `${q.sourceId}`;
    } else if (h === SEISMOGRAM_COLUMN.CODE) {
      return `${q.codes()}`;
    } else if (h === SEISMOGRAM_COLUMN.NETWORK_CODE) {
      return `${q.networkCode}`;
    } else if (h === SEISMOGRAM_COLUMN.STATION_CODE) {
      return `${q.stationCode}`;
    } else {
      return `unknown: ${h}`;
    }
  }
  sort(h: SEISMOGRAM_COLUMN, headerCell: HTMLTableCellElement) {
    const table = (this.shadowRoot?.querySelector('table') as HTMLTableElement);
    const tbody = table.querySelector("tbody");
    if (tbody) {
      const rows = Array.from(tbody.querySelectorAll("tr") as NodeListOf<HTMLTableRowElement>);
      rows.sort((rowa,rowb) => {
        let out = 0;
        const qa = this._rowToSDD.get(rowa);
        const qb = this._rowToSDD.get(rowb);
        if (qa && qb) {
          if (h === SEISMOGRAM_COLUMN.START) {
            out = qa.start.toMillis()-qb.start.toMillis();
          } else if (h === SEISMOGRAM_COLUMN.END) {
            out = qa.end.toMillis()-qb.end.toMillis();
          } else if (h === SEISMOGRAM_COLUMN.DURATION) {
            out =  (qa.timeRange.toDuration().toMillis() - qb.timeRange.toDuration().toMillis());
          } else if (h === SEISMOGRAM_COLUMN.NUM_POINTS) {
            out =  qa.numPoints - qb.numPoints;
          } else if (h === SEISMOGRAM_COLUMN.SAMPLE_RATE) {
            out =  (qa._seismogram ? qa._seismogram.sampleRate : 0)
              - (qb._seismogram ? qb._seismogram.sampleRate : 0) ;
          } else if (h === SEISMOGRAM_COLUMN.SAMPLE_PERIOD) {
            out =  (qa._seismogram ? qa._seismogram.samplePeriod : 0)
              - (qb._seismogram ? qb._seismogram.samplePeriod : 0) ;
          } else if (h === SEISMOGRAM_COLUMN.SEGMENTS) {
            out = (qa._seismogram ? qa._seismogram.segments.length : 0)
              - (qb._seismogram ? qb._seismogram.segments.length : 0);
          } else {
            // just use string
            const ta = SeismogramTable.getSeismogramValue(qa, h);
            const tb = SeismogramTable.getSeismogramValue(qb, h);
            if (ta < tb) {
              out =  -1;
            } else if (ta > tb) {
              out =  1;
            } else {
              out =  0;
            }
          }
        } else {
          // cant find one of the items, oh well
          console.log(`can't find qa or qb: ${qa} ${qb}`);
        }
        return out;
      });
      if (this.lastSortCol === h) {
        if (this.lastSortAsc) {
          rows.reverse();
        }
        this.lastSortAsc = ! this.lastSortAsc;
      } else {
        this.lastSortAsc = true;
      }
      // this effectively remove and then appends the rows in new order
      rows.forEach( v => {
        tbody.appendChild(v);
      });
      this.lastSortCol = h;
    } else {
      console.log("no tbody for table sort");
    }
  }
}

export const SDD_INFO_ELEMENT = 'sp-seismogram-table';
customElements.define(SDD_INFO_ELEMENT, SeismogramTable);





export const latlonFormat = new Intl.NumberFormat(navigator.languages[0], {
  style: "unit",
  unit: "degree",
  unitDisplay: "narrow",
  maximumFractionDigits: 2,
});

export const magFormat = new Intl.NumberFormat(navigator.languages[0], {
  style: "decimal",
  maximumFractionDigits: 2,
});

export const depthFormat = new Intl.NumberFormat(navigator.languages[0], {
  style: "unit",
  unit: "kilometer",
  unitDisplay: "narrow",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});
export const depthMeterFormat = new Intl.NumberFormat(navigator.languages[0], {
  style: "unit",
  unit: "meter",
  unitDisplay: "narrow",
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});
