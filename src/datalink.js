// @flow

/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */

import * as util from './util.js'; // for util.log
import {dataViewToString, stringify, isDef, isNonEmptyStringArg} from './util';
import * as miniseed from './miniseed';
import * as RSVP from 'rsvp';
import moment from 'moment';

/** const for datalink protocol for web sockets, DataLink1.0 */
export const DATALINK_PROTOCOL = "DataLink1.0";
/** const for query mode, QUERY */
export const QUERY_MODE = "QUERY";
/** const for streaming mode, STREAM */
export const STREAM_MODE = "STREAM";
/** const for maximum process number to create fake number for datalink id, 2^16-2 */
export const MAX_PROC_NUM = Math.pow(2, 16)-2;
/** const for fake user name for datalink id, browser */
export const USER_BROWSER = "browser";
/** const for fake program name for datalink id, seisplotjs */
export const DEFAULT_PROGRAM = "seisplotjs";
/** const for fake architecture for datalink id, javascript */
export const DEFAULT_ARCH = "javascript";

/** const for error response, ERROR */
export const ERROR = "ERROR";
export const PACKET = "PACKET";
export const STREAM = "STREAM";
export const ENDSTREAM = "ENDSTREAM";
export const MSEED_TYPE = "/MSEED";

export const IRIS_RINGSERVER_URL = "ws://rtserve.iris.washington.edu/datalink";

let defaultHandleResponse = function(message) {
  util.log("Unhandled datalink response: "+message);
};

/**
 * A websocket based Datalink connection to a ringserver.
 * Currently only the IRIS
 * ringserver, https://github.com/iris-edu/ringserver,
 * supports websockets, but it may be possible to use thrid party
 * tools to proxy the websocket to a TCP datalink socket.
 * The datalink protocol is documented here
 *  https://raw.githubusercontent.com/iris-edu/libdali/master/doc/DataLink.protocol
 *
 * @param url websocket url to the ringserver
 * @param packetHandler callback for packets as they arrive
 * @param errorHandler callback for errors
 */
export class DataLinkConnection {
  url: string;
  /** @private */
  _mode: string | null;
  packetHandler: (packet: DataLinkPacket) => void;
  errorHandler: (error: Error) => void;
  closeHandler: null | (close: CloseEvent) => void;
  serverId: string | null;
  clientIdNum: number;
  programname: string;
  username: string;
  architecture: string;
  _responseResolve: null | (response: DataLinkResponse) => void;
  _responseReject: null | (error: Error) => void;
  webSocket: WebSocket | null;
  constructor(url: string, packetHandler: (packet: DataLinkPacket) => void, errorHandler: (error: Error) => void) {
    this.url = url;
    this._mode = QUERY_MODE;
    this.packetHandler = packetHandler;
    this.errorHandler = errorHandler;
    this.closeHandler = null;
    this.serverId = null;
    // meant to be processId, so use 1 <= num <= 2^15 to be safe
    this.clientIdNum = Math.floor(Math.random() * MAX_PROC_NUM)+1;
    this.programname = DEFAULT_PROGRAM;
    this.username = USER_BROWSER;
    this.architecture = DEFAULT_ARCH;
    this._responseResolve = null;
    this._responseReject = null;
  }

  /**
   * Set a callback function called when the connection is closed.
   *
   * @param  closeHandler callback function
   */
  setOnClose(closeHandler: (close: CloseEvent) => void) {
    this.closeHandler = closeHandler;
  }

