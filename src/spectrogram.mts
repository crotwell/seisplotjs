/*
Gavin Bullock
Pacific Northwest Seismic Network, 2026
https://pnsn.org

Code used from: spectrogram-js - Copyright (c) 2025 AnyShake Project
Licensed under the MIT License.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

import { DateTime } from "luxon";
import { SeismogramDisplayData } from "./seismogram.mjs";
import { Seismograph } from "./seismograph.mjs";
import { fftForward } from "./fft.mjs";
import { SeismographConfig, numberFormatWrapper } from "./seismographconfig.mjs";
import { clearCanvas } from "./seismographutil.mjs";
import { util } from "./index_node.mjs";
import type { Axis } from "d3-axis";
import type { NumberValue as d3NumberValue } from "d3-scale";
import {
  axisLeft as d3axisLeft,
  axisRight as d3axisRight,
} from "d3-axis";

// Types of window functions that can be applied to data chunks before performing the FFT
export type WindowFunctionType =
  | "hann"
  | "hamming"
  | "blackman"
  | "rectangular";
// Types of color maps that can be used to display the spectrogram. Each has a function below that maps normalized values to RGB colors
export type ColorMapName =
  | "viridis"
  | "inferno"
  | "grayscale"
  | "jet"
  | "hot"
  | "cool"
  | "spring"
  | "summer"
  | "autumn"
  | "winter"
  | "bone";
export type RGB = [number, number, number];

const SPECTROGRAM_ELEMENT = "sp-spectrogram";

export class SpectrogramConfig extends SeismographConfig {
  // The number of points used to compute the FFT, determining the number of frequency bins in the spectrogram
  fftSize: number = 256;
  // The number of samples extracted for each distinct time frame. Must be <= fftSize
  windowSize: number = 256;
  // How much to overlap each FFT frame (as a fraction of the windowSize). A higher overlap results in smoother spectrograms, but
  // increases computation time
  overlapPerc: number = 0.86;
  // Minimum time window for each spectrogram slice in seconds - ideally, resulting chunk times will be near this value. A higher
  // value results in bigger chunks and better performance, but may result in a less smooth spectrogram
  minChunkTime: number = 10;
  // Type of window function to apply
  windowType: WindowFunctionType = "hann";
  // Frequency range for the spectrogram display in Hz - always constrained to not exceed the Nyquist frequency (sampleRate / 2)
  freqMin: number = 0;
  freqMax: number = 15;
  // Function to format frequency values for display on the y-axis. Default is to format with 1 decimal place
  frequencyFormat: (val: number) => string = (val) => val.toFixed(1);
  // Lower and upper bounds for spectrogram color scaling in decibels. FFT power values below minDb are shown as the darkest
  // color, and values above maxDb are shown as the brightest color.
  minDb: number = 30;
  maxDb: number = 120;
  // Color map for spectrogram display
  spectrogramColorMap: ColorMapName = "jet";

  constructor() {
    super();
    // Set new defaults for SeismographConfig fields
    this.yLabel = "Frequency";
  }
}

// Overriding Seismograph to allow for shared functionality with Seismograph, only altered for the different rendering
export class Spectrogram extends Seismograph {
  spectrogramConfig: SpectrogramConfig;
  canvasRenderer: CanvasRenderer;

  constructor(seisData?: SeismogramDisplayData | SeismogramDisplayData[], seisConfig?: SpectrogramConfig) {
    super(seisData, seisConfig);
    this.spectrogramConfig = seisConfig || new SpectrogramConfig();
    this.canvasRenderer = new CanvasRenderer(
      this.canvas?.node() as HTMLCanvasElement,
      this.spectrogramConfig.windowSize,
    );
  }

  override drawSeismograms() {
    if (!this.isVisible()) {
      // no need to draw if we are not visible
      return;
    }
    // Clear the canvas before drawing, making sure the canvasRenderer is set to the current canvas
    const canvas = this.canvas?.node();
    if (!canvas)
      return;
    clearCanvas(canvas);
    this.canvasRenderer.setCanvas(canvas);

    // Draw a separate SpectrogramModel for each SeismogramDisplayData in the list to adjust for different sample rates and start times
    this._seisDataList.forEach((sdd) => {
      // Get the time range for the view of the spectrogram and validate
      const xScale = this.timeScaleForSeisDisplayData(sdd, true);
      const domainStart = xScale.domain().start?.valueOf();
      const domainEnd = xScale.domain().end?.valueOf();
      if (domainStart == null || domainEnd == null || domainStart === domainEnd) {
        return;
      }

      // Get seismogram and sampleRate, and validate
      const seismogram = sdd.seismogram;
      if (!seismogram)
        return;
      const dataSampleRate = seismogram.sampleRate;
      if (dataSampleRate == null)
        return;

      // Convert the domain start and end times to seconds from epoch, and get the full seismogram data and start time in seconds
      const viewStartTime = domainStart / 1000;
      const viewEndTime = domainEnd / 1000;
      const fullSeisData = new Float32Array(seismogram.y);
      const seismogramStartSec = seismogram.startTime.valueOf() / 1000;

      // Render the spectrogram to the canvas, using our calculated view start and end times to calculate where each chunk should be
      // drawn. We use catch because the rendering is async and we don't want to block the main thread
      this.canvasRenderer.render(
        fullSeisData,
        this.spectrogramConfig,
        dataSampleRate,
        seismogramStartSec,
        viewStartTime,
        viewEndTime
      ).catch((err) => {
        util.warn(`Error rendering spectrogram: ${err.message}`);
        return;
      });
    });
  }

  // We need to override the normal axis creation to be frequencies instead of amplitudes, and to constrain the frequency
  // range to the Nyquist frequency
  override createLeftRightAxis(): Array<Axis<d3NumberValue> | null> {
    let yAxis = null;
    let yAxisRight = null;

    // Constrain the y-coordinates to be within the safe frequency range
    const sampleRate = this.seisData.reduce(
      (acc, curr) => Math.min(curr.seismogram?.sampleRate || Infinity, acc),
      Infinity
    );
    const nyquist = sampleRate !== Infinity ? sampleRate / 2 : 0;
    const safeFMax = Math.min(this.spectrogramConfig.freqMax, nyquist);
    const safeFMin = Math.max(this.spectrogramConfig.freqMin, 0);
    // We can use __initAmpScale because it initializes the scale range to the height of the plot - then we just need to set
    // the domain to the safe frequency range
    const axisScale = this.__initAmpScale().domain([safeFMin, safeFMax]);

    // Create the left and right axes just like the normal Seismograph, but with frequency formatting instead of amplitude formatting
    if (this.spectrogramConfig.isYAxis) {
      yAxis = d3axisLeft(axisScale).tickFormat(
        numberFormatWrapper(this.spectrogramConfig.frequencyFormat),
      );
      yAxis.scale(axisScale);
      yAxis.ticks(this.spectrogramConfig.yAxisNumTickHint, this.spectrogramConfig.frequencyFormat);
    }
    if (this.spectrogramConfig.isYAxisRight) {
      yAxisRight = d3axisRight(axisScale).tickFormat(
        numberFormatWrapper(this.spectrogramConfig.frequencyFormat),
      );
      yAxisRight.scale(axisScale);
      yAxisRight.ticks(this.spectrogramConfig.yAxisNumTickHint, this.spectrogramConfig.frequencyFormat);
    }
    return [yAxis, yAxisRight];
  }

  override createUnitsLabel() {
    // Spectrograms are always in Hz, so we override the units label to return "Hz" if the ySublabelIsUnits flag is set
    if (this.spectrogramConfig && this.spectrogramConfig.ySublabelIsUnits) {
      return "Hz";
    }
    return "";
  }

  override seisDataUpdated() {
    // Invalidate the cache when the data is updated, so that new chunks will be generated for the new data
    this.canvasRenderer.clearCache();
    super.seisDataUpdated();
  }
}
customElements.define(SPECTROGRAM_ELEMENT, Spectrogram);

// Renderer for drawing the spectrogram on a canvas. This class handles the processing of data into spectrogram chunks and
// managing the caching of processed chunks for performance optimization
class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private windowSize: number;

  // Cache of processed data chunks, keyed by a unique identifier for each chunk. This allows for reusing previously processed chunks
  private chunksCache: Map<string, DataChunk> = new Map();

  constructor(canvas: HTMLCanvasElement, canvasSize: number) {
    this.canvas = canvas;
    this.windowSize = canvasSize;
  }

  /**
   * Clears the cache of processed data chunks, forcing new chunks to be generated on the next render
   */
  clearCache() {
    this.chunksCache.clear();
  }

  /**
   * Sets the canvas element to render the spectrogram onto. This method should be called before calling render()
   * @param canvas The HTMLCanvasElement to render the spectrogram onto
   */
  setCanvas(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  /**
   * Renders the spectrogram data onto the set canvas according to the provided configuration and view range. This method processes the data into chunks
   * and creates a spectrogram image for each chunk, which is then drawn onto the canvas
   * @param data The seismic data to render as a spectrogram
   * @param config The configuration settings for the spectrogram rendering
   * @param sampleRate The sample rate of the seismic data in Hz
   * @param dataStartTime The start time of the seismic data in seconds from epoch
   * @param viewStartTime The start time of the view range in seconds from epoch
   * @param viewEndTime The end time of the view range in seconds from epoch
   * @returns A promise resolving when rendering is complete
   */
  async render(data: Float32Array, config: SpectrogramConfig, sampleRate: number, dataStartTime: number, viewStartTime: number, viewEndTime: number) {
    this.ctx = this.canvas.getContext("2d", { alpha: true })!;
    const processor = new ChunkProcessor(
      config,
      sampleRate,
      this.windowSize,
    );
    if (!this.ctx || !data || !data.length || viewStartTime >= viewEndTime) {
      return;
    }

    // Get time and frequency range from model
    const dataEndTime = dataStartTime + data.length / sampleRate;
    const fMin = config.freqMin;
    const fMax = config.freqMax;

    const colorMap = new ColorMap(config.spectrogramColorMap);

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Calculates how big each chunk should be according to the desired time range and overlap
    const overlap = Math.floor(config.overlapPerc * this.windowSize);
    const hopSize = Math.max(1, this.windowSize - overlap);

    // Calculates the number of samples to include in each chunk based on the desired minimum chunk
    // time. A minimum chunk time is often used for performance reasons
    const targetSamples = config.minChunkTime * sampleRate;
    const hopsPerChunk = Math.ceil(targetSamples / hopSize);
    const chunkSamples = hopsPerChunk * hopSize;

    // Calculates where the data starts and ends relative to the start of the view range while
    // respecting the view boundaries
    const overlapStartAbs = Math.max(viewStartTime, dataStartTime);
    const overlapEndAbs = Math.min(viewEndTime, dataEndTime);
    if (overlapEndAbs <= overlapStartAbs)
      return;
    const dataRelStartIdx = Math.floor((overlapStartAbs - dataStartTime) * sampleRate);
    const dataRelEndIdx = Math.ceil((overlapEndAbs - dataStartTime) * sampleRate);

    // Only render the chunks that have data
    const startChunkId = Math.floor(dataRelStartIdx / chunkSamples);
    const endChunkId = Math.floor((dataRelEndIdx - 1) / chunkSamples);

    for (let i = startChunkId; i <= endChunkId; i++) {
      let chunkStart = i * chunkSamples;
      let chunkEnd = (i + 1) * chunkSamples;
      let chunkId = `chunk_${i}`;

      // If the chunk is only partially filled with data, it is a special chunk and should not be stored in
      // the cache in the same way as a regular chunk
      if (chunkStart < dataRelStartIdx || chunkEnd > dataRelEndIdx) {
        chunkStart = Math.max(chunkStart, dataRelStartIdx);
        chunkEnd = Math.min(chunkEnd, dataRelEndIdx);
        chunkId = `chunk_${chunkStart}_${chunkEnd}`;
      }

      let chunk = this.chunksCache.get(chunkId);
      if (!chunk) {
        const newChunk = new DataChunk(
          chunkId,
          chunkStart,
          chunkEnd,
          sampleRate,
        );
        this.chunksCache.set(chunkId, newChunk);

        // Convert the processed data to an image
        const imgData = processor.process(
          data,
          chunkStart,
          chunkEnd,
          config,
          (val: number) => colorMap.getRGB(val),
        );

        // Store the created image into the chunk so it can be reused
        const bmp = await createImageBitmap(imgData);
        newChunk.image = bmp;

        chunk = newChunk;
      }

      if (chunk.image && this.ctx) {
        // Fills any unused part of the canvas with background
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.clip();

        this.drawChunk(
          chunk,
          sampleRate,
          dataStartTime,
          viewStartTime,
          viewEndTime,
          fMin,
          fMax
        );

        this.ctx.restore();
      }
    }
  }

  /**
   * Draws a chunk of spectrogram within the view range
   * @param chunk DataChunk instance to draw
   * @param sampleRate Sample rate of the seismic data in Hz
   * @param startTime Start time of the seismic data in seconds from epoch
   * @param viewStartTime Start time of the view range in seconds from epoch
   * @param viewEndTime End time of the view range in seconds from epoch
   * @param fMin Minimum frequency to display in Hz
   * @param fMax Maximum frequency to display in Hz
   */
  private drawChunk(
    chunk: DataChunk,
    sampleRate: number,
    startTime: number,
    viewStartTime: number,
    viewEndTime: number,
    fMin: number,
    fMax: number,
  ) {
    if (!chunk.image) {
      return;
    }

    const viewDuration = viewEndTime - viewStartTime;
    const nyquist = sampleRate / 2;

    const chunkStartTime = startTime + chunk.startTime;
    const chunkEndTime = startTime + chunk.endTime;

    // Calculate the x-coordinates for the chunk within the plot area
    const plotW = this.canvas.width;
    const x1 = ((chunkStartTime - viewStartTime) / viewDuration) * plotW;
    const x2 = ((chunkEndTime - viewStartTime) / viewDuration) * plotW;

    if (x2 <= 0 || x1 >= plotW)
      return;

    // Constrain the x-coordinates to the plot area
    const chunkX = Math.max(0, x1);
    const chunkW = Math.min(plotW, x2) - chunkX;

    // If the x-coordinates don't fill the entire chunk area, draw only the portion that does
    const texW = chunk.image.width;
    const drawStartX = ((chunkX - x1) / (x2 - x1)) * texW;
    const drawWidth = (chunkW / (x2 - x1)) * texW;

    // Constrain the y-coordinates to be within the safe frequency range
    const safeFMax = Math.min(fMax, nyquist);
    const safeFMin = Math.max(fMin, 0);

    // If the y-coordinates don't fill the entire frequency range, draw only the portion that does
    const texH = chunk.image.height;
    const drawStartY = (1 - safeFMax / nyquist) * texH;
    const drawEndY = (1 - safeFMin / nyquist) * texH;
    const drawHeight = drawEndY - drawStartY;

    if (this.ctx && drawHeight > 0) {
      this.ctx.drawImage(
        chunk.image,
        drawStartX,
        drawStartY,
        drawWidth,
        drawHeight,
        chunkX,
        0,
        chunkW,
        this.canvas.height
      );
    }
  }
}

