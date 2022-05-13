
import {SeisPlotElement} from "./spelement";
import { SeismogramDisplayData } from "./seismogram";
import {SeismographConfig} from "./seismographconfig";

import Handlebars from "handlebars";

export const INFO_ELEMENT = 'station-event-table';

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
        <td>{{formatDuration sdd.seismogram.timeRange.duration}}</td>
        <td>{{formatIsoDate sdd.seismogram.endTime}}</td>
        <td>{{sdd.seismogram.numPoints}}</td>
        <td>{{sdd.seismogram.sampleRate}}</td>
        <td>{{sdd.seismogram.segments.length}}</td>

        {{#if sdd.hasChannel}}
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

        {{#if sdd.hasQuake}}
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
        {{#if sdd.hasQuake }}
          {{#if sdd.hasChannel }}
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
          allowProtoPropertiesByDefault: true, // this might be a security issue???
        },
      );
  }

}

customElements.define(INFO_ELEMENT, QuakeStationTable);
