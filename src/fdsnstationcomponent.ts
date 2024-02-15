
import {StationQuery} from './fdsnstation';
import {
  CHANNEL_CODE_ELEMENT,
  ChannelCodeInput,
  LatLonChoice,
  LatLonBoxEl,
  LatLonRadiusEl
} from './components';
import { TimeRangeChooser, } from './datechooser';
import {isoToDateTime} from './util';
import { Duration} from 'luxon';

const channelsearchHtml = `
<div class="wrapper">
  <sp-channel-code-input></sp-channel-code-input>
  <div>
    <label>Time Range </label>
    <sp-timerange duration="P1Y" prev-next=true ></sp-timerange>
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
</div>
`;

export class ChannelSearch extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({mode: 'open'});
    this.draw_element(shadow);
  }
  _registerEvent(wrapper: HTMLElement, sel: string) {
    const component = wrapper.querySelector(sel) as HTMLElement;
    if ( ! component) {throw new Error(`can't find ${sel}`);}
    component.addEventListener("change", () => this.dispatchEvent(new Event("change")));
  }
  draw_element(shadow: ShadowRoot) {
    const wrapper = document.createElement('div');
    wrapper.setAttribute('class','wrapper');
    wrapper.innerHTML = channelsearchHtml;
    shadow.appendChild(wrapper);
    this._registerEvent(wrapper, 'sp-timerange');
    this._registerEvent(wrapper, 'sp-latlon-choice');

    const chanCodeEl = shadow.querySelector('sp-channel-code-input') as ChannelCodeInput;
    if (chanCodeEl) { //typescript
      if (this.hasAttribute("network")) {
        const v = this.getAttribute("network");
        if (v) {chanCodeEl.network = v;}
      }
      if (this.hasAttribute("station")) {
        const v = this.getAttribute("station");
        if (v) {chanCodeEl.station = v;}
      }
      if (this.hasAttribute("location")) {
        const v = this.getAttribute("location");
        if (v) {chanCodeEl.location = v;}
      }
      if (this.hasAttribute("channel")) {
        const v = this.getAttribute("channel");
        if (v) {chanCodeEl.channel = v;}
      }
    }
    const trChooser = wrapper.querySelector('sp-timerange') as TimeRangeChooser;
    if ( ! trChooser) {throw new Error("can't find sp-timerange");}
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
        trChooser.duration = Duration.fromISO(""+d);
      }
    }

    const todayBtn = wrapper.querySelector('#today');
    if ( ! todayBtn) {throw new Error("can't find button#today");}
    todayBtn.addEventListener('click', event => {
      trChooser.duration = Duration.fromISO('P1D');
    });

    const weekBtn = wrapper.querySelector('#week');
    if ( ! weekBtn) {throw new Error("can't find button#week");}
    weekBtn.addEventListener('click', event => {
      trChooser.duration = Duration.fromISO('P7D');
    });

    const monthBtn = wrapper.querySelector('#month');
    if ( ! monthBtn) {throw new Error("can't find button#month");}
    monthBtn.addEventListener('click', event => {
      trChooser.duration = Duration.fromISO('P1M');
    });

    const yearBtn = wrapper.querySelector('#year');
    if ( ! yearBtn) {throw new Error("can't find button#year");}
    yearBtn.addEventListener('click', event => {
      trChooser.duration = Duration.fromISO('P1Y');
    });
    const latlonChooser = wrapper.querySelector('sp-latlon-choice') as LatLonChoice;
    if ( ! latlonChooser) {throw new Error("can't find sp-latlon-choice");}
    LatLonChoice.observedAttributes.forEach(attr => {
      if (this.hasAttribute(attr)) {
        // typescript
        const attrVal = this.getAttribute(attr);
        if (attrVal) {latlonChooser.setAttribute(attr, attrVal);}
      }
    });
  }
  populateQuery(query?: StationQuery): StationQuery {
    if ( ! query) {
      query = new StationQuery();
    }
    const wrapper = (this.shadowRoot?.querySelector('div') as HTMLDivElement);
    const codeChooser = wrapper.querySelector(CHANNEL_CODE_ELEMENT) as ChannelCodeInput;
    query.networkCode(codeChooser.network);
    query.stationCode(codeChooser.station);
    query.locationCode(codeChooser.location);
    query.channelCode(codeChooser.channel);

    const trChooser = wrapper.querySelector('sp-timerange') as TimeRangeChooser;
    if ( ! trChooser) {throw new Error("can't find sp-timerange");}
    query.startTime(trChooser.start);
    query.endTime(trChooser.end);
    const latlonchoice = wrapper.querySelector('sp-latlon-choice') as LatLonChoice;
    const choosenLatLon = latlonchoice.choosen();
    if (choosenLatLon instanceof LatLonBoxEl) {
      const latlonbox = choosenLatLon.asLatLonBox();
      if (latlonbox.south > -90) {query.minLat(latlonbox.south);}
      if (latlonbox.north < 90) {query.maxLat(latlonbox.north);}
      if (latlonbox.west > -180 && latlonbox.west+360 !==latlonbox.east) {query.minLon(latlonbox.west);}
      if (latlonbox.east < 360 && latlonbox.west+360 !==latlonbox.east) {query.maxLon(latlonbox.east);}
    } else if (choosenLatLon instanceof LatLonRadiusEl) {
      const latlonrad = choosenLatLon ;
      if (latlonrad.minRadius>0 || latlonrad.maxRadius<180) {
        query.latitude(latlonrad.latitude);
        query.longitude(latlonrad.longitude);
        if (latlonrad.minRadius>0) {query.minRadius(latlonrad.minRadius);}
        if (latlonrad.maxRadius<180) {query.maxRadius(latlonrad.maxRadius);}
      }
    } else {
      // null means all, whole world
    }
    return query;
  }
  getGeoChoiceElement(): LatLonChoice {
    const wrapper = (this.shadowRoot?.querySelector('div') as HTMLDivElement);
    const latlonchoice = wrapper.querySelector('sp-latlon-choice') as LatLonChoice;
    return latlonchoice;
  }
}

export const CHANNEL_SEARCH_ELEMENT = 'sp-channel-search';
customElements.define(CHANNEL_SEARCH_ELEMENT, ChannelSearch);
