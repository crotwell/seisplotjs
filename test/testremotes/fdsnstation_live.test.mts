import {describe, expect, test} from 'vitest';

import * as fdsnstation from "../../src/fdsnstation.mjs";

import {setDefaultFetch} from "../../src/util.mjs";
import fetch from "cross-fetch";
setDefaultFetch(fetch);

/**
 * @module-tag remotes
 */

test.skip("version", () => {
  const avail = new fdsnstation.StationQuery();
  return avail.queryVersion().then( res => {
    expect(res.length).toBeGreaterThan(1);
  });
});


test("do post test", () => {
  const postLines = `CO HAW * HHZ 2010-03-11T00:00:00 2599-12-31T23:59:59
CO JSC * HHZ 2009-04-13T00:00:00 2599-12-31T23:59:59`.split('\n');

  const stationQuery = new fdsnstation.StationQuery();
  const level = 'station';
  expect(stationQuery.includeRestricted(true)).toBe(stationQuery);
  expect(stationQuery.getIncludeRestricted()).toEqual(true);
  // earthscope no longer supports availability
  //expect(stationQuery.includeAvailability(true)).toBe(stationQuery);
  //expect(stationQuery.getIncludeAvailability()).toEqual(true);
  //expect(stationQuery.matchTimeseries(true)).toBe(stationQuery);
  //expect(stationQuery.getMatchTimeseries()).toEqual(true);
  expect(stationQuery.format('xml')).toBe(stationQuery);
  expect(stationQuery.getFormat()).toEqual('xml');
  expect(stationQuery.nodata(404)).toBe(stationQuery);
  expect(stationQuery.getNodata()).toEqual(404);
  console.log(`url: ${stationQuery.formPostURL()}`)
  console.log(`post: ${stationQuery.createPostBody(level, postLines)}`)
  return stationQuery.postQuery(level , postLines).then(netArray => {
    expect(netArray).toHaveLength(1);
    expect(netArray[0].stations).toHaveLength(2);
  });
});
