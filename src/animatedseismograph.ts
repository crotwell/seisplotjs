import {Seismograph} from './seismograph';
import {SeismogramSegment} from './seismogramsegment';
import {Seismogram, SeismogramDisplayData} from './seismogram';
import {DateTime, Interval} from "luxon";

export class AnimatedSeismograph {
  seismograph: Seismograph;
  minRedrawMillis: number;
  appendable: Array<SeismogramSegment>;
  previousStep?: DOMHighResTimeStamp;
  stepper: (timestamp: DOMHighResTimeStamp) => void;
  redrawInProgress = false;
  goAnimation = true;
  constructor(seismograph: Seismograph, minRedrawMillis = 100) {
    this.seismograph = seismograph;
    this.appendable = [];
    this.minRedrawMillis = minRedrawMillis;
    this.stepper = (timestamp: DOMHighResTimeStamp) => {
      if (this.previousStep == null) {
        this.previousStep = timestamp;
      }
      const elapsed = timestamp-this.previousStep;
      if ( ! this.redrawInProgress && elapsed > minRedrawMillis) {
        this.redrawInProgress = true;
        this.animateSeismograph();
        this.previousStep = timestamp;
        this.redrawInProgress = false;
      }
      if (this.goAnimation) {
        window.setTimeout( () => {
          window.requestAnimationFrame(timestamp => this.stepper(timestamp));
        }, this.minRedrawMillis);
      }
    };
  }
  /**
   * Holds onto new segments for appending at next redraw;
   * @param  segment  to append
   */
  append(segment: SeismogramSegment) {
    this.appendable.push(segment);
  }
  appendAll() {
    const appendable = this.appendable;
    this.appendable = [];
    appendable.forEach(segment => {
      const sdd = this.seismograph.seisData.find(s => s.sourceId.equals(segment.sourceId));
      if (sdd) {
        sdd.append(segment);
      } else {
        const nsdd = SeismogramDisplayData.fromSeismogram(new Seismogram(segment));
        this.seismograph.seisData.push(nsdd);
      }
    });
  }
  /**
   * Trims all seismograms to the given window.
   *
   * @param  timeWindow  window to coarse trim the data to
   */
  trim(timeWindow?: Interval) {
    const trimmedSeisData: Array<SeismogramDisplayData> = [];
    this.seismograph.seisData.forEach(sdd => {
      const sddTrimWindow = timeWindow ? timeWindow : this.seismograph.displayTimeRangeForSeisDisplayData(sdd);
      const trimmed = sdd.trim(sddTrimWindow);
      if (trimmed != null) {
        trimmedSeisData.push(trimmed);
      }
    });
    this.seismograph.seisData = trimmedSeisData;
  }
  draw() {
    this.seismograph.draw();
  }
  animate() {
    this.goAnimation = true;
    window.requestAnimationFrame(timestamp => this.stepper(timestamp));
  }
  animateOnce() {
    this.goAnimation = false;
    window.requestAnimationFrame(timestamp => {
      if ( ! this.redrawInProgress) {
        this.redrawInProgress = true;
        this.animateSeismograph();
        this.previousStep = timestamp;
        this.redrawInProgress = false;
      }
    });
  }
  pause() {
    this.goAnimation = false;
  }
  animateSeismograph(alignNow?: DateTime) {
    const now = (alignNow == null) ? DateTime.utc() : alignNow;
    this.appendAll(); // any new segments
    this.seismograph.seisData.forEach(sdd => {
      sdd.alignmentTime = now;
    });
    this.seismograph.draw();
  }
}


export class AnimatedSeismographGroup {
  animatedGraphList: Array<AnimatedSeismograph> = [];
  minRedrawMillis = 100;
  stepper: (timestamp: DOMHighResTimeStamp) => void;
  redrawInProgress = false;
  goAnimation = true;
  autotrim = true;
  previousStep?: DOMHighResTimeStamp;
  constructor(animatedGraphList: Array<AnimatedSeismograph>, minRedrawMillis = 100) {
    if (animatedGraphList) {
      this.animatedGraphList = animatedGraphList;
    }
    this.minRedrawMillis = minRedrawMillis;
    this.stepper = (timestamp: DOMHighResTimeStamp) => {
      if (this.previousStep == null) {
        this.previousStep = timestamp;
      }
      const elapsed = timestamp-this.previousStep;
      if ( ! this.redrawInProgress && elapsed > this.minRedrawMillis) {
        this.redrawInProgress = true;
        const now = DateTime.utc();
        if (this.autotrim) {
          this.animatedGraphList.forEach(am => am.trim());
        }
        this.animatedGraphList.forEach(am => am.animateSeismograph(now));
        this.previousStep = timestamp;
        this.redrawInProgress = false;
      }
      if (this.goAnimation) {
        window.setTimeout( () => {
          window.requestAnimationFrame(timestamp => this.stepper(timestamp));
        }, this.minRedrawMillis);
      }
    };
  }
  add(animatedSeismograph: AnimatedSeismograph) {
    this.animatedGraphList.push(animatedSeismograph);
  }
  draw() {
    this.animatedGraphList.forEach(am => am.draw());
  }
  /**
   * Trims all graphs in this group to the optional time window. If not
   * given, the current display time window for each is used.
   * @param  timeWindow  optional display to trim
   */
  trim(timeWindow?: Interval) {
    this.animatedGraphList.forEach(am => am.trim(timeWindow));
  }
  animate() {
    this.goAnimation = true;
    window.requestAnimationFrame(timestamp => this.stepper(timestamp));
  }
  animateOnce() {
    this.goAnimation = false;
    window.requestAnimationFrame(timestamp => {
      if ( ! this.redrawInProgress) {
        this.redrawInProgress = true;
        const now = DateTime.utc();
        this.animatedGraphList.forEach(am => am.animateSeismograph(now));
        this.previousStep = timestamp;
        this.redrawInProgress = false;
      }
    });
  }
  pause() {
    this.goAnimation = false;
  }
}
