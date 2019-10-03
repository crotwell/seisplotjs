// @flow

/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */

import * as miniseed from './miniseed';
import * as RSVP from 'rsvp';
import moment from 'moment';

import {dataViewToString} from './util';

export const SEEDLINK_PROTOCOL = "SeedLink3.1";

export type SequencedDataRecord = {
  rawsequence: string,
  sequence: number,
  miniseed: miniseed.DataRecord
};

 /**
  * A seedlink websocket connection to the given url.
  * The connection is not made until the connect() method is called.
  * Note this cannot connect directly to a native TCP socket, instead it
  * sends the seedlink protocol over a websocket. Currently only the IRIS
  * ringserver, https://github.com/iris-edu/ringserver,
  * supports websockets, but it may be possible to use thrid party
  * tools to proxy the websocket to a TCP seedlink socket.
  *
  * @param url websocket URL to connect to
  * @param requestConfig an array of seedlink commands
  * like:<pre><code>
  *   [ 'STATION JSC CO',
  *     'SELECT 00BHZ.D' ]
  *     </pre></code>
  * @param receiveMiniseedFn the callback function that
  * will be invoked for each seedlink packet received
  * which contains 'sequence', a sequence number
  * and 'miniseed', a single miniseed record.
  */
export class SeedlinkConnection {
  url: string;
  requestConfig: Array<string>;
  receiveMiniseedFn: (packet: SequencedDataRecord) => void;
  errorFn: (error: Error) => void;
  closeFn: null | (close: CloseEvent) => void;
  webSocket: null | WebSocket;
  command: string;
  constructor(url: string, requestConfig: Array<string>, receiveMiniseedFn: (packet: SequencedDataRecord) => void, errorFn: (error: Error) => void) {
    this.url = url;
    this.requestConfig = requestConfig;
    this.receiveMiniseedFn = receiveMiniseedFn;
    this.errorFn = errorFn;
    this.closeFn = null;
    this.command = 'DATA';
  }
  setTimeCommand(startTime: moment) {
    this.command = "TIME "+moment.utc(startTime).format("YYYY,MM,DD,HH,mm,ss");
  }
  setOnError(errorFn: (error: Error) => void) {
    this.errorFn = errorFn;
  }
  setOnClose(closeFn: (close: CloseEvent) => void) {
    this.closeFn = closeFn;
  }

  connect() {
    if (this.webSocket) {
      this.webSocket.close();
      this.webSocket = null;
    }
    try {
      const webSocket = new WebSocket(this.url, SEEDLINK_PROTOCOL);
      this.webSocket = webSocket;
      webSocket.binaryType = 'arraybuffer';
      const that = this;
      webSocket.onopen = function() {
        that.sendHello()
        .then(function() {
          return that.sendCmdArray(that.requestConfig);
        })
        .then(function() {
          return that.sendCmdArray([ that.command ]);
        })
        .then(function(val) {
          webSocket.onmessage = function(event) {
            that.handle(event);
          };
          webSocket.send('END\r');
          return val;
        }).catch(err => {
          if (that.errorFn) {
            that.errorFn(err);
          } else {
            throw err;
          }
          that.close();
        });
      };
      webSocket.onerror = function(err) {
        if (that.errorFn) {
          that.errorFn(err);
        } else {
          throw err;
        }
      };
      webSocket.onclose = function(closeEvent) {
        if (that.closeFn) {
          that.closeFn(closeEvent);
        }
        if (that.webSocket) {
          that.webSocket = null;
        }
      };
    } catch(err) {
      if (this.errorFn) {
        this.errorFn(err);
      } else {
        throw err;
      }
    }
  }

  close(): void {
    if (this.webSocket) {
      this.webSocket.close();
    }
  }

  handle(event: MessageEvent ): void {
    //for flow
    const data = ((event.data: any): ArrayBuffer);
    if (data.byteLength < 64) {
      //assume text
    } else {
      this.handleMiniseed(event);
    }
  }

  handleMiniseed(event: MessageEvent): void {
    //for flow
    const data = ((event.data: any): ArrayBuffer);
    try {
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
          throw new Error("Not a seedlink packet, no starting SL: "+slHeader.getInt8(0)+' '+slHeader.getInt8(1));
        }
     } catch(e) {
        this.errorFn("Error, closing seedlink. "+e);
        this.close();
     }
  }
  isConnected(): boolean  {
    return this.webSocket !== null;
  }

  /**
   * Sends initial HELLO to server and waits for response.
   *
   * @returns            Promise that resolves to the response from the server.
   */
  sendHello(): Promise<string> {
    let webSocket = this.webSocket;
    let promise = new RSVP.Promise(function(resolve, reject) {
      if (webSocket) {
        webSocket.onmessage = function(event) {
          //for flow
          const data = ((event.data: any): ArrayBuffer);
          let replyMsg = dataViewToString(new DataView(data));
          let lines = replyMsg.trim().split('\r');
          if (lines.length === 2) {
            resolve(lines);
          } else {
            reject("not 2 lines: "+replyMsg);
          }
        };
        webSocket.send("HELLO\r");
      } else {
        reject("webSocket has been closed");
      }
    });
    return promise;
  }

  /**
   * Sends an array of commands, each as a Promise waiting for the 'OK' response
   * before sending the next.
   *
   * @param   cmd array of commands to send
   * @returns      Promise that resolves to the 'OK' returned by the last
   *   command if successful, or rejects on the first failure.
   */
  sendCmdArray(cmd: Array<string>): Promise<string> {
    let that = this;
    return cmd.reduce(function(accum: Promise<string>, next: string) {
      return accum.then(function() {
        return that.createCmdPromise(next);
      });
    }, RSVP.resolve());
  }

  /**
   * creates a Promise that sends a command and waits resolved with the result.
   *
   * @param   mycmd command string to send.
   * @returns        Promise that resolves to the reply from the server.
   */
  createCmdPromise(mycmd: string): Promise<string> {
    let webSocket = this.webSocket;
    let promise = new RSVP.Promise(function(resolve, reject) {
      if (webSocket) {
        webSocket.onmessage = function(event) {
          //for flow
          const data = ((event.data: any): ArrayBuffer);
          let replyMsg = dataViewToString(new DataView(data)).trim();
          if (replyMsg === 'OK') {
            resolve(replyMsg);
          } else {
            reject("msg not OK: "+replyMsg);
          }
        };
        webSocket.send(mycmd+'\r\n');
      } else {
        reject("webSocket has been closed");
      }
    });
    return promise;
  }
}
