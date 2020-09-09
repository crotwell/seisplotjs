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
    this.seisIdToDisplayIdMap = new Map();
    this.organizetype = seisplotjs.d3.select('input[name="organizetype"]:checked').property("value");
    this.sorttype = seisplotjs.d3.select('input[name="sorttype"]:checked').property("value");
    this.plottype = seisplotjs.d3.select('input[name="plottype"]:checked').property("value");
  }

  clearData() {
    console.log('clearData');
    this.processedData.clear();
    this.obspyData.clear();
    seisplotjs.d3.select("#messages").selectAll("p").remove();
    this.seisIdToDisplayIdMap.clear();
    this.seisChanQuakeFilter = (seis, chan, quake) => {return this.defaultPlotFilter(seis, chan, quake);};
  }

  clearAll() {
    console.log("clearAll");
    this.clearData();
    this.processChain.length = 0;//clears the array
    this.updateProcessDisplay(this.processChain);
  }

  loadAllAndPlot() {
    console.log(`loadAllAndPlot: ${this.processChain.length}`);

    const that = this;
    return this.loadAll().then( ([ dataset, catalog, inventory, seisDataList ]) => {
      this.obspyData.set('dataset', dataset);
      this.obspyData.set('catalog', catalog);
      for (let c of catalog) {console.log(`catalog: ${c}`);}
      this.obspyData.set('inventory', inventory);
      this.obspyData.set('seisDataList', seisDataList);
      seisDataList.forEach(s => console.log(`seisDataList ${s.id}`))
      this.createStationCheckboxes(seisDataList, inventory);

      this.reprocess();

      this.replot();
    });
  }

  reprocess() {
    console.log(`reprocess: ${this.processChain.length}`);

    const dataset = this.obspyData.get('dataset');
    const catalog = this.obspyData.get('catalog');
    const inventory = this.obspyData.get('inventory');
    let seisDataList = this.obspyData.get('seisDataList');

    this.applyProcessChain( dataset, catalog, inventory, seisDataList);

    this.replot();
  }

  replot() {
    console.log(`replot: ${this.processChain.length}`);

    const dataset = this.obspyData.get('dataset');
    const catalog = this.obspyData.get('catalog');
    const inventory = this.obspyData.get('inventory');
    let seisDataList = this.processedData.get('seisDataList');
    seisDataList = seisDataList ? seisDataList : this.obspyData.get('seisDataList'); // make sure not null
    if ( ! seisDataList) {
      // no data yet?
      console.log("replot: no data yet");
      return;
    }

    let filteredSeis = seisDataList.filter(sd => this.seisChanQuakeFilter(sd.seismogram, sd.channel, sd.quake));
    let organizedSeis = this.organizePlotting(this.organizetype, this.plottype, dataset, catalog, inventory, filteredSeis);
    organizedSeis = this.sortForPlotting(this.sorttype, organizedSeis);
    this.plotDiv.selectAll('*').remove();
    seisplotjs.displayorganize.createPlots(organizedSeis, this.plotDiv);
  }

  /**
   * Loads the dataset, quake, enventory and seismograms from serveobspy
   * @return {Promise[Dataset, Quake, Array[Network], Array[SeismogramDisplayData]} Promise to data
   */
  loadAll() {
    const that = this;
    this.clearData();
    return this.loadDataset().then(dataset => {
        let catalogPromise = this.loadCatalog(dataset);
        let inventoryPromise = this.loadInventory(dataset);
        return Promise.all([dataset, catalogPromise, inventoryPromise]);
      }).then( ( [ dataset, catalog, inventory] ) => {
        this.obspyData.set('seisDataList', []);
        let allSeisPromises = dataset.data.relationships.seismograms.data.map(d => {
          const seisId = this.createSeisKey(d);
          return this.loadSingleSeismogram(seisId, false).then(seismogram => {
            let seisData = seisplotjs.seismogram.SeismogramDisplayData.fromSeismogram(seismogram);
            seisData.id = seisId;

            let chanList = seisplotjs.stationxml.findChannels(
              inventory,
              seismogram.networkCode,
              seismogram.stationCode,
              seismogram.locationCode,
              seismogram.channelCode);
            for(let c of chanList) {
              if (c.timeRange.overlaps(seismogram.timeRange)) {
                seisData.channel = c;
              }
            }
            for (let quake of catalog) {
              seisData.addQuake(quake);
            }
            console.log(`sdd quake: ${seisData.quakeList.length}`)
            return seisData;
          });
        });
        return Promise.all([dataset, catalog, inventory, Promise.all(allSeisPromises)]);
      });
  }

  applyProcessChain( dataset, catalog, inventory, seisDataList) {
    console.log(`applyProcessChain: ${this.processChain.length}`);
    const that = this;
    this.processedData.clear();
    let tmpProcessChain = this.processChain.slice();
    this.processChain.length = 0;//clears the array
    this.updateProcessDisplay(this.processChain);
    this.processedData.set('dataset', dataset);
    this.processedData.set('catalog', catalog);
    this.processedData.set('inventory', inventory);
    this.processedData.set('seisDataList', seisDataList);
    let tempSeis = Array.from(seisDataList);
    tempSeis.forEach(seisData => {
      this.processedData.set(seisData.id, seisData);
    });
    tmpProcessChain.forEach(p => {
        tempSeis = tempSeis.map((seisData, index, array) => {
          const seisKey = seisData.id;
          const ts = p.processFunc(seisData, index, array, dataset, catalog, inventory);
          ts.id = seisKey;
          this.processedData.set(seisKey, seisData);
          return ts;
        });
      this.processChain.push(p);
      this.updateProcessDisplay(this.processChain);
      this.processedData.set('seisDataList', tempSeis);
    });
    console.log(`applyProcessChain processedData quake: ${this.processedData.get('seisDataList')[0].quakeList.length}` );
  }

  async applyAllSeismograms(processFunc, desc) {
    this.processChain.push({desc: desc, processFunc: processFunc});
    this.updateProcessDisplay(this.processChain);
    const dataset = this.obspyData.get('dataset');
    const catalog = this.obspyData.get('catalog');
    const inventory = this.obspyData.get('inventory');
    let seisDataList = this.processedData.get('seisDataList');

    return await seisplotjs.RSVP.all(seisDataList.map((seisData, index, array) => processFunc(seisData, index, array, dataset, catalog, inventory)))
    .then(procSeisDataList => {
      this.processedData.set('seisDataList', procSeisDataList);
      console.log(`applyAllSeismograms processedData quake: ${this.processedData.get('seisDataList')[0].quakeList.length}` );
      this.replot();
    });
  }

  sortForPlotting(sorttype, seisDataList) {
    let out = seisDataList;

    return out;
  }

  organizePlotting(organizetype, plottype, dataset, catalog, inventory, seisDataList) {
    let organizedData = [];
    if ( ! seisDataList || seisDataList.length == 0) {
      return organizedData;
    }
    if (plottype === "particlemotion") {
      // particle motion is special due to pairwise plots
      return this.organizeParticleMotion(seisDataList);
    } else if (! organizetype || organizetype === "individual") {
      organizedData = seisplotjs.displayorganize.individualDisplay(seisDataList);
    } else if (organizetype === "bystation") {
      organizedData = seisplotjs.displayorganize.overlayByStation(seisDataList);
    } else if (organizetype === "bycomponent") {
      organizedData = seisplotjs.displayorganize.overlayByComponent(seisDataList);
    } else if (organizetype === "overlayall") {
      organizedData = seisplotjs.displayorganize.overlayAll(seisDataList);
    } else if (typeof organizetype === 'function') {
      organizedData = organizetype(seisDataList)
    }

    let seisConfig = new seisplotjs.seismographconfig.SeismographConfig();
    seisConfig.title = seisplotjs.seismographconfig.DEFAULT_TITLE;
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
    });
    return organizedData;
  }


    organizeParticleMotion(seisDataList) {
      let organized = [];
      let tmpSeisDataList = Array.from(seisDataList);
      seisDataList.forEach(currSeisData => {
        let hSeisData;
        let vSeisData;
        let friendList = seisDataList.filter(sdd => sdd.networkCode === currSeisData.networkCode
            && sdd.stationCode === currSeisData.stationCode
            && sdd.locationCode === currSeisData.locationCode
            && sdd.channelCode.slice(0,2) === currSeisData.channelCode.slice(0,2)
            && sdd.timeWindow.overlaps(currSeisData.timeWindow));
        if (this.orientEFilter(currSeisData)) {
          friendList = friendList.filter(this.orientNFilter);
          hSeisData = currSeisData;
        } else if (this.orientNFilter(currSeisData)) {
          friendList = friendList.filter(this.orientZFilter);
          hSeisData = currSeisData;
        } else if (this.orientRFilter(currSeisData)) {
          friendList = friendList.filter(this.orientTFilter);
          hSeisData = currSeisData;
        } else if (this.orientTFilter(currSeisData)) {
          friendList = friendList.filter(this.orientZFilter);
          hSeisData = currSeisData;
        } else if (this.orientZFilter(currSeisData)) {
          // can be RZ or EZ
          let tmpfriendList = friendList.filter(this.orientEFilter);
          if (tmpfriendList.length === 0) {
              friendList = friendList.filter(this.orientRFilter);
          } else {
            friendList = tmpfriendList;
          }
          vSeisData = currSeisData;
        } else {
          console.log(`cant filter friend list: ${currSeisData.codes()}`);
        }
        if (friendList.length !== 0) {
          if (currSeisData === hSeisData) {
            vSeisData = friendList[0];
          } else {
            hSeisData = friendList[0];
          }
          const foundSeisData = friendList[0];
          let org = new seisplotjs.displayorganize.OrganizedDisplay([ hSeisData, vSeisData ], seisplotjs.displayorganize.PARTICLE_MOTION);

          organized.push(org);
        } else {
          console.log(`didn't find unique friend for ${currSeisData.codes()} ${friendList.length}`);
        }
      });
      return organized;
    }

  addTravelTimes(seisDataList, phaseList) {
    const stationList = seisplotjs.displayorganize.uniqueStations(seisDataList);
    const quakeList = seisplotjs.displayorganize.uniqueQuakes(seisDataList);
    console.log(`addTravelTimes q: ${quakeList.length}  s: ${stationList.length}`)
    let promiseArray = [];
    stationList.forEach(s => {
      let stationSDDList = seisDataList.filter(sdd => sdd.channel && sdd.channel.station === s);
      quakeList.forEach(q => {
        let quakeStationSDDList = stationSDDList.filter(sdd => {
          let found = false;
          sdd.quakeList.forEach(sddQ => {
            if (sddQ === q) {found = true;}
          });
          return found;
        });
        let ttimeQuery = new seisplotjs.traveltime.TraveltimeQuery();
        let distaz = seisplotjs.distaz.distaz(s.latitude, s.longitude, q.latitude, q.longitude);
        ttimeQuery.distdeg(distaz.delta)
        .evdepthInMeter(q.depth)
        .phases(phaseList);
        promiseArray.push( ttimeQuery.queryJson().then(travelTime => {
          let phaseMarkers = seisplotjs.seismograph.createMarkersForTravelTimes(q, travelTime);
          phaseMarkers.push({
            markertype: 'predicted',
            name: "origin",
            time: seisplotjs.moment.utc(q.time),
            description: q.toString()
          });
          quakeStationSDDList.forEach(sdd => {
            sdd.addTravelTimes(travelTime);
            sdd.addMarkers(phaseMarkers);
          });
          return travelTime;
        }));
      });
    });
    return seisplotjs.RSVP.all(promiseArray);
  }
  createGraph(selectedDiv, seisConfig, seisDataList, seisKey) {
    for (let seisData of seisDataList) {
      if (seisData.quakeList && seisData.quakeList.length > 0) {
        let phaseMarkers = [];
        seisData.quakeList.forEach(q => {
          phaseMarkers.push({
            markertype: 'predicted',
            name: "origin",
            time: seisplotjs.moment.utc(q.time),
            description: q.toString()
          });
        });
        seisData.addMarkers(phaseMarkers);
        console.log(`add markers: ${phaseMarkers.length}`);
      } else {
        console.log("no quake");
      }
    }

    let graph = new seisplotjs.seismograph.Seismograph(selectedDiv, seisConfig, seisDataList);
    graph.draw();
    let graphKey = `graph${this.extractIdFromSeisKey(seisKey)}`;
    this.processedData.set(graphKey, graph);
    //this.linkAllTimeAxis();
    //this.linkAllAmpAxis();
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

  createSpectra(selectedDiv, seisKey, seisData, loglog=true) {
    if (seisData && seisData.length > 0) {
      selectedDiv.selectAll('*').remove();
      let fftList = seisData.map(sd => seisplotjs.fft.fftForward(sd.seismogram));
      let seisConfig = new seisplotjs.seismographconfig.SeismographConfig();
      seisConfig.title = seisplotjs.seismographconfig.DEFAULT_TITLE;
      let fftPlot = new seisplotjs.fftplot.FFTPlot(selectedDiv, seisConfig, fftList, loglog);
      fftPlot.draw();

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
    } else {
      console.warn(`seis no loaded`);
    }
    return null;
  }

  createParticleMotion(selectedDiv, seisConfig, seisDataList, timeWindow) {
    if (seisDataList.length !== 2) {
      throw new Error(`particle motion requies exactly 2 seisData in seisDataList, ${seisDataList.length}`);
    }

    // timeWindow optional subwindow of seismogram to display

    let pmpSeisConfig = seisConfig.clone();
    pmpSeisConfig.yLabel = seisDataList[1].channelCode;
    pmpSeisConfig.xLabel = seisDataList[0].channelCode;

    let pmp = new seisplotjs.particlemotion.ParticleMotion(selectedDiv, pmpSeisConfig, seisDataList[0], seisDataList[1], timeWindow);
    pmp.draw();

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
    pc.enter()
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
              this.replot();
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

  createSeisKey(d) {
    if (Array.isArray(d) ) {
      return this.createSeisKey(d[0]);
    }
    return `seis${d.id}`;
  }

  extractIdFromSeisKey(seisKey) {
    if (seisKey.startsWith('seis')) {
      return seisKey.substring(4);
    }
    throw new Error(`seisKey must start with "seis"`);
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
            this.obspyData.get('seisDataList').push(seis);
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

  loadCatalog(dataset) {
    let catalog = Promise.resolve([]);
    if (dataset.data.relationships.catalog.data.id) {
      const qid = dataset.data.relationships.catalog.data.id;
      const catalogUrl = new URL(`/catalog/${qid}`, this.baseUrl);
      catalog = seisplotjs.util.doFetchWithTimeout(catalogUrl).then(response => {
        return response.text();
      }).then(xml => {
        return (new window.DOMParser()).parseFromString(xml, "text/xml");
      }).then(quakeml => {
        return seisplotjs.quakeml.parseQuakeML(quakeml);
      }).then(quakeml => {
        this.obspyData.set('catalog', quakeml);
        return quakeml;
      }).catch( function(error) {
        this.showErrorMessage(`Error loading quake, ${error}`);
        console.error(error);
      });
    }
    return catalog;
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
  orientRFilter(seis, chan, quake) {
    return seis.channelCode.endsWith('R');
  }
  orientTFilter(seis, chan, quake) {
    return seis.channelCode.endsWith('T');
  }

  defaultPlotFilter(seis, chan, quake) {
    let doZ = seisplotjs.d3.select("input#orientz").property("checked");
    let doN = seisplotjs.d3.select("input#orienty").property("checked");
    let doE = seisplotjs.d3.select("input#orientx").property("checked");
    let doR = seisplotjs.d3.select("input#orientr").property("checked");
    let doT = seisplotjs.d3.select("input#orientt").property("checked");
    return this.stationFilter(seis, chan, quake)
        && ((doZ && this.orientZFilter(seis, chan, quake))
        || (doN && this.orientNFilter(seis, chan, quake))
        || (doE && this.orientEFilter(seis, chan, quake))
        || (doR && this.orientRFilter(seis, chan, quake))
        || (doT && this.orientTFilter(seis, chan, quake)));
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