// Glorified interface for storing information about a chunk of data to be processed into a spectrogram image. This class is used to cache the processed
// images for performance optimization
export class DataChunk {
  public id: string;
  public startTime: number;
  public endTime: number;
  public startIndex: number;
  public endIndex: number;

  public image: ImageBitmap | null = null;
  public isProcessing: boolean = false;

  constructor(
    id: string,
    startIdx: number,
    endIdx: number,
    sampleRate: number,
  ) {
    this.id = id;
    this.startIndex = startIdx;
    this.endIndex = endIdx;
    // Convert the start and end indices to times in seconds from epoch based on the sample rate for convenience when drawing the chunk on the canvas
    this.startTime = startIdx / sampleRate;
    this.endTime = endIdx / sampleRate;
  }
}

export class ChunkProcessor {
  private windowBuffer: Float32Array;
  private inputBuf: Float32Array;
  private fftSize: number;
  private sampleRate: number;

  constructor(
    config: SpectrogramConfig,
    sampleRate: number,
    windowSize: number,
  ) {
    this.fftSize = config.fftSize;
    // Used to apply a window function to each data chunk before performing the FFT - helps reduce spectral leakage in the FFT output
    this.windowBuffer = createWindow(windowSize, config.windowType);
    this.inputBuf = new Float32Array(this.fftSize);
    this.sampleRate = sampleRate;
  }

