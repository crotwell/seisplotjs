// @flow

import * as fdsndataselect from '../../src/fdsndataselect.js';
import * as util from '../../src/util.js';
import {DateTime} from 'luxon';


test( "query setter test", () => {
  let dsQuery = new fdsndataselect.DataSelectQuery();
  const NET = 'CO';
  const STA = 'JSC';
  const LOC = '00';
  const CHAN = 'HHZ';
  const DURATION = 300;
  const timeWindow = new util.StartEndDuration('2018-01-01T12:34:45.000Z', null, DURATION, 0);
  const MIN_LENGTH = 120;
  const QUALITY = 'D';
  const FORMAT = 'miniseed';
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
  expect(dsQuery.minimumLength(MIN_LENGTH)).toBe(dsQuery);
  expect(dsQuery.minimumLength()).toBe(MIN_LENGTH);
  expect(dsQuery.longestOnly(true)).toBe(dsQuery);
  expect(dsQuery.longestOnly()).toEqual(true);
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
   'minimumlength', 'longestonly', 'quality', 'format', 'nodata']) {
     expect(url).toContain('&'+k+'=');
   }
   expect(url).toContain("http://"+fdsndataselect.IRIS_HOST+"/fdsnws/dataselect/1/query?");
});
