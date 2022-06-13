/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */

import {DateTime, Duration} from "luxon";
import {SeismogramSegment} from "./seismogramsegment";
import {Seismogram} from "./seismogram";
import {EncodedDataSegment} from "./seedcodec";
import {isDef, isNonEmptyStringArg, UTC_OPTIONS} from "./util";
export const MINISEED_MIME = "application/vnd.fdsn.mseed";
// type codes as number (ascii)
export const R_TYPECODE: number = "R".charCodeAt(0);
export const D_TYPECODE: number = "D".charCodeAt(0);
export const Q_TYPECODE: number = "Q".charCodeAt(0);
export const M_TYPECODE: number = "M".charCodeAt(0);

/**
 * parse arrayBuffer into an array of DataRecords.
 *
 * @param arrayBuffer bytes to parse
 * @returns arry of data records
 */
export function parseDataRecords(arrayBuffer: ArrayBuffer): Array<DataRecord> {
  const dataRecords = [];
  let offset = 0;

  while (offset < arrayBuffer.byteLength) {
    const dataView = new DataView(arrayBuffer, offset);
    const dr = parseSingleDataRecord(dataView);
    dataRecords.push(dr);
    offset += dr.header.recordSize;
  }

  return dataRecords;
}

/**
 * parse a single DataRecord starting at the beginning of the DataView.
 * Currently only some blockettes are parsed, 100, 1000, 1001, others are separated,
 * but left as just a DataView.
 *
 * @param dataView bytes as DataView
 * @returns data record
 */
export function parseSingleDataRecord(dataView: DataView): DataRecord {
  const header = parseSingleDataRecordHeader(dataView);
  const data = new DataView(
    dataView.buffer,
    dataView.byteOffset + header.dataOffset,
    header.recordSize - header.dataOffset,
  );
  return new DataRecord(header, data);
}

/**
 * parse the DataHeader from a single DataRecord starting at the beginning of the DataView.
 *
 * @param dataView bytes as DataView
 * @returns data record header
 */
export function parseSingleDataRecordHeader(dataView: DataView): DataHeader {
  if (dataView.byteLength < 47) {
    throw new Error(
      `Not enought bytes for header, need 47, found ${dataView.byteLength}`,
    );
  }

  const out = new DataHeader();
  out.seq = makeString(dataView, 0, 6);
  out.typeCode = dataView.getUint8(6);
  out.continuationCode = dataView.getUint8(7);
  out.staCode = makeString(dataView, 8, 5);
  out.locCode = makeString(dataView, 13, 2);
  out.chanCode = makeString(dataView, 15, 3);
  out.netCode = makeString(dataView, 18, 2);
  out.startBTime = parseBTime(dataView, 20);
  const headerByteSwap = checkByteSwap(out.startBTime);

  if (headerByteSwap) {
    out.startBTime = parseBTime(dataView, 20, headerByteSwap);
  }

  out.numSamples = dataView.getInt16(30, headerByteSwap);
  out.sampRateFac = dataView.getInt16(32, headerByteSwap);
  out.sampRateMul = dataView.getInt16(34, headerByteSwap);
  out.activityFlags = dataView.getUint8(36);
  out.ioClockFlags = dataView.getUint8(37);
  out.dataQualityFlags = dataView.getUint8(38);
  out.numBlockettes = dataView.getUint8(39);
  out.timeCorrection = dataView.getInt32(40, headerByteSwap);
  out.dataOffset = dataView.getUint16(44, headerByteSwap);
  out.blocketteOffset = dataView.getUint16(46, headerByteSwap);
  let offset = out.blocketteOffset;
  out.blocketteList = [];
  out.recordSize = 4096;
  out.sampleRate = out.calcSampleRate();
  out.startTime = out.startBTime.toDateTime();

  for (let i = 0; i < out.numBlockettes; i++) {
    let nextOffset = dataView.getUint16(offset + 2, headerByteSwap);

    if (nextOffset === 0) {
      // last blockette
      nextOffset = out.dataOffset;
    }

    if (nextOffset === 0) {
      nextOffset = offset; // zero length, probably an error...
    }

    const blockette = parseBlockette(
      dataView,
      offset,
      nextOffset - offset,
      headerByteSwap,
    );
    out.blocketteList.push(blockette);
    offset = nextOffset;

    if (blockette instanceof Blockette1000) {
      out.recordSize = 1 << blockette.dataRecordLengthByte;
      out.encoding = blockette.encoding;
      out.littleEndian = blockette.wordOrder === 0;
    } else if (blockette instanceof Blockette1001) {
      out.startBTime.microsecond = blockette.microsecond;
    } else if (blockette instanceof Blockette100) {
      out.sampleRate = blockette.sampleRate;
    }
  }

  out.endTime = out.timeOfSample(out.numSamples - 1);
  return out;
}

