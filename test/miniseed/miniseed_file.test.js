// @flow

import * as miniseed from '../../src/miniseed.js';
import * as seedcodec from '../../src/seedcodec.js';
import  {moment} from '../../src/util';

// eslint-disable-next-line no-undef
const fs = require('fs');

test("load miniseed file", () => {

    let mseedData = fs.readFileSync('test/miniseed/CO_JSC.mseed');
    let ab = mseedData.buffer.slice(mseedData.byteOffset, mseedData.byteOffset + mseedData.byteLength);
    expect(mseedData.length).toEqual(7168);
    let parsed = miniseed.parseDataRecords(ab);
    expect(parsed.length).toEqual(14);
    let dr = parsed[0];
    expect(dr.header.staCode).toEqual("JSC");
    expect(dr.header.netCode).toEqual("CO");
    expect(dr.header.locCode).toEqual("00");
    expect(dr.header.chanCode).toEqual("HHZ");
    let btime = dr.header.startBTime;
    expect(btime.year).toEqual(2016);
    expect(btime.jday).toEqual(265);
    expect(btime.hour).toEqual(13);
    expect(btime.min).toEqual(48);
    expect(btime.sec).toEqual(0);
    expect(btime.tenthMilli).toEqual(84);
    let startMoment = moment.utc([2016, 8, 21, 13, 48, 0, 8]);
    //startMoment.dayOfYear(265); day 265 = Sept 21, months zero based in moment
    expect(dr.header.startTime.toISOString()).toEqual(startMoment.toISOString());
    expect(dr.header.numSamples).toEqual(99);
    expect(dr.header.encoding).toEqual(seedcodec.STEIM2);
    let decomp = parsed[0].decompress();
    expect(decomp).toBeInstanceOf(Int32Array);
    expect(decomp).toBeDefined();
    // msi -n 1 -pp -D  CO_JSC.mseed
    let firstRecordData = [       -42,         411,         382,         106,          84,         488,
       251,         -74,         378,         459,         -56,         211,
       540,         -93,         264,         537,        -155,         354,
       507,         -13,         312,         312,          99,         295,
       307,          56,         253,         499,          25,         128,
       617,          16,          60,         697,         -33,           2,
       746,          55,        -164,         673,         309,        -273,
       515,         425,        -180,         435,         503,        -152,
       127,         713,          93,        -210,         632,         407,
      -306,         474,         615,        -290,         328,         639,
      -115,         106,         544,         241,         -92,         272,
       584,        -130,         -11,         963,        -100,        -407,
      1031,         253,        -535,         634,         694,        -504,
       264,        1096,        -471,         -50,        1204,        -158,
      -316,        1012,         219,        -455,         880,         451,
      -371,         599,         498,        -141,         281,         728,
       -15,           3,         942
    ];
    expect(decomp).toHaveLength(firstRecordData.length);
    for(let i=0; i<firstRecordData.length; i++ ) {
      expect(decomp[i]).toEqual(firstRecordData[i]);
    }
});

test("contiguous miniseed file", () => {
    let mseedData = fs.readFileSync('test/miniseed/CO_JSC.mseed');
    expect(mseedData.length).toEqual(7168);
    let parsed = miniseed.parseDataRecords(mseedData.buffer);
    expect(parsed.length).toEqual(14);
    let drFirst = parsed[0];
    let drSecond = parsed[1];
    expect(miniseed.areContiguous(drFirst, drSecond)).toBe(true);
});
