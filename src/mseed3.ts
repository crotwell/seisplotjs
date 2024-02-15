/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * https://www.seis.sc.edu
 */
import { FDSNSourceId } from "./fdsnsourceid";
import { isDef, UTC_OPTIONS } from "./util";
import {
  EncodedDataSegment,
  FLOAT,
  INTEGER,
  DOUBLE,
  STEIM1,
  STEIM2,
} from "./seedcodec";
import { SeismogramSegment } from "./seismogramsegment";
import { Seismogram } from "./seismogram";
import {
  DataRecord,
  R_TYPECODE,
  D_TYPECODE,
  Q_TYPECODE,
  M_TYPECODE,
} from "./miniseed";
import { DateTime, Duration } from "luxon";
export type json_object = Record<string, unknown>;
export const MINISEED_THREE_MIME = "application/vnd.fdsn.mseed3";

/** const for unknown data version, 0 */
export const UNKNOWN_DATA_VERSION = 0;

/** const for offset to crc in record, 28 */
export const CRC_OFFSET = 28;

/** const for size of fixed header part of record, 40 */
export const FIXED_HEADER_SIZE = 40;

/** const for fdsn prefix for extra headers, FDSN */
export const FDSN_PREFIX = "FDSN";

/** const for little endian, true */
export const LITTLE_ENDIAN = true;

/** const for big endian, false */
export const BIG_ENDIAN = false;

export function toMSeed3(
  seis: Seismogram,
  extraHeaders?: Record<string, unknown>,
): Array<MSeed3Record> {
  const out = new Array<MSeed3Record>(0);
  if (!isDef(extraHeaders)) {
    extraHeaders = {};
  }
  for (const seg of seis.segments) {
    const header = new MSeed3Header();
    let rawData;
    let encoding = 0;
    if (seg.isEncoded()) {
      const encoded = seg.getEncoded();
      if (encoded.length === 1) {
        rawData = encoded[0].dataView;
        encoding = encoded[0].compressionType;
      } else {
        const encodeTypeSet = new Set<number>();
        encoded.forEach((cur) => {
          encodeTypeSet.add(cur.compressionType);
        });
        const encodeTypes = Array.from(encodeTypeSet.values());
        if (encodeTypes.length > 1) {
          throw new Error(
            `more than one encoding type in seis segment: ${encodeTypes.length}`,
          );
        } else if (encodeTypes.length === 0) {
          throw new Error(`zero encoding type in seis segment`);
        } else if (!encodeTypes[0]) {
          throw new Error(`only encoding type is undef`);
        }
        encoding = encodeTypes[0];
        if (!encoding) {
          throw new Error(`encoding is undefined`);
        }
        if (INTEGER || FLOAT || DOUBLE) {
          // safe to concat
          const totSize = encoded.reduce(
            (acc, cur) => acc + cur.dataView.byteLength,
            0,
          );
          const combined = new Uint8Array(totSize);
          encoded.reduce((offset, cur) => {
            combined.set(
              new Uint8Array(
                cur.dataView.buffer,
                cur.dataView.byteOffset,
                cur.dataView.byteLength,
              ),
              offset,
            );
            return offset + cur.dataView.byteLength;
          }, 0);
          rawData = new DataView(combined.buffer);
          if (encoding === STEIM1 || encoding === STEIM2) {
            // careful as each encodeddata has first-last sample
            // copy last sample from last block to first block to check value to start
            rawData.setUint32(
              8,
              encoded[encoded.length - 1].dataView.getUint32(8),
            );
          }
        } else {
          throw new Error(
            `Encoding type not steim 1 or 2 or primitive in seis segment: ${encoding}`,
          );
        }
      }
    } else {
      rawData = new DataView(seg.y.buffer);
      if (seg.y instanceof Float32Array) {
        encoding = FLOAT;
      } else if (seg.y instanceof Int32Array) {
        encoding = INTEGER;
      } else if (seg.y instanceof Float64Array) {
        encoding = DOUBLE;
      } else {
        throw new Error("unable to save data of encoding: ");
      }
    }
    header.setStart(seg.startTime);
    header.encoding = encoding;
    if (seg.sampleRate > 0.001) {
      header.sampleRateOrPeriod = seg.sampleRate;
    } else {
      header.sampleRateOrPeriod = -1 * seg.samplePeriod;
    }
    header.numSamples = seg.numPoints;
    header.publicationVersion = UNKNOWN_DATA_VERSION;
    const sid = seg.sourceId
      ? seg.sourceId
      : FDSNSourceId.createUnknown(seg.sampleRate);
    header.identifier = sid.toString();
    header.identifierLength = header.identifier.length;
    header.extraHeaders = extraHeaders;
    header.dataLength = rawData.byteLength;
    const record = new MSeed3Record(header, extraHeaders, rawData);
    record.calcSize();
    out.push(record);
  }
  return out;
}
/**
 * parse arrayBuffer into an array of MSeed3Records.
 *
 * @param arrayBuffer bytes to extract miniseed3 records from
 * @returns array of all miniseed3 records contained in the buffer
 */