  /**
   * Processes the seismic data to create a spectrogram using fftForward, the given colormap, and
   * index offsets for the input data.
   * @param data The seismic data to process
   * @param startIdx The starting index of the data to start the chunk at
   * @param endIdx The ending index of the data to end the chunk at
   * @param config The spectrogram configuration
   * @param colormapToRgb The function to convert normalized values to RGB colors
   * @returns The processed spectrogram image data
   */
  process(
    data: Float32Array,
    startIdx: number,
    endIdx: number,
    config: SpectrogramConfig,
    colormapToRgb: (normalizedVal: number) => [number, number, number],
  ): ImageData {
    // Calculate the hop size based on the number of unique samples in one window
    const { minDb, maxDb, overlapPerc } = config;
    const windowSize = this.windowBuffer.length;
    const overlap = Math.floor(overlapPerc * windowSize);
    const hopSize = Math.max(1, windowSize - overlap);

    // Divide the data into these hops to get the image width because each hop represents a column in the
    // spectrogram
    const numHops = Math.ceil((endIdx - startIdx) / hopSize);
    const width = numHops;
    // The FFT output is symmetric, so we only need to take half of the FFT size for the DC component
    const height = (this.fftSize >> 1) + 1;

    if (width <= 0)
      return new ImageData(1, 1);

    const imgData = new ImageData(width, height);
    const pixels = imgData.data;
    const inputBuf = this.inputBuf;
    const windowBuf = this.windowBuffer;

    // Calculate the sum of the data in the first window for calculating the mean, which will help us remove any
    // DC offset before performing the FFT. This will be a rolling sum updated per frame to keep the DC average
    // accurate. This helps to center the data around zero and improves the accuracy of the FFT output
    let dcSum = 0;
    let validCount = 0;
    for (let i = 0; i < windowSize; i++) {
      const idx = startIdx + i;
      if (idx >= 0 && idx < data.length) {
        dcSum += data[idx]!;
        validCount++;
      }
    }

    // Loop through each hop and perform the FFT on the windowed data, then map the FFT output to RGB colors for the spectrogram
    for (let x = 0; x < width; x++) {
      // Create the input buffer for the FFT by applying the window function to the data in the current hop, and removing the DC offset
      const signalStart = startIdx + x * hopSize;
      const mean = validCount > 0 ? dcSum / validCount : 0;
      let i = 0;
      const currWindowSize = Math.min(windowSize, data.length - signalStart);
      for (; i < currWindowSize; i++) {
        // Check if the index is within the bounds of the data array and the window size
        if (
          signalStart + i < data.length &&
          signalStart + i >= 0 &&
          i >= 0 &&
          i < windowSize
        ) {
          // If valid, apply the window function and remove the DC offset from the data point
          inputBuf[i] = (data[signalStart + i]! - mean) * windowBuf[i]!;
        }
      }
      // If the current window size is smaller than the FFT size, fill the remaining input buffer with zeros to smooth the
      // FFT output. Since the FFT size is often a power of two, this can also speed up computation
      for (; i < this.fftSize; i++) {
        inputBuf[i] = 0;
      }

      // Execute the FFT on the windowed input buffer and get the magnitude spectrum, which will be used to create the spectrogram
      const fft = new FFTExecutor(this.fftSize);
      // Magnitude spectrum, consisting of magnitude values for each frequency bin. The values are normalized between 0 and 1 based on
      // the minDb and maxDb configuration settings. These values will be mapped to RGB colors for the spectrogram
      const mags = fft.compute(inputBuf, this.sampleRate, minDb, maxDb);

      // Map the magnitude spectrum to RGB colors for the spectrogram image, and fill in the pixel data for the current column in the image
      for (let y = 0; y < height; y++) {
        if (y < 0 || y >= mags.length) {
          // Index is out of bounds for magnitude array
          break;
        }
        // Convert the normalized frequency value to an RGB color using the provided colormap function
        const rgb = colormapToRgb(mags[y]!);
        // The y-coordinate is inverted because the canvas origin is at the top-left corner, so we need to flip the y-axis to match
        // the spectrogram orientation
        const row = height - 1 - y;
        // Convert the 2D pixel coordinates to a 1D index in the ImageData array, which is in RGBA format (4 bytes per pixel)
        const idx = (row * width + x) * 4;
        pixels[idx] = rgb[0];
        pixels[idx + 1] = rgb[1];
        pixels[idx + 2] = rgb[2];
        // No need for alpha, so set to opaque
        pixels[idx + 3] = 255;
      }

      // Remove the data points that are no longer in the window from the DC sum and add the new data points that are now in the
      // window to the DC sum. This keeps the DC average accurate for each hop
      if (x + 1 < width) {
        // Remove the data points that are no longer in the window from the DC sum and valid count
        for (let k = 0; k < hopSize; k++) {
          const outIdx = signalStart + k;
          if (outIdx >= 0 && outIdx < data.length) {
            dcSum -= data[outIdx]!;
            validCount--;
          }
        }

        // Add the new data points that are now in the window to the DC sum and valid count
        const nextStart = signalStart + windowSize;
        for (let k = 0; k < hopSize; k++) {
          const inIdx = nextStart + k;
          if (inIdx >= 0 && inIdx < data.length) {
            dcSum += data[inIdx]!;
            validCount++;
          }
        }
      }
    }

    return imgData;
  }
}