/**
 * parses a Blockette within the DataView.
 *
 * @param  dataView containing the data
 * @param  offset offset into the DataView to start
 * @param  length size in bytes of the Blockette
 * @param headerByteSwap true if byte swapping is needed
 * @returns Blockette instance
 */
export function parseBlockette(
  dataView: DataView,
  offset: number,
  length: number,
  headerByteSwap: boolean,
): Blockette {
  const type = dataView.getUint16(offset, headerByteSwap);
  const body = new DataView(
    dataView.buffer,
    dataView.byteOffset + offset,
    length,
  );

  if (type === 1000) {
    const encoding = body.getUint8(4);
    const wordOrder = body.getUint8(5);
    const dataRecordLengthByte = body.getUint8(6);
    return new Blockette1000(
      type,
      body,
      encoding,
      dataRecordLengthByte,
      wordOrder,
    );
  } else if (type === 1001) {
    const timeQual = body.getUint8(4);
    const microsecond = body.getUint8(5);
    //const reserved = body.getUint8(6)
    const frameCount = body.getUint8(7);
    return new Blockette1001(type, body, timeQual, microsecond, frameCount);
  } else if (type === 100) {
    const sampleRate = body.getFloat32(4);
    const flags = body.getUint8(8);
    return new Blockette100(type, body, sampleRate, flags);
  } else {
    return new Blockette(type, body);
  }
}

/**
 * Represents a SEED Data Record, with header, blockettes and data.
 */
export class DataRecord {
  header: DataHeader;
  data: DataView;

  constructor(header: DataHeader, data: DataView) {
    this.header = header;
    this.data = data;
  }

  /**
   * Decompresses the data , if the compression type is known.
   *
   * @returns decompressed data
   */
  decompress(): Int32Array | Float32Array | Float64Array {
    return this.asEncodedDataSegment().decode();
  }

  asEncodedDataSegment(): EncodedDataSegment {
    return new EncodedDataSegment(
      this.header.encoding,
      this.data,
      this.header.numSamples,
      this.header.littleEndian,
    );
  }

  /**
   * Concatenates the net, station, loc and channel codes,
   * separated by the given seperator, or periods if not given.
   *
   * @param sep optional separater, defaults to .
   * @returns string of codes
   */
  codes(sep?: string): string {
    if (!isNonEmptyStringArg(sep)) {
      sep = ".";
    }

    return (
      this.header.netCode +
      sep +
      this.header.staCode +
      sep +
      this.header.locCode +
      sep +
      this.header.chanCode
    );
  }
}

/**
 * Represents the header part of the DataRecord, including all the actual
 *  fixed header plus fields pulled from a blockette 1000 if present.
 */
export class DataHeader {
  seq: string;
  typeCode: number;
  continuationCode: number;
  staCode: string;
  locCode: string;
  chanCode: string;
  netCode: string;
  startBTime: BTime;
  numSamples: number;
  encoding: number;
  littleEndian: boolean;
  sampRateFac: number;
  sampRateMul: number;
  sampleRate: number;
  activityFlags: number;
  ioClockFlags: number;
  dataQualityFlags: number;
  numBlockettes: number;
  timeCorrection: number;
  dataOffset: number;
  blocketteOffset: number;
  recordSize: number;
  blocketteList: Array<Blockette>;
  startTime: DateTime;
  endTime: DateTime;

  constructor() {
    this.seq = "      ";
    this.typeCode = 68; // D

    this.continuationCode = 32; // space

    this.staCode = "";
    this.locCode = "";
    this.chanCode = "";
    this.netCode = "";
    this.startBTime = new BTime(1900, 1, 0, 0, 0, 0);
    this.numSamples = 0;
    this.sampRateFac = 0;
    this.sampRateMul = 0;
    this.activityFlags = 0;
    this.ioClockFlags = 0;
    this.dataQualityFlags = 0;
    this.numBlockettes = 0;
    this.timeCorrection = 0;
    this.dataOffset = 0;
    this.blocketteOffset = 0;
    this.blocketteList = [];
    this.recordSize = 4096;
    this.encoding = 0;
    this.littleEndian = false;
    this.sampleRate = 0;
    this.startTime = this.startBTime.toDateTime();
    this.endTime = this.startTime;
  }

  toString(): string {
    return (
      this.netCode +
      "." +
      this.staCode +
      "." +
      this.locCode +
      "." +
      this.chanCode +
      " " +
      this.startTime.toISO() +
      " " +
      this.encoding
    );
  }

  /**
   * Calculates the sample rate in hertz from the sampRateFac and sampRateMul
   * parameters. This.sampleRate value is set to this value at construction.
   *
   * @returns sample rate
   */
  calcSampleRate(): number {
    const factor = this.sampRateFac;
    const multiplier = this.sampRateMul;
    let sampleRate = 10000.0; // default (impossible) value;

    if (factor * multiplier !== 0.0) {
      // in the case of log records
      sampleRate =
        Math.pow(Math.abs(factor), factor / Math.abs(factor)) *
        Math.pow(Math.abs(multiplier), multiplier / Math.abs(multiplier));
    }

    return sampleRate;
  }

