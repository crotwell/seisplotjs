

const doLogLog = true;
let pad_size = 1024*1/16;

document.querySelector("#extstationxml_load").addEventListener('click', event => {
  load_ext();
});
document.querySelector("#stationxml_load").addEventListener('click', event => {
  load_fdsn();
});

document.querySelector("#clear").addEventListener('click', event => {
  clear_all();
});
document.querySelector("#showphase").addEventListener('change', event => {
  load_ext();
});

function clear_all() {
  clear_plots();
  const chanChooser = document.querySelector("channel-list-chooser");
  chanChooser.setChannels([]);
}
function clear_plots() {
  let divEl = document.querySelector("div.stageplot");
  while (divEl.firstChild) {
    divEl.removeChild(divEl.lastChild);
  }
}

function load_fdsn() {
  clear_all();
  let chan_chooser = document.querySelector("channel-code-input");
  let sta = chan_chooser.station;
  // here grab a channel response from IRIS DMC and plot stages
  let queryTimeWindow = new seisplotjs.util.StartEndDuration('now', 'now');
  let stationQuery = new seisplotjs.fdsnstation.StationQuery()
    .networkCode(chan_chooser.network)
    .stationCode(chan_chooser.station)
    .locationCode(chan_chooser.location)
    .channelCode(chan_chooser.channel);
//    .timeWindow(queryTimeWindow);
  let url = stationQuery.formURL("response");
  seisplotjs.d3.select(".response_url").text(url);
  stationQuery.queryResponses().then(networkList => {
    let gen = seisplotjs.stationxml.allChannels(networkList);
    let firstChan = gen.next().value;
    if ( ! firstChan) {
      seisplotjs.d3.select("div.stageplot").append("p").text(`No channels found`);
    }
    if ( ! firstChan.response) {
      console.log(`No response: ${firstChan.channelCode}`);
      seisplotjs.d3.select("div.stageplot").append("p").text(`No response: ${firstChan.channelCode}`);
    }
    const chanChooser = document.querySelector("channel-list-chooser");
    chanChooser.setCallback(c => process_stages(c.response.stages));
    chanChooser.setChannels(Array.from(seisplotjs.stationxml.allChannels(networkList)));
    chanChooser.setAttribute('channel',"a");
  }).catch(e => {
    let div = seisplotjs.d3.select("div.stageplot");
    div.append("p").text(`Error: ${e}`);
    console.warn(e);
  });
}

