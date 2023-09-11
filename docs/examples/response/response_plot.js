import * as sp from '../../seisplotjs_3.1.1_standalone.mjs';

import {parse_sis_xml} from './response_parse.js';

const doLogLog = true;
let pad_size = 1024*1/16;

const min_exp = 0;
const max_exp = 2;

document.querySelector("#extstationxml_load").addEventListener('click', event => {
  load_sis();
});
document.querySelector("#nrl_load").addEventListener('click', event => {
  load_nrl();
});
if (document.querySelector("#stationxml_load")) {
  document.querySelector("#stationxml_load").addEventListener('click', event => {
    load_fdsn();
  });
}
document.querySelector("#clear").addEventListener('click', event => {
  clear_all();
});
document.querySelector("#showphase").addEventListener('change', event => {
  load_ext();
});

function clear_all() {
  clear_plots();
  const chanChooser = document.querySelector("sp-channel-list");
  chanChooser.setChannels([]);
}
function clear_plots() {
  let divEl = document.querySelector("div.stageplot");
  while (divEl.firstChild) {
    divEl.removeChild(divEl.lastChild);
  }
  divEl = document.querySelector("div.overlayplot");
  while (divEl.firstChild) {
    divEl.removeChild(divEl.lastChild);
  }
}

function load_fdsn() {
  clear_all();
  let chan_chooser = document.querySelector("sp-channel-code-input");
  let sta = chan_chooser.station;
  // here grab a channel response from IRIS DMC and plot stages
  let queryTimeWindow = new sp.util.startEnd('now', 'now');
  let stationQuery = new sp.fdsnstation.StationQuery()
    .networkCode(chan_chooser.network)
    .stationCode(chan_chooser.station)
    .locationCode(chan_chooser.location)
    .channelCode(chan_chooser.channel);
//    .timeRange(queryTimeWindow);
  let url = stationQuery.formURL("response");
  document.querySelector(".response_url").textContent = url;
  stationQuery.queryResponses().then(networkList => {
    let gen = sp.stationxml.allChannels(networkList);
    let firstChan = gen.next().value;
    if ( ! firstChan) {
      document.querySelector("div.stageplot").innerHTML = `<p>No channels found</p>`;
    }
    if ( ! firstChan.response) {
      console.log(`No response: ${firstChan.channelCode}`);
      document.querySelector("div.stageplot").innerHTML = `<p>No response: ${firstChan.channelCode}</p>`;
    }
    const chanChooser = document.querySelector("sp-channel-list");
    chanChooser.addEventListener("change", () => {
      chanChooser.selectedChannels().forEach(c => process_stages(c.response.stages));
    });
    chanChooser.setChannels(Array.from(sp.stationxml.allChannels(networkList)));
    chanChooser.setAttribute('channel',"a");
  }).catch(e => {
    let div = document.querySelector("div.stageplot");
    div.innerHTML = `<p>Error: ${e}</p>`;
    console.warn(e);
  });
}

function load_sis() {
  load_ext('input#stationxml_url');
}
function load_nrl() {
  load_ext('input#nrl_url');
}
function load_ext(input_selector) {
  clear_all();
  // here grab a sis extstationxml file directly and plot response stages
  // IRIS NRL has bug with xml mime, so also include text
  const mime_types = sp.util.XML_MIME+","+sp.util.TEXT_MIME;
  const fetchInit = sp.util.defaultFetchInitObj(mime_types);
  let url;
  if (input_selector) {
    url = document.querySelector(input_selector).value;
    document.querySelector(".response_url").textContent = url;
  } else {
    // empty, so reuse previous url, if possible
    url = document.querySelector(".response_url").textContent;
    if (! url) {
      // oh well,
      return;
    }
  }
  const timeoutSec = 10;
  sp.util.doFetchWithTimeout(url, fetchInit, timeoutSec * 1000 )
    .then(response => {
        if (response.status === 200) {
          return response.text();
        } else {
          throw new Error(`Status not successful: ${response.status}`);
        }
    }).then(function(rawXmlText) {
      return new DOMParser().parseFromString(rawXmlText, "text/xml");
    }).then(xml => {
      const top = xml.documentElement;
      if (top.localName === "Response") {
        // stationxml-response from IRIS NRL web service
        let resp = sp.stationxml.convertToResponse(xml);
        process_stages(resp.stages);
      } else if (top.localName === "FDSNStationXML" && xml.querySelector("HardwareResponse")) {
        // SIS extended stationxml
        let stages = parse_sis_xml(xml);
        process_stages(stages);
      } else if (top.localName === "FDSNStationXML") {
        // plain old FDSN StationXML
        let networkList = sp.stationxml.parseStationXml(xml);
        //let firstChan = sp.stationxml.allChannels(networkList).next();
        let firstChan = networkList[0].stations[0].channels[0];
        if ( ! firstChan.response) {
          console.log(`No response: ${firstChan.channelCode}`);
        }
        if ( ! firstChan.response.stages) {
          console.log(`No stages: ${firstChan.channelCode}  ${firstChan.response}`);
        }
        document.querySelector("channel-list-chooser")[0].channels = Array.from(sp.stationxml.allChannels(networkList));
        process_stages(firstChan.response.stages);
      } else {
        let div = document.querySelector("div.stageplot");
        div.textContent = "<p>Unknown file type...</p>";
      }
    }).catch(e => {
      let div = document.querySelector("div.stageplot");
      div.textContent = "<p>Error: ${e}</p>";
      console.warn(e);
    })
}

