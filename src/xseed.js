/*global DataView*/
/**
 * Philip Crotwell
 * University of South Carolina, 2017
 * http://www.seis.sc.edu
 */

import * as seedcodec from 'seisplotjs-seedcodec';
import * as model from 'seisplotjs-model';
//import * as CBOR from 'cbor.js';
import * as CRC from 'crc-32';

/* re-export */
export { seedcodec, model };

export const UNKNOWN_DATA_VERSION = 0;
export const CRC_OFFSET = 29;
export const FIXED_HEADER_SIZE=38;
export const FDSN_PREFIX = 'FDSN';

/** parse arrayBuffer into an array of DataRecords. */
export function parseDataRecords(arrayBuffer) {
  let dataRecords = [];
  let offset = 0;
  while (offset < arrayBuffer.byteLength) {
    let dataView = new DataView(arrayBuffer, offset);
    let dr = new DataRecord(dataView);
    dataRecords.push(dr);
    offset += dr.getRecordSize();
  }
  return dataRecords;
}

/** Represents a SEED Data Record, with header, extras and data. 
  */
export class DataRecord {
  constructor(dataView) {
    if ( ! dataView) {
      // empty record
      this.header = new DataHeader();
      return;
    }
    this.header = new DataHeader(dataView);
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
    let crc = CRC.buf(new Uint8Array(dataView.buffer, dataView.offset, dataView.offset+offset));
console.log("CRC: "+crc);
    dataView.setUint32(CRC_OFFSET, crc, true);
    return offset;
  }
}

export class DataHeader {

