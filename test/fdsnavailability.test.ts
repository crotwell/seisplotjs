// @flow

import * as fdsnavailability from '../src/fdsnavailability';
import * as util from '../src/util';
let moment = util.moment;


test( "query setter test", () => {
  let dsQuery = new fdsnavailability.AvailabilityQuery();
  const NET = 'CO';
  const STA = 'JSC';
  const LOC = '00';
  const CHAN = 'HHZ';
  const DURATION = 300;
  const timeWindow = new util.StartEndDuration( moment.utc('2018-01-01T12:34:45.000Z'), null, DURATION, 0);
  const QUALITY = 'D';
  const FORMAT = 'json';
  expect(dsQuery.networkCode(NET)).toBe(dsQuery);
  expect(dsQuery.networkCode()).toBe(NET);
  expect(dsQuery.stationCode(STA)).toBe(dsQuery);
  expect(dsQuery.stationCode()).toBe(STA);
  expect(dsQuery.locationCode(LOC)).toBe(dsQuery);
  expect(dsQuery.locationCode()).toBe(LOC);
  expect(dsQuery.channelCode(CHAN)).toBe(dsQuery);
  expect(dsQuery.channelCode()).toBe(CHAN);
  expect(dsQuery.startTime(timeWindow.startTime)).toBe(dsQuery);
  expect(dsQuery.startTime()).toBe(timeWindow.startTime);
  expect(dsQuery.endTime(timeWindow.endTime)).toBe(dsQuery);
  expect(dsQuery.endTime()).toBe(timeWindow.endTime);
  expect(dsQuery.merge('quality')).toBe(dsQuery);
  expect(dsQuery.merge()).toEqual('quality');
  expect(dsQuery.quality(QUALITY)).toBe(dsQuery);
  expect(dsQuery.quality()).toEqual(QUALITY);
  expect(dsQuery.format(FORMAT)).toBe(dsQuery);
  expect(dsQuery.format()).toEqual(FORMAT);
  expect(dsQuery.nodata(404)).toBe(dsQuery);
  expect(dsQuery.nodata()).toEqual(404);
  expect(dsQuery.specVersion(1)).toBe(dsQuery);
  expect(dsQuery.specVersion()).toEqual(1);
  expect(dsQuery.port(80)).toBe(dsQuery);
  expect(dsQuery.port()).toEqual(80);
  expect(dsQuery.host()).toEqual("service.iris.edu");
  const url = dsQuery.formURL();
  expect(url).toBeDefined();
  // net is first, so no &
  expect(url).toContain('?net=');
  for(const k of ['sta', 'loc', 'cha',
   'starttime', 'endtime',
   'merge', 'quality', 'format', 'nodata']) {
     expect(url).toContain('&'+k+'=');
   }
   expect(url).toContain("http://"+fdsnavailability.IRIS_HOST+"/fdsnws/availability/1/query?");
});
