/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */
import {DateTime, Duration} from "luxon";
import {StartEndDuration, isoToDateTime} from "./util";


export const hourMinRegEx = /^([0-1]?[0-9]):([0-5]?[0-9])$/;
export const HOUR_MIN_24 = "HH:mm";


/**
 * Hour and Minute chooser using sliders.
 * Use as '<hour-min-chooser></hour-min-chooser>'
 */
export class HourMinChooser extends HTMLElement {
  _time: DateTime;
  updateCallback: (time: DateTime) => void;
  popupDiv: HTMLDivElement;
  constructor() {
    super();
    const mythis = this;
    this._time = DateTime.utc().set({second: 0, millisecond: 0});
    const attr_date_time = this.getAttribute("date-time");
    if (attr_date_time) {
      this._time = isoToDateTime(attr_date_time);
      this._time.set({second: 0, millisecond: 0}); // only hour and min?
    }
    this.updateCallback = function(time: DateTime) {};
    const shadow = this.attachShadow({mode: 'open'});

    // style
    let style = document.createElement('style');

    style.textContent = `
      .hourminpopup {
        position: absolute;
        box-shadow: 0 5px 15px -5px rgba(0,0,0,.5);
        background-color: white;
        z-index: 10;
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
      input.hourMin {
        width: 3em;
      }
    `;
    shadow.appendChild(style);

    const wrapper = document.createElement('span');
    wrapper.addEventListener('mouseleave', e => {
      console.log("mouseleave wrapper")
      mythis.hide();
    });


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
        mythis.hide();
      } else {
        ntext.setAttribute("value", mythis.time.toFormat(HOUR_MIN_24));
      }
    }
    ntext.onclick = function(e) {
      console.log('ntext onclick -> showHide')
      e.stopPropagation();
      mythis.showHide()
    };
    wrapper.appendChild(popupDiv);
    shadow.appendChild(wrapper);
  }
  /**
   * Shows or hides the popup based on current visibility style
   */
  showHide(): void {
    if (this.popupDiv.getAttribute("class")?.includes("hidden")) {
      this.show();
    } else {
      this.hide();
    }
  }
  hide(): void {
    console.log("hide")
    if ( ! this.popupDiv.getAttribute("class")?.includes("hidden")) {
      this.popupDiv.setAttribute("class", "hourminpopup hidden");
    }
  }
  show(): void {
    console.log("show")
    this.popupDiv.setAttribute("class", "hourminpopup visible");
    this._adjustPopupPosition();
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
console.log(`hourmin popup position: {left: ${left} px; top: ${top} px;}`)
    this.popupDiv.setAttribute("style", `{left: ${left} px; top: ${top} px;}`);
  }
  get time(): DateTime {
    return this._time;
  }
  set time(dt: DateTime) {
    this._internalSetTime(dt);
    this.updateCallback(this.time);
  }
  _internalSetTime(dt: DateTime) {
    this._time = dt;
    console.log(`set time: ${dt.hour}:${dt.minute}`)
    const ntext = (this.shadowRoot?.querySelector('input.'+'hourMin') as HTMLInputElement);
    ntext.setAttribute('value',this._time.toFormat(HOUR_MIN_24));
    const hourSlider = (this.popupDiv?.querySelector('input.hourSlider') as HTMLInputElement);
    hourSlider.setAttribute("value", `${this._time.hour}`);
    const minuteSlider = (this.popupDiv?.querySelector('input.minSlider') as HTMLInputElement);
    minuteSlider.setAttribute("value", `${this._time.minute}`);
  }
}
customElements.define('hour-min-chooser', HourMinChooser);



/**
 * Date and Time chooser using pikaday for the date and the above
 * HourMinChooser for the hour and minute of time.
 *
 * @param div selected div to append chooser to
 * @param label label for chooser
 * @param initialTime initial chooser time value
 * @param updateCallback optional callback function when time is selected
 */
export class DateTimeChooser extends HTMLElement {

  _time: DateTime;
  updateCallback: (time: DateTime) => void;
  hourMin: HourMinChooser;

  constructor() {
    super();
    const mythis = this;
    this._time = DateTime.utc().set({second: 0, millisecond: 0});

    const attr_date_time = this.getAttribute("date-time");
    if (attr_date_time) {
      this._time = isoToDateTime(attr_date_time);
      this._time.set({second: 0, millisecond: 0}); // only hour and min?
    }
    this.updateCallback = function(time: DateTime) {};
    const shadow = this.attachShadow({mode: 'open'});

    const wrapper = document.createElement('span');

    const dateField = wrapper.appendChild(document.createElement('input'));
    dateField.setAttribute('type','date');
    dateField.setAttribute('name','date');
    dateField.setAttribute('class','date');
    dateField.setAttribute('value',this._time.toISODate());

    const hourMin = wrapper.appendChild(document.createElement('hour-min-chooser')) as HourMinChooser;
    hourMin.updateCallback = time => {
      mythis._internalSetTime(time);
      mythis.timeModified();
    };
    hourMin._time = mythis.time;
    this.hourMin = hourMin;
    dateField.onchange = function(e) {
      const value = dateField.value;
      console.log(`got change ${value}`);

        let pikaValue = DateTime.fromISO(value);
        let origTime = mythis._time;
        console.log(`pika: ${pikaValue}  prev: ${origTime}`)
        if (
          pikaValue && (
            origTime.year !== pikaValue.year ||
            origTime.month !== pikaValue.month ||
            origTime.day !== pikaValue.day
          )
        ) {
          mythis.time = mythis.time.set({ year: pikaValue.year,
                           month: pikaValue.month,
                             day: pikaValue.day
                          });
          mythis.timeModified();
        }
    }
    shadow.appendChild(wrapper);

    this._internalSetTime(this.time);
  }

