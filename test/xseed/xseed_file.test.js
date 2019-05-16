import * as xseed from '../../src/xseed.js';
import  {moment} from '../../src/util';

var fs = require('fs');

test("load xseed file", () => {

      let mseedData = fs.readFileSync('test/miniseed/CO_JSC.mseed', null);
      expect(mseedData.length).toEqual(7168);

  let filename = 'test/xseed/reference-data/reference-sinusoid-float32.xseed';
  expect(fs.existsSync(filename)).toBe(true);
      let xData = fs.readFileSync(filename, null);
      //expect(xData.length).toEqual(2060);
      console.log("test xseed "+xData.slice(0,2));
      expect(xData[0]).toEqual(77);
      expect(xData[1]).toEqual(83);
      expect(xData[2]).toEqual(3);
//      let d = new Uint8Array(xData, 0, 20); // 39 117 115
//      console.log("test xseed "+d);
//expect(d[0]).toEqual(39);
//expect(d[1]).toEqual(117);
//expect(d[2]).toEqual(3);
      let ab = new Uint8Array(xData).buffer;
      let dataView = new DataView(ab);
      expect(dataView.getUint8(0)).toEqual(77);
      expect(dataView.getUint8(1)).toEqual(83);
      expect(dataView.getUint8(2)).toEqual(3);
      let parsed = xseed.parseXSeedRecords(ab);
      expect(parsed.length).toEqual(1);
});
