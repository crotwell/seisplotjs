/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */
import {DateTime, Duration, Interval} from "luxon";
import {isoToDateTime, isDef} from "./util";

export const HOURMIN_ELEMENT = 'sp-hourmin';
export const DATETIME_ELEMENT = 'sp-datetime';
export const TIMERANGE_ELEMENT = 'sp-timerange';

export const hourMinRegEx = /^([0-1]?[0-9]):([0-5]?[0-9])$/;
export const HOUR_MIN_24 = "HH:mm";

export const START_LABEL = "startlabel";
export const DEFAULT_START_LABEL = "Start:";
export const END_LABEL = "endlabel";
export const DEFAULT_END_LABEL = "End:";
export const DUR_LABEL = "durLabel";
export const DEFAULT_DUR_LABEL = "Dur:";

/**
 * Hour and Minute chooser.
 * Use as '<sp-hourmin></sp-hourmin>'
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
    const style = document.createElement('style');

    style.textContent = `
      .hourminpopup {
        position: absolute;
        top: 17px;
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
      .popupDivRel {
        position: relative;
      }
      input.hourMin {
        width: 3em;
      }
    `;
    shadow.appendChild(style);

    const wrapper = document.createElement('span');
    document.addEventListener('click', e => {
      //console.log("mouseleave wrapper");
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
    hour_slider.value = `${this.time.hour}`;
    hour_slider.setAttribute("class", "hourSlider");
    hour_slider.oninput = function(e: Event) {
      if (e.target !== null) {
        const target = e.target as HTMLInputElement;
        const hour = Number.parseInt(target.value);
        if (!Number.isNaN(hour)) {
          mythis.time = mythis.time.set({hour: hour});
        }
      }
    };

    const minDiv = popupDiv.appendChild(document.createElement('div'));
    const min_label = minDiv.appendChild(document.createElement('label'));
    min_label.textContent = "Min:";
    const min_slider = minDiv.appendChild(document.createElement('input'));
    min_slider.setAttribute("type", "range");
    min_slider.setAttribute("min", "0");
    min_slider.setAttribute("max", "59");
    min_slider.value = `${this.time.minute}`;
    min_slider.setAttribute("class", "minSlider");
    min_slider.oninput = function(e: Event) {
      if (e.target !== null) {
        const target = e.target as HTMLInputElement;
        const min = Number.parseInt(target.value);
        if (!Number.isNaN(min)) {
          mythis.time = mythis.time.set({minute: min});
        }
      }
    };

    const ntextSpan = wrapper.appendChild(document.createElement('span'));

    const relDiv = ntextSpan.appendChild(document.createElement('span'));
    relDiv.setAttribute("class", "popupDivRel");
    relDiv.appendChild(popupDiv);

    const ntext = ntextSpan.appendChild(document.createElement('input'));
    ntext.setAttribute('type','text');
    ntext.setAttribute('name','hourMin');
    ntext.setAttribute('class','hourMin');
    ntext.value = this.time.toFormat(HOUR_MIN_24);
    ntext.onchange = function(e: Event) {
      let val = ntext.value;
      if (val === null ) {
        val = mythis.time.toFormat(HOUR_MIN_24);
        ntext.value = val;
      }
      const match = hourMinRegEx.exec(val);

      if (match) {
        //ntext.style("background-color", null);
        const h = match[1];
        const m = match[2];
        const newTime = mythis.time.set({hour: parseInt(h), minute: parseInt(m)});
        if (newTime !== mythis.time) {
          mythis.time = newTime;
        }
        mythis.hide();
      } else {
        ntext.value = mythis.time.toFormat(HOUR_MIN_24);
      }
    };
    ntext.onclick = function(e) {
      e.stopPropagation();
      mythis.showHide();
    };
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
    if ( ! this.popupDiv.getAttribute("class")?.includes("hidden")) {
      this.popupDiv.setAttribute("class", "hourminpopup hidden");
    }
  }
  show(): void {
    this.popupDiv.setAttribute("class", "hourminpopup visible");
    this._adjustPopupPosition();
  }

  /** @private */
  xxx_adjustPopupPosition(): void {
    const left = 0;
    const top = 0;
    this.popupDiv.setAttribute("style", `{left: ${left} px; top: ${top} px;}`);
  }
  /** @private */
  _adjustPopupPosition(): void {
    const hourMinField = (this.shadowRoot?.querySelector('input.'+'hourMin') as HTMLInputElement);
    const width = hourMinField.offsetWidth;
    const height = hourMinField.offsetHeight;
    const viewportWidth: number = window.innerWidth;
    const viewportHeight: number = window.innerHeight;
    const scrollTop: number = window.pageYOffset;
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
console.log(`hourmin popup position: {left: ${left} px; top: ${top} px;}`);
    this.popupDiv.setAttribute("style", `{position: absolute; left: ${left} px; top: ${top} px; }`);
  }
  /**
   * Get hours and minutes as Duration instead of as a DateTime. Useful for
   * relative times.
   * @return hours, minutes as Duration
   */
  get asDuration(): Duration {
    return Duration.fromObject({hours: this.time.hour, minutes: this.time.minute});
  }
  get time(): DateTime {
    return this._time;
  }
  set time(dt: DateTime) {
    this._internalSetTime(dt);
    this.updateCallback(this.time);
    console.log(`dispatch change from HourMinChooser ${dt.toISO()}`)
    this.dispatchEvent(new Event("change"));
  }
  _internalSetTime(dt: DateTime) {
    this._time = dt;
    const ntext = (this.shadowRoot?.querySelector('input.'+'hourMin') as HTMLInputElement);
    ntext.value = this._time.toFormat(HOUR_MIN_24);
    const hourSlider = (this.popupDiv?.querySelector('input.hourSlider') as HTMLInputElement);
    hourSlider.value = `${this._time.hour}`;
    const minuteSlider = (this.popupDiv?.querySelector('input.minSlider') as HTMLInputElement);
    minuteSlider.value = `${this._time.minute}`;
  }
}
customElements.define(HOURMIN_ELEMENT, HourMinChooser);



