// @flow

/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */

import Pikaday from 'pikaday';

import moment from 'moment';
import * as d3 from 'd3';

import {insertCSS} from './cssutil.js';

import {StartEndDuration} from './util.js';

/**
 * Hour and Minute chooser using sliders.
 *
 * @param div selected div to append chooser to
 * @param initialTime initial chooser time value
 * @param updateCallback optional callback function when time is selected
 */
export class HourMinChooser {

  div: any; // d3 not yet in flow-typed :(
  time: moment;
  updateCallback: ( time: moment) => void;
  hourMinRegEx: RegExp;
  myOnClick: (event: Event) => void;
  hourMinField: any; // d3 not yet in flow-typed :(
  popupDiv: any; // d3 not yet in flow-typed :(
  hourDiv: any; // d3 not yet in flow-typed :(
  hourSlider: any; // d3 not yet in flow-typed :(
  minuteDiv: any; // d3 not yet in flow-typed :(
  minuteSlider: any; // d3 not yet in flow-typed :(
  constructor(div: any, initialTime: moment, updateCallback?: ( time: moment) => void) {
    let mythis = this;
    if (typeof div === 'string') {
      this.div = d3.select(div);
    } else {
      this.div = div;
    }
    this.time = moment.utc(initialTime);
    this.updateCallback = updateCallback ? updateCallback : dummyCallback;
    this.hourMinRegEx = /^([0-1]?[0-9]):([0-5]?[0-9])$/;
    this.myOnClick = function(e) {
      // click document outside popup closes popup
      // not sure this if matters???
          if (e.target !== mythis.hourMinField && e.target !== mythis.popupDiv) {
            mythis.hide();
          }
    };
    this.hourMinField = this.div.append("input")
      .classed("pikatime", true)
      .attr("value", this.time.format('HH:mm'))
      .attr("type", "text")
      .on("click", function() {
        mythis.showHide();
        // don't propagate click up to document
        d3.event.stopPropagation();
      })
      .on("change", function() {
        let match = mythis.hourMinRegEx.exec(mythis.hourMinField.property("value"));
        if (match) {
          mythis.hourMinField.style("background-color", null);
          let h = match[1];
          let m = match[2];
          mythis.time.hours(h);
          mythis.time.minutes(m);
          mythis.popupDiv.style("visibility", "hidden");
          mythis.timeModified();
        } else {
          mythis.hourMinField.property("value", mythis.time.format('HH:mm'));
        }

      });
    this.div.append("span").classed("utclabel", true).text("UTC");
    this.popupDiv = this.div.append("div")
      .classed("hourminpopup", true)
      .style("position", "absolute")
      .style("visibility", "hidden")
      .on("click", function() {
        // don't propagate click up to document
        d3.event.stopPropagation();
      });
    this.hourDiv = this.popupDiv.append("div").classed("hour", true);
    this.hourSlider = this.hourDiv.append("label").text("Hour:").append("input");
    this.hourSlider.attr("type", "range")
      .attr("min","0")
      .attr("max", "23")
      .classed("hourSlider", true)
      .on("input", function() {
        let nHour = +this.value;
        if (mythis.time.hours() !== nHour) {
          mythis.time.hours(nHour);
          mythis.hourSlider.property("value", nHour);
          mythis.timeModified();
        }
      });
    this.hourSlider.attr("value", this.time.hour());
    this.minuteDiv = this.popupDiv.append("div").classed("minute", true);
    this.minuteSlider = this.minuteDiv.append("label").text("Minute:").append("input");
    this.minuteSlider.attr("type", "range")
      .attr("min","0")
      .attr("max", "59")
      .classed("minuteSlider", true)
      .on("input", function() {
        let nMinute = +this.value;
        if (mythis.time.minutes() !== nMinute) {
          mythis.time.minutes(nMinute);
          mythis.minuteSlider.property("value", nMinute);
          mythis.timeModified();
        }
      });
    this.minuteSlider.attr("value", this.time.minute());
  }
  /**
   * Updates the time without triggering the callback function.
   *
   * @param  newTime new time to update sliders
   */
  updateTime(newTime: moment): void {
    this.time = newTime;
    this.hourMinField.property("value", this.time.format('HH:mm'));
    this.hourSlider.property("value", this.time.hour());
    this.minuteSlider.property("value", this.time.minute());
  }
  /**
   * Updates the sliders based on this.time and triggers the callback function.
   */
  timeModified(): void {
    this.hourSlider.property("value", this.time.hour());
    this.minuteSlider.property("value", this.time.minute());
    this.hourMinField.property("value", this.time.format('HH:mm'));
    this.updateCallback(this.time);
  }
  /**
   * Shows or hides the popup based on current visibility style
   */
  showHide(): void {
    if (this.popupDiv.style("visibility") === "hidden") {
      this.popupDiv.style("visibility", "visible")
        .classed("is-bound", true);
      this._adjustPopupPosition();
      window.document.addEventListener("click", this.myOnClick, false);
    } else {
      this.popupDiv.style("visibility", "hidden");
      window.document.removeEventListener("click", this.myOnClick);
    }
  }
  /**
   * Hides the popup with sliders.
   */
  hide(): void {
    this.popupDiv.style("visibility", "hidden")
      .classed("is-bound", false);
    window.document.removeEventListener("click", this.myOnClick);
  }
  /** @private */
  _adjustPopupPosition(): void {

      let field = this.hourMinField.node();
      let width = this.hourMinField.offsetWidth;
      let height = this.hourMinField.offsetHeight;
      let viewportWidth: number = window.innerWidth;
      let viewportHeight: number = window.innerHeight;
      let scrollTop: number = window.pageYOffset;
      let left = field.offsetLeft;
      let top  = field.offsetTop + field.offsetHeight;
      while((field = field.offsetParent)) {
          left += field.offsetLeft;
          top  += field.offsetTop;
      }


      // default position is bottom & left
      if ((left + width > viewportWidth)) {
          left = left - width + field.offsetWidth;
      }
      if ((top + height > viewportHeight + scrollTop)) {
          top = top - height - field.offsetHeight;
      }
      this.popupDiv.style("left", left + 'px');
      this.popupDiv.style("top", top + 'px');
  }
}

