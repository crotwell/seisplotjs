
class ViewObsPy {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.obspyData = new Map();
    this.processedData = new Map();
    this.processChain = [];
    this.plotDiv = seisplotjs.d3.select("#myseismograph");
    this.seisChanQuakeFilter = (seis, chan, quake) => {return this.defaultPlotFilter(seis, chan, quake)};
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
   * @param {Dataset}  dataset             dataset
   * @param {function} seisChanQuakeFilter function(seismogram, channel, quake) that
   * returns true if it should be plotted.
   */
  plotDataset(dataset, plottype, seisChanQuakeFilter) {
    seisplotjs.d3.select("#title").text(dataset.data.attributes.title);
    const keyFunc =  d => `${d.id}_${plottype}`;
    let graphEnter = this.plotDiv.selectAll("div")
      .data(dataset.data.relationships.seismograms.data, keyFunc)
      .join("div")
      .attr("id", d=>`seis${d.id}`)
      .attr('seisId', d => d.id);
    dataset.data.relationships.seismograms.data.forEach(d => {
      const seisId = d.id;
      const key = `/seismograms/${seisId}`;
      if ( this.processedData.has(key)) {
        this.createPlot(seisId, plottype, seisChanQuakeFilter);
      } else {
        graphEnter.append("p").text(`${d.type} ${d.id}`);
      }
    });
  }

  linkAllTimeAxis() {
    let dolink = seisplotjs.d3.select("input#linkx").property("checked");
    let prefix = '/seismograph/';
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
    let prefix = '/seismograph/';
    let first = null;
    if (dolink) {
      this.processedData.forEach((val, key) => {
        if (key.startsWith(prefix)) {
          if (first) {
            first.linkYScaleTo(val);
          } else {
            first = val;
          }
        }
      });
    } else {
      this.processedData.forEach((val, key) => {
        if (key.startsWith(prefix)) {
          if (first) {
            first.unlinkYScaleTo(val);
          } else {
            first = val;
          }
        }
      });
    }
  }

  loadAllAndPlot() {
    const that = this;
    const plottype = seisplotjs.d3.select('input[name="plottype"]:checked').property("value");
    return this.loadDataset(this.baseUrl).then(dataset => {
        this.plotDataset(dataset, plottype, this.seisChanQuakeFilter);
        let quakePromise = this.loadQuake(dataset);
        let inventoryPromise = this.loadInventory(dataset).then(inventory => {
          this.createStationCheckboxes(null, inventory);
          return inventory;
        });
        return Promise.all([dataset, quakePromise, inventoryPromise]);
      }).then( ( [ dataset, quake, inventory ] ) => {
        let allSeisPromises = dataset.data.relationships.seismograms.data.map(d => {
          const seisId = d.id;
          return this.loadSingleSeismogram(d.id, false).then(seis =>{
            that.createPlot(seisId, plottype, this.seisChanQuakeFilter)
          });
        });
        allSeisPromises = Promise.all(allSeisPromises).then( allSeis => {
          this.createStationCheckboxes(dataset, null);
          return allSeis;
        });
        return Promise.all([dataset, allSeisPromises, quake, inventory]);
      }).then( ( [ dataset, allSeis, quake, inventory ] ) => {
      //  this.plotDataset(dataset, plottype, this.seisChanQuakeFilter);
        return Promise.all([dataset, allSeis, quake, inventory])
      }).catch( function(error) {
        seisplotjs.d3.select("#messages").append("p").classed("errormsg", true).text("Error loading data. " +error);
        console.error(error);
      });
  }

  loadDataset(baseUrl) {
    const datasetUrl = new URL('/dataset', baseUrl);
    return seisplotjs.util.doFetchWithTimeout(datasetUrl).then(response => {
      return response.json();
    }).then(dataset => {
        this.obspyData.set('dataset', dataset);
        return dataset;
    });
  }

  loadSingleSeismogram(seisid, force=false) {
    const seisUrl = `/seismograms/${seisid}`;
    if ( ! force && this.obspyData.has(seisUrl)) {
      return Promise.resolve(this.obspyData.get(seisUrl));
    }
    // load from obspy
    return seisplotjs.mseedarchive.loadDataRecords( [ seisUrl ] )
        .then(dataRecords => {
          let seisArray = seisplotjs.miniseed.seismogramPerChannel(dataRecords);
          if (seisArray.length != 0) {
            let seis = seisArray[0]; // assume only first matters
            this.obspyData.set(seisUrl, seis);
            return seis;
          } else {
            console.warn(`Oops, server did not return data for ${seisUrl}`);
            return null;
          }
        }).catch( function(error) {
          seisplotjs.d3.select("#messages").append("p").classed("errormsg", true).text(`Error loading data from ${seisUrl}, ${error}`);
          console.error(error);
        });
  }