/**
 * Date and Time chooser using native date chooser and the above
 * HourMinChooser for the hour and minute of time.
 */
export class DateTimeChooser extends HTMLElement {

  _time: DateTime;
  updateCallback: (time: DateTime) => void;
  hourMin: HourMinChooser;

  constructor(time?: DateTime) {
    super();
    const mythis = this;
    const attr_date_time = this.getAttribute("date-time");
    if (time) {
      this._time = time;
      this.setAttribute("date-time", time.toISO());
    } else if (attr_date_time) {
      this._time = isoToDateTime(attr_date_time);
      this._time.set({second: 0, millisecond: 0}); // only hour and min?
    } else {
      this._time = DateTime.utc().set({second: 0, millisecond: 0});
    }

    this.updateCallback = function(time: DateTime) {};
    const shadow = this.attachShadow({mode: 'open'});

    const wrapper = document.createElement('span');

    const dateField = wrapper.appendChild(document.createElement('input'));
    dateField.setAttribute('type','date');
    dateField.setAttribute('name','date');
    dateField.setAttribute('class','date');
    dateField.value = this._time.toISODate();

    const hourMin = wrapper.appendChild(new HourMinChooser());
    hourMin._time = mythis.time;
    this.hourMin = hourMin;
    hourMin.addEventListener("change", () => {
      const origTime = mythis._time;
      const time = hourMin.time;
      if (origTime !== time) {
        mythis._internalSetTime(time);
        mythis.timeModified();
      }
    });
    dateField.addEventListener("change", () => {
      const value = dateField.value;
      const pikaValue = DateTime.fromISO(value);
      const origTime = mythis._time;
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
    });

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
    this.dispatchEvent(new Event("change"));
  }

  get time(): DateTime {
    return this._time;
  }
  set time(dt: DateTime) {
    this._internalSetTime(dt);
    this.updateCallback(this.time);
    this.dispatchEvent(new Event("change"));
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
    ntext.value = this.time.toISODate();
    this.hourMin._internalSetTime(newTime);
  }

  static get observedAttributes() {
    return ["date-time"];
  }
}
customElements.define(DATETIME_ELEMENT, DateTimeChooser);

export const START_CHANGED = "start";
export const END_CHANGED = "end";
export const DURATION_CHANGED = "duration";

/**
 * Combination of two DateTimeChoosers to specify a start and end time.
 * A "change" event is fired when the times are modified.
 *
 * @param div selected div to append chooser to
 * @param updateCallback optional callback function when time is selected/changed
 */
export class TimeRangeChooser extends HTMLElement {
  updateCallback: (timerange: Interval) => void;
  _duration: Duration;
  startChooser: DateTimeChooser;
  endChooser: DateTimeChooser;
  _mostRecentChanged: string;

