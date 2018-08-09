// @flow

/* global document */

import Pikaday from 'pikaday';

import {
    d3,
    moment
} from './util';

export class HourMinChooser {

  div: any; // d3 not yet in flow-typed :(
  time: moment;
  updateCallback: ( time :moment) => void;
  hourMinRegEx: RegExp;
  myOnClick: (event :Event) => void;
  hourMinField: any; // d3 not yet in flow-typed :(
  popupDiv: any; // d3 not yet in flow-typed :(
  hourDiv: any; // d3 not yet in flow-typed :(
  hourSlider: any; // d3 not yet in flow-typed :(
  minuteDiv: any; // d3 not yet in flow-typed :(
  minuteSlider: any; // d3 not yet in flow-typed :(
  constructor(div :any, time :moment, updateCallback :( time :moment) => void) {
    let mythis = this;
    this.div = div;
    this.time = time;
    this.updateCallback = updateCallback;
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
    this.div.append("span").text("UTC");
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
        if (mythis.time.hours() != nHour) {
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
        if (mythis.time.minutes() != nMinute) {
          mythis.time.minutes(nMinute);
          mythis.minuteSlider.property("value", nMinute);
          mythis.timeModified();
        }
      });
    this.minuteSlider.attr("value", time.minute());
  }
  updateTime(newTime :moment) :void {
    this.time = newTime;
    this.hourMinField.property("value", this.time.format('HH:mm'));
    this.hourSlider.property("value", this.time.hour());
    this.minuteSlider.property("value", this.time.minute());
  }
  timeModified() :void {
    this.hourSlider.property("value", this.time.hour());
    this.minuteSlider.property("value", this.time.minute());
    this.hourMinField.property("value", this.time.format('HH:mm'));
    this.updateCallback(this.time);
  }
  showHide() :void {
    if (this.popupDiv.style("visibility") == "hidden") {
      this.popupDiv.style("visibility", "visible");
      window.document.addEventListener("click", this.myOnClick, false);
    } else {
      this.popupDiv.style("visibility", "hidden");
      window.document.removeEventListener("click", this.myOnClick);
    }
  }
  hide() :void {
    this.popupDiv.style("visibility", "hidden");
    window.document.removeEventListener("click", this.myOnClick);
  }
  _adjustPopupPosition() :void {

      let field = this.hourMinField;
      let width = this.hourMinField.offsetWidth;
      let height = this.hourMinField.offsetHeight;
      let viewportWidth :number = window.innerWidth;
      let viewportHeight :number = window.innerHeight;
      let scrollTop :number = window.pageYOffset;

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

export class DateTimeChooser {
  div: any; // d3 not yet in flow-typed :(
  time: moment;
  updateCallback: ( time :moment) => void;
  label: string;
  dateField: any;
  picker: Pikaday;
  hourMin: HourMinChooser;
  constructor(div: any, label: string, initialTime :moment, updateCallback: ( time :moment) => void) {
    this.div = div;
    this.label = label;
    this.time = moment.utc(initialTime);
    this.time.second(0).millisecond(0); // only hour and min?
    this.updateCallback = updateCallback;
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
                                  if (origTime.year() != pikaValue.year() || origTime.dayOfYear() != pikaValue.dayOfYear()) {
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
  updateTime(newTime :moment) :void {
    this._internalSetTime(newTime);
    this.hourMin.updateTime(newTime);
  }
  timeModified() :void {
    this.updateCallback(this.time);
  }
  getTime() :moment {
    return this.time;
  }
  _internalSetTime(newTime :moment) :void {
    this.time = newTime;
    this.dateField.attr("value", this.time.toISOString());
    // re-moment to avoid utc issue in
    this.picker.setMoment(moment([this.time.year(), this.time.month(), this.time.date()]));
  }
}

export type TimeRangeType = {
  duration: number,
  start: moment,
  end: moment
};

export class TimeRangeChooser {
  div :any;
  callbackFunction: (timerange : TimeRangeType) => void;
  duration: number;
  startChooser: DateTimeChooser;
  endChooser: DateTimeChooser;
  constructor(div :any, callbackFunction: (timerange : TimeRangeType) => void) {
    this.callbackFunction = callbackFunction;
    let endTime = moment.utc();
    this.duration = 300;
    let startTime = moment.utc(endTime).subtract(this.duration, 'second');
    this.div = div;
    this.div.classed("timeRangeChooser", true);
    let mythis = this;
    let startDiv = div.append("div").classed("start", true);
    this.startChooser = new DateTimeChooser(startDiv, "Start:", startTime, function(startTime) {
      // console.log("start -> endChooser updateTime: "+startTime.toISOString()+" plus "+mythis.duration);
      mythis.endChooser.updateTime(moment.utc(startTime).add(mythis.duration, 'seconds'));
      mythis.callbackFunction(mythis.getTimeRange());
    });

    let durationDiv = div.append("div").classed("duration", true);
    durationDiv.append("label").text("Duration:").append("input")
      .classed("pikatime", true)
      .attr("value", this.duration)
      .attr("type", "text")
      .on("input", function() {
        let nDur = +Number.parseInt(this.value);
        mythis.duration = nDur;
        // console.log("dur -> startChooser updateTime: "+mythis.endChooser.getTime().toISOString()+" minus "+mythis.duration);
        mythis.startChooser.updateTime(moment.utc(mythis.endChooser.getTime()).subtract(mythis.duration, 'seconds'));
        mythis.callbackFunction(mythis.getTimeRange());
      });

    let endDiv = div.append("div").classed("end", true);
    this.endChooser = new DateTimeChooser(endDiv, "End:", endTime, function(endTime) {
      // console.log("end -> startChooser updateTime: "+endTime.toISOString()+" minus "+mythis.duration);
      mythis.startChooser.updateTime(moment.utc(endTime).subtract(mythis.duration, 'seconds'));
      mythis.callbackFunction(mythis.getTimeRange());
    });
  }
  getTimeRange() :TimeRangeType {
    return {
      'start': this.startChooser.getTime(),
      'duration': this.duration,
      'end': this.endChooser.getTime()
    };
  }
}
