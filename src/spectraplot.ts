/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */
import {FFTResult} from "./fft";
import {COLOR_CSS_ID} from "./seismograph";
import {SeismographConfig} from "./seismographconfig";
import {SeismogramDisplayData} from "./seismogram";
import {addStyleToElement} from './spelement';
import {Complex} from "./oregondsputil";
//import * as d3 from "d3";
import {extent as d3extent} from "d3-array";
import {select as d3select} from "d3-selection";
import {
  scaleLinear as d3scaleLinear,
  ScaleContinuousNumeric as d3ScaleContinuousNumeric,
  scaleLog as d3scaleLog,
 } from "d3-scale";
import {line as d3line } from "d3-shape";
import {
  axisLeft as d3axisLeft ,
  axisBottom as d3axisBottom,
} from "d3-axis";
import { G_DATA_SELECTOR, AUTO_COLOR_SELECTOR} from "./cssutil";
import {drawAxisLabels} from "./axisutil";

export const SPECTRA_ELEMENT = 'sp-spectra';


/**
 * Similar to FFTResult, but used for plotting non-fft generated data.
 * This allows the frequencies to be, for example, evenly distrubuted
 * in log instead of linearly for plotting PolesZeros stages.
 */
export class FreqAmp {
  freq: Float32Array;
  values: Array<InstanceType<typeof Complex>>;

  /** optional units of the original data for display purposes. */
  inputUnits: string;
  seismogramDisplayData: null | SeismogramDisplayData;

  constructor(freq: Float32Array, values: Array<InstanceType<typeof Complex>>) {
    this.freq = freq;
    this.values = values;
    this.inputUnits = ""; // leave blank unless set manually

    this.seismogramDisplayData = null;
    if (freq.length !== values.length) {
      throw new Error(`Frequencies and complex values must have same length: ${freq.length} ${values.length}`);
    }
  }

  frequencies(): Float32Array {
    return this.freq;
  }

  amplitudes(): Float32Array {
    const out = new Float32Array(this.values.length);
    this.values.forEach((c,i) => out[i] = c.abs());
    return out;
  }

  phases(): Float32Array {
    const out = new Float32Array(this.values.length);
    this.values.forEach((c,i) => out[i] = c.angle());
    return out;
  }

  get numFrequencies(): number {
    return this.freq.length;
  }

  get minFrequency(): number {
    return this.fundamentalFrequency;
  }

  get maxFrequency(): number {
    return this.freq[this.freq.length - 1];
  }

  // for compatibility with FFTResult
  get fundamentalFrequency(): number {
    return this.freq[0];
  }
}
/**
 * Defualt CSS for styling fft plots.
 */
export const spectra_plot_css = `
:host {
  display: block
}

div.wrapper {
  height: 100%;
  min-height: 100px;
}
path.fftpath {
  stroke: skyblue;
  fill: none;
  stroke-width: 1px;
}

svg.spectra_plot {
  height: 100%;
  width: 100%;
  min-height: 100px;
  display: block;
}
svg.spectra_plot text.title {
  font-size: larger;
  font-weight: bold;
  fill: black;
  color: black;
}

svg.spectra_plot text.sublabel {
  font-size: smaller;
}

/* links in svg */
svg.spectra_plot text a {
  fill: #0000EE;
  text-decoration: underline;
}

`;

export const AMPLITUDE = "amplitude";
export const PHASE = "phase";
export const LOGFREQ = "logfreq";
export const KIND = "kind";

/**
 * A amplitude or phase plot of fft data. The 'kind' attribute controls whether
 * 'amplitude' or 'phase' is plotted and the 'logfreq' attribute controls
 * whether frequency, x axis, is linear or log.
 * Setting the seismogramConfig changes
 * the plot configuration, althought not all values are used.
 * The data as an array of FFTResult or FreqAmp
 * sets the data to be plotted.
 * Amplitude is plotted with y axis log, phase is y axis linear.
 *
 */
export class SpectraPlot extends HTMLElement {
  _seismographConfig: SeismographConfig;
  _fftResults: Array<FFTResult | FreqAmp>;

