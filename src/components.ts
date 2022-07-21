import {Channel} from './stationxml';
import { isDef} from './util';

export const CHANNEL_LIST_ELEMENT = 'sp-channellist';
export const CHANNEL_CODE_ELEMENT = 'sp-channel-code-input';
export const MINMAX_ELEMENT = 'sp-minmax';
export const LATLONRADIUS_ELEMENT = 'sp-latlonradius';

export function labeledTextInput(label: string, defaultVal: string): HTMLElement {
  const ndiv = document.createElement('span');
  const nlabel = ndiv.appendChild(document.createElement('label'));
  nlabel.textContent = label;
  const ntext = ndiv.appendChild(document.createElement('input'));
  ntext.setAttribute('type','text');
  ntext.setAttribute('name',label);
  ntext.setAttribute('class',label);
  ntext.value = defaultVal;
  return ndiv;
}

export function labeledNumberInput(label: string, defaultVal: string): HTMLElement {
  const ndiv = document.createElement('span');
  const nlabel = ndiv.appendChild(document.createElement('label'));
  nlabel.textContent = label;
  const ntext = ndiv.appendChild(document.createElement('input'));
  ntext.setAttribute('type','number');
  ntext.setAttribute('name',label);
  ntext.setAttribute('class',label);
  ntext.value = defaultVal;
  return ndiv;
}


const ATTR_LIST = ["Network", "Station", "Location", "Channel"];

export class ChannelCodeInput extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({mode: 'open'});
    const wrapper = document.createElement('span');
    wrapper.setAttribute('class','wrapper');
    const default_vals = { "Network": "CO", "Station": "CASEE", "Location":"00","Channel":"HHZ"};
    let netIn = wrapper.appendChild(labeledTextInput("Network", default_vals.Network));
    netIn.addEventListener("change", () => this.dispatchEvent(new Event("change")));
    let staIn = wrapper.appendChild(labeledTextInput("Station", default_vals.Station));
    netIn.addEventListener("change", () => this.dispatchEvent(new Event("change")));
    let locIn = wrapper.appendChild(labeledTextInput("Location", default_vals.Location));
    netIn.addEventListener("change", () => this.dispatchEvent(new Event("change")));
    let chanIn = wrapper.appendChild(labeledTextInput("Channel", default_vals.Channel));
    netIn.addEventListener("change", () => this.dispatchEvent(new Event("change")));


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
customElements.define(CHANNEL_CODE_ELEMENT, ChannelCodeInput);


export class ChannelListChooser extends HTMLElement {
  channels: Array<Channel>;
  constructor() {
    super();
    this.channels = [];
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
        this.dispatchEvent(new Event("change"));
      });
      const nlabel = div.appendChild(document.createElement('label'));
      nlabel.textContent = `${c.codes()} ${c.startDate.toISO()}`;
    });
    shadow.appendChild(wrapper);
  }
  setChannels(channels: Array<Channel>) {
    this.channels = channels;
    this.draw_element();
    this.dispatchEvent(new Event("change"))
  }
  appendChannels(channels: Array<Channel>) {
    this.channels = this.channels.concat(channels);
    this.draw_element();
    this.dispatchEvent(new Event("change"))
  }
  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
  }
}

customElements.define(CHANNEL_LIST_ELEMENT, ChannelListChooser);

export class LabeledMinMax extends HTMLElement {
  default_min = 0.0;
  default_max = 10.0;
  constructor() {
    super();
    const shadow = this.attachShadow({mode: 'open'});
    this.draw_element(shadow);
  }
  draw_element(shadow: ShadowRoot) {
    const minAttr = this.getAttribute("min");
    if (!!minAttr) {this.default_min = Number.parseFloat(minAttr);}
    const maxAttr = this.getAttribute("max");
    if (!!maxAttr) {this.default_max = Number.parseFloat(maxAttr);}
    const style = shadow.appendChild(document.createElement('style'));
    style.textContent = `
      input {
        width: 6em;
      }
    `;

    const wrapper = document.createElement('span');
    wrapper.setAttribute('class','wrapper');
    const min_text = wrapper.appendChild(document.createElement('input'));
    min_text.setAttribute('type','number');
    min_text.setAttribute('name','min');
    min_text.setAttribute('class','min');
    min_text.value = `${this.default_min}`;
    min_text.addEventListener("change", () => this.dispatchEvent(new Event("change")));

    const to_label = wrapper.appendChild(document.createElement('label'));
    to_label.textContent = "to";
    const max_text = wrapper.appendChild(document.createElement('input'));
    max_text.setAttribute('type','number');
    max_text.setAttribute('name','max');
    max_text.setAttribute('class','max');
    max_text.value = `${this.default_max}`;
    max_text.addEventListener("change", () => this.dispatchEvent(new Event("change")));

    shadow.appendChild(wrapper);
  }
  get min(): number {
    const input = this.shadowRoot?.querySelector("input.min") as HTMLInputElement;
    if (input) {
      return Number.parseFloat(input.value);
    } else {
      throw new Error('cant find input.min')
    }
  }
  set min(v: number) {
    const input = this.shadowRoot?.querySelector("input.min") as HTMLInputElement;
    if (input) {
      input.value = v.toString();
    } else {
      throw new Error('cant find input.min')
    }
  }
  get max(): number {
    const input = this.shadowRoot?.querySelector("input.max") as HTMLInputElement;
    if (input) {
      return Number.parseFloat(input.value);
    } else {
      throw new Error('cant find input.max')
    }
  }
  set max(v: number) {
    const input = this.shadowRoot?.querySelector("input.max") as HTMLInputElement;
    if (input) {
      input.value = v.toString();
    } else {
      throw new Error('cant find input.max')
    }
  }
  updateMinMax() {
    const min_s = this.getAttribute('min');
    if (isDef(min_s)) {
      const min = Number.parseFloat(min_s);
      if ( ! Number.isNaN(min)) {
       this.default_min = min;
      }
    }

    const max_s = this.getAttribute('max');
    if (isDef(max_s)) {
      const max = Number.parseFloat(max_s);
      if ( ! Number.isNaN(max)) {
       this.default_max = max;
      }
    }
  }
  connectedCallback() {
    this.updateMinMax();
  }
}

