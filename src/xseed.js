// @flow

/*global DataView*/
/**
 * Philip Crotwell
 * University of South Carolina, 2017
 * http://www.seis.sc.edu
 */

import * as seedcodec from './seedcodec';
import {Seismogram} from './seismogram';
import * as CRC32 from 'crc-32';


export const UNKNOWN_DATA_VERSION = 0;
export const CRC_OFFSET = 28;
export const FIXED_HEADER_SIZE=40;
export const FDSN_PREFIX = 'FDSN';

/** parse arrayBuffer into an array of XSeedRecords. */
export function parseXSeedRecords(arrayBuffer: ArrayBuffer) {
  let dataRecords = [];
  let offset = 0;
  while (offset < arrayBuffer.byteLength) {
    let dataView = new DataView(arrayBuffer, offset);
    if (! (dataView.getUint8(0) === 77 && dataView.getUint8(1) === 83)) {
      throw new Error(`First byte must be M=77 S=83 at offset=${offset}, but was ${dataView.getUint8(0)} ${dataView.getUint8(1)}`);
    }
    let dr = new XSeedRecord(dataView);
    dataRecords.push(dr);
    offset += dr.getSize();
  }
  return dataRecords;
}

/** Represents a xSEED Data Record, with header, extras and data.
  */
export class XSeedRecord {
  constructor(dataView: DataView) {
    if ( ! dataView) {
      // empty record
      this.header = new XSeedHeader();
      return;
    }
    this.header = new XSeedHeader(dataView);
    let extraDataView = new DataView(dataView.buffer,
                             dataView.byteOffset+this.header.getSize(),
                             this.header.extraHeadersLength);
    this.extraHeaders = parseExtraHeaders(extraDataView);
    this.data = new DataView(dataView.buffer,
                             dataView.byteOffset+this.header.getSize(),
                             this.header.dataLength);
    this.decompData = undefined;
    this.length = this.header.numSamples;
    }
  getSize() {
    return this.header.getSize()+this.header.extraHeadersLength+this.header.dataLength;
  }
  decompress() {
    // only decompress once as it is expensive operation
    if ( typeof this.decompData === 'undefined') {
      this.decompData = seedcodec.decompress(this.header.encoding, this.data, this.header.numSamples, this.header.littleEndian);
      this.decompData.header = this.header;
    }
    return this.decompData;
  }

  codes() {
      return this.identifier;
//    return this.header.netCode+"."+this.header.staCode+"."+this.header.locCode+"."+this.header.chanCode;
  }
  save(dataView) {
    let json = JSON.stringify(this.extraHeaders);
    this.header.extraHeadersLength = json.length;
    let offset = this.header.save(dataView);

    for (let i=0; i<json.length; i++) {
// not ok for unicode?
      dataView.setInt8(offset, json.charCodeAt(i));
      offset++;
    }
    for (let i=0; i< this.data.byteLength; i++) {
      dataView.setUint8(offset+i, this.data.getInt8(i));
    }
    offset += this.data.byteLength;
// CRC not yet working
    let crc = CRC32.buf(new Uint8Array(dataView.buffer, 0, offset));
console.log("CRC32: "+crc);
    dataView.setUint32(CRC_OFFSET, crc, true);
    return offset;
  }
}

export class XSeedHeader {

  constructor(dataView) {
    if ( !dataView) {
      // empty construction
      this.recordIndicator = 'MS';
      this.formatVersion = 3;
      this.flags = 0;
      this.nanosecond=0;
      this.year = 1970;
      this.dayOfYear=1;
      this.hour=0;
      this.minute=0;
      this.second=0;
      this.encoding = 3; // 32 bit ints
      this.sampleRatePeriod = 1;
      this.numSamples = 0;
      this.crc = 0;
      this.publicationVersion = UNKNOWN_DATA_VERSION;
      this.identifierLength = 0;
      this.extraHeadersLength = 2;
      this.identifier = "";
      this.extraHeaders = {};
      this.dataLength = 0;
      return;
    }
    this.recordIndicator = makeString(dataView, 0,2);
    if ( ! this.recordIndicator === 'MS') {
      throw new Error("First 2 bytes of record should be MS but found "+this.recordIndicator);
    }
    this.formatVersion = dataView.getUint8(2);
    if (this.formatVersion != 3) {
      throw new Error("Format Version should be 3, "+this.formatVersion);
    }
    this.flags = dataView.getUint8(3);
    const headerLittleEndian = true;
    this.nanosecond = dataView.getInt32(4, headerLittleEndian);
    this.year = dataView.getInt16(8, headerLittleEndian);
    if (checkByteSwap(this.year)) {
      throw new Error("Looks like wrong byte order, year="+this.year);
    }
    this.dayOfYear = dataView.getInt16(10, headerLittleEndian);
    this.hour = dataView.getUint8(12);
    this.minute = dataView.getUint8(13);
    this.second = dataView.getUint8(14);
    this.encoding = dataView.getUint8(15);
    this.sampleRatePeriod = dataView.getFloat64(16, headerLittleEndian);
    if (this.sampleRatePeriod < 0) {
      this.sampleRate = 1 / this.sampleRatePeriod;
    } else {
      this.sampleRate = this.sampleRatePeriod;
    }
    this.numSamples = dataView.getUint32(24, headerLittleEndian);
    this.crc = dataView.getUint32(28, headerLittleEndian);
    this.publicationVersion = dataView.getUint8(32);
    this.identifierLength = dataView.getUint8(33);
    this.extraHeadersLength = dataView.getUint16(34, headerLittleEndian);
    this.dataLength = dataView.getUint32(36, headerLittleEndian);
    this.identifier = makeString(dataView, 40, this.identifierLength);
    // lazily extract json and data

    this.start = new Date(Date.UTC(this.year, 0, this.dayOfYear, this.hour, this.minute, this.second, Math.round(this.nanosecond / 1000000)));
    this.end = this.timeOfSample(this.numSamples-1);
  }
  getSize() {
    return FIXED_HEADER_SIZE+this.identifierLength;
  }
  toString() {
    return this.identifier+" "+this.start.toISOString()+" "+this.encoding;
  }
  getStartFieldsAsISO() {
    return ''+this.year+'-'+padZeros(this.dayOfYear, 3)
      +'T'+padZeros(this.hour, 2)+':'+padZeros(this.minute, 2)+":"
      +padZeros(this.second, 2)+"."+padZeros(this.nanosecond, 9)+"Z";
  }

