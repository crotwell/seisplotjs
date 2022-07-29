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

  /**
   * Loads the dataset, quake, enventory and seismograms from serveobspy
   *
   * @returns {Promise<Dataset, Quake, Array<Network>, Array<SeismogramDisplayData>>} Promise to data
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

    let firstPromise = new Promise.all((seisDataList ? seisDataList.slice() : []))
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
        return Promise.all(tempSeis);
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
    return await Promise.all(promiseArray)
    .then(procSeisDataList => {
      this.processedData.set('seisDataList', procSeisDataList);
      this.replot();
    });
  }

  sortForPlotting(sorttype, seisDataList) {
    let out = seisDataList;
    if (sorttype === "none") {
      out = seisDataList;
    } else {
      this.showErrorMessage("Sorting not yet implemented: "+sorttype);
    }
    return out;
  }

  organizePlotting(organizetype, plottype, dataset, catalog, inventory, seisDataList) {
    let organizedData = [];
    if ( ! seisDataList || seisDataList.length === 0) {
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
    return Promise.all(promiseArray);
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
