import {Channel} from './stationxml';
import {LatLonBox, LatLonRadius} from './fdsncommon';
import {FDSNSourceId} from './fdsnsourceid';

export const SOURCEID_LIST_ELEMENT = 'sp-sourceid-list';
export const CHANNEL_LIST_ELEMENT = 'sp-channel-list';
export const CHANNEL_CODE_ELEMENT = 'sp-channel-code-input';
export const MINMAX_ELEMENT = 'sp-minmax';
export const LATLONRADIUS_ELEMENT = 'sp-latlon-radius';
export const LATLONBOX_ELEMENT = 'sp-latlon-box';
export const LATLON_CHOICE_ELEMENT = 'sp-latlon-choice';

export function numberOrNaN(a: string | number | null): number {
  return Number.parseFloat(`${a}`);
}

export function numberFromInput(root: ShadowRoot|Element|null, query: string): number {
  if (! root) {throw new Error(`no root`);}
  const el = root.querySelector(query);
  if (el instanceof HTMLInputElement) {
    return Number.parseFloat(el.value);
  } else {throw new Error("element is not HTMLInputElement");}
}

export function labeledTextInput(label: string, defaultVal: string, classname: string|null=null): HTMLElement {
  const ndiv = document.createElement('span');
  const nlabel = ndiv.appendChild(document.createElement('label'));
  nlabel.textContent = label;
  const ntext = ndiv.appendChild(document.createElement('input'));
  ntext.setAttribute('type','text');
  ntext.setAttribute('name',label);
  ntext.setAttribute('class',classname?classname:label);
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


const ATTR_NET = "network";
const ATTR_STA = "station";
const ATTR_LOC = "location";
const ATTR_CHAN = "channel";
const ATTR_LIST = [ATTR_NET, ATTR_STA, ATTR_LOC, ATTR_CHAN];

export class ChannelCodeInput extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({mode: 'open'});
    const wrapper = document.createElement('span');
    wrapper.setAttribute('class','wrapper');
    const net = this.hasAttribute(ATTR_NET) ? ""+this.getAttribute(ATTR_NET) : "XX";
    const netIn = wrapper.appendChild(labeledTextInput("Network:", net, ATTR_NET));
    netIn.addEventListener("change", () => this.dispatchEvent(new Event("change")));
    const sta = this.hasAttribute(ATTR_STA) ? ""+this.getAttribute(ATTR_STA) : "";
    const staIn = wrapper.appendChild(labeledTextInput("Station:", sta, ATTR_STA));
    staIn.addEventListener("change", () => this.dispatchEvent(new Event("change")));
    const loc = this.hasAttribute(ATTR_LOC) ? ""+this.getAttribute(ATTR_LOC) : "";
    const locIn = wrapper.appendChild(labeledTextInput("Location:", loc, ATTR_LOC));
    locIn.addEventListener("change", () => this.dispatchEvent(new Event("change")));
    const chan = this.hasAttribute(ATTR_CHAN) ? ""+this.getAttribute(ATTR_CHAN) : "";
    const chanIn = wrapper.appendChild(labeledTextInput("Channel:", chan, ATTR_CHAN));
    chanIn.addEventListener("change", () => this.dispatchEvent(new Event("change")));


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
    if (name === ATTR_NET || name === ATTR_STA || name === ATTR_LOC || name === ATTR_CHAN) {
      this._setInputValue(name, newValue);
    }
  }
  static get observedAttributes() { return ATTR_LIST; }
  get network(): string {
    return this._getInputValue(ATTR_NET);
  }
  set network(n: string) {
    this._setInputValue(ATTR_NET, n);
  }
  get station(): string {
    return this._getInputValue(ATTR_STA);
  }
  set station(n: string) {
    this._setInputValue(ATTR_STA, n);
  }
  get location(): string {
    return this._getInputValue(ATTR_LOC);
  }
  set location(n: string) {
    this._setInputValue(ATTR_LOC, n);
  }
  get channel(): string {
    return this._getInputValue(ATTR_CHAN);
  }
  set channel(n: string) {
    this._setInputValue(ATTR_CHAN, n);
  }
  _getInputValue(name: string): string {
    return (this.shadowRoot?.querySelector('input.'+name) as HTMLInputElement)?.value ?? "";
  }
  _setInputValue(name: string, val: string) {
    if (this.shadowRoot) {
      (this.shadowRoot.querySelector('input.'+name) as HTMLInputElement).value = val;
    }
  }

}
customElements.define(CHANNEL_CODE_ELEMENT, ChannelCodeInput);