  /**
   * Calculates the time of the i-th sample in the record, zero based,
   *  so timeOfSample(0) is the start and timeOfSample(this.numSamples-1) is end.
   *
   * @param i sample index
   * @returns time at i-th sample as DateTime
   */
  timeOfSample(i: number): DateTime {
    return this.startTime.plus(Duration.fromMillis(1000*i / this.sampleRate));//seconds
  }
}
export class Blockette {
  type: number;
  body: DataView;

  constructor(type: number, body: DataView) {
    this.type = type;
    this.body = body;
  }
}
export class Blockette1000 extends Blockette {
  encoding: number;
  dataRecordLengthByte: number;
  wordOrder: number;

  constructor(
    type: number,
    body: DataView,
    encoding: number,
    dataRecordLengthByte: number,
    wordOrder: number,
  ) {
    super(type, body);

    if (type !== 1000) {
      throw new Error("Not a blockette1000: " + this.type);
    }

    this.encoding = encoding;
    this.dataRecordLengthByte = dataRecordLengthByte;
    this.wordOrder = wordOrder;
  }
}
export class Blockette1001 extends Blockette {
  timeQual: number;
  microsecond: number;
  frameCount: number;

  constructor(
    type: number,
    body: DataView,
    timeQual: number,
    microsecond: number,
    frameCount: number,
  ) {
    super(type, body);

    if (type !== 1001) {
      throw new Error("Not a blockette1001: " + this.type);
    }

    this.timeQual = timeQual;
    this.microsecond = microsecond;
    this.frameCount = frameCount;
  }
}
export class Blockette100 extends Blockette {
  sampleRate: number;
  flags: number;

  constructor(type: number, body: DataView, sampleRate: number, flags: number) {
    super(type, body);

    if (type !== 100) {
      throw new Error("Not a blockette100: " + this.type);
    }

    this.sampleRate = sampleRate;
    this.flags = flags;
  }
}

function makeString(
  dataView: DataView,
  offset: number,
  length: number,
): string {
  let out = "";

  for (let i = offset; i < offset + length; i++) {
    const charCode = dataView.getUint8(i);

    if (charCode > 31) {
      out += String.fromCharCode(charCode);
    }
  }

  return out.trim();
}

export function parseBTime(
  dataView: DataView,
  offset: number,
  byteSwap?: boolean,
): BTime {
  if (!isDef(byteSwap)) {
    byteSwap = false;
  }

  const year = dataView.getInt16(offset, byteSwap);
  const jday = dataView.getInt16(offset + 2, byteSwap);
  const hour = dataView.getInt8(offset + 4);
  const min = dataView.getInt8(offset + 5);
  const sec = dataView.getInt8(offset + 6);
  // byte 7 unused, alignment
  const tenthMilli = dataView.getInt16(offset + 8, byteSwap);
  return new BTime(year, jday, hour, min, sec, tenthMilli);
}
export class BTime {
  year: number;
  jday: number;
  hour: number;
  min: number;
  sec: number;
  tenthMilli: number;
  microsecond: number; // -50 to 49, not part of BTime proper, but added in case of B1001

  length: number;

  constructor(
    year: number,
    jday: number,
    hour: number,
    min: number,
    sec: number,
    tenthMilli: number,
  ) {
    this.length = 10;
    this.year = year;
    this.jday = jday;
    this.hour = hour;
    this.min = min;
    this.sec = sec;
    this.tenthMilli = tenthMilli;
    this.microsecond = 0;
  }

  toString(): string {
    return (
      this.year +
      "-" +
      this.jday +
      " " +
      this.hour +
      ":" +
      this.min +
      ":" +
      this.sec +
      "." +
      this.tenthMilli.toFixed().padStart(4, "0") +
      " " +
      this.toDateTime().toISO()
    );
  }

  /**
   * Converts this BTime to a luxon utc DateTime. Note DateTime's precision
   * is limited to milliseconds.
   *
   * @returns         BTime as a DateTime
   */
  toDateTime(): DateTime {
    return DateTime.fromObject({year: this.year,
                                ordinal: this.jday,
                                hour: this.hour,
                                minute: this.min,
                                second: this.sec,
                                millisecond: Math.round(this.tenthMilli / 10)},
                              UTC_OPTIONS);
  }
}

/**
 * Sanity checks on a BTime to see if a record might be in the wrong byte order
 * and so need to be byte swapped before parsing. Checks year betwee 1960 and 2055.
 *
 * @param   bTime  time
 * @returns        true is byte order appears to be wrong, false if it seems ok
 */
