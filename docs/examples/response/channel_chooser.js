
const ATTR_LIST = ["Network", "Station", "Location", "Channel"];

class ChannelCodeInput extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({mode: 'open'});
    const wrapper = document.createElement('span');
    wrapper.setAttribute('class','wrapper');
    const default_vals = { "Network": "CO", "Station": "CASEE", "Location":"00","Channel":"HHZ"};
    let inputs = {};
    for (const x of ATTR_LIST ) {
      const ndiv = wrapper.appendChild(document.createElement('span'));
      const nlabel = ndiv.appendChild(document.createElement('label'));
      nlabel.textContent = x;
      const ntext = ndiv.appendChild(document.createElement('input'));
      ntext.setAttribute('class',x);
      ntext.setAttribute('type','text');
      ntext.setAttribute('name',x);
      ntext.setAttribute('value',default_vals[x]);
      inputs[x] = ntext;
    }


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
  attributeChangedCallback(name, oldValue, newValue) {
  }
  static get observedAttributes() { return ATTR_LIST; }
  get network() {
    return this.shadowRoot.querySelector('input.Network').value;
  }
  get station() {
    return this.shadowRoot.querySelector('input.Station').value;
  }
  get location() {
    return this.shadowRoot.querySelector('input.Location').value;
  }
  get channel() {
    return this.shadowRoot.querySelector('input.Channel').value;
  }

}


class ChannelListChooser extends HTMLElement {
  constructor() {
    super();
    this.channels = [];
    const shadow = this.attachShadow({mode: 'open'});
    this.draw_element(shadow);
  }
  draw_element(shadow) {
    const that = this;
    while (shadow.firstChild) {
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
  setChannels(channels) {
    this.channels = channels;
    this.draw_element(this.shadowRoot);
  }
  appendChannels(channels) {
    this.channels = this.channels.concat(channels);
    this.draw_element(this.shadowRoot);
  }
  attributeChangedCallback(name, oldValue, newValue) {
  }
  setCallback(callback) {
    this.callback = callback;
  }
}

customElements.define('channel-code-input', ChannelCodeInput);
customElements.define('channel-list-chooser', ChannelListChooser);