export function parseMSeed3Records(
  arrayBuffer: ArrayBuffer,
): Array<MSeed3Record> {
  const dataRecords = [];
  let offset = 0;

  while (offset < arrayBuffer.byteLength) {
    const dataView = new DataView(arrayBuffer, offset);

    if (!(dataView.getUint8(0) === 77 && dataView.getUint8(1) === 83)) {
      throw new Error(
        `First byte must be M=77 S=83 at offset=${offset}, but was ${dataView.getUint8(
          0,
        )} ${dataView.getUint8(1)}`,
      );
    }

    const dr = MSeed3Record.parseSingleDataRecord(dataView);
    dataRecords.push(dr);
    offset += dr.getSize();
  }

  return dataRecords;
}

/**
 * Represents a MSEED3 Data Record, with header, extras and data.
 *
 * @param header miniseed3 fixed record header
 * @param extraHeaders json compatible object with extra headers
 * @param rawData waveform data, in correct compression for value in header
 */
export class MSeed3Record {
  header: MSeed3Header;
  extraHeaders: Record<string, unknown>;
  rawData: DataView;

  constructor(
    header: MSeed3Header,
    extraHeaders: Record<string, unknown>,
    rawData: DataView,
  ) {
    this.header = header;
    this.rawData = rawData;
    this.extraHeaders = extraHeaders;
  }

  /**
   * Parses an miniseed3 data record from a DataView.
   *
   * @param   dataView bytes to parse
   * @returns parsed record
   */
  static parseSingleDataRecord(dataView: DataView): MSeed3Record {
    const header = MSeed3Header.createFromDataView(dataView);
    const ehoffset = header.getSize();
    const dataoffset = header.getSize() + header.extraHeadersLength;
    const extraDataView = new DataView(
      dataView.buffer,
      dataView.byteOffset + ehoffset,
      header.extraHeadersLength,
    );
    const extraHeaders = parseExtraHeaders(extraDataView);
    const sliceStart = dataView.byteOffset + dataoffset;
    const rawData = new DataView(
      dataView.buffer.slice(sliceStart, sliceStart + header.dataLength),
    );
    const xr = new MSeed3Record(header, extraHeaders, rawData);
    return xr;
  }

  /**
   * Calculates the byte size of the miniseed3 record to hold this data.
   * This should be called if the size is needed after modification
   * of the extraHeaders.
   *
   * @returns size in bytes
   */
  calcSize(): number {
    const json = JSON.stringify(this.extraHeaders);

    if (json.length > 2) {
      this.header.extraHeadersLength = json.length;
    } else {
      this.header.extraHeadersLength = 0;
    }

    return this.getSize();
  }

  /**
   * Gets the byte size of the miniseed3 record to hold this data.
   * Note that unless calcSize() has been called, this may not
   * take into account modifications to the extra headers.
   *
   * @returns size in bytes
   */
  getSize(): number {
    return (
      this.header.getSize() +
      this.header.extraHeadersLength +
      this.header.dataLength
    );
  }

  /**
   * Decompresses the data , if the compression
   *  type is known
   *
   * @returns decompressed data as a typed array, usually Int32Array or Float32Array
   */
  decompress(): Int32Array | Float32Array | Float64Array {
    return this.asEncodedDataSegment().decode();
  }

  /**
   * Wraps data in an EncodedDataSegment for future decompression.
   *
   * @returns waveform data
   */
  asEncodedDataSegment(): EncodedDataSegment {
    let swapBytes = LITTLE_ENDIAN;

    if (
      this.header.encoding === 10 ||
      this.header.encoding === 11 ||
      this.header.encoding === 19
    ) {
      // steim1, 2 and 3 are big endian
      swapBytes = BIG_ENDIAN;
    }

    return new EncodedDataSegment(
      this.header.encoding,
      this.rawData,
      this.header.numSamples,
      swapBytes,
    );
  }

  /**
   * Just the header.identifier, included as codes() for compatiblility
   * with parsed miniseed2 data records.
   *
   * @returns string identifier
   */
  codes(): string {
    return this.header.identifier;
  }

  /**
   * Saves miniseed3 record into a DataView, recalculating crc.
   *
   * @param   dataView DataView to save into, must be large enough to hold the record.
   * @returns the number of bytes written to the DataView, can be used as offset
   * for writting the next record.
   */
  save(dataView: DataView): number {
    const json = JSON.stringify(this.extraHeaders);

    if (json.length > 2) {
      this.header.extraHeadersLength = json.length;
    } else {
      this.header.extraHeadersLength = 0;
    }

    // don't write crc as we need to recalculate
    let offset = this.header.save(dataView, 0, true);

    if (json.length > 2) {
      for (let i = 0; i < json.length; i++) {
        // not ok for unicode?
        dataView.setInt8(offset, json.charCodeAt(i));
        offset++;
      }
    }

    if (this.rawData !== null) {
      for (let i = 0; i < this.rawData.byteLength; i++) {
        dataView.setUint8(offset + i, this.rawData.getUint8(i));
      }

      offset += this.rawData.byteLength;
    } else {
      throw new Error("rawData is null");
    }

    const dvcrc = dataView.getUint32(CRC_OFFSET, true);

    if (dvcrc !== 0) {
      throw new Error(`CRC is not zero before calculate! ${dvcrc}`);
    }

    const crc = calculateCRC32C(dataView.buffer);
    dataView.setUint32(CRC_OFFSET, crc, true);
    return offset;
  }