  /**
   * creates the websocket connection and sends the client ID.
   *
   *  @returns a Promise that resolves to the server's ID.
   */
  connect() {
    const that = this;
    return new RSVP.Promise(function(resolve, reject) {
      const webSocket = new WebSocket(that.url, DATALINK_PROTOCOL);
      that.webSocket = webSocket;
      webSocket.binaryType = 'arraybuffer';
      webSocket.onmessage = function(event) {
        that.handle(event);
      };
      webSocket.onerror = function(event) {
        that.handleError(new Error(""+stringify(event)));
        reject(event);
      };
      webSocket.onclose = function(closeEvent) {
        that.webSocket = null; // clean up
        that._mode = QUERY_MODE;
        if (that.closeHandler) {
          that.closeHandler(closeEvent);
        }
      };
      webSocket.onopen = function() {
        resolve(that);
      };
    }).then(datalink => {
      return datalink.sendId();
    }).then( idmsg => {
      that.serverId = idmsg;
      return idmsg;
    });
  }

/**
 * @returns true if the websocket is connected (non-null)
 */
  isConnected(): boolean {
    return this.webSocket !== null;
  }
  /**
   * @returns the current mode, QUERY_MODE or STREAM_MODE
   *
   */
  get mode() { return this._mode;}

  /**
   * Switches to streaming mode to receive data packets from the ringserver.
   */
  stream(): void {
    if (this._mode === STREAM_MODE) {return;}
    this._mode = STREAM_MODE;
    this.sendDLCommand(STREAM, "");
  }

  /**
   * Switches back to query mode to enable commands to be sent to the ringserver.
   */
  endStream(): void {
    if (this.webSocket === null || this._mode === null || this._mode === QUERY_MODE) {return;}
    this._mode = QUERY_MODE;
    this.sendDLCommand(ENDSTREAM, "");
  }

  /**
   * Closes the connection and the underlying websocket. No communication
   * is possible until connect() is called again.
   */
  close(): void {
    if (this.webSocket) {
      this.endStream(); // end streaming just in case
      if (this.webSocket) {this.webSocket.close();}
      this.webSocket = null;
      this._mode = null;
    }
  }

  /**
   * Send a ID Command. Command is a string.
   *
   * @returns a Promise that resolves to the response from the ringserver.
   */
  sendId(): Promise<string> {
    const that = this;
    return this.id(this.programname, this.username, stringify(this.clientIdNum), this.architecture)
    .then(this.ensureDataLinkResponse)
    .then(dlResponse => {
      if (dlResponse.type === 'ID') {
        that.serverId = ''+dlResponse.message;
        return that.serverId;
      } else {
        throw new Error("not ID response: "+stringify(dlResponse.type));
      }
    });
  }

  /**
   * encodes as a Datalink packet, header with optional data section as
   * binary Uint8Array. Size of the binary data is appended
   * to the header if present.
   *
   * @param header the command/header string
   * @param data optional data portion
   * @returns datalink packet as an ArrayBuffer
   */
  encodeDL(header: string, data?: Uint8Array): ArrayBuffer {
    let cmdLen = header.length;
    let len = 3+header.length;
    let lenStr = "";
    if (data && data.length > 0) {
      lenStr = String(data.length);
      len+=lenStr.length+1;
      cmdLen += lenStr.length+1;
      len+=data.length;

    }
    let rawPacket = new ArrayBuffer(len);
    const binaryPacket = new Uint8Array(rawPacket);
    let packet = new DataView(rawPacket);
    packet.setUint8(0, 68); // ascii D
    packet.setUint8(1, 76); // ascii L
    packet.setUint8(2, cmdLen);
    let i = 3;
    for (const c of header) {
      packet.setUint8(i, c.charCodeAt(0));
      i++;
    }
    const SPACE = ' ';
    if (data && data.length > 0) {
      packet.setUint8(i, SPACE.charCodeAt(0)); // ascii space
      i++;
      for (const c of lenStr) {
        packet.setUint8(i, c.charCodeAt(0));
        i++;
      }
      binaryPacket.set(data, i);
    }
    return rawPacket;
  }

  /** sends the header with optional binary data
   * as the data section. Size of the data is appended
   * to the header before sending if present.
   *
   * @param header header to send
   * @param data optional data to send
   */
  sendDLBinary(header: string, data?: Uint8Array): void {
    const rawPacket = this.encodeDL(header, data);
    if (this.webSocket) {
      this.webSocket.send(rawPacket);
    } else {
      throw new Error("WebSocket has been closed.");
    }
  }

