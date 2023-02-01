// @flow

import {FDSNSourceId} from '../../src/fdsnsourceid';
import {Seismogram} from '../../src/seismogram';
import {SeismogramSegment} from '../../src/seismogramsegment';
import  {isoToDateTime} from '../../src/util';
import { Duration, Interval} from 'luxon';

test("simple seismogram cut", () => {
  const yValues = new Int32Array(100);
  const yValuesB = new Int32Array(10);
  const sampleRate = 1.0;
  const startTime = isoToDateTime('2019-01-01T10:00:00Z');
  const startTimeB = startTime.plus(Duration.fromMillis(1000*yValues.length));
  const sid = FDSNSourceId.createUnknown(sampleRate, "H", "Z");
  const seg = new SeismogramSegment(yValues, sampleRate, startTime, sid);
  const segB = seg.cloneWithNewData(yValuesB, startTimeB);
  const cutSeconds = 10;
  const cutBeginWindow = Interval.after(startTime, Duration.fromMillis(1000*cutSeconds));
  let cutSeg = seg.cut(cutBeginWindow);
  const cutSegB = segB.cut(cutBeginWindow);
  expect(cutSeg).not.toBeNull();
  expect(cutSegB).toBeNull();
  // for flow
  if ( ! cutSeg ) {throw new Error("cutSeg is null");}
  expect(seg.y.length).toEqual(yValues.length);
  expect(cutSeg.y.length).toEqual(cutSeconds+1);
  expect(cutSeg.yAtIndex(0)).toEqual(seg.yAtIndex(0));
  expect(cutSeg.sampleRate).toEqual(sampleRate);
  expect(cutSeg.startTime).toEqual(startTime);
  expect(cutSeg.sourceId).toEqual(sid);
  expect(cutSeg.numPoints).toEqual(cutSeconds+1);
  expect(cutSeg.timeOfSample(0).toISO()).toEqual(startTime.toISO());
  expect(seg.y.length).toEqual(yValues.length);

  const nearEndTime = seg.endTime.minus(Duration.fromMillis(1000));

  const cutEndWindow = Interval.after(nearEndTime, Duration.fromMillis(1000*cutSeconds));
  cutSeg = seg.cut(cutEndWindow);
  expect(cutSeg).not.toBeNull();
  // for flow
  if ( ! cutSeg ) {throw new Error("cutSeg is null");}
  expect(seg.y.length).toEqual(yValues.length);
  expect(cutSeg.y.length).toEqual(2);
  expect(cutSeg.startTime).toEqual(nearEndTime);
  expect(cutSeg.numPoints).toEqual(2);


  const seis = new Seismogram([seg, segB]);
  const cutSeis = seis.cut(cutBeginWindow);

  expect(cutSeis).not.toBeNull();
  // for flow
  if ( ! cutSeis ) {throw new Error("cutSeis is null");}

  expect(cutSeis.startTime).toEqual(cutBeginWindow.start);
  expect(cutSeis.numPoints).toEqual(cutSeconds+1);

  let shiftStart = startTime.plus(Duration.fromMillis(1000));
  const cutShiftWindow = Interval.after(shiftStart, Duration.fromMillis(1000*cutSeconds));
  let cutShiftSeis = seis.cut(cutShiftWindow);
  expect(cutShiftSeis).not.toBeNull();
  // for flow
  if ( ! cutShiftSeis ) {throw new Error("cutShiftSeis is null");}
  expect(cutShiftSeis.startTime).toEqual(cutShiftWindow.start);
  expect(cutShiftSeis.numPoints).toEqual(cutSeconds+1);

  shiftStart = seis.endTime.minus(Duration.fromMillis(1000));
  const cutSeisNearEndWindow = Interval.after(shiftStart, Duration.fromMillis(1000*cutSeconds));
  cutShiftSeis = seis.cut(cutSeisNearEndWindow);
  expect(cutShiftSeis).not.toBeNull();
  // for flow
  if ( ! cutShiftSeis ) {throw new Error("cutShiftSeis is null");}
  expect(cutShiftSeis.startTime).toEqual(cutSeisNearEndWindow.start);
  expect(cutShiftSeis.numPoints).toEqual(2);


  const bigStart = startTime.minus(Duration.fromMillis(10*1000));
  const cutBigWindow = Interval.after(bigStart, Duration.fromMillis(1000*(seis.numPoints+1000)));
  const cutBigSeis = seis.cut(cutBigWindow);
  expect(cutBigSeis).not.toBeNull();
  // for flow
  if ( ! cutBigSeis ) {throw new Error("cutShiftSeis is null");}
  expect(cutBigSeis.startTime).toEqual(seis.startTime);
  expect(cutBigSeis.numPoints).toEqual(seis.numPoints);

});