export class ChannelListChooser extends HTMLElement {
  channels: Array<Channel>;
  selected_channels: Set<Channel> = new Set();
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
    while (shadow.lastChild) {
      shadow.removeChild(shadow.lastChild);
    }
    const wrapper = document.createElement('div');
    wrapper.setAttribute('class','wrapper');
    const label = wrapper.appendChild(document.createElement('label'));
    label.textContent = "Channels:";
    this.channels.forEach(c => {
      const channel = c;
      const div = wrapper.appendChild(document.createElement('div'));
      const cb = div.appendChild(document.createElement('input'));
      cb.setAttribute('type',this.type);
      cb.setAttribute('name','radiogroup');
      cb.addEventListener('change', event => {
        if (this.type === "radio") {
          // radio, only one selected, notify only on select not unselect
          this.selected_channels.clear();
          this.selected_channels.add(channel);
        } else {
          // checkbox
          if (cb.checked) {
            this.selected_channels.add(channel);
          } else {
            this.selected_channels.delete(channel);
          }
        }
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
    this.dispatchEvent(new Event("change"));
  }
  appendChannels(channels: Array<Channel>) {
    this.channels = this.channels.concat(channels);
    this.draw_element();
    this.dispatchEvent(new Event("change"))
  }
  get type(): string {
    const t = this.getAttribute("type");
    if (t) {
      return t;
    } else {
      return "checkbox";
    }
  }
  set type(s: string) {
    if (s === "checkbox" || s === "radio") {
      this.setAttribute("type", s);
    } else {
      throw new Error("must be one of checkbox or radio");
    }
  }
  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    this.draw_element();
  }
  selectedChannels(): Array<Channel> {
    console.log(`selectedChannels(): ${this.selected_channels.size}`);
    return Array.from(this.selected_channels.values());
  }
}

customElements.define(CHANNEL_LIST_ELEMENT, ChannelListChooser);

export class SourceIdListChooser extends HTMLElement {
  sourceIdList: Array<FDSNSourceId>;
  selected_sourceIds: Set<FDSNSourceId> = new Set();
  constructor() {
    super();
    this.sourceIdList = [];
    this.draw_element();
  }
  draw_element() {
    let shadow = this.shadowRoot;
    if (shadow === null) {
      shadow = this.attachShadow({mode: 'open'});
    }
    while (shadow.lastChild) {
      shadow.removeChild(shadow.lastChild);
    }
    const wrapper = document.createElement('div');
    wrapper.setAttribute('class','wrapper');
    const label = wrapper.appendChild(document.createElement('label'));
    label.textContent = "Channels:";
    this.sourceIdList.forEach(c => {
      const sourceId = c;
      const div = wrapper.appendChild(document.createElement('div'));
      const cb = div.appendChild(document.createElement('input'));
      cb.setAttribute('type',this.type);
      cb.setAttribute('name','radiogroup');
      cb.addEventListener('change', event => {
        if (this.type === "radio") {
          // radio, only one selected, notify only on select not unselect
          this.selected_sourceIds.clear();
          this.selected_sourceIds.add(sourceId);
        } else {
          // checkbox
          if (cb.checked) {
            this.selected_sourceIds.add(sourceId);
          } else {
            this.selected_sourceIds.delete(sourceId);
          }
        }
        this.dispatchEvent(new Event("change"));
      });
      const nlabel = div.appendChild(document.createElement('label'));
      nlabel.textContent = `${c.toStringNoPrefix()}`;
    });
    shadow.appendChild(wrapper);
  }
  setSourceIds(sourceIdList: Array<FDSNSourceId>) {
    this.sourceIdList = sourceIdList;
    this.draw_element();
    this.dispatchEvent(new Event("change"));
  }
  appendSourceIds(sourceIdList: Array<FDSNSourceId>) {
    this.sourceIdList = this.sourceIdList.concat(sourceIdList);
    this.draw_element();
    this.dispatchEvent(new Event("change"));
  }
  get type(): string {
    const t = this.getAttribute("type");
    if (t) {
      return t;
    } else {
      return "checkbox";
    }
  }
  set type(s: string) {
    if (s === "checkbox" || s === "radio") {
      this.setAttribute("type", s);
    } else {
      throw new Error("must be one of checkbox or radio");
    }
  }
  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    this.draw_element();
  }
  selectedSourceIds(): Array<FDSNSourceId> {
    console.log(`selectedSourceIds(): ${this.selected_sourceIds.size}`);
    return Array.from(this.selected_sourceIds.values());
  }
}

customElements.define(SOURCEID_LIST_ELEMENT, SourceIdListChooser);

export class LabeledMinMax extends HTMLElement {
  default_min = 0.0;
  default_max = 10.0;
  constructor() {
    super();
    this.attachShadow({mode: 'open'});
    this.draw_element();
  }
  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (name === "lowerbound") {
      const lowerbound = numberOrNaN(newValue);
      this.shadowRoot?.querySelector("input.min")?.setAttribute("min", `${lowerbound}`);
      this.shadowRoot?.querySelector("input.max")?.setAttribute("min", `${lowerbound}`);
    }
    if (name === "upperbound") {
      const upperbound = numberOrNaN(newValue);
      this.shadowRoot?.querySelector("input.min")?.setAttribute("max", `${upperbound}`);
      this.shadowRoot?.querySelector("input.max")?.setAttribute("max", `${upperbound}`);
    }
    if (name === "min" && ! Number.isNaN(numberOrNaN(newValue))) {
      this.min = numberOrNaN(newValue);
    }
    if (name === "max" && ! Number.isNaN(numberOrNaN(newValue))) {
      this.max = numberOrNaN(newValue);
    }
    this.validate();
  }
  static get observedAttributes() { return ["lowerbound", "upperbound", "min", "max"]; }
  draw_element() {
    let shadow = this.shadowRoot;
    if (! shadow) {
      shadow = this.attachShadow({mode: 'open'});
    }
    const minAttr = this.getAttribute("min");
    if (!!minAttr) {this.default_min = Number.parseFloat(minAttr);}
    const maxAttr = this.getAttribute("max");
    if (!!maxAttr) {this.default_max = Number.parseFloat(maxAttr);}

    let lowerbound = Number.NaN;
    let upperbound = Number.NaN;
    const lbAttr = this.getAttribute("lowerbound");
    if (!!lbAttr) {lowerbound = Number.parseFloat(lbAttr);}
    const upAttr = this.getAttribute("upperbound");
    if (!!upAttr) {upperbound = Number.parseFloat(upAttr);}

    const style = shadow.appendChild(document.createElement('style'));
    style.textContent = `
      input {
        width: 6em;
      }
      label {
        margin-left: 3px;
        margin-right: 3px;
      }
    `;

    const wrapper = document.createElement('span');
    wrapper.setAttribute('class','wrapper');
    const min_text = wrapper.appendChild(document.createElement('input'));
    min_text.setAttribute('type','number');
    min_text.setAttribute('name','min');
    min_text.setAttribute('class','min');
    if (lowerbound) {min_text.setAttribute("min", `${lowerbound}`);}
    if (upperbound) {min_text.setAttribute("max", `${upperbound}`);}
    min_text.value = `${this.default_min}`;
    min_text.addEventListener("change", () => {
      this.validate("min");
      this.dispatchEvent(new Event("change"));
    });

    const to_label = wrapper.appendChild(document.createElement('label'));
    to_label.textContent = "to";
    const max_text = wrapper.appendChild(document.createElement('input'));
    max_text.setAttribute('type','number');
    max_text.setAttribute('name','max');
    max_text.setAttribute('class','max');
    if (lowerbound) {max_text.setAttribute("min", `${lowerbound}`);}
    if (upperbound) {max_text.setAttribute("max", `${upperbound}`);}
    max_text.value = `${this.default_max}`;
    max_text.addEventListener("change", () => {
      this.validate("max");
      this.dispatchEvent(new Event("change"));
    });

    shadow.appendChild(wrapper);
    this.validate("min");
  }
  validate(lastChanged?: string) {
    // will be NaN if not an attr
    const lowerbound = numberOrNaN(this.getAttribute("lowerbound"));
    const upperbound = numberOrNaN(this.getAttribute("upperbound"));
    console.log(`validate minmax: ${lowerbound}  ${upperbound}`);
    if (! Number.isNaN(lowerbound)) {
      if (this.min < lowerbound) {
        this.min = lowerbound;
      }
      if (this.max < lowerbound) {
        this.max = lowerbound;
      }
    }
    if (! Number.isNaN(upperbound)) {
      if (this.min > upperbound) {
        this.min = upperbound;
      }
      if (this.max > upperbound) {
        this.max = upperbound;
      }
    }
    if (this.min > this.max) {
      if (lastChanged === "max") {
        this.min = this.max;
      } else {
        this.max = this.min;
      }
    }
  }
  get lowerbound(): number {
      return numberOrNaN(this.getAttribute("lowerbound"));
  }
  set lowerbound(v: number) {
    this.setAttribute("lowerbound", `${v}`);
  }
  get upperbound(): number {
      return numberOrNaN(this.getAttribute("upperbound"));
  }
  set upperbound(v: number) {
    this.setAttribute("upperbound", `${v}`);
  }
  get min(): number {
    const input = this.shadowRoot?.querySelector("input.min") as HTMLInputElement;
    if (input) {
      return Number.parseFloat(input.value);
    } else {
      throw new Error('cant find input.min');
    }
  }
  set min(v: number) {
    const input = this.shadowRoot?.querySelector("input.min") as HTMLInputElement;
    if (input) {
      input.value = v.toString();
    } else {
      throw new Error('cant find input.min');
    }
  }
  get max(): number {
    const input = this.shadowRoot?.querySelector("input.max") as HTMLInputElement;
    if (input) {
      return Number.parseFloat(input.value);
    } else {
      throw new Error('cant find input.max');
    }
  }
  set max(v: number) {
    const input = this.shadowRoot?.querySelector("input.max") as HTMLInputElement;
    if (input) {
      input.value = v.toString();
    } else {
      throw new Error('cant find input.max');
    }
  }
  updateMinMax() {
    const min = numberOrNaN(this.getAttribute('min'));
    if ( ! Number.isNaN(min)) {
     this.default_min = min;
    }

    const max = numberOrNaN(this.getAttribute('max'));
    if ( ! Number.isNaN(max)) {
     this.default_max = max;
    }
  }
  connectedCallback() {
    this.updateMinMax();
  }
}