class FFTExecutor {
  private readonly EPS = 1e-20;
  private readonly INV_LN10 = 1 / Math.LN10;

  private readonly fftSize: number;

  private readonly complexIn: Float32Array;
  private readonly spectrum: Float32Array;

  constructor(fftSize: number) {
    if (fftSize <= 0 || fftSize % 2 !== 0) {
      throw new Error("FFT size must be a positive value and a power of two");
    }

    this.fftSize = fftSize;

    // Complex input array for the FFT, which will hold the interwoven real and imaginary parts of the input signal. The spectrum array, which
    // is the magnitude output of compute(), will hold the magnitude values of the FFT output, which is half the size of the FFT for the DC component
    this.complexIn = new Float32Array(fftSize * 2);
    this.spectrum = new Float32Array(fftSize / 2 + 1);
  }

  /**
   * Computes the FFT of the input signal and returns the magnitude spectrum normalized between 0 and 1 based on the provided minDb and maxDb values
   * @param input Float32Array of length equal to fftSize
   * @param sampleRate Sample rate of the input data, used to calculate the frequency bins for the output spectrum
   * @param minDb Minimum dB value for normalization
   * @param maxDb Maximum dB value for normalization
   * @returns Float32Array of length fftSize / 2 + 1 containing the normalized magnitude spectrum
   */
  compute(
    input: Float32Array,
    sampleRate: number,
    minDb: number,
    maxDb: number,
  ): Float32Array {
    const cin = this.complexIn;

    for (let i = 0; i < this.fftSize; i++) {
      const j = i << 1;
      cin[j] = input[i]!;
      // The imaginary part is set to 0 because the input signal is real-valued. The FFT will compute the complex frequency
      // components, but since the input is real, the imaginary parts are initialized to zero
      cin[j + 1] = 0;
    }

    // We can use 0 for the startTime because we're not interested in the actual time values for the FFT output
    const inputDisplayData =
      SeismogramDisplayData.fromContiguousData(
        cin,
        sampleRate,
        DateTime.fromMillis(0),
      );
    // Perform the actual FFT
    const out: Float32Array = fftForward(inputDisplayData).packedFreq;

    // Convert the FFT output to a magnitude spectrum and normalize it
    for (let i = 0; i < this.spectrum.length; i++) {
      const realComp = out[i];
      let p = 0;
      // Check if valid FFT output values. If so, calculate the power of the frequency bin by squaring the real component and adding a small
      // epsilon to avoid log(0) issues
      if (realComp !== undefined) {
        p = realComp * realComp + this.EPS;
      }

      // Convert the power to decibels and normalize it between 0 and 1 based on the provided minDb and maxDb values
      const v = (10 * Math.log(p) * this.INV_LN10 - minDb) / (maxDb - minDb);
      // Clamp the normalized value to be between 0 and 1 to avoid any out-of-bounds values in the spectrogram display
      this.spectrum[i] = v < 0 ? 0 : v > 1 ? 1 : v;
    }

    return this.spectrum;
  }
}

