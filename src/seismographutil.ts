import { LuxonTimeScale } from "./axisutil";
import { SeismogramDisplayData } from "./seismogram";
import { isDef } from "./util";

import type { ScaleLinear } from "d3-scale";

export function clearCanvas(canvas: HTMLCanvasElement) {
  // clear the canvas from previous drawing
  canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
}

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

  if (canvas.height === 0) { return;}
  const context = canvas.getContext("2d") as CanvasRenderingContext2D;
  if (!isDef(context)) {// for typescript
    throw new Error("canvas 2d context is null, should not happen...");
  }

  sddList.forEach((sdd, i) => {
    const xScale = xScaleList[i];
    const yScale = yScaleList[i];
    const s = xScale.domain().start?.valueOf();
    const e = xScale.domain().end?.valueOf();
    if (s == null || e == null || s === e) {
      return;
    } else {
      const seismogram = sdd.seismogram;
      if (!seismogram) { return; }

        context.save();
        drawSeismogramAsLine(sdd, context, canvas.width, xScale, yScale, colornameList[i],
          lineWidth, connectSegments, maxSamplePerPixelForLineDraw);
        context.restore();
    }
  });

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
  maxSamplePerPixelForLineDraw = 20
): void {
  const seismogram = sdd.seismogram;
  if (!seismogram) { return; }
  let firstTime = true;

  const s = xScale.domain().start?.valueOf();
  const e = xScale.domain().end?.valueOf();
  if (s == null || e == null) {
    throw new Error(`Bad xscale domain: ${String(xScale.domain())}`);
  }
  seismogram.segments.forEach((segment) => {
    if (
      xScale.for(segment.startTime) > xScale.range[1] ||
      xScale.for(segment.endTime) < xScale.range[0]
    ) {
      // segment either totally off to left or right of visible
      return;
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
    if (samplesPerPixel <= maxSamplePerPixelForLineDraw) {
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
    } else {
      // draw min-max
      let i = leftVisibleSample;
      let horizontalPixel: null | number = null;
      while (i < rightVisibleSample + 2 && i < segment.y.length) {
        const curPixel = Math.floor(startPixel + i * pixelsPerSample);
        let min = segment.y[i];
        let max = segment.y[i];
        let minIdx = i;
        let maxIdx = i;
        while (curPixel === Math.floor(startPixel + i * pixelsPerSample)) {
          if (min > segment.y[i]) { min = segment.y[i]; minIdx = i; }
          if (max < segment.y[i]) { max = segment.y[i]; maxIdx = i; }
          i++;
        }
        const topPixelFlt = yScale(max); // note pixel coord flipped
        const botPixelFlt = yScale(min); // so minValue=>maxPixel, maxValue=>minPixel
        const botPixel = Math.floor(botPixelFlt);
        const topPixel = Math.ceil(topPixelFlt);
        if (topPixel === botPixel) {
          // horizontal
          if (horizontalPixel === topPixel) {
            // and previous was also same horizontal, keep going to draw one
            // longer horizontal line
            continue;
          } else if (horizontalPixel === null) {
            horizontalPixel = topPixel;
          } else {
            context.lineTo(curPixel, horizontalPixel);
            horizontalPixel = topPixel;
          }
        } else if (botPixelFlt-topPixelFlt < 1.25) {
          // very horizontal, just draw single
          context.lineTo(curPixel, topPixelFlt);
          horizontalPixel = topPixel;
        } else {
          // drawing min to max vs max to min depending on order
          // and offseting by half a pixel
          // helps a lot with avoiding fuzziness due to antialiasing
          if (horizontalPixel !== null) {
            context.lineTo(curPixel-0.5, horizontalPixel);
            horizontalPixel = null;
          }
          if (minIdx < maxIdx) {
            // min/bot occurs before max/top
            context.lineTo(curPixel-0.5, botPixel-0.5);
            context.lineTo(curPixel+0.5, topPixel+0.5);
          } else {
            // max/top occurs before min/bot
            context.lineTo(curPixel-0.5, topPixel+0.5);
            context.lineTo(curPixel+0.5, botPixel-0.5);
          }
        }
      }
      if (horizontalPixel !== null) {
        // in case end of segment is horizontal line we did not finish drawing
        const curPixel = Math.floor(startPixel + (rightVisibleSample+1) * pixelsPerSample);
        context.lineTo(curPixel-0.5, horizontalPixel);
        horizontalPixel = null;
      }
    }

    if (!connectSegments) {
      context.stroke();
    }
  });
  context.stroke();
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
