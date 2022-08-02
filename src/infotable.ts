
import {Quake} from './quakeml';
import {SeisPlotElement} from "./spelement";
import { SeismogramDisplayData } from "./seismogram";
import {SeismographConfig} from "./seismographconfig";

import {Handlebars} from "./handlebarshelpers";


export const INFO_ELEMENT = 'sp-station-event-table';
export const QUAKE_INFO_ELEMENT = 'sp-event-table';

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

    const shadow = this.attachShadow({mode: 'open'});
    const wrapper = document.createElement('div');
    wrapper.setAttribute("class", "wrapper");
    const style = shadow.appendChild(document.createElement('style'));
    style.textContent = TABLE_CSS;

    shadow.appendChild(wrapper);
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
    const wrapper = (this.shadowRoot?.querySelector('div') as HTMLDivElement);
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
//          allowProtoPropertiesByDefault: true, // this might be a security issue???
        },
      );
  }

}

customElements.define(INFO_ELEMENT, QuakeStationTable);



export const DEFAULT_QUAKE_TEMPLATE = `
  <table>
  <thead>
      <tr>

        <th>Time</th>
        <th>Lat</th>
        <th>Lon</th>
        <th colspan="2">Mag</th>
        <th>Depth</th>

      </tr>
    </thead>
    <tbody>
    {{#each quakeList as |quake|}}
      <tr>
          <td>{{formatIsoDate quake.time}}</td>
          <td>{{quake.latitude}}</td>
          <td>{{quake.longitude}}</td>
          <td>{{quake.magnitude.mag}}</td>
          <td>{{quake.magnitude.type}}</td>
          <td>{{quake.depthKm}}</td>
      </tr>
    {{/each}}
    </tbody>
  </table>
`;

export class QuakeTable extends HTMLElement {
  _columnLabels: Map<QUAKE_COLUMN, string>;
  _quakeList: Array<Quake>;
  _rowToQuake: Map<HTMLTableRowElement, Quake>;
  lastSortAsc: boolean = true;
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
    const style = shadow.appendChild(document.createElement('style'));
    style.textContent = TABLE_CSS;

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
    });
  }
  headers(): Array<QUAKE_COLUMN> {
    return Array.from(this._columnLabels.keys());
  }
  populateRow(q: Quake, row: HTMLTableRowElement, index: number) {
    this._rowToQuake.set(row, q);
    this.headers().forEach(h => {
      const cell = row.insertCell(index);
      cell.textContent = this.getQuakeValue(q, h);
      if (index !== -1) { index++;}
    });
  }
  getQuakeValue(q: Quake, h: QUAKE_COLUMN): string {
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
            const ta = this.getQuakeValue(qa, h);
            const tb = this.getQuakeValue(qb, h);
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
          console.log(`can't find qa or qb: ${qa} ${qb}`)
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
      console.log("no tbody for table sort")
    }
  }
}

customElements.define(QUAKE_INFO_ELEMENT, QuakeTable);

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