/**
 * Creates a window function of the specified type and size. Window functions are used to reduce spectral leakage in the FFT by tapering the edges of the data chunk
 * @param size Size of the window array to be outputted
 * @param type Type of window function to create. Can be "hann", "hamming", "blackman", or "rectangular"
 * @returns Float32Array containing the window function values
 */
const createWindow = (size: number, type: WindowFunctionType): Float32Array => {
  const window = new Float32Array(size);

  if (type === "rectangular") {
    return window.fill(1);
  }

  const TWO_PI = 2 * Math.PI;
  const denom = size - 1;

  switch (type) {
    case "hann":
      for (let i = 0; i < size; i++) {
        window[i] = 0.5 * (1 - Math.cos((TWO_PI * i) / denom));
      }
      break;
    case "hamming":
      for (let i = 0; i < size; i++) {
        window[i] = 0.54 - 0.46 * Math.cos((TWO_PI * i) / denom);
      }
      break;
    case "blackman":
      for (let i = 0; i < size; i++) {
        const angle = (TWO_PI * i) / denom;
        window[i] = 0.42 - 0.5 * Math.cos(angle) + 0.08 * Math.cos(2 * angle);
      }
      break;
  }

  return window;
};

// ColorMap class for mapping normalized values to RGB colors based on the selected color map type. Generates a
// lookup table (LUT) for efficient color mapping
export class ColorMap {
  private type: ColorMapName;
  private lut: Uint8Array; // [R, G, B, R, G, B...] for 0..255

