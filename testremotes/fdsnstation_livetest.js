
import * as fdsnstation from '../src/fdsnstation.js';
import * as stationxml from '../src/stationxml.js';
import * as util from '../src/util.js';
let moment = util.moment;

// eslint-disable-next-line no-undef
const fetch = require('node-fetch');
// eslint-disable-next-line no-undef
global.fetch = fetch;


test("do post test", () => {
  let postLines = `CO HAW * * 2010-03-11T00:00:00 2599-12-31T23:59:59
CO JSC * * 2009-04-13T00:00:00 2599-12-31T23:59:59`.split('\n');

  let stationQuery = new fdsnstation.StationQuery();
  const level = 'station';
  expect(stationQuery.matchTimeseries(true)).toBe(stationQuery);
  expect(stationQuery.matchTimeseries()).toEqual(true);
  expect(stationQuery.includeRestricted(true)).toBe(stationQuery);
  expect(stationQuery.includeRestricted()).toEqual(true);
  expect(stationQuery.includeAvailability(true)).toBe(stationQuery);
  expect(stationQuery.includeAvailability()).toEqual(true);
  expect(stationQuery.format('xml')).toBe(stationQuery);
  expect(stationQuery.format()).toEqual('xml');
  expect(stationQuery.nodata(404)).toBe(stationQuery);
  expect(stationQuery.nodata()).toEqual(404);
  return stationQuery.postQuery(level , postLines).then(netArray => {
    expect(netArray).toHaveLength(1);
    expect(netArray[0].stations).toHaveLength(2);
  });
});