function process_stages(stages) {
  clear_plots();
  let all_coeff = [];
  let all_resp = [];
  let in_sps = [];
  let first_sps = null;

  stages.forEach((stage,idx) => {
    if (stage.filter && stage.decimation !== null) {
      in_sps.push(stage.decimation.inputSampleRate);
      if (first_sps === null) {first_sps = stage.decimation.inputSampleRate;}
    }
  });
  stages.forEach((stage,idx) => {
    let div = document.querySelector("div.stageplot").appendChild(document.createElement("div"));
    let details = div.appendChild(document.createElement("details"))
    details.appendChild(document.createElement("summary")).textContent = `Stage: ${idx+1}`;
    const textArea = details.appendChild(document.createElement("textarea"));
    textArea.setAttribute("rows", 10);
    textArea.setAttribute("cols", 80);
    textArea.textContent = stage_details(stage, idx);

    if (stage.gain) {
      const inDiv = div.appendChild(document.createElement("div"));
      const inSpan = inDiv.appendChild(document.createElement("span"));
      inSpan.textContent = `Gain: ${stage.gain.value} at ${stage.gain.frequency} Hz`;
    }
    if (stage.decimation) {
      const inDiv = div.appendChild(document.createElement("div"));
      const inSpan = inDiv.appendChild(document.createElement("span"));
      inSpan.textContent = `Decimation: from ${stage.decimation.inputSampleRate} sps by factor ${stage.decimation.factor} to ${stage.decimation.inputSampleRate/stage.decimation.factor} sps`;
    }
    if (stage.filter && (
        (stage.filter instanceof sp.stationxml.CoefficientsFilter &&
          stage.filter.cfTransferFunction === "DIGITAL" &&
          stage.filter.denominator.length === 0 &&
          stage.filter.numerator.length > 0
        ) ||
        stage.filter instanceof sp.stationxml.FIR &&
          stage.filter.numerator.length > 0) ) {
      let coeff = calc_stage_coeff(stage);
      let impulseResponse = sp.fft.FFTResult.createFromPackedFreq(sp.fft.calcDFT(coeff.reverse()), coeff.length, stage.decimation.inputSampleRate);
      plot_from_packed_freq(div, stage, idx, impulseResponse);
      plot_impulse(div, stage, idx, coeff);
      all_resp.push(impulseResponse);
    } else if (stage.filter && stage.filter instanceof sp.stationxml.PolesZeros &&
      stage.filter.pzTransferFunctionType === "LAPLACE (RADIANS/SECOND)") {
      const numPoints = pad_size;
      let gamma = 0;
      let sacPoleZero = sp.transfer.convertPoleZeroToSacStyle(stage.filter, 1,1,gamma);
      sacPoleZero.trimZeros(gamma);

      const num = pad_size;
      let freqs = sp.sacPoleZero.logspace(min_exp, max_exp, num);
      let freqAmp= new sp.spectraplot.FreqAmp(freqs, sacPoleZero.calcForDisplay(freqs));

      //let impulseResponse = sp.transfer.calcResponseFromSacPoleZero(sacPoleZero, numPoints, 2*first_sps);

      plot_from_packed_freq(div, stage, idx, freqAmp);
      all_resp.push(freqAmp);
    } else {
      let div = document.querySelector("div.stageplot").appendChild(document.createElement("div"));
      let filter_class = stage.filter ? stage.filter.__proto__.constructor.name : "missing";
      let len_msg = "";
      if (! stage.filter ) {
        const d = div.appendChild(document.createElement("div"));
        d.innerHTML = `<span>Stage ${idx+1} filter is missing</span>`;
      } else if (stage.filter instanceof sp.stationxml.CoefficientsFilter ) {
        if (stage.filter.numerator.length == 0 && stage.filter.numerator.length === 0) {
          const d = div.appendChild(document.createElement("div"));
          d.innerHTML = `<span>Stage ${idx+1} filter is length zero Coefficients</span>`;
        } else {
          len_msg = `num: ${stage.filter.numerator.length}, denom: ${stage.filter.denominator.length}`;
          const d = div.appendChild(document.createElement("div"));
          d.innerHTML = `<span>Stage ${idx+1} filter is Coeff with denom: ${filter_class} ${len_msg}</span>`;
        }
      } else {
        const d = div.appendChild(document.createElement("div"));
        d.innerHTML = `<span>Stage ${idx+1} filter is not plottable: ${filter_class} ${len_msg}</span>`;
      }
    }
  });
  overlay_plot_from_coefficients(all_resp, in_sps);
}