  timeOfSample(i) {
    return new Date(this.start.getTime() + 1000*i/this.sampleRate);
  }
  save(dataView, offset=0) {
    dataView.setInt8(offset, this.recordIndicator.charCodeAt(0));
    offset++;
    dataView.setInt8(offset, this.recordIndicator.charCodeAt(1));
    offset++;
    dataView.setInt8(offset, this.formatVersion);
    offset++;
    dataView.setInt8(offset, this.flags);
    offset++;
    dataView.setUint32(offset, this.nanosecond, true);
    offset+=4;
    dataView.setUint16(offset, this.year, true);
    offset+=2;
    dataView.setUint16(offset, this.dayOfYear, true);
    offset+=2;
    dataView.setInt8(offset, this.hour);
    offset++;
    dataView.setInt8(offset, this.minute);
    offset++;
    dataView.setInt8(offset, this.second);
    offset++;
    dataView.setInt8(offset, this.encoding);
    offset++;
    dataView.setFloat64(offset, this.sampleRatePeriod, true);
    offset+=8;
    dataView.setUint32(offset, this.numSamples, true);
    offset += 4;
    dataView.setUint32(offset, this.crc, true);
    offset += 4;
    dataView.setInt8(offset, this.publicationVersion);
    offset++;
    dataView.setInt8(offset, this.identifier.length);
    offset++;
    dataView.setUint16(offset, this.extraHeadersLength, true);
    offset += 2;
    dataView.setUint16(offset, this.dataLength, true);
    offset+=2;
    for (let i=0; i<this.identifier.length; i++) {
// not ok for unicode?
      dataView.setInt8(offset, this.identifier.charCodeAt(i));
      offset++;
    }

    return offset;
  }
}

export function parseExtraHeaders(dataView) {
  if (dataView.byteLength === 0) {
    return {};
  }
  let firstChar = dataView.getUint8(0);
  if (firstChar === 123) {
    // looks like json, '{' is ascii 123
    return JSON.parse(makeString(dataView, 0, dataView.byteLength));
  } else {
    throw new Error("do not understand extras with first char val: "+firstChar+" "+(firstChar===123));
  }
}

export function padZeros(val, len) {
  let out = ""+val;
  while (out.length < len) {
    out = "0"+out;
  }
  return out;
}

function makeString(dataView, offset, length) {
  let out = "";
  let dbg = `dataview ${offset} ${length}: `;
  for (let i=offset; i<offset+length; i++) {
    let charCode = dataView.getUint8(i);
    if (charCode > 31) {
      out += String.fromCharCode(charCode);
      dbg += ' '+charCode;
    }
  }
  return out.trim();
}



function checkByteSwap(year) {
  return year < 1960 || year > 2055;
}

export function areContiguous(dr1, dr2) {
    let h1 = dr1.header;
    let h2 = dr2.header;
    return h1.end.getTime() < h2.start.getTime()
        && h1.end.getTime() + 1000*1.5/h1.sampleRate > h2.start.getTime();
}

/** concatentates a sequence of XSeedRecords into a single seismogram object.
  * Assumes that they are all contiguous and in order. Header values from the first
  * XSeedRecord are used. */