/**
 * Date and Time chooser using pikaday for the date and the above
 * HourMinChooser for the hour and minute of time.
 *
 * @param div selected div to append chooser to
 * @param label label for chooser
 * @param initialTime initial chooser time value
 * @param updateCallback optional callback function when time is selected
 */
export class DateTimeChooser {
  div: any; // d3 not yet in flow-typed :(
  time: moment;
  updateCallback: ( time: moment) => void;
  label: string;
  dateField: any;
  picker: Pikaday;
  hourMin: HourMinChooser;
  constructor(div: any, label: string, initialTime: moment, updateCallback?: ( time: moment) => void) {
    if (typeof div === 'string') {
      this.div = d3.select(div);
    } else {
      this.div = div;
    }
    this.label = label;
    this.time = moment.utc(initialTime);
    this.time.second(0).millisecond(0); // only hour and min?
    this.updateCallback = updateCallback ? updateCallback : dummyCallback;
    this.dateField = div.append("label").text(this.label).append("input")
      .classed("pikaday", true)
      .attr("value", this.time.toISOString())
      .attr("type", "text")
      .on("click", function() {
        if (mythis.picker.isVisible()) {
          mythis.picker.hide();
        }
      });
    let mythis = this;
    this.picker = new Pikaday({ field: this.dateField.node(),
                              //  trigger: inputField.node(),
                                format: "YYYY-MM-DD",
                                onSelect: function() {
                                  let pikaValue = this.getMoment();
                                  let origTime = moment.utc(mythis.time);
                                  if (origTime.year() !== pikaValue.year() || origTime.dayOfYear() !== pikaValue.dayOfYear()) {
                                    mythis.time.year(pikaValue.year());
                                    mythis.time.dayOfYear(pikaValue.dayOfYear());
                                    mythis.timeModified();
                                  }
                                }
                            });
    this._internalSetTime(this.time);
    this.hourMin = new HourMinChooser(div, this.time, function(time) {
      mythis._internalSetTime(time);
      mythis.timeModified();
    });
  }
  /**
   * Updates the time without triggering the callback function.
   *
   * @param  newTime new time to update sliders
   */
  updateTime(newTime: moment): void {
    this._internalSetTime(newTime);
    this.hourMin.updateTime(newTime);
  }
  /**
   * triggers the callback function.
   */
  timeModified(): void {
    this.updateCallback(this.time);
  }
  getTime(): moment {
    return this.time;
  }

