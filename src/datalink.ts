/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * https://www.seis.sc.edu
 */
import * as util from "./util"; // for util.log

import {
  isoToDateTime,
  dataViewToString,
  stringify,
  isDef,
  isNonEmptyStringArg,
  toError,
  UTC_OPTIONS,
} from "./util";
import * as miniseed from "./miniseed";
import * as mseed3 from "./mseed3";
import { parseUtil } from "./stationxml";
import { DateTime } from "luxon";

/** const for datalink protocol for web sockets, DataLink1.0 */
export const DATALINK_PROTOCOL = "DataLink1.0";

/** enum for modes, either QUERY or STREAM */
export enum MODE {
  Query = "QUERY",
  Stream = "STREAM",
}
/** const for query mode, QUERY */
export const QUERY_MODE = MODE.Query;

/** const for streaming mode, STREAM */
export const STREAM_MODE = MODE.Stream;

/** const for maximum process number to create fake number for datalink id, 2^16-2 */
export const MAX_PROC_NUM = Math.pow(2, 16) - 2;

/** const for fake user name for datalink id, browser */
export const USER_BROWSER = "browser";

/** const for fake program name for datalink id, seisplotjs */
export const DEFAULT_PROGRAM = "seisplotjs";

/** const for fake architecture for datalink id, javascript */
export const DEFAULT_ARCH = "javascript";

/** const for error response, ERROR */
export const ERROR = "ERROR";
/** const for ok response, OK */
export const OK = "OK";
/** const for info response, INFO */
export const INFO = "INFO";
/** const for id response, ID */
export const ID = "ID";

export const PACKET = "PACKET";
export const STREAM = "STREAM";
export const ENDSTREAM = "ENDSTREAM";
export const MSEED_TYPE = "/MSEED";
export const MSEED3_TYPE = "/MSEED3";
export const IRIS_RINGSERVER_URL = "ws://rtserve.iris.washington.edu/datalink";

const defaultHandleResponse = function (dlResponse: DataLinkResponse) {
  util.log(`Unhandled datalink response: ${dlResponse.toString()}`);
};

/**
 * A websocket based Datalink connection.
 *
 * Note this cannot connect directly to a native TCP socket, instead it
 * sends the datalink protocol over a websocket.
 *
 * Currently only the IRIS
 * ringserver, https://github.com/iris-edu/ringserver,
 * supports websockets, but it may be possible to use thrid party
 * tools to proxy the websocket to a TCP datalink socket.
 *
 * The datalink protocol is documented here
 *  https://earthscope.github.io/libdali/datalink-protocol.html
 *
 * @param url websocket url to the ringserver
 * @param packetHandler callback for packets as they arrive
 * @param errorHandler callback for errors
 */
export class DataLinkConnection {
  url: string;

  /** @private */
  _mode: MODE;
  packetHandler: (packet: DataLinkPacket) => void;
  errorHandler: (error: Error) => void;
  closeHandler: null | ((close: CloseEvent) => void);
  serverId: string | null;
  clientIdNum: number;
  programname: string;
  username: string;
  architecture: string;
  /** @private */
  _responseResolve: null | ((response: DataLinkResponse) => void);
  /** @private */
  _responseReject: null | ((error: Error) => void);
  webSocket: WebSocket | null;

