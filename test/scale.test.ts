
import {
  LinkedAmplitudeScale,
  LinkedTimeScale,
  AmplitudeScalable,
  AMPLITUDE_MODE,
  TimeScalable,
  MinMaxable
} from "../src/scale";
import { Seismogram, SeismogramDisplayData} from '../src/seismogram';
import {Seismograph} from '../src/seismograph';
import {SeismographConfig} from '../src/seismographconfig';
import {InstrumentSensitivity} from '../src/stationxml';
import  { isoToDateTime} from '../src/util';
import { Duration} from 'luxon';

test("amp scalable test", () => {
  const hwA = 5;
  const midA = 0;
  const minMaxA = MinMaxable.fromMiddleHalfWidth(midA, hwA);
  const hwB = 2;
  const midB = 0;
  const minMaxB = MinMaxable.fromMiddleHalfWidth(midB, hwB);
  const ampA = new AmplitudeScalable(minMaxA);
  expect(ampA.middle).toEqual(midA);
  expect(ampA.halfWidth).toEqual(hwA);
  const ampB = new AmplitudeScalable(minMaxB);
  expect(ampB.middle).toEqual(midB);
  expect(ampB.halfWidth).toEqual(hwB);
  const linkAmpScale = new LinkedAmplitudeScale([ampA, ampB]);
  return Promise.all(linkAmpScale.recalculate()).then( () => {
    expect(linkAmpScale.halfWidth).toEqual(hwA);
  });
})


test("gain scale test", () => {
  const yValues = new Int32Array([-3, 0, 3]);
  const sampleRate = 20.0;
  const startTime = isoToDateTime("2013-02-08T09:30:26");

  const sensA = new InstrumentSensitivity(.02, 1, "m/s", "count");
  const sddA = SeismogramDisplayData.fromContiguousData(yValues, sampleRate, startTime);
  sddA.sensitivity = sensA;

  const maxB = 10;
  const yValuesB = new Int32Array([-1*maxB, 0, maxB]);
  const sensB = new InstrumentSensitivity(.05, 1, "m/s", "count");
  const sddB = SeismogramDisplayData.fromContiguousData(yValuesB, sampleRate, startTime);
  sddB.sensitivity = sensB;

  const linkAmpScale = new LinkedAmplitudeScale();

  const seisConfig = new SeismographConfig();
  seisConfig.linkedAmplitudeScale = linkAmpScale;
  const graph = new Seismograph([sddA, sddB], seisConfig);
  return Promise.all(linkAmpScale.recalculate()).then(() => {
    expect(linkAmpScale.halfWidth).toEqual(maxB/sensB.sensitivity);
    expect(graph.amp_scalable.halfWidth).toEqual(maxB/sensB.sensitivity);
    expect(graph.amp_scalable.middle).toEqual(0/sensB.sensitivity);
  });
});

test("zero mean scale test", () => {
  const yValues = new Float32Array([3, 0, 3]);
  const seisAMean = yValues.reduce((acc, cur) => acc+cur, 0)/yValues.length;
  const sampleRate = 20.0;
  const startTime = isoToDateTime("2013-02-08T09:30:26");

  const sddA = SeismogramDisplayData.fromContiguousData(yValues, sampleRate, startTime);

  const maxB = 30;
  const yValuesB = new Float32Array([maxB, 0, maxB]);
  const seisBMean = yValuesB.reduce((acc, cur) => acc+cur, 0)/yValuesB.length;
  const sddB = SeismogramDisplayData.fromContiguousData(yValuesB, sampleRate, startTime);
  const maxMeanVal = Math.max(seisAMean, seisBMean);

  const seisConfig = new SeismographConfig();
  seisConfig.linkedAmplitudeScale = new LinkedAmplitudeScale();
  seisConfig.amplitudeMode = AMPLITUDE_MODE.Mean;
  const graph = new Seismograph([sddA, sddB], seisConfig);
  const linkAmp = seisConfig.linkedAmplitudeScale;
  if (!linkAmp) { throw new Error("linked amp is undef");}
  return Promise.all(linkAmp.recalculate()).then(() => {
    // Mean centers, so middle is zero
    expect(graph.amp_scalable.halfWidth).toEqual(maxMeanVal); // nice rounds
    expect(linkAmp.halfWidth).toEqual(maxMeanVal); // 0 to mean is larger
  });
});

test("time scalable test", () => {
  const oneSec = Duration.fromMillis(1000);
  const timeA = new TimeScalable(Duration.fromMillis(0), Duration.fromMillis(0));
  const timeB = new TimeScalable(Duration.fromMillis(0), oneSec);
  const linkTimeScale = new LinkedTimeScale([timeA, timeB]);
  expect(linkTimeScale.duration).toEqual(oneSec);
})
