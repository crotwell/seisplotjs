/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * https://www.seis.sc.edu
 */
import {DateTime, Duration, Interval} from "luxon";
import {isoToDateTime, isDef,
  checkLuxonValid,validStartTime, validEndTime, stringify
} from "./util";

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
    this._time = DateTime.utc().set({second: 0, millisecond: 0});
    const attr_date_time = this.getAttribute("date-time");
    if (attr_date_time) {
      this._time = isoToDateTime(attr_date_time);
      this._time.set({second: 0, millisecond: 0}); // only hour and min?
    }
    this.updateCallback = function(time: DateTime) {
      // default do nothing
    };
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
        width: 4em;
      }
    `;
    shadow.appendChild(style);

    const wrapper = document.createElement('span');
    document.addEventListener('click', e => {
      //console.log("mouseleave wrapper");
      this.hide();
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
    hour_slider.oninput = (e: Event) => {
      if (e.target !== null) {
        const target = e.target as HTMLInputElement;
        const hour = Number.parseInt(target.value);
        if (!Number.isNaN(hour)) {
          this.time = this.time.set({hour: hour});
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
    min_slider.oninput = (e: Event) => {
      if (e.target !== null) {
        const target = e.target as HTMLInputElement;
        const min = Number.parseInt(target.value);
        if (!Number.isNaN(min)) {
          this.time = this.time.set({minute: min});
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
    ntext.onchange = (e: Event) => {
      let val = ntext.value;
      if (val === null ) {
        val = this.time.toFormat(HOUR_MIN_24);
        ntext.value = val;
      }
      const match = hourMinRegEx.exec(val);

      if (match) {
        //ntext.style("background-color", null);
        const h = match[1];
        const m = match[2];
        const newTime = this.time.set({hour: parseInt(h), minute: parseInt(m)});
        if (newTime !== this.time) {
          this.time = newTime;
        }
        this.hide();
      } else {
        ntext.value = this.time.toFormat(HOUR_MIN_24);
      }
    };
    ntext.onclick = (e) => {
      e.stopPropagation();
      this.showHide();
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
    this.popupDiv.setAttribute("style", `{position: absolute; left: ${left} px; top: ${top} px; }`);
  }
  /**
   * Get hours and minutes as Duration instead of as a DateTime. Useful for
   * relative times.
   *
   * @returns hours, minutes as Duration
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
    const attr_date_time = this.getAttribute("date-time");
    if (time) {
      this._time = time;
      this.setAttribute("date-time", stringify(time.toISO()));
    } else if (attr_date_time) {
      this._time = isoToDateTime(attr_date_time);
      this._time.set({second: 0, millisecond: 0}); // only hour and min?
    } else {
      this._time = DateTime.utc().set({second: 0, millisecond: 0});
    }

    this.updateCallback = function(time: DateTime) {
      // default do nothing
    };
    const shadow = this.attachShadow({mode: 'open'});

    const wrapper = document.createElement('span');

    const dateField = wrapper.appendChild(document.createElement('input'));
    dateField.setAttribute('type','date');
    dateField.setAttribute('name','date');
    dateField.setAttribute('class','date');
    dateField.value = stringify(this._time.toISODate());

    const hourMin = wrapper.appendChild(new HourMinChooser());
    hourMin._time = this.time;
    this.hourMin = hourMin;
    hourMin.addEventListener("change", () => {
      const origTime = this._time;
      const time = hourMin.time;
      if (origTime !== time) {
        this._internalSetTime(time);
        this.timeModified();
      }
    });
    dateField.addEventListener("change", () => {
      const value = dateField.value;
      const pikaValue = DateTime.fromISO(value);
      const origTime = this._time;
      if (
        pikaValue && (
          origTime.year !== pikaValue.year ||
          origTime.month !== pikaValue.month ||
          origTime.day !== pikaValue.day
        )
      ) {
        this.time = this.time.set({ year: pikaValue.year,
                         month: pikaValue.month,
                           day: pikaValue.day
                        });
        this.timeModified();
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
    ntext.value = stringify(this.time.toISODate());
    this.hourMin._internalSetTime(newTime);
  }
  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (name === "date-time") {
      this.time = isoToDateTime(newValue);
    }
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
 * Initial values can be set via the start, end and duration attributes.
 * Start and end are ISO8601 dates, duration may either be a number of
 * seconds or an ISO8601 duration string.
 * Also, if the prev-next attribute is true, then previous, next and now
 * buttons are added to shift the time range earlier, later or so that
 * the end is the current time.
 *
 * The component remembers the last changed, so if you modify duration
 * and then modify start, the end is adjusted to keep duration the same.
 *
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
    this.updateCallback = (timerange: Interval) => {
      // default do nothing
    };
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
    wrapper.classList.add("wrapper");

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
    startLabel.classList.add("startlabel");
    const startChooser = wrapper.appendChild(new DateTimeChooser());
    this.startChooser = startChooser ;
    startChooser.setAttribute("class", "start");

    const durationDiv = wrapper.appendChild(document.createElement('span'));
    durationDiv.setAttribute("class", "duration");
    const durationLabel = wrapper.appendChild(document.createElement('label'));
    durationLabel.textContent = this.durationLabel;
    durationLabel.classList.add("durationlabel");
    const durationInput = wrapper.appendChild(document.createElement('input'));
    durationInput.value = `${this.duration.toISO()}`;
    durationInput.setAttribute("class", "duration");

    const endLabel = wrapper.appendChild(document.createElement('label'));
    endLabel.textContent = this.endLabel;
    endLabel.classList.add("endlabel");
    const endChooser = wrapper.appendChild(new DateTimeChooser());
    this.endChooser = endChooser ;
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
    if (this.getAttribute("prev-next")) {
      const pastBtn = wrapper.insertBefore(document.createElement("button"), startLabel);
      pastBtn.setAttribute("id", "pastButton");
      pastBtn.textContent = "<";
      pastBtn.addEventListener("click", () => {
        this._mostRecentChanged = DURATION_CHANGED;
        this.startChooser.time = this.startChooser.time.minus(extractDuration(durationInput.value)); // causes event dispatch
      });
      const futureBtn = wrapper.appendChild(document.createElement("button"));
      futureBtn.setAttribute("id", "futureButton");
      futureBtn.textContent = ">";
      futureBtn.addEventListener("click", () => {
        this._mostRecentChanged = DURATION_CHANGED;
        this.endChooser.time = this.endChooser.time.plus(extractDuration(durationInput.value)); // causes event dispatch
      });
      const nowBtn = wrapper.appendChild(document.createElement("button"));
      nowBtn.setAttribute("id", "nowButton");
      nowBtn.textContent = "Now";
      nowBtn.addEventListener("click", () => {
        this._mostRecentChanged = DURATION_CHANGED;
        this.endChooser.time = DateTime.utc(); // causes event dispatch
      });
    }

    shadow.appendChild(wrapper);
  }
  toInterval(): Interval {
    return Interval.fromDateTimes(this.startChooser.time, this.endChooser.time);
  }

  getTimeRange(): Interval {
    return this.toInterval();
  }

  /**
   * Updates the times without triggering the callback function.
   *
   * @param  timeRange new time interval
   */
  updateTimeRange(timeRange: Interval) {
    this.startChooser.updateTime(validStartTime(timeRange));
    this.endChooser.updateTime(validEndTime(timeRange));
    this._updateDuration(timeRange.toDuration());
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
  set start(time: DateTime|string) {
    if (typeof time === "string") {
      time = DateTime.fromISO(time);
    }
    checkLuxonValid(time);
    this.startChooser.updateTime(time);
    this.setAttribute('start', stringify(time.toISO()));
    this.resyncValues(START_CHANGED);
  }
  get end(): DateTime {
    return this.endChooser.time;
  }
  set end(time: DateTime|string) {
    if (typeof time === "string") {
      time = DateTime.fromISO(time);
    }
    checkLuxonValid(time);
    this.endChooser.updateTime(time);
    this.setAttribute('end', stringify(time.toISO()));
    this.resyncValues(END_CHANGED);
  }
  set duration(duration: Duration|string) {
    if (typeof duration === "string") {
      duration = Duration.fromISO(duration);
    }
    this._updateDuration(duration);
    this.resyncValues(DURATION_CHANGED);
  }
  get duration(): Duration {
    return this._duration;
  }
  _updateDuration(duration: Duration) {
    checkLuxonValid(duration);
    this._duration = duration;
    this.setAttribute('duration', stringify(duration.toISO()));
    const dur_input = this.shadowRoot?.querySelector('input.duration') as HTMLInputElement;
    if ( ! dur_input) {throw new Error("can't find input.duration in sp-timerange");}
    dur_input.value = stringify(this._duration.toISO());
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
  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (name === "start") {
      this.start = isoToDateTime(newValue);
    } else if (name === "end") {
      this.end = isoToDateTime(newValue);
    } else if (name === "duration") {
      this.duration = Duration.fromISO(newValue);
    } else if (name === START_LABEL) {
      (this.shadowRoot?.querySelector('.startlabel') as HTMLElement).textContent = newValue;
    } else if (name === END_LABEL) {
      (this.shadowRoot?.querySelector('.endlabel') as HTMLElement).textContent = newValue;
    } else if (name === DUR_LABEL) {
      (this.shadowRoot?.querySelector('.durationLabel') as HTMLElement).textContent = newValue;
    } else {
      console.log(`set unknown attribute: "${name}"`);
    }
  }
  static get observedAttributes() {
    return ["start", "duration", "end", START_LABEL, END_LABEL, DUR_LABEL];
  }

}
customElements.define(TIMERANGE_ELEMENT, TimeRangeChooser);


/**
 * extracts duration from either string as ISO or number as seconds.
 *
 * @param  value               ISO string or number
 * @returns       duration
 */
export function extractDuration(value: string): Duration {
  let dur;
  if (value.startsWith("P")) {
    dur = Duration.fromISO(value);
  } else {
    const nDur = +Number.parseInt(value);
    dur = Duration.fromMillis(nDur*1000);
  }
  return dur;
}
