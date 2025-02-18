import { DateTime, Duration, Interval } from "luxon";
import { DataLinkPacket } from "./datalink";
import type {SequencedDataRecord} from "./seedlink";
import { SEPacket } from "./seedlink4";
import * as miniseed from "./miniseed";
import * as mseed3 from "./mseed3";
import {removeTrend} from "./filter";
import { OrganizedDisplay } from "./organizeddisplay";
import { AlignmentLinkedTimeScale, LinkedAmplitudeScale } from "./scale";
import { SORT_ALPHABETICAL} from "./sorting";
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
  rawSeisData: Array<SeismogramDisplayData>;
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
  removeTrend: boolean;
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
  if (typeof config.removeTrend === "undefined") {
    config.removeTrend = false;
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
  const negDuration = config.duration.negate();
  const timeScale = new AlignmentLinkedTimeScale(
    [],
    negDuration,
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

  const rawSeisData = new Array<SeismogramDisplayData>();
  const orgDisp = new OrganizedDisplay([], seisPlotConfig);
    // default is to sort by order added, which will be random for real time
  // alphabetical seems better for rt
  orgDisp.sortby = SORT_ALPHABETICAL;

  // packet handler can accept datalink, seedlink or seedlinkv4 packets and
  // either miniseed or miniseed3 data
  const packetHandler = (packet: DataLinkPacket|SEPacket|SequencedDataRecord) => {
    if (!packet) {
      return;
    }
    let msr = null;
    let ms3 = null;
    if (packet instanceof DataLinkPacket) {
      if (packet.isMiniseed()) {
        msr = packet.asMiniseed();
      } else if (packet.isMiniseed3()) {
        ms3 = packet.asMiniseed3();
      }
    } else if (packet instanceof SEPacket) {
      // seedlink v4
      if (packet.isMiniseed()) {
        msr = packet.asMiniseed();
      } else if (packet.isMiniseed3()) {
        ms3 = packet.asMiniseed3();
      }
    } else  {
      // SequencedDataRecord, seedlink v3
      msr = packet.miniseed;
    }
    let seisSegment = null;
    if (msr) {
      seisSegment = miniseed.createSeismogramSegment(msr);
    } else if (ms3) {
      seisSegment = mseed3.createSeismogramSegment([ms3]);
    } else {
      // no data?
      return;
    }
    const codes = seisSegment.codes();
    const matchSDD = rawSeisData.find(
      (sdd: SeismogramDisplayData) => sdd.codes() === codes,
    );
    if (matchSDD) {
      matchSDD.append(seisSegment);
      if (matchSDD.timeRange.toDuration().toMillis() > config.duration.toMillis()*1.5) {
        const trimInterval =
          Interval.fromDateTimes(DateTime.utc().minus(config.duration),
                                 DateTime.utc());
        matchSDD.trimInPlace(trimInterval);
      }
      const dispMatchSDD = orgDisp.seisData.find(
        (sdd: SeismogramDisplayData) => sdd.codes() === codes,
      );
      if (dispMatchSDD) {
        if (config.removeTrend && matchSDD.seismogram) {
          const dtSeis = removeTrend(matchSDD.seismogram);
          if (dtSeis) {
            dispMatchSDD.seismogram = dtSeis;
          }
        } else {
          dispMatchSDD.seismogram = matchSDD.seismogram;
        }
      } else {
        // never happens, but typescipt

      }
    } else {
      const sdd = SeismogramDisplayData.fromSeismogramSegment(seisSegment);
      rawSeisData.push(sdd);
      if (config.networkList) {
        sdd.associateChannel(config.networkList);
      }
      sdd.alignmentTime = animationScaler.alignmentTime;

      if (config.removeTrend && sdd.seismogram) {
        const dispSDD = sdd.cloneWithNewSeismogram(removeTrend(sdd.seismogram));
        orgDisp.seisData.push(dispSDD);
      } else {
        orgDisp.seisData.push(sdd);
      }
      // trigger redraw if new channel, but not for simple append.
      orgDisp.seisDataUpdated();
    }

  };

  //animationScaler.animate();
  return {
    rawSeisData: rawSeisData,
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
