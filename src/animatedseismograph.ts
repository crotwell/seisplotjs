
import { DateTime, Duration, Interval } from "luxon";
import { DataLinkPacket } from './datalink';
import * as miniseed from './miniseed';
import { OrganizedDisplay } from './organizeddisplay';
import { AlignmentLinkedTimeScale, LinkedAmplitudeScale } from './scale';
import { SeismogramDisplayData } from './seismogram';
import { SeisPlotElement } from './spelement';
import { SeismographConfig } from './seismographconfig';

export class AnimatedTimeScaler {
  alignmentTime: DateTime;
  timeScale: AlignmentLinkedTimeScale;
  minRedrawMillis = 100;
  goAnimation = true;
  previousStep: DOMHighResTimeStamp = Number.NEGATIVE_INFINITY;
  _animationId = 0;
  constructor(timeScale: AlignmentLinkedTimeScale,
    alignmentTime?: DateTime,
    minRedrawMillis = 100) {
    this.timeScale = timeScale;
    this.alignmentTime = alignmentTime ? alignmentTime : DateTime.utc();
    this.minRedrawMillis = minRedrawMillis;
  }
  animate() {
    this.goAnimation = true;
    window.requestAnimationFrame(timestamp => this.stepper(timestamp));
  }
  animateOnce() {
    this.goAnimation = false;
    window.requestAnimationFrame(timestamp => {
      this.previousStep = timestamp;
      this.step();
    });
  }
  pause() {
    this.goAnimation = false;
  }
  stepper(timestamp: DOMHighResTimeStamp) {
    this._animationId = 0;
    const elapsed = timestamp - this.previousStep;

    if (elapsed > this.minRedrawMillis) {
      this.previousStep = timestamp;
      this.step();
    }

    if (this.goAnimation) {
      // schedule next redraw
      const now = window.performance.now();
      window.setTimeout(() => {
        // in case we ask for second animation frame before first runs
        if (this._animationId !== 0) { window.cancelAnimationFrame(this._animationId); }
        this._animationId = window.requestAnimationFrame(timestamp => this.stepper(timestamp));
      }, this.minRedrawMillis - (now - timestamp));
    }
  }
  step() {
    const now = DateTime.utc();
    const calcOffset = now.diff(this.alignmentTime);
    this.timeScale.offset = calcOffset;
  }
}

export type RTDisplayContainer = {
  organizedDisplay: OrganizedDisplay,
  animationScaler: AnimatedTimeScaler,
  packetHandler: (packet: DataLinkPacket) => void,
};

export function createRealtimeDisplay(minRedrawMillis = 100): RTDisplayContainer {
  const alignmentTime = DateTime.utc();
  const duration = Duration.fromISO('PT5M');
  const offset = Duration.fromMillis(0);

  const timeScale = new AlignmentLinkedTimeScale([], duration.negate(), offset);
  const seisPlotConfig = new SeismographConfig();
  seisPlotConfig.wheelZoom = false;
  seisPlotConfig.isYAxisNice = false;
  seisPlotConfig.linkedTimeScale = timeScale;
  seisPlotConfig.linkedAmplitudeScale = new LinkedAmplitudeScale();
  const animationScaler = new AnimatedTimeScaler(timeScale, alignmentTime, minRedrawMillis);

  const orgDisp = new OrganizedDisplay([], seisPlotConfig);

  const packetHandler = (packet: DataLinkPacket) => {
    if (!packet) { return; }
    if (packet.isMiniseed()) {
      const msr = packet.asMiniseed();
      if (msr) {
        const seisSegment = miniseed.createSeismogramSegment(msr);
        const codes = seisSegment.codes();
        const matchSDD = orgDisp.seisData.find((sdd: SeismogramDisplayData) => sdd.codes() === codes);
        if (matchSDD) {
          matchSDD.append(seisSegment);
        } else {
          const sdd = SeismogramDisplayData.fromSeismogramSegment(seisSegment);
          sdd.alignmentTime = animationScaler.alignmentTime;
          orgDisp.seisData.push(sdd);
          // trigger redraw if new channel, but not for simple append.
          orgDisp.seisDataUpdated();
        }
      }
    }
  };

  //animationScaler.animate();
  return {
    organizedDisplay: orgDisp,
    animationScaler: animationScaler,
    packetHandler: packetHandler,
  };
}

/**
 * Trims all seismograms to the given window.
 *
 * @param  timeWindow  window to coarse trim the data to
 */
export function trim(orgDisplay: OrganizedDisplay, timeWindow: Interval) {
  const trimmedSeisData: Array<SeismogramDisplayData> = [];
  orgDisplay.seisData.forEach(sdd => {
    const trimmed = sdd.trim(timeWindow);
    if (trimmed != null) {
      trimmedSeisData.push(trimmed);
    }
  });
  orgDisplay.seisData = trimmedSeisData;
}

/**
 * Calculates the time window covered by one pixel on the time axis. This is the optimal
 * time interval for updating the animation of a real time display as updates more
 * frequently than this tend to cause more flikering than actual movement of the seismogram.
 */
export function calcOnePixelTimeInterval(seismograph: SeisPlotElement): Duration {
  const rect = seismograph.getBoundingClientRect();
  const margin = seismograph.seismographConfig.margin;
  const lts = seismograph.seismographConfig.linkedTimeScale;
  const fts = seismograph.seismographConfig.fixedTimeScale;
  let timerInterval;
  if (lts) {
    timerInterval = lts.duration.toMillis();
  } else if (fts) {
    timerInterval = fts.toDuration().toMillis();
  } else {
    timerInterval = 1000;
  }
  if (timerInterval < 0) { timerInterval = timerInterval *= -1; }
  timerInterval = timerInterval / (rect.width - margin.left - margin.right);
  if (timerInterval === 0) { timerInterval = 1000; }
  while (timerInterval < 50) { timerInterval *= 2; }
  return Duration.fromMillis(timerInterval);
}
