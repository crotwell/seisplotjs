
import {EventQuery} from '../src/fdsnevent';
import {Quake} from '../src/quakeml';
import {setDefaultFetch, isoToDateTime} from '../src/util';

import { Interval} from 'luxon';

import fetch from 'cross-fetch';
setDefaultFetch(fetch);

test("version", () => {
  const avail = new EventQuery();
  return avail.queryVersion().then( res => {
    expect(res.length).toBeGreaterThan(1);
  });
});

test("catalogs", () => {
  const avail = new EventQuery();
  return avail.queryCatalogs().then( res => {
    expect(res.length).toBeGreaterThan(1);
  });
});

test("contributors", () => {
  const avail = new EventQuery();
  return avail.queryContributors().then( res => {
    expect(res.length).toBeGreaterThan(1);
  });
});

test("do test", () => {
  const localQueryTimeWindow =
    Interval.fromDateTimes(isoToDateTime('2020-08-21'),
                           isoToDateTime('2020-08-22'));
  const localEventQuery = new EventQuery()
    .timeRange(localQueryTimeWindow)
    .latitude(33.72).longitude(-81)
    .maxRadius(2);

  return localEventQuery.query().then((quakeList: Array<Quake>) => {
    expect(quakeList.length).toEqual(1);
  });
});
