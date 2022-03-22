import {Channel} from './stationxml';
import {StartEndDuration, isDef} from './util';
import {DateTime, Duration} from 'luxon';

export function labeledTextInput(label: string, wrapper: HTMLElement, defaultVal: string): HTMLElement {
  const ndiv = wrapper.appendChild(document.createElement('div'));
  const nlabel = ndiv.appendChild(document.createElement('label'));
  nlabel.textContent = label;
  const ntext = ndiv.appendChild(document.createElement('input'));
  ntext.setAttribute('type','text');
  ntext.setAttribute('name',label);
  ntext.setAttribute('value',defaultVal);
  return ntext;
}


const ATTR_LIST = ["Network", "Station", "Location", "Channel"];

export class ChannelCodeInput extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({mode: 'open'});
    const wrapper = document.createElement('span');
    wrapper.setAttribute('class','wrapper');
    const default_vals = { "Network": "CO", "Station": "CASEE", "Location":"00","Channel":"HHZ"};
    this._createInput(wrapper, "Network", default_vals.Network);
    this._createInput(wrapper, "Station", default_vals.Station);
    this._createInput(wrapper, "Location", default_vals.Location);
    this._createInput(wrapper, "Channel", default_vals.Channel);


    // Create some CSS to apply to the shadow dom
    const style = document.createElement('style');

    style.textContent = `
      .wrapper {
        position: relative;
      }
      input {
        width: 50px;
      }
    `;
    shadow.appendChild(style);
    shadow.appendChild(wrapper);
  }
  _createInput(wrapper: HTMLElement, name: string, default_val: string) {
      const ndiv = wrapper.appendChild(document.createElement('span'));
      const nlabel = ndiv.appendChild(document.createElement('label'));
      nlabel.textContent = name;
      const ntext = ndiv.appendChild(document.createElement('input'));
      ntext.setAttribute('class',name);
      ntext.setAttribute('type','text');
      ntext.setAttribute('name',name);
      ntext.setAttribute('value',default_val);
  }
  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
  }
  static get observedAttributes() { return ATTR_LIST; }
  get network(): string {
    return this._getInputValue('Network');
  }
  get station(): string {
    return this._getInputValue('Station');
  }
  get location(): string {
    return this._getInputValue('Location');
  }
  get channel(): string {
    return this._getInputValue('Channel');
  }
  _getInputValue(name: string): string {
    return (this.shadowRoot?.querySelector('input.'+name) as HTMLInputElement)?.value ?? "";
  }

}
customElements.define('channel-code-input', ChannelCodeInput);


export class ChannelListChooser extends HTMLElement {
  channels: Array<Channel>;
  callback: (c: Channel) => void;
  constructor() {
    super();
    this.channels = [];
    this.callback = (c: Channel) => {};
    const shadow = this.attachShadow({mode: 'open'});
    this.draw_element();
  }
  draw_element() {
    let shadow = this.shadowRoot;
    if (shadow === null) {
      shadow = this.attachShadow({mode: 'open'});
    }
    const that = this;
    while (shadow.firstChild) {
      // @ts-ignore
      shadow.removeChild(shadow.lastChild);
    }
    const wrapper = document.createElement('div');
    wrapper.setAttribute('class','wrapper');
    const label = wrapper.appendChild(document.createElement('label'));
    label.textContent = "Channels:";
    this.channels.forEach(c => {
      const div = wrapper.appendChild(document.createElement('div'));
      const cb = div.appendChild(document.createElement('input'));
      cb.setAttribute('type','radio');
      cb.setAttribute('name','radiogroup');
      cb.addEventListener('change', event => {
        if (that.callback) {
          that.callback(c);
        }
      });
      const nlabel = div.appendChild(document.createElement('label'));
      nlabel.textContent = `${c.codes()} ${c.startDate.toISO()}`;
    });
    shadow.appendChild(wrapper);
  }
  setChannels(channels: Array<Channel>) {
    this.channels = channels;
    this.draw_element();
  }
  appendChannels(channels: Array<Channel>) {
    this.channels = this.channels.concat(channels);
    this.draw_element();
  }
  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
  }
  setCallback(callback: (c: Channel) => void  ) {
    this.callback = callback;
  }
}

customElements.define('channel-list-chooser', ChannelListChooser);


export class EarthquakeSearch extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({mode: 'open'});
    this.draw_element(shadow);
  }
  draw_element(shadow: ShadowRoot) {
    const wrapper = document.createElement('div');
    wrapper.setAttribute('class','wrapper');
    // time range
    const tr_div = wrapper.appendChild(document.createElement('div'));
    const tr_label = tr_div.appendChild(document.createElement('label'));
    tr_label.textContent = "Time Range";
    const tr_timerange = tr_div.appendChild(document.createElement('time-range-chooser'));

    labeledTextInput("Start Time", wrapper, "now");
    labeledTextInput("End Time", wrapper, "now");

    const mag_div = wrapper.appendChild(document.createElement('div'));
    const mag_label = mag_div.appendChild(document.createElement('label'));
    mag_label.textContent = "Magnitude";
    const mag_range = mag_div.appendChild(document.createElement('min-max'));


    const depth_div = wrapper.appendChild(document.createElement('div'));
    const depth_label = mag_div.appendChild(document.createElement('label'));
    depth_label.textContent = "Depth";
    const depth_range = depth_div.appendChild(document.createElement('min-max'));
    const depth_km_label = mag_div.appendChild(document.createElement('label'));
    depth_km_label.textContent = "km";

    shadow.appendChild(wrapper);
  }
}

customElements.define('earthquake-search', EarthquakeSearch);

export class LabeledMinMax extends HTMLElement {
  default_min = 0.0;
  default_max = 10.0;
  constructor() {
    super();
    const shadow = this.attachShadow({mode: 'open'});
    this.draw_element(shadow);
  }
  draw_element(shadow: ShadowRoot) {
    const wrapper = document.createElement('span');
    wrapper.setAttribute('class','wrapper');
    const ndiv = wrapper.appendChild(document.createElement('div'));
    const min_text = ndiv.appendChild(document.createElement('input'));
    min_text.setAttribute('type','number');
    min_text.setAttribute('name','min');
    min_text.setAttribute('value',`${this.default_min}`);
    const to_label = ndiv.appendChild(document.createElement('label'));
    to_label.textContent = "to";
    const max_text = ndiv.appendChild(document.createElement('input'));
    max_text.setAttribute('type','number');
    max_text.setAttribute('name','max');
    max_text.setAttribute('value',`${this.default_max}`);

    shadow.appendChild(wrapper);
  }
  updateMinMax() {
    let min_s = this.getAttribute('min');
    if (isDef(min_s)) {
      let min = Number.parseFloat(min_s);
      if ( ! Number.isNaN(min)) {
       this.default_min = min;
      }
    }

    let max_s = this.getAttribute('max');
    if (isDef(max_s)) {
      let max = Number.parseFloat(max_s);
      if ( ! Number.isNaN(max)) {
       this.default_max = max;
      }
    }
  }
  connectedCallback() {
    console.log('Custom square element added to page.');
    this.updateMinMax();
  }
}

customElements.define('min-max', LabeledMinMax);
