/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * https://www.seis.sc.edu
 */
import * as util from "./util"; // for util.log
import * as miniseed from "./miniseed";
import * as mseed3 from "./mseed3";
import { DataRecord } from "./miniseed";
import { MSeed3Record } from "./mseed3";
import { DateTime } from "luxon";
import { version } from "./version";
import { dataViewToString, isDef, stringify, toError } from "./util";
export const SEEDLINK4_PROTOCOL = "SLPROTO4.0";
export const MINISEED_2_FORMAT = "2";
export const MINISEED_3_FORMAT = "3";
export const SE_PACKET_SIGNATURE = "SE";
export const END_COMMAND = "END";
export const ENDFETCH_COMMAND = "ENDFETCH";
export const AUTH_COMMAND = "AUTH";
export const BYE_COMMAND = "BYE";
export const DATA_COMMAND = "DATA";
export const HELLO_COMMAND = "HELLO";
export const INFO_COMMAND = "INFO";
export const SELECT_COMMAND = "SELECT";
export const SLPROTO_COMMAND = "SLPROTO";
export const STATION_COMMAND = "STATION";
export const USERAGENT_COMMAND = "USERAGENT";

const useLittleEndian = true;
export class SEPacket {
  dataFormat: string;
  dataSubformat: string;
  payloadLength: number;
  sequence: bigint;
  stationId: string;
  _miniseed: DataRecord | null;
  _mseed3: MSeed3Record | null;
  _json: Record<string, unknown> | null;
  _rawPayload: DataView | null;

  constructor(
    dataFormat: string,
    dataSubformat: string,
    payloadLength: number,
    sequence: bigint,
    stationId: string,
  ) {
    this.dataFormat = dataFormat;
    this.dataSubformat = dataSubformat;
    this.payloadLength = payloadLength;
    this.sequence = sequence;
    this.stationId = stationId;
    this._miniseed = null;
    this._mseed3 = null;
    this._json = null;
    this._rawPayload = null;
  }

