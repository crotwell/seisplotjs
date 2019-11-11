
const loadDataset = function(baseUrl) {
  const datasetUrl = new URL('/dataset', baseUrl)
  return seisplotjs.util.doFetchWithTimeout(datasetUrl).then(response => {
    console.log("response to fetch: ");
    return response.json();
  }).then(dataset => {
      console.log(`Got dataset`);
      console.log(`Got dataset: ${JSON.stringify(dataset, null, 2)}`)
      seisplotjs.d3.select("#myseismograph").selectAll("div").remove();
      seisplotjs.d3.select("#title").text(dataset.data.attributes.title);
      seisplotjs.d3.select("#myseismograph").selectAll("div")
        .data(dataset.data.relationships.seismograms.data)
        .enter().append("div")
        .attr("seisid", d => d.id).append("p").text(d => d.type+" "+d.id+" ");
      let urlList = dataset.data.relationships.seismograms.data.map(d => {
        return `/seismograms/${d.id}`;
      });
      let allSeis = seisplotjs.mseedarchive.loadDataRecords(urlList)
          .then(dataRecords => {
            let seisArray = seisplotjs.miniseed.seismogramPerChannel(dataRecords);
            return seisArray;
          });
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
        });
      }
      return Promise.all([dataset, allSeis, quake]);
    }).then( ( [ dataset, allSeis, quake ] ) => {
      console.log(`plot ${allSeis.length} seismograms`);
      allSeis.forEach((seismogram, myid) => {
        let div = seisplotjs.d3.select('div#myseismograph').select(`div[seisid="${myid}"]`);
        div.selectAll('*').remove();
        let seisConfig = new seisplotjs.seismographconfig.SeismographConfig();
        seisConfig.title = seismogram.codes();
        let seisData = seisplotjs.seismogram.SeismogramDisplayData.fromSeismogram(seismogram);
        seisData.addQuake( quake);
        let graph = new seisplotjs.seismograph.Seismograph(div, seisConfig, seisData);
        graph.draw();
      });
      return Promise.all([dataset, allSeis, quake])
    }).catch( function(error) {
      seisplotjs.d3.select("div#myseismograph").append('p').html("Error loading data." +error);
      console.assert(false, error);
    });
}

class ObsPyConnection {
  constructor(url, packetHandler, errorHandler) {
    this.url = url;
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
    return new seisplotjs.RSVP.Promise(function(resolve, reject) {
      const webSocket = new WebSocket(that.url);
      that.webSocket = webSocket;
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
        resolve(that);
      };
    }).then(datalink => {
      return datalink.sendMessage(JSON.stringify({"msg": "hi obspy"}));
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
      this._mode = null;
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
   const json = JSON.parse(wsEvent.data);
   console.log(wsEvent.data);
   this.packetHandler(json);
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