function load_ext() {
  clear_all();
  // here grab a sis extstationxml file directly and plot response stages
  const fetchInit = seisplotjs.util.defaultFetchInitObj(seisplotjs.util.XML_MIME);
  let url = document.querySelector('input#stationxml_url').value
  seisplotjs.d3.select(".response_url").text(url);
  const timeoutSec = 10;
  seisplotjs.util.doFetchWithTimeout(url, fetchInit, timeoutSec * 1000 )
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
        let resp = seisplotjs.stationxml.convertToResponse(xml);
        process_stages(resp.stages);
      } else if (top.localName === "FDSNStationXML" && xml.querySelector("HardwareResponse")) {
        // SIS extended stationxml
        let stages = parse_sis_xml(xml);
        process_stages(stages);
      } else if (top.localName === "FDSNStationXML") {
        // plain old FDSN StationXML
        let networkList = seisplotjs.stationxml.parseStationXml(xml);
        //let firstChan = seisplotjs.stationxml.allChannels(networkList).next();
        let firstChan = networkList[0].stations[0].channels[0];
        if ( ! firstChan.response) {
          console.log(`No response: ${firstChan.channelCode}`);
        }
        if ( ! firstChan.response.stages) {
          console.log(`No stages: ${firstChan.channelCode}  ${firstChan.response}`);
        }
        document.querySelector("channel-list-chooser")[0].channels = Array.from(seisplotjs.stationxml.allChannels(networkList));
        process_stages(firstChan.response.stages);
      } else {
        let div = seisplotjs.d3.select("div.stageplot");
        div.append("p").text("Unknown file type...");
      }
    }).catch(e => {
      let div = seisplotjs.d3.select("div.stageplot");
      div.append("p").text(`Error: ${e}`);
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
    if (stage.filter && stage.decimation != null) {
      in_sps.push(stage.decimation.inputSampleRate);
      if (first_sps == null) {first_sps = stage.decimation.inputSampleRate;}
    }
  });
  stages.forEach((stage,idx) => {
    let div = seisplotjs.d3.select("div.stageplot");
    div.append("div").append("h5").text(`Stage: ${idx+1}`);
    if (stage.gain) {
      div.append("div").append("span").text(`Gain: ${stage.gain.value} at ${stage.gain.frequency} Hz`);
    }
    if (stage.decimation) {
      div.append("div").append("span").text(`Decimation: from ${stage.decimation.inputSampleRate} sps by factor ${stage.decimation.factor} to ${stage.decimation.inputSampleRate/stage.decimation.factor} sps`);
    }
    if (stage.filter && (
        (stage.filter instanceof seisplotjs.stationxml.CoefficientsFilter &&
          stage.filter.denominator.length === 0 &&
          stage.filter.numerator.length > 0
        ) ||
        stage.filter instanceof seisplotjs.stationxml.FIR ) ) {
      let coeff = calc_stage_coeff(stage);
      let impulseResponse = seisplotjs.fft.FFTResult.createFromPackedFreq(seisplotjs.fft.calcDFT(coeff.reverse()), coeff.length, stage.decimation.inputSampleRate);
      plot_from_packed_freq(stage, idx, impulseResponse);
      all_resp.push(impulseResponse);
    } else if (stage.filter && stage.filter instanceof seisplotjs.stationxml.PolesZeros) {
      const numPoints = pad_size;
      let gamma = 0;
      let sacPoleZero = seisplotjs.transfer.convertPoleZeroToSacStyle(stage.filter, 1,1,gamma);
      sacPoleZero.trimZeros(gamma);

      const min_exp = -3;
      const max_exp = 4;
      const num = pad_size;
      let freqs = seisplotjs.sacPoleZero.logspace(min_exp, max_exp, num);
      let freqAmp= new seisplotjs.fftplot.FreqAmp(freqs, sacPoleZero.calcForDisplay(freqs));

      //let impulseResponse = seisplotjs.transfer.calcResponseFromSacPoleZero(sacPoleZero, numPoints, 2*first_sps);

      plot_from_packed_freq(stage, idx, freqAmp);
      all_resp.push(freqAmp);
    } else {
      let div = seisplotjs.d3.select("div.stageplot").append("div");
      let filter_class = stage.filter ? stage.filter.__proto__.constructor.name : "missing";
      let len_msg = "";
      if (! stage.filter ) {
        div.append("div").append("span").text(`Stage ${idx+1} filter is missing`);
      } else if (stage.filter instanceof seisplotjs.stationxml.CoefficientsFilter ) {
        if (stage.filter.numerator.length == 0 && stage.filter.numerator.length === 0) {
          div.append("div").append("span").text(`Stage ${idx+1} filter is length zero Coefficients`);
        } else {
          len_msg = `num: ${stage.filter.numerator.length}, denom: ${stage.filter.denominator.length}`;
          div.append("div").append("span").text(`Stage ${idx+1} filter is Coeff with denom: ${filter_class} ${len_msg}`);
        }
      } else {
        div.append("div").append("span").text(`Stage ${idx+1} filter is not plottable: ${filter_class} ${len_msg}`);
      }
    }
  });
  overlay_plot_from_coefficients(all_resp, in_sps);
}