  static parse(data: ArrayBuffer): SEPacket {
    let sePacket;

    if (data.byteLength < 16) {
      throw new Error(
        "message too small to be SE packet: " +
          data.byteLength +
          " " +
          dataViewToString(new DataView(data)),
      );
    }

    const slHeader = new DataView(data, 0, 16);
    // check for 'SE' at start
    const sig = String.fromCharCode(slHeader.getUint8(0), slHeader.getUint8(1));

    if (sig === SE_PACKET_SIGNATURE) {
      const dataFormat = slHeader.getUint8(2);
      const dataSubformat = slHeader.getUint8(3);
      const payloadLength = slHeader.getUint32(4, useLittleEndian);
      const sequenceNum = slHeader.getBigUint64(8, useLittleEndian);
      const stationIdLength = slHeader.getUint8(16);
      const stationIdDV = new DataView(data, 17, stationIdLength);
      const stationId = dataViewToString(stationIdDV);
      const dataView = new DataView(
        data,
        17 + stationIdLength,
        data.byteLength - 16,
      );
      sePacket = new SEPacket(
        String.fromCharCode(dataFormat),
        String.fromCharCode(dataSubformat),
        payloadLength,
        sequenceNum,
        stationId,
      );
      sePacket._rawPayload = dataView;

      if (dataFormat === 50) {
        // ascii 2 is 50, miniseed2
        sePacket._miniseed = miniseed.parseSingleDataRecord(dataView);
      } else if (dataFormat === 51) {
        // ascii 3 = 51, miniseed3
        sePacket._mseed3 = mseed3.MSeed3Record.parseSingleDataRecord(dataView);
      } else if (dataFormat === 74) {
        // ascii J = 74, json e.g. info packet
        // spec says must be json object
        const jsonData = JSON.parse(dataViewToString(dataView)) as Record<
          string,
          unknown
        >;
        sePacket._json = jsonData;
      }
    } else {
      throw new Error(
        "Not a seedlink4 packet, no starting SE: " +
          slHeader.getInt8(0) +
          " " +
          slHeader.getInt8(1),
      );
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
  asMiniseed(): miniseed.DataRecord | null {
    if (!isDef(this._rawPayload)) {
      throw new Error(
        `payload is missing in packet from ${this.stationId}, seq: ${this.sequence}`,
      );
    }

    if (!isDef(this._miniseed)) {
      if (this.dataFormat === MINISEED_2_FORMAT && isDef(this._rawPayload)) {
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
  asMiniseed3(): mseed3.MSeed3Record | null {
    if (!isDef(this._rawPayload)) {
      throw new Error(
        `payload is missing in packet from ${this.stationId}, seq: ${this.sequence}`,
      );
    }

    if (!isDef(this._mseed3)) {
      if (this.dataFormat === MINISEED_3_FORMAT && isDef(this._rawPayload)) {
        this._mseed3 = mseed3.MSeed3Record.parseSingleDataRecord(
          this._rawPayload,
        );
      } else if (this.isMiniseed()) {
        const ms2 = this.asMiniseed();
        if (ms2) {
          this._mseed3 = mseed3.convertMS2Record(ms2);
        }
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
 * The spec is available via the FDSN, https://www.fdsn.org/publications/
 *
 * Note as of 2023, this is largely untested as there are now servers
 * available to test against.
 *
 * @param url websocket URL to connect to
 * @param requestConfig an array of seedlink commands
 * like:<pre><code>
 *   [ 'STATION CO_JSC',
 *     'SELECT 00_B_H_Z' ]
 *     </pre></code>
 * @param receivePacketFn the callback function that
 * will be invoked for each seedlink packet received.
 * @param errorHandler callback function for errors
 * @param closeFn callback function for closing connection
 * @param webSocket optional web socket connection
 * @param endCommand handshake ending command, either END or ENDFETCH
 * @param agent agent identifier
 * @param agentVersion agent version
 */
export class SeedlinkConnection {
  url: string;
  requestConfig: Array<string>;
  receivePacketFn: (packet: SEPacket) => void;
  errorHandler: (error: Error) => void;
  closeFn: null | ((close: CloseEvent) => void);
  webSocket: null | WebSocket;
  endCommand: string;
  agent: string;
  agentVersion: string;

  constructor(
    url: string,
    requestConfig: Array<string>,
    receivePacketFn: (packet: SEPacket) => void,
    errorHandler: (error: Error) => void,
  ) {
    this.webSocket = null;
    this.url = url;
    this.requestConfig = requestConfig;
    this.receivePacketFn = receivePacketFn;
    this.errorHandler = errorHandler;
    this.closeFn = null;
    this.endCommand = END_COMMAND;
    this.agent = "seisplotjs";
    this.agentVersion = version;
  }

  setAgent(agent: string) {
    this.agent = agent.trim().replaceAll(/\w+/g, "_");
  }

  createDataTimeCommand(
    startTime: DateTime,
    endTime: DateTime | undefined,
  ): string {
    const endTimeStr = isDef(endTime) ? endTime.toISO() : "";
    return `DATA ALL ${startTime.toISO()} ${endTimeStr}`;
  }

  setOnError(errorHandler: (error: Error) => void) {
    this.errorHandler = errorHandler;
  }

  setOnClose(closeFn: (close: CloseEvent) => void) {
    this.closeFn = closeFn;
  }

  connect() {
    this.interactiveConnect()
      .then(() => {
        return this.sendHello();
      })
      .then((lines) => {
        if (this.checkProto(lines)) {
          return true;
        } else {
          throw new Error(`${SEEDLINK4_PROTOCOL} not found in HELLO response`);
        }
      })
      .then(() => {
        return this.sendCmdArray([
          `${USERAGENT_COMMAND} ${this.agent}/${this.agentVersion} (seisplotjs/${version})`,
        ]);
      })
      .then(() => {
        return this.sendCmdArray(this.requestConfig);
      })
      .then(() => {
        return this.sendCmdArray([this.endCommand]);
      })
      .then((val) => {
        if (this.webSocket === null) {
          throw new Error("websocket is null");
        }
        this.webSocket.onmessage = (event) => {
          this.handle(event);
        };

        this.webSocket.send(`${this.endCommand}\r`);
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
        const webSocket = new WebSocket(this.url, SEEDLINK4_PROTOCOL);
        this.webSocket = webSocket;
        webSocket.binaryType = "arraybuffer";

        webSocket.onopen = () => {
          resolve(this);
        };

        webSocket.onerror = (event: Event) => {
          this.handleError(new Error("" + stringify(event)));
          reject(event);
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
        if (this.errorHandler) {
          this.errorHandler(toError(err));
        }

        reject(err);
      }
    }).then(function (sl4: unknown) {
      return sl4 as SeedlinkConnection;
    });
  }

  checkProto(lines: Array<string>): boolean {
    const sl = lines[0].split("::");
    const caps = sl[1].trim().split(" ");

    for (const c of caps) {
      if (c === SEEDLINK4_PROTOCOL) {
        return true;
      }
    }

    return false;
  }

  close(): void {
    if (this.webSocket) {
      this.webSocket.close();
    }

    this.webSocket = null;
  }

  handle(event: MessageEvent): void {
    if (event.data instanceof ArrayBuffer) {
      const rawdata: ArrayBuffer = event.data;
      const data = new Uint8Array(rawdata);

      if (data[0] === 83 && data[1] === 69) {
        this.handleSEPacket(event);
      } else {
        this.close();
        this.errorHandler(
          new Error(
            `Packet does not look like SE packet: ${data[0]} ${data[1]}`,
          ),
        );
      }
    } else {
      this.close();
      this.errorHandler(new Error("event.data is not ArrayBuffer"));
    }
  }

  handleSEPacket(event: MessageEvent): void {
    if (event.data instanceof ArrayBuffer) {
      const data: ArrayBuffer = event.data;

      try {
        const out = SEPacket.parse(data);
        this.receivePacketFn(out);
      } catch (e) {
        this.close();
        this.errorHandler(toError(e));
      }
    } else {
      this.close();
      this.errorHandler(new Error("event.data is not ArrayBuffer"));
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
  sendHello(): Promise<Array<string>> {
    const webSocket = this.webSocket;
    const promise: Promise<Array<string>> = new Promise((resolve, reject) => {
      if (webSocket) {
        webSocket.onmessage = (event) => {
          if (event.data instanceof ArrayBuffer) {
            const data: ArrayBuffer = event.data;
            const replyMsg = dataViewToString(new DataView(data));
            const lines = replyMsg.trim().split("\r");

            if (lines.length === 2) {
              resolve(lines);
            } else {
              reject("not 2 lines: " + replyMsg);
            }
          } else {
            this.close();
            this.errorHandler(new Error("event.data is not ArrayBuffer"));
          }
        };

        webSocket.send(`${HELLO_COMMAND}\r`);
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
    return cmd.reduce((accum: Promise<string>, next: string) => {
      return accum.then(() => {
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
    const mythis = this;
    const webSocket = this.webSocket;
    const promise: Promise<string> = new Promise(function (resolve, reject) {
      if (webSocket) {
        webSocket.onmessage = (event) => {
          if (event.data instanceof ArrayBuffer) {
            const data: ArrayBuffer = event.data;
            const replyMsg = dataViewToString(new DataView(data)).trim();

            if (replyMsg === "OK") {
              resolve(replyMsg);
            } else {
              reject("msg not OK: " + replyMsg);
            }
          } else {
            mythis.close();
            mythis.errorHandler(new Error("event.data is not ArrayBuffer"));
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
      util.log("seedlink4 handleError: " + error.message);
    }
  }
}
