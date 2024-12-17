/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * https://www.seis.sc.edu
 */
import * as util from "./util"; // for util.log
import * as miniseed from "./miniseed";
import { DataRecord } from "./miniseed";
import { DateTime } from "luxon";
import { dataViewToString, stringify, toError } from "./util";
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
 * The seedlink (ver 3) protocol does not have an official spec document, but
 * some details are here:
 * https://www.seiscomp.de/doc/apps/seedlink.html
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
  helloLines: Array<string> = [];

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
    this.command = "TIME " + startTime.toFormat("yyyy,LL,dd,HH,mm,ss");
  }

  setOnError(errorHandler: (error: Error) => void) {
    this.errorHandler = errorHandler;
  }

  setOnClose(closeFn: (close: CloseEvent) => void) {
    this.closeFn = closeFn;
  }


  connect() {
    return this.interactiveConnect()
      .then(() => {
        return this.sendHello();
      })
      .then((lines) => {
        this.helloLines = lines;
        return this.sendCmdArray(this.requestConfig);
      })
      .then(() => {
        return this.sendCmdArray([this.command]);
      })
      .then((val) => {
        if (this.webSocket === null) {
          throw new Error("websocket is null");
        }
        this.webSocket.onmessage = (event) => {
          this.handle(event);
        };

        this.webSocket.send("END\r");
        return val;
      })
      .catch((err) => {
        this.close();
        const insureErr =
          err instanceof Error ? err : new Error(stringify(err));
        if (this.errorHandler) {
          this.errorHandler(insureErr);
        } else {
          throw insureErr;
        }
      });
  }

  interactiveConnect(): Promise<SeedlinkConnection> {
    if (this.webSocket) {
      this.webSocket.close();
      this.webSocket = null;
    }

    return new Promise((resolve, reject) => {
      try {
        const webSocket = new WebSocket(this.url, SEEDLINK_PROTOCOL);
        this.webSocket = webSocket;
        webSocket.binaryType = "arraybuffer";

        webSocket.onopen = () => {
          resolve(this);
        };

        webSocket.onerror = (event: Event) => {
          const evtError = toError(event);
          this.handleError(evtError);
          reject(evtError);
        };

        webSocket.onclose = (closeEvent) => {
          if (this.closeFn) {
            this.closeFn(closeEvent);
          }

          if (this.webSocket) {
            this.webSocket = null;
          }
        };
      } catch (err) {
        this.close();
        const evtError = toError(err);
        if (this.errorHandler) {
          this.errorHandler(evtError);
        }

        reject(evtError);
      }
    }).then(function (sl3: unknown) {
      return sl3 as SeedlinkConnection;
    });
  }

  close(): void {
    if (this.webSocket) {
      this.webSocket.close();
    }
  }

  handle(event: MessageEvent): void {
    if (event.data instanceof ArrayBuffer) {
      const data: ArrayBuffer = event.data;

      if (data.byteLength < 64) {
        //assume text
      } else {
        this.handleMiniseed(data);
      }
    } else {
      // ?? error??
      this.handleError(new Error("Unknown message type" + String(event)));
    }
  }

  handleMiniseed(data: ArrayBuffer): void {
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

      const slHeader = new DataView(data, 0, 8);

      // check for 'SL' at start
      if (slHeader.getInt8(0) === 83 && slHeader.getInt8(1) === 76) {
        let seqStr = "";

        for (let i = 0; i < 6; i++) {
          seqStr = seqStr + String.fromCharCode(slHeader.getInt8(2 + i));
        }

        const dataView = new DataView(data, 8, data.byteLength - 8);
        const out = {
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
  sendHello(): Promise<[string, string]> {
    const webSocket = this.webSocket;
    const promise: Promise<[string, string]> = new Promise(function (
      resolve,
      reject,
    ) {
      if (webSocket) {
        webSocket.onmessage = function (event) {
          if (event.data instanceof ArrayBuffer) {
            const data: ArrayBuffer = event.data;
            const replyMsg = dataViewToString(new DataView(data));
            const lines = replyMsg.trim().split("\r");

            if (lines.length === 2) {
              resolve([lines[0], lines[1]]);
            } else {
              reject(new Error("not 2 lines: " + replyMsg));
            }
          } else {
            reject(new Error("event.data not ArrayBuffer?"));
          }
        };

        webSocket.send("HELLO\r");
      } else {
        reject(new Error("webSocket has been closed"));
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
    return cmd.reduce((accum: Promise<string>, next: string) => {
      return accum.then((): Promise<string> => {
        return this.createCmdPromise(next);
      });
    }, Promise.resolve("OK"));
  }

  /**
   * creates a Promise that sends a command and waits resolved with the result.
   *
   * @param   mycmd command string to send.
   * @returns        Promise that resolves to the reply from the server.
   */
  createCmdPromise(mycmd: string): Promise<string> {
    const webSocket = this.webSocket;
    const promise: Promise<string> = new Promise(function (resolve, reject) {
      if (webSocket) {
        webSocket.onmessage = function (event) {
          if (event.data instanceof ArrayBuffer) {
            const data: ArrayBuffer = event.data;
            const replyMsg = dataViewToString(new DataView(data)).trim();

            if (replyMsg === "OK") {
              resolve(replyMsg);
            } else {
              reject(new Error("msg not OK: " + replyMsg));
            }
          } else {
            reject(new Error("event.data not ArrayBuffer?"));
          }
        };

        webSocket.send(mycmd + "\r\n");
      } else {
        reject(new Error("webSocket has been closed"));
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
