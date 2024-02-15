import { DateTime, Duration, Interval } from "luxon";
import { DataLinkPacket } from "./datalink";
import * as miniseed from "./miniseed";
import { OrganizedDisplay } from "./organizeddisplay";
import { AlignmentLinkedTimeScale, LinkedAmplitudeScale } from "./scale";
import { SeismogramDisplayData } from "./seismogram";
import { SeisPlotElement } from "./spelement";
import { SeismographConfig } from "./seismographconfig";
import { Network } from "./stationxml";

export class AnimatedTimeScaler {
  alignmentTime: DateTime;
  timeScale: AlignmentLinkedTimeScale;
  minRedrawMillis = 100;
  goAnimation = true;
  previousStep: DOMHighResTimeStamp = Number.NEGATIVE_INFINITY;
  _animationId = 0;
  constructor(
    timeScale: AlignmentLinkedTimeScale,
    alignmentTime?: DateTime,
    minRedrawMillis = 100,
  ) {
    this.timeScale = timeScale;
    this.alignmentTime = alignmentTime ? alignmentTime : DateTime.utc();
    this.minRedrawMillis = minRedrawMillis;
  }
  animate() {
    this.goAnimation = true;
    window.requestAnimationFrame((timestamp) => this.stepper(timestamp));
  }
  animateOnce() {
    this.goAnimation = false;
    window.requestAnimationFrame((timestamp) => {
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
      window.setTimeout(
        () => {
          // in case we ask for second animation frame before first runs
          if (this._animationId !== 0) {
            window.cancelAnimationFrame(this._animationId);
          }
          this._animationId = window.requestAnimationFrame((timestamp) =>
            this.stepper(timestamp),
          );
        },
        this.minRedrawMillis - (now - timestamp),
      );
    }
  }
  step() {
    const now = DateTime.utc();
    const calcOffset = now.diff(this.alignmentTime);
    this.timeScale.offset = calcOffset;
  }
}

export type RTDisplayContainer = {
  organizedDisplay: OrganizedDisplay;
  animationScaler: AnimatedTimeScaler;
  packetHandler: (packet: DataLinkPacket) => void;
  config: RTConfig;
};

export type RTConfig = {
  duration: Duration;
  alignmentTime: DateTime;
  offset: Duration;
  minRedrawMillis: number;
  networkList: Array<Network>;
};

/**
 * Validates the object for typescript and adds any missing required
 * fields. Passing in an empty object is allowed.
 * @param  configObj  config object
 * @returns true if object has correct structure, with defaults populated
 */
export function isValidRTConfig(configObj: unknown): configObj is RTConfig {
  if (!configObj || typeof configObj !== "object") {
    throw new TypeError("config is not object");
  }
  const config = configObj as Record<string, unknown>;
  if (typeof config.duration === "undefined") {
    config.duration = Duration.fromISO("PT5M");
  }
  if (typeof config.alignmentTime === "undefined") {
    config.alignmentTime = DateTime.utc();
  }
  if (typeof config.offset === "undefined") {
    config.offset = Duration.fromMillis(0);
  }
  if (typeof config.minRedrawMillis === "undefined") {
    config.minRedrawMillis = 100;
  }
  if (typeof config.networkList === "undefined") {
    config.networkList = [];
  }
  return true;
}
export function createRealtimeDisplay(config: unknown): RTDisplayContainer {
  if (!config) {
    // this will create a default config
    config = {};
  }
  if (isValidRTConfig(config)) {
    return internalCreateRealtimeDisplay(config);
  } else {
    throw new Error("config is not valid");
  }
}

export function internalCreateRealtimeDisplay(
  config: RTConfig,
): RTDisplayContainer {
  const timeScale = new AlignmentLinkedTimeScale(
    [],
    config.duration.negate(),
    config.offset,
  );
  const seisPlotConfig = new SeismographConfig();
  seisPlotConfig.wheelZoom = false;
  seisPlotConfig.isYAxisNice = false;
  seisPlotConfig.linkedTimeScale = timeScale;
  seisPlotConfig.linkedAmplitudeScale = new LinkedAmplitudeScale();
  const animationScaler = new AnimatedTimeScaler(
    timeScale,
    config.alignmentTime,
    config.minRedrawMillis,
  );

  const orgDisp = new OrganizedDisplay([], seisPlotConfig);

  const packetHandler = (packet: DataLinkPacket) => {
    if (!packet) {
      return;
    }
    if (packet.isMiniseed()) {
      const msr = packet.asMiniseed();
      if (msr) {
        const seisSegment = miniseed.createSeismogramSegment(msr);
        const codes = seisSegment.codes();
        const matchSDD = orgDisp.seisData.find(
          (sdd: SeismogramDisplayData) => sdd.codes() === codes,
        );
        if (matchSDD) {
          matchSDD.append(seisSegment);
        } else {
          const sdd = SeismogramDisplayData.fromSeismogramSegment(seisSegment);
          if (config.networkList) {
            sdd.associateChannel(config.networkList);
          }
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
    config: config,
  };
}

/**
 * Trims all seismograms to the given window in place. This should not
 * cause a redraw.
 *
 * @param orgDisplay OrganizedDisplay to trim
 * @param  timeRange  time window to coarse trim the data to
 */
export function trim(orgDisplay: OrganizedDisplay, timeRange: Interval) {
  orgDisplay.seisData.forEach((sdd) => {
    sdd.trimInPlace(timeRange);
    sdd.timeRange = timeRange;
  });
}

/**
 * Calculates the duration covered by one pixel on the time axis. This is the optimal
 * time interval for updating the animation of a real time display as updates more
 * frequently than this tend to cause more flikering than actual movement of the seismogram.
 * @param seismograph the seismograph to get pixel size from
 * @returns the pixel width as a Duration
 */
export function calcOnePixelDuration(seismograph: SeisPlotElement): Duration {
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
  if (timerInterval < 0) {
    timerInterval *= -1;
  }
  let pixels = rect.width - margin.left - margin.right;
  if (pixels <= 0) {
    pixels = 1000;
  }
  timerInterval = timerInterval / pixels;
  // aim for updates between 50 and 250 milliseconds
  if (timerInterval === 0) {
    timerInterval = 100;
  }
  while (timerInterval > 0 && timerInterval < 50) {
    timerInterval *= 2;
  }
  if (timerInterval > 250) {
    timerInterval /= 2;
  }
  return Duration.fromMillis(timerInterval);
}