  constructor(type: ColorMapName = "jet") {
    this.type = type;
    this.lut = new Uint8Array(256 * 3);
    this.generateLut();
  }

  /**
   * Generates a LUT for the selected color map type
   */
  private generateLut() {
    const fn = COLOR_MAP_FNS[this.type];
    for (let i = 0; i <= 255; i++) {
      const rgb = fn(i / 255);
      const j = i * 3;
      this.lut[j] = rgb[0];
      this.lut[j + 1] = rgb[1];
      this.lut[j + 2] = rgb[2];
    }
  }

  /**
   * Returns the RGB color for a normalized value t (0-1) based on the LUT. If t is out of bounds, returns black
   * @param t Normalized value (0-1) to map to an RGB color
   * @returns RGB color as an array of three numbers [R, G, B] where each component is in the range 0-255
   */
  getRGB(t: number): RGB {
    const idx = (t <= 0 ? 0 : t >= 1 ? 255 : (t * 255) | 0) * 3;
    if (idx < 0 || idx + 2 >= this.lut.length) {
      return [0, 0, 0];
    }
    return [this.lut[idx]!, this.lut[idx + 1]!, this.lut[idx + 2]!];
  }

  /**
   * Sets the color map type and regenerates the lookup table
   * @param type String name of the color map to use. Must be one of the supported color map names
   */
  setMap(type: ColorMapName) {
    this.type = type;
    this.generateLut();
  }
}

