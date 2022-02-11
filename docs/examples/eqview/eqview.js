/*global seisplotjs */

function loadTestDataset() { //: Promise<Dataset>
  const START = seisplotjs.moment.utc("2021-12-27");
  const END = seisplotjs.moment.utc("2021-12-28");
  const NET = 'CO';
  const STA = 'BIRD,JSC';
  const CHAN = 'HHZ';
  let eventQuery = new seisplotjs.fdsnevent.EventQuery()
  .startTime(START)
  .endTime(END)
  .minLat(33).maxLat(35).minLon(-81).maxLon(-79);

  let stationQuery = new seisplotjs.fdsnstation.StationQuery()
  .networkCode(NET)
  .startTime(START).endTime(END)
  .stationCode(STA)
  .channelCode(CHAN);

  const loader = new seisplotjs.seismogramloader.SeismogramLoader(stationQuery, eventQuery);
  return seisplotjs.dataset.Dataset.fromSeismogramLoader(loader);
}

class EQView {
  constructor(dataset, cssSelector="#myseismograph") {
    this.dataset = dataset;
    this.processedData = dataset.waveforms;
    this.processChain = [];
    this.plotDiv = seisplotjs.d3.select(cssSelector);
    if (this.plotDiv.empty()) {
      throw new Error(`Can't find element for css selector '${cssSelector}'`);
    }
    this.seisChanQuakeFilter = this.defaultPlotFilter;
    this.seisIdToDisplayIdMap = new Map();
    this.organizetype = this.getCheckedOption("organizetype", "individual");
    this.sorttype = this.getCheckedOption("sorttype", "none");
    this.plottype = this.getCheckedOption("plottype", "seismograph");
    this.defaultSeismographConfig = new seisplotjs.seismographconfig.SeismographConfig();
    this.defaultSeismographConfig.title = seisplotjs.seismographconfig.DEFAULT_TITLE;
    this.infoTemplate = seisplotjs.displayorganize.defaultInfoTemplate;
  }

  getCheckedOption(name, defaultValue) {
    let s = seisplotjs.d3.select(`input[name="${name}"]:checked`);
    if (s && ! s.empty()) {
      return s.property("value");
    } else {
      s = seisplotjs.d3.select(`input[name="${name}"][value="${defaultValue}"]`);
      s.attr("checked", true);
      return defaultValue;
    }
  }

  configureDisplayFromJSON(jsonObj) {
    seisplotjs.d3.select("div.seisConfig").selectAll('*').remove();
    this.defaultSeismographConfig =
      seisplotjs.seismographconfig.SeismographConfig.fromJSON(jsonObj.display);
    this.organizetype = jsonObj.arrange.organize;
    if (this.organizetype === 'individual') {
      seisplotjs.d3.select("input#radio_organize_individual").property("checked", true);
    } else if (this.organizetype === 'bystation') {
      seisplotjs.d3.select("input#radio_organize_overlay_bystation").property("checked", true);
    } else if (this.organizetype === 'bycomponent') {
      seisplotjs.d3.select("input#radio_organize_overlay_bycomponent").property("checked", true);
    } else if (this.organizetype === 'all') {
      seisplotjs.d3.select("input#radio_organize_overlay_all").property("checked", true);
    }
    this.sorttype = jsonObj.arrange.sort;
    if (this.sorttype === 'none') {
      seisplotjs.d3.select("input#radio_sort_none").property("checked", true);
    } else if (this.sorttype === 'alphabetical') {
      seisplotjs.d3.select("input#radio_sort_alphabetical").property("checked", true);
    } else if (this.sorttype === 'bydistance') {
      seisplotjs.d3.select("input#radio_sort_bydistance").property("checked", true);
    } else if (this.sorttype === 'bybackazimuth') {
      seisplotjs.d3.select("input#radio_sort_bybackazimuth").property("checked", true);
    } else if (this.sorttype === 'byazimuth') {
      seisplotjs.d3.select("input#radio_sort_byazimuth").property("checked", true);
    }
    this.plottype = jsonObj.arrange.plot;
    if (this.plottype === 'info') {
      seisplotjs.d3.select("input#radio_info").property("checked", true);
    } else if (this.plottype === 'map') {
      seisplotjs.d3.select("input#radio_map").property("checked", true);
    } else if (this.plottype === 'seismograph') {
      seisplotjs.d3.select("input#radio_seismograph").property("checked", true);
    } else if (this.plottype === 'particlemotion') {
      seisplotjs.d3.select("input#radio_particlemotion").property("checked", true);
    } else if (this.plottype === 'amp_spectra?loglog=true') {
      seisplotjs.d3.select("input#radio_spectra_log").property("checked", true);
    } else if (this.plottype === 'amp_spectra?loglog=false') {
      seisplotjs.d3.select("input#radio_spectra_lin").property("checked", true);
    }
    if (jsonObj.infoTemplate) {
      this.infoTemplate = jsonObj.infoTemplate;
    }
    createTools(this);
  }

