// @flow

/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */

import * as miniseed from './miniseed';
import * as xseed from './xseed';
import {DataRecord } from './miniseed.js';
import {XSeedRecord } from './xseed.js';
import * as RSVP from 'rsvp';
import moment from 'moment';
import {version} from './index.js';

import {dataViewToString} from './util';

export const SEEDLINK4_PROTOCOL = "SLPROTO4.0";

export const MINISEED_2_FORMAT = '2';
export const MINISEED_3_FORMAT = '3';
export const SE_PACKET_SIGNATURE = "SE";

export class SEPacket {
    dataFormat: string;
    reserved: number;
    payloadLength: number;
    sequence: number;
    _miniseed: DataRecord | null;
    _mseed3: XSeedRecord | null;
    _json: any | null;
    _rawPayload: DataView;
    constructor(dataFormat: string, payloadLength: number, sequence: number) {
      this.dataFormat = dataFormat;
      this.payloadLength = payloadLength;
      this.sequence = sequence;
      this._miniseed = null;
      this._mseed3 = null;
      this._json = null;
      this._rawPayload = null;
    }
    static parse(data: ArrayBuffer): SEPacket {
      let sePacket;
      if (data.byteLength < 16) {
        throw new Error("message too small to be SE packet: "+data.byteLength +" "+dataViewToString(new DataView(data)));
      }
      let slHeader = new DataView(data, 0, 16);
      // check for 'SE' at start
      let sig = String.fromCharCode(slHeader.getUint8(0), slHeader.getUint8(1));
      if (sig === SE_PACKET_SIGNATURE) {
        let dataFormat = slHeader.getUint8(2);
        let reserved = slHeader.getUint8(3);
        let payloadLength = slHeader.getUint32(4);
        let sequenceNum = slHeader.getUint64(8);
        let dataView = new DataView(data, 16, data.byteLength-16);
        sePacket = new SEPacket(String.fromCharCode(dataFormat), payloadLength, sequenceNum);
        sePacket.reserved = reserved;
        sePacket.rawPayload = dataView;
        if (dataFormat === 50) {
          // ascii 2 is 50, miniseed2
          sePacket._miniseed = miniseed.parseSingleDataRecord(dataView);
        } else if (dataFormat === 51) {
          // ascii 3 = 51, miniseed3
          sePacket._mseed3 = xseed.createFromDataView(dataView);
        } else if (dataFormat === 73) {
          // ascii I = 73, info packet with json
          sePacket._json = JSON.parse(dataViewToString(dataView));
        }
      } else {
        throw new Error("Not a seedlink4 packet, no starting SE: "+slHeader.getInt8(0)+' '+slHeader.getInt8(1));
      }
      return sePacket;
    }
    /**
     * is this packet a miniseed packet
     *
     * @returns          true if it is miniseed
     */
    isMiniseed(): boolean {
      return isDef(this._miniseed) || this.dataFormat === MINISEED_2_FORMAT;
    }
    /**
     * Parsed payload as a miniseed data record, if the streamid
     * ends with '/MSEED', null otherwise.
     *
     * @returns miniseed DataRecord or null
     */
    get miniseed(): miniseed.DataRecord | null {
      if ( ! isDef(this._miniseed) ) {
        if (this.dataFormat === MINISEED_2_FORMAT) {
          this._miniseed = miniseed.parseSingleDataRecord(this._rawPayload);
        } else {
          this._miniseed = null;
        }
      }
      return this._miniseed;
    }


    /**
     * is this packet a miniseed3 packet
     *
     * @returns          true if it is miniseed3
     */
    isMiniseed3(): boolean {
      return isDef(this._mseed3) || this.dataFormat === MINISEED_3_FORMAT;
    }
    /**
     * Parsed payload as a miniseed3 data record, if the data format is 3, null otherwise.
     *
     * @returns miniseed3 DataRecord or null
     */
    get miniseed3(): xseed.XSeedDataRecord | null {
      if ( ! isDef(this._mseed3) ) {
        if (this.dataFormat === MINISEED_3_FORMAT) {
          this._mseed3 = xseed.parseSingleDataRecord(this._rawPayload);
        } else {
          this._mseed3 = null;
        }
      }
      return this._mseed3;
    }
}

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
  * @param receivePacketFn the callback function that
  * will be invoked for each seedlink packet received.
  */
