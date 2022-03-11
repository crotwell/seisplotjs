
import * as fdsnavailability from '../src/fdsnavailability';
import * as util from '../src/util';


test( "query setter test", () => {
  let dsQuery = new fdsnavailability.AvailabilityQuery();
  const NET = 'CO';
  const STA = 'JSC';
  const LOC = '00';
  const CHAN = 'HHZ';
  const DURATION = 300;
  const timeWindow = new util.StartEndDuration( '2018-01-01T12:34:45.000Z', null, DURATION, 0);
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
  expect(dsQuery.startTime(timeWindow.startTime)).toBe(dsQuery);
  expect(dsQuery.getStartTime()).toBe(timeWindow.startTime);
  expect(dsQuery.endTime(timeWindow.endTime)).toBe(dsQuery);
  expect(dsQuery.getEndTime()).toBe(timeWindow.endTime);
  expect(dsQuery.merge('quality')).toBe(dsQuery);
  expect(dsQuery.getMerge()).toEqual('quality');
  expect(dsQuery.quality(QUALITY)).toBe(dsQuery);
  expect(dsQuery.getQuality()).toEqual(QUALITY);
  expect(dsQuery.format(FORMAT)).toBe(dsQuery);
  expect(dsQuery.getFormat()).toEqual(FORMAT);
  expect(dsQuery.nodata(404)).toBe(dsQuery);
  expect(dsQuery.getNodata()).toEqual(404);
  expect(dsQuery.specVersion(1)).toBe(dsQuery);
  expect(dsQuery.getSpecVersion()).toEqual(1);
  expect(dsQuery.port(80)).toBe(dsQuery);
  expect(dsQuery.getPort()).toEqual(80);
  expect(dsQuery.getHost()).toEqual("service.iris.edu");
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
