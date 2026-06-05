
import {IRIS_HOST} from '../src/fdsncommon';
import {setDefaultFetch} from '../src/util';
import fetch from 'cross-fetch';
setDefaultFetch(fetch);

import * as syngine from '../src/syngine';

test("version", () => {
  const query = new syngine.SyngineQuery();
  return query.queryVersion().then( res => {
    expect(res.length).toBeGreaterThan(1);
  });
});

test("formURL", () => {
  const query = new syngine.SyngineQuery();
  expect(query.host(IRIS_HOST)).toBe(query);
  expect(query.originTime('2010-02-27T06:30:00.000')).toBe(query);
  expect(query.sourceLatitude(-35.98)).toBe(query);
  expect(query.sourceLongitude(-73)).toBe(query);
  expect(query.sourceDepthInMeters(23200)).toBe(query);
  expect(query.sourceMomentTensor([1.04e22,-0.039e22,-1e22,0.304e22,-1.52,-0.119e22])).toBe(query);
  expect(query.receiverLatitude(47.6)).toBe(query);
  expect(query.receiverLongitude(-122.3)).toBe(query);
  expect(query.components('Z')).toBe(query);
  return query.querySeismograms().then(sddList => {
    expect(sddList.length).toBe(1);
  });
});