export function checkByteSwap(bTime: BTime): boolean {
  return bTime.year < 1960 || bTime.year > 2055;
}

/**
 * Determines if two DataRecords are contiguous, ie if the second starts
 * after the end of the first and the start time of the second is within
 * 1.5 times the sample period of the end of the first.
 *
 * @param dr1 first data record
 * @param dr2 seconds data record
 * @returns true if contiguous
 */
export function areContiguous(dr1: DataRecord, dr2: DataRecord): boolean {
  const h1 = dr1.header;
  const h2 = dr2.header;
  return (
    h1.endTime < h2.startTime &&
    h1.endTime.valueOf() + (1000 * 1.5) / h1.sampleRate > h2.startTime.valueOf()
  );
}

/**
 * Concatentates a sequence of DataRecords into a single seismogram object.
 * Assumes that they are all contiguous and in order. Header values from the first
 * DataRecord are used.
 *
 * @param contig array of data records
 * @returns SeismogramSegment instance
 */
export function createSeismogramSegment(
  contig: Array<DataRecord> | DataRecord,
): SeismogramSegment {
  if (!Array.isArray(contig)) {
    contig = [contig];
  }

  const contigData = contig.map(dr => dr.asEncodedDataSegment());
  const out = new SeismogramSegment(
    contigData,
    contig[0].header.sampleRate,
    contig[0].header.startTime,
  );
  out.networkCode = contig[0].header.netCode;
  out.stationCode = contig[0].header.staCode;
  out.locationCode = contig[0].header.locCode;
  out.channelCode = contig[0].header.chanCode;
  return out;
}

/**
 * Merges data records into a Seismogram object, each of
 * which consists of SeismogramSegment objects
 * containing the data as EncodedDataSegment objects. DataRecords are
 * sorted by startTime.
 * This assumes all data records are from the same channel, byChannel
 * can be used first if multiple channels may be present. It also
 * assumes that new seismograms should not be created for gaps, for example
 * when getting data from the same channel for multiple earthquakes.
 *
 * @param drList array of data records
 * @returns Seismogram instance
 */
export function merge(drList: Array<DataRecord>): Seismogram {
  return new Seismogram(mergeSegments(drList));
}

/**
 * merges contiguous DataRecords into SeismogramSegments.
 *
 * @param drList array of data records
 * @returns array of SeismogramSegments for contiguous data
 */
export function mergeSegments(drList: Array<DataRecord>): Array<SeismogramSegment> {
 const out = [];
 let currDR;
 drList.sort(function (a, b) {
   return a.header.startTime.toMillis() - b.header.startTime.toMillis();
 });
 let contig: Array<DataRecord> = [];

 for (let i = 0; i < drList.length; i++) {
   currDR = drList[i];

   if (contig.length === 0) {
     contig.push(currDR);
   } else if (areContiguous(contig[contig.length - 1], currDR)) {
     contig.push(currDR);
   } else {
     //found a gap
     out.push(createSeismogramSegment(contig));
     contig = [currDR];
   }
 }

 if (contig.length > 0) {
   // last segment
   out.push(createSeismogramSegment(contig));
   contig = [];
 }

 return out;
}

/**
 * Splits a list of data records by channel code, returning a Map
 * with each NSLC string mapped to an array of data records.
 *
 * @param drList array of data records
 * @returns map of arrays of data records keyed by channel
 */
export function byChannel(
  drList: Array<DataRecord>,
): Map<string, Array<DataRecord>> {
  const out: Map<string, Array<DataRecord>> = new Map();
  let key;

  for (let i = 0; i < drList.length; i++) {
    const currDR = drList[i];
    key = currDR.codes();
    let drArray = out.get(key);

    if (!drArray) {
      drArray = [currDR];
      out.set(key, drArray);
    } else {
      drArray.push(currDR);
    }
  }

  return out;
}

/**
 * splits the DataRecords by channel and creates a single
 * SeismogramSegment for each contiguous window from each channel.
 *
 * @param   drList DataRecords array
 * @returns         Array of SeismogramSegment
 */
export function seismogramSegmentPerChannel(
  drList: Array<DataRecord>,
): Array<SeismogramSegment> {
  let out = new Array<SeismogramSegment>(0);
  const byChannelMap = byChannel(drList);
  byChannelMap.forEach(segments => out = out.concat(mergeSegments(segments)));
  return out;
}
/**
 * splits the DataRecords by channel and creates a single
 * Seismogram for each channel.
 *
 * @param   drList DataRecords array
 * @returns         Array of Seismogram
 */
export function seismogramPerChannel(
  drList: Array<DataRecord>,
): Array<Seismogram> {
  const out: Array<Seismogram> = [];
  const byChannelMap = byChannel(drList);
  byChannelMap.forEach(segments => out.push(merge(segments)));
  return out;
}
