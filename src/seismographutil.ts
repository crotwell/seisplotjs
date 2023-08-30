import { LuxonTimeScale } from "./axisutil";
import { SeismogramDisplayData } from "./seismogram";
import { SeismogramSegment } from "./seismogramsegment";


import type { ScaleLinear } from "d3-scale";

export function drawAllOnCanvas(
  canvas: HTMLCanvasElement,
  sddList: Array<SeismogramDisplayData>,
  xScaleList: Array<LuxonTimeScale>,
  yScaleList: Array<ScaleLinear<number, number, never>>,
  colornameList: Array<string>,
  lineWidth = 1,
  connectSegments = false,
  maxSamplePerPixelForLineDraw = 20,
): void {

  const context = canvas.getContext("2d");
  if (!context) { return; }
  // clear the canvas from previous drawing
  context.clearRect(0, 0, canvas.width, canvas.height);

  sddList.forEach((sdd, i) => {
    const colorRGBA = rgbaForColorName(colornameList[i]);
    const xScale = xScaleList[i];
    const yScale = yScaleList[i];
    const s = xScale.domain().start?.valueOf();
    const e = xScale.domain().end?.valueOf();
    if (s == null || e == null || s === e) {
      return;
    } else {
      const seismogram = sdd.seismogram;
      if (!seismogram) { return; }
      const secondsPerPixel = (e - s) / 1000 / (xScale.range[1] - xScale.range[0]);
      const samplesPerPixel = 1.0 * seismogram.sampleRate * secondsPerPixel;
      //const drawStyle = (samplesPerPixel > maxSamplePerPixelForLineDraw) ? "image" : "all";
      //window.performance.mark("startdraw");
      //for (let n = 0; n < 100; n++) {
      if (samplesPerPixel > maxSamplePerPixelForLineDraw) {
        const imgData = context.getImageData(0, 0, canvas.width, canvas.height);
        drawSeismogram(imgData, sdd, xScale, yScale, colorRGBA);
        context.putImageData(imgData, 0, 0);
        if (connectSegments) {
          context.save();
          context.beginPath();
          context.strokeStyle = colornameList[i];
          context.lineWidth = lineWidth;
          drawConnectSegments(sdd, context, canvas.width, xScale, yScale);
          context.stroke();
          context.restore();
        }
      } else {
        context.save();
        drawSeismogramAsLine(sdd, context, canvas.width, xScale, yScale, colornameList[i],
          lineWidth, connectSegments);
        context.restore();
      }
      //}
      //const perfTime = window.performance.measure("drawtime", "startdraw");
      //console.log(`draw time: ${perfTime.duration}  for ${drawStyle}`)
    }
  });
}

export function drawSeismogram(
  imgData: ImageData,
  sdd: SeismogramDisplayData,
  xScale: LuxonTimeScale,
  yScale: ScaleLinear<number, number, never>,
  colorRGBA: Uint8ClampedArray) {

  sdd.segments.forEach(seg => {
    drawSegment(imgData, seg, xScale, yScale, colorRGBA);
  });
}

export function drawSegment(
  imgData: ImageData,
  segment: SeismogramSegment,
  xScale: LuxonTimeScale,
  yScale: ScaleLinear<number, number, never>,
  colorRGBA: Uint8ClampedArray) {
  if (
    xScale.for(segment.startTime) > xScale.range[1] ||
    xScale.for(segment.endTime) < xScale.range[0]
  ) {
    // segment either totally off to left or right of visible
    return;
  }
  const s = xScale.domain().start?.valueOf();
  const e = xScale.domain().end?.valueOf();
  if (s == null || e == null) {
    throw new Error(`Bad xscale domain: ${String(xScale.domain())}`);
  }
  if (s === e) {
    // zero time width, nothing to do
    return;
  }
  const secondsPerPixel =
    (e - s) /
    1000 /
    (xScale.range[1] - xScale.range[0]);
  const samplesPerPixel = 1.0 * segment.sampleRate * secondsPerPixel;

  if (!(Number.isFinite(secondsPerPixel) && Number.isFinite(samplesPerPixel))) {
    throw new Error(`spp: ${secondsPerPixel}  spp: ${samplesPerPixel}`);
  }

  if ((secondsPerPixel === 0 || samplesPerPixel === 0)) {
    throw new Error(`zero spp: ${secondsPerPixel}  sampp: ${samplesPerPixel}`);
  }
  const pixelsPerSample = 1.0 / samplesPerPixel;
  const startPixel = xScale.for(segment.startTime);
  const endPixel = xScale.for(segment.endTime);
  let leftVisibleSample = 0;
  let rightVisibleSample = segment.y.length;

  if (startPixel < 0) {
    leftVisibleSample =
      Math.floor(-1 * startPixel * samplesPerPixel) - 1;
  }

  if (endPixel > xScale.range[1] + 1) {
    rightVisibleSample =
      leftVisibleSample +
      Math.ceil((imgData.width + 1) * samplesPerPixel) +
      1;
  }

  let i = leftVisibleSample;
  let prevTopPixel: null | number = null;
  let prevBotPixel: null | number = null;
  while (i < rightVisibleSample + 2 && i < segment.y.length) {
    const curPixel = Math.floor(startPixel + i * pixelsPerSample);
    if (curPixel > imgData.width) { break; }
    if (curPixel < 0) { i++; continue; }

    let min = segment.y[i];
    let max = segment.y[i];
    while (i < segment.y.length && curPixel === Math.floor(startPixel + i * pixelsPerSample)) {
      if (min > segment.y[i]) { min = segment.y[i]; }
      if (max < segment.y[i]) { max = segment.y[i]; }
      i++;
    }
    const topPixelFlt = yScale(max); // note pixel coord flipped
    const botPixelFlt = yScale(min); // so minValue=>maxPixel, maxValue=>minPixel
    const botPixel = Math.min(imgData.height - 1, Math.floor(botPixelFlt));
    const topPixel = Math.max(0, Math.ceil(topPixelFlt));

    pixelColumn(imgData, curPixel, botPixel, topPixel, colorRGBA);
    // in case prev column of pixels is offset from current, need to connect
    if (prevTopPixel != null && prevTopPixel > botPixel + 1) {
      const halfPixel = Math.round((prevTopPixel + botPixel) / 2);
      pixelColumn(imgData, curPixel - 1, prevTopPixel, halfPixel, colorRGBA);
      pixelColumn(imgData, curPixel, halfPixel - 1, botPixel, colorRGBA);
    }
    if (prevBotPixel !== null && prevBotPixel < topPixel - 1) {
      const halfPixel = Math.round((prevBotPixel + topPixel) / 2);
      pixelColumn(imgData, curPixel - 1, halfPixel - 1, prevBotPixel, colorRGBA);
      pixelColumn(imgData, curPixel, topPixel, halfPixel, colorRGBA);
    }

    prevTopPixel = topPixel;
    prevBotPixel = botPixel;
  }
}