  /**
   * Updates the time without triggering the callback function.
   *
   * @param  newTime new time to update sliders
   */
  updateTime(newTime: DateTime): void {
    this._internalSetTime(newTime);
  }

  /**
   * triggers the callback function.
   */
  timeModified(): void {
    this.updateCallback(this.time);
  }

  get time(): DateTime {
    return this._time;
  }
  set time(dt: DateTime) {
    this._internalSetTime(dt);
    this.updateCallback(this.time);
  }

  /**
   * internal time set
   *
   * @private
   * @param  newTime new time to update
   */
  _internalSetTime(newTime: DateTime): void {
    this._time = newTime;
    const ntext = (this.shadowRoot?.querySelector('input.date') as HTMLInputElement);
    ntext.setAttribute('value',this.time.toISODate());
    this.hourMin._internalSetTime(newTime);
  }
}
customElements.define('date-time-chooser', DateTimeChooser);

/**
 * Combination of two DateTimeChoosers to specify a start and end time.
 *
 * @param div selected div to append chooser to
 * @param updateCallback optional callback function when time is selected/changed
 */
export class TimeRangeChooser extends HTMLElement {
  updateCallback: (timerange: StartEndDuration) => void;
  duration: number;
  startChooser: DateTimeChooser;
  endChooser: DateTimeChooser;
  _mostRecentChanged: string;

  constructor() {
    super();
    this._mostRecentChanged = "start";
    this.updateCallback = (timerange: StartEndDuration) => {};
    let endTime = DateTime.utc();
    this.duration = 300;
    let startTime = endTime.minus(Duration.fromMillis(1000*this.duration));//seconds

    const shadow = this.attachShadow({mode: 'open'});
    const wrapper = document.createElement('span');

    const mythis = this;
    // style
    const style = document.createElement('style');
    style.textContent = `
          input.duration {
            width: 6em;
          }
        `;
    shadow.appendChild(style);

    const startLabel = wrapper.appendChild(document.createElement('label'));
    startLabel.textContent = "Start:";
    const startChooser = wrapper.appendChild(document.createElement('date-time-chooser'));
    this.startChooser = startChooser as DateTimeChooser;
    startChooser.setAttribute("class", "start");
    this.startChooser.updateCallback = (startTime) => {
      mythis.endChooser.updateTime(
        startTime.plus(Duration.fromMillis(1000*mythis.duration)),
      );
      mythis.updateCallback(mythis.getTimeRange());
      mythis._mostRecentChanged = "start";
    };
    let durationDiv = wrapper.appendChild(document.createElement('span'));
    durationDiv.setAttribute("class", "duration");
    const durationLabel = wrapper.appendChild(document.createElement('label'));
    durationLabel.textContent = "Duration:";
    const durationInput = wrapper.appendChild(document.createElement('input'));
    durationInput.setAttribute("value", `${this.duration}`);
    durationInput.setAttribute("type", "number");
    durationInput.setAttribute("class", "duration");
    durationInput.onclick = (e) => {
        let nDur = +Number.parseInt(durationInput.value);
        mythis.duration = nDur;

        if (mythis._mostRecentChanged === "end") {
          mythis.startChooser.updateTime(mythis.endChooser.time
              .minus(Duration.fromMillis(1000*mythis.duration)),//seconds
          );
          mythis.updateCallback(mythis.getTimeRange());
        } else {
          // change end
          mythis.endChooser.updateTime(mythis.startChooser.time
              .plus(Duration.fromMillis(1000*mythis.duration)),//seconds
          );
          mythis.updateCallback(mythis.getTimeRange());
        }
      };

    const endLabel = wrapper.appendChild(document.createElement('label'));
    endLabel.textContent = "End:";
    const endChooser = wrapper.appendChild(document.createElement('date-time-chooser'));
    this.endChooser = endChooser as DateTimeChooser;
    endChooser.setAttribute("class", "end");
    this.endChooser.updateCallback = (startTime) => {
      mythis.startChooser.updateTime(
        endTime.minus(Duration.fromMillis(1000*mythis.duration))
      );
      mythis.updateCallback(mythis.getTimeRange());
      mythis._mostRecentChanged = "end";
    };

    shadow.appendChild(wrapper);
  }

  getTimeRange(): StartEndDuration {
    return new StartEndDuration(
      this.startChooser.time,
      this.endChooser.time,
    );
  }
}
customElements.define('time-range-chooser', TimeRangeChooser);

/**
 * CSS for the parts of HourMin, DateTime and TimeRange choosers
 * that are not using pikaday.
 */
export const chooser_css = `

div.timeRangeChooser .utclabel {
  font-size: smaller;
}

div.timeRangeChooser span div.hourminpopup {
    z-index: 9999;
    display: block;
    position: relative;
    color: #333;
    background-color: white;
    border: 1px solid #ccc;
    border-bottom-color: #bbb;
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    box-shadow: 0 5px 15px -5px rgba(0,0,0,.5);
}



.hourminpopup.is-hidden {
    display: none;
}
.hourminpopup.is-bound {
    position: absolute;
    box-shadow: 0 5px 15px -5px rgba(0,0,0,.5);
    background-color: white;
}

div.hourminpopup div label {
  display: block;
  float: right;
}
div.hourminpopup div {
    display: block;
    float: right;
    clear: both;
}

div.hourminpopup input {
    width: 150px;
}

div.timeRangeChooser span {
  margin: 2px;
  margin-right: 5px;
}

input.pikaday {
  width: 80px;
}
input.pikatime {
  width: 50px;
}

`;