customElements.define(MINMAX_ELEMENT, LabeledMinMax);

/**
 * ensures input number is -90 <= value <= 90
 *
 * @param  value              input latitude
 * @returns       output latitude in range, zero if NaN
 */
export function validateLatitude(value: number): number {
  if (Number.isNaN(value)) { return 0;}
  if (value < -90.0) { return -90.0;}
  if (value > 90.0) { return 90.0;}
  return value;
}

/**
 * ensures input number is -180 <= value <= 360
 * 
 * @param  value              input longitude
 * @returns       output longitude in range, zero if NaN
 */
export function validateLongitude(value: number): number {
  if (Number.isNaN(value)) { return 0;}
  if (value < -180.0) { return -180.0;}
  if (value > 360.0) { return 360.0;}
  return value;
}

export class LatLonRadiusEl extends HTMLElement {
  constructor() {
    super();
    this.draw();
  }
  draw() {
    let shadow = this.shadowRoot;
    if (shadow === null) {
      shadow = this.attachShadow({mode: 'open'});
    }
    while (shadow.lastChild) {
      shadow.removeChild(shadow.lastChild);
    }
    const style = shadow.appendChild(document.createElement('style'));
    style.textContent = `
      input {
        width: 4em;
      }
      label {
        margin-left: 3px;
        margin-right: 3px;
      }
    `;
    const wrapper = document.createElement('div');
    wrapper.setAttribute('class','wrapper');
    const latDiv = wrapper.appendChild(labeledNumberInput("Lat", "0"));
    const latIn = latDiv.querySelector("input");
    if (!latIn) {throw new Error("can't find input");}
    latIn.textContent = 'Lat: ';
    latIn.setAttribute("min", "-90.0");
    latIn.setAttribute("max", "90.0");
    latIn.addEventListener("change", () => {
      const value = Number.parseFloat(latIn.value);
      if (value !== validateLatitude(value)) {
        latIn.value = `${validateLatitude(value)}`;
      }
      this.dispatchEvent(new Event("change"));
    });
    const lonDiv = wrapper.appendChild(labeledNumberInput("Lon", "0"));
    const lonIn = lonDiv.querySelector("input");
    if (!lonIn) {throw new Error("can't find input");}
    lonIn.textContent = 'Lon: ';
    lonIn.setAttribute("min", "-180.0");
    lonIn.setAttribute("max", "360.0");
    lonIn.addEventListener("change", () => {
      const value = Number.parseFloat(lonIn.value);
      if (value !== validateLongitude(value)) {
        lonIn.value = `${validateLongitude(value)}`;
      }
      this.dispatchEvent(new Event("change"));
    });
    const radius_label = wrapper.appendChild(document.createElement('label'));
    radius_label.textContent = "Radius: ";
    radius_label.setAttribute("for", "radiusminmax");
    const radius_minmax = wrapper.appendChild(new LabeledMinMax());
    radius_label.setAttribute("id", "radiusminmax");
    radius_minmax.setAttribute("lowerbound", "0.0");
    radius_minmax.setAttribute("upperbound", "180.0");
    radius_minmax.min = 0;
    radius_minmax.max = 180;
    radius_minmax.addEventListener("change", () => this.dispatchEvent(new Event("change")));
    shadow.appendChild(wrapper);
  }
  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    this.innerHTML='';
    this.draw();
  }
  static get observedAttributes() { return ["latitude", "longitude", "minradius", "maxradius"]; }
  get latitude() {
    const inEl = this.shadowRoot?.querySelector("input.Lat") as HTMLInputElement;
    return Number.parseFloat(inEl.value);
  }
  set latitude(v: number) {
    const inEl = this.shadowRoot?.querySelector("input.Lat") as HTMLInputElement;
    inEl.value = `${validateLatitude(v)}`;
    this.dispatchEvent(new Event("change"));
  }
  get longitude() {
    const inEl = this.shadowRoot?.querySelector("input.Lon") as HTMLInputElement;
    return Number.parseFloat(inEl.value);
  }
  set longitude(v: number) {
    const inEl = this.shadowRoot?.querySelector("input.Lon") as HTMLInputElement;
    inEl.value = `${validateLongitude(v)}`;
    this.dispatchEvent(new Event("change"));
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
  asLatLonRadius(): LatLonRadius {
    return new LatLonRadius(this.latitude, this.longitude, this.minRadius, this.maxRadius);
  }
  toString(): string {
    return `LatLon Radius: ${this.latitude}/${this.longitude} ${this.minRadius}/${this.maxRadius}`;
  }
  _doUpdateCallback() {
    console.log(`update lat/lon: ${this.latitude}/${this.longitude}  rad: ${this.minRadius} to ${this.maxRadius}`);

    this.dispatchEvent(new Event("change"));
  }
}

