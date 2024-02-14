import {seismogramSegmentAsLine} from '../src/seismographutil';
import {Seismogram, SeismogramDisplayData} from '../src/seismogram';
import {Seismograph} from '../src/seismograph';
import {SeismographConfig} from '../src/seismographconfig';
import {isoToDateTime} from '../src/util';
import {LuxonTimeScale} from '../src/axisutil';
import { Interval} from 'luxon';

import * as mseed3 from '../src/mseed3';
import { scaleLinear as d3scaleLinear } from "d3-scale";

import fs from 'fs';


test("line create test", () => {

  const width = 100;
  const height = 100;
  const sampleRate = 20;
  //const sinePeriod = 5*sampleRate; // 5 second period
  const amp = height;
  const dataArray = new Float32Array(10000).map(function(d, i) {
    //return Math.sin(2 * Math.PI * i / sinePeriod) * amp;
    return 0;
  });
  dataArray[0] = 0;
  dataArray[9000] = amp;
  const start = isoToDateTime('2019-07-04T05:46:23');
  const myseismogram = Seismogram.fromContiguousData(dataArray, sampleRate, start);
  const segment = myseismogram.segments[0];
  const seisData = SeismogramDisplayData.fromSeismogram(myseismogram);

  const seisConfig = new SeismographConfig();
  seisConfig.fixedTimeScale = seisData.timeRange;
  seisConfig.amplitudeRaw();
  seisConfig.margin.top = 0;
  seisConfig.margin.bottom = 0;
  seisConfig.margin.left = 0;
  seisConfig.margin.right = 0;
  const graph = new Seismograph([seisData], seisConfig);
  graph.width = width;
  graph.height = height;
  const maxSamplePerPixelForLineDraw = 3;
  const tScale = graph.timeScaleForSeisDisplayData(seisData);
  const yScale = graph.ampScaleForSeisDisplayData(seisData);
  expect(yScale.range()[1]).toBe(1);
  expect(yScale.range()[0]).toBe(height-1);
  const drawn = seismogramSegmentAsLine(segment,
    width,
    tScale,
    yScale,
    maxSamplePerPixelForLineDraw);
  expect(drawn.samplesPerPixel).toBeCloseTo(dataArray.length/width, 1);

  expect(drawn.y.length).toEqual(drawn.x.length);
  expect(drawn.x.length).toEqual(5);
  expect(drawn.x[0]).toEqual(0);
  expect(drawn.y[0]).toEqual(height-1);
  expect(drawn.x[1]).toEqual(89);
  expect(drawn.y[1]).toEqual(height-1);
  expect(drawn.x[2]).toEqual(90);
  expect(drawn.y[2]).toEqual(height-amp+1);
  expect(drawn.x[3]).toEqual(90);
  expect(drawn.y[3]).toEqual(height-1);
  expect(drawn.x[4]).toEqual(width-1);
  expect(drawn.y[4]).toEqual(height-1);
});


test("ref badspike mseed3 file", () => {

  const width = 1113;
  const height = 100;
  const amp = height;

  const filename = "test/badspike.ms3";
  expect(fs.existsSync(filename)).toEqual(true);
  const xData = fs.readFileSync(filename);
  const ab = xData.buffer.slice(xData.byteOffset, xData.byteOffset + xData.byteLength);
  const dataRecords = mseed3.parseMSeed3Records(ab);
  expect(dataRecords.length).toEqual(1);
  const seisList = mseed3.seismogramPerChannel(dataRecords);
  const sddList = seisList.map(seis => SeismogramDisplayData.fromSeismogram(seis));
  const seisData = sddList[0];

  const seisConfig = new SeismographConfig();
  seisConfig.fixedTimeScale = seisData.timeRange;
  seisConfig.amplitudeRaw();
  seisConfig.margin.top = 0;
  seisConfig.margin.bottom = 0;
  seisConfig.margin.left = 0;
  seisConfig.margin.right = 0;
  const graph = new Seismograph([seisData], seisConfig);
  graph.width = width;
  graph.height = 100;
  //const maxSamplePerPixelForLineDraw = 3;
  const tScale = graph.timeScaleForSeisDisplayData(seisData);
  const yScale = graph.ampScaleForSeisDisplayData(seisData);
  expect(yScale.range()[1]).toBe(1);
  expect(yScale.range()[0]).toBe(height-1);

  const segment = seisData.seismogram ? seisData.seismogram.segments[0] : null;
  const drawn = seismogramSegmentAsLine(segment,
    width,
    tScale,
    yScale,
  );
  expect(drawn.maxSamplePerPixelForLineDraw).toBe(3);
  const dataArray = segment ? segment.y : [];
  expect(dataArray).not.toBeNull();
  expect(drawn.samplesPerPixel).toBeCloseTo(dataArray.length/width, 1);
  expect(drawn.y.length).toEqual(drawn.x.length);
  expect(drawn.x.length).toEqual(8);
  expect(drawn.x[0]).toEqual(0);
  expect(drawn.y[0]).toEqual(height-1);
  expect(drawn.x[1]).toEqual(611);
  expect(drawn.y[1]).toEqual(height-1);
  expect(drawn.x[2]).toEqual(611);
  expect(drawn.y[2]).toEqual(height-amp+1);
  expect(drawn.x[3]).toEqual(612);
  expect(drawn.y[3]).toEqual(height-1);
  expect(drawn.x[4]).toEqual(1105);
  expect(drawn.y[4]).toEqual(height-1);
  expect(drawn.x[5]).toEqual(1105);
  expect(drawn.y[5]).toEqual(height-amp+1);
  expect(drawn.x[6]).toEqual(1105);
  expect(drawn.y[6]).toEqual(height-1);
  expect(drawn.x[7]).toEqual(width);
  expect(drawn.y[7]).toEqual(height-1);
});


test("bad triangle", () => {
  // args: 1113, [2019-07-04T05:46:59.950Z – 2019-07-04T05:47:00.145Z), 0,1113

  const sampleRate = 20;
  const amp = .1; // 100 count amplitude
  const dataArray = new Float32Array(1000).map(function(d, i) {
    //return Math.sin(2 * Math.PI * i / sinePeriod) * amp;
    if (i===0) {return amp;}
    if (i < 10) {return .2;}
    if (i < 100) {return amp;}
    if (i < 200) {return amp;}
    if (i > 900) {return amp;}

    return 0;
  });
  const start = isoToDateTime('2019-07-04T05:46:23');
  const spikeTime = isoToDateTime('2019-07-04T05:47:00');
  const spikeOffset = Interval.fromDateTimes(start, spikeTime).toDuration();
  const spikeIdx = spikeOffset.toMillis()/1000.0*sampleRate;
  dataArray[spikeIdx] = amp;
  const myseismogram = Seismogram.fromContiguousData(dataArray, sampleRate, start);

  const width = 1113;
  const height = 100;
  const s = isoToDateTime("2019-07-04T05:46:59.950Z");
  const e = isoToDateTime("2019-07-04T05:47:00.145Z");
  const seg = myseismogram.segments[0];
  const interval = Interval.fromDateTimes(s,e);
  const xScale = new LuxonTimeScale(interval, [0, 1113]);
  const yScale = d3scaleLinear();
  yScale.domain([0, amp]);
  yScale.range([height, 0]);
  const segLine = seismogramSegmentAsLine(seg, width, xScale, yScale);
  expect(seg.y[740]).toBeCloseTo(amp, 2);
  expect(segLine.x[0]).toBeLessThan(0);
  expect(segLine.x[segLine.x.length-1]).toBeGreaterThan(width);
});
