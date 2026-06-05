
import * as fdsnstation from '../src/fdsnstation';

import {setDefaultFetch} from '../src/util';
import fetch from 'cross-fetch';
setDefaultFetch(fetch);

test("version", () => {
  const avail = new fdsnstation.StationQuery();
  return avail.queryVersion().then( res => {
    expect(res.length).toBeGreaterThan(1);
  });
});


test("do post test", () => {
  const postLines = `CO HAW * * 2010-03-11T00:00:00 2599-12-31T23:59:59
CO JSC * * 2009-04-13T00:00:00 2599-12-31T23:59:59`.split('\n');

  const stationQuery = new fdsnstation.StationQuery();
  const level = 'station';
  expect(stationQuery.matchTimeseries(true)).toBe(stationQuery);
  expect(stationQuery.getMatchTimeseries()).toEqual(true);
  expect(stationQuery.includeRestricted(true)).toBe(stationQuery);
  expect(stationQuery.getIncludeRestricted()).toEqual(true);
  expect(stationQuery.includeAvailability(true)).toBe(stationQuery);
  expect(stationQuery.getIncludeAvailability()).toEqual(true);
  expect(stationQuery.format('xml')).toBe(stationQuery);
  expect(stationQuery.getFormat()).toEqual('xml');
  expect(stationQuery.nodata(404)).toBe(stationQuery);
  expect(stationQuery.getNodata()).toEqual(404);
  return stationQuery.postQuery(level , postLines).then(netArray => {
    expect(netArray).toHaveLength(1);
    expect(netArray[0].stations).toHaveLength(2);
  });
});
