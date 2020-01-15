/*global seisplotjs */

class ViewObsPy {
  constructor(baseUrl, cssSelector="#myseismograph") {
    this.baseUrl = baseUrl;
    this.obspyData = new Map();
    this.processedData = new Map();
    this.processChain = [];
    this.plotDiv = seisplotjs.d3.select(cssSelector);
    if (this.plotDiv.empty()) {
      throw new Error(`Can't find element for css selector '${cssSelector}'`);
    }
    this.seisChanQuakeFilter = (seis, chan, quake) => {return this.defaultPlotFilter(seis, chan, quake);};
  }
  clearAll() {
    this.processedData.clear();
    this.processChain.length = 0;//clears the array
    this.updateProcessDisplay(this.processChain);
    this.obspyData.clear();
    seisplotjs.d3.select("#messages").selectAll("p").remove();
  }

  checkProcessedDatasetLoaded() {
    if (! this.processedData.has('dataset')) {
      this.processedData.set('dataset', this.obspyData.get('dataset'));
    }
  }

  /**
   * Plots seismographs for seismograms from the dataset satisfying the filter.
   *
   * @param {object}  dataset             dataset
   * @param {string} plottype type of plot, seismograph, spectra_log, spectra_lin, particlemotion
   * @param {Function} seisChanQuakeFilter function(seismogram, channel, quake) that
   * returns true if it should be plotted.
   */
  plotDataset(dataset, plottype, seisChanQuakeFilter) {
    seisplotjs.d3.select("#title").text(dataset.data.attributes.title);
    const keyFunc =  d => `${d.id}_${plottype}`;
    let graphEnter = this.plotDiv.selectAll("div")
      .data(dataset.data.relationships.seismograms.data, keyFunc)
      .join("div")
      .attr('seis', this.createSeisKey)
      .attr('plottype', plottype);
    dataset.data.relationships.seismograms.data.forEach(d => {
      const seisKey = this.createSeisKey(d);
      if ( this.processedData.has(seisKey)) {
        this.createPlot(seisKey, plottype, seisChanQuakeFilter)
        .catch(err => {
          graphEnter.append("p").text(`${err.message}`);
          console.error(err);
        });
      } else {
        graphEnter.append("p").text(`${d.type} ${d.id}`);
      }
    });
  }

  linkAllTimeAxis() {
    let dolink = seisplotjs.d3.select("input#linkx").property("checked");
    let prefix = 'graph';
    let first = null;
    if (dolink) {
      this.processedData.forEach((val, key) => {
        if (key.startsWith(prefix)) {
          if (first) {
            first.linkXScaleTo(val);
          } else {
            first = val;
          }
        }
      });
    } else {
      this.processedData.forEach((val, key) => {
        if (key.startsWith(prefix)) {
          if (first) {
            first.unlinkXScaleTo(val);
          } else {
            first = val;
          }
        }
      });
    }
  }
  linkAllAmpAxis() {
    let dolink = seisplotjs.d3.select("input#linky").property("checked");
    let prefix = 'graph';
    let allGraphs = [];
    this.processedData.forEach((val, key) => {
      if (key.startsWith(prefix)) {
        allGraphs.push(val);
      }
    });

    if (dolink) {
      const linker = new seisplotjs.seismograph.LinkedAmpScale(allGraphs);
      linker.recalculate();
    } else {
      this.processedData.forEach((val, key) => {
        if (key.startsWith(prefix)) {
          val.linkedAmpScale = new seisplotjs.seismograph.LinkedAmpScale([val]);
          val.linkedAmpScale.recalculate();
        }
      });
    }
  }

  doGain() {
    let doGain = seisplotjs.d3.select("input#doGain").property("checked");
    let prefix = 'graph';
    this.processedData.forEach((val, key) => {
      if (key.startsWith(prefix)) {
        val.seismographConfig.doGain = doGain;
        val.redoDisplayYScale();
      }
    });
  }

