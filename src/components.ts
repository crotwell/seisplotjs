import {TimeRangeChooser} from './datechooser';
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

export class TimeRange extends HTMLElement {
  timeRange: TimeRangeChooser;
  constructor() {
    super();

    const shadow = this.attachShadow({mode: 'open'});
    const wrapper = document.createElement('div');
    this.timeRange = new TimeRangeChooser(wrapper, (timerange: StartEndDuration) => {
      console.log(`in TimeRange callback`);
    });
    shadow.appendChild(wrapper);
  }
}
customElements.define('time-range-chooser', TimeRange);

export const hourMinRegEx = /^([0-1]?[0-9]):([0-5]?[0-9])$/;
export const HOUR_MIN_24 = "HH:mm";
export class HourMinChooser extends HTMLElement {
  _time: DateTime;
  updateCallback: (time: DateTime) => void;
  popupDiv: HTMLDivElement;
  constructor() {
    super();
    const mythis = this;
    this._time = DateTime.utc().set({second: 0, millisecond: 0});
    this.updateCallback = function(time: DateTime) {};
    const shadow = this.attachShadow({mode: 'open'});

    // style
    let style = document.createElement('style');

    style.textContent = `
      .hourminpopup {
        position: absolute;
        box-shadow: 0 5px 15px -5px rgba(0,0,0,.5);
        background-color: white;
      }
      .hidden {
        visibility: hidden;
      }
      .shown {
        visibility: visible;
      }
      hourminpopup div {
        position: relative;
      }
    `;
    shadow.appendChild(style);

    const wrapper = document.createElement('span');


    const popupDiv = document.createElement('div');
    this.popupDiv = popupDiv;
    popupDiv.setAttribute("class", "hourminpopup hidden");
    const hourDiv = popupDiv.appendChild(document.createElement('div'));
    const hour_label = hourDiv.appendChild(document.createElement('label'));
    hour_label.textContent = "Hour:";
    const hour_slider = hourDiv.appendChild(document.createElement('input'));
    hour_slider.setAttribute("type", "range");
    hour_slider.setAttribute("min", "0");
    hour_slider.setAttribute("max", "23");
    hour_slider.setAttribute("value", `${this.time.hour}`);
    hour_slider.setAttribute("class", "hourSlider");
    hour_slider.oninput = function(e: Event) {
      if (e.target !== null) {
        const target = e.target as HTMLInputElement;
        const hour = Number.parseInt(target.value);
        if (!Number.isNaN(hour)) {
          mythis.time = mythis.time.set({hour: hour});
        }
      }
    }

    const minDiv = popupDiv.appendChild(document.createElement('div'));
    const min_label = hourDiv.appendChild(document.createElement('label'));
    min_label.textContent = "Min:";
    const min_slider = hourDiv.appendChild(document.createElement('input'));
    min_slider.setAttribute("type", "range");
    min_slider.setAttribute("min", "0");
    min_slider.setAttribute("max", "59");
    min_slider.setAttribute("value", `${this.time.minute}`);
    min_slider.setAttribute("class", "minSlider");
    min_slider.oninput = function(e: Event) {
      // @ts-ignore
      console.log(`min slider: ${e.target.value}`)
      if (e.target !== null) {
        const target = e.target as HTMLInputElement;
        const min = Number.parseInt(target.value);
        if (!Number.isNaN(min)) {
          mythis.time = mythis.time.set({minute: min});
        }
      }
    }


    const ntext = wrapper.appendChild(document.createElement('input'));
    ntext.setAttribute('type','text');
    ntext.setAttribute('name','hourMin');
    ntext.setAttribute('class','hourMin');
    ntext.setAttribute('value',this.time.toFormat(HOUR_MIN_24));
    ntext.onchange = function(e: Event) {
      let val = ntext.getAttribute("value");
      if (val === null ) {
        val = mythis.time.toFormat(HOUR_MIN_24);
        ntext.setAttribute("value", val);
      }
      let match = hourMinRegEx.exec(val);

      if (match) {
        //ntext.style("background-color", null);
        let h = match[1];
        let m = match[2];
        const newTime = mythis.time.set({hour: parseInt(h), minute: parseInt(m)});
        if (newTime !== mythis.time) {
          mythis.time = newTime;
        }
        mythis.popupDiv.setAttribute("class", "hidden");
      } else {
        ntext.setAttribute("value", mythis.time.toFormat(HOUR_MIN_24));
      }
    }
    ntext.onclick = function() {mythis.showHide()};
    wrapper.appendChild(popupDiv);
    shadow.appendChild(wrapper);
  }
  /**
   * Shows or hides the popup based on current visibility style
   */
  showHide(): void {
    if (this.popupDiv.getAttribute("class")?.includes("hidden")) {
      this.popupDiv.setAttribute("class", "hourminpopup visible");

      this._adjustPopupPosition();

      //window.document.addEventListener("click", this.myOnClick, false);
    } else {
      this.popupDiv.setAttribute("class", "hourminpopup hidden");
      //window.document.removeEventListener("click", this.myOnClick);
    }
  }

  /** @private */
  _adjustPopupPosition(): void {
    let hourMinField = (this.shadowRoot?.querySelector('input.'+'hourMin') as HTMLInputElement);
    let width = hourMinField.offsetWidth;
    let height = hourMinField.offsetHeight;
    let viewportWidth: number = window.innerWidth;
    let viewportHeight: number = window.innerHeight;
    let scrollTop: number = window.pageYOffset;
    let left = hourMinField.offsetLeft;
    let top = hourMinField.offsetTop + hourMinField.offsetHeight;

    let parentField = hourMinField.offsetParent;
    while (parentField !== null) {
      if (parentField instanceof HTMLElement) {
        left += parentField.offsetLeft;
        top += parentField.offsetTop;
        parentField = parentField.offsetParent;
      }
    }

    // default position is bottom & left
    if (left + width > viewportWidth) {
      left = left - width + hourMinField.offsetWidth;
    }

    if (top + height > viewportHeight + scrollTop) {
      top = top - height - hourMinField.offsetHeight;
    }

    this.popupDiv.setAttribute("style", `{left: ${left} px; top: ${top} px;}`);
  }
  get time(): DateTime {
    return this._time;
  }
  set time(dt: DateTime) {
    this._time = dt;
    console.log(`set time: ${dt.hour}:${dt.minute}`)
    const ntext = (this.shadowRoot?.querySelector('input.'+'hourMin') as HTMLInputElement);
    ntext.setAttribute('value',this._time.toFormat(HOUR_MIN_24));
    const hourSlider = (this.popupDiv?.querySelector('input.hourSlider') as HTMLInputElement);
    hourSlider.setAttribute("value", `${this._time.hour}`);
    const minuteSlider = (this.popupDiv?.querySelector('input.minSlider') as HTMLInputElement);
    minuteSlider.setAttribute("value", `${this._time.minute}`);
    this.updateCallback(this.time);
  }
}
customElements.define('hour-min-chooser', HourMinChooser);

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
