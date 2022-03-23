/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */
import Pikaday from "pikaday";
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
        mythis.popupDiv.setAttribute("class", "hidden");
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
 * CSS for the pikaday chooser.
 */
export const pikaday_css = `
@charset "UTF-8";

/*!
 * Pikaday
 * Copyright © 2014 David Bushell | BSD & MIT license | http://dbushell.com/
 */

.pika-single {
    z-index: 9999;
    display: block;
    position: relative;
    color: #333;
    background: #fff;
    border: 1px solid #ccc;
    border-bottom-color: #bbb;
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
}

/*
clear child float (pika-lendar), using the famous micro clearfix hack
http://nicolasgallagher.com/micro-clearfix-hack/
*/
.pika-single:before,
.pika-single:after {
    content: " ";
    display: table;
}
.pika-single:after { clear: both }

.pika-single.is-hidden {
    display: none;
}

.pika-single.is-bound {
    position: absolute;
    box-shadow: 0 5px 15px -5px rgba(0,0,0,.5);
}

.pika-lendar {
    float: left;
    width: 240px;
    margin: 8px;
}

.pika-title {
    position: relative;
    text-align: center;
}

.pika-label {
    display: inline-block;
    position: relative;
    z-index: 9999;
    overflow: hidden;
    margin: 0;
    padding: 5px 3px;
    font-size: 14px;
    line-height: 20px;
    font-weight: bold;
    background-color: #fff;
}
.pika-title select {
    cursor: pointer;
    position: absolute;
    z-index: 9998;
    margin: 0;
    left: 0;
    top: 5px;
    opacity: 0;
}

.pika-prev,
.pika-next {
    display: block;
    cursor: pointer;
    position: relative;
    outline: none;
    border: 0;
    padding: 0;
    width: 20px;
    height: 30px;
    /* hide text using text-indent trick, using width value (it's enough) */
    text-indent: 20px;
    white-space: nowrap;
    overflow: hidden;
    background-color: transparent;
    background-position: center center;
    background-repeat: no-repeat;
    background-size: 75% 75%;
    opacity: .5;
}

.pika-prev:hover,
.pika-next:hover {
    opacity: 1;
}

.pika-prev,
.is-rtl .pika-next {
    float: left;
    background-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAeCAYAAAAsEj5rAAAAUklEQVR42u3VMQoAIBADQf8Pgj+OD9hG2CtONJB2ymQkKe0HbwAP0xucDiQWARITIDEBEnMgMQ8S8+AqBIl6kKgHiXqQqAeJepBo/z38J/U0uAHlaBkBl9I4GwAAAABJRU5ErkJggg==');
}

.pika-next,
.is-rtl .pika-prev {
    float: right;
    background-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAeCAYAAAAsEj5rAAAAU0lEQVR42u3VOwoAMAgE0dwfAnNjU26bYkBCFGwfiL9VVWoO+BJ4Gf3gtsEKKoFBNTCoCAYVwaAiGNQGMUHMkjGbgjk2mIONuXo0nC8XnCf1JXgArVIZAQh5TKYAAAAASUVORK5CYII=');
}

.pika-prev.is-disabled,
.pika-next.is-disabled {
    cursor: default;
    opacity: .2;
}

.pika-select {
    display: inline-block;
}

.pika-table {
    width: 100%;
    border-collapse: collapse;
    border-spacing: 0;
    border: 0;
}

.pika-table th,
.pika-table td {
    width: 14.285714285714286%;
    padding: 0;
}

.pika-table th {
    color: #999;
    font-size: 12px;
    line-height: 25px;
    font-weight: bold;
    text-align: center;
}

.pika-button {
    cursor: pointer;
    display: block;
    box-sizing: border-box;
    -moz-box-sizing: border-box;
    outline: none;
    border: 0;
    margin: 0;
    width: 100%;
    padding: 5px;
    color: #666;
    font-size: 12px;
    line-height: 15px;
    text-align: right;
    background: #f5f5f5;
}

.pika-week {
    font-size: 11px;
    color: #999;
}

.is-today .pika-button {
    color: #33aaff;
    font-weight: bold;
}

.is-selected .pika-button,
.has-event .pika-button {
    color: #fff;
    font-weight: bold;
    background: #33aaff;
    box-shadow: inset 0 1px 3px #178fe5;
    border-radius: 3px;
}

.has-event .pika-button {
    background: #005da9;
    box-shadow: inset 0 1px 3px #0076c9;
}

.is-disabled .pika-button,
.is-inrange .pika-button {
    background: #D5E9F7;
}

.is-startrange .pika-button {
    color: #fff;
    background: #6CB31D;
    box-shadow: none;
    border-radius: 3px;
}

.is-endrange .pika-button {
    color: #fff;
    background: #33aaff;
    box-shadow: none;
    border-radius: 3px;
}

.is-disabled .pika-button {
    pointer-events: none;
    cursor: default;
    color: #999;
    opacity: .3;
}

.is-outside-current-month .pika-button {
    color: #999;
    opacity: .3;
}

.is-selection-disabled {
    pointer-events: none;
    cursor: default;
}

.pika-button:hover,
.pika-row.pick-whole-week:hover .pika-button {
    color: #fff;
    background: #ff8000;
    box-shadow: none;
    border-radius: 3px;
}

/* styling for abbr */
.pika-table abbr {
    border-bottom: none;
    cursor: help;
}

`;


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
  picker: Pikaday;
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
    wrapper.addEventListener('mouseleave', e => {
      console.log("mouseleave wrapper")
      //mythis.picker.hide();
    });
    // style
    let style = document.createElement('style');
    style.textContent = pikaday_css + `
          input {
            width: 6em;
          }
        `;
    shadow.appendChild(style);

    const dateField = wrapper.appendChild(document.createElement('input'));
    dateField.setAttribute('type','text');
    dateField.setAttribute('name','pikaday');
    dateField.setAttribute('class','pikaday');
    dateField.setAttribute('value',this._time.toISODate());

    const hourMin = wrapper.appendChild(document.createElement('hour-min-chooser')) as HourMinChooser;
    hourMin.updateCallback = time => {
      mythis._internalSetTime(time);
      mythis.timeModified();
    };
    hourMin._time = mythis.time;
    this.hourMin = hourMin;

    dateField.onclick = function(e) {
      console.log('ntext onclick -> showHide')
      e.stopPropagation();
      if (mythis.picker.isVisible()) {
        mythis.picker.hide();
      }
    };
    shadow.appendChild(wrapper);

    this.picker = new Pikaday({
      field: dateField,
      container: wrapper,
      //  trigger: inputField.node(),
      format: "YYYY-MM-DD",
      onSelect: function () {
        let pikaValue = mythis.picker.getDate();
        let origTime = mythis._time;
        console.log(`pika: ${pikaValue}  prev: ${origTime}`)
        if (
          pikaValue && (
            origTime.year !== pikaValue.getFullYear() ||
            origTime.month !== pikaValue.getMonth() +1 ||
            origTime.day !== pikaValue.getDate()
          )
        ) {
          mythis.time = mythis.time.set({ year: pikaValue.getFullYear(),
                           month: pikaValue.getMonth() +1,
                             day: pikaValue.getDate()
                          });
          mythis.timeModified();
        }
      },
    });

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
    const ntext = (this.shadowRoot?.querySelector('input.pikaday') as HTMLInputElement);
    ntext.setAttribute('value',this.time.toISODate());
    // re-do as string to avoid utc issue, using utc messes up picker, so pretend
    this.picker.setDate(this.time.toISO(), true);
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
 * Dummy callback function for cases where user doesn't need this. Mainly here
 * to keep eslint happy.
 *
 * @param   t new time/time range, not used
 */
// eslint-disable-next-line no-unused-vars
function dummyCallback(t: DateTime) {}

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