  loadAllAndPlot() {
    const that = this;
    const plottype = seisplotjs.d3.select('input[name="plottype"]:checked').property("value");
    return this.loadDataset().then(dataset => {
        this.plotDataset(dataset, plottype, this.seisChanQuakeFilter);
        let quakePromise = this.loadQuake(dataset);
        let inventoryPromise = this.loadInventory(dataset).then(inventory => {
          this.createStationCheckboxes(null, inventory);
          return inventory;
        });
        return Promise.all([dataset, quakePromise, inventoryPromise]);
      }).then( ( [ dataset, quake, inventory ] ) => {
        let allSeisPromises = dataset.data.relationships.seismograms.data.map(d => {
          const seisId = this.createSeisKey(d);
          return this.loadSingleSeismogram(seisId, false).then(seis =>{
            return that.createPlot(seisId, plottype, this.seisChanQuakeFilter);
          });
        });
        allSeisPromises = Promise.all(allSeisPromises).then( allSeis => {
          this.createStationCheckboxes(dataset, null);
          return allSeis;
        });
        return Promise.all([dataset, allSeisPromises, quake, inventory]);
      }).then( ( [ dataset, allSeis, quake, inventory ] ) => {
      //  this.plotDataset(dataset, plottype, this.seisChanQuakeFilter);
        return Promise.all([dataset, allSeis, quake, inventory]);
      }).catch( function(error) {
        that.showErrorMessage("Error loading data. " +error);
        console.error(error);
      });
  }

  loadDataset() {
    const datasetUrl = new URL('/dataset', this.baseUrl);
    return seisplotjs.util.doFetchWithTimeout(datasetUrl).then(response => {
      return response.json();
    }).then(dataset => {
        this.obspyData.set('dataset', dataset);
        return dataset;
    });
  }

  loadSingleSeismogram(seisKey, force=false) {
    const that = this;
    if ( ! force && this.obspyData.has(seisKey)) {
      return Promise.resolve(this.obspyData.get(seisKey));
    }
    // load from obspy
    const seisBaseUrl = `/seismograms/${this.extractIdFromSeisKey(seisKey)}`;
    const seisUrl = new URL(`${seisBaseUrl}/mseed`, this.baseUrl);
    const statsUrl = new URL(`${seisBaseUrl}/stats`, this.baseUrl);
    const seisPromise = seisplotjs.mseedarchive.loadDataRecords( [ seisUrl ] );
    const fetchInit = seisplotjs.util.defaultFetchInitObj(seisplotjs.util.JSON_MIME);
    const statsPromise = seisplotjs.util.doFetchWithTimeout(statsUrl, fetchInit)
          .then(function(response) {
            let contentType = response.headers.get('content-type');
            if(contentType && contentType.includes(seisplotjs.util.JSON_MIME)) {
              return response.json();
            }
            // $FlowFixMe
            throw new TypeError(`Oops, we did not get JSON! ${contentType}`);
          });

    return Promise.all([seisPromise, statsPromise])
        .then( ( [dataRecords, stats] ) => {
          if (dataRecords.length === 0) {
            this.showErrorMessage(`No data records from ${seisUrl}`);
            return null;
          }
          console.log(`stats: ${JSON.stringify(stats)}`);
          let seisArray = seisplotjs.miniseed.seismogramPerChannel(dataRecords);
          if (seisArray.length !== 0) {
            let seis = seisArray[0]; // assume only first matters
            this.obspyData.set(seisKey, seis);
            this.obspyData.set(seisKey+"/stats", stats);
            return seis;
          } else {
            console.warn(`Oops, server did not return data for ${seisUrl}`);
            return null;
          }
        }).catch( function(error) {
          that.showErrorMessage(`Error loading data from ${seisUrl}, ${error}`);
          console.error(error);
        });
  }

  loadQuake(dataset) {
    let quake = null;
    if (dataset.data.relationships.quake.data.id) {
      const qid = dataset.data.relationships.quake.data.id;
      const quakeUrl = new URL(`/quake/${qid}`, this.baseUrl);
      quake = seisplotjs.util.doFetchWithTimeout(quakeUrl).then(response => {
        return response.text();
      }).then(xml => {
        return (new window.DOMParser()).parseFromString(xml, "text/xml");
      }).then(quakeml => {
        return seisplotjs.quakeml.parseQuakeML(quakeml);
      }).then(quakeml => {
        this.obspyData.set('quake', quakeml);
        return quakeml;
      }).catch( function(error) {
        this.showErrorMessage(`Error loading quake, ${error}`);
        console.error(error);
      });
    }
    return quake;
  }

