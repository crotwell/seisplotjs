
let obspyDataset = new Map();

let processedDataset = new Map();

let processChain = [];

function clearAll() {
  processedDataset.clear();
  processChain.length = 0;//clears the array
  updateProcessDisplay(processChain);
  obspyDataset.clear();
  seisplotjs.d3.select("#messages").selectAll("p").remove();
}

function checkProcessedDatasetLoaded() {
  if (! processedDataset.has('dataset')) {
    processedDataset.set('dataset', obspyDataset.get('dataset'));
  }
}

function plotDataset(dataset) {
  seisplotjs.d3.select("#myseismograph").selectAll("div").remove();
  seisplotjs.d3.select("#title").text(dataset.data.attributes.title);
  const topDiv = seisplotjs.d3.select("#myseismograph");
  let graphEnter = topDiv.selectAll("div")
    .data(dataset.data.relationships.seismograms.data)
    .enter().append("div").attr("id", d=>`seis${d.id}`)
    .append("p").text(d => d.type+" "+d.id+" ");
  return loadSeismograms(dataset)
    .then((seisArray) => redrawSeismographs(dataset))
    .then(() => {
      linkAllTimeAxis();
      linkAllAmpAxis();
    });
}
function linkAllTimeAxis() {
  let dolink = seisplotjs.d3.select("input#linkx").property("checked");
  let prefix = '/seismograph/';
  let first = null;
  if (dolink) {
    obspyDataset.forEach((val, key) => {
      if (key.startsWith(prefix)) {
        if (first) {
          first.linkXScaleTo(val);
        } else {
          first = val;
        }
      }
    });
  } else {
    obspyDataset.forEach((val, key) => {
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
function linkAllAmpAxis() {
  let dolink = seisplotjs.d3.select("input#linky").property("checked");
  let prefix = '/seismograph/';
  let first = null;
  if (dolink) {
    obspyDataset.forEach((val, key) => {
      if (key.startsWith(prefix)) {
        if (first) {
          first.linkYScaleTo(val);
        } else {
          first = val;
        }
      }
    });
  } else {
    obspyDataset.forEach((val, key) => {
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

function redrawSeismographs(dataset) {
  dataset.data.relationships.seismograms.data.forEach(d => {
    const selectedDiv = seisplotjs.d3.select(`div#seis${d.id}`);
    const seisUrl = `/seismograms/${d.id}`;
    if (obspyDataset.has(seisUrl)) {
      selectedDiv.selectAll('p').remove();
      let seismogram = obspyDataset.get(seisUrl);
      let seisConfig = new seisplotjs.seismographconfig.SeismographConfig();
      seisConfig.title = seismogram.codes();
      let seisData = seisplotjs.seismogram.SeismogramDisplayData.fromSeismogram(seismogram);
      seisData.id = d.id;
      let c = findChannelForSeismogram(seismogram);
      if (c ) { seisData.channel = c;}
      if (obspyDataset.has(`quake`) && obspyDataset.get(`quake`)){
        seisData.addQuake( obspyDataset.get(`quake`));
      }
      let graph = new seisplotjs.seismograph.Seismograph(selectedDiv, seisConfig, seisData);
      graph.draw();
      obspyDataset.set(`/seismograph/${d.id}`, graph);
    } else {
      selectedDiv.append("p").text(d => d.type+" "+d.id+" ");
    }
  });
}
function loadAllAndPlot(baseUrl) {
  return loadDataset(baseUrl).then(dataset => {
      let allSeis = loadSeismograms(dataset);
      let quake = loadQuake(dataset);
      let inventory = loadInventory(dataset);
      return Promise.all([dataset, allSeis, quake, inventory]);
    }).then( ( [ dataset, allSeis, quake, inventory ] ) => {
      console.log(`plot ${allSeis.length} seismograms`);
      plotDataset(dataset);
      return Promise.all([dataset, allSeis, quake, inventory])
    }).catch( function(error) {
      seisplotjs.d3.select("#messages").append("p").classed("errormsg", true).text("Error loading data." +error);
      console.assert(false, error);
    });
}

function loadDataset(baseUrl) {
  const datasetUrl = new URL('/dataset', baseUrl)
  return seisplotjs.util.doFetchWithTimeout(datasetUrl).then(response => {
    console.log("response to fetch: ");
    return response.json();
  }).then(dataset => {
      console.log(`Got dataset`);
      console.log(`Got dataset: ${JSON.stringify(dataset, null, 2)}`);
      obspyDataset.set('dataset', dataset);
      return dataset;
  });
}

/**
 * Loads seismograms for dataset if not already loaded.
 */
function loadSeismograms(dataset, force=false) {
  return Promise.all(dataset.data.relationships.seismograms.data.map(d => {
    return loadSingleSeismogram(d.id, force=force);
  }));
}

function loadSingleSeismogram(seisid, force=false) {
  const seisUrl = `/seismograms/${seisid}`;
  if ( ! force && obspyDataset.has(seisUrl)) {
    console.log(`already have ${seisUrl}`)
    return Promise.resolve(obspyDataset.get(seisUrl));
  }
  // load from obspy
  return seisplotjs.mseedarchive.loadDataRecords( [ seisUrl ] )
      .then(dataRecords => {
        let seisArray = seisplotjs.miniseed.seismogramPerChannel(dataRecords);
        if (seisArray.length != 0) {
          let seis = seisArray[0]; // assume only first matters
          obspyDataset.set(seisUrl, seis);
          console.log(`obspyDataset.set(${seisUrl}', ${seis})`)
          return seis;
        } else {
          console.log(`Oops, server did not return data for ${seisUrl}`);
          return null;
        }
      }).catch( function(error) {
        seisplotjs.d3.select("#messages").append("p").classed("errormsg", true).text(`Error loading data from ${seisUrl}, ${error}`);
        console.assert(false, error);
      });
}

function loadQuake(dataset) {
  let quake = null;
  if (dataset.data.relationships.quake.data.id) {
    const qid = dataset.data.relationships.quake.data.id;
    console.log(`quake: ${dataset.data.relationships.quake.data.id}`);
    quake = seisplotjs.util.doFetchWithTimeout(`/quake/${qid}`).then(response => {
      console.log("response to fetch: ");
      return response.text();
    }).then(xml => {
      return (new window.DOMParser()).parseFromString(xml, "text/xml");
    }).then(quakeml => {
      return seisplotjs.quakeml.parseQuakeML(quakeml);
    }).then(quakeml => {
      obspyDataset.set('quake', quakeml);
      return quakeml;
    }).catch( function(error) {
      seisplotjs.d3.select("#messages").append("p").classed("errormsg", true).text(`Error loading quake, ${error}`);
      console.assert(false, error);
    });
  }
  return quake;
}

function loadInventory(dataset) {
  let inventory = null;
  if (dataset.data.relationships.inventory.data.id) {
    const qid = dataset.data.relationships.inventory.data.id;
    console.log(`inventory: ${dataset.data.relationships.inventory.data.id}`);
    inventory = seisplotjs.util.doFetchWithTimeout(`/inventory`).then(response => {
      console.log("response to fetch: ");
      return response.text();
    }).then(xml => {
      return (new window.DOMParser()).parseFromString(xml, "text/xml");
    }).then(stationxml => {
      return seisplotjs.stationxml.parseStationXml(stationxml);
    }).then(netList => {
      obspyDataset.set('inventory', netList);
      return netList;
    }).catch( function(error) {
      seisplotjs.d3.select("#messages").append("p").classed("errormsg", true).text(`Error loading inventory, ${error}`);
      console.assert(false, error);
    });
  }
  return inventory;
}

function findChannelForSeismogram(seismogram) {
  if (obspyDataset.has('inventory')) {
    let chanList = seisplotjs.stationxml.findChannels(
      obspyDataset.get('inventory'),
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

function applyProcessChain() {
  processedDataset.clear();
  let tmpProcessChain = Array.from(processChain);
  processChain.length = 0;//clears the array
  updateProcessDisplay(processChain);
  return loadAllAndPlot(baseUrl).then( ( [dataset, seisArray, quake, inventory ] ) => {
    processedDataset.set('dataset', dataset);
    let promiseArray = dataset.data.relationships.seismograms.data.map(d => {
      const seisId = d.id;
      let promiseSeis = loadSingleSeismogram(d.id);
      tmpProcessChain.forEach(p => {
        promiseSeis = promiseSeis.then((seis) => {
          console.log(`repro ${seisId} ${p.desc}`);
          return p.processFunc(seis);
        });
      });
      return promiseSeis.then( seis => {
        updateGraph(seisId, seis);
        return seis;
      }).catch(err => {
        seisplotjs.d3.select("#messages").append("p").classed("errormsg", true).text(err);
        throw err;
      });
    });
    return Promise.all(promiseArray).then(() => {
      tmpProcessChain.forEach(p => processChain.push(p));
      updateProcessDisplay(processChain);
    });
  });
}

function getSeismogram(id) {
  const key = `/seismograms/${id}`;
  if ( ! processedDataset.has(key)) {
    return loadSingleSeismogram(id).then(seis => {
      let clonedSeis = seis.clone();
      processedDataset.set(key, clonedSeis);
      return clonedSeis;
    })
  }
  return Promise.resolve(processedDataset.get(key));
}

function applyAllSeismograms(processFunc, desc) {
  console.log(`applyAllSeismograms: ${desc}`)
  processChain.push({desc: desc, processFunc: processFunc});
  updateProcessDisplay(processChain);
  checkProcessedDatasetLoaded();
  let dataset = processedDataset.get('dataset');
  return Promise.all(dataset.data.relationships.seismograms.data.map(d => {
    const key = `/seismograms/${d.id}`;
    return getSeismogram(d.id).then(seis => processFunc(seis))
      .then(seis => {
        processedDataset.set(key, seis);
        updateGraph(d.id, seis)
      }).catch(err => {
        seisplotjs.d3.select("#messages").append("p").classed("errormsg", true).text(err);
        throw err;
      });
  }));
}

function updateGraph(seisId, seis) {
  let graph = obspyDataset.get(`/seismograph/${seisId}`);
  graph.seisDataList.forEach(sdd => console.log(`look for ${sdd.id} === ${seisId}`));
  let sdd = graph.seisDataList.find(sdd => sdd.id === seisId);
  sdd.seismogram = seis;
  graph.calcAmpScaleDomain();
  graph.redoDisplayYScale();
  graph.draw()
}

function updateProcessDisplay(processChain) {
  let pc = seisplotjs.d3.select("div#processChain ul").selectAll("li")
    .data(processChain);
  pc
    .enter()
    .append('li').text(d => d.desc);
  pc.exit().remove();
}

class ObsPyConnection {
  constructor(url, baseUrl, packetHandler, errorHandler) {
    this.url = url;
    this.baseUrl = baseUrl;
    this.packetHandler = packetHandler;
    this.errorHandler = errorHandler;
    this.closeHandler = null;
    this.serverId = null;
    this._responseResolve = null;
    this._responseReject = null;
  }

  setOnClose(closeHandler) {
    this.closeHandler = closeHandler;
  }

  /**
   * creates the websocket connection and sends the client ID.
   *
   *  @returns a Promise that resolves to the server's ID.
   */
  connect() {
    const that = this;
    if (this.isConnected()) {
      this.close();
    }
    return new seisplotjs.RSVP.Promise(function(resolve, reject) {
      const webSocket = new WebSocket(that.url);
      webSocket.binaryType = 'arraybuffer';
      webSocket.onmessage = function(event) {
        console.log("  webSocket.onmessage "+event.data)
        try {
          that.handle(event);
        } catch(e) {
          console.assert(false, e);
        }
      };
      webSocket.onerror = function(event) {
        console.assert(false, event)
        that.handleError(new Error(""+seisplotjs.util.stringify(event)));
        reject(event);
      };
      webSocket.onclose = function(closeEvent) {
        console.log(`webSocket onclose:  ${closeEvent}  ${closeEvent.code}  ${closeEvent.reason}`);
        that.webSocket = null; // clean up
        if (that.closeHandler) {
          that.closeHandler(closeEvent);
        }
      };
      webSocket.onopen = function() {
        that.webSocket = webSocket;
        resolve(webSocket);
      };
    }).then(webSocket => {
      // ready to go
      that.webSocket = webSocket;
      that.sendMessage(JSON.stringify({"msg": "connect... hi obspy"}));
      return that;
    });
  }

  /**
   * @returns true if the websocket is connected (non-null)
   */
  isConnected() {
    return this.webSocket !== null;
  }

  /**
   * Closes the connection and the underlying websocket. No communication
   * is possible until connect() is called again.
   */
  close() {
    if (this.webSocket) {
      if (this.webSocket) {this.webSocket.close();}
      this.webSocket = null;
    }
  }

  sendMessage(message) {
    console.log(`obspy sendMessage(${message})`)
    if (this.webSocket) {
      this.webSocket.send(message);
      console.log("after send")
    } else {
      throw new Error("WebSocket has been closed.");
    }
  }

 handle(wsEvent ) {
   console.log("in ws handle")
   const jsonObj = JSON.parse(wsEvent.data);
   console.log(wsEvent.data);
   if (jsonObj.update) {
     if (jsonObj.update == 'refreshAll') {
       // start over clean
       console.log("update refresh")
       obspyDataset.clear();
     }
     loadAllAndPlot(this.baseUrl).then(() => applyProcessChain());
   } else {
     console.log("...not update message  "+jsonObj+"  "+jsonObj.update);
   }
   this.packetHandler(jsonObj);
 }

 /**
  * handle errors that arise
  *
  * @private
  * @param   error the error
  */
 handleError(error) {
   if (this._responseReject) {
     this._responseReject(error);
   }
   if (this.errorHandler) {
     this.errorHandler(error);
   } else {
     util.log("datalink handleError: "+error.message);
   }
 }
}