  /**
   * Calculates crc by saving to a DataView, which sets the crc header to zero
   * and then calculates it based on the rest of the record.
   *
   * @returns         crc pulled from saved miniseed3 record
   */
  calcCrc(): number {
    const size = this.calcSize();
    const buff = new ArrayBuffer(size);
    const dataView = new DataView(buff);
    const offset = this.save(dataView);

    if (offset !== size) {
      throw new Error(`expect to write ${size} bytes but only ${offset}`);
    }

    const crc = dataView.getUint32(CRC_OFFSET, true);
    return crc;
  }

  toString(): string {
    const ehLines = JSON.stringify(this.extraHeaders, null, 2).split("\n");
    const indentLines = ehLines.join("\n          ");
    return `${this.header.toString()}\n          extra headers: ${indentLines}`;
  }
}

/**
 * Fixed header of an MSeed3 data record.
 */
export class MSeed3Header {
  recordIndicator: string;
  formatVersion: number;
  flags: number;
  nanosecond: number;
  year: number;
  dayOfYear: number;
  hour: number;
  minute: number;
  second: number;
  encoding: number;
  sampleRateOrPeriod: number;
  numSamples: number;
  crc: number;
  publicationVersion: number;
  identifierLength: number;
  extraHeadersLength: number;
  identifier: string;
  extraHeaders: json_object;
  dataLength: number;

  constructor() {
    // empty construction
    this.recordIndicator = "MS";
    this.formatVersion = 3;
    this.flags = 0;
    this.nanosecond = 0;
    this.year = 1970;
    this.dayOfYear = 1;
    this.hour = 0;
    this.minute = 0;
    this.second = 0;
    this.encoding = 3; // 32 bit ints

    this.sampleRateOrPeriod = 1;
    this.numSamples = 0;
    this.crc = 0;
    this.publicationVersion = UNKNOWN_DATA_VERSION;
    this.identifierLength = 0;
    this.extraHeadersLength = 2;
    this.identifier = "";
    this.extraHeaders = {};
    this.dataLength = 0;
  }

  /**
   * Parses an miniseed3 fixed header from a DataView.
   *
   * @param   dataView bytes to parse
   * @returns parsed header object
   */
  static createFromDataView(dataView: DataView): MSeed3Header {
    const header = new MSeed3Header();
    header.recordIndicator = makeString(dataView, 0, 2);

    if (header.recordIndicator !== "MS") {
      throw new Error(
        "First 2 bytes of record should be MS but found " +
          header.recordIndicator,
      );
    }

    header.formatVersion = dataView.getUint8(2);

    if (header.formatVersion !== 3) {
      throw new Error("Format Version should be 3, " + header.formatVersion);
    }

    header.flags = dataView.getUint8(3);
    const headerLittleEndian = true;
    header.nanosecond = dataView.getInt32(4, headerLittleEndian);
    header.year = dataView.getInt16(8, headerLittleEndian);

    if (checkByteSwap(header.year)) {
      throw new Error("Looks like wrong byte order, year=" + header.year);
    }

    header.dayOfYear = dataView.getInt16(10, headerLittleEndian);
    header.hour = dataView.getUint8(12);
    header.minute = dataView.getUint8(13);
    header.second = dataView.getUint8(14);
    header.encoding = dataView.getUint8(15);
    header.sampleRateOrPeriod = dataView.getFloat64(16, headerLittleEndian);

    header.numSamples = dataView.getUint32(24, headerLittleEndian);
    header.crc = dataView.getUint32(28, headerLittleEndian);
    header.publicationVersion = dataView.getUint8(32);
    header.identifierLength = dataView.getUint8(33);
    header.extraHeadersLength = dataView.getUint16(34, headerLittleEndian);
    header.dataLength = dataView.getUint32(36, headerLittleEndian);
    header.identifier = makeString(dataView, 40, header.identifierLength);
    return header;
  }

  get start() {
    return this.startAsDateTime();
  }
  get end() {
    return this.timeOfSample(this.numSamples - 1);
  }
  get sampleRate() {
    if (this.sampleRateOrPeriod < 0) {
      return -1 / this.sampleRateOrPeriod;
    } else {
      return this.sampleRateOrPeriod;
    }
  }
  get samplePeriod() {
    if (this.sampleRateOrPeriod <= 0) {
      return -1 * this.sampleRateOrPeriod;
    } else {
      return 1 / this.sampleRateOrPeriod;
    }
  }
  /**
   * Calculates size of the fixed header including the variable
   * length identifier, but without the extra headers.
   *
   * @returns size in bytes of fixed header
   */
  getSize(): number {
    return FIXED_HEADER_SIZE + this.identifier.length;
  }

