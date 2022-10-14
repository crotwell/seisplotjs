// @flow

import { createQuakeFromValues, UNKNOWN_PUBLIC_ID} from '../src/quakeml.js';
import {AMPLITUDE_MODE } from '../src/scale.js';
import {Seismogram, SeismogramDisplayData, findMinMaxOverTimeRange} from '../src/seismogram';
import {SeismogramSegment} from '../src/seismogramsegment';
import  {isDef, isoToDateTime} from '../src/util';
import {DateTime, Duration, Interval} from 'luxon';

test("simple seismogram seg creation", () => {
  let yValues = Int32Array.from([0, 1, 2]);
  let sampleRate = 20.0;
  let startTime = DateTime.utc();
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
  expect(seis.timeOfSample(0).toISO()).toEqual(startTime.toISO());
  expect(seis.codes()).toBe(netCode+"."+staCode+"."+locCode+"."+chanCode);
});

test("seismogram seg clone", () => {
  let yValues = Int32Array.from([0, 1, 2]);
  let sampleRate = 20.0;
  let startTime = DateTime.utc();
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
  expect(cloneSeg.startTime.toISO()).toEqual(seisSeg.startTime.toISO());
  expect(cloneSeg.netCode).toBe(seisSeg.netCode);
  expect(cloneSeg.staCode).toBe(seisSeg.staCode);
  expect(cloneSeg.locCode).toBe(seisSeg.locCode);
  expect(cloneSeg.chanCode).toBe(seisSeg.chanCode);
  expect(cloneSeg.numPoints).toBe(seisSeg.numPoints);
  expect(cloneSeg.timeOfSample(0).toISO()).toEqual(seisSeg.timeOfSample(0).toISO());
  expect(cloneSeg.codes()).toEqual(seisSeg.codes());
  expect(cloneSeg.endTime.toISO()).toEqual(seisSeg.endTime.toISO());
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
  let startTime = DateTime.utc();
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
  let startTime = isoToDateTime("2013-02-08T09:30:26");
  let secondStart = startTime.plus(Duration.fromMillis(1000*yValues.length/sampleRate));
  let laterStart = secondStart.plus(Duration.fromMillis(10*1000*yValues.length/sampleRate));

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
  let startTime = DateTime.utc();
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
  expect(cloneSeis.startTime.toISO()).toEqual(seis.startTime.toISO());
  expect(cloneSeis.networkCode).toBe(seis.networkCode);
  expect(cloneSeis.stationCode).toBe(seis.stationCode);
  expect(cloneSeis.locationCode).toBe(seis.locationCode);
  expect(cloneSeis.channelCode).toBe(seis.channelCode);
  expect(cloneSeis.numPoints).toBe(seis.numPoints);
//  expect(cloneSeis.timeOfSample(0).toISO()).toEqual(seis.timeOfSample(0).toISO());
  expect(cloneSeis.codes()).toEqual(seis.codes());
  expect(cloneSeis.endTime.toISO()).toEqual(seis.endTime.toISO());
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
  let startTimeA = DateTime.utc().minus(Duration.fromMillis(1000*yValues.length/sampleRate));
  let startTimeB = startTimeA.plus(Duration.fromMillis(1000*yValues.length/sampleRate));

  let seisSegA = new SeismogramSegment(yValues.slice(), sampleRate, startTimeA);
  let seisSegB = new SeismogramSegment(yValues.slice(), sampleRate, startTimeB);
  let seis = new Seismogram([ seisSegA, seisSegB]);
  expect(seis.merge().length).toEqual(yValues.length*2);
});

test("segment index of time", () => {
  const len = 1000;
  const yValues = new Int32Array(len);
  const sampleRate = 20.0;
  const startTime = isoToDateTime("2013-02-08T09:30:26");
  const seg = new SeismogramSegment(yValues, sampleRate, startTime);
  expect(seg.indexOfTime(startTime)).toEqual(0);
  const before = startTime.minus(Duration.fromMillis(1000/sampleRate));
  expect(seg.indexOfTime(before)).toEqual(-1);
  const mid = startTime.plus(Duration.fromMillis(47.3*1000/sampleRate));
  expect(seg.indexOfTime(mid)).toEqual(47);
  const after = startTime.plus(Duration.fromMillis((len+1)*1000/sampleRate));
  expect(seg.indexOfTime(after)).toEqual(-1);

});