  constructor() {
    super();
    this._mostRecentChanged = "end";
    this.updateCallback = (timerange: Interval) => {};
    const endAttr = this.getAttribute("end");
    let endTime: DateTime;
    if (endAttr) {
      endTime = isoToDateTime(endAttr);
    } else {
      endTime = DateTime.utc().startOf('minute');
    }
    const durAttr = this.getAttribute("duration");
    if (durAttr) {
      this._duration = extractDuration(durAttr);
    } else {
      this._duration = Duration.fromMillis(1000*300);
    }
    const startAttr = this.getAttribute("start");
    let startTime: DateTime;
    if (startAttr) {
      startTime = isoToDateTime(startAttr);
      if (endAttr) {
        const durInterval = Interval.fromDateTimes(startTime, endTime);
        this._duration = durInterval.toDuration();
      } else {
        endTime = startTime.plus(this._duration);
      }
    } else {
      startTime = endTime.minus(this._duration);
    }

    const shadow = this.attachShadow({mode: 'open'});
    const wrapper = document.createElement('span');

    // style
    const style = document.createElement('style');
    style.textContent = `
          input.duration {
            width: 8em;
          }
          label {
            margin-left: 3px;
            margin-right: 1px;
          }
        `;
    shadow.appendChild(style);

    const startLabel = wrapper.appendChild(document.createElement('label'));
    startLabel.textContent = this.startLabel;
    const startChooser = wrapper.appendChild(new DateTimeChooser());
    this.startChooser = startChooser as DateTimeChooser;
    startChooser.setAttribute("class", "start");

    const durationDiv = wrapper.appendChild(document.createElement('span'));
    durationDiv.setAttribute("class", "duration");
    const durationLabel = wrapper.appendChild(document.createElement('label'));
    durationLabel.textContent = this.durationLabel;
    const durationInput = wrapper.appendChild(document.createElement('input'));
    durationInput.value = `${this.duration}`;
    //durationInput.setAttribute("type", "number");
    durationInput.setAttribute("class", "duration");

    const endLabel = wrapper.appendChild(document.createElement('label'));
    endLabel.textContent = this.endLabel;
    const endChooser = wrapper.appendChild(new DateTimeChooser());
    this.endChooser = endChooser as DateTimeChooser;
    endChooser.setAttribute("class", "end");

    startChooser.addEventListener("change", () => {
      this.start = startChooser.time;
    });
    durationInput.addEventListener("change", () => {
      if (! durationInput.value) {
        return;
      }
      this.duration = extractDuration(durationInput.value);
    });
    endChooser.addEventListener("change", () => {
      this.end = endChooser.time;
    });
    this.startChooser.updateTime(startTime);
    this.endChooser.updateTime(endTime);

    shadow.appendChild(wrapper);
  }
  toInterval(): Interval {
    return Interval.fromDateTimes(this.startChooser.time, this.endChooser.time);
  }

  getTimeRange(): Interval {
    return this.toInterval();
  }
  get startLabel(): string {
    const l = this.getAttribute(START_LABEL);
    if (isDef(l)) { return l; } else { return DEFAULT_START_LABEL; }
  }
  get endLabel(): string {
    const l =  this.getAttribute(END_LABEL);
    if (isDef(l)) { return l; } else { return DEFAULT_END_LABEL; }
  }
  get durationLabel(): string {
    const l =  this.getAttribute(DUR_LABEL);
    if (isDef(l)) { return l; } else { return DEFAULT_DUR_LABEL; }
  }
  get start(): DateTime {
    return this.startChooser.time;
  }
  set start(time: DateTime) {
    this.startChooser.updateTime(time);
    this.setAttribute('start', time.toISO());
    this.resyncValues(START_CHANGED);
  }
  get end(): DateTime {
    return this.endChooser.time;
  }
  set end(time: DateTime) {
    this.endChooser.updateTime(time);
    this.setAttribute('end', time.toISO());
    this.resyncValues(END_CHANGED);
  }
  set duration(duration: Duration) {
    this._updateDuration(duration);
    this.resyncValues(DURATION_CHANGED);
  }
  get duration(): Duration {
    return this._duration;
  }
  _updateDuration(duration: Duration) {
    this._duration = duration;
    this.setAttribute('duration', duration.toISO());
    const dur_input = this.shadowRoot?.querySelector('input.duration') as HTMLInputElement;
    if ( ! dur_input) {throw new Error("can't find input.duration in sp-timerange");}
    dur_input.value = this._duration.toISO();
  }
  resyncValues(curChanged: string) {
    if (curChanged === START_CHANGED) {
      if (this._mostRecentChanged === END_CHANGED && this.start < this.end) {
        this._updateDuration(this.toInterval().toDuration());
      } else {
        // this._mostRecentChanged === DURATION_CHANGED || this._mostRecentChanged === START_CHANGED
        this.endChooser.updateTime(this.startChooser.time.plus(this._duration));
      }
    } else if (curChanged === DURATION_CHANGED) {
      if (this._mostRecentChanged === START_CHANGED) {
        this.endChooser.updateTime(this.startChooser.time.plus(this._duration));
      } else {
        // this._mostRecentChanged === END_CHANGED || this._mostRecentChanged === DURATION_CHANGED
        this.startChooser.updateTime(this.endChooser.time.minus(this._duration));
      }
    } else {
      // assume end
      if (this._mostRecentChanged === START_CHANGED && this.start < this.end) {
        this._updateDuration(this.toInterval().toDuration());
      } else {
        // this._mostRecentChanged === END_CHANGED || this._mostRecentChanged === DURATION_CHANGED
        this.startChooser.updateTime(this.endChooser.time.minus(this._duration));
      }
    }
    if (curChanged !== this._mostRecentChanged) {
      this._mostRecentChanged = curChanged;
    }
    this.dispatchEvent(new Event("change"));
    this.updateCallback(this.getTimeRange());

  }
  static get observedAttributes() {
    return ["start", "duration", "end", START_LABEL, END_LABEL, DUR_LABEL];
  }

}
customElements.define(TIMERANGE_ELEMENT, TimeRangeChooser);


/**
 * extracts duration from either string as ISO or number as seconds.
 * @param  value               ISO string or number
 * @return       duration
 */
export function extractDuration(value: string): Duration {
  let dur;
  if (value.startsWith("P")) {
    dur = Duration.fromISO(value);
  } else {
    const nDur = +Number.parseInt(value);
    dur = Duration.fromMillis(nDur*1000);
  }
  return dur
}