  getConfigAsJSON() {
    let config = this.defaultSeismographConfig.asJSON();
    let arrange = this.getArrangementAsJSON();
    let filter = this.getFilterAsJSON();
    return {
      'display': config,
      'infoTemplate': this.infoTemplate,
      'arrange': arrange,
      'filter': filter
    };
  }

  getArrangementAsJSON() {
    return {
      'organize': this.organizetype,
      'sort': this.sorttype,
      'plot': this.plottype
    };
  }

  getFilterAsJSON() {
    return {

    };
  }

  clearAll() {
    this.processedData = this.dataset.waveforms;
    seisplotjs.d3.select("#messages").selectAll("p").remove();
    this.seisChanQuakeFilter = this.defaultPlotFilter;
    this.processChain.length = 0;//clears the array
    this.updateProcessDisplay(this.processChain);
  }

  saveToZipFile() {
    let mseed3Records =
    this.dataset.waveforms.map( sdd => seisplotjs.mseed3.toMSeed3(sdd.seismogram))
    .reduce((acc,cur) => acc.concat(cur), []);
    let byteSize = mseed3Records.reduce( (acc, cur) => acc+cur.calcSize(), 0);
    let outBuf = new ArrayBuffer(byteSize);
    let offset = 0;
    mseed3Records.forEach(ms3Rec => {
      let recSize = ms3Rec.calcSize();
      console.log(`Record: ${offset} + ${recSize}  of ${byteSize}`);
      let dv = new DataView(outBuf, offset, recSize);
      ms3Rec.save(dv);
      offset += recSize;
    });
    seisplotjs.download.downloadBlobAsFile(outBuf, "waveform.ms3");
  }

  loadAllAndPlot() {
      this.createStationCheckboxes(this.dataset.waveforms, this.dataset.inventory);
      this.createBandCheckboxes(this.dataset.waveforms, this.dataset.inventory);
      this.createGainCheckboxes(this.dataset.waveforms, this.dataset.inventory);
      this.createOrientationCheckboxes(this.dataset.waveforms, this.dataset.inventory);

      this.reprocess();

      //this.replot();
  }

  reprocess() {
    if (this.dataset.waveforms && this.dataset.waveforms.length > 0) {
      this.applyProcessChain();
    }
    this.replot();
  }

  replot() {
    let filteredSeis = this.processedData.filter(sd => this.seisChanQuakeFilter(sd));
    let organizedSeis = this.organizePlotting(this.organizetype, this.plottype, this.dataset, filteredSeis);
    organizedSeis = this.sortForPlotting(this.sorttype, organizedSeis);
    this.plotDiv.selectAll('*').remove();
    console.log(`replot: ${filteredSeis.length}/${this.dataset.waveforms.length}`)
    seisplotjs.displayorganize.createPlots(organizedSeis, this.plotDiv);
    for(let os of organizedSeis) {
      if (seisplotjs.util.isDef(os.seismograph)) {
        const graph = os.seismograph;
        const canvasNode = graph.svg.select('foreignObject canvas').node();
        canvasNode.addEventListener('mousemove', evt => {
          let clickTime = graph.xAxis.scale().invert(evt.offsetX);
          clickTime = seisplotjs.moment.utc(clickTime);
          seisplotjs.d3.select('input#mousex').property('value', clickTime.toISOString());
          let clickAmp = graph.yAxis.scale().invert(evt.offsetY);
          seisplotjs.d3.select('input#mousey').property('value', formatCountOrAmp(clickAmp));
        });
      }
      if (seisplotjs.util.isDef(os.fftPlot)) {
        os.fftPlot.svg.on('mousemove', evt => {
          const fftPlot = os.fftPlot;
          const margin = fftPlot.seismographConfig.margin;
          let clickFreq = fftPlot.xAxis.scale().invert(evt.offsetX-margin.left);
          seisplotjs.d3.select('input#mousex').property('value', formatExp(clickFreq));
          let clickAmp = fftPlot.yAxis.scale().invert(evt.offsetY-margin.top);
          seisplotjs.d3.select('input#mousey').property('value', formatCountOrAmp(clickAmp));
        });
      }

      if (seisplotjs.util.isDef(os.particleMotionPlot)) {
        const particleMotionPlot = os.particleMotionPlot;
        particleMotionPlot.svg.on('mousemove', evt => {
          const margin = particleMotionPlot.seismographConfig.margin;
          let clickYAmp = particleMotionPlot.xAxis.scale().invert(evt.offsetX-margin.left);
          seisplotjs.d3.select('input#mousex').property('value', formatCountOrAmp(clickYAmp));
          let clickXAmp = particleMotionPlot.yAxis.scale().invert(evt.offsetY-margin.top);
          seisplotjs.d3.select('input#mousey').property('value', formatCountOrAmp(clickXAmp));
        });
      }
    }
  }

