// @flow

/*global DataView*/
/**
 * Philip Crotwell
 * University of South Carolina, 2017
 * http://www.seis.sc.edu
 */

import * as seedcodec from './seedcodec';
import {Seismogram} from './seismogram';


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
    this.decompData = undefined;
    this.rawData = null;
    this.rawExtraHeaders = null;
    if ( ! dataView) {
      // empty record
      this.header = new XSeedHeader();
      return;
    }
    this.header = new XSeedHeader(dataView);
    let extraDataView = new DataView(dataView.buffer,
                             dataView.byteOffset+this.header.getSize(),
                             this.header.extraHeadersLength);
    this.rawExtraHeaders = makeString(dataView,
        dataView.byteOffset+this.header.getSize(),
        this.header.extraHeadersLength);
    this.extraHeaders = parseExtraHeaders(extraDataView);
    console.log(`extraHeader size before= ${this.header.extraHeadersLength} after=${JSON.stringify(this.extraHeaders).length}`);
    let sliceStart = dataView.byteOffset+this.header.getSize()+this.header.extraHeadersLength;
    this.rawData = new DataView(dataView.buffer.slice(sliceStart, sliceStart+ this.header.dataLength));
    this.decompData = undefined;
    this.length = this.header.numSamples;
  }
  getSize() {
    let json = JSON.stringify(this.extraHeaders);
    if (json.length > 2) {
      if (this.header.extraHeadersLength !== json.length) {
        console.log(`recalc header length: ${this.header.extraHeadersLength}  ${json.length}`);
        console.log(this.origExtraHeaders);
        console.log(json);
      }
      this.header.extraHeadersLength = json.length;
    } else {
      this.header.extraHeadersLength = 0;
    }
    return this.header.getSize()+this.header.extraHeadersLength+this.header.dataLength;
  }
  decompress() {
    // only decompress once as it is expensive operation
    if ( typeof this.decompData === 'undefined') {
      this.decompData = seedcodec.decompress(this.header.encoding, this.rawData, this.header.numSamples, this.header.littleEndian);
      this.decompData.header = this.header;
    }
    return this.decompData;
  }
  get data() {
    if ( typeof this.decompData === 'undefined') {
      this.decompress();
    }
    return this.decompData;
  }
  codes() {
      return this.identifier;
//    return this.header.netCode+"."+this.header.staCode+"."+this.header.locCode+"."+this.header.chanCode;
  }
  save(dataView) {
    let json = JSON.stringify(this.extraHeaders);
    if (json.length > 2) {
      this.header.extraHeadersLength = json.length;
    } else {
      this.header.extraHeadersLength = 0;
    }
    // don't write crc as we need to recalculate
    let offset = this.header.save(dataView, 0, true);
    if (json.length > 2) {
      for (let i=0; i<json.length; i++) {
        // not ok for unicode?
        dataView.setInt8(offset, json.charCodeAt(i));
        offset++;
      }
    }
    for (let i=0; i< this.rawData.byteLength; i++) {
      dataView.setUint8(offset+i, this.rawData.getUint8(i));
    }
    offset += this.rawData.byteLength;
// CRC not yet working

    let dvcrc = dataView.getUint32(CRC_OFFSET, true);
    if (dvcrc != 0) {
      throw new Error(`CRC is not zero before calculate! ${dvcrc}`);
    }
    let crc = calculateCRC32C(dataView.buffer);
    console.log("CRC32C calc: "+'0x'+crc.toString(16).toUpperCase()+"  size="+this.getSize());
    dataView.setUint32(CRC_OFFSET, crc, true);
    return offset;
  }

  calcCrc() {
    let size = this.getSize();
    let buff = new ArrayBuffer(this.getSize());
    let dataView = new DataView(buff);
    let offset = this.save(dataView);
    if (offset !== size) {
      throw new Error(`expect to write ${size} bytes but only ${offset}`);
    }
    console.log(`calcCrc offset=${offset}  size=${size}`);
    let crc = dataView.getUint32(CRC_OFFSET, true);
    return crc;
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
  save(dataView, offset=0, zeroCrc=false) {
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
    if (zeroCrc) {
      dataView.setUint32(offset, 0, true);
    } else {
      dataView.setUint32(offset, this.crc, true);
    }
    offset += 4;
    dataView.setInt8(offset, this.publicationVersion);
    offset++;
    dataView.setInt8(offset, this.identifier.length);
    offset++;
    dataView.setUint16(offset, this.extraHeadersLength, true);
    offset += 2;
    dataView.setUint32(offset, this.dataLength, true);
    offset+=4;
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


export function makeString(dataView, offset, length) {
  const utf8decoder = new TextDecoder('utf-8');
  let u8arr = new Uint8Array(dataView.buffer, dataView.byteOffset+offset, length);
  return utf8decoder.decode(u8arr).trim();
  // for (let i=offset; i<offset+length; i++) {
  //   let charCode = dataView.getUint8(i);
  //   if (charCode > 31) {
  //     out += String.fromCharCode(charCode);
  //     dbg += ' '+charCode;
  //   }
  // }
  // return out.trim();
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
  let out = new Seismogram(y,
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

/**
 * Copy from https://github.com/ashi009/node-fast-crc32c/blob/master/impls/js_crc32c.js
 * and modify to use ArrayBuffer.
 *
 * This code is a manual javascript translation of c code generated by
 * pycrc 0.7.1 (http://www.tty1.net/pycrc/). Command line used:
 * './pycrc.py --model=crc-32c --generate c --algorithm=table-driven'
 */

const kCRCTable = new Int32Array([
  0x00000000, 0xf26b8303, 0xe13b70f7, 0x1350f3f4,
  0xc79a971f, 0x35f1141c, 0x26a1e7e8, 0xd4ca64eb,
  0x8ad958cf, 0x78b2dbcc, 0x6be22838, 0x9989ab3b,
  0x4d43cfd0, 0xbf284cd3, 0xac78bf27, 0x5e133c24,
  0x105ec76f, 0xe235446c, 0xf165b798, 0x030e349b,
  0xd7c45070, 0x25afd373, 0x36ff2087, 0xc494a384,
  0x9a879fa0, 0x68ec1ca3, 0x7bbcef57, 0x89d76c54,
  0x5d1d08bf, 0xaf768bbc, 0xbc267848, 0x4e4dfb4b,
  0x20bd8ede, 0xd2d60ddd, 0xc186fe29, 0x33ed7d2a,
  0xe72719c1, 0x154c9ac2, 0x061c6936, 0xf477ea35,
  0xaa64d611, 0x580f5512, 0x4b5fa6e6, 0xb93425e5,
  0x6dfe410e, 0x9f95c20d, 0x8cc531f9, 0x7eaeb2fa,
  0x30e349b1, 0xc288cab2, 0xd1d83946, 0x23b3ba45,
  0xf779deae, 0x05125dad, 0x1642ae59, 0xe4292d5a,
  0xba3a117e, 0x4851927d, 0x5b016189, 0xa96ae28a,
  0x7da08661, 0x8fcb0562, 0x9c9bf696, 0x6ef07595,
  0x417b1dbc, 0xb3109ebf, 0xa0406d4b, 0x522bee48,
  0x86e18aa3, 0x748a09a0, 0x67dafa54, 0x95b17957,
  0xcba24573, 0x39c9c670, 0x2a993584, 0xd8f2b687,
  0x0c38d26c, 0xfe53516f, 0xed03a29b, 0x1f682198,
  0x5125dad3, 0xa34e59d0, 0xb01eaa24, 0x42752927,
  0x96bf4dcc, 0x64d4cecf, 0x77843d3b, 0x85efbe38,
  0xdbfc821c, 0x2997011f, 0x3ac7f2eb, 0xc8ac71e8,
  0x1c661503, 0xee0d9600, 0xfd5d65f4, 0x0f36e6f7,
  0x61c69362, 0x93ad1061, 0x80fde395, 0x72966096,
  0xa65c047d, 0x5437877e, 0x4767748a, 0xb50cf789,
  0xeb1fcbad, 0x197448ae, 0x0a24bb5a, 0xf84f3859,
  0x2c855cb2, 0xdeeedfb1, 0xcdbe2c45, 0x3fd5af46,
  0x7198540d, 0x83f3d70e, 0x90a324fa, 0x62c8a7f9,
  0xb602c312, 0x44694011, 0x5739b3e5, 0xa55230e6,
  0xfb410cc2, 0x092a8fc1, 0x1a7a7c35, 0xe811ff36,
  0x3cdb9bdd, 0xceb018de, 0xdde0eb2a, 0x2f8b6829,
  0x82f63b78, 0x709db87b, 0x63cd4b8f, 0x91a6c88c,
  0x456cac67, 0xb7072f64, 0xa457dc90, 0x563c5f93,
  0x082f63b7, 0xfa44e0b4, 0xe9141340, 0x1b7f9043,
  0xcfb5f4a8, 0x3dde77ab, 0x2e8e845f, 0xdce5075c,
  0x92a8fc17, 0x60c37f14, 0x73938ce0, 0x81f80fe3,
  0x55326b08, 0xa759e80b, 0xb4091bff, 0x466298fc,
  0x1871a4d8, 0xea1a27db, 0xf94ad42f, 0x0b21572c,
  0xdfeb33c7, 0x2d80b0c4, 0x3ed04330, 0xccbbc033,
  0xa24bb5a6, 0x502036a5, 0x4370c551, 0xb11b4652,
  0x65d122b9, 0x97baa1ba, 0x84ea524e, 0x7681d14d,
  0x2892ed69, 0xdaf96e6a, 0xc9a99d9e, 0x3bc21e9d,
  0xef087a76, 0x1d63f975, 0x0e330a81, 0xfc588982,
  0xb21572c9, 0x407ef1ca, 0x532e023e, 0xa145813d,
  0x758fe5d6, 0x87e466d5, 0x94b49521, 0x66df1622,
  0x38cc2a06, 0xcaa7a905, 0xd9f75af1, 0x2b9cd9f2,
  0xff56bd19, 0x0d3d3e1a, 0x1e6dcdee, 0xec064eed,
  0xc38d26c4, 0x31e6a5c7, 0x22b65633, 0xd0ddd530,
  0x0417b1db, 0xf67c32d8, 0xe52cc12c, 0x1747422f,
  0x49547e0b, 0xbb3ffd08, 0xa86f0efc, 0x5a048dff,
  0x8ecee914, 0x7ca56a17, 0x6ff599e3, 0x9d9e1ae0,
  0xd3d3e1ab, 0x21b862a8, 0x32e8915c, 0xc083125f,
  0x144976b4, 0xe622f5b7, 0xf5720643, 0x07198540,
  0x590ab964, 0xab613a67, 0xb831c993, 0x4a5a4a90,
  0x9e902e7b, 0x6cfbad78, 0x7fab5e8c, 0x8dc0dd8f,
  0xe330a81a, 0x115b2b19, 0x020bd8ed, 0xf0605bee,
  0x24aa3f05, 0xd6c1bc06, 0xc5914ff2, 0x37faccf1,
  0x69e9f0d5, 0x9b8273d6, 0x88d28022, 0x7ab90321,
  0xae7367ca, 0x5c18e4c9, 0x4f48173d, 0xbd23943e,
  0xf36e6f75, 0x0105ec76, 0x12551f82, 0xe03e9c81,
  0x34f4f86a, 0xc69f7b69, 0xd5cf889d, 0x27a40b9e,
  0x79b737ba, 0x8bdcb4b9, 0x988c474d, 0x6ae7c44e,
  0xbe2da0a5, 0x4c4623a6, 0x5f16d052, 0xad7d5351
]);

/**
 * Copy from https://github.com/ashi009/node-fast-crc32c/blob/master/impls/js_crc32c.js
 * and modify to use ArrayBuffer. Rename calculateCRC32C
 *
 * This code is a manual javascript translation of c code generated by
 * pycrc 0.7.1 (http://www.tty1.net/pycrc/). Command line used:
 * './pycrc.py --model=crc-32c --generate c --algorithm=table-driven'
 */

export function calculateCRC32C(buf, initial) {
  if ( buf instanceof ArrayBuffer){
    buf = new Uint8Array(buf);
  } else if ( buf instanceof Uint8Array) {
    // ok
  } else {
    throw new Error("arg must be ArrayBuffer or Uint8Array");
  }
  let crc = (initial | 0) ^ -1;
  for (let i = 0; i < buf.length; i++){
    crc = kCRCTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    let tmp = crc;
    tmp = (tmp ^ -1) >>> 0;
    if (tmp < 0) {
      tmp = 0xFFFFFFFF + tmp + 1;
    }
  }
  return (crc ^ -1) >>> 0;
}

export function crcToHexString(crc) {
  if (crc < 0) {
    crc = 0xFFFFFFFF + crc + 1;
  }
  let s = crc.toString(16).toUpperCase();
  return "0x"+s;
}
