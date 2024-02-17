// reference data is included in mseed3 repo:
// git clone https://github.com/iris-edu/miniSEED3.git
// cp -r miniSEED3/reference-data test/mseed3/.

import { TextDecoder } from 'util';
// @ts-expect-error browser and node TextDecoder are somehow different???
global.TextDecoder = TextDecoder;


import { isDef } from '../../src/util';
import * as mseed3 from '../../src/mseed3';
import * as miniseed from '../../src/miniseed';
import fs from 'fs';

const fileList = [
  'test/mseed3/reference-data/reference-detectiononly.mseed3',
  'test/mseed3/reference-data/reference-sinusoid-FDSN-All.mseed3',
  'test/mseed3/reference-data/reference-sinusoid-FDSN-Other.mseed3',
  'test/mseed3/reference-data/reference-sinusoid-TQ-TC-ED.mseed3',
  'test/mseed3/reference-data/reference-sinusoid-float32.mseed3',
  'test/mseed3/reference-data/reference-sinusoid-float64.mseed3',
  'test/mseed3/reference-data/reference-sinusoid-int16.mseed3',
  'test/mseed3/reference-data/reference-sinusoid-int32.mseed3',
  'test/mseed3/reference-data/reference-sinusoid-steim1.mseed3',
  'test/mseed3/reference-data/reference-sinusoid-steim2.mseed3',
  'test/mseed3/reference-data/reference-text.mseed3',
];

const fileSizeMap = new Map();
fileSizeMap.set('test/mseed3/reference-data/reference-detectiononly.mseed3',328);
fileSizeMap.set('test/mseed3/reference-data/reference-sinusoid-FDSN-All.mseed3',4432);
fileSizeMap.set('test/mseed3/reference-data/reference-sinusoid-FDSN-Other.mseed3',1788);
fileSizeMap.set('test/mseed3/reference-data/reference-sinusoid-TQ-TC-ED.mseed3',1957);
fileSizeMap.set('test/mseed3/reference-data/reference-sinusoid-float32.mseed3',2059);
fileSizeMap.set('test/mseed3/reference-data/reference-sinusoid-float64.mseed3',4059);
fileSizeMap.set('test/mseed3/reference-data/reference-sinusoid-int16.mseed3',499);
fileSizeMap.set('test/mseed3/reference-data/reference-sinusoid-int32.mseed3',2059);
fileSizeMap.set('test/mseed3/reference-data/reference-sinusoid-steim1.mseed3',1595);
fileSizeMap.set('test/mseed3/reference-data/reference-sinusoid-steim2.mseed3',1595);
fileSizeMap.set('test/mseed3/reference-data/reference-text.mseed3',294);

//  fileList = fileList.slice(2,3);

for (const filename of fileList) {
  test("ref mseed3 file vs json"+filename, () => {

    expect(fs.existsSync(filename)).toEqual(true);
    const xData = fs.readFileSync(filename);
    expect(xData.length).toEqual(fileSizeMap.get(filename));
    let hexStr = "";
    for (let i=0;i<xData.length; i++) {
      let s = "";
      if (i >= mseed3.CRC_OFFSET && i < mseed3.CRC_OFFSET+4) {
        s = "00";
      } else {
        s = xData[i].toString(16).toUpperCase();
        if (s.length === 1) { s = "0"+s;}
      }
      hexStr += s;
    }
    expect(hexStr).toBeString();
    expect(xData[0]).toEqual(77);
    expect(xData[1]).toEqual(83);
    expect(xData[2]).toEqual(3);
    const ab = xData.buffer.slice(xData.byteOffset, xData.byteOffset + xData.byteLength);
    const dataView = new DataView(ab);
    expect(dataView.getUint8(0)).toEqual(77);
    expect(dataView.getUint8(1)).toEqual(83);
    expect(dataView.getUint8(2)).toEqual(3);
    const parsed = mseed3.parseMSeed3Records(ab);
    expect(parsed.length).toEqual(1);
    const xr = parsed[0];
    const xh = xr.header;
    // doesn't work as json is not identical after round trip
    // due to / being same as \/, also 1e-6 and .000001
    //expect(xr.getSize()).toEqual(fileSizeMap.get(filename));

    const jsonFilename = filename.slice(0, -6)+'json';

    expect(fs.existsSync(jsonFilename)).toEqual(true);
    const jsonAll = JSON.parse(fs.readFileSync(jsonFilename, 'utf8'));
    const jsonData = jsonAll[0];
    expect(xh?.identifier).toEqual(jsonData.SID);

    // doesn't work as json is not identical after round trip
    // due to / being same as \/, also 1e-6 and .000001
    //expect(xr.getSize()).toEqual(jsonData.RecordLength);
    expect(xh.formatVersion).toEqual(jsonData.FormatVersion);
    //expect(xh.flags).toEqual(jsonData.Flags.ClockLocked);
    expect(xh.getStartFieldsAsISO(false)).toEqual(jsonData.StartTime);
    expect(xh.encoding).toEqual(jsonData.EncodingFormat);
    expect(xh.sampleRate).toEqual(jsonData.SampleRate);
    expect(xh.numSamples).toEqual(jsonData.SampleCount);
    expect(mseed3.crcToHexString(xh.crc)).toEqual(jsonData.CRC);
    // doesn't work as json is not identical after round trip
    // due to / being same as \/, also 1e-6 and .000001
    //let crc = xr.calcCrc();
    //expect(mseed3.crcToHexString(crc)).toEqual(jsonData.CRC);
    expect(xh.publicationVersion).toEqual(jsonData.PublicationVersion);


    // doesn't work as json is not identical after round trip
    // due to / being same as \/, also 1e-6 and .000001
    //expect(xh.extraHeadersLength).toEqual(jsonData.ExtraLength);

    expect(getExtraHeaders(xr)).toEqual(getJsonDataExtraHeaders(jsonData));

  });
}

