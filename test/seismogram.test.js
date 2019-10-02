// @flow

import {SeismogramSegment, Seismogram} from '../../src/seismogram';
import  {moment} from '../../src/util';

test("simple seismogram seg creation", () => {
  let yValues = Int32Array.from([0, 1, 2]);
  let sampleRate = 20.0;
  let startTime = moment.utc();
  let netCode = "XX";
  let staCode = "ABCD";
  let locCode = "00";
  let chanCode = "BHZ";
  let seis = new SeismogramSegment(yValues, sampleRate, startTime);
  seis.networkCode = netCode;
  seis.stationCode = staCode;
  seis.locationCode = locCode;
  seis.channelCode = chanCode;
  expect(seis.y.length).toBe(3);
  expect(seis.yAtIndex(0)).toBe(0);
  expect(seis.yAtIndex(1)).toBe(1);
  expect(seis.yAtIndex(2)).toBe(2);
  expect(seis.sampleRate).toBe(sampleRate);
  expect(seis.startTime).toBe(startTime);
  expect(seis.netCode).toBe(netCode);
  expect(seis.staCode).toBe(staCode);
  expect(seis.locCode).toBe(locCode);
  expect(seis.chanCode).toBe(chanCode);
  expect(seis.numPoints).toBe(yValues.length);
  expect(seis.timeOfSample(0).toISOString()).toEqual(startTime.toISOString());
  expect(seis.codes()).toBe(netCode+"."+staCode+"."+locCode+"."+chanCode);
});

test("seismogram seg clone", () => {
  let yValues = Int32Array.from([0, 1, 2]);
  let sampleRate = 20.0;
  let startTime = moment.utc();
  let netCode = "XX";
  let staCode = "ABCD";
  let locCode = "00";
  let chanCode = "BHZ";
  let seisSeg = new SeismogramSegment(yValues.slice(), sampleRate, startTime);
  seisSeg.networkCode = netCode;
  seisSeg.stationCode = staCode;
  seisSeg.locationCode = locCode;
  seisSeg.channelCode = chanCode;
  let cloneSeg = seisSeg.clone();
  expect(cloneSeg.y.length).toBe(seisSeg.y.length);
  expect(cloneSeg.yAtIndex(0)).toBe(yValues[0]);
  expect(cloneSeg.yAtIndex(1)).toBe(yValues[1]);
  expect(cloneSeg.yAtIndex(2)).toBe(yValues[2]);
  expect(cloneSeg.yAtIndex(0)).toBe(seisSeg.yAtIndex(0));
  expect(cloneSeg.yAtIndex(1)).toBe(seisSeg.yAtIndex(1));
  expect(cloneSeg.yAtIndex(2)).toBe(seisSeg.yAtIndex(2));
  expect(cloneSeg.sampleRate).toBe(seisSeg.sampleRate);
  expect(cloneSeg.startTime).toEqual(seisSeg.startTime);
  expect(cloneSeg.startTime.toISOString()).toEqual(seisSeg.startTime.toISOString());
  expect(cloneSeg.netCode).toBe(seisSeg.netCode);
  expect(cloneSeg.staCode).toBe(seisSeg.staCode);
  expect(cloneSeg.locCode).toBe(seisSeg.locCode);
  expect(cloneSeg.chanCode).toBe(seisSeg.chanCode);
  expect(cloneSeg.numPoints).toBe(seisSeg.numPoints);
  expect(cloneSeg.timeOfSample(0).toISOString()).toEqual(seisSeg.timeOfSample(0).toISOString());
  expect(cloneSeg.codes()).toEqual(seisSeg.codes());
  expect(cloneSeg.endTime.toISOString()).toEqual(seisSeg.endTime.toISOString());
  // test after replace data Array
  let x = new Int32Array(seisSeg.y.length);
  x[0] = 4;
  x[1] = 5;
  x[2] = 6;
  x[3] = 7;
  cloneSeg.y = x;
  expect(cloneSeg.numPoints).toBe(x.length);
  expect(cloneSeg.y.length).toBe(x.length);
  expect(cloneSeg.yAtIndex(0)).toBe(x[0]);
  expect(cloneSeg.yAtIndex(1)).toBe(x[1]);
  expect(cloneSeg.yAtIndex(2)).toBe(x[2]);
  expect(cloneSeg.yAtIndex(3)).toBe(x[3]);
});


test("simple Seismogram creation", () => {
  let yValues = Int32Array.from([0, 1, 2]);
  let sampleRate = 20.0;
  let startTime = moment.utc();
  let netCode = "XX";
  let staCode = "ABCD";
  let locCode = "00";
  let chanCode = "BHZ";
  let seis = new SeismogramSegment(yValues.slice(), sampleRate, startTime);
  seis.networkCode = netCode;
  seis.stationCode = staCode;
  seis.locationCode = locCode;
  seis.channelCode = chanCode;
  let trace = new Seismogram(seis);
  expect(trace.networkCode).toBe(netCode);
  expect(trace.stationCode).toBe(staCode);
  expect(trace.locationCode).toBe(locCode);
  expect(trace.channelCode).toBe(chanCode);
  expect(trace.startTime).toEqual(startTime);
  expect(trace.sampleRate).toBe(sampleRate);
});

