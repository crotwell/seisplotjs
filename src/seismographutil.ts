import { LuxonTimeScale } from "./axisutil";
import { SeismogramSegment } from "./seismogramsegment";
import { SeismogramDisplayData } from "./seismogram";
import { isDef } from "./util";

import type { ScaleLinear } from "d3-scale";

export const DEFAULT_MAX_SAMPLE_PER_PIXEL = 3;

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
  maxSamplePerPixelForLineDraw = DEFAULT_MAX_SAMPLE_PER_PIXEL,
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
  if (
    xScale.for(seismogram.startTime) > xScale.range[1] ||
    xScale.for(seismogram.endTime) < xScale.range[0]
  ) {
    // seismogram either totally off to left or right of visible
    return;
  }

  seismogram.segments.forEach((segment) => {
    const drawSeg = seismogramSegmentAsLine(
      segment,
      width,
      xScale,
      yScale,
      maxSamplePerPixelForLineDraw
    );

    if (firstTime || !connectSegments) {
      context.beginPath();
      context.strokeStyle = color;
      context.lineWidth = lineWidth;
      context.moveTo(
        drawSeg.x[0],
        drawSeg.y[0],
      );
      firstTime = false;
    }
    for (let i = 0; i < drawSeg.x.length; i++) {
      context.lineTo(drawSeg.x[i], drawSeg.y[i]);
    }

    if (!connectSegments) {
      context.stroke();
    }
  });
  if ( ! firstTime && connectSegments) {
    // only need final stroke if not already connecting
    context.stroke();
  }
}

export type XYLine = {
  x: Array<number>,
  y: Array<number>,
  samplesPerPixel: number,
};

export function seismogramSegmentAsLine(
  segment: SeismogramSegment,
  width: number,
  xScale: LuxonTimeScale,
  yScale: ScaleLinear<number, number, never>,
  maxSamplePerPixelForLineDraw = 20
): XYLine {
  const out: XYLine =  {
    x: [],
    y: [],
    samplesPerPixel: 0,
  };
  if (!segment) { return out; }

  const s = xScale.domain().start?.valueOf();
  const e = xScale.domain().end?.valueOf();
  if (s == null || e == null) {
    throw new Error(`Bad xscale domain: ${String(xScale.domain())}`);
  }
  let horizontalPixel: null | number = null;
  if (
    xScale.for(segment.startTime) > xScale.range[1] ||
    xScale.for(segment.endTime) < xScale.range[0]
  ) {
    // segment either totally off to left or right of visible
    return out;
  }
  const secondsPerPixel =
    (e - s) /
    1000 /
    (xScale.range[1] - xScale.range[0]);
  const samplesPerPixel = 1.0 * segment.sampleRate * secondsPerPixel;
out.samplesPerPixel = samplesPerPixel;

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

  horizontalPixel = yScale(segment.y[leftVisibleSample]);
  out.x.push(leftVisiblePixel);
  out.y.push(horizontalPixel);

  if ( samplesPerPixel <= maxSamplePerPixelForLineDraw) {
    // draw all samples
    for (
      let i = leftVisibleSample;
      i < rightVisibleSample + 2 && i < segment.y.length;
      i++
    ) {
      out.x.push(startPixel + i * pixelsPerSample);
      out.y.push(Math.round(yScale(segment.y[i])));
    }
  } else {
    // draw min-max
    // this tends to be better even with as few as 3 point per pixel,
    // especially in near horizontal line
    let i = leftVisibleSample;
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
      const botPixelFlt = yScale(min); // so botPixelFlt>topPixelFlt
      const botPixel = Math.round(botPixelFlt);
      const topPixel = Math.round(topPixelFlt);
      if (topPixel === botPixel) {
        // horizontal
        if (horizontalPixel === topPixel) {
          // and previous was also same horizontal, keep going to draw one
          // longer horizontal line
          continue;
        } else {
          console.log(` same pixel: c:${curPixel} ${topPixel} ${botPixel}  h: ${horizontalPixel}`);
          if (horizontalPixel !== null) {
            const y = horizontalPixel as number; // typescript
            console.log(`lineTo(${curPixel}, ${y})`)

            out.x.push(curPixel);
            out.y.push(y);
          }
          horizontalPixel = topPixel;
        }
      } else {
        console.log(`not same pixel: c:${curPixel} ${topPixel} ${botPixel}  h: ${horizontalPixel}`);
        // drawing min to max vs max to min depending on order
        // and offseting by half a pixel
        // helps a lot with avoiding fuzziness due to antialiasing
        if (horizontalPixel !== null) {
          const y = horizontalPixel as number; // typescript
          out.x.push(curPixel);
          out.y.push(y);
          horizontalPixel = null;
        }
        if (minIdx < maxIdx) {
          // min/bot occurs before max/top
          console.log(`lineTo(${curPixel}, ${botPixel})`)
          out.x.push(curPixel);
          out.y.push(botPixel);
          console.log(`lineTo(${curPixel}, ${topPixel})`)
          out.x.push(curPixel);
          out.y.push(topPixel);
        } else {
          // max/top occurs before min/bot
          console.log(`lineTo(${curPixel}, ${topPixel})`)
          out.x.push(curPixel);
          out.y.push(topPixel);
          console.log(`lineTo(${curPixel}, ${botPixel})`)
          out.x.push(curPixel);
          out.y.push(botPixel);
        }
      }
    }
    if (horizontalPixel !== null) {
      // in case end of segment is horizontal line we did not finish drawing
      const curPixel = Math.floor(startPixel + (rightVisibleSample+1) * pixelsPerSample);
      const y = horizontalPixel as number; // typescript
      out.x.push(curPixel);
      out.y.push(y);
      console.log(`lineTo(${curPixel}, ${y})`)
      horizontalPixel = null;
    }

  }
  return out;
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
