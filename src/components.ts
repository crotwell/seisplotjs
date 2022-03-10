import {TimeRangeChooser} from './datechooser';
import {StartEndDuration, isDef} from './util';

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