  /**
   * internal time set
   *
   * @private
   * @param  newTime new time to update
   */
  _internalSetTime(newTime: moment): void {
    this.time = moment.utc(newTime);
    this.dateField.attr("value", this.time.toISOString());
    // re-moment to avoid utc issue, using utc messes up picker, so pretend
    this.picker.setMoment(moment([this.time.year(), this.time.month(), this.time.date()]));
  }
}

/**
 * Combination of two DateTimeChoosers to specify a start and end time.
 *
 * @param div selected div to append chooser to
 * @param updateCallback optional callback function when time is selected/changed
 */
export class TimeRangeChooser {
  div: any;
  updateCallback: (timerange: StartEndDuration) => void;
  duration: number;
  startChooser: DateTimeChooser;
  endChooser: DateTimeChooser;
  _mostRecentChanged: string;
  constructor(div: any, updateCallback?: (timerange: StartEndDuration) => void) {
    this._mostRecentChanged = 'start';
    this.updateCallback = updateCallback ? updateCallback : dummyCallback;
    let endTime = moment.utc();
    this.duration = 300;
    let startTime = moment.utc(endTime).subtract(this.duration, 'second');
    if (typeof div === 'string') {
      this.div = d3.select(div);
    } else {
      this.div = div;
    }
    this.div.classed("timeRangeChooser", true);
    let mythis = this;
    let startDiv = this.div.append("span").classed("start", true);
    this.startChooser = new DateTimeChooser(startDiv, "Start:", startTime, function(startTime) {
      mythis.endChooser.updateTime(moment.utc(startTime).add(mythis.duration, 'seconds'));
      mythis.updateCallback(mythis.getTimeRange());
      mythis._mostRecentChanged = 'start';
    });

    let durationDiv = this.div.append("span").classed("duration", true);
    durationDiv.append("label").text("Duration:").append("input")
      .classed("pikatime", true)
      .attr("value", this.duration)
      .attr("type", "text")
      .on("input", function() {
        let nDur = +Number.parseInt(this.value);
        mythis.duration = nDur;
        if (mythis._mostRecentChanged === 'end') {
          mythis.startChooser.updateTime(moment.utc(mythis.endChooser.getTime()).subtract(mythis.duration, 'seconds'));
          mythis.updateCallback(mythis.getTimeRange());
        } else {
          // change end
          mythis.endChooser.updateTime(moment.utc(mythis.startChooser.getTime()).add(mythis.duration, 'seconds'));
          mythis.updateCallback(mythis.getTimeRange());
        }
      });

    let endDiv = this.div.append("span").classed("end", true);
    this.endChooser = new DateTimeChooser(endDiv, "End:", endTime, function(endTime) {
      mythis.startChooser.updateTime(moment.utc(endTime).subtract(mythis.duration, 'seconds'));
      mythis.updateCallback(mythis.getTimeRange());
      mythis._mostRecentChanged = 'end';
    });
  }
  getTimeRange(): StartEndDuration {
    return new StartEndDuration(this.startChooser.getTime(),
                                this.endChooser.getTime());
  }
}

/**
 * Dummy callback function for cases where user doesn't need this. Mainly here
 * to keep eslint happy.
 *
 * @param   t new time/time range, not used
 */
// eslint-disable-next-line no-unused-vars
function dummyCallback(t) { }

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
  width: 70px;
}
input.pikatime {
  width: 50px;
}

`;


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


if (document){
  insertCSS(chooser_css);
  insertCSS(pikaday_css);
}