customElements.define(LATLONRADIUS_ELEMENT, LatLonRadiusEl);

const latlonbox_html = `
<style>
input {
  width: 4em;
}
label {
  margin-right: 2px;
  margin-left: 2px;
}
fieldset.latlon {
  display: grid;
  width: 250px;
  grid-template-columns:  1fr  1fr  1fr  1fr  1fr ;
}
</style>
<fieldset class="latlon">
  <div></div>
  <div></div>
  <div style="text-align: center;">
  <div><label for="north">North</label></div>
    <div><input id="north" type="number"/></div>
  </div>
  <div></div>
  <div></div>
  <div style="text-align: right;">
    <label for="west">West</label>
  </div>
  <div>
    <input id="west" type="number"/></div>
  <div style="text-align: center;margin-top: 2px;"><label>Lat/Lon</label></div>
  <div style="text-align: left;">
    <input id="east" type="number"/>
  </div>
  <div>
    <label for="east">East</label>
  </div>
  <div></div>
  <div></div>
  <div style="text-align: center;">
    <div><input id="south" type="number"/></div>
    <div><label for="south">South</label></div>
  </div>
  <div></div>
  <div></div>
</fieldset>
`;

export class LatLonBoxEl extends HTMLElement {
  constructor() {
    super();
    this.draw();
  }
  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    this.innerHTML='';
    this.draw();
  }
  static get observedAttributes() { return ["south", "north", "east", "west"]; }
  draw() {
    let shadow = this.shadowRoot;
    if (shadow === null) {
      shadow = this.attachShadow({mode: 'open'});
    }
    shadow.innerHTML = latlonbox_html;
    const southEl = shadow.querySelector('input#south') as HTMLInputElement;
    if (!southEl) {throw new Error("cant find input");}
    const southAttr = numberOrNaN(this.getAttribute("south"));
    southEl.value = `${Number.isNaN(southAttr) ? -90 : validateLatitude(southAttr)}`;
    southEl?.addEventListener("change", () => {
      const value = Number.parseFloat(southEl.value);
      if (value !== validateLatitude(value)) {
        southEl.value = `${validateLatitude(value)}`;
      }
      this.validate("south");
      this.dispatchEvent(new Event("change"));
    });
    const northEl = shadow.querySelector('input#north') as HTMLInputElement;
    if (!northEl) {throw new Error("cant find input");}
    const northAttr = numberOrNaN(this.getAttribute("north"));
    northEl.value = `${Number.isNaN(northAttr) ? 90 : validateLatitude(northAttr)}`;
    northEl?.addEventListener("change", () => {
      const value = Number.parseFloat(northEl.value);
      if (value !== validateLatitude(value)) {
        northEl.value = `${validateLatitude(value)}`;
      }
      this.validate("north");
      this.dispatchEvent(new Event("change"));
    });

    const westEl = shadow.querySelector('input#west') as HTMLInputElement;
    if (!westEl) {throw new Error("cant find input");}
    const westAttr = numberOrNaN(this.getAttribute("west"));
    westEl.value = `${Number.isNaN(westAttr) ? -180 : validateLongitude(westAttr)}`;
    westEl?.addEventListener("change", () => {
      const value = Number.parseFloat(westEl.value);
      if (value !== validateLongitude(value)) {
        westEl.value = `${validateLongitude(value)}`;
      }
      this.validate("west");
      this.dispatchEvent(new Event("change"));
    });
    const eastEl = shadow.querySelector('input#east') as HTMLInputElement;
    if (!eastEl) {throw new Error("cant find input");}
    const eastAttr = numberOrNaN(this.getAttribute("east"));
    eastEl.value = `${Number.isNaN(eastAttr) ? 180 : validateLongitude(eastAttr)}`;
    eastEl?.addEventListener("change", () => {
      const value = Number.parseFloat(eastEl.value);
      if (value !== validateLongitude(value)) {
        eastEl.value = `${validateLongitude(value)}`;
      }
      this.validate("east");
      this.dispatchEvent(new Event("change"));
    });
  }
  get south(): number {
    return numberFromInput(this.shadowRoot, 'input#south');
  }
  set south(value: number) {
    const inputEl = this.shadowRoot?.querySelector('input#south') as HTMLInputElement;
    if (!inputEl) {throw new Error("can't find input");}
    inputEl.value = `${validateLatitude(value)}`;
    this.validate("south");
    this.dispatchEvent(new Event("change"));
  }
  get north(): number {
    return numberFromInput(this.shadowRoot, 'input#north');
  }
  set north(value: number) {
    const inputEl = this.shadowRoot?.querySelector('input#north') as HTMLInputElement;
    if (!inputEl) {throw new Error("can't find input");}
    inputEl.value = `${validateLatitude(value)}`;
    this.validate("north");
    this.dispatchEvent(new Event("change"));
  }
  get west(): number {
    return numberFromInput(this.shadowRoot, 'input#west');
  }
  set west(value: number) {
    const inputEl = this.shadowRoot?.querySelector('input#west') as HTMLInputElement;
    if (!inputEl) {throw new Error("can't find input");}
    inputEl.value = `${validateLongitude(value)}`;
    this.validate("west");
    this.dispatchEvent(new Event("change"));
  }
  get east(): number {
    return numberFromInput(this.shadowRoot, 'input#east');
  }
  set east(value: number) {
    const inputEl = this.shadowRoot?.querySelector('input#east') as HTMLInputElement;
    if (!inputEl) {throw new Error("can't find input");}
    inputEl.value = `${validateLongitude(value)}`;
    this.validate("east");
    this.dispatchEvent(new Event("change"));
  }
  asLatLonBox(): LatLonBox {
    return new LatLonBox(this.west, this.east, this.south, this.north);
  }
  validate(lastChanged: string) {
    if (this.south > this.north) {
      if (lastChanged === "south") {
        this.north = this.south;
      } else {
        this.south = this.north;
      }
    }
    if (this.west > this.east) {
      if (lastChanged === "east") {
        if (this.west > 180 && this.west-360 < this.east) {
          this.west = this.west-360;
        } else {
          this.west = this.east;
        }
      } else {
        if (this.east < 0 && this.east+360 > this.west) {
          this.east = this.east+360;
        } else {
          this.east = this.west;
        }
      }
    }
  }
  toString(): string {
    return `LatLon Box: ${this.west}/${this.east}/${this.south}/${this.north}`;
  }

}

