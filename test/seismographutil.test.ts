import {seismogramSegmentAsLine} from '../src/seismographutil';
import {Seismogram, SeismogramDisplayData} from '../src/seismogram';
import {Seismograph} from '../src/seismograph';
import {SeismographConfig} from '../src/seismographconfig';
import {isoToDateTime} from '../src/util';

import * as mseed3 from '../src/mseed3';
import fs from 'fs';

// eslint-disable-next-line no-undef
const TextDecoder = require('util').TextDecoder;
// eslint-disable-next-line no-undef
global.TextDecoder = TextDecoder;

test("line create test", () => {

  const width = 100;
  const height = 100;
  let sampleRate = 20;
  //const sinePeriod = 5*sampleRate; // 5 second period
  const amp = height;
  let dataArray = new Float32Array(10000).map(function(d, i) {
    //return Math.sin(2 * Math.PI * i / sinePeriod) * amp;
    return 0;
  });
  dataArray[0] = 0;
  dataArray[9000] = amp;
  let start = isoToDateTime('2019-07-04T05:46:23');
  let myseismogram = Seismogram.fromContiguousData(dataArray, sampleRate, start);
  const segment = myseismogram.segments[0];
  let seisData = SeismogramDisplayData.fromSeismogram(myseismogram);

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
  const maxSamplePerPixelForLineDraw = 3;
  const tScale = graph.timeScaleForSeisDisplayData(seisData);
  const yScale = graph.ampScaleForSeisDisplayData(seisData);
  expect(yScale.range()[1]).toBe(0);
  expect(yScale.range()[0]).toBe(100);
  const drawn = seismogramSegmentAsLine(segment,
    width,
    tScale,
    yScale,
    maxSamplePerPixelForLineDraw);
  expect(drawn.samplesPerPixel).toBeCloseTo(dataArray.length/width, 1);
  console.log(`line create test drawn: ${drawn.x.length}`)

  expect(drawn.y.length).toEqual(drawn.x.length);
  expect(drawn.x.length).toEqual(5);
  expect(drawn.x[0]).toEqual(0);
  expect(drawn.y[0]).toEqual(height);
  expect(drawn.x[1]).toEqual(89);
  expect(drawn.y[1]).toEqual(height);
  expect(drawn.x[2]).toEqual(90);
  expect(drawn.y[2]).toEqual(height-amp);
  expect(drawn.x[3]).toEqual(90);
  expect(drawn.y[3]).toEqual(height);
  expect(drawn.x[4]).toEqual(width-1);
  expect(drawn.y[4]).toEqual(height);
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
  expect(yScale.range()[1]).toBe(0);
  expect(yScale.range()[0]).toBe(100);

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
  expect(drawn.y[0]).toEqual(height);
  expect(drawn.x[1]).toEqual(611);
  expect(drawn.y[1]).toEqual(height);
  expect(drawn.x[2]).toEqual(611);
  expect(drawn.y[2]).toEqual(height-amp);
  expect(drawn.x[3]).toEqual(612);
  expect(drawn.y[3]).toEqual(height);
  expect(drawn.x[4]).toEqual(1105);
  expect(drawn.y[4]).toEqual(height);
  expect(drawn.x[5]).toEqual(1105);
  expect(drawn.y[5]).toEqual(height-amp);
  expect(drawn.x[6]).toEqual(1105);
  expect(drawn.y[6]).toEqual(height);
  expect(drawn.x[7]).toEqual(width);
  expect(drawn.y[7]).toEqual(height);
});
