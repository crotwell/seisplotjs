
import * as fdsnavailability from '../src/fdsnavailability';
import {EARTHSCOPE_HOST} from '../src/fdsncommon';
import * as util from '../src/util';
import {validStartTime, validEndTime} from '../src/util';
import {Duration, Interval} from 'luxon';

test( "query setter test", () => {
  const dsQuery = new fdsnavailability.AvailabilityQuery();
  dsQuery.protocol("https:");
  const NET = 'CO';
  const STA = 'JSC';
  const LOC = '00';
  const CHAN = 'HHZ';
  const DURATION = Duration.fromMillis(300*1000);
  const timeWindow = Interval.after(util.isoToDateTime('2018-01-01T12:34:45.000Z'), DURATION);
  const QUALITY = 'D';
  const FORMAT = 'json';
  expect(dsQuery.networkCode(NET)).toBe(dsQuery);
  expect(dsQuery.getNetworkCode()).toBe(NET);
  expect(dsQuery.stationCode(STA)).toBe(dsQuery);
  expect(dsQuery.getStationCode()).toBe(STA);
  expect(dsQuery.locationCode(LOC)).toBe(dsQuery);
  expect(dsQuery.getLocationCode()).toBe(LOC);
  expect(dsQuery.channelCode(CHAN)).toBe(dsQuery);
  expect(dsQuery.getChannelCode()).toBe(CHAN);
  expect(dsQuery.startTime(validStartTime(timeWindow))).toBe(dsQuery);
  expect(dsQuery.getStartTime()).toBe(timeWindow.start);
  expect(dsQuery.endTime(validEndTime(timeWindow))).toBe(dsQuery);
  expect(dsQuery.getEndTime()).toBe(timeWindow.end);
  expect(dsQuery.merge('quality')).toBe(dsQuery);
  expect(dsQuery.getMerge()).toEqual('quality');
  expect(dsQuery.quality(QUALITY)).toBe(dsQuery);
  expect(dsQuery.getQuality()).toEqual(QUALITY);
  expect(dsQuery.format(FORMAT)).toBe(dsQuery);
  expect(dsQuery.getFormat()).toEqual(FORMAT);
  expect(dsQuery.nodata(404)).toBe(dsQuery);
  expect(dsQuery.getNodata()).toEqual(404);
  expect(dsQuery.specVersion("1")).toBe(dsQuery);
  expect(dsQuery.getSpecVersion()).toEqual("1");
  expect(dsQuery.getHost()).toEqual(EARTHSCOPE_HOST);
  const url = dsQuery.formURL();
  expect(url).toBeDefined();
  // net is first, so no &
  expect(url).toContain('?net=');
  for(const k of ['sta', 'loc', 'cha',
   'starttime', 'endtime',
   'merge', 'quality', 'format', 'nodata']) {
     expect(url).toContain('&'+k+'=');
   }
   expect(url).toContain(`https://${EARTHSCOPE_HOST}/fdsnws/availability/1/query?`);
});
