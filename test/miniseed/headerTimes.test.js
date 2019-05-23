
import * as miniseed from '../../src/miniseed.js';
import  {moment} from '../../src/util';


test("time of sample", () => {
  const dh = new miniseed.DataHeader();
  dh.sampleRate = 1;
  dh.numSamples = 100;
  expect(dh.timeOfSample(1)).toEqual(dh.start.add(1, 'second'));
});

test("contig", () => {
  const dhFirst = new miniseed.DataHeader();
  dhFirst.sampleRate = 1;
  dhFirst.numSamples = 100;
  dhFirst.end = dhFirst.timeOfSample(dhFirst.numSamples-1);
  const drFirst = new miniseed.DataRecord(dhFirst, null);
  const dhSecond = new miniseed.DataHeader();
  dhSecond.sampleRate = 1;
  dhSecond.numSamples = 100;
  dhSecond.start = moment.utc(dhFirst.start).add(dhFirst.numSamples, 'seconds');
  dhSecond.end = dhSecond.timeOfSample(dhSecond.numSamples-1);
  const drSecond = new miniseed.DataRecord(dhSecond, null);
  expect(dhFirst.timeOfSample(dhFirst.numSamples)).toEqual(dhSecond.start);
  expect(miniseed.areContiguous(drFirst, drSecond)).toBe(true);
});
