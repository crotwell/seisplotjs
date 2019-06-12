// @flow

// $FlowFixMe
let TextDecoder = require('util').TextDecoder;
global.TextDecoder = TextDecoder;

import * as xseed from '../../src/xseed.js';

var fs = require('fs');

let fileList = [
  'test/xseed/reference-data/reference-ascii.xseed',
  'test/xseed/reference-data/reference-detectiononly.xseed',
  'test/xseed/reference-data/reference-sinusoid-FDSN-All.xseed',
  'test/xseed/reference-data/reference-sinusoid-FDSN-Other.xseed',
  'test/xseed/reference-data/reference-sinusoid-TQ-TC-ED.xseed',
  'test/xseed/reference-data/reference-sinusoid-float32.xseed',
  'test/xseed/reference-data/reference-sinusoid-float64.xseed',
  'test/xseed/reference-data/reference-sinusoid-int16.xseed',
  'test/xseed/reference-data/reference-sinusoid-int32.xseed',
  'test/xseed/reference-data/reference-sinusoid-steim1.xseed',
  'test/xseed/reference-data/reference-sinusoid-steim2.xseed'];

let fileSizeMap = new Map();
fileSizeMap.set('test/xseed/reference-data/reference-ascii.xseed',295);
fileSizeMap.set('test/xseed/reference-data/reference-detectiononly.xseed',331);
fileSizeMap.set('test/xseed/reference-data/reference-sinusoid-FDSN-All.xseed',3787);
fileSizeMap.set('test/xseed/reference-data/reference-sinusoid-FDSN-Other.xseed',1149);
fileSizeMap.set('test/xseed/reference-data/reference-sinusoid-TQ-TC-ED.xseed',1318);
fileSizeMap.set('test/xseed/reference-data/reference-sinusoid-float32.xseed',2060);
fileSizeMap.set('test/xseed/reference-data/reference-sinusoid-float64.xseed',4060);
fileSizeMap.set('test/xseed/reference-data/reference-sinusoid-int16.xseed',1060);
fileSizeMap.set('test/xseed/reference-data/reference-sinusoid-int32.xseed',2060);
fileSizeMap.set('test/xseed/reference-data/reference-sinusoid-steim1.xseed',956);
fileSizeMap.set('test/xseed/reference-data/reference-sinusoid-steim2.xseed',956);

//  fileList = fileList.slice(2,3);

for (let filename of fileList) {
  test("ref xseed file vs json"+filename, () => {
    console.log("test xseed "+filename);
    expect(fs.existsSync(filename)).toEqual(true);
    let xData = fs.readFileSync(filename);
    expect(xData.length).toEqual(fileSizeMap.get(filename));
    let hexStr = "";
    for (let i=0;i<xData.length; i++) {
      let s = "";
      if (i >= xseed.CRC_OFFSET && i < xseed.CRC_OFFSET+4) {
        s = "00";
      } else {
        s = xData[i].toString(16).toUpperCase();
        if (s.length === 1) { s = "0"+s;}
      }
      hexStr += s;
    }
    console.log(`record as hex (${hexStr.length}): ${hexStr}`);
    expect(xData[0]).toEqual(77);
    expect(xData[1]).toEqual(83);
    expect(xData[2]).toEqual(3);
    let ab = xData.buffer.slice(xData.byteOffset, xData.byteOffset + xData.byteLength);
    let dataView = new DataView(ab);
    expect(dataView.getUint8(0)).toEqual(77);
    expect(dataView.getUint8(1)).toEqual(83);
    expect(dataView.getUint8(2)).toEqual(3);
    let parsed = xseed.parseXSeedRecords(ab);
    expect(parsed.length).toEqual(1);
    let xr = parsed[0];
    let xh = xr.header;
    // doesn't work as json is not identical after round trip
    // due to / being same as \/, also 1e-6 and .000001
    //expect(xr.getSize()).toEqual(fileSizeMap.get(filename));

    let jsonFilename = filename.slice(0, -5)+'json';

    console.log("test json "+jsonFilename);
    expect(fs.existsSync(jsonFilename)).toEqual(true);
    let jsonData = JSON.parse(fs.readFileSync(jsonFilename, 'utf8'));
    expect(xh.identifier).toEqual(jsonData.SID);

    // doesn't work as json is not identical after round trip
    // due to / being same as \/, also 1e-6 and .000001
    //expect(xr.getSize()).toEqual(jsonData.RecordLength);
    expect(xh.formatVersion).toEqual(jsonData.FormatVersion);
    //expect(xh.flags).toEqual(jsonData.Flags.ClockLocked);
    var regex = /(\d\d\d\d),(\d\d\d),(\d\d:\d\d:\d\dZ)/gi;
    jsonData.StartTime = jsonData.StartTime.replace(regex, '$1-$2T$3');
    // json only has sec accuracy now, just compare yyyy-dddTHH:MM:ss => 17 chars
    expect(xh.getStartFieldsAsISO().slice(0,17)).toEqual(jsonData.StartTime.slice(0,17));
    expect(xh.encoding).toEqual(jsonData.EncodingFormat);
    expect(xh.sampleRatePeriod).toEqual(jsonData.SampleRate);
    expect(xh.numSamples).toEqual(jsonData.SampleCount);
    expect(xseed.crcToHexString(xh.crc)).toEqual(jsonData.CRC);
    // doesn't work as json is not identical after round trip
    // due to / being same as \/, also 1e-6 and .000001
    //let crc = xr.calcCrc();
    //expect(xseed.crcToHexString(crc)).toEqual(jsonData.CRC);
    expect(xh.publicationVersion).toEqual(jsonData.PublicationVersion);


    // doesn't work as json is not identical after round trip
    // due to / being same as \/, also 1e-6 and .000001
    //expect(xh.extraHeadersLength).toEqual(jsonData.ExtraLength);
    if (xh.extraHeadersLength > 2) {
      expect(xr.extraHeaders).toEqual(jsonData.ExtraHeaders);
    }
  });
}

test("crc-32c of a string", () => {
  let s = "hi12345";
  let buf = new Uint8Array(new ArrayBuffer(s.length));
  for (let i=0; i<s.length; i++) {
    buf[i] = s.charCodeAt(i);
  }
  let crc = xseed.calculateCRC32C(buf);
  console.log("crc="+'0x'+crc.toString(16).toUpperCase());
});
