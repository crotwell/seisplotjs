/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * https://www.seis.sc.edu
 */
import { Seismogram, SeismogramDisplayData } from "./seismogram";
import { isDef } from "./util";
import { RDFT, Complex, complexFromPolar } from "./oregondsputil";

/**
 * A higher level function to calculate DFT. Returns a
 * FFTResult for easier access to the result as
 * complex, amp, phase arrays. Calls calcDFT internally.
 * Inverse FFT is available as FFTResult.fftInverse().
 *
 * @param seis seismogram or SeismogramDisplayData to transform
 * @returns fft of seismogram
 */
export function fftForward(
  seis: Seismogram | SeismogramDisplayData,
): FFTResult {
  let sdd;

  if (seis instanceof Seismogram) {
    sdd = SeismogramDisplayData.fromSeismogram(seis);
  } else {
    sdd = seis;
  }

  if (isDef(sdd.seismogram)) {
    const seismogram = sdd.seismogram;

    if (seismogram.isContiguous()) {
      const result = FFTResult.createFromPackedFreq(
        calcDFT(seismogram.y),
        seismogram.numPoints,
        seismogram.sampleRate,
      );
      result.seismogramDisplayData = sdd;
      return result;
    } else {
      throw new Error("Can only take FFT is seismogram is contiguous.");
    }
  } else {
    throw new Error("Can not take FFT is seismogram is null.");
  }
}

/**
 * Calculates the discrete fourier transform using the OregonDSP library.
 *
 * This is a lower level function, fftForward is better for most uses.
 *
 * @param   timeseries timeseries array
 * @returns           DFT as packed array Float32Array
 */
export function calcDFT(
  timeseries: Int32Array | Float32Array | Float64Array,
): Float32Array {
  let [N, log2N] = findPowerTwo(timeseries.length);
  if (N < 16) {
    log2N = 4;
    N = 16;
  }

  const dft = new RDFT(log2N);
  const inArray = new Float32Array(N);
  inArray.fill(0);

  for (let i = 0; i < timeseries.length; i++) {
    inArray[i] = timeseries[i];
  }

  const out = new Float32Array(N).fill(0);
  dft.evaluate(inArray, out);
  return out;
}

/**
 * Calculates the inverse discrete fourier transform using the oregondsp library.
 *
 * @param   packedFreq DFT as packed array Float32Array
 * @param   numPoints     number of points in original timeseries array.
 * @returns           inverse of DFT as a timeseries array
 */
export function inverseDFT(
  packedFreq: Float32Array<ArrayBufferLike>,
  numPoints: number,
): Float32Array {
  if (numPoints > packedFreq.length) {
    throw new Error(
      "Not enough points in packed freq array for " +
        `${numPoints}, only ${packedFreq.length}`,
    );
  }

  let [N, log2N] = findPowerTwo(packedFreq.length);
  if (N < 16) {
    log2N = 4;
    N = 16;
  }

  if (N !== packedFreq.length) {
    throw new Error(`power of two check fails: ${N} ${packedFreq.length}`);
  }

  const dft = new RDFT(log2N);
  const out = new Float32Array(N).fill(0);
  dft.evaluateInverse(packedFreq, out);
  return out.slice(0, numPoints);
}

/**
 * Finds smallest power of two >= input number.
 *
 * @param  fftlength               input number
 * @returns           tuple of N and log2N, like [16,4]
 */
export function findPowerTwo(fftlength: number): [number, number] {
  let log2N = 1;
  let N = 2;

  while (N < fftlength) {
    log2N += 1;
    N = 2 * N;
  }
  return [N, log2N];
}

/**
 * Results of FFT calculation. Allows convertion of the packed real/imag array output from calcDFT into
 * amplitude and phase.
 */
export class FFTResult {
  /** number of points in the original timeseries, may be less than fft size. */
  origLength: number;
  packedFreq: Float32Array;

  /** number of points in the fft, usually power of 2 larger than origLength. */
  numPoints: number;

  /** sample rate of the original time series, maybe be null. */
  sampleRate: number;

  /** optional units of the original data for display purposes. */
  inputUnits: string | undefined;

  /**
   * optional reference to SeismogramDisplayData when calculated from a seismogram.
   *  Useful for creating title, etc.
   */
  seismogramDisplayData: SeismogramDisplayData | undefined;

  constructor(origLength: number, sampleRate: number) {
    this.origLength = origLength;
    this.sampleRate = sampleRate;
    this.packedFreq = new Float32Array(0);
    this.numPoints = 0;
  }

  /**
   * Factory method to create FFTResult from packed array.
   *
   * @param   packedFreq real and imag values in packed format
   * @param   origLength length of the original timeseries before padding.
   * @param   sampleRate sample rate of original data
   * @returns            FFTResult
   */
  static createFromPackedFreq(
    packedFreq: Float32Array,
    origLength: number,
    sampleRate: number,
  ): FFTResult {
    const fftResult = new FFTResult(origLength, sampleRate);
    fftResult.packedFreq = packedFreq;
    fftResult.numPoints = packedFreq.length;
    const [N, log2N] = findPowerTwo(packedFreq.length);
    if (N < origLength) {
      throw new Error(
        `Not enough freq points, ${packedFreq.length}, for orig length of ${origLength}, must be > and power two, (${N}, ${log2N})`,
      );
    }
    return fftResult;
  }