  /**
   * Text representation of the miniseed3 header. This is modeled after
   * the output of mseed3-text from the mseed3-utils package from IRIS.
   *
   * @returns textual repersentation
   */
  toString(): string {
    /*
    FDSN:CO_HODGE_00_L_H_Z, version 4, 477 bytes (format: 3)
             start time: 2019-07-06T03:19:53.000000Z (187)
      number of samples: 255
       sample rate (Hz): 1
                  flags: [00000000] 8 bits
                    CRC: 0x8926FFDF
    extra header length: 31 bytes
    data payload length: 384 bytes
       payload encoding: STEIM-2 integer compression (val: 11)
          extra headers:
                "FDSN": {
                  "Time": {
                    "Quality": 0
                  }
                }
      */
    let encode_name = "unknown";

    if (this.encoding === 0) {
      encode_name = "Text";
    } else if (this.encoding === 11) {
      encode_name = "STEIM-2 integer compression";
    } else if (this.encoding === 10) {
      encode_name = "STEIM-1 integer compression";
    }
    let bitFlagStr = "";
    if (this.flags & 0x01) {
      bitFlagStr = `${bitFlagStr}
                         [Bit 0] Calibration signals present`;
    }
    if (this.flags & 0x02) {
      bitFlagStr = `${bitFlagStr}
                         [Bit 1] Time tag is questionable`;
    }
    if (this.flags & 0x04) {
      bitFlagStr = `${bitFlagStr}
                         [Bit 2] Clock locked`;
    }
    if (this.flags & 0x08) {
      bitFlagStr = `${bitFlagStr}
                         [Bit 3] Undefined bit set`;
    }
    if (this.flags & 0x10) {
      bitFlagStr = `${bitFlagStr}
                         [Bit 4] Undefined bit set`;
    }
    if (this.flags & 0x20) {
      bitFlagStr = `${bitFlagStr}
                         [Bit 5] Undefined bit set`;
    }
    if (this.flags & 0x40) {
      bitFlagStr = `${bitFlagStr}
                         [Bit 6] Undefined bit set`;
    }
    if (this.flags & 0x80) {
      bitFlagStr = `${bitFlagStr}
                         [Bit 7] Undefined bit set`;
    }
    return (
      `${this.identifier}, version ${this.publicationVersion}, ${
        this.getSize() + this.dataLength + this.extraHeadersLength
      } bytes (format: ${this.formatVersion})\n` +
      `             start time: ${this.getStartFieldsAsISO()} (${padZeros(this.dayOfYear, 3)})\n` +
      `      number of samples: ${this.numSamples}\n` +
      `       sample rate (Hz): ${this.sampleRate}\n` +
      `                  flags: [${(this.flags >>> 0)
        .toString(2)
        .padStart(8, "0")}] 8 bits${bitFlagStr}\n` +
      `                    CRC: ${crcToHexString(this.crc)}\n` +
      `    extra header length: ${this.extraHeadersLength} bytes\n` +
      `    data payload length: ${this.dataLength} bytes\n` +
      `       payload encoding: ${encode_name} (val: ${this.encoding})`
    );
  }
  /**
   * Start time in the format output by mseed3-utils from IRIS. Format is
   * yyyy,ooo,HH:mm:ss.SSSSSS
   *
   * @returns start time
   */
  startFieldsInUtilFormat(): string {
    return (
      `${this.year},${padZeros(this.dayOfYear, 3)},` +
      `${padZeros(this.hour, 2)}:${padZeros(this.minute, 2)}:${padZeros(this.second, 2)}.${padZeros(Math.floor(this.nanosecond / 1000), 6)}`
    );
  }
  /**
   * Converts start time header fields to ISO8601 time string. This will include
   * factional seconds to nanosecond precision.
   *
   * @param trimMicroNano trim to microsecond precision if nanos are 000
   * @returns iso start time
   */
  getStartFieldsAsISO(trimMicroNano = true): string {
    const d = this.startAsDateTime()
      .set({ millisecond: 0 })
      .toISO({ includeOffset: false, suppressMilliseconds: true });
    let fracSec = "";
    if (trimMicroNano && this.nanosecond % 1000 === 0) {
      // nanos end in 000 so just use micros
      fracSec = padZeros(this.nanosecond / 1000, 6);
    } else {
      fracSec = padZeros(this.nanosecond, 9);
    }
    return `${d}.${fracSec}Z`;
  }
  /**
   * sets start time headers.
   *
   * @param starttime start as DateTime
   */
  setStart(starttime: DateTime) {
    this.nanosecond = starttime.millisecond * 1000;
    this.year = starttime.year;
    this.dayOfYear = starttime.ordinal;
    this.hour = starttime.hour;
    this.minute = starttime.minute;
    this.second = starttime.second;
  }

  /**
   * Calculates time of the ith sample.
   *
   * @param   i sample number
   * @returns the time
   */
  timeOfSample(i: number): DateTime {
    return this.start.plus(Duration.fromMillis((1000 * i) / this.sampleRate));
  }