export class SeedlinkConnection {
  url: string;
  requestConfig: Array<string>;
  receivePacketFn: (packet: SEPacket) => void;
  errorFn: (error: Error) => void;
  closeFn: null | (close: CloseEvent) => void;
  webSocket: null | WebSocket;
  command: string;
  agent: string;
  agentVersion: string;
  constructor(url: string, requestConfig: Array<string>, receivePacketFn: (packet: SEPacket) => void, errorFn: (error: Error) => void) {
    this.url = url;
    this.requestConfig = requestConfig;
    this.receivePacketFn = receivePacketFn;
    this.errorFn = errorFn;
    this.closeFn = null;
    this.command = 'DATA';
    this.agent = "seisplotjs";
    this.agentVersion = version;
  }
  setAgent(agent: string) {
    this.agent = agent.trim().replaceAll(/\w+/g, '_');
  }
  setTimeCommand(startTime: moment$Moment) {
    this.command = "TIME "+moment.utc(startTime).format("YYYY,MM,DD,HH,mm,ss");
  }
  setOnError(errorFn: (error: Error) => void) {
    this.errorFn = errorFn;
  }
  setOnClose(closeFn: (close: CloseEvent) => void) {
    this.closeFn = closeFn;
  }

  connect() {
    this.interactiveConnect().then(() => {
      return that.sendHello();
    }).then(function(lines) {
      if (this.checkProto(lines)) {
        return true;
      } else {
        throw new Exception(`${SEEDLINK4_PROTOCOL} not found in HELLO response`);
      }
    })
    .then(function() {
      return that.sendCmdArray([ `USERAGENT ${that.agent}/${that.agentVersion} (seisplotjs/${version})` ]);
    })
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
  }

  interactiveConnect() {
    if (this.webSocket) {
      this.webSocket.close();
      this.webSocket = null;
    }
    const that = this;
    console.log("in interactiveConnect");
    return new Promise(function(resolve, reject) {
      try {

        console.log(`WebSocket(${that.url})`);
        const webSocket = new WebSocket(that.url, SEEDLINK4_PROTOCOL);
        that.webSocket = webSocket;
        webSocket.binaryType = 'arraybuffer';
        webSocket.onopen = function() {
          console.log(`onopen`);
          resolve(that);
        };
        webSocket.onerror = function(err) {
          if (that.errorFn) {
            that.errorFn(err);
          }
          reject(event);
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
        if (that.errorFn) {
          that.errorFn(err);
        }
        reject(err);
      }
    }).then(function(sl4) {
      console.log("connected");
      return sl4;
    });
  }

  checkProto(lines: Array<string>): boolean {
    let sl = lines[0].split("::");
    let caps = sl[1].trim().split();
    for (let c of caps) {
      if (c === SEEDLINK4_PROTOCOL) {
        return True;
      }
    }
    return False;
  }

  close(): void {
    if (this.webSocket) {
      this.webSocket.close();
    }
    this.webSocket = null;
  }

  handle(event: MessageEvent ): void {
    //for flow
    const data = ((event.data: any): ArrayBuffer);
    if (data.byteLength < 64) {
      //assume text
    } else if (data[0] === 83 && data[1] === 76){
      this.handleMiniseed(event);
    } else if (data[0] === 83 && data[1] === 69){
      this.handleSEPacket(event);
    }
  }

  handleSEPacket(event: MessageEvent): void {
    //for flow
    const data = ((event.data: any): ArrayBuffer);
    try {
        let out = SEPacket.parse(data);
        this.receiveSEPacketFn(out);
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