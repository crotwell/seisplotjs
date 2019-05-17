import * as xseed from '../../src/xseed.js';
import  {moment} from '../../src/util';

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
for (let filename of fileList) {
  test("ref xseed file vs json"+filename, () => {
    console.log("test xseed "+filename);
    expect(fs.existsSync(filename)).toEqual(true);
    let xData = fs.readFileSync(filename);
    //expect(xData.length).toEqual(2060);
    console.log("test xseed "+xData.slice(0,2));
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

    let jsonFilename = filename.slice(0, -5)+'json';

    console.log("test json "+jsonFilename);
    expect(fs.existsSync(jsonFilename)).toEqual(true);
    let jsonData = JSON.parse(fs.readFileSync(jsonFilename, 'utf8'));
    expect(xh.identifier).toEqual(jsonData.SID);
    expect(xr.getSize()).toEqual(jsonData.RecordLength);
    expect(xh.formatVersion).toEqual(jsonData.FormatVersion);
    //expect(xh.flags).toEqual(jsonData.Flags.ClockLocked);
    var regex = /(\d\d\d\d),(\d\d\d),(\d\d:\d\d:\d\dZ)/gi;
    jsonData.StartTime = jsonData.StartTime.replace(regex, '$1-$2T$3');
    // json only has sec accuracy now, just compare yyyy-dddTHH:MM:ss => 17 chars
    expect(xh.getStartFieldsAsISO().slice(0,17)).toEqual(jsonData.StartTime.slice(0,17));
    expect(xh.encoding).toEqual(jsonData.EncodingFormat);
    expect(xh.sampleRatePeriod).toEqual(jsonData.SampleRate);
    expect(xh.numSamples).toEqual(jsonData.SampleCount);
    expect('0x'+xh.crc.toString(16).toUpperCase()).toEqual(jsonData.CRC);
    expect(xh.publicationVersion).toEqual(jsonData.PublicationVersion);
    expect(xh.extraHeadersLength).toEqual(jsonData.ExtraLength);
    if (xh.extraHeadersLength > 2) {
      expect(xr.extraHeaders).toEqual(jsonData.ExtraHeaders);
    }
  });
}


test("ms2 round trip", () => {

});