  constructor(fftResults?: Array<FFTResult | FreqAmp>, seismographConfig?: SeismographConfig) {
    super();
    if (seismographConfig) {
      this._seismographConfig = seismographConfig;
    } else {
      this._seismographConfig = new SeismographConfig();
    }
    if (fftResults) {
      this._fftResults = fftResults;
    } else {
      this._fftResults = [];
    }

    const wrapper = document.createElement('div');
    wrapper.setAttribute("class", "wrapper");
    addStyleToElement(this, spectra_plot_css);
    const lineColorsCSS = this.seismographConfig.createCSSForLineColors();
    addStyleToElement(this, lineColorsCSS, COLOR_CSS_ID);

    this.shadowRoot?.appendChild(wrapper);
  }
  get fftResults() {
    return this._fftResults;
  }
  set fftResults(fftResults: Array<FFTResult | FreqAmp>) {
    this._fftResults = fftResults;
    this.draw();
  }
  get seismographConfig() {
    return this._seismographConfig;
  }
  set seismographConfig(seismographConfig: SeismographConfig) {
    this._seismographConfig = seismographConfig;
    this.draw();
  }
  get kind(): string {
    let k = this.hasAttribute(KIND) ? this.getAttribute(KIND) : AMPLITUDE;
    // typescript null
    if (!k) { k = AMPLITUDE;}
    return k;
  }
  set kind(val: string) {
    this.setAttribute(KIND, val);
  }
  get logfreq(): boolean {
    if ( ! this.hasAttribute(LOGFREQ) ) { return true;}
    const b = this.getAttribute(LOGFREQ);
    if (b && b.toLowerCase()==="true") {return true;}
    return false;
  }
  set logfreq(val: boolean) {
    this.setAttribute(LOGFREQ, `${val}`);
  }
  connectedCallback() {
    this.draw();
  }

  static get observedAttributes() { return [LOGFREQ, KIND]; }
  attributeChangedCallback(name: string, oldValue: any, newValue: any) {
    this.draw();
  }

