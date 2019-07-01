// @flow

import * as miniseed from '../../src/miniseed.js';
import  {moment} from '../../src/util';

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
    expect(dr.header.start.toISOString()).toEqual(startMoment.toISOString());
    expect(dr.header.numSamples).toEqual(99);
    let decomp = parsed[0].decompress();
    expect(decomp).toBeDefined();
    //let merged = miniseed.merge(parsed);
    //expect(merged.length).toBe(1);
});

test("contiguous miniseed file", () => {
    let mseedData = fs.readFileSync('test/miniseed/CO_JSC.mseed');
    expect(mseedData.length).toEqual(7168);
    let parsed = miniseed.parseDataRecords(mseedData.buffer);
    expect(parsed.length).toEqual(14);
    let drFirst = parsed[0];
    let drSecond = parsed[1];
    console.log("drFirst: "+drFirst.header.start.toISOString()+" "+drFirst.header.numSamples+" "+drFirst.header.sampleRate);
    console.log("drFirst.end="+drFirst.header.end.toISOString()+" drSecond.start="+drSecond.header.start.toISOString());
    expect(miniseed.areContiguous(drFirst, drSecond)).toBe(true);
});