test("seismogram isContiguous", () =>{
  let yValues = new Int32Array(10);
  let sampleRate = 20.0;
  let startTime = moment.utc("2013-02-08T09:30:26");
  let secondStart = moment.utc(startTime).add(1000*yValues.length/sampleRate, 'milliseconds');
  let laterStart = moment.utc(secondStart).add(10*1000*yValues.length/sampleRate, 'milliseconds');

  let first = new SeismogramSegment(yValues, sampleRate, startTime);
  let second = new SeismogramSegment(yValues, sampleRate, secondStart);
  let seis = new Seismogram([first, second]);
  expect(seis.isContiguous()).toBe(true);

  let later = new SeismogramSegment(yValues, sampleRate, laterStart);
  let nonContigSeis = new Seismogram([first, second, later]);

  expect(nonContigSeis.isContiguous()).toBe(false);
});


test("seismogram clone", () => {
  let yValues = Int32Array.from([0, 1, 2]);
  expect(yValues[0]).toEqual(0);
  let sampleRate = 20.0;
  let startTime = moment.utc();
  let netCode = "XX";
  let staCode = "ABCD";
  let locCode = "00";
  let chanCode = "BHZ";
  let seisSeg = new SeismogramSegment(yValues.slice(), sampleRate, startTime);
  seisSeg.networkCode = netCode;
  seisSeg.stationCode = staCode;
  seisSeg.locationCode = locCode;
  seisSeg.channelCode = chanCode;
  let seis = new Seismogram([ seisSeg]);

  let cloneSeis = seis.clone();
  expect(cloneSeis.segments[0].isEncoded()).toBe(seisSeg.isEncoded());
  expect(cloneSeis.isContiguous()).toBe(seis.isContiguous());
  expect(cloneSeis.y.length).toBe(seis.y.length);
  expect(cloneSeis.y[0]).toEqual(yValues[0]);
  expect(cloneSeis.y[1]).toBe(yValues[1]);
  expect(cloneSeis.y[2]).toBe(yValues[2]);
  expect(cloneSeis.y[0]).toBe(seis.y[0]);
  expect(cloneSeis.y[1]).toBe(seis.y[1]);
  expect(cloneSeis.y[2]).toBe(seis.y[2]);
  expect(cloneSeis.sampleRate).toBe(seis.sampleRate);
  expect(cloneSeis.startTime).toEqual(seis.startTime);
  expect(cloneSeis.startTime.toISOString()).toEqual(seis.startTime.toISOString());
  expect(cloneSeis.networkCode).toBe(seis.networkCode);
  expect(cloneSeis.stationCode).toBe(seis.stationCode);
  expect(cloneSeis.locationCode).toBe(seis.locationCode);
  expect(cloneSeis.channelCode).toBe(seis.channelCode);
  expect(cloneSeis.numPoints).toBe(seis.numPoints);
//  expect(cloneSeis.timeOfSample(0).toISOString()).toEqual(seis.timeOfSample(0).toISOString());
  expect(cloneSeis.codes()).toEqual(seis.codes());
  expect(cloneSeis.endTime.toISOString()).toEqual(seis.endTime.toISOString());
  // test after replace data Array
  let x = new Int32Array(seis.y.length+1);
  x[0] = 4;
  x[1] = 5;
  x[2] = 6;
  x[3] = 7;
  x[4] = 8;

  let cloneWithY = seis.cloneWithNewData(x);
  expect(cloneWithY.numPoints).toBe(x.length);
  expect(cloneWithY.y).toHaveLength(x.length);
  expect(cloneWithY.y[0]).toBe(x[0]);
  expect(cloneWithY.y[1]).toBe(x[1]);
  expect(cloneWithY.y[2]).toBe(x[2]);
  expect(cloneWithY.y[3]).toBe(x[3]);
});


test("seismogram merge", () => {
  let yValues = Int32Array.from([0, 1, 2]);
  expect(yValues).toHaveLength(3);
  let sampleRate = 20.0;
  let startTimeA = moment.utc().subtract(yValues.length/sampleRate, 'seconds');
  let startTimeB = moment.utc(startTimeA).add(yValues.length/sampleRate, 'seconds');
  
  let seisSegA = new SeismogramSegment(yValues.slice(), sampleRate, startTimeA);
  let seisSegB = new SeismogramSegment(yValues.slice(), sampleRate, startTimeB);
  let seis = new Seismogram([ seisSegA, seisSegB]);
  expect(seis.merge().length).toEqual(yValues.length*2);
});