  applyProcessChain() {
    const that = this;
    let tmpProcessChain = this.processChain.slice();
    this.processChain.length = 0;//clears the array
    this.updateProcessDisplay(this.processChain);

    this.processedData = this.dataset.waveforms;

    tmpProcessChain.forEach(p => {
      this.processedData = this.processedData.map((sdd, index, array) => {
        return p.processFunc(sdd, index, array, this.dataset);
      });
      this.processChain.push(p);
      this.updateProcessDisplay(this.processChain);
    });
  }

  async applyAllSeismograms(processFunc, desc) {
    const p = {desc: desc, processFunc: processFunc};
    this.processedData = this.processedData.map((sdd, index, array) => {
      return p.processFunc(sdd, index, array, this.dataset);
    });
    this.processChain.push(p);
    this.updateProcessDisplay(this.processChain);
  }

  sortForPlotting(sorttype, organizedSeis) {
    let out = organizedSeis;
    if (sorttype === "none") {
      out = organizedSeis;
    } else if (sorttype === "bydistance") {
      out = seisplotjs.displayorganize.sortDistance(organizedSeis);
    } else {
      this.showErrorMessage("Sorting not yet implemented: "+sorttype);
    }
    return out;
  }

  organizePlotting(organizetype, plottype, dataset, seisDataList) {
    let organizedData = [];
    if ( ! seisDataList || seisDataList.length === 0) {
      console.log(`organizePlotting(${organizetype}, ${plottype}, dataset, seisData) seisDataList is empty`);
      return organizedData;
    }
    if (plottype === "particlemotion") {
      // particle motion is special due to pairwise plots
      organizedData = this.organizeParticleMotion(seisDataList);
    } else if (! organizetype || organizetype === "individual") {
      organizedData = seisplotjs.displayorganize.individualDisplay(seisDataList);
    } else if (organizetype === "bystation") {
      organizedData = seisplotjs.displayorganize.overlayByStation(seisDataList);
    } else if (organizetype === "bycomponent") {
      organizedData = seisplotjs.displayorganize.overlayByComponent(seisDataList);
    } else if (organizetype === "all") {
      organizedData = seisplotjs.displayorganize.overlayAll(seisDataList);
    } else if (typeof organizetype === 'function') {
      organizedData = organizetype(seisDataList);
    } else {
      throw new Error(`Unknown organize type: ${organizetype}`);
    }

    let seisConfig = this.defaultSeismographConfig.clone();
    seisConfig.doGain = seisplotjs.d3.select("input#doGain").property("checked");
    if (seisplotjs.d3.select("input#linkx").property("checked")) {
      seisConfig.linkedTimeScale = new seisplotjs.seismographconfig.LinkedTimeScale();
    }
    if (seisplotjs.d3.select("input#linky").property("checked")) {
      seisConfig.linkedAmplitudeScale = new seisplotjs.seismographconfig.LinkedAmpScale();
    }
    if (plottype === seisplotjs.displayorganize.PARTICLE_MOTION) {
      let pmpSeisConfig = seisConfig.clone();
      pmpSeisConfig.margin.left = 40;
      pmpSeisConfig.margin.right = 40;
      pmpSeisConfig.margin.top = 40;
      pmpSeisConfig.margin.bottom = 40;
      seisConfig = pmpSeisConfig;
    }
    organizedData.forEach(org => {
      org.plottype = plottype;
      org.seisConfig = seisConfig;
      org.setAttribute("infoTemplate", this.infoTemplate);
    });
    return organizedData;
  }


    organizeParticleMotion(seisDataList) {
      let organized = [];
      let byFriends = seisplotjs.displayorganize.groupComponentOfMotion(seisDataList);
      let pairs = [];
      byFriends.forEach(friendList => {
        if (friendList.length > 1) {
          friendList.forEach( (first, i) => {
            for (let j=i+1; j<friendList.length; j++) {
              pairs.push([first, friendList[j]]);
            }
          });
        } else {
          console.log(`cant find friend for ${friendList[0].codes()}`);
        }
      });
      pairs.forEach(pair => {
        if (pair[0].channelCode.charCodeAt(2) > pair[1].channelCode.charCodeAt(2)){
          let tmp = pair[0];
          pair[0] = pair[1];
          pair[1] = tmp;
        }
        let org = new seisplotjs.displayorganize.OrganizedDisplay(pair, seisplotjs.displayorganize.PARTICLE_MOTION);

        organized.push(org);
      });
      return organized;
    }