  /** sends the command as header with optional dataString
   * as the data section. Size of the dataString is appended
   * to the header before sending.
   *
   * @param command the command/header string
   * @param dataString optional data portion of packet
   */
  sendDLCommand(command: string, dataString?: string): void {
    this.sendDLBinary(command, stringToUint8Array(dataString));
  }

  /**
   * Send a DataLink Command and await the response. Command is a string.
   *
   * @param header packet header
   * @param data optional data portion of packet
   * @returns a Promise that resolves with the webSocket MessageEvent.
   */
  awaitDLBinary(header: string, data?: Uint8Array): Promise<DataLinkResponse> |  Promise<DataLinkPacket> {
    let that = this;
    let promise = new RSVP.Promise(function(resolve, reject) {
      that._responseResolve = resolve;
      that._responseReject = reject;
      that.sendDLBinary(header, data);
    }).then(response => {
      that._responseResolve = null;
      that._responseReject = null;
      return response;
    }).catch(error => {
      that._responseResolve = null;
      that._responseReject = null;
      throw error;
    });
    return promise;
  }


  /**
   * Send a DataLink Command and await the response. Command is a string.
   * Returns a Promise that resolves with the webSocket MessageEvent.
   *
   * @param command the command/header string
   * @param dataString optional data portion of packet
   * @returns promise to server's response
   */
  awaitDLCommand(command: string, dataString?: string): Promise<DataLinkResponse> |  Promise<DataLinkPacket> {
    return this.awaitDLBinary(command, stringToUint8Array(dataString));
  }

  /**
   * Writes data to the ringserver and awaits a acknowledgement.
   *
   * @param   streamid    stream id for packet header
   * @param   hpdatastart start of timewindow the packet covers
   * @param   hpdataend   end of timewindow the packet covers
   * @param   data        optional data to send
   * @returns             promise to server's response
   */
  writeAck(streamid: string, hpdatastart: number, hpdataend: number, data?: Uint8Array): Promise<DataLinkResponse> |  Promise<DataLinkPacket>  {
    let header = `WRITE ${streamid} ${momentToHPTime(hpdatastart)} ${momentToHPTime(hpdataend)} A`;
    return this.awaitDLBinary(header, data);
  }

  /**
   * Makes sure a response actually is a DataLinkResponse
   *
   * @param   dl datalink packet/response
   * @returns DataLinkResponse after checking instanceof
   * @throws Error if not a DataLinkResponse
   */
  ensureDataLinkResponse(dl: DataLinkResponse | DataLinkPacket): DataLinkResponse {
    if (dl instanceof DataLinkResponse) {
      return dl;
    }
    throw new Error(`Expected DataLinkResponse but got ${dl.header}`);
  }

  /**
   * Makes sure a response actually is a DataLinkPacket
   *
   * @param   dl datalink packet/response
   * @returns DataLinkPacket after checking instanceof
   * @throws Error if not a DataLinkPacket
   */
  ensureDataLinkPacket(dl: DataLinkResponse | DataLinkPacket): DataLinkPacket {
    if (dl instanceof DataLinkPacket) {
      return dl;
    }
    throw new Error(`Expected DataLinkPacket but got ${dl.type}`);
  }

  /**
   * Send id and await server's response. All of these are can more or less
   * be filled with dummy values. They are mostly used for logging and debugging
   * on the server side.
   *
   * @param programname name of program, ex seisplotjs
   * @param username name of user, ex browser
   * @param processid process number, used to differentiate between multiple running instances
   * @param architecture cpu architecture, ex javascript
   * @returns promise to servers response
   */
  id(programname: string, username: string, processid: string, architecture: string): Promise<DataLinkResponse> {
    let command = `ID ${programname}:${username}:${processid}:${architecture}`;
    return this.awaitDLCommand(command).then(this.ensureDataLinkResponse);
  }