  draw() {
    if ( ! this.isConnected) { return; }
    const ampPhaseList = [];
    let maxFFTAmpLen = 0;
    const extentFFTData: Array<number> = [];
    const freqMinMax: Array<number> = [];

    if (this.kind === PHASE) {
      extentFFTData.push(-Math.PI);
      extentFFTData.push(Math.PI);
      if (this.seismographConfig.ySublabelIsUnits) {
        this.seismographConfig.ySublabelIsUnits = false;
        this.seismographConfig.ySublabel = "Radian";
      }
    } else {
      if (this.seismographConfig.ySublabelIsUnits) {
        this.seismographConfig.ySublabelIsUnits = false;
        this.seismographConfig.ySublabel = "";
      }
    }

    for (const fftA of this.fftResults) {
      if (this.logfreq === true) {
        freqMinMax.push(fftA.fundamentalFrequency); // min freq
      } else {
        freqMinMax.push(0);
      }

      freqMinMax.push(fftA.maxFrequency); // max freq

      let ap: FFTResult | FreqAmp;

      if (fftA instanceof FFTResult || fftA instanceof FreqAmp) {
        ap = fftA;
      } else {
        throw new Error("fftResults must be array of FFTResult");
      }

      ampPhaseList.push(ap);

      if (maxFFTAmpLen < ap.numFrequencies) {
        maxFFTAmpLen = ap.numFrequencies;
      }

      let ampSlice: Float32Array;

      if (this.kind === AMPLITUDE) {
        ampSlice = ap.amplitudes();
      } else if (this.kind === PHASE) {
        ampSlice = ap.phases();
      } else {
        throw new Error(`Unknown plot kind=${this.kind}`);
      }

      if (this.kind === AMPLITUDE) {
        // don't plot zero freq amp
        ampSlice = ampSlice.slice(1);
      }

      const currExtent = d3extent(ampSlice);

      if (this.kind === AMPLITUDE && currExtent[0] === 0) {
        // replace zero with smallest non-zero / 10 for log amp plot
        currExtent[0] =
          0.1 *
          ampSlice.reduce(function(acc: number, curr: number): number {
            if (curr > 0 && curr < acc) {
              return curr;
            } else {
              return acc;
            }
          }, 1e-9);
      }

      if (currExtent[0]) { extentFFTData.push(currExtent[0]); }
      if (currExtent[1]) { extentFFTData.push(currExtent[1]); }
    }
    if (freqMinMax.length < 2) {
      freqMinMax.push(0.1);
      freqMinMax.push(10.0);
    }

    if (extentFFTData.length < 2 ) {
      extentFFTData.push(0.1);
      extentFFTData.push(1);
    }

    const wrapper = (this.shadowRoot?.querySelector('div') as HTMLDivElement);

    while (wrapper.lastChild) {
      wrapper.removeChild(wrapper.lastChild);
    }

    const svg_element = document.createElementNS("http://www.w3.org/2000/svg","svg");
    wrapper.appendChild(svg_element);
    const svg = d3select(svg_element);
    svg.classed("spectra_plot", true).classed(AUTO_COLOR_SELECTOR, true);
    const rect = svg_element.getBoundingClientRect();
    const width =
      +rect.width -
      this.seismographConfig.margin.left -
      this.seismographConfig.margin.right;
    const height =
      +rect.height -
      this.seismographConfig.margin.top -
      this.seismographConfig.margin.bottom;
    const g = svg
      .append("g")
      .attr(
        "transform",
        "translate(" +
          this.seismographConfig.margin.left +
          "," +
          this.seismographConfig.margin.top +
          ")",
      );
    let xScale: d3ScaleContinuousNumeric<number, number, never>;
    if (this.logfreq) {
      xScale = d3scaleLog().rangeRound([0, width]);
    } else {
      xScale = d3scaleLinear().rangeRound([0, width]);
    }
    const freqMin = freqMinMax.reduce((acc, cur) => Math.min(acc, cur));
    const freqMax = freqMinMax.reduce((acc, cur) => Math.max(acc, cur));
    xScale.domain([freqMin, freqMax]);

    let fftMin = extentFFTData.reduce((acc, cur) => Math.min(acc, cur), Number.MAX_VALUE);
    let fftMax = extentFFTData.reduce((acc, cur) => Math.max(acc, cur), -1.0);
    if ((fftMax - fftMin) / fftMax < .1) {
      // min and max are close, expand range a bit
      fftMin = fftMin*0.1;
      fftMax = fftMax*2;
    }
    let yScale: d3ScaleContinuousNumeric<number, number, never>;
    if (this.kind === AMPLITUDE) {
      yScale = d3scaleLog().rangeRound([height, 0]);
      yScale.domain([fftMin, fftMax]);

      if (yScale.domain()[0] === yScale.domain()[1]) {
        yScale.domain([
          yScale.domain()[0] / 2,
          yScale.domain()[1] * 2,
        ]);
      }
    } else {
      yScale = d3scaleLinear().rangeRound([height, 0]);
      yScale.domain([fftMin, fftMax]);

      if (yScale.domain()[0] === yScale.domain()[1]) {
        yScale.domain([
          yScale.domain()[0] - 1,
          yScale.domain()[1] + 1,
        ]);
      }
    }
    const xAxis = d3axisBottom(xScale);
    g.append("g")
      .attr("transform", "translate(0," + height + ")")
      .call(xAxis);
    const yAxis = d3axisLeft(yScale);
    g.append("g").call(yAxis);
    this.seismographConfig.yLabel = "Amplitude";

    if (this.kind === PHASE) {
      this.seismographConfig.yLabel = "Phase";
    }

    this.seismographConfig.xLabel = "Frequency";
    this.seismographConfig.xSublabel = "Hz";

    if (this.seismographConfig.ySublabelIsUnits) {
      if (this.kind === PHASE) {
        this.seismographConfig.ySublabel = "radian";
      } else {
        this.seismographConfig.ySublabel = "";
        for (const ap of ampPhaseList) {
          this.seismographConfig.ySublabel += ap.inputUnits;
        }
      }
    }

    const pathg = g.append("g").classed(G_DATA_SELECTOR, true);

    for (const ap of ampPhaseList) {
      let ampSlice;

      if (this.kind === AMPLITUDE) {
        ampSlice = ap.amplitudes();
      } else if (this.kind === PHASE) {
        ampSlice = ap.phases();
      } else {
        throw new Error(`Unknown plot kind=${this.kind}`);
      }

      let freqSlice = ap.frequencies();

      if (this.logfreq) {
        freqSlice = freqSlice.slice(1);
        ampSlice = ampSlice.slice(1);
      }

      const line = d3line<number>();
      line.x(function (d: number, i: number) {
        return xScale(freqSlice[i]);
      });
      line.y(function (d: number) {
        if (d !== 0.0 && !isNaN(d)) {
          return yScale(d);
        } else {
          return yScale.range()[0];
        }
      });
      pathg
        .append("g")
        .append("path")
        .classed("fftpath", true)
        .datum(ampSlice)
        .attr("d", line);
    }

    const handlebarInput = {
      seisDataList: this.fftResults.map(f => f.seismogramDisplayData),
      seisConfig: this.seismographConfig,
    };
    drawAxisLabels(
      svg_element,
      this.seismographConfig,
      height,
      width,
      handlebarInput,
    );
  }
}
customElements.define(SPECTRA_ELEMENT, SpectraPlot);