/**
 * Interpolates a color from a color map based on a normalized value
 * @param t Normalized value (0-1)
 * @param map Array of RGB colors
 * @returns Interpolated RGB color
 */
function interpolateColorMap(t: number, map: number[][]): RGB {
  if (t <= 0) {
    return map[0] as RGB;
  }
  if (t >= 1) {
    return map[map.length - 1] as RGB;
  }

  const step = 1 / (map.length - 1);
  // Bitwise OR with 0 to convert Infinity or NaN to 0 to avoid issues with the index calculation
  const idx = (t / step) | 0;
  // Calculate the percentage within the current step for interpolation between two colors
  const localT = (t - idx * step) / step;

  // Get the two colors to interpolate between based on the calculated index
  const c1 = map[idx];
  const c2 = map[idx + 1];

  if (!c1 || c1.length < 3 || !c2 || c2.length < 3) {
    return [0, 0, 0];
  }

  // Interpolate between the two colors using linear interpolation, again using avoiding NaN or Infinity issues by using bitwise OR
  return [
    (c1[0]! + (c2[0]! - c1[0]!) * localT) | 0,
    (c1[1]! + (c2[1]! - c1[1]!) * localT) | 0,
    (c1[2]! + (c2[2]! - c1[2]!) * localT) | 0,
  ];
}

const VIRIDIS_MAP = [
  [68, 1, 84],
  [59, 82, 139],
  [33, 145, 140],
  [94, 201, 98],
  [253, 231, 37],
];
const INFERNO_MAP = [
  [0, 0, 4],
  [87, 16, 110],
  [187, 55, 84],
  [249, 142, 9],
  [252, 255, 164],
];

