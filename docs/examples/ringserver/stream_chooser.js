class StreamListChooser extends HTMLElement {
  constructor() {
    super();
    this.streams = [];
    const shadow = this.attachShadow({ mode: "open" });
    const div = document.createElement("div");
    const style = document.createElement("style");
    shadow.appendChild(style);
    style.textContent = `
      details {
        padding: 0.5em 0.5em 0;
      }
      summary {
        font-weight: bold;
        margin: -0.5em -0.5em 0;
        padding: 0.5em;
      }
      details[open] {
        padding: 0.5em;
      }
      details[open] summary {
        border-bottom: 1px solid #aaa;
        margin-bottom: 0.5em;
      }`;
    shadow.appendChild(div);
    this.draw_element(shadow);
  }
  draw_element(shadow) {
    const that = this;
    const shadowDiv = shadow.querySelector("div");
    while (shadowDiv.firstChild) {
      shadowDiv.removeChild(shadowDiv.lastChild);
    }
    const details = document.createElement("details");
    details.setAttribute("open", "true");
    const wrapper = document.createElement("div");
    wrapper.setAttribute("class", "wrapper");
    const label = wrapper.appendChild(document.createElement("summary"));
    label.textContent = "Channels:";
    details.appendChild(label);
    details.appendChild(wrapper);
    this.streams.forEach((c) => {
      const div = wrapper.appendChild(document.createElement("div"));
      const cb = div.appendChild(document.createElement("input"));
      cb.setAttribute("type", "radio");
      cb.setAttribute("name", "radiogroup");
      cb.setAttribute("value", c.key);
      cb.setAttribute("id", c.key);
      cb.addEventListener("change", (event) => {
        if (that.callback) {
          that.callback(c);
        }
      });
      const nlabel = div.appendChild(document.createElement("label"));
      nlabel.setAttribute("for", c.key);
      nlabel.textContent = `${c.key} ${c.calcLatency().toHuman()}`;
    });
    shadowDiv.appendChild(details);
  }
  setStreamStats(streams) {
    this.streams = streams;
    this.draw_element(this.shadowRoot);
  }
  attributeChangedCallback(name, oldValue, newValue) {
    console.log("attributes changed.");
  }
  setCallback(callback) {
    this.callback = callback;
  }
}

customElements.define("stream-list-chooser", StreamListChooser);