function calc_stage_coeff(stage) {
  if (stage.filter instanceof sp.stationxml.FIR ) {
    let fir = stage.filter;
    let numPoints = Math.max(pad_size, 2*fir.numerator.length);
    //let numPoints = fir.numerator.length;
    let longCoeff;
    if (fir.symmetry === "NONE") {
      longCoeff = new Array(numPoints).fill(0);
      for(let i=0; i<fir.numerator.length; i++) {
        longCoeff[i] = fir.numerator[i];
      }
    } else if (fir.symmetry === "ODD") {
      longCoeff = new Array(2*numPoints-1).fill(0);
      for(let i=0; i<fir.numerator.length-1; i++) {
        longCoeff[i] = fir.numerator[i];
        longCoeff[2*(fir.numerator.length-1)-i] = fir.numerator[i];
      }
      longCoeff[fir.numerator.length-1] = fir.numerator[fir.numerator.length-1];
    } else if (fir.symmetry === "EVEN") {
      longCoeff = new Array(2*numPoints).fill(0);
      for(let i=0; i<fir.numerator.length; i++) {
        longCoeff[i] = fir.numerator[i];
        longCoeff[2*fir.numerator.length-1-i] = fir.numerator[i];
      }
    } else {
      throw new Error(`Unknown symmetry type: ${fir.symmetry}`);
    }
    return longCoeff;
  } else if (stage.filter instanceof sp.stationxml.CoefficientsFilter ) {
    let numPoints = Math.max(pad_size, 2*stage.filter.numerator.length);
    if (stage.filter.denominator.length ===0 ) {
      let longCoeff = new Array(numPoints).fill(0);
      if (stage.filter.numerator.length !==0 ) {
        for(let i=0; i<stage.filter.numerator.length; i++) {
          longCoeff[i] = stage.filter.numerator[i];
        }
      } else {
        longCoeff[0] = 1;
      }
      return longCoeff;
    }
  }
  // fake a unity impulse response
  let longCoeff = new Array(pad_size).fill(0);
  longCoeff[0] = 1;
  return longCoeff;
}

function plot_from_packed_freq(div, stage, idx, impulseResponseList) {
  if ( ! Array.isArray(impulseResponseList)) {
    impulseResponseList = [impulseResponseList];
  }
  let impulseResponse = impulseResponseList[0];
  impulseResponse.inputUnits = stage.filter.inputUnits;
  let ampdiv = div.appendChild(document.createElement("div"));
  ampdiv.setAttribute("class", "stage");
  const plotConfig = new sp.seismographconfig.SeismographConfig();
  let title;
  if (stage.filter && stage.filter instanceof sp.stationxml.PolesZeros) {
    title = `Stage ${idx+1} PolesZeros, poles: ${stage.filter.poles.length} , zeros: ${stage.filter.zeros.length} `;
  } else if (stage.filter && stage.filter instanceof sp.stationxml.CoefficientsFilter) {
    title = `Stage ${idx+1} Coefficients, in sps: ${stage.decimation.inputSampleRate}, factor: ${stage.decimation.factor}, len: ${stage.filter.numerator.length}/${stage.filter.denominator.length} `;
  } else if (stage.filter && stage.filter instanceof sp.stationxml.FIR) {
    title = `Stage ${idx+1} FIR, in sps: ${stage.decimation.inputSampleRate}, factor: ${stage.decimation.factor}, sym: ${stage.filter.symmetry} len: ${stage.filter.numerator.length} `;
  } else {
    title = `Stage ${idx+1} unknown filter, in sps: ${stage.decimation.inputSampleRate}, factor: ${stage.decimation.factor} `;
  }
  plotConfig.title=title;
  plotConfig.ySublabelIsUnits = true;
  plotConfig.xLabel = "Frequency";
  plotConfig.xSublabel = "Hz";

  const fftAmpPlot = new sp.spectraplot.SpectraPlot(impulseResponseList, plotConfig);
  fftAmpPlot.logfreq = doLogLog;
  ampdiv.appendChild(fftAmpPlot);
  let phaseCB = document.querySelector("#showphase");
  if (phaseCB.checked) {

    let phasediv = div.appendChild(document.createElement("div"));
    phasediv.setAttribute("class", "stage");
    const phasePlotConfig = plotConfig.clone();
    phasePlotConfig.title=`Phase Stage ${idx+1}`;
    const fftPhasePlot = new sp.spectraplot.SpectraPlot(impulseResponseList, plotConfig);
    fftPhasePlot.logfreq = doLogLog;
    fftPhasePlot.kind = "phase";
    phasediv.appendChild(fftPhasePlot);
  }
  return fftAmpPlot;
}