export function createSeismogram(contig) {
  let y = [];
  for (let i=0; i<contig.length; i++) {
    y = y.concat(contig[i].decompress());
  }
  let out = new model.Seismogram(y,
                                 contig[0].header.sampleRate,
                                 contig[0].header.start);
  out.netCode(contig[0].header.netCode)
    .staCode(contig[0].header.staCode)
    .locId(contig[0].header.locCode)
    .chanCode(contig[0].header.chanCode);

  return out;
}


/**
 * Merges data records into a arrary of seismogram segment objects
 * containing the data as a float array, y. Each seismogram has
 * sampleRate, start, end, netCode, staCode, locCode, chanCode as well
 * as the function timeOfSample(integer) set.
 * This assumes all data records are from the same channel, byChannel
 * can be used first if multiple channels may be present.
 */
export function merge(drList) {
  let out = [];
  let currDR;
  drList.sort(function(a,b) {
      return a.header.start.getTime() - b.header.start.getTime();
  });
  let contig = [];
  for (let i=0; i<drList.length; i++) {
    currDR = drList[i];
    if ( contig.length == 0 ) {
      contig.push(currDR);
    } else if (areContiguous(contig[contig.length-1], currDR)) {
      contig.push(currDR);
    } else {
      //found a gap
      out.push(createSeismogram(contig));
      contig = [ currDR ];
    }
  }
  if (contig.length > 0) {
      // last segment
      out.push(createSeismogram(contig));
      contig = [];
  }
  return out;
}


export function segmentMinMax(segment, minMaxAccumulator) {
if ( ! segment.y()) {
throw new Error("Segment does not have a y field, doesn't look like a seismogram segment. "+Array.isArray(segment)+" "+segment);
}
  let minAmp = Number.MAX_SAFE_INTEGER;
  let maxAmp = -1 * (minAmp);
  if ( minMaxAccumulator) {
    minAmp = minMaxAccumulator[0];
    maxAmp = minMaxAccumulator[1];
  }
  for (let n = 0; n < segment.y().length; n++) {
    if (minAmp > segment.y()[n]) {
      minAmp = segment.y()[n];
    }
    if (maxAmp < segment.y()[n]) {
      maxAmp = segment.y()[n];
    }
  }
  return [ minAmp, maxAmp ];
}

/** splits a list of data records by channel code, returning an object
  * with each NSLC mapped to an array of data records. */
export function byChannel(drList) {
  let out = {};
  let key;
  for (let i=0; i<drList.length; i++) {
    let currDR = drList[i];
    key = currDR.codes();
    if (! out[key]) {
      out[key] = [currDR];
    } else {
      out[key].push(currDR);
    }
  }
  return out;
}

/* MSeed2 to xSeed converstion */

export function convertMS2toXSeed(mseed2) {
  let out = [];
  for (let i=0; i< mseed2.length; i++) {
    out.push(convertMS2Record(mseed2[i]));
  }
  return out;
}

export function convertMS2Record(ms2record) {
  let xHeader = new XSeedHeader();
  let xExtras = {};
  let ms2H = ms2record.header;
  xHeader.flags = (ms2H.activityFlags & 1) *2
     + (ms2H.ioClockFlags & 64 ) * 4
     + (ms2H.dataQualityFlags & 16) * 8;
  xHeader.year = ms2H.startBTime.year;
  xHeader.dayOfYear = ms2H.startBTime.jday;
  xHeader.hour = ms2H.startBTime.hour;
  xHeader.minute = ms2H.startBTime.min;
  xHeader.second = ms2H.startBTime.sec;
  xHeader.nanosecond = ms2H.startBTime.tenthMilli*100000+ms2H.startBTime.microsecond*1000;
  xHeader.sampleRatePeriod = ms2H.sampleRate >= 1 ? ms2H.sampleRate : (-1.0 / ms2H.sampleRate);
  xHeader.encoding = ms2record.header.encoding;
  xHeader.publicationVersion = UNKNOWN_DATA_VERSION;
  xHeader.dataLength = ms2record.data.byteLength;
  xHeader.identifier = FDSN_PREFIX + ':' +ms2H.netCode + SEP + ms2H.staCode + SEP + ( ms2H.locCode ? ms2H.locCode : "" ) + SEP + ms2H.chanCode;
  xHeader.identifierLength = xHeader.identifier.length;

  xHeader.numSamples = ms2H.numSamples;
  xHeader.crc = 0;
  if (ms2H.typeCode) {
    if (ms2H.typeCode === 'R') {
      xHeader.publicationVersion = 1;
    } else if (ms2H.typeCode === 'D') {
      xHeader.publicationVersion = 2;
    } else if (ms2H.typeCode === 'Q') {
      xHeader.publicationVersion = 3;
    } else if (ms2H.typeCode === 'M') {
      xHeader.publicationVersion = 4;
    }
    if (ms2H.typeCode !== 'D') {
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
          xHeader.dayOfYear =- 1;
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
  let out = new XSeedRecord();
  out.header = xHeader;
  out.extraHeaders = xExtras;
  // need to convert if not steim1 or 2
  out.data = ms2record.data;
  return out;
}

const SEP = '_';