customElements.define(LATLONBOX_ELEMENT, LatLonBoxEl);

const latlonchoice_html = `
<style>
label {
}
.labeled {
}
${LATLONRADIUS_ELEMENT} {
  display:inline-block;
}
${LATLONBOX_ELEMENT} {
  display:inline-block;
}
</style>
<div class="top">
  <div class="labeled">
    <input type="radio" id="latlonall" name="latlon" value="all" checked>
    <label for="latlonradius">All: </label>
  </div>
  <div class="labeled">
    <input type="radio" id="latlonradius" name="latlon" value="radius">
    <label for="latlonradius">Radius: </label>
    <${LATLONRADIUS_ELEMENT}></${LATLONRADIUS_ELEMENT}>
  </div>
  <div class="labeled">
    <input type="radio" id="latlonbox" name="latlon" value="box">
    <label for="latlonbox">Box: </label>
    <${LATLONBOX_ELEMENT}></${LATLONBOX_ELEMENT}>
  </div>
</div>
`;

export class LatLonChoice extends HTMLElement {
  constructor() {
    super();
    this.draw();
  }
  static get observedAttributes() {
    return LatLonBoxEl.observedAttributes
      .concat(LatLonRadiusEl.observedAttributes)
      .concat(["geochoice"]);
  }
  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (name === "north") {
      this.latLonBox.north = parseFloat(newValue);
    } else if (name === "south") {
      this.latLonBox.south = parseFloat(newValue);
    } else if (name === "east") {
      this.latLonBox.east = parseFloat(newValue);
    } else if (name === "west") {
      this.latLonBox.west = parseFloat(newValue);
    } else if (name === "latitude") {
      this.latLonRadius.latitude = parseFloat(newValue);
    } else if (name === "longitude") {
      this.latLonRadius.longitude = parseFloat(newValue);
    } else if (name === "minradius") {
      this.latLonRadius.minRadius = parseFloat(newValue);
    } else if (name === "maxradius") {
      this.latLonRadius.maxRadius = parseFloat(newValue);
    } else if (name === "geochoice") {
      const shadow = this.shadowRoot;
      if (shadow === null) {
        // typescript check should not happen
        throw new Error("shadowRoot is null");
      }
      const all: HTMLInputElement | null = shadow.querySelector('#latlonall');
      const box: HTMLInputElement | null = shadow.querySelector('#latlonbox');
      const radius: HTMLInputElement | null = shadow.querySelector('#latlonradius');
      if (all === null || box === null || radius === null) {
        // typescript check should not happen
        throw new Error("element is null");
      }
      if (newValue === "all") {
        all.checked = true;
        radius.checked = false;
        box.checked = false;
      } else if (newValue === "box") {
        all.checked = false;
        radius.checked = false;
        box.checked = true;
      } else if (newValue === "radius") {
        all.checked = false;
        radius.checked = true;
        box.checked = false;
      }
    } else {
      // unknown attr
    }
  }
  draw() {
    let shadow = this.shadowRoot;
    if (shadow === null) {
      shadow = this.attachShadow({mode: 'open'});
    }
    shadow.innerHTML = latlonchoice_html;
    this.shadowRoot?.querySelectorAll('input[type=radio]').forEach(inEl => {
      inEl?.addEventListener("change", () => {
        this.dispatchEvent(new Event("change"));
      });
    });
    this.shadowRoot?.querySelector('sp-latlon-box')?.addEventListener("change", () => {
      this.dispatchEvent(new Event("change"));
    });
    this.shadowRoot?.querySelector('sp-latlon-radius')?.addEventListener("change", () => {
      this.dispatchEvent(new Event("change"));
    });
  }
  choosen(): null | LatLonBoxEl | LatLonRadiusEl {
    let radio = this.shadowRoot?.querySelector('input[type=radio]:checked') as HTMLInputElement;
    if (radio.value === 'box') {
      return this.shadowRoot?.querySelector('sp-latlon-box') as LatLonBoxEl;
    } else if (radio.value === 'radius') {
      return this.shadowRoot?.querySelector('sp-latlon-radius') as LatLonRadiusEl;
    } else {
      return null; // means all
    }
  }
  get latLonBox(): LatLonBoxEl {
    return this.shadowRoot?.querySelector('sp-latlon-box') as LatLonBoxEl;
  }
  get latLonRadius(): LatLonRadiusEl {
    return this.shadowRoot?.querySelector('sp-latlon-radius') as LatLonRadiusEl;
  }
}
customElements.define(LATLON_CHOICE_ELEMENT, LatLonChoice);