function plot_impulse(div, stage, idx, coeff) {
  let plotdiv = div.appendChild(document.createElement("div"));
  plotdiv.setAttribute("class", "stage");
  let sampleRate = 1;
  let start = sp.util.isoToDateTime('2000-01-01T00:00:00Z');
  if (stage.decimation) {
    sampleRate = stage.decimation.inputSampleRate;
  }
  let impulseSeis = sp.seismogram.Seismogram.fromContiguousData(coeff.reverse(), sampleRate, start);
  // snip start draw
  let seisConfig = new sp.seismographconfig.SeismographConfig();
  seisConfig.title = "Impulse Response";
  seisConfig.margin.top = 25;
  seisConfig.doRMean = false;
  seisConfig.wheelZoom = false;
  let seisData = sp.seismogram.SeismogramDisplayData.fromSeismogram(impulseSeis);
  let graph = new sp.seismograph.Seismograph([seisData], seisConfig);
  plotdiv.appendChild(graph);
}


function overlay_plot_from_coefficients(all_resp, in_samp_rate) {
  const plotConfig = new sp.seismographconfig.SeismographConfig();
  plotConfig.title=`Overlay Stages, in sps: ${in_samp_rate}`;
  let div = document.querySelector("div.overlayplot").appendChild(document.createElement("div"));
  div.setAttribute("class", "stage");
  let div_p = div.appendChild(document.createElement("p"));
  div_p.textContent =`Overlay Stages`;

  const fftRatioPlot = new sp.spectraplot.SpectraPlot(all_resp, plotConfig);
  fftRatioPlot.logfreq = doLogLog;
  div.appendChild(fftRatioPlot);
}

function stage_details(stage, idx) {
  let out = "";
  if (stage.filter && stage.filter instanceof sp.stationxml.PolesZeros) {
    out = `Stage ${idx+1} PolesZeros, poles: ${stage.filter.poles.length} , zeros: ${stage.filter.zeros.length} \n`;
    out += `PzTransferFunctionType: ${stage.filter.pzTransferFunctionType}\n`;
    out += `NormalizationFactor: ${stage.filter.normalizationFactor} at ${stage.filter.normalizationFrequency} Hz \n`;
    out += `Poles (${stage.filter.poles.length}):\n`;
    stage.filter.poles.forEach((p,idx) => {out += `${idx}: ${p.real()} + ${p.imag()} i\n`});
    out += `Zeros (${stage.filter.zeros.length}):\n`;
    stage.filter.zeros.forEach((p,idx) => {out += `${idx}: ${p.real()} + ${p.imag()} i\n`});
  } else if (stage.filter && stage.filter instanceof sp.stationxml.CoefficientsFilter) {
    out = `Stage ${idx+1} Coefficients, in sps: ${stage.decimation.inputSampleRate}, factor: ${stage.decimation.factor}, len: ${stage.filter.numerator.length}/${stage.filter.denominator.length} \n`;
    out += `CfTransferFunctionType: ${stage.filter.cfTransferFunction}\n`;
    out += `Numerator (${stage.filter.numerator.length}):\n`;
    stage.filter.numerator.forEach((p,idx) => {out += `${idx}: ${p}\n`});
    out += `Denominator (${stage.filter.denominator.length}):\n`;
    stage.filter.denominator.forEach((p,idx) => {out += `${idx}: ${p}\n`});
  } else if (stage.filter && stage.filter instanceof sp.stationxml.FIR) {
    out =  `Stage ${idx+1} FIR, in sps: ${stage.decimation.inputSampleRate}, factor: ${stage.decimation.factor}, sym: ${stage.filter.symmetry} len: ${stage.filter.numerator.length} \n`;
    out += `Symmetry: ${stage.filter.symmetry}\n`;
    out += `NumeratorCoefficient (${stage.filter.numerator.length}):\n`;
    stage.filter.numerator.forEach((p,idx) => {out += `${idx}: ${p}\n`});
  } else {
    let filter_class = stage.filter ? stage.filter.__proto__.constructor.name : "missing";
    out = `Stage ${idx+1} unknown filter: ${filter_class}  \n`;
  }
  return out;
}