  loadInventory(dataset) {
    let inventory = Promise.resolve([]);
    if (dataset.data.relationships.inventory.data.id) {
      const qid = dataset.data.relationships.inventory.data.id;
      const inventoryUrl = new URL('/inventory', this.baseUrl);
      inventory = seisplotjs.util.doFetchWithTimeout(inventoryUrl).then(response => {
        return response.text();
      }).then(xml => {
        return (new window.DOMParser()).parseFromString(xml, "text/xml");
      }).then(stationxml => {
        return seisplotjs.stationxml.parseStationXml(stationxml);
      }).then(netList => {
        this.obspyData.set('inventory', netList);
        return netList;
      }).catch( function(error) {
        this.showErrorMessage(`Error loading inventory, ${error}`);
        console.error( error);
      });
    }
    return inventory;
  }

  findChannelForSeismogram(seismogram) {
    if (this.obspyData.has('inventory')) {
      let chanList = seisplotjs.stationxml.findChannels(
        this.obspyData.get('inventory'),
        seismogram.networkCode,
        seismogram.stationCode,
        seismogram.locationCode,
        seismogram.channelCode);
      for(let c of chanList) {
        if (c.timeRange.overlaps(seismogram.timeRange)) {
          return c;
        }
      }
    }
    return null;
  }

  applyProcessChain() {
    this.processedData.clear();
    let tmpProcessChain = Array.from(this.processChain);
    this.processChain.length = 0;//clears the array
    this.updateProcessDisplay(this.processChain);
    return this.loadAllAndPlot().then( ( [dataset, seisArray, quake, inventory ] ) => {
      this.processedData.set('dataset', dataset);
      let promiseArray = dataset.data.relationships.seismograms.data.map(d => {
        const seisKey = this.createSeisKey(d);
        let promiseSeis = this.loadSingleSeismogram(seisKey);
        tmpProcessChain.forEach(p => {
          promiseSeis = promiseSeis.then((seis) => {
            if (seis) {
              seis = p.processFunc(seis);
            }
            return seis;
          });
        });
        return promiseSeis.then( seis => {
          if (seis) {
            seisplotjs.d3.selectAll(`div[seis=${seisKey}]`).each( d,i => {
              const plottype = this.attr('plottype');
              that.updatePlot(seisKey, plottype, that.seisChanQuakeFilter);
            });
          }
          return seis;
        }).catch(err => {
          this.showErrorMessage(err);
          throw err;
        });
      });
      return Promise.all(promiseArray).then(() => {
        tmpProcessChain.forEach(p => this.processChain.push(p));
        this.updateProcessDisplay(this.processChain);
      });
    });
  }


  getSeismogram(seisKey) {
    if ( ! this.processedData.has(seisKey)) {
      return this.loadSingleSeismogram(seisKey).then(seis => {
        let clonedSeis = seis.clone();
        this.processedData.set(seisKey, clonedSeis);
        return clonedSeis;
      });
    }
    return Promise.resolve(this.processedData.get(seisKey));
  }

  applyAllSeismograms(processFunc, desc) {
    const that = this;
    this.processChain.push({desc: desc, processFunc: processFunc});
    this.updateProcessDisplay(this.processChain);
    this.checkProcessedDatasetLoaded();
    let dataset = this.processedData.get('dataset');

    return Promise.all(dataset.data.relationships.seismograms.data.map(d => {
      const seisKey = this.createSeisKey(d);
      return this.getSeismogram(seisKey).then(seis => processFunc(seis))
        .then(seis => {
          this.processedData.set(seisKey, seis);
          let allPromises = [];
          this.plotDiv.selectAll(`div[seis=${seisKey}][plottype]`).each( function(d,i) {
            const plottype = seisplotjs.d3.select(this).attr('plottype');
            allPromises.push( that.updatePlot(seisKey, plottype, that.seisChanQuakeFilter));
          });
          return Promise.all(allPromises);
        }).catch(err => {
          this.showErrorMessage(err);
          throw err;
        });
    }));
  }