customElements.define(MINMAX_ELEMENT, LabeledMinMax);

export class LatLonRadius extends HTMLElement {
  constructor() {
    super();
    this.draw();
  }
  draw() {
    let shadow = this.shadowRoot;
    if (shadow === null) {
      shadow = this.attachShadow({mode: 'open'});
    }
    while (shadow.firstChild) {
      // @ts-ignore
      shadow.removeChild(shadow.lastChild);
    }
    const style = shadow.appendChild(document.createElement('style'));
    style.textContent = `
      input {
        width: 4em;
      }
    `;
    const wrapper = document.createElement('div');
    wrapper.setAttribute('class','wrapper');
    let latIn = wrapper.appendChild(labeledNumberInput("Lat", "0"));
    latIn.addEventListener("change", () => this.dispatchEvent(new Event("change")));
    let lonIn = wrapper.appendChild(labeledNumberInput("Lon", "0"));
    lonIn.addEventListener("change", () => this.dispatchEvent(new Event("change")));
    const radius_label = wrapper.appendChild(document.createElement('label'));
    radius_label.textContent = "Radius";
    const minmax = wrapper.appendChild(new LabeledMinMax());
    minmax.addEventListener("change", () => this.dispatchEvent(new Event("change")));
    shadow.appendChild(wrapper);
    minmax.min = 0;
    minmax.max = 180;
  }
  get latitude() {
    const inEl = this.shadowRoot?.querySelector("input.Lat") as HTMLInputElement;
    return Number.parseFloat(inEl.value);
  }
  set latitude(v: number) {
    const inEl = this.shadowRoot?.querySelector("input.Lat") as HTMLInputElement;
    inEl.value = v;
  }
  get longitude() {
    const inEl = this.shadowRoot?.querySelector("input.Lon") as HTMLInputElement;
    return Number.parseFloat(inEl.value);
  }
  set latitude(v: number) {
    const inEl = this.shadowRoot?.querySelector("input.Lon") as HTMLInputElement;
    inEl.value = v;
  }
  get minRadius() {
    const mm = this.shadowRoot?.querySelector(MINMAX_ELEMENT) as LabeledMinMax;
    if (mm) {
      return mm.min;
    } else {
      throw new Error(`cant find ${MINMAX_ELEMENT}`);
    }
  }
  set minRadius(v: number) {
    const mm = this.shadowRoot?.querySelector(MINMAX_ELEMENT) as LabeledMinMax;
    if (mm) {
      mm.min = v;
      this._doUpdateCallback();
    } else {
      throw new Error(`cant find ${MINMAX_ELEMENT}`);
    }
  }
  get maxRadius() {
    const mm = this.shadowRoot?.querySelector(MINMAX_ELEMENT) as LabeledMinMax;
    if (mm) {
      return mm.max;
    } else {
      throw new Error(`cant find ${MINMAX_ELEMENT}`);
    }
  }
  set maxRadius(v: number) {
    const mm = this.shadowRoot?.querySelector(MINMAX_ELEMENT) as LabeledMinMax;
    if (mm) {
      mm.max = v;
      this._doUpdateCallback();
    } else {
      throw new Error(`cant find ${MINMAX_ELEMENT}`);
    }
  }
  _doUpdateCallback() {
    console.log(`update lat/lon: ${this.latitude}/${this.longitude}  rad: ${this.minRadius} to ${this.maxRadius}`);
    this.dispatchEvent(new Event("change"));
  }
}

customElements.define(LATLONRADIUS_ELEMENT, LatLonRadius);