  /**
   * Writes to the given dataview.
   *
   * @param   dataView write buffer
   * @param   offset   offset within the buffer
   * @param   zeroCrc  optionally zero out the crc field in order to recalculate
   * @returns          new offset after this record
   */
  save(dataView: DataView, offset = 0, zeroCrc = false): number {
    dataView.setUint8(offset, this.recordIndicator.charCodeAt(0));
    offset++;
    dataView.setUint8(offset, this.recordIndicator.charCodeAt(1));
    offset++;
    dataView.setUint8(offset, this.formatVersion);
    offset++;
    dataView.setUint8(offset, this.flags);
    offset++;
    dataView.setUint32(offset, this.nanosecond, true);
    offset += 4;
    dataView.setUint16(offset, this.year, true);
    offset += 2;
    dataView.setUint16(offset, this.dayOfYear, true);
    offset += 2;
    dataView.setUint8(offset, this.hour);
    offset++;
    dataView.setUint8(offset, this.minute);
    offset++;
    dataView.setUint8(offset, this.second);
    offset++;
    dataView.setUint8(offset, this.encoding);
    offset++;
    dataView.setFloat64(offset, this.sampleRateOrPeriod, true);
    offset += 8;
    dataView.setUint32(offset, this.numSamples, true);
    offset += 4;

    if (zeroCrc) {
      dataView.setUint32(offset, 0, true);
    } else {
      dataView.setUint32(offset, this.crc, true);
    }

    offset += 4;
    dataView.setUint8(offset, this.publicationVersion);
    offset++;
    dataView.setUint8(offset, this.identifier.length);
    offset++;
    dataView.setUint16(offset, this.extraHeadersLength, true);
    offset += 2;
    dataView.setUint32(offset, this.dataLength, true);
    offset += 4;

    for (let i = 0; i < this.identifier.length; i++) {
      // not ok for unicode?
      dataView.setUint8(offset, this.identifier.charCodeAt(i));
      offset++;
    }

    return offset;
  }

  /**
   * Converts header start time to DateTime
   *
   * @returns         start time as DateTime
   */
  startAsDateTime(): DateTime {
    return DateTime.fromObject(
      {
        year: this.year,
        ordinal: this.dayOfYear,
        hour: this.hour,
        minute: this.minute,
        second: this.second,
        millisecond: Math.round(this.nanosecond / 1000000),
      },
      UTC_OPTIONS,
    );
  }
}

/**
 * Parses extra headers as json.
 *
 * @param   dataView json bytes as DataView
 * @returns           json object
 */
export function parseExtraHeaders(dataView: DataView): Record<string, unknown> {
  if (dataView.byteLength === 0) {
    return {};
  }

  const firstChar = dataView.getUint8(0);

  if (firstChar === 123) {
    // looks like json, '{' is ascii 123
    const jsonStr = makeString(dataView, 0, dataView.byteLength);
    const v: unknown = JSON.parse(jsonStr);
    if (typeof v === "object") {
      return v as Record<string, unknown>;
    } else {
      throw new Error(
        `extra headers does not look like JSON object: ${jsonStr}"`,
      );
    }
  } else {
    throw new Error(
      "do not understand extras with first char val: " +
        firstChar +
        " " +
        (firstChar === 123),
    );
  }
}

/**
 * Creates a string version of a number with zero prefix padding. For example
 * padZeros(5, 3) is 005.
 *
 * @param   val number to stringify
 * @param   len total length of string
 * @returns      zero padded string
 */
export function padZeros(val: number, len: number): string {
  let out = "" + val;

  while (out.length < len) {
    out = "0" + out;
  }

  return out;
}

/**
 * creates a string from utf-8 bytes in a DataView.
 *
 * @param   dataView data bytes
 * @param   offset   offset to first byte to use
 * @param   length   number of bytes to convert
 * @returns           string resulting from utf-8 conversion
 */
export function makeString(
  dataView: DataView,
  offset: number,
  length: number,
): string {
  const utf8decoder = new TextDecoder("utf-8");
  const u8arr = new Uint8Array(
    dataView.buffer,
    dataView.byteOffset + offset,
    length,
  );
  return utf8decoder.decode(u8arr).trim();
}

/**
 * Sanity checks on year to see if a record might be in the wrong byte order.
 * Checks year betwee 1960 and 2055.
 *
 * @param   year year as number to test
 * @returns        true is byte order appears to be wrong, false if it seems ok
 */
function checkByteSwap(year: number) {
  return year < 1960 || year > 2055;
}

/**
 * Checks if two miniseed3 records are (nearly) contiguous.
 *
 * @param   dr1 first record
 * @param   dr2 second record
 * @param   sampRatio tolerence expressed as ratio of sample period, default 1.5
 * @returns      true if contiguous
 */
export function areContiguous(
  dr1: MSeed3Record,
  dr2: MSeed3Record,
  sampRatio = 1.5,
): boolean {
  const h1 = dr1.header;
  const h2 = dr2.header;
  return (
    h1.end < h2.start &&
    h1.end.plus(Duration.fromMillis((1000 * sampRatio) / h1.sampleRate)) >=
      h2.start
  );
}