  loadQuake(dataset) {
    let quake = null;
    if (dataset.data.relationships.quake.data.id) {
      const qid = dataset.data.relationships.quake.data.id;
      quake = seisplotjs.util.doFetchWithTimeout(`/quake/${qid}`).then(response => {
        return response.text();
      }).then(xml => {
        return (new window.DOMParser()).parseFromString(xml, "text/xml");
      }).then(quakeml => {
        return seisplotjs.quakeml.parseQuakeML(quakeml);
      }).then(quakeml => {
        this.obspyData.set('quake', quakeml);
        return quakeml;
      }).catch( function(error) {
        seisplotjs.d3.select("#messages").append("p").classed("errormsg", true).text(`Error loading quake, ${error}`);
        console.error(error);
      });
    }
    return quake;
  }

  loadInventory(dataset) {
    let inventory = Promise.resolve([]);
    if (dataset.data.relationships.inventory.data.id) {
      const qid = dataset.data.relationships.inventory.data.id;
      inventory = seisplotjs.util.doFetchWithTimeout(`/inventory`).then(response => {
        return response.text();
      }).then(xml => {
        return (new window.DOMParser()).parseFromString(xml, "text/xml");
      }).then(stationxml => {
        return seisplotjs.stationxml.parseStationXml(stationxml);
      }).then(netList => {
        this.obspyData.set('inventory', netList);
        return netList;
      }).catch( function(error) {
        seisplotjs.d3.select("#messages").append("p").classed("errormsg", true).text(`Error loading inventory, ${error}`);
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
        const seisId = d.id;
        let promiseSeis = this.loadSingleSeismogram(d.id);
        tmpProcessChain.forEach(p => {
          promiseSeis = promiseSeis.then((seis) => {
            return p.processFunc(seis);
          });
        });
        return promiseSeis.then( seis => {
          this.updateGraph(seisId, seis);
          return seis;
        }).catch(err => {
          seisplotjs.d3.select("#messages").append("p").classed("errormsg", true).text(err);
          throw err;
        });
      });
      return Promise.all(promiseArray).then(() => {
        tmpProcessChain.forEach(p => this.processChain.push(p));
        this.updateProcessDisplay(this.processChain);
      });
    });
  }


  getSeismogram(id) {
    const key = `/seismograms/${id}`;
    if ( ! this.processedData.has(key)) {
      return this.loadSingleSeismogram(id).then(seis => {
        let clonedSeis = seis.clone();
        this.processedData.set(key, clonedSeis);
        return clonedSeis;
      });
    }
    return Promise.resolve(this.processedData.get(key));
  }

  applyAllSeismograms(processFunc, desc) {
    this.processChain.push({desc: desc, processFunc: processFunc});
    this.updateProcessDisplay(this.processChain);
    this.checkProcessedDatasetLoaded();
    let dataset = this.processedData.get('dataset');
    return Promise.all(dataset.data.relationships.seismograms.data.map(d => {
      const key = `/seismograms/${d.id}`;
      return this.getSeismogram(d.id).then(seis => processFunc(seis))
        .then(seis => {
          this.processedData.set(key, seis);
          this.updateGraph(d.id, seis)
        }).catch(err => {
          seisplotjs.d3.select("#messages").append("p").classed("errormsg", true).text(err);
          throw err;
        });
    }));
  }

  createPlot(seisId, plottype, seisChanQuakeFilter) {
    const selectedDiv = seisplotjs.d3.select(`div#seis${seisId}`);
    selectedDiv.classed('seismograph', false)
      .classed('spectra', false)
      .classed('spectra_lin', false)
      .classed('spectra_log', false)
      .classed('particlemotion', false);
    const seisUrl = `/seismograms/${seisId}`;
    return this.getSeismogram(seisId).then(seismogram => {
      try {
        selectedDiv.selectAll('*').remove();
        let seisData = this.initSeisData(seisId, seismogram);
        if ( ! seisChanQuakeFilter || seisChanQuakeFilter(seismogram, seisData.channel, seisData.quake)) {
          selectedDiv.classed(plottype, true);
          if (plottype === 'seismograph') {
            this.createGraph(selectedDiv, seisId, seisData);
          } else if (plottype === 'spectra_lin') {
            this.createSpectra(selectedDiv, seisId, seisData, false);
          } else if (plottype === 'spectra_log') {
            this.createSpectra(selectedDiv, seisId, seisData, true);
          } else if (plottype === 'particlemotion') {
            this.createParticleMotion(selectedDiv, seisId, seisData);
          } else {
            console.warn(`unknwon plot type: ${plottype}`)
          }
        } else {
          selectedDiv.selectAll('*').remove();
        }
      } catch(err) {
        console.error(err);
      }
    });
  }

  initSeisData(seisId, seismogram) {
    let seisData = seisplotjs.seismogram.SeismogramDisplayData.fromSeismogram(seismogram);
    seisData.id = seisId;
    let c = this.findChannelForSeismogram(seismogram);
    if (c ) { seisData.channel = c;}
    let q = null
    if (this.obspyData.has(`quake`) && this.obspyData.get(`quake`)){
      q = this.obspyData.get(`quake`);
      seisData.addQuake( q);
    }
    return seisData;
  }

  updatePlot(seisId, plottype, seisChanQuakeFilter) {
    try {
      const selectedDiv = d3.select(`div#seis${seisId}`)
      if (plottype = 'seismograph') {
        return this.updateGraph(selectedDiv, seisId);
      } else if (plottype = 'spectra') {
        selectedDiv.selectAll('*').remove();
        return this.createPlot(seisId, plottype, seisChanQuakeFilter);
      } else if (plottype = 'particlemotion') {
        selectedDiv.selectAll('*').remove();
        return this.createPlot(seisId, plottype, seisChanQuakeFilter);
      }
    } catch(err) {
      console.error(err);

    }
  }

  createGraph(selectedDiv, seisId, seisData) {
    let seisConfig = new seisplotjs.seismographconfig.SeismographConfig();
    seisConfig.title = seisData.codes();
    let graph = new seisplotjs.seismograph.Seismograph(selectedDiv, seisConfig, seisData);
    graph.draw();
    this.processedData.set(`/seismograph/${seisId}`, graph);
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
      //seisplotjs.d3.select('input#mousey').property('value', coords);
    });
    return graph;
  }

  updateGraph(seisId, seis) {
    let graph = this.processedData.get(`/seismograph/${seisId}`);
    let sdd = graph.seisDataList.find(sdd => sdd.id === seisId);
    sdd.seismogram = seis;
    graph.calcAmpScaleDomain();
    graph.redoDisplayYScale();
    graph.draw()
    return graph;
  }

  createSpectra(selectedDiv, seisId, seisData, loglog=true) {
    const seisUrl = `/seismograms/${seisId}`;
    let fftPlot = null;
    if (this.processedData.has(seisUrl)) {
      selectedDiv.selectAll('*').remove();
      let seismogram = this.processedData.get(seisUrl);
      let fft = seisplotjs.fft.fftForward(seismogram);
      let fftList = [ fft ];
      let seisConfig = new seisplotjs.seismographconfig.SeismographConfig();
      fftPlot = new seisplotjs.fftplot.FFTPlot(selectedDiv, seisConfig, fftList, loglog);
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
    } else {
      console.warn(`seis no loaded: ${d.id}`);
    }
    return fftPlot;
  }

  createParticleMotion(selectedDiv, seisId, seisData) {
    // find pair, x => y, y => z, z=> x
    let otherId = null;
    let hSeisId = seisId;
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
      hSeisId = otherId;
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
    }
  }

  findSeismogramFriendId(seismogram, otherFilter) {
    let dataset = this.obspyData.get('dataset');
    let out = dataset.data.relationships.seismograms.data.find(d => {
      const key = `/seismograms/${d.id}`;
      if (this.processedData.has(key)) {
        let otherseismogram = this.processedData.get(key);
        return otherFilter(otherseismogram, null, null)
          && otherseismogram.stationCode === seismogram.stationCode
          && otherseismogram.networkCode === seismogram.networkCode;
      } else {
        return false;
      }
    });
    if (out) {
      return out.id;
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
        const key = `/seismograms/${d.id}`;
        return this.getSeismogram(d.id).then(seis => seis.stationCode);
      }));
    } else {
      outPromise = Promise.all([]); // none yet
    }
    return outPromise.then(staCodeList => {
      let staCodeSet = new Set(staCodeList);
      return Array.from(staCodeSet).sort();
    }).then(staList => {
      const that = this;
      let staDiv = seisplotjs.d3.select("div#station_checkbox").selectAll("span")
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
      seisplotjs.d3.select("#messages").append("p").classed("errormsg", true).text("Error station checkboxes." +error);
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
}


const formatCount = seisplotjs.d3.format('.4~s');
const formatExp = seisplotjs.d3.format('.4e');
const formatCountOrAmp = function(v) {
  return -1<v && v<1 && v !== 0 ? formatExp(v) : formatCount(v);
};