  createPlot(seisId, plottype, seisChanQuakeFilter) {
    let selectedDiv = this.plotDiv.select(`div[seis=${seisId}][plottype=${plottype}]`);
    if (selectedDiv.empty()) {
      selectedDiv = this.plotDiv.append("div")
      .attr('seis', seisId)
      .attr('plottype', plottype);
    }
    return this.getSeismogram(seisId).then(seismogram => {
      if (seismogram) {
        selectedDiv.selectAll('*').remove();
        let seisData = this.initSeisData(seisId, seismogram);
        if ( ! seisChanQuakeFilter || seisChanQuakeFilter(seismogram, seisData.channel, seisData.quake)) {
          if (plottype === 'seismograph') {
            return this.createGraph(selectedDiv, seisId, seisData);
          } else if (plottype === 'spectra_lin') {
            return this.createSpectra(selectedDiv, seisId, seisData, false);
          } else if (plottype === 'spectra_log') {
            return this.createSpectra(selectedDiv, seisId, seisData, true);
          } else if (plottype === 'particlemotion') {
            return this.createParticleMotion(selectedDiv, seisId, seisData);
          } else {
            throw new Error(`unknwon plot type: ${plottype}`);
          }
        } else {
          selectedDiv.remove();
          let graphKey = `graph${this.extractIdFromSeisKey(seisId)}`;
          this.processedData.delete(graphKey);

        }
      } else {
        throw new Error(`seismogram for ${seisId} is null!`);
      }
    });
  }

  initSeisData(seisId, seismogram) {
    let seisData = seisplotjs.seismogram.SeismogramDisplayData.fromSeismogram(seismogram);
    seisData.id = seisId;
    let c = this.findChannelForSeismogram(seismogram);
    if (c ) { seisData.channel = c;}
    let q = null;
    if (this.obspyData.has(`quake`) && this.obspyData.get(`quake`)){
      q = this.obspyData.get(`quake`);
      seisData.addQuake( q);
    }
    return seisData;
  }

  updatePlot(seisId, plottype, seisChanQuakeFilter) {
    try {
      const selectedDiv = seisplotjs.d3.select(`div[seis=${seisId}][plottype=${plottype}]`);
      if (plottype === 'seismograph') {
        return this.updateGraph(seisId, this.processedData.get(seisId));
      } else if (plottype === 'spectra') {
        selectedDiv.selectAll('*').remove();
        return this.createPlot(seisId, plottype, seisChanQuakeFilter);
      } else if (plottype === 'particlemotion') {
        selectedDiv.selectAll('*').remove();
        return this.createPlot(seisId, plottype, seisChanQuakeFilter);
      }
    } catch(err) {
      console.error(err);
    }
  }

  createGraph(selectedDiv, seisKey, seisData) {
    let seisConfig = new seisplotjs.seismographconfig.SeismographConfig();
    seisConfig.title = seisData.codes();
    seisConfig.doGain = seisplotjs.d3.select("input#doGain").property("checked");
    if (seisData.quakeList.length > 0) {
      let phaseMarkers = [];
      seisData.quakeList.forEach(q => {
        phaseMarkers.push({
          markertype: 'predicted',
          name: "origin",
          time: seisplotjs.moment.utc(q.time)
        });
      });
      seisData.addMarkers(phaseMarkers);
      console.log(`add markers: ${phaseMarkers.length}`);
    } else {
      console.log("no quake");
    }

    let graph = new seisplotjs.seismograph.Seismograph(selectedDiv, seisConfig, seisData);
    graph.draw();
    let graphKey = `graph${this.extractIdFromSeisKey(seisKey)}`;
    this.processedData.set(graphKey, graph);
    this.linkAllTimeAxis();
    this.linkAllAmpAxis();
    const canvasNode = graph.svg.select('foreignObject canvas').node();
    graph.svg.select('foreignObject canvas').on('mousemove', evt => {
      const rect = canvasNode.getBoundingClientRect();
      let coords = [event.pageX-rect.left, event.pageY-rect.top ];
      let clickTime = graph.currZoomXScale.invert(coords[0]);
      clickTime = seisplotjs.moment.utc(clickTime);
      seisplotjs.d3.select('input#mousex').property('value', clickTime.toISOString());
      let clickAmp = graph.yScaleRmean.invert(coords[1]);
      seisplotjs.d3.select('input#mousey').property('value', formatCountOrAmp(clickAmp));
    });
    return graph;
  }

