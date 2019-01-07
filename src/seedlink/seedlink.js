// @flow

/**
 * Philip Crotwell
 * University of South Carolina, 2016
 * http://www.seis.sc.edu
 */

 /*global DataView*/

import * as miniseed from '../miniseed';
import * as RSVP from 'rsvp';
import moment from 'moment';

import {dataViewToString} from './util';

/* reexport */
export { miniseed, RSVP };

export const SEEDLINK_PROTOCOL = "SeedLink3.1";

RSVP.on('error', function(reason) {
  console.assert(false, reason);
});

export type SequencedDataRecord = {
  rawsequence: string,
  sequence: number,
  miniseed: miniseed.DataRecord
};

export class SeedlinkConnection {
  url :string;
  requestConfig :Array<string>;
  receiveMiniseedFn :(packet: SequencedDataRecord) => void;
  errorFn :(error: Error) => void;
  webSocket :WebSocket;
  command :string;
  /** creates a seedlink websocket connection to the given url.
    * requestConfig is an array of seedlink commands
    * like:
    *   [ 'STATION JSC CO',
    *     'SELECT 00BHZ.D' ]
    * and receiveMiniseedFn is the callback function that
    * will be invoked for each seedlink packet received
    * which contains 'sequence', a sequence number
    * and 'miniseed', a single miniseed record.
    * The connection is not made until the connect() method is called.
    */
  constructor(url :string, requestConfig :Array<string>, receiveMiniseedFn :(packet: SequencedDataRecord) => void, errorFn :(error: Error) => void) {
    this.url = url;
    this.requestConfig = requestConfig;
    this.receiveMiniseedFn = receiveMiniseedFn;
    this.errorFn = errorFn;
    this.closeFn = null;
    this.command = 'DATA';
  }
  setTimeCommand(startDate :moment) {
    this.command = "TIME "+moment(startDate).format("YYYY,MM,DD,HH,mm,ss");
  }
  setOnError(errorFn :(error: Error) => void) {
    this.errorFn = errorFn;
  }
  setOnClose(closeFn :(close: CloseEvent) => void) {
    this.closeFn = closeFn;
  }

  connect() {
    if (this.webSocket) {this.webSocket.close();}
    this.webSocket = new WebSocket(this.url, SEEDLINK_PROTOCOL);
    this.webSocket.binaryType = 'arraybuffer';
    const that = this;
    this.webSocket.onopen = function() {
      that.sendHello(that.webSocket)
      .then(function() {
        return that.sendCmdArray(that.webSocket, that.requestConfig);
      })
      .then(function() {
        return that.sendCmdArray(that.webSocket, [ that.command ]);
      })
      .then(function(val) {
        that.webSocket.onmessage = function(event) {
          that.handle(event);
        };
        that.webSocket.send('END\r');
        return val;
      }, function(err) {
        console.assert(false, "reject: "+err);
        that.close();
      });
    };
    this.webSocket.onerror = function(err) {
      if (this.errorFn) {
        this.errorFn(err);
      } else {
        console.log(err);
      }
    };
    this.webSocket.onclose = function(closeEvent) {
      if (this.closeFn) {
        this.closeFn(closeEvent);
      } else {
        console.log(`Received webSocket close: ${closeEvent.code} ${closeEvent.reason}`);
      }
      if (this.webSocket) {
        this.webSocket = null;
      }
    }
  }

  close() :void {
    if (this.webSocket) {
      this.webSocket.close();
    }
  }

  handle(event :MessageEvent ) :void {
    //for flow
    const data = ((event.data : any) :ArrayBuffer);
    if (data.byteLength < 64) {
      //assume text
    } else {
      this.handleMiniseed(event);
    }
  }

  handleMiniseed(event :MessageEvent) :void {
    //for flow
    const data = ((event.data : any) :ArrayBuffer);
    try {
       // let arrBuf = new ArrayBuffer(event.data);
        if (data.byteLength < 64) {
          this.errorFn(new Error("message too small to be miniseed: "+data.byteLength +" "+dataViewToString(new DataView(data))));
          return;
        }
        let slHeader = new DataView(data, 0, 8);
        // check for 'SL' at start
        if (slHeader.getInt8(0) === 83 && slHeader.getInt8(1) === 76) {
          let seqStr = '';
          for (let i=0; i<6; i++) {
            seqStr = seqStr + String.fromCharCode(slHeader.getInt8(2+i));
          }
          let dataView = new DataView(data, 8, data.byteLength-8);
          let out = {
            rawsequence: seqStr,
            sequence: parseInt(seqStr, 16),
            miniseed: miniseed.parseSingleDataRecord(dataView)
          };
          this.receiveMiniseedFn(out);
        } else {
          this.errorFn(new Error("Not a seedlink packet, no starting SL: "+slHeader.getInt8(0)+' '+slHeader.getInt8(1)));
        }
     } catch(e) {
        console.assert(false, e);
        this.errorFn("Error, closing seedlink. "+e);
        this.close();
     }
  }

  sendHello(webSocket :WebSocket) :Promise<string> {
  let promise = new RSVP.Promise(function(resolve, reject) {
    webSocket.onmessage = function(event) {
      //for flow
      const data = ((event.data : any) :ArrayBuffer);
      let replyMsg = dataViewToString(new DataView(data));
      let lines = replyMsg.trim().split('\r');
      if (lines.length == 2) {
        resolve(lines);
      } else {
        reject("not 2 lines: "+replyMsg);
      }
    };
    webSocket.send("HELLO\r");
  });
  return promise;
}

  sendCmdArray(webSocket :WebSocket, cmd :Array<string>) :Promise<string> {
    let that = this;
    return cmd.reduce(function(accum :Promise<string>, next :string) {
      return accum.then(function() {
        return that.createCmdPromise(webSocket, next);
      });
    }, RSVP.resolve());
  }

  createCmdPromise(webSocket :WebSocket, mycmd :string) :Promise<string> {
    let promise = new RSVP.Promise(function(resolve, reject) {
      webSocket.onmessage = function(event) {
        //for flow
        const data = ((event.data : any) :ArrayBuffer);
        let replyMsg = dataViewToString(new DataView(data)).trim();
        if (replyMsg === 'OK') {
          resolve(replyMsg);
        } else {
          reject("msg not OK: "+replyMsg);
        }
      };
      webSocket.send(mycmd+'\r\n');
    });
    return promise;
  }
}