  constructor(
    url: string,
    packetHandler: (packet: DataLinkPacket) => void,
    errorHandler: (error: Error) => void,
  ) {
    this.webSocket = null;
    this.url = url ? url : IRIS_RINGSERVER_URL;
    this._mode = MODE.Query;
    this.packetHandler = packetHandler;
    this.errorHandler = errorHandler;
    this.closeHandler = null;
    this.serverId = null;
    // meant to be processId, so use 1 <= num <= 2^15 to be safe
    this.clientIdNum = Math.floor(Math.random() * MAX_PROC_NUM) + 1;
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
  connect(): Promise<string> {
    if (this.webSocket) {
      this.webSocket.close();
      this.webSocket = null;
    }
    return new Promise((resolve, reject) => {
      if (this.webSocket) {
        this.webSocket.close();
      }
      const webSocket = new WebSocket(this.url, DATALINK_PROTOCOL);
      this.webSocket = webSocket;
      webSocket.binaryType = "arraybuffer";

      webSocket.onmessage = (event) => {
        this.handle(event);
      };

      webSocket.onerror = (event) => {
        this.handleError(new Error("" + stringify(event)));
        reject(event);
      };

      webSocket.onclose = (closeEvent) => {
        this.webSocket = null; // clean up

        this._mode = MODE.Query;

        if (this.closeHandler) {
          this.closeHandler(closeEvent);
        }
      };

      webSocket.onopen = () => {
        resolve(this);
      };
    })
      .then((datalink: unknown) => {
        return (datalink as DataLinkConnection).sendId();
      })
      .then((idmsg: string) => {
        this.serverId = idmsg;
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
   */
  get mode(): string {
    return this._mode;
  }

  /**
   * Switches to streaming mode to receive data packets from the ringserver.
   *
   * @returns promise to the response
   */
  stream(): Promise<DataLinkResponse> {
    this._mode = MODE.Stream;
    return this.awaitDLCommand(STREAM, "").then((dlResponse) =>
      DataLinkConnection.ensureDataLinkResponse(dlResponse),
    );
  }

  /**
   * Switches back to query mode to enable commands to be sent to the ringserver.
   */
  endStream(): void {
    if (
      this.webSocket === null ||
      this._mode === null ||
      this._mode === MODE.Query
    ) {
      return;
    }

    this._mode = MODE.Query;
    this.sendDLCommand(ENDSTREAM, "");
  }

  /**
   * Closes the connection and the underlying websocket. No communication
   * is possible until connect() is called again.
   */
  close(): void {
    if (this.webSocket) {
      this.endStream(); // end streaming just in case

      if (this.webSocket) {
        this.webSocket.close();
      }

      this.webSocket = null;
      this._mode = MODE.Query;
    }
  }

  /**
   * Send a ID Command. Command is a string.
   *
   * @returns a Promise that resolves to the response from the ringserver.
   */
  sendId(): Promise<string> {
    return this.id(
      this.programname,
      this.username,
      stringify(this.clientIdNum),
      this.architecture,
    )
      .then((dlResponse) =>
        DataLinkConnection.ensureDataLinkResponse(dlResponse),
      )
      .then((dlResponse) => {
        if (dlResponse.type === "ID") {
          this.serverId = "" + dlResponse.message;
          return this.serverId;
        } else {
          throw new Error("not ID response: " + stringify(dlResponse.type));
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
    let len = 3 + header.length;
    let lenStr = "";

    if (data && data.length > 0) {
      lenStr = String(data.length);
      len += lenStr.length + 1;
      cmdLen += lenStr.length + 1;
      len += data.length;
    }

    const rawPacket = new ArrayBuffer(len);
    const binaryPacket = new Uint8Array(rawPacket);
    const packet = new DataView(rawPacket);
    packet.setUint8(0, 68); // ascii D

    packet.setUint8(1, 76); // ascii L

    packet.setUint8(2, cmdLen);
    let i = 3;

    for (const c of header) {
      packet.setUint8(i, c.charCodeAt(0));
      i++;
    }

    const SPACE = " ";

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

  /**
   * sends the header with optional binary data
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

  /**
   * sends the command as header with optional dataString
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
  awaitDLBinary(
    header: string,
    data?: Uint8Array,
  ): Promise<DataLinkResponse | DataLinkPacket> {
    const promise = new Promise(
      (resolve: (a: DataLinkResponse | DataLinkPacket) => void, reject) => {
        this._responseResolve = resolve;
        this._responseReject = reject;
        this.sendDLBinary(header, data);
      },
    )
      .then((response) => {
        this._responseResolve = null;
        this._responseReject = null;
        return response;
      })
      .catch((error) => {
        this._responseResolve = null;
        this._responseReject = null;
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
  awaitDLCommand(
    command: string,
    dataString?: string,
  ): Promise<DataLinkResponse | DataLinkPacket> {
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
  writeAck(
    streamid: string,
    hpdatastart: DateTime,
    hpdataend: DateTime,
    data?: Uint8Array,
  ): Promise<DataLinkResponse | DataLinkPacket> {
    const header = `WRITE ${streamid} ${dateTimeToHPTime(
      hpdatastart,
    )} ${dateTimeToHPTime(hpdataend)} A`;
    return this.awaitDLBinary(header, data);
  }

  /**
   * Makes sure a response actually is a DataLinkResponse
   *
   * @param   dl datalink packet/response
   * @returns DataLinkResponse after checking instanceof
   * @throws Error if not a DataLinkResponse
   */
  static ensureDataLinkResponse(
    dl: DataLinkResponse | DataLinkPacket,
  ): DataLinkResponse {
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
  static ensureDataLinkPacket(
    dl: DataLinkResponse | DataLinkPacket,
  ): DataLinkPacket {
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
  id(
    programname: string,
    username: string,
    processid: string,
    architecture: string,
  ): Promise<DataLinkResponse> {
    const command = `ID ${programname}:${username}:${processid}:${architecture}`;
    return this.awaitDLCommand(command).then((dlResponse) =>
      DataLinkConnection.ensureDataLinkResponse(dlResponse),
    );
  }

  /**
   * Send info command for infoType.
   *
   * @param infoType type to get info for
   * @returns promise to server's response
   */
  info(infoType: string): Promise<DataLinkResponse> {
    const command = `INFO ${infoType}`;
    return this.awaitDLCommand(command).then((dlResponse) =>
      DataLinkConnection.ensureDataLinkResponse(dlResponse),
    );
  }

  infoStatus(): Promise<StatusResponse> {
    return this.info("STATUS").then((daResp: DataLinkResponse) => {
      //parse xml and return as a useful object
      return StatusResponse.fromDatalinkResponse(daResp);
    });
  }

  infoStreams(): Promise<StreamsResponse> {
    return this.info("STREAMS").then((daResp: DataLinkResponse) => {
      //parse xml and return as a useful object
      return StreamsResponse.fromDatalinkResponse(daResp);
    });
  }

  infoConnections(): Promise<ConnectionsResponse> {
    return this.info("CONNECTIONS").then((daResp: DataLinkResponse) => {
      //parse xml and return as a useful object
      return ConnectionsResponse.fromDatalinkResponse(daResp);
    });
  }

  /**
   * Send position after command.
   *
   * @param time time to position after
   * @returns promise to server's response
   */
  positionAfter(time: DateTime): Promise<DataLinkResponse> {
    return this.positionAfterHPTime(dateTimeToHPTime(time)).then((dlResponse) =>
      DataLinkConnection.ensureDataLinkResponse(dlResponse),
    );
  }

  /**
   * Send position after command.
   *
   * @param hpTime time to position after
   * @returns promise to server's response
   */
  positionAfterHPTime(hpTime: number): Promise<DataLinkResponse> {
    const command = `POSITION AFTER ${hpTime}`;
    return this.awaitDLCommand(command).then((dlResponse) =>
      DataLinkConnection.ensureDataLinkResponse(dlResponse),
    );
  }

  /**
   * Send match command.
   *
   * @param pattern regular expression to match streams
   * @returns promise to server's response
   */
  match(pattern: string): Promise<DataLinkResponse> {
    const command = `MATCH`;
    return this.awaitDLCommand(command, pattern).then((dlResponse) =>
      DataLinkConnection.ensureDataLinkResponse(dlResponse),
    );
  }

  /**
   * Send reject command.
   *
   * @param pattern regular expression to reject streams
   * @returns promise to server's response
   */
  reject(pattern: string): Promise<DataLinkResponse> {
    const command = `REJECT ${pattern}`;
    return this.awaitDLCommand(command).then((dlResponse) =>
      DataLinkConnection.ensureDataLinkResponse(dlResponse),
    );
  }

  /**
   * Read a single packet for the given id.
   *
   * @param packetId id of the packet of interest
   * @returns promise to server's response
   */
  read(packetId: string): Promise<DataLinkPacket> {
    const command = `READ ${packetId}`;
    return this.awaitDLBinary(command).then((dlResponse) =>
      DataLinkConnection.ensureDataLinkPacket(dlResponse),
    );
  }

  /**
   * Handles a web socket message from the data link connection.
   *
   * @private
   * @param wsEvent web socket event to handle
   */
  handle(wsEvent: MessageEvent): void {
    const rawData: unknown = wsEvent.data;
    if (rawData instanceof ArrayBuffer) {
      this.handleArrayBuffer(rawData);
    }
  }

  handleArrayBuffer(rawData: ArrayBuffer): void {
    const dlPreHeader = new DataView(rawData, 0, 3);

    if (
      "D" === String.fromCharCode(dlPreHeader.getUint8(0)) &&
      "L" === String.fromCharCode(dlPreHeader.getUint8(1))
    ) {
      const headerLen = dlPreHeader.getUint8(2);
      const header = dataViewToString(new DataView(rawData, 3, headerLen));

      if (header.startsWith(PACKET)) {
        const packet = new DataLinkPacket(
          header,
          new DataView(rawData, 3 + headerLen),
        );

        if (this.packetHandler) {
          try {
            this.packetHandler(packet);
          } catch (e) {
            this.handleError(toError(e));
          }
        } else {
          this.handleError(new Error("packetHandler not defined"));
        }
      } else {
        let dv;

        if (rawData.byteLength > 3 + headerLen) {
          dv = new DataView(rawData, 3 + headerLen);
        }

        const dlResponse = DataLinkResponse.parse(header, dv);

        if (dlResponse.type === "ENDSTREAM") {
          this._mode = MODE.Query;
        } else {
          if (this._responseResolve) {
            this._responseResolve(dlResponse);
          } else {
            defaultHandleResponse(dlResponse);
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
      util.log("datalink handleError: " + error.message);
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
  isError(): boolean {
    return this.type === ERROR;
  }
  toString(): string {
    return `${this.type} ${this.value} | ${this.message}`;
  }

  static parse(header: string, data?: DataView): DataLinkResponse {
    let value = "";
    const s = header.split(" ");
    const type = s[0];
    let message = "";

    if (type === ID) {
      message = "" + header.substring(3);
    } else if (
      type === ENDSTREAM ||
      type === INFO ||
      type === OK ||
      type === ERROR
    ) {
      value = s[1];

      if (data) {
        message = dataViewToString(
          new DataView(data.buffer, 3 + header.length),
        );
      }
    } else {
      util.log(`unknown DataLink response type: ${type}  ${header}`);
      message = header.substring(type.length + 1);
    }

    return new DataLinkResponse(type, value, message);
  }
}

/**
 * Represents a Datalink packet from the ringserver.
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
  _mseed3: null | mseed3.MSeed3Record;

  constructor(header: string, dataview: DataView) {
    this._miniseed = null;
    this._mseed3 = null;
    this.header = header;
    this.data = dataview;
    const split = this.header.split(" ");
    this.streamId = split[1];
    this.pktid = split[2];
    this.hppackettime = split[3];
    this.hppacketstart = split[4];
    this.hppacketend = split[5];
    this.dataSize = Number.parseInt(split[6]);

    if (dataview.byteLength < this.dataSize) {
      throw new Error(
        `not enough bytes in dataview for packet:  ${this.dataSize}`,
      );
    }
  }

  /**
   * Packet start time as a DateTime.
   *
   * @returns start time
   */
  get packetStart(): DateTime {
    return hpTimeToDateTime(parseInt(this.hppacketstart));
  }

  /**
   * Packet end time as a DateTime.
   *
   * @returns end time
   */
  get packetEnd(): DateTime {
    return hpTimeToDateTime(parseInt(this.hppacketend));
  }

  /**
   * Packet time as a DateTime.
   *
   * @returns packet time
   */
  get packetTime(): DateTime {
    return hpTimeToDateTime(parseInt(this.hppackettime));
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
  asMiniseed(): miniseed.DataRecord | null {
    if (!isDef(this._miniseed)) {
      if (this.streamId.endsWith(MSEED_TYPE)) {
        this._miniseed = miniseed.parseSingleDataRecord(this.data);
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
    return isDef(this._mseed3) || this.streamId.endsWith(MSEED3_TYPE);
  }

  /**
   * Parsed payload as a miniseed3 data record, if the data format is 3, null otherwise.
   *
   * @returns miniseed3 DataRecord or null
   */
  asMiniseed3(): mseed3.MSeed3Record | null {
    if (!isDef(this._mseed3)) {
      if (this.streamId.endsWith(MSEED3_TYPE)) {
        this._mseed3 = mseed3.MSeed3Record.parseSingleDataRecord(this.data);
      } else if (this.streamId.endsWith(MSEED_TYPE)) {
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

/*
  Holds top level items from INFO requests
*/
export class DataLinkIdStats {
  version: string;
  serverId: string;
  capabilities: Array<string>;
  constructor(version: string, serverId: string, capabilities: Array<string>) {
    this.version = version;
    this.serverId = serverId;
    this.capabilities = capabilities;
  }
  /**
   * Parses the attributes of a <DataLink> xml element.
   *
   * @param  statusEl               DataLink XML element
   * @returns  the id stats
   */
  static parseXMLAttributes(statusEl: Element): DataLinkIdStats {
    const dlIdStats = new DataLinkIdStats(
      parseUtil._requireAttribute(statusEl, "Version"),
      parseUtil._requireAttribute(statusEl, "ServerID"),
      parseUtil._requireAttribute(statusEl, "Capabilities").split(" "),
    );
    return dlIdStats;
  }
  toString(): string {
    return `
DataLink:
Version="${this.version}"
Id="${this.serverId}"
Capabilities="${this.capabilities.join(" ")}"`;
  }
}
/*
<DataLink
  Version="2018.078"
  ServerID="South Carolina Seismic Network"
  Capabilities="DLPROTO:1.0 PACKETSIZE:512 WRITE">
  <Status
    StartTime="2022-09-21 12:13:29"
    RingVersion="1"
    RingSize="1073741824"
    PacketSize="512"
    MaximumPacketID="16777215"
    MaximumPackets="1698952"
    MemoryMappedRing="TRUE"
    VolatileRing="FALSE"
    TotalConnections="8"
    TotalStreams="90"
    TXPacketRate="43.0"
    TXByteRate="22002.8"
    RXPacketRate="15.0"
    RXByteRate="7675.4"
    EarliestPacketID="11772758"
    EarliestPacketCreationTime="2022-10-03 13:05:01.602383"
    EarliestPacketDataStartTime="2022-10-03 13:04:56.400000"
    EarliestPacketDataEndTime="2022-10-03 13:04:59.325000"
    LatestPacketID="13471709"
    LatestPacketCreationTime="2022-10-04 15:19:37.382032"
    LatestPacketDataStartTime="2022-10-04 15:19:33.535000"
    LatestPacketDataEndTime="2022-10-04 15:19:36.690000" />
    <ServerThreads TotalServerThreads="3">
      <Thread Flags=" ACTIVE" Type="DataLink SeedLink HTTP" Port="6382" />
      <Thread Flags=" ACTIVE" Type="DataLink" Port="15001" />
      <Thread Flags=" ACTIVE" Type="SeedLink" Port="7381" />
    </ServerThreads>
  </DataLink>
 */
export class DataLinkStats {
  startTime: DateTime;
  ringVersion: string;
  ringSize: number;
  packetSize: number;
  maximumPacketID: number;
  maximumPackets: number;
  memoryMappedRing: boolean;
  volatileRing: boolean;
  totalConnections: number;
  totalStreams: number;
  txPacketRate: number;
  txByteRate: number;
  rxPacketRate: number;
  rxByteRate: number;
  earliestPacketID: number;
  earliestPacketCreationTime: DateTime;
  earliestPacketDataStartTime: DateTime;
  earliestPacketDataEndTime: DateTime;
  latestPacketID: number;
  latestPacketCreationTime: DateTime;
  latestPacketDataStartTime: DateTime;
  latestPacketDataEndTime: DateTime;

  constructor(
    startTime: DateTime,
    ringVersion: string,
    ringSize: number,
    packetSize: number,
    maximumPacketID: number,
    maximumPackets: number,
    memoryMappedRing: boolean,
    volatileRing: boolean,
    totalConnections: number,
    totalStreams: number,
    txPacketRate: number,
    txByteRate: number,
    rxPacketRate: number,
    rxByteRate: number,
    earliestPacketID: number,
    earliestPacketCreationTime: DateTime,
    earliestPacketDataStartTime: DateTime,
    earliestPacketDataEndTime: DateTime,
    latestPacketID: number,
    latestPacketCreationTime: DateTime,
    latestPacketDataStartTime: DateTime,
    latestPacketDataEndTime: DateTime,
  ) {
    this.startTime = startTime;
    this.ringVersion = ringVersion;
    this.ringSize = ringSize;
    this.packetSize = packetSize;
    this.maximumPacketID = maximumPacketID;
    this.maximumPackets = maximumPackets;
    this.memoryMappedRing = memoryMappedRing;
    this.volatileRing = volatileRing;
    this.totalConnections = totalConnections;
    this.totalStreams = totalStreams;
    this.txPacketRate = txPacketRate;
    this.txByteRate = txByteRate;
    this.rxPacketRate = rxPacketRate;
    this.rxByteRate = rxByteRate;
    this.earliestPacketID = earliestPacketID;
    this.earliestPacketCreationTime = earliestPacketCreationTime;
    this.earliestPacketDataStartTime = earliestPacketDataStartTime;
    this.earliestPacketDataEndTime = earliestPacketDataEndTime;
    this.latestPacketID = latestPacketID;
    this.latestPacketCreationTime = latestPacketCreationTime;
    this.latestPacketDataStartTime = latestPacketDataStartTime;
    this.latestPacketDataEndTime = latestPacketDataEndTime;
  }
  /**
   * Parses the attributes of a <Status> xml element.
   *
   * @param  statusEl   DataLink <Status> XML element
   * @returns  the stats
   */
  static parseXMLAttributes(statusEl: Element): DataLinkStats {
    const dlStats = new DataLinkStats(
      daliDateTime(parseUtil._requireAttribute(statusEl, "StartTime")),
      parseUtil._requireAttribute(statusEl, "RingVersion"),
      parseInt(parseUtil._requireAttribute(statusEl, "RingSize")),
      parseInt(parseUtil._requireAttribute(statusEl, "PacketSize")),
      parseInt(parseUtil._requireAttribute(statusEl, "MaximumPacketID")),
      parseInt(parseUtil._requireAttribute(statusEl, "MaximumPackets")),
      parseUtil._requireAttribute(statusEl, "MemoryMappedRing") === "TRUE",
      parseUtil._requireAttribute(statusEl, "VolatileRing") === "TRUE",
      parseInt(parseUtil._requireAttribute(statusEl, "TotalConnections")),
      parseInt(parseUtil._requireAttribute(statusEl, "TotalStreams")),
      parseFloat(parseUtil._requireAttribute(statusEl, "TXPacketRate")),
      parseFloat(parseUtil._requireAttribute(statusEl, "TXByteRate")),
      parseFloat(parseUtil._requireAttribute(statusEl, "RXPacketRate")),
      parseFloat(parseUtil._requireAttribute(statusEl, "RXByteRate")),
      parseInt(parseUtil._requireAttribute(statusEl, "EarliestPacketID")),
      daliDateTime(
        parseUtil._requireAttribute(statusEl, "EarliestPacketCreationTime"),
      ),
      daliDateTime(
        parseUtil._requireAttribute(statusEl, "EarliestPacketDataStartTime"),
      ),
      daliDateTime(
        parseUtil._requireAttribute(statusEl, "EarliestPacketDataEndTime"),
      ),
      parseInt(parseUtil._requireAttribute(statusEl, "LatestPacketID")),
      daliDateTime(
        parseUtil._requireAttribute(statusEl, "LatestPacketCreationTime"),
      ),
      daliDateTime(
        parseUtil._requireAttribute(statusEl, "LatestPacketDataStartTime"),
      ),
      daliDateTime(
        parseUtil._requireAttribute(statusEl, "LatestPacketDataEndTime"),
      ),
    );

    //    dlStats.startTime = statusEl.getAttribute("StartTime");
    return dlStats;
  }
  toString(): string {
    return `
Status:
StartTime="${this.startTime.toISO()}"
RingVersion="${this.ringVersion}"
RingSize="${this.ringSize}"
PacketSize="${this.packetSize}"
MaximumPacketID="${this.maximumPacketID}"
MaximumPackets="${this.maximumPackets}"
MemoryMappedRing="${this.memoryMappedRing}"
VolatileRing="${this.volatileRing}"
TotalConnections="${this.totalConnections}"
TotalStreams="${this.totalStreams}"
TXPacketRate="${this.txPacketRate}"
TXByteRate="${this.txByteRate}"
RXPacketRate="${this.rxPacketRate}"
RXByteRate="${this.rxByteRate}"
EarliestPacketID="${this.earliestPacketID}"
EarliestPacketCreationTime="${this.earliestPacketCreationTime.toISO()}"
EarliestPacketDataStartTime="${this.earliestPacketDataStartTime.toISO()}"
EarliestPacketDataEndTime="${this.earliestPacketDataEndTime.toISO()}"
LatestPacketID="${this.latestPacketID}"
LatestPacketCreationTime="${this.latestPacketCreationTime.toISO()}"
LatestPacketDataStartTime="${this.latestPacketDataStartTime.toISO()}"
LatestPacketDataEndTime="${this.latestPacketDataEndTime.toISO()}"
    `;
  }
}
/*
<Thread Flags=" ACTIVE" Type="DataLink SeedLink HTTP" Port="6382" />
<Thread Flags=" ACTIVE" Type="DataLink" Port="15001" />
<Thread Flags=" ACTIVE" Type="SeedLink" Port="7381" />

 */
export class ThreadStat {
  flags: Array<string>;
  type: Array<string>;
  port: number;
  constructor(flags: Array<string>, type: Array<string>, port: number) {
    this.flags = flags;
    this.type = type;
    this.port = port;
  }
  /**
   * Parses the attributes of a <Status> xml element.
   *
   * @param  statusEl   DataLink <Status> XML element
   * @returns  the stats
   */
  static parseXMLAttributes(statusEl: Element): ThreadStat {
    const threadStats = new ThreadStat(
      parseUtil._requireAttribute(statusEl, "Flags").split(" "),
      parseUtil._requireAttribute(statusEl, "Type").split(" "),
      parseInt(parseUtil._requireAttribute(statusEl, "Port")),
    );
    return threadStats;
  }
  toString(): string {
    return `Thread  Port: ${this.port} Flags: ${this.flags.join(" ")} Type: ${this.type.join(" ")}`;
  }
}

export class StatusResponse {
  idStats: DataLinkIdStats;
  datalinkStats: DataLinkStats;
  threadStats: Array<ThreadStat>;
  rawXml = "";
  constructor(
    idStats: DataLinkIdStats,
    datalinkStats: DataLinkStats,
    threadStats: Array<ThreadStat>,
  ) {
    this.idStats = idStats;
    this.datalinkStats = datalinkStats;
    this.threadStats = threadStats;
  }
  static fromDatalinkResponse(daliResp: DataLinkResponse): StatusResponse {
    if (daliResp.type === INFO) {
      const daliXml = new DOMParser().parseFromString(
        daliResp.message,
        "text/xml",
      );
      const sResp = StatusResponse.fromXML(daliXml.documentElement);
      sResp.rawXml = daliResp.message;
      return sResp;
    } else {
      throw new Error("Datalink Response not OK", { cause: daliResp });
    }
  }
  static fromXML(daliXML: Element): StatusResponse {
    const idStats = DataLinkIdStats.parseXMLAttributes(daliXML);
    const dlStats = DataLinkStats.parseXMLAttributes(
      daliXML.getElementsByTagName("Status")[0],
    );
    const threadListEl = daliXML.getElementsByTagName("ServerThreads")[0];
    let threads: Array<ThreadStat> = [];
    if (threadListEl) {
      threads = Array.from(threadListEl.getElementsByTagName("Thread")).map(
        (threadEl) => ThreadStat.parseXMLAttributes(threadEl),
      );
    }
    return new StatusResponse(idStats, dlStats, threads);
  }
  toString(): string {
    return `
${this.idStats.toString()}
${this.datalinkStats.toString()}
${this.threadStats.join("\n")}`;
  }
}

/*
<Stream
  Name="CO_JSC_00_HHE/MSEED"
  EarliestPacketID="11763363"
  EarliestPacketDataStartTime="2022-10-03 12:56:37.178392"
  EarliestPacketDataEndTime="2022-10-03 12:56:40.808392"
  LatestPacketID="13462285"
  LatestPacketDataStartTime="2022-10-04 15:11:15.808392"
  LatestPacketDataEndTime="2022-10-04 15:11:18.788392"
  DataLatency="6.0" />
 */
export class StreamStat {
  name: string;
  earliestPacketID: number;
  earliestPacketDataStartTime: DateTime;
  earliestPacketDataEndTime: DateTime;
  latestPacketID: number;
  latestPacketDataStartTime: DateTime;
  latestPacketDataEndTime: DateTime;
  dataLatency: number;
  constructor(
    name: string,
    earliestPacketID: number,
    earliestPacketDataStartTime: DateTime,
    earliestPacketDataEndTime: DateTime,
    latestPacketID: number,
    latestPacketDataStartTime: DateTime,
    latestPacketDataEndTime: DateTime,
    dataLatency: number,
  ) {
    this.name = name;
    this.earliestPacketID = earliestPacketID;
    this.earliestPacketDataStartTime = earliestPacketDataStartTime;
    this.earliestPacketDataEndTime = earliestPacketDataEndTime;
    this.latestPacketID = latestPacketID;
    this.latestPacketDataStartTime = latestPacketDataStartTime;
    this.latestPacketDataEndTime = latestPacketDataEndTime;
    this.dataLatency = dataLatency;
  }
  static parseXMLAttributes(statusEl: Element): StreamStat {
    const sStat = new StreamStat(
      parseUtil._requireAttribute(statusEl, "Name"),
      parseInt(parseUtil._requireAttribute(statusEl, "EarliestPacketID")),
      daliDateTime(
        parseUtil._requireAttribute(statusEl, "EarliestPacketDataStartTime"),
      ),
      daliDateTime(
        parseUtil._requireAttribute(statusEl, "EarliestPacketDataEndTime"),
      ),
      parseInt(parseUtil._requireAttribute(statusEl, "LatestPacketID")),
      daliDateTime(
        parseUtil._requireAttribute(statusEl, "LatestPacketDataStartTime"),
      ),
      daliDateTime(
        parseUtil._requireAttribute(statusEl, "LatestPacketDataEndTime"),
      ),
      parseFloat(parseUtil._requireAttribute(statusEl, "DataLatency")),
    );
    return sStat;
  }
  toString(): string {
    return `
    Name: ${this.name}
    EarliestPacketID="${this.earliestPacketID}"
    EarliestPacketDataStartTime="${this.earliestPacketDataStartTime.toISO()}"
    EarliestPacketDataEndTime="${this.earliestPacketDataEndTime.toISO()}"
    LatestPacketID="${this.latestPacketID}"
    LatestPacketDataStartTime="${this.latestPacketDataStartTime.toISO()}"
    LatestPacketDataEndTime="${this.latestPacketDataEndTime.toISO()}"
    DataLatency=${this.dataLatency}
    `;
  }
}

export class StreamsResponse {
  datalinkStats: DataLinkStats;
  streams: Array<StreamStat>;
  constructor(datalinkStats: DataLinkStats, streams: Array<StreamStat>) {
    this.datalinkStats = datalinkStats;
    this.streams = streams;
  }
  static fromDatalinkResponse(daliResp: DataLinkResponse): StreamsResponse {
    if (daliResp.type === INFO) {
      const daliXml = new DOMParser().parseFromString(
        daliResp.message,
        "text/xml",
      );
      return StreamsResponse.fromXML(daliXml.documentElement);
    } else {
      throw new Error("Datalink Response not OK", { cause: daliResp });
    }
  }
  /*
<DataLink Version="2018.078"
ServerID="South Carolina Seismic Network"
Capabilities="DLPROTO:1.0 PACKETSIZE:512 WRITE">
<Status
  StartTime="2022-09-21 12:13:29"
  RingVersion="1"
  RingSize="1073741824"
  PacketSize="512"
  MaximumPacketID="16777215"
  MaximumPackets="1698952"
  MemoryMappedRing="TRUE"
  VolatileRing="FALSE"
  TotalConnections="9"
  TotalStreams="90"
  TXPacketRate="57.0"
  TXByteRate="29167.9"
  RXPacketRate="18.0"
  RXByteRate="9210.9"
  EarliestPacketID="11763348"
  EarliestPacketCreationTime="2022-10-03 12:56:43.520738"
  EarliestPacketDataStartTime="2022-10-03 12:56:40.860000"
  EarliestPacketDataEndTime="2022-10-03 12:56:42.875000"
  LatestPacketID="13462299"
  LatestPacketCreationTime="2022-10-04 15:11:24.786990"
  LatestPacketDataStartTime="2022-10-04 15:11:19.580000"
  LatestPacketDataEndTime="2022-10-04 15:11:22.785000" />
  <StreamList TotalStreams="90" SelectedStreams="3">
    <Stream Name="CO_JSC_00_HHE/MSEED" EarliestPacketID="11763363" EarliestPacketDataStartTime="2022-10-03 12:56:37.178392" EarliestPacketDataEndTime="2022-10-03 12:56:40.808392" LatestPacketID="13462285" LatestPacketDataStartTime="2022-10-04 15:11:15.808392" LatestPacketDataEndTime="2022-10-04 15:11:18.788392" DataLatency="6.0" />
    <Stream Name="CO_JSC_00_HHN/MSEED" EarliestPacketID="11763389" EarliestPacketDataStartTime="2022-10-03 12:56:38.108392" EarliestPacketDataEndTime="2022-10-03 12:56:41.398392" LatestPacketID="13462284" LatestPacketDataStartTime="2022-10-04 15:11:15.668392" LatestPacketDataEndTime="2022-10-04 15:11:18.408392" DataLatency="6.4" />
    <Stream Name="CO_JSC_00_HHZ/MSEED" EarliestPacketID="11763402" EarliestPacketDataStartTime="2022-10-03 12:56:38.908392" EarliestPacketDataEndTime="2022-10-03 12:56:42.688392" LatestPacketID="13462252" LatestPacketDataStartTime="2022-10-04 15:11:14.428392" LatestPacketDataEndTime="2022-10-04 15:11:17.858392" DataLatency="6.9" />
  </StreamList>
</DataLink>
   */
  static fromXML(daliXML: Element): StreamsResponse {
    const statusEl = daliXML.getElementsByTagName("Status")[0];
    const dlStats = DataLinkStats.parseXMLAttributes(statusEl);
    const streamListEl = daliXML.getElementsByTagName("StreamList")[0];
    const streamElList = streamListEl.getElementsByTagName("Stream");
    const streams = Array.from(streamElList).map((streamEl) =>
      StreamStat.parseXMLAttributes(streamEl),
    );
    const streamResp = new StreamsResponse(dlStats, streams);
    return streamResp;
  }
  toString(): string {
    return `${this.datalinkStats.toString()}
    ${this.streams.map((s) => s.toString()).join("\n")}
    `;
  }
}

/**
 * Non implementation, just stores xml as a string. Unlikely
 * to be useful remotely as ringserver doesn't allow.
 *
 * @param daliXML  raw xml form server
 */
export class ConnectionsResponse {
  daliXML: string;
  constructor(daliXML: string) {
    this.daliXML = daliXML;
  }
  static fromDatalinkResponse(daliResp: DataLinkResponse): ConnectionsResponse {
    if (daliResp.type === INFO) {
      // dumb implementation, just save as string
      return new ConnectionsResponse(daliResp.message);
    } else {
      throw new Error("Datalink Response not OK", { cause: daliResp });
    }
  }
  static fromXML(daliXML: Element): ConnectionsResponse {
    const xmlString = new XMLSerializer().serializeToString(daliXML);
    return new ConnectionsResponse(xmlString);
  }
  toString(): string {
    return `${this.daliXML.toString()}`;
  }
}

/**
 * Convert DataLink style dates, like "2022-10-04 15:11:24.786990"
 * to ISO form for DateTime
 *
 * @param  dalitime       datalink time
 * @returns   DateTime
 */
export function daliDateTime(dalitime: string): DateTime {
  const iso = dalitime.replace(" ", "T");
  return isoToDateTime(iso);
}

/**
 * Convert DateTime to a HPTime number.
 *
 * @param   m DateTime to convert
 * @returns  microseconds since epoch
 */
export function dateTimeToHPTime(m: DateTime): number {
  return m.valueOf() * 1000;
}

/**
 * Convert hptime number to a DateTime.
 *
 * @param   hptime hptime to convert
 * @returns  DateTime in utc for the hptime
 */
export function hpTimeToDateTime(hptime: number): DateTime {
  return DateTime.fromMillis(hptime / 1000, UTC_OPTIONS);
}

/**
 * Encode string into a Uint8Array.
 *
 * @param   dataString String to encode.
 * @returns             String as bytes in Uint8Array.
 */
export function stringToUint8Array(dataString?: string): Uint8Array {
  let binaryData;

  if (isNonEmptyStringArg(dataString)) {
    binaryData = new Uint8Array(dataString.length);

    for (let i = 0; i < dataString.length; i++) {
      binaryData[i] = dataString.charCodeAt(i);
    }
  } else {
    binaryData = new Uint8Array(0);
  }

  return binaryData;
}
