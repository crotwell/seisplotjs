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
    this.seisChanQuakeFilter = this.defaultPlotFilter;
    this.seisIdToDisplayIdMap = new Map();
    this.organizetype = seisplotjs.d3.select('input[name="organizetype"]:checked').property("value");
    this.sorttype = seisplotjs.d3.select('input[name="sorttype"]:checked').property("value");
    this.plottype = seisplotjs.d3.select('input[name="plottype"]:checked').property("value");
  }

  clearData() {
    this.processedData.clear();
    this.obspyData.clear();
    seisplotjs.d3.select("#messages").selectAll("p").remove();
    this.seisIdToDisplayIdMap.clear();
    this.seisChanQuakeFilter = this.defaultPlotFilter;
  }

  clearAll() {
    this.clearData();
    this.processChain.length = 0;//clears the array
    this.updateProcessDisplay(this.processChain);
  }

  loadAllAndPlot() {

    const that = this;
    return this.loadAll().then( ([ dataset, catalog, inventory, seisDataList ]) => {
      this.obspyData.set('dataset', dataset);
      this.obspyData.set('catalog', catalog);
      this.obspyData.set('inventory', inventory);
      this.obspyData.set('seisDataList', seisDataList);
      this.createStationCheckboxes(seisDataList, inventory);
      this.createBandCheckboxes(seisDataList, inventory);
      this.createGainCheckboxes(seisDataList, inventory);
      this.createOrientationCheckboxes(seisDataList, inventory);

      this.reprocess();

      this.replot();
    });
  }

  reprocess() {

    const dataset = this.obspyData.get('dataset');
    const catalog = this.obspyData.get('catalog');
    const inventory = this.obspyData.get('inventory');
    let seisDataList = this.obspyData.get('seisDataList');

    if (seisDataList && seisDataList.length > 0) {
      this.applyProcessChain( dataset, catalog, inventory, seisDataList);
    }
    this.replot();
  }

  replot() {

    const dataset = this.obspyData.get('dataset');
    const catalog = this.obspyData.get('catalog');
    const inventory = this.obspyData.get('inventory');
    let seisDataList = this.processedData.get('seisDataList');
    seisDataList = seisDataList ? seisDataList : this.obspyData.get('seisDataList'); // make sure not null
    if ( ! seisDataList) {
      // no data yet?
      return;
    }

    let filteredSeis = seisDataList.filter(sd => this.seisChanQuakeFilter(sd));
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
        let catalogPromise = this.loadCatalog();
        let inventoryPromise = this.loadInventory();
        return Promise.all([dataset, catalogPromise, inventoryPromise]);
      }).then( ( [ dataset, catalog, inventory] ) => {
        that.obspyData.set('seisDataList', []);
        let allSeisPromises = dataset.data.relationships.seismograms.data.map(d => {
          const seisId = this.createSeisKey(d);
          return that.loadSingleSeismogram(seisId, false).then(seismogram => {
            let seisData = seisplotjs.seismogram.SeismogramDisplayData.fromSeismogram(seismogram);
            seisData.id = seisId;
            that.matchSDDWithChannel(seisData, inventory);
            catalog.forEach(quake => {
              seisData.addQuake(quake);
            });
            return seisData;
          });
        });
        return Promise.all([dataset, catalog, inventory, Promise.all(allSeisPromises)]);
      });
  }

  matchSDDWithChannel(sdd, inventory) {
    if ( seisplotjs.util.isDef(sdd.seismogram) && seisplotjs.util.isDef(inventory)) {
      let chanList = seisplotjs.stationxml.findChannels(
        inventory,
        sdd.seismogram.networkCode,
        sdd.seismogram.stationCode,
        sdd.seismogram.locationCode,
        sdd.seismogram.channelCode);
      for(let c of chanList) {
        if (c.timeRange.overlaps(sdd.seismogram.timeRange)) {
          sdd.channel = c;
          return;
        }
      }
    }
  }

  applyProcessChain( dataset, catalog, inventory, seisDataList) {
    const that = this;
    this.processedData.clear();
    let tmpProcessChain = this.processChain.slice();
    this.processChain.length = 0;//clears the array
    this.updateProcessDisplay(this.processChain);
    this.processedData.set('dataset', dataset);
    this.processedData.set('catalog', catalog);
    this.processedData.set('inventory', inventory);
    this.processedData.set('seisDataList', seisDataList);

    let firstPromise = new seisplotjs.RSVP.all((seisDataList ? seisDataList.slice() : []))
    .then(tempSeis => {
      this.processedData.set('seisDataList', tempSeis);
      tempSeis.forEach(seisData => {
        this.processedData.set(seisData.id, seisData);
      });
      return tempSeis;
    });
    let promise = firstPromise;
    tmpProcessChain.forEach(p => {
      promise = promise.then(tempSeis => {

        tempSeis = tempSeis.map((seisData, index, array) => {
          const seisKey = seisData.id;
          let tempSeisData = p.processFunc(seisData, index, array, dataset, catalog, inventory);
          let out;
          if (tempSeisData) {
            out = tempSeisData;
          } else {
            // just in case process doesn't return the new seisdata
            out = Promise.resolve(seisData);
          }

          return out.then(ts => {
            ts.id = seisKey;
            this.processedData.set(seisKey, seisData);
            return ts;
          });
        });
        return seisplotjs.RSVP.all(tempSeis);
      }).then(tempSeis => {
        this.processChain.push(p);
        this.updateProcessDisplay(this.processChain);
        this.processedData.set('seisDataList', tempSeis);
      });
    });
    promise.then(tempSeis => {
      that.replot();
      return tempSeis;
    });
    return firstPromise;
  }

  async applyAllSeismograms(processFunc, desc) {
    this.processChain.push({desc: desc, processFunc: processFunc});
    this.updateProcessDisplay(this.processChain);
    const dataset = this.obspyData.get('dataset');
    const catalog = this.obspyData.get('catalog');
    const inventory = this.obspyData.get('inventory');
    let seisDataList = this.processedData.get('seisDataList');

    const promiseArray = seisDataList.map((seisData, index, array) => {
      let tempSeisData = processFunc(seisData, index, array, dataset, catalog, inventory);
      if (tempSeisData) {
        return tempSeisData;
      } else {
        // just in case process doesn't return the new seisdata
        return Promise.resolve(seisData);
      }
    });
    return await seisplotjs.RSVP.all(promiseArray)
    .then(procSeisDataList => {
      this.processedData.set('seisDataList', procSeisDataList);
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
    } else if (organizetype === "all") {
      organizedData = seisplotjs.displayorganize.overlayAll(seisDataList);
    } else if (typeof organizetype === 'function') {
      organizedData = organizetype(seisDataList)
    } else {
      throw new Error(`Unknown organize type: ${organizetype}`)
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
      const that = this;
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
            that.showErrorMessage(`No data records from ${seisUrl}`);
            return null;
          }
          let seisArray = seisplotjs.miniseed.seismogramPerChannel(dataRecords);
          if (seisArray.length !== 0) {
            let seis = seisArray[0]; // assume only first matters
            that.obspyData.set(seisKey, seis);
            that.obspyData.set(seisKey+"/stats", stats);
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

  loadCatalog() {
    const mythis = this;
    return Promise.resolve(mythis.obspyData.get('dataset'))
    .then(dataset => {
      if ( ! dataset) {
        return mythis.loadDataset();
      } else {
        return dataset;
      }
    }).then( dataset => {
      if (dataset.data.relationships.catalog.data.id) {
        const qid = dataset.data.relationships.catalog.data.id;
        const catalogUrl = new URL(`/catalog/${qid}`, this.baseUrl);
        return seisplotjs.util.doFetchWithTimeout(catalogUrl).then(response => {
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
      } else {
        return Promise.resolve([]);
      }
    });
  }

  loadInventory() {
    const mythis = this;
    return Promise.resolve(mythis.obspyData.get('dataset'))
    .then(dataset => {
      if ( ! dataset) {
        return mythis.loadDataset();
      } else {
        return dataset;
      }
    }).then( dataset => {
      let inventory = Promise.resolve([]);
      if (dataset.data.relationships.inventory.data.id) {
        const qid = dataset.data.relationships.inventory.data.id;
        const inventoryUrl = new URL('/inventory', mythis.baseUrl);
        inventory = seisplotjs.util.doFetchWithTimeout(inventoryUrl).then(response => {
          return response.text();
        }).then(xml => {
          return (new window.DOMParser()).parseFromString(xml, "text/xml");
        }).then(stationxml => {
          return seisplotjs.stationxml.parseStationXml(stationxml);
        }).then(netList => {
          mythis.obspyData.set('inventory', netList);
          if (mythis.obspyData.has('seisDataList')) {
            mythis.obspyData.get('seisDataList').forEach(sdd => {
              mythis.matchSDDWithChannel(sdd, netList);
            });
          }
          return netList;
        }).catch( function(error) {
          mythis.showErrorMessage(`Error loading inventory, ${error}`);
          console.error( error);
        });
      }
      return inventory;
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