/**
 * Concatentates a sequence of MSeed3 Records into a single seismogram object.
 * Assumes that they are all contiguous (no gaps or overlaps) and in order.
 * Header values from the first MSeed3 Record are used.
 *
 * @param contig array of miniseed3 records
 * @returns seismogram segment for the records
 */
export function createSeismogramSegment(
  contig: Array<MSeed3Record>,
): SeismogramSegment {
  const contigData = contig.map((dr) => dr.asEncodedDataSegment());
  const out = new SeismogramSegment(
    contigData,
    contig[0].header.sampleRate,
    contig[0].header.start,
    FDSNSourceId.parse(contig[0].header.identifier),
  );
  return out;
}

/**
 * Merges miniseed3 records into a Seismogram object, each of
 * which consists of SeismogramSegment objects
 * containing the data as EncodedDataSegment objects. DataRecords are
 * sorted by startTime.
 * This assumes all data records are from the same channel, byChannel
 * can be used first if multiple channels may be present. Gaps may be present.
 *
 * @param drList list of miniseed3 records to convert
 * @returns the seismogram
 */
export function merge(drList: Array<MSeed3Record>): Seismogram {
  return new Seismogram(mergeSegments(drList));
}

/**
 * merges contiguous MSeed3Record into SeismogramSegments.
 *
 * @param drList array of data records
 * @returns array of SeismogramSegments for contiguous data
 */
