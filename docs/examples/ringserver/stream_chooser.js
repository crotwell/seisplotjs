

class StreamListChooser extends HTMLElement {
  constructor() {
    super();
    this.streams = [];
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
    this.streams.forEach(c => {
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
      nlabel.textContent = `${c.key} ${c.calcLatency().humanize()}`;
    });
    shadow.appendChild(wrapper);
  }
  setStreamStats(streams) {
    this.streams = streams;
    this.draw_element(this.shadowRoot);
  }
  attributeChangedCallback(name, oldValue, newValue) {
    console.log('attributes changed.');
  }
  setCallback(callback) {
    this.callback = callback;
  }
}

customElements.define('stream-list-chooser', StreamListChooser);