  /**
   * Send info command for infoType.
   *
   * @param infoType type to get info for
   * @returns promise to server's response
   */
  info(infoType: string): Promise<DataLinkResponse> {
    let command = `INFO ${infoType}`;
    return this.awaitDLCommand(command).then(this.ensureDataLinkResponse);
  }

  /**
   * Send position after command.
   *
   * @param time time to position after
   * @returns promise to server's response
   */
  positionAfter(time: moment): Promise<DataLinkResponse> {
    return this.positionAfterHPTime(momentToHPTime(time)).then(this.ensureDataLinkResponse);
  }

  /**
   * Send position after command.
   *
   * @param hpTime time to position after
   * @returns promise to server's response
   */
  positionAfterHPTime(hpTime: number): Promise<DataLinkResponse> {
    let command = `POSITION AFTER ${hpTime}`;
    return this.awaitDLCommand(command).then(this.ensureDataLinkResponse);
  }

  /**
   * Send match command.
   *
   * @param pattern regular expression to match streams
   * @returns promise to server's response
   */
  match(pattern: string): Promise<DataLinkResponse> {
    let command = `MATCH`;
    return this.awaitDLCommand(command, pattern).then(this.ensureDataLinkResponse);
  }

  /**
   * Send reject command.
   *
   * @param pattern regular expression to reject streams
   * @returns promise to server's response
   */
  reject(pattern: string): Promise<DataLinkResponse> {
    let command = `REJECT ${pattern}`;
    return this.awaitDLCommand(command).then(this.ensureDataLinkResponse);
  }

  /**
   * Read a single packet for the given id.
   *
   * @param packetId id of the packet of interest
   * @returns promise to server's response
   */
  read(packetId: string): Promise<DataLinkPacket> {
    let command = `READ ${packetId}`;
    return this.awaitDLBinary(command).then(this.ensureDataLinkPacket);
  }

  /**
   * Handles a web socket message from the data link connection.
   *
   * @private
   * @param wsEvent web socket event to handle
   */
  handle(wsEvent: MessageEvent ): void {
    const rawData: ArrayBuffer = ((wsEvent.data: any): ArrayBuffer);
    let dlPreHeader = new DataView(rawData, 0, 3);
    if ('D' === String.fromCharCode(dlPreHeader.getUint8(0))
        && 'L' === String.fromCharCode(dlPreHeader.getUint8(1))) {
      const headerLen = dlPreHeader.getUint8(2);
      const header = dataViewToString(new DataView(rawData, 3, headerLen));
      if (header.startsWith(PACKET)) {
        let packet = new DataLinkPacket(header,
                new DataView(rawData, 3+headerLen));
        if (this.packetHandler) {
          try {
            this.packetHandler(packet);
          } catch (e) {
            this.errorHandler(e);
          }
        } else {
          this.errorHandler(new Error("packetHandler not defined"));
        }
      } else {
        let dv;
        if (rawData.byteLength > 3+headerLen) {
          dv = new DataView(rawData, 3+headerLen);
        }
        const dlResponse = DataLinkResponse.parse(header, dv);
        if (dlResponse.type === 'ERROR') {
          this.handleError(new Error(`value=${dlResponse.value} ${dlResponse.message}`));
        } else {
          if (this._responseResolve) {
            this._responseResolve(dlResponse);
          } else {
            defaultHandleResponse(header);
          }
        }
      }
    } else {
      throw new Error("DataLink Packet did not start with DL");
    }
  }