export function mergeSegments(
  drList: Array<MSeed3Record>,
): Array<SeismogramSegment> {
  const out = [];
  let currDR;
  drList.sort(function (a, b) {
    return a.header.start.valueOf() - b.header.start.valueOf();
  });
  let contig: Array<MSeed3Record> = [];

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
 * splits a list of data records by channel identifier, returning an object
 * with each NSLC mapped to an array of data records.
 *
 * @param drList array of miniseed3 records
 * @returns map of channel id to array of miniseed3 records, possibly not contiguous
 */
export function byChannel(
  drList: Array<MSeed3Record>,
): Map<string, Array<MSeed3Record>> {
  const out: Map<string, Array<MSeed3Record>> = new Map();
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
 * splits the records by channel and creates a single
 * SeismogramSegment for each contiguous window from each channel.
 *
 * @param   drList MSeed3Records array
 * @returns         Array of SeismogramSegment
 */
export function seismogramSegmentPerChannel(
  drList: Array<MSeed3Record>,
): Array<SeismogramSegment> {
  let out = new Array<SeismogramSegment>(0);
  const byChannelMap = byChannel(drList);
  byChannelMap.forEach(
    (segments) => (out = out.concat(mergeSegments(segments))),
  );
  return out;
}
/**
 * splits the MSeed3Records by channel and creates a single
 * Seismogram for each channel.
 *
 * @param   drList MSeed3Records array
 * @returns         Map of code to Seismogram
 */
export function seismogramPerChannel(
  drList: Array<MSeed3Record>,
): Array<Seismogram> {
  const out: Array<Seismogram> = [];
  const byChannelMap = byChannel(drList);
  byChannelMap.forEach((segments) => out.push(merge(segments)));
  return out;
}

/* MSeed2 to xSeed converstion */

/**
 * Convert array of Miniseed2 DataRecords into an array of MSeed3Records.
 *
 * @param   mseed2 array of DataRecords
 * @returns         array of MSeed3Records
 */
export function convertMS2toMSeed3(
  mseed2: Array<DataRecord>,
): Array<MSeed3Record> {
  const out = [];

  for (let i = 0; i < mseed2.length; i++) {
    out.push(convertMS2Record(mseed2[i]));
  }

  return out;
}

/**
 * Converts a single miniseed2 DataRecord into a single MSeed3Record.
 *
 * @param   ms2record Miniseed2 DataRecord to convert
 * @returns            MSeed3Record
 */
export function convertMS2Record(ms2record: DataRecord): MSeed3Record {
  const xHeader = new MSeed3Header();
  const xExtras: Record<string, unknown> = {};
  const ms2H = ms2record.header;
  xHeader.flags =
    (ms2H.activityFlags & 1) * 2 +
    (ms2H.ioClockFlags & 64) * 4 +
    (ms2H.dataQualityFlags & 16) * 8;
  xHeader.year = ms2H.startBTime.year;
  xHeader.dayOfYear = ms2H.startBTime.jday;
  xHeader.hour = ms2H.startBTime.hour;
  xHeader.minute = ms2H.startBTime.min;
  xHeader.second = ms2H.startBTime.sec;
  xHeader.nanosecond =
    ms2H.startBTime.tenthMilli * 100000 + ms2H.startBTime.microsecond * 1000;
  xHeader.sampleRateOrPeriod =
    ms2H.sampleRate >= 1 ? ms2H.sampleRate : -1.0 / ms2H.sampleRate;
  xHeader.encoding = ms2record.header.encoding;
  xHeader.publicationVersion = UNKNOWN_DATA_VERSION;
  xHeader.dataLength = ms2record.data.byteLength;
  xHeader.identifier =
    FDSN_PREFIX +
    ":" +
    ms2H.netCode +
    SEP +
    ms2H.staCode +
    SEP +
    (ms2H.locCode ? ms2H.locCode : "") +
    SEP +
    ms2H.chanCode;
  xHeader.identifierLength = xHeader.identifier.length;
  xHeader.numSamples = ms2H.numSamples;
  xHeader.crc = 0;

  if (ms2H.typeCode) {
    if (ms2H.typeCode === R_TYPECODE) {
      xHeader.publicationVersion = 1;
    } else if (ms2H.typeCode === D_TYPECODE) {
      xHeader.publicationVersion = 2;
    } else if (ms2H.typeCode === Q_TYPECODE) {
      xHeader.publicationVersion = 3;
    } else if (ms2H.typeCode === M_TYPECODE) {
      xHeader.publicationVersion = 4;
    }

    if (ms2H.typeCode !== D_TYPECODE) {
      xExtras.DataQuality = ms2H.typeCode;
    }
  }

  if (xHeader.nanosecond < 0) {
    xHeader.second -= 1;
    xHeader.nanosecond += 1000000000;

    if (xHeader.second < 0) {
      // might be wrong for leap seconds
      xHeader.second += 60;
      xHeader.minute -= 1;

      if (xHeader.minute < 0) {
        xHeader.minute += 60;
        xHeader.hour -= 1;

        if (xHeader.hour < 0) {
          xHeader.hour += 24;
          xHeader.dayOfYear = -1;

          if (xHeader.dayOfYear < 0) {
            // wrong for leap years
            xHeader.dayOfYear += 365;
            xHeader.year -= 1;
          }
        }
      }
    }
  }

  xHeader.extraHeadersLength = JSON.stringify(xExtras).length;
  // need to convert if not steim1 or 2
  const out = new MSeed3Record(xHeader, xExtras, ms2record.data);
  return out;
}

/**
 * Default separator for channel id.
 */
const SEP = "_";

/**
 * Copy from https://github.com/ashi009/node-fast-crc32c/blob/master/impls/js_crc32c.js
 * and modify to use ArrayBuffer.
 *
 * This code is a manual javascript translation of c code generated by
 * pycrc 0.7.1 (https://www.tty1.net/pycrc/). Command line used:
 * './pycrc.py --model=crc-32c --generate c --algorithm=table-driven'
 */
const kCRCTable = new Int32Array([
  0x00000000, 0xf26b8303, 0xe13b70f7, 0x1350f3f4, 0xc79a971f, 0x35f1141c,
  0x26a1e7e8, 0xd4ca64eb, 0x8ad958cf, 0x78b2dbcc, 0x6be22838, 0x9989ab3b,
  0x4d43cfd0, 0xbf284cd3, 0xac78bf27, 0x5e133c24, 0x105ec76f, 0xe235446c,
  0xf165b798, 0x030e349b, 0xd7c45070, 0x25afd373, 0x36ff2087, 0xc494a384,
  0x9a879fa0, 0x68ec1ca3, 0x7bbcef57, 0x89d76c54, 0x5d1d08bf, 0xaf768bbc,
  0xbc267848, 0x4e4dfb4b, 0x20bd8ede, 0xd2d60ddd, 0xc186fe29, 0x33ed7d2a,
  0xe72719c1, 0x154c9ac2, 0x061c6936, 0xf477ea35, 0xaa64d611, 0x580f5512,
  0x4b5fa6e6, 0xb93425e5, 0x6dfe410e, 0x9f95c20d, 0x8cc531f9, 0x7eaeb2fa,
  0x30e349b1, 0xc288cab2, 0xd1d83946, 0x23b3ba45, 0xf779deae, 0x05125dad,
  0x1642ae59, 0xe4292d5a, 0xba3a117e, 0x4851927d, 0x5b016189, 0xa96ae28a,
  0x7da08661, 0x8fcb0562, 0x9c9bf696, 0x6ef07595, 0x417b1dbc, 0xb3109ebf,
  0xa0406d4b, 0x522bee48, 0x86e18aa3, 0x748a09a0, 0x67dafa54, 0x95b17957,
  0xcba24573, 0x39c9c670, 0x2a993584, 0xd8f2b687, 0x0c38d26c, 0xfe53516f,
  0xed03a29b, 0x1f682198, 0x5125dad3, 0xa34e59d0, 0xb01eaa24, 0x42752927,
  0x96bf4dcc, 0x64d4cecf, 0x77843d3b, 0x85efbe38, 0xdbfc821c, 0x2997011f,
  0x3ac7f2eb, 0xc8ac71e8, 0x1c661503, 0xee0d9600, 0xfd5d65f4, 0x0f36e6f7,
  0x61c69362, 0x93ad1061, 0x80fde395, 0x72966096, 0xa65c047d, 0x5437877e,
  0x4767748a, 0xb50cf789, 0xeb1fcbad, 0x197448ae, 0x0a24bb5a, 0xf84f3859,
  0x2c855cb2, 0xdeeedfb1, 0xcdbe2c45, 0x3fd5af46, 0x7198540d, 0x83f3d70e,
  0x90a324fa, 0x62c8a7f9, 0xb602c312, 0x44694011, 0x5739b3e5, 0xa55230e6,
  0xfb410cc2, 0x092a8fc1, 0x1a7a7c35, 0xe811ff36, 0x3cdb9bdd, 0xceb018de,
  0xdde0eb2a, 0x2f8b6829, 0x82f63b78, 0x709db87b, 0x63cd4b8f, 0x91a6c88c,
  0x456cac67, 0xb7072f64, 0xa457dc90, 0x563c5f93, 0x082f63b7, 0xfa44e0b4,
  0xe9141340, 0x1b7f9043, 0xcfb5f4a8, 0x3dde77ab, 0x2e8e845f, 0xdce5075c,
  0x92a8fc17, 0x60c37f14, 0x73938ce0, 0x81f80fe3, 0x55326b08, 0xa759e80b,
  0xb4091bff, 0x466298fc, 0x1871a4d8, 0xea1a27db, 0xf94ad42f, 0x0b21572c,
  0xdfeb33c7, 0x2d80b0c4, 0x3ed04330, 0xccbbc033, 0xa24bb5a6, 0x502036a5,
  0x4370c551, 0xb11b4652, 0x65d122b9, 0x97baa1ba, 0x84ea524e, 0x7681d14d,
  0x2892ed69, 0xdaf96e6a, 0xc9a99d9e, 0x3bc21e9d, 0xef087a76, 0x1d63f975,
  0x0e330a81, 0xfc588982, 0xb21572c9, 0x407ef1ca, 0x532e023e, 0xa145813d,
  0x758fe5d6, 0x87e466d5, 0x94b49521, 0x66df1622, 0x38cc2a06, 0xcaa7a905,
  0xd9f75af1, 0x2b9cd9f2, 0xff56bd19, 0x0d3d3e1a, 0x1e6dcdee, 0xec064eed,
  0xc38d26c4, 0x31e6a5c7, 0x22b65633, 0xd0ddd530, 0x0417b1db, 0xf67c32d8,
  0xe52cc12c, 0x1747422f, 0x49547e0b, 0xbb3ffd08, 0xa86f0efc, 0x5a048dff,
  0x8ecee914, 0x7ca56a17, 0x6ff599e3, 0x9d9e1ae0, 0xd3d3e1ab, 0x21b862a8,
  0x32e8915c, 0xc083125f, 0x144976b4, 0xe622f5b7, 0xf5720643, 0x07198540,
  0x590ab964, 0xab613a67, 0xb831c993, 0x4a5a4a90, 0x9e902e7b, 0x6cfbad78,
  0x7fab5e8c, 0x8dc0dd8f, 0xe330a81a, 0x115b2b19, 0x020bd8ed, 0xf0605bee,
  0x24aa3f05, 0xd6c1bc06, 0xc5914ff2, 0x37faccf1, 0x69e9f0d5, 0x9b8273d6,
  0x88d28022, 0x7ab90321, 0xae7367ca, 0x5c18e4c9, 0x4f48173d, 0xbd23943e,
  0xf36e6f75, 0x0105ec76, 0x12551f82, 0xe03e9c81, 0x34f4f86a, 0xc69f7b69,
  0xd5cf889d, 0x27a40b9e, 0x79b737ba, 0x8bdcb4b9, 0x988c474d, 0x6ae7c44e,
  0xbe2da0a5, 0x4c4623a6, 0x5f16d052, 0xad7d5351,
]);

/**
 * Copy from https://github.com/ashi009/node-fast-crc32c/blob/master/impls/js_crc32c.js
 * and modify to use ArrayBuffer. Rename calculateCRC32C
 *
 * This code is a manual javascript translation of c code generated by
 * pycrc 0.7.1 (https://www.tty1.net/pycrc/). Command line used:
 * './pycrc.py --model=crc-32c --generate c --algorithm=table-driven'
 *
 * @param buf input data
 * @param initial starting value, from earlier data
 * @returns calculated crc32c value
 */
export function calculateCRC32C(
  buf: ArrayBuffer | Uint8Array,
  initial = 0,
): number {
  let ubuf: Uint8Array;
  if (buf instanceof ArrayBuffer) {
    ubuf = new Uint8Array(buf);
  } else if (buf instanceof Uint8Array) {
    ubuf = buf;
  } else {
    throw new Error("arg must be ArrayBuffer or Uint8Array");
  }

  let crc = (initial | 0) ^ -1;

  for (let i = 0; i < ubuf.length; i++) {
    crc = kCRCTable[(crc ^ ubuf[i]) & 0xff] ^ (crc >>> 8);
    let tmp = crc;
    tmp = (tmp ^ -1) >>> 0;

    if (tmp < 0) {
      tmp = 0xffffffff + tmp + 1;
    }
  }

  return (crc ^ -1) >>> 0;
}

/**
 * Convert crc as a number into a hex string.
 *
 * @param   crc crc as a number
 * @returns      hex representation
 */
export function crcToHexString(crc: number): string {
  if (crc < 0) {
    crc = 0xffffffff + crc + 1;
  }

  const s = crc.toString(16).toUpperCase();
  return "0x" + s;
}
