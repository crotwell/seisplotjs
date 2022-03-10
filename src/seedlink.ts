/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */
import * as util from "./util"; // for util.log
import * as miniseed from "./miniseed";
import {DataRecord} from "./miniseed";
import RSVP from "rsvp";
import {DateTime, Duration} from "luxon";
import {dataViewToString, stringify, toError} from "./util";
export const SEEDLINK_PROTOCOL = "SeedLink3.1";
export type SequencedDataRecord = {
  rawsequence: string;
  sequence: number;
  miniseed: DataRecord;
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
  errorHandler: (error: Error) => void;
  closeFn: null | ((close: CloseEvent) => void);
  webSocket: null | WebSocket;
  command: string;

  constructor(
    url: string,
    requestConfig: Array<string>,
    receiveMiniseedFn: (packet: SequencedDataRecord) => void,
    errorHandler: (error: Error) => void,
  ) {
    this.url = url;
    this.requestConfig = requestConfig;
    this.receiveMiniseedFn = receiveMiniseedFn;
    this.errorHandler = errorHandler;
    this.closeFn = null;
    this.command = "DATA";
    this.webSocket = null;
  }

  setTimeCommand(startTime: DateTime) {
    this.command =
      "TIME " + startTime.toFormat("YYYY,MM,DD,HH,mm,ss");
  }

  setOnError(errorHandler: (error: Error) => void) {
    this.errorHandler = errorHandler;
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
      webSocket.binaryType = "arraybuffer";
      const that = this;

      webSocket.onopen = function () {
        that
          .sendHello()
          .then(function () {
            return that.sendCmdArray(that.requestConfig);
          })
          .then(function () {
            return that.sendCmdArray([that.command]);
          })
          .then(function (val) {
            webSocket.onmessage = function (event) {
              that.handle(event);
            };

            webSocket.send("END\r");
            return val;
          })
          .catch(err => {
            if (that.errorHandler) {
              that.errorHandler(err);
            } else {
              throw err;
            }

            that.close();
          });
      };

      webSocket.onerror = function (event: Event) {
          that.handleError(new Error("" + stringify(event)));
          that.close();
      };

      webSocket.onclose = function (closeEvent) {
        if (that.closeFn) {
          that.closeFn(closeEvent);
        }

        if (that.webSocket) {
          that.webSocket = null;
        }
      };
    } catch (err) {
      if (this.errorHandler) {
        this.errorHandler(toError(err));
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

  handle(event: MessageEvent): void {
    //for flow
    const data = (event.data as any) as ArrayBuffer;

    if (data.byteLength < 64) {
      //assume text
    } else {
      this.handleMiniseed(event);
    }
  }

  handleMiniseed(event: MessageEvent): void {
    //for flow
    const data = (event.data as any) as ArrayBuffer;

    try {
      if (data.byteLength < 64) {
        this.errorHandler(
          new Error(
            "message too small to be miniseed: " +
              data.byteLength +
              " " +
              dataViewToString(new DataView(data)),
          ),
        );
        return;
      }

      let slHeader = new DataView(data, 0, 8);

      // check for 'SL' at start
      if (slHeader.getInt8(0) === 83 && slHeader.getInt8(1) === 76) {
        let seqStr = "";

        for (let i = 0; i < 6; i++) {
          seqStr = seqStr + String.fromCharCode(slHeader.getInt8(2 + i));
        }

        let dataView = new DataView(data, 8, data.byteLength - 8);
        let out = {
          rawsequence: seqStr,
          sequence: parseInt(seqStr, 16),
          miniseed: miniseed.parseSingleDataRecord(dataView),
        };
        this.receiveMiniseedFn(out);
      } else {
        throw new Error(
          "Not a seedlink packet, no starting SL: " +
            slHeader.getInt8(0) +
            " " +
            slHeader.getInt8(1),
        );
      }
    } catch (e) {
      this.errorHandler(toError(e));
      this.close();
    }
  }

  isConnected(): boolean {
    return this.webSocket !== null;
  }

  /**
   * Sends initial HELLO to server and waits for response.
   *
   * @returns            Promise that resolves to the response from the server.
   */
  sendHello(): Promise<[string,string]> {
    let webSocket = this.webSocket;
    let promise: Promise<[string,string]> = new RSVP.Promise(function (resolve, reject) {
      if (webSocket) {
        webSocket.onmessage = function (event) {
          //for flow
          const data = (event.data as any) as ArrayBuffer;
          let replyMsg = dataViewToString(new DataView(data));
          let lines = replyMsg.trim().split("\r");

          if (lines.length === 2) {
            resolve([lines[0],lines[1]]);
          } else {
            reject("not 2 lines: " + replyMsg);
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
    return cmd.reduce(function (accum: Promise<string>, next: string) {
      return accum.then(function (): Promise<string> {
        return that.createCmdPromise(next);
      });
    }, RSVP.resolve("OK"));
  }

  /**
   * creates a Promise that sends a command and waits resolved with the result.
   *
   * @param   mycmd command string to send.
   * @returns        Promise that resolves to the reply from the server.
   */
  createCmdPromise(mycmd: string): Promise<string> {
    let webSocket = this.webSocket;
    let promise: Promise<string> = new RSVP.Promise(function (resolve, reject) {
      if (webSocket) {
        webSocket.onmessage = function (event) {
          //for flow
          const data = (event.data as any) as ArrayBuffer;
          let replyMsg = dataViewToString(new DataView(data)).trim();

          if (replyMsg === "OK") {
            resolve(replyMsg);
          } else {
            reject("msg not OK: " + replyMsg);
          }
        };

        webSocket.send(mycmd + "\r\n");
      } else {
        reject("webSocket has been closed");
      }
    });
    return promise;
  }

  /**
   * handle errors that arise
   *
   * @private
   * @param   error the error
   */
  handleError(error: Error): void {
    if (this.errorHandler) {
      this.errorHandler(error);
    } else {
      util.log("seedlink handleError: " + error.message);
    }
  }
}
