/*global seisplotjs */


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
        console.log("  webSocket.onmessage "+event.data);
        try {
          that.handle(event);
        } catch(e) {
          console.assert(false, e);
        }
      };
      webSocket.onerror = function(event) {
        console.assert(false, event);
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
    console.log(`obspy sendMessage(${message})`);
    if (this.webSocket) {
      this.webSocket.send(message);
      console.log("after send");
    } else {
      throw new Error("WebSocket has been closed.");
    }
  }

 handle(wsEvent ) {
   console.log("in ws handle");
   const jsonObj = JSON.parse(wsEvent.data);
   console.log(wsEvent.data);
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
     seisplotjs.util.log("datalink handleError: "+error.message);
   }
 }
}