  constructor(dataView) {
    if ( !dataView) {
      // empty construction
      this.recordIndicator = 'MS';
      this.formatVersion = 3;
      this.flags = 0;
      this.year = 1970;
      this.dayOfYear=1;
      this.hour=0;
      this.minute=0;
      this.second=0;
      this.nanosecond=0;
      this.sampleRatePeriod = 1;
      this.encoding = 3; // 32 bit ints
      this.publicationVersion = UNKNOWN_DATA_VERSION;
      this.numSamples = 0;
      this.crc = 0;
      this.identifierLength = 0;
      this.identifier = "";
      this.extraHeadersLength = 2;
      this.dataLength = 0;
      return;
    }
    this.recordIndicator = makeString(dataView, 0,2);
    if (this.recordIndicator != 'MS') {
      throw new Error("First 2 bytes of record should be MS but found "+this.recordIndicator);
    }
    this.formatVersion = dataView.getUint8(2);
    this.flags = dataView.getUint8(3);
    const headerLittleEndian = true;
    this.year = dataView.getInt16(4, headerLittleEndian);
    if (checkByteSwap(this.year)) {
      throw new Error("Looks like wrong byte order, year="+this.year);
    }
    this.dayOfYear = dataView.getInt16(6, headerLittleEndian);
    this.hour = dataView.getUint8(8);
    this.minute = dataView.getUint8(9);
    this.second = dataView.getUint8(10);
    this.nanosecond = dataView.getInt32(11, headerLittleEndian);
    this.sampleRatePeriod = dataView.getFloat64(15, headerLittleEndian);
    if (this.sampleRatePeriod < 0) {
      this.sampleRate = 1 / this.sampleRatePeriod;
    } else {
      this.sampleRate = this.sampleRatePeriod;
    }
    this.encoding = dataView.getUint8(23);
    this.publicationVersion = dataView.getUint8(24);
    this.numSamples = dataView.getUint32(25, headerLittleEndian);
    this.crc = dataView.getUint32(29, headerLittleEndian);
    this.identifierLength = dataView.getUint8(33);
    this.extraHeadersLength = dataView.getUint16(34, headerLittleEndian);
    this.dataLength = dataView.getUint16(36, headerLittleEndian);
    this.identifier = makeString(dataView, 38, this.identifierLength);


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
    return ''+this.year+padZeros(this.dayOfYear, 3)
      +'T'+padZeros(this.hour, 2)+padZeros(this.minute, 2)
      +padZeros(this.second, 2)+"."+padZeros(this.nanosecond, 9);
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
    dataView.setUint32(offset, this.nanosecond, true);
    offset+=4;
    dataView.setFloat64(offset, this.sampleRatePeriod, true);
    offset+=8;
    dataView.setInt8(offset, this.encoding);
    offset++;
    dataView.setInt8(offset, this.publicationVersion);
    offset++;
    dataView.setUint32(offset, this.numSamples, true);
    offset += 4;
    dataView.setUint32(offset, this.crc, true);
    offset += 4;
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
  let firstChar = dataView.getUint8(0);
  if (firstChar == 123) {
    // looks like json, '{' is ascii 123 
    return JSON.parse(makeString(dataView, 0, dataView.byteLength));
  } else if (firstChar & (7 << 5) === ( 5 << 5 )) {
    // looks like cbor, first 3 bits are binary 5, ie 101
//    return CBOR.decode(dataView.buffer.slice(dataView.offset, dataView.offset+this.extraHeaders.length));
    throw new Error("cbor not yet impl");
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
  for (let i=offset; i<offset+length; i++) {
    let charCode = dataView.getUint8(i);
    if (charCode > 31) {
      out += String.fromCharCode(charCode);
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

/** concatentates a sequence of DataRecords into a single seismogram object.
  * Assumes that they are all contiguous and in order. Header values from the first
  * DataRecord are used. */
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

/* MSeed2 to MSeed3 converstion */

export function convertMS2toMS3(mseed2) {
  let out = [];
  for (let i=0; i< mseed2.length; i++) {
    out.push(convertMS2Record(mseed2[i]));
  }
  return out;
}

export function convertMS2Record(ms2record) {
  let ms3Header = new DataHeader();
  let ms3Extras = {};
  let ms2H = ms2record.header;
  ms3Header.flags = (ms2H.activityFlags & 1) *2
     + (ms2H.ioClockFlags & 64 ) * 4
     + (ms2H.dataQualityFlags & 16) * 8;
  ms3Header.year = ms2H.startBTime.year;
  ms3Header.dayOfYear = ms2H.startBTime.jday;
  ms3Header.hour = ms2H.startBTime.hour;
  ms3Header.minute = ms2H.startBTime.min;
  ms3Header.second = ms2H.startBTime.sec;
  ms3Header.nanosecond = ms2H.startBTime.tenthMilli*100000;
// maybe can do better from factor and multiplier?
  ms3Header.sampleRatePeriod = ms2H.sampleRate >= 1 ? ms2H.sampleRate : (-1.0 / ms2H.sampleRate);  
  ms3Header.encoding = ms2record.header.encoding;
  ms3Header.publicationVersion = UNKNOWN_DATA_VERSION;
  ms3Header.dataLength = ms2record.data.byteLength;
  ms3Header.identifier = FDSN_PREFIX + ':' +ms2H.netCode + '.' + ms2H.staCode + '.' + ( ms2H.locCode ? (ms2H.locCode+':') : "" ) + ms2H.chanCode;
  ms3Header.identifierLength = ms3Header.identifier.length;

  ms3Header.numSamples = ms2H.numSamples;
  ms3Header.crc = 0;
  if (ms2H.typeCode && ms2H.typeCode != 'D') {
    ms3Extras.QI = ms2H.typeCode;
  }
  let nanos = 0;
  for (let i=0; i<ms2H.blocketteList.length; i++) {
    let blockette = ms2H.blocketteList[i];
    if (blockette.type === 100) {
      ms3Header.sampleRatePeriod = blockette.body.getFloat32(4);
    } else if (blockette.type === 1001) {
      nanos = 1000 * blockette.body.getInt8(6);
      ms3Extras.TQ = blockette.body.getUint8(4);
    }
  }
  ms3Header.nanosecond += nanos;
  if (ms3Header.nanosecond < 0) {
    ms3Header.second -= 1;
    ms3Header.nanosecond += 1000000000;
    if (ms3Header.second < 0) {
// might be wrong for leap seconds
      ms3Header.second += 60;
      ms3Header.minute -= 1;
      if (ms3Header.minute < 0) {
        ms3Header.minute += 60;
        ms3Header.hour -= 1;
        if (ms3Header.hour < 0) {
          ms3Header.hour += 24;
          ms3Header.dayOfYear =- 1;
          if (ms3Header.dayOfYear < 0) {
// wrong for leap years
            ms3Header.dayOfYear += 365;
            ms3Header.year -= 1;
          }
        }
      }
    }
  }
  ms3Header.extraHeadersLength = JSON.stringify(ms3Extras).length;
  let out = new DataRecord();
  out.header = ms3Header;
  out.extraHeaders = ms3Extras;
  // need to convert if not steim1 or 2
  out.data = ms2record.data;
  return out;
}