export function pixelColumn(imgData: ImageData, xPixel: number, bot: number, top: number, colorRGBA: Uint8ClampedArray) {
  // top < bot in image space
  for (let p = top; p <= bot; p++) {
    const offset = 4 * (p * imgData.width + xPixel);
    imgData.data.set(colorRGBA, offset);
  }
}

export function drawSeismogramAsLine(
  sdd: SeismogramDisplayData,
  context: CanvasRenderingContext2D,
  width: number,
  xScale: LuxonTimeScale,
  yScale: ScaleLinear<number, number, never>,
  color: string,
  lineWidth: number = 1,
  connectSegments = false,
): void {
  const seismogram = sdd.seismogram;
  if (!seismogram) { return; }
  let firstTime = true;
  seismogram.segments.forEach((segment, segIdx) => {
    if (
      xScale.for(segment.startTime) > xScale.range[1] ||
      xScale.for(segment.endTime) < xScale.range[0]
    ) {
      // segment either totally off to left or right of visible
      return;
    }
    const s = xScale.domain().start?.valueOf();
    const e = xScale.domain().end?.valueOf();
    if (s == null || e == null) {
      throw new Error(`Bad xscale domain: ${String(xScale.domain())}`);
    }
    const secondsPerPixel =
      (e - s) /
      1000 /
      (xScale.range[1] - xScale.range[0]);

    const samplesPerPixel = 1.0 * segment.sampleRate * secondsPerPixel;

    const pixelsPerSample = 1.0 / samplesPerPixel;
    const startPixel = xScale.for(segment.startTime);
    const endPixel = xScale.for(segment.endTime);
    let leftVisibleSample = 0;
    let rightVisibleSample = segment.y.length;
    let leftVisiblePixel = startPixel;

    if (startPixel < 0) {
      leftVisibleSample =
        Math.floor(-1 * startPixel * samplesPerPixel) - 1;
      leftVisiblePixel = 0;
    }

    if (endPixel > xScale.range[1] + 1) {
      rightVisibleSample =
        leftVisibleSample +
        Math.ceil((width + 1) * samplesPerPixel) +
        1;
    }

    if (firstTime || !connectSegments) {
      context.beginPath();
      context.strokeStyle = color;
      context.lineWidth = lineWidth;
      context.moveTo(
        leftVisiblePixel,
        yScale(segment.y[leftVisibleSample]),
      );
      firstTime = false;
    }
    // draw all samples
    for (
      let i = leftVisibleSample;
      i < rightVisibleSample + 2 && i < segment.y.length;
      i++
    ) {
      context.lineTo(
        startPixel + i * pixelsPerSample + 0.5,
        Math.round(yScale(segment.y[i])) + 0.5,
      );
    }


    if (!connectSegments) {
      context.stroke();
    }
  });
  context.stroke();
}

export function drawConnectSegments(
  sdd: SeismogramDisplayData,
  context: CanvasRenderingContext2D,
  width: number,
  xScale: LuxonTimeScale,
  yScale: ScaleLinear<number, number, never>,) {
  let prev: SeismogramSegment | null = null;
  sdd.seismogram?.segments.forEach((seg, idx) => {
    if (prev !== null) {
      context.lineTo(xScale.for(seg.startTime), yScale(seg.y[0]));
    }
    context.moveTo(xScale.for(seg.endTime), yScale(seg.y[seg.y.length - 1]));
    prev = seg;
  });
}

export function rgbaForColorName(name: string): Uint8ClampedArray {
  const out = new Uint8ClampedArray(4);
  const ctx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
  if (!ctx) { return out; }
  ctx.fillStyle = name;
  const color_rgb = ctx.fillStyle.substring(1); // form of #87ceeb, chop the #

  out[0] = Number.parseInt(`0x${color_rgb.substring(0, 2)}`, 16);
  out[1] = Number.parseInt(`0x${color_rgb.substring(2, 4)}`, 16);
  out[2] = Number.parseInt(`0x${color_rgb.substring(4, 6)}`, 16);
  out[3] = 255;
  return out;
}