test("clone sdd test", () => {
  const len = 1000;
  const yValues = new Int32Array(len);
  const sampleRate = 20.0;
  const startTime = isoToDateTime("2013-02-08T09:30:26");
  const marker = {
    name: "P",
    markertype: "predicted",
    time: startTime.plus(Duration.fromISO("PT1M")),
    description: "dummy",
  };

  const seis = Seismogram.createFromContiguousData(yValues, sampleRate, startTime);
  const q = createQuakeFromValues(UNKNOWN_PUBLIC_ID, startTime,-10, 12, 0);
  const sdd = SeismogramDisplayData.fromSeismogram(seis);
  sdd.addQuake(q);
  sdd.addMarkers(marker);
  expect(sdd.markerList).toHaveLength(1);

  const processedSeis = Seismogram.createFromContiguousData(yValues, sampleRate, startTime);
  const cloneSdd = sdd.cloneWithNewSeismogram(processedSeis);
  expect(cloneSdd.quakeList).toHaveLength(sdd.quakeList.length);
  expect(cloneSdd.quakeList[0]).toBe(sdd.quakeList[0]);
  expect(cloneSdd.markerList).toHaveLength(sdd.markerList.length);
});

test("cut clone sdd test", () => {
  const len = 1000;
  const yValues = new Int32Array(len);
  const sampleRate = 20.0;
  const startTime = isoToDateTime("2013-02-08T09:30:26");
  const seis = Seismogram.createFromContiguousData(yValues, sampleRate, startTime);
  const q = createQuakeFromValues(UNKNOWN_PUBLIC_ID, startTime,-10, 12, 0);
  const sdd = SeismogramDisplayData.fromSeismogram(seis);
  sdd.addQuake(q);
  const cutWindow = Interval.after( startTime, Duration.fromMillis(1000*10));
  const cutSeis = seis.cut(cutWindow);
  expect(cutSeis).toBeDefined();
  if (!!cutSeis){
    expect(cutSeis.endTime).toEqual(cutWindow.end);
    const cutSeisSdd = sdd.cloneWithNewSeismogram(cutSeis);
    cutSeisSdd.timeRange = cutWindow; // clone keeps the old time window
    expect(cutSeisSdd.endTime).toEqual(cutWindow.end);
    expect(cutSeisSdd.seismogram).toBeDefined();
    const cutSeisSdd_seis = cutSeisSdd.seismogram;
    expect(cutSeisSdd_seis).not.toBeNull();
    expect(cutSeisSdd_seis?.endTime).toEqual(cutWindow.end);
    expect(cutSeisSdd_seis).not.toBe(seis);
    // sdd cut has new seismogram and new time window
    const cutSdd = sdd.cut(cutWindow);
    expect(cutSdd).toBeDefined();
    const cutSdd_seis = isDef(cutSdd) ? cutSdd.seismogram: null;
    expect(cutSdd_seis).toBeDefined();

    expect(cutSdd?.endTime).toEqual(cutWindow.end);
    expect(cutSdd_seis?.endTime).toEqual(cutWindow.end);
    expect(cutSdd_seis).not.toEqual(seis);
    expect(cutSdd?.quakeList).toHaveLength(sdd.quakeList.length);
  }
});

test("find minmax test", () => {
    const yValues = new Int32Array([3, 0, 3]);
    const seisAMean = yValues.reduce((acc, cur) => acc+cur, 0)/yValues.length;
    const sampleRate = 20.0;
    const startTime = isoToDateTime("2013-02-08T09:30:26");

    const seisA = Seismogram.createFromContiguousData(yValues, sampleRate, startTime);
    const sddA = SeismogramDisplayData.fromSeismogram(seisA);
    const ampMode = AMPLITUDE_MODE.Mean;
    let minMax = findMinMaxOverTimeRange([sddA],
                                        sddA.timeRange,
                                        false,
                                        ampMode);
    expect(minMax.min).toEqual(seisAMean); // seisMean to zero
    expect(minMax.max).toEqual(seisAMean*2);
});