function calc_stage_coeff(stage) {
  if (stage.filter instanceof seisplotjs.stationxml.FIR ) {
    let fir = stage.filter;
    let numPoints = Math.max(pad_size, 2*fir.numerator.length);
    //let numPoints = fir.numerator.length;
    let longCoeff;
    if (fir.symmetry == "NONE") {
      longCoeff = new Array(numPoints).fill(0);
      for(let i=0; i<fir.numerator.length; i++) {
        longCoeff[i] = fir.numerator[i];
      }
    } else if (fir.symmetry == "ODD") {
      longCoeff = new Array(2*numPoints-1).fill(0);
      for(let i=0; i<fir.numerator.length-1; i++) {
        longCoeff[i] = fir.numerator[i];
        longCoeff[2*(fir.numerator.length-1)-i] = fir.numerator[i];
      }
      longCoeff[fir.numerator.length-1] = fir.numerator[fir.numerator.length-1];
    } else if (fir.symmetry == "EVEN") {
      longCoeff = new Array(2*numPoints).fill(0);
      for(let i=0; i<fir.numerator.length; i++) {
        longCoeff[i] = fir.numerator[i];
        longCoeff[2*fir.numerator.length-1-i] = fir.numerator[i];
      }
    } else {
      throw new Error(`Unknown symmetry type: ${fir.symmetry}`);
    }
    console.log(`coeff ${fir.symmetry} ${fir.numerator.length} -> ${longCoeff.length}`)
    longCoeff.forEach(c => console.log(c))
    return longCoeff;
  } else if (stage.filter instanceof seisplotjs.stationxml.CoefficientsFilter ) {
    let numPoints = Math.max(pad_size, 2*stage.filter.numerator.length);
    if (stage.filter.denominator.length ===0 ) {
      longCoeff = new Array(numPoints).fill(0);
      for(let i=0; i<stage.filter.numerator.length; i++) {
        longCoeff[i] = stage.filter.numerator[i];
      }
      return longCoeff;
    }
  }
  // fake a unity impulse response
  longCoeff = new Array(pad_size).fill(0);
  longCoeff[0] = 1;
  return longCoeff;
}

function plot_from_packed_freq(stage, idx, impulseResponse) {
  impulseResponse.inputUnits = stage.filter.inputUnits;
  let div = seisplotjs.d3.select("div.stageplot");
  let ampdiv = div.append("div");
  ampdiv.classed("stage", true);
  const plotConfig = new seisplotjs.seismographconfig.SeismographConfig();
  let title;
  if (stage.filter && stage.filter instanceof seisplotjs.stationxml.PolesZeros) {
    title = `Stage ${idx+1} PolesZeros, poles: ${stage.filter.poles.length} , zeros: ${stage.filter.zeros.length} `;
  } else if (stage.filter && stage.filter instanceof seisplotjs.stationxml.PolesZeros) {
    title = `Stage ${idx+1} Coefficients, in sps: ${stage.decimation.inputSampleRate}, factor: ${stage.decimation.factor}, sym: ${stage.filter.symmetry} len: ${stage.filter.numerator.length} `;
  } else {
    title = `Stage ${idx+1} FIR, in sps: ${stage.decimation.inputSampleRate}, factor: ${stage.decimation.factor}, sym: ${stage.filter.symmetry} len: ${stage.filter.numerator.length} `;
  }
  plotConfig.title=title;
  plotConfig.ySublabelIsUnits = true;
  plotConfig.xLabel = "Frequency";
  plotConfig.xSublabel = "Hz";
  const fftAmpPlot = new seisplotjs.fftplot.FFTPlot(ampdiv, plotConfig, [impulseResponse], doLogLog);
  fftAmpPlot.draw();
  let phaseCB = document.querySelector("#showphase");
  if (phaseCB.value) {
    let phasediv = div.append("div");
    phasediv.classed("stage", true);
    const phasePlotConfig = plotConfig.clone();
    phasePlotConfig.title=`Phase Stage ${idx+1}`;
    const fftPhasePlot = new seisplotjs.fftplot.FFTPlot(phasediv, phasePlotConfig, [impulseResponse], doLogLog, false, true);
    fftPhasePlot.draw();
  }
  return fftAmpPlot;
}


function overlay_plot_from_coefficients(all_resp, in_samp_rate) {
  const plotConfig = new seisplotjs.seismographconfig.SeismographConfig();
  plotConfig.title=`Overlay Stages, in sps: ${in_samp_rate}`;
  let div = seisplotjs.d3.select("div.stageplot").append("div");
  div.classed("stage", true);
  div.append("p").text(`Overlay Stages`);
  const fftRatioPlot = new seisplotjs.fftplot.FFTPlot(div, plotConfig, all_resp, doLogLog);
  fftRatioPlot.draw();
}
