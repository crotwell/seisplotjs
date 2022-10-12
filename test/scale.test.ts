
import {LinkedAmplitudeScale, LinkedTimeScale, AmplitudeScalable, TimeScalable} from "../src/scale";
import { Seismogram, SeismogramDisplayData} from '../src/seismogram';
import {Seismograph} from '../src/seismograph';
import {SeismographConfig} from '../src/seismographconfig';
import {InstrumentSensitivity} from '../src/stationxml';
import  { isoToDateTime} from '../src/util';
import { Duration} from 'luxon';

test("amp scalable test", () => {
  const hwA = 5;
  const midA = 0;
  const hwB = 2;
  const midB = 0;
  const ampA = new AmplitudeScalable(midA, hwA);
  expect(ampA.middle).toEqual(midA);
  expect(ampA.halfWidth).toEqual(hwA);
  const ampB = new AmplitudeScalable(midB, hwB);
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

  const seisA = Seismogram.createFromContiguousData(yValues, sampleRate, startTime);
  const sensA = new InstrumentSensitivity(.02, 1, "m/s", "count");
  const sddA = SeismogramDisplayData.fromSeismogram(seisA);
  sddA.sensitivity = sensA;

  const maxB = 10;
  const yValuesB = new Int32Array([-1*maxB, 0, maxB]);
  const seisB = Seismogram.createFromContiguousData(yValuesB, sampleRate, startTime);
  const sensB = new InstrumentSensitivity(.05, 1, "m/s", "count");
  const sddB = SeismogramDisplayData.fromSeismogram(seisB);
  sddB.sensitivity = sensB;

  const linkAmpScale = new LinkedAmplitudeScale();

  const seisConfig = new SeismographConfig();
  seisConfig.linkedAmplitudeScale = linkAmpScale;
  const graph = new Seismograph([sddA, sddB], seisConfig);
  return Promise.all(linkAmpScale.recalculate()).then(() => {
    expect(linkAmpScale.halfWidth).toEqual(maxB/sensB.sensitivity);
    expect(graph.amp_scalable.halfWidth).toEqual(maxB/sensB.sensitivity);
  });
});

test("time scalable test", () => {
  const oneSec = Duration.fromMillis(1000);
  const timeA = new TimeScalable(Duration.fromMillis(0), Duration.fromMillis(0));
  const timeB = new TimeScalable(Duration.fromMillis(0), oneSec);
  const linkTimeScale = new LinkedTimeScale([timeA, timeB]);
  expect(linkTimeScale.duration).toEqual(oneSec);
})