  updateProcessDisplay(processChain) {
    let pc = seisplotjs.d3.select("div#processChain ul").selectAll("li")
      .data(processChain);
    pc.enter()
      .append('li').text(d => d.desc);
    pc.exit().remove();
  }

  createStationCheckboxes(seisDataList, inventory) {
    let chanKeyFun = c => c.station.stationCode;
    let sddKeyFun = sdd => sdd.stationCode;
    let idPrefix = "station";
    this.createCheckboxes(seisDataList, inventory, chanKeyFun, sddKeyFun, idPrefix);
  }


  createBandCheckboxes(seisDataList, inventory) {
    let chanKeyFun = c => c.channelCode.charAt(0);
    let sddKeyFun = sdd => sdd.channelCode.charAt(0);
    let idPrefix = "band";
    this.createCheckboxes(seisDataList, inventory, chanKeyFun, sddKeyFun, idPrefix);
  }
  createGainCheckboxes(seisDataList, inventory) {
    let chanKeyFun = c => c.channelCode.charAt(1);
    let sddKeyFun = sdd => sdd.channelCode.charAt(1);
    let idPrefix = "gain";
    this.createCheckboxes(seisDataList, inventory, chanKeyFun, sddKeyFun, idPrefix);
  }
  createOrientationCheckboxes(seisDataList, inventory) {
    let chanKeyFun = c => c.channelCode.charAt(2);
    let sddKeyFun = sdd => sdd.channelCode.charAt(2);
    let idPrefix = "orient";
    this.createCheckboxes(seisDataList, inventory, chanKeyFun, sddKeyFun, idPrefix);
  }

  createCheckboxes(seisDataList, inventory, chanKeyFun, sddKeyFun, idPrefix) {
    let outPromise = [];
    if (inventory) {
      // get from inventory if we have it
      let chanList = seisplotjs.stationxml.allChannels(inventory);
      for(let c of chanList) {
        outPromise.push(chanKeyFun(c));
      }
    }
    if (seisDataList) {
      // get from seismograms
      seisDataList.forEach(sdd => outPromise.push(sddKeyFun(sdd)));
    }
    return Promise.all(outPromise).then(staCodeList => {
      let staCodeSet = new Set(staCodeList);
      return Array.from(staCodeSet).sort();
    }).then(staList => {
      staList.sort();
      seisplotjs.d3.select(`div#${idPrefix}_checkbox`).selectAll("span")
        .data(staList, s => s)
        .join(enter => {
          let span = enter.append("span").attr('sta', s=>s);
          span.append("input")
            .attr("type", "checkbox")
            .attr("id", function(d) { return `${idPrefix}${d}`; })
            .attr("value", function(d) { return d; })
            .property("checked", true)
            .on("change", () => {
              this.replot();
            });
          span.append("label")
            .attr('for', function(d) { return d; })
            .text(function(d) { return d; });
          });
    }).catch(error => {
      this.showErrorMessage("Error create checkboxes." +error);
      console.error(error);
    });
  }

  stationFilter(sdd) {
    const inputId = `input#station${sdd.stationCode}`;
    return this.inputIdFilter(inputId);
  }


  orientFilter(sdd) {
    const inputId = `input#orient${sdd.channelCode.charAt(2)}`;
    return this.inputIdFilter(inputId);
  }

  bandFilter(sdd) {
    const inputId = `input#band${sdd.channelCode.charAt(0)}`;
    return this.inputIdFilter(inputId);
  }

  gainFilter(sdd) {
    const inputId = `input#gain${sdd.channelCode.charAt(1)}`;
    return this.inputIdFilter(inputId);
  }

  inputIdFilter(inputId) {
      let out = true; // plot by default
      if ( ! seisplotjs.d3.select(inputId).empty()) {
        out = seisplotjs.d3.select(inputId).property("checked");
      }
      return out;
  }

  defaultPlotFilter(sdd) {
    return this.stationFilter(sdd)
        && this.bandFilter(sdd)
        && this.gainFilter(sdd)
        && this.orientFilter(sdd);
  }


  showErrorMessage(error) {
    seisplotjs.d3.select("#messages").append("p").classed("errormsg", true).text(error);
  }

}



const formatCount = seisplotjs.d3.format('.4~s');
const formatExp = seisplotjs.d3.format('.4e');
const formatCountOrAmp = function(v) {
  return -1<v && v<1 && v !== 0 ? formatExp(v) : formatCount(v);
};