  updateGraph(seisKey, seis) {
    let graphKey = `graph${this.extractIdFromSeisKey(seisKey)}`;
    let graph = this.processedData.get(graphKey);
    let sdd = graph.seisDataList.find(sdd => sdd.id === seisKey);
    sdd.seismogram = seis;
    graph.calcAmpScaleDomain();
    graph.redoDisplayYScale();
    graph.draw();
    return graph;
  }

  createSpectra(selectedDiv, seisKey, seisData, loglog=true) {
    if (this.processedData.has(seisKey)) {
      selectedDiv.selectAll('*').remove();
      return this.getSeismogram(seisKey).then(seismogram => {
      let fft = seisplotjs.fft.fftForward(seismogram);
      let fftList = [ fft ];
      let seisConfig = new seisplotjs.seismographconfig.SeismographConfig();
      let fftPlot = new seisplotjs.fftplot.FFTPlot(selectedDiv, seisConfig, fftList, loglog);
      fftPlot.draw();
      fftPlot.svg.append("g").classed("title", true)
        .attr("transform", "translate(600, 10)")
        .append("text").classed("title label", true)
        .selectAll("tspan")
        .data(d => [seismogram])
        .enter()
        .append("tspan")
      .text(seismogram => " "+seismogram.codes()+" ");

// add rect to get mouse events even over blank areas
      fftPlot.svg.select('g.allfftpaths')
        .append("rect")
        .attr("x", 0).attr('y', 0).attr("width", '100%').attr('height', '100%')
        .attr('fill', "transparent")
        .attr('pointer-events', 'all')
        .on('mousemove', evt => {
          const node = fftPlot.svg.select('g.allfftpaths').node();
          const rect = node.getBoundingClientRect();
          let coords = [event.pageX-rect.left, event.pageY-rect.top ];
          let clickFreq = fftPlot.xScale.invert(coords[0]);
          seisplotjs.d3.select('input#mousex').property('value', formatExp(clickFreq));
          let clickAmp = fftPlot.yScale.invert(coords[1]);
          seisplotjs.d3.select('input#mousey').property('value', formatCountOrAmp(clickAmp));
        });
        return fftPlot;
      });
    } else {
      console.warn(`seis no loaded`);
    }
    return null;
  }

  createParticleMotion(selectedDiv, seisId, seisData) {
    // find pair, x => y, y => z, z=> x
    let otherId = null;
    let hSeisData = seisData;
    let vSeisId = null;
    let vSeisData = null;
    if (this.orientEFilter(seisData.seismogram, seisData.channel, seisData.quake)) {
      otherId = this.findSeismogramFriendId(seisData.seismogram, this.orientNFilter);
      vSeisId = otherId;
    }
    if (this.orientNFilter(seisData.seismogram, seisData.channel, seisData.quake)) {
      otherId = this.findSeismogramFriendId(seisData.seismogram, this.orientZFilter);
      vSeisId = otherId;
    }
    if (this.orientZFilter(seisData.seismogram, seisData.channel, seisData.quake)) {
      otherId = this.findSeismogramFriendId(seisData.seismogram, this.orientEFilter);
      vSeisId = seisId;
    }
    if (otherId) {
      return this.getSeismogram(otherId).then(otherSeismogram => {
        let otherSeisData = this.initSeisData(otherId, otherSeismogram);
        if (this.seisChanQuakeFilter(otherSeisData.seismogram, otherSeisData.channel, otherSeisData.quake)) {
          // only draw if both pass filter
          if (vSeisId === otherId) {
            hSeisData = seisData;
            vSeisData = otherSeisData;
          } else {
            hSeisData = otherSeisData;
            vSeisData = seisData;
          }
          let timeWindow = null;
          let pmp = seisplotjs.particlemotion.addParticleMotion(selectedDiv, hSeisData, vSeisData, timeWindow);
          pmp.seismographConfig.title = [hSeisData.codes(), vSeisData.codes()];
          pmp.drawTitle();
        }
      });
    } else {
      selectedDiv.append("p").text(`Can't find friends for particle motion for ${seisData.codes()}`);
    }
  }