/**
 * get json ExtraHeaders, but with special case if there are no json headers
 * it returns {} for both {} and the empty string. Makes test case consistent.
 *
 * @param   xr mseed3 record
 * @returns     json version of extra headers
 */
function getExtraHeaders(xr: mseed3.MSeed3Record) {
  const xh = xr.header;
  if (xh.extraHeadersLength > 2) {
    return xr.extraHeaders;
  }
  return {}; // empty object
}

/**
 * get ExtraHeaders from reference json datafile, but with special case if there are no json headers
 * it returns {} for both {} and undef. Makes test case consistent.
 *
 * @param   jsonData mseed3 record
 * @returns     json version of extra headers
 */
function getJsonDataExtraHeaders(jsonData: any) {
  if (isDef(jsonData.ExtraHeaders)) {
    return jsonData.ExtraHeaders;
  }
  return {}; // empty object
}

test("crc-32c of a string", () => {
  const s = "123456789";
  const buf = new Uint8Array(new ArrayBuffer(s.length));
  for (let i=0; i<s.length; i++) {
    buf[i] = s.charCodeAt(i);
  }
  const crc = mseed3.calculateCRC32C(buf);
  expect(crc).toEqual(0xe3069283);//0xE3069283
});

test("text output vs mseed2text", function() {
  const ctext = [
"FDSN:XX_TEST__M_H_Z, version 1, 1595 bytes (format: 3)",
"             start time: 2022-06-05T20:32:38.123456789Z (156)",
"      number of samples: 499",
"       sample rate (Hz): 5",
"                  flags: [00000100] 8 bits",
"                         [Bit 2] Clock locked",
"                    CRC: 0x90B59769",
"    extra header length: 0 bytes",
"    data payload length: 1536 bytes",
"       payload encoding: STEIM-2 integer compression (val: 11)",
  ];
  const filename = 'test/mseed3/reference-data/reference-sinusoid-steim2.mseed3';
  expect(fs.existsSync(filename)).toEqual(true);
  const xData = fs.readFileSync(filename);

  const ab = xData.buffer.slice(xData.byteOffset, xData.byteOffset + xData.byteLength);
  const dataView = new DataView(ab);
  const readCRC = dataView.getUint32(28, true);
  expect(dataView.getUint8(0)).toEqual(77);
  expect(dataView.getUint8(1)).toEqual(83);
  expect(dataView.getUint8(2)).toEqual(3);
  const parsed = mseed3.parseMSeed3Records(ab);
  expect(parsed.length).toEqual(1);
  const xr = parsed[0];
  const xh = xr.header;
  expect(mseed3.crcToHexString(readCRC)).toEqual("0x90B59769");
  expect(readCRC).toEqual(0x90B59769);
  expect(readCRC).toEqual(xr.header.crc);
  const xhStr = xh.toString().split('\n');
  expect(xhStr.length).toEqual(ctext.length);
  for (let i=0; i< ctext.length; i++) {
    expect(xhStr[i]).toEqual(ctext[i]);
  }
});


test("decomp HODGE", function() {
  const ctext = [
"FDSN:CO_HODGE_00_L_H_Z, version 4, 285 bytes (format: 3)",
"             start time: 2019-07-06T03:19:53.000000Z (187)",
"      number of samples: 64",
"       sample rate (Hz): 1",
"                  flags: [00000000] 8 bits",
"                    CRC: 0x6E04EAB",
"    extra header length: 31 bytes",
"    data payload length: 192 bytes",
"       payload encoding: STEIM-2 integer compression (val: 11)",
  ];
  const ms3filename = 'test/mseed3/one_record_HODGE_HHZ.ms3';
  const ms2filename = 'test/mseed3/one_record_HODGE_HHZ.ms2';
  expect(fs.existsSync(ms3filename)).toEqual(true);
  expect(fs.existsSync(ms2filename)).toEqual(true);
  const xData = fs.readFileSync(ms3filename);
  const mBuf = fs.readFileSync(ms2filename);

  const ms2AB = mBuf.buffer.slice(mBuf.byteOffset, mBuf.byteOffset + mBuf.byteLength);
  const m2Records = miniseed.parseDataRecords(ms2AB);
  expect(m2Records.length).toEqual(1);
  const ms2Record = m2Records[0];
  const ms2Data = ms2Record.decompress();

  const ab = xData.buffer.slice(xData.byteOffset, xData.byteOffset + xData.byteLength);
  const dataView = new DataView(ab);
  expect(dataView.getUint8(0)).toEqual(77);
  expect(dataView.getUint8(1)).toEqual(83);
  expect(dataView.getUint8(2)).toEqual(3);
  const parsed = mseed3.parseMSeed3Records(ab);
  expect(parsed.length).toEqual(1);
  const xr = parsed[0];
  const data = xr.decompress();
  const ldata = [ -7, -50,  -58,   -46 ,  -31, 17];
  for (let i=0; i<ldata.length; i++) {
    expect(data[i]).toEqual(ldata[i]);
  }
  expect(data.length).toEqual(ms2Data.length);
  for (let i=0; i<ms2Data.length; i++) {
    expect(data[i]).toEqual(ms2Data[i]);
  }

  const xh = xr.header;
  const xhStr = xh.toString().split('\n');
  expect(xhStr.length).toEqual(ctext.length);
  for (let i=0; i< ctext.length; i++) {
    expect(xhStr[i]).toEqual(ctext[i]);
  }

});