  /**
   * handle errors that arise
   *
   * @private
   * @param   error the error
   */
  handleError(error: Error): void {
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

/**
 * Datalink response, used for ID, INFO, OK and ERROR responses.
 */
export class DataLinkResponse {
  type: string;
  value: string;
  message: string;
  constructor(type: string, value: string, message: string) {
    this.type = type;
    this.value = value;
    this.message = message;
  }
  toString(): string {
    return `${this.type} ${this.value} | ${this.message}`;
  }
  static parse(header: string, data?: DataView): DataLinkResponse {
    let value = "";
    let s = header.split(' ');
    let type = s[0];
    let message = '';
    if (type === 'ID') {
      message = ''+header.substring(3);
    } else if (type === 'INFO' || type === 'OK' || type === 'ERROR') {
      value = s[1];
      if (data) {
        message = dataViewToString(new DataView(data.buffer, 3+header.length));
      }
    } else {
      util.log(`unknown DataLink response type: ${type}  ${header}`);
      message = header.substring(type.length+1);
    }
    return new DataLinkResponse(type, value, message);
  }
}

/**
 * Represents a Datalink packet from the ringserver.
 * Note this cannot connect directly to a native TCP socket, instead it
 * sends the datalink protocol over a websocket. Currently only the IRIS
 * ringserver supports websockets, but it may be possible to use thrid party
 * tools to proxy the websocket to a TCP datalink socket.
 *
 */
export class DataLinkPacket {
  header: string;
  data: DataView;
  streamId: string;
  pktid: string;
  hppackettime: string;
  hppacketstart: string;
  hppacketend: string;
  dataSize: number;
  _miniseed: null | miniseed.DataRecord;
  constructor(header: string, dataview: DataView) {
    this._miniseed = null;
    this.header = header;
    this.data = dataview;
    let split = this.header.split(' ');
    this.streamId = split[1];
    this.pktid = split[2];
    this.hppackettime = split[3];
    this.hppacketstart = split[4];
    this.hppacketend = split[5];
    this.dataSize = Number.parseInt(split[6]);
    if (dataview.byteLength < this.dataSize) {
      throw new Error("not enough bytes in dataview for packet: "+this.dataSize);
    }
  }
  /**
   * Packet start time as a moment.
   *
   * @returns start time
   */
  get packetStart(): moment {
    return hpTimeToMoment(parseInt(this.hppacketstart));
  }
  /**
   * Packet end time as a moment.
   *
   * @returns end time
   */
  get packetEnd(): moment {
    return hpTimeToMoment(parseInt(this.hppacketend));
  }
  /**
   * Packet time as a moment.
   *
   * @returns packet time
   */
  get packetTime(): moment {
    return hpTimeToMoment(parseInt(this.hppackettime));
  }
  /**
   * is this packet a miniseed packet
   *
   * @returns          true if it is miniseed
   */
  isMiniseed(): boolean {
    return isDef(this._miniseed) || this.streamId.endsWith(MSEED_TYPE);
  }
  /**
   * Parsed payload as a miniseed data record, if the streamid
   * ends with '/MSEED', null otherwise.
   *
   * @returns miniseed DataRecord or null
   */
  get miniseed() {
    if ( ! isDef(this._miniseed) ) {
      if (this.streamId.endsWith(MSEED_TYPE)) {
        this._miniseed = miniseed.parseSingleDataRecord(this.data);
      } else {
        this._miniseed = null;
      }
    }
    return this._miniseed;
  }
}

/**
 * Convert moment to a HPTime number.
 *
 * @param   m moment to convert
 * @returns  microseconds since epoch
 */
  export function momentToHPTime(m: moment): number {
    return m.valueOf()*1000;
  }
  /**
   * Convert hptime number to a moment.
   *
   * @param   hptime hptime to convert
   * @returns  moment in utc for the hptime
   */
  export function hpTimeToMoment(hptime: number): moment {
    return moment.utc(hptime/1000);
  }

  /**
   * Encode string into a Uint8Array.
   *
   * @param   dataString String to encode.
   * @returns             String as bytes in Uint8Array.
   */
  export function stringToUint8Array(dataString?: string): Uint8Array | void {
    let binaryData = undefined;
    if (isNonEmptyStringArg(dataString)) {
      binaryData = new Uint8Array(dataString.length);
      for (let i=0; i<dataString.length;i++) {
        binaryData[i] = dataString.charCodeAt(i);
      }
    }
    return binaryData;
  }