function viridis(t: number): RGB {
  return interpolateColorMap(t, VIRIDIS_MAP);
}

function inferno(t: number): RGB {
  return interpolateColorMap(t, INFERNO_MAP);
}

function grayscale(t: number): RGB {
  const v = Math.floor(t * 255);
  return [v, v, v];
}

function jet(t: number): RGB {
  // Jet: Blue -> Cyan -> Yellow -> Orange -> Red
  // t: 0..1
  const v = Math.max(0, Math.min(1, t));
  // R: 0 at 0.35, 1 at 0.66
  // G: 0 at 0.12, 1 at 0.37, 1 at 0.64, 0 at 0.89
  // B: 1 at 0.11, 0 at 0.34

  // Simple 4-segment interpolation
  const r = Math.min(4 * v - 1.5, -4 * v + 4.5);
  const g = Math.min(4 * v - 0.5, -4 * v + 3.5);
  const b = Math.min(4 * v + 0.5, -4 * v + 2.5);

  return [
    Math.floor(Math.max(0, Math.min(1, r)) * 255),
    Math.floor(Math.max(0, Math.min(1, g)) * 255),
    Math.floor(Math.max(0, Math.min(1, b)) * 255),
  ];
}

function hot(t: number): RGB {
  // Black -> Red -> Yellow -> White
  // R: 0->1 linear (0-0.33)
  // G: 0 (0-0.33) -> 1 (0.66-1)
  // B: 0 (0-0.66) -> 1 (1)

  // Easier with keypoints:
  // 0.0: 0,0,0
  // 0.33: 255,0,0
  // 0.66: 255,255,0
  // 1.0: 255,255,255

  let r,
    g = 0,
    b = 0;

  if (t < 0.33) {
    r = t / 0.33;
  } else if (t < 0.66) {
    r = 1;
    g = (t - 0.33) / 0.33;
  } else {
    r = 1;
    g = 1;
    b = (t - 0.66) / 0.34;
  }

  return [Math.floor(r * 255), Math.floor(g * 255), Math.floor(b * 255)];
}

function cool(t: number): RGB {
  // Cyan -> Magenta
  // R: 0 -> 1
  // G: 1 -> 0
  // B: 1
  const r = t;
  const g = 1 - t;
  const b = 1;
  return [Math.floor(r * 255), Math.floor(g * 255), Math.floor(b * 255)];
}

function spring(t: number): RGB {
  // Magenta -> Yellow
  // R: 1
  // G: t
  // B: 1 - t
  return [255, Math.floor(t * 255), Math.floor((1 - t) * 255)];
}

function summer(t: number): RGB {
  // Green -> Yellow
  // R: t
  // G: 0.5 + 0.5*t
  // B: 0.4
  // Standard matplotlib 'summer' is simpler
  // 0.0: (0.0, 0.5, 0.4)
  // 1.0: (1.0, 1.0, 0.4)
  return [
    Math.floor(t * 255),
    Math.floor((0.5 + 0.5 * t) * 255),
    Math.floor(0.4 * 255),
  ];
}

function autumn(t: number): RGB {
  // Red -> Orange -> Yellow
  // R: 1
  // G: t
  // B: 0
  return [255, Math.floor(t * 255), 0];
}

function winter(t: number): RGB {
  // Blue -> Green
  // 0.0: (0, 0, 1)
  // 1.0: (0, 1, 0.5)
  // R: 0
  // G: t
  // B: 1.0 - 0.5*t
  return [0, Math.floor(t * 255), Math.floor((1.0 - 0.5 * t) * 255)];
}

function bone(t: number): RGB {
  const r = t;
  const sin = 0.1 * Math.sin(t * Math.PI * 2);
  const g = t < 0.5 ? t + sin : t;
  const b = t < 0.75 ? t + sin : t;

  return [
    Math.floor(Math.min(1, r) * 255),
    Math.floor(Math.min(1, g) * 255),
    Math.floor(Math.min(1, b) * 255),
  ];
}

const COLOR_MAP_FNS: Record<ColorMapName, (t: number) => RGB> = {
  viridis,
  inferno,
  grayscale,
  jet,
  hot,
  cool,
  spring,
  summer,
  autumn,
  winter,
  bone,
};