  findSeismogramFriendId(seismogram, otherFilter) {
    let dataset = this.obspyData.get('dataset');
    let out = dataset.data.relationships.seismograms.data.find(d => {
      const seisKey = this.createSeisKey(d);
      if (this.processedData.has(seisKey)) {
        let otherseismogram = this.processedData.get(seisKey);
        return otherFilter(otherseismogram, null, null)
          && otherseismogram.stationCode === seismogram.stationCode
          && otherseismogram.networkCode === seismogram.networkCode;
      } else {
        return false;
      }
    });
    if (out) {
      return this.createSeisKey(out);
    } else {
      return null;
    }
  }

  updateProcessDisplay(processChain) {
    let pc = seisplotjs.d3.select("div#processChain ul").selectAll("li")
      .data(processChain);
    pc
      .enter()
      .append('li').text(d => d.desc);
    pc.exit().remove();
  }

  createStationCheckboxes(dataset, inventory) {
    let outPromise;
    if (inventory) {
      // get from inventory if we have it
      let chanList = seisplotjs.stationxml.allChannels(inventory);
      let staList = [];
      for(let c of chanList) {
        staList.push(c.station.stationCode);
      }
      outPromise = Promise.all(staList);
    } else if (dataset) {
      // get from seismograms
      outPromise = Promise.all(dataset.data.relationships.seismograms.data.map(d => {
        const seisKey = this.createSeisKey(d);
        return this.getSeismogram(seisKey).then(seis => seis.stationCode);
      }));
    } else {
      outPromise = Promise.all([]); // none yet
    }
    return outPromise.then(staCodeList => {
      let staCodeSet = new Set(staCodeList);
      return Array.from(staCodeSet).sort();
    }).then(staList => {
      const that = this;
      seisplotjs.d3.select("div#station_checkbox").selectAll("span")
        .data(staList, s => s)
        .join(enter => {
          let span = enter.append("span").attr('sta', s=>s);
          span.append("input")
            .attr("type", "checkbox")
            .attr("id", function(d) { return d; })
            .attr("value", function(d) { return d; })
            .property("checked", true)
            .on("change", () => {
              let dataset = this.obspyData.get('dataset');
              const plottype = seisplotjs.d3.select('input[name="plottype"]:checked').property("value");
              this.plotDataset(dataset, plottype, that.seisChanQuakeFilter);
            });
          span.append("label")
            .attr('for', function(d) { return d; })
            .text(function(d) { return d; });
          });
    }).catch(error => {
      this.showErrorMessage("Error station checkboxes." +error);
      console.error(error);
    });
  }

  stationFilter(seis, chan, quake) {
    let out = true; // plot by default
    if ( ! seisplotjs.d3.select(`input#${seis.stationCode}`).empty()) {
      out = seisplotjs.d3.select(`input#${seis.stationCode}`).property("checked");
    }
    return out;
  }

  orientZFilter(seis, chan, quake) {
    return seis.channelCode.endsWith('Z');
  }
  orientNFilter(seis, chan, quake) {
    return seis.channelCode.endsWith('N')
      || seis.channelCode.endsWith('Y')
      || seis.channelCode.endsWith('1');
  }
  orientEFilter(seis, chan, quake) {
    return seis.channelCode.endsWith('E')
      || seis.channelCode.endsWith('X')
      || seis.channelCode.endsWith('2');
  }

  defaultPlotFilter(seis, chan, quake) {
    let doZ = seisplotjs.d3.select("input#orientz").property("checked");
    let doN = seisplotjs.d3.select("input#orienty").property("checked");
    let doE = seisplotjs.d3.select("input#orientx").property("checked");
    return this.stationFilter(seis, chan, quake)
        && ((doZ && this.orientZFilter(seis, chan, quake))
        || (doN && this.orientNFilter(seis, chan, quake))
        || (doE && this.orientEFilter(seis, chan, quake)));
  }

  createSeisKey(d) {
    return `seis${d.id}`;
  }
  extractIdFromSeisKey(seisKey) {
    if (seisKey.startsWith('seis')) {
      return seisKey.substring(4);
    }
    throw new Error(`seisKey must start with "seis"`);
  }

  showErrorMessage(error) {
    seisplotjs.d3.select("#messages").append("p").classed("errormsg", true).text(error);
  }
} // end ViewObsPy


const formatCount = seisplotjs.d3.format('.4~s');
const formatExp = seisplotjs.d3.format('.4e');
const formatCountOrAmp = function(v) {
  return -1<v && v<1 && v !== 0 ? formatExp(v) : formatCount(v);
};