  /**
   * Factory method to create from array of complex numbers.
   *
   * @param   complexArray real and imag values as array of Complex objects.
   * @param   origLength   length of the original timeseries before padding.
   * @param   sampleRate sample rate of original data
   * @returns               FFTResult
   */
  static createFromComplex(
    complexArray: Array<InstanceType<typeof Complex>>,
    origLength: number,
    sampleRate: number,
  ): FFTResult {
    // complex array will have 1 extra point, but first and last will have phase=0
    const N = 2 * (complexArray.length - 1);
    const modFreq = new Float32Array(N).fill(0);
    modFreq[0] = complexArray[0].real();

    for (let i = 1; i < complexArray.length - 1; i++) {
      modFreq[i] = complexArray[i].real();
      modFreq[N - i] = complexArray[i].imag();
    }

    modFreq[N / 2] = complexArray[complexArray.length - 1].real();
    return FFTResult.createFromPackedFreq(modFreq, origLength, sampleRate);
  }

  /**
   * Factory method to create from amp and phase arrays
   *
   * @param   amp        amplitude values
   * @param   phase      phase values
   * @param   origLength length of the original timeseries before padding.
   * @param   sampleRate sample rate of original data
   * @returns             FFTResult
   */
  static createFromAmpPhase(
    amp: Float32Array,
    phase: Float32Array,
    origLength: number,
    sampleRate: number,
  ): FFTResult {
    if (amp.length !== phase.length) {
      throw new Error(
        `amp and phase must be same length: ${amp.length} ${phase.length}`,
      );
    }

    const modComplex = new Array<InstanceType<typeof Complex>>(amp.length);
    for (let i = 0; i < amp.length; i++) {
      modComplex[i] = complexFromPolar(amp[i], phase[i]);
    }
    return FFTResult.createFromComplex(modComplex, origLength, sampleRate);
  }

  /**
   * The minimum non-zero frequency in the fft
   *
   * @returns fundamental frequency
   */
  get fundamentalFrequency(): number {
    if (this.sampleRate) {
      return this.sampleRate / this.numPoints;
    } else {
      throw new Error(
        "sample rate not set on FFTResult, needed to calc min frequency",
      );
    }
  }

  asComplex(): Array<InstanceType<typeof Complex>> {
    const complexArray: Array<InstanceType<typeof Complex>> = [];
    const L = this.packedFreq.length;
    complexArray.push(new Complex(this.packedFreq[0], 0));
    for (let i = 1; i < this.packedFreq.length / 2; i++) {
      const c = new Complex(this.packedFreq[i], this.packedFreq[L - i]);
      complexArray.push(c);
    }
    complexArray.push(new Complex(this.packedFreq[L / 2], 0));
    return complexArray;
  }

  asAmpPhase(): [Float32Array, Float32Array] {
    const amp = new Float32Array(1 + this.packedFreq.length / 2);
    const phase = new Float32Array(1 + this.packedFreq.length / 2);

    let c = new Complex(this.packedFreq[0], 0);
    amp[0] = c.abs();
    phase[0] = c.angle();
    const L = this.packedFreq.length;

    for (let i = 1; i < this.packedFreq.length / 2; i++) {
      c = new Complex(this.packedFreq[i], this.packedFreq[L - i]);
      amp[i] = c.abs();
      phase[i] = c.angle();
    }

    c = new Complex(this.packedFreq[L / 2], 0);
    amp[this.packedFreq.length / 2] = c.abs();
    phase[this.packedFreq.length / 2] = c.angle();
    return [amp, phase];
  }

  /**
   * calculates the inverse fft of this.packedFreq
   *
   * @returns time domain representation
   */
  fftInverse(): Float32Array {
    return inverseDFT(this.packedFreq, this.origLength);
  }

  frequencies(): Float32Array {
    const out = new Float32Array(this.numPoints / 2 + 1).fill(0);

    for (let i = 0; i < out.length; i++) {
      out[i] = i * this.fundamentalFrequency;
    }

    return out;
  }

  get numFrequencies(): number {
    return this.numPoints / 2 + 1;
  }

  get minFrequency(): number {
    return this.fundamentalFrequency;
  }

  get maxFrequency(): number {
    return this.sampleRate / 2;
  }

  amplitudes(): Float32Array {
    const [amp] = this.asAmpPhase();
    return amp;
  }

  phases(): Float32Array {
    const [, phase] = this.asAmpPhase();
    return phase;
  }

  clone(): FFTResult {
    const out = FFTResult.createFromPackedFreq(
      this.packedFreq.slice(),
      this.origLength,
      this.sampleRate,
    );
    out.seismogramDisplayData = this.seismogramDisplayData;
    return out;
  }
}
