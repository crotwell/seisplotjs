
import {IRIS_HOST} from '../src/fdsncommon';
import {setDefaultFetch} from '../src/util';
import fetch from 'cross-fetch';
setDefaultFetch(fetch);

import * as traveltime from '../src/traveltime';

test("version", () => {
  const ttQuery = new traveltime.TraveltimeQuery();
  return ttQuery.queryVersion().then( res => {
    expect(res.length).toBeGreaterThan(1);
  });
});

test("taupversion", () => {
  const ttQuery = new traveltime.TraveltimeQuery();
  return ttQuery.queryTauPVersion().then( res => {
    expect(res.length).toBeGreaterThan(1);
  });
});

test("formURL", () => {
  const query = new traveltime.TraveltimeQuery();
  query.format(traveltime.JSON_FORMAT);
  expect(query.evdepth(50)).toBe(query);
  expect(query.stalat(34)).toBe(query);
  expect(query.stalon(-81)).toBe(query);
  expect(query.evlat(35)).toBe(query);
  expect(query.evlon(-101)).toBe(query);
  expect(query.phases("P,S,PcP,PKiKP,PKPPKP")).toBe(query);
  const url = query.formURL();
  expect(url).toBeDefined();
  // evdepth is first, so no &
  expect(url).toContain('?evdepth=');
  for(const k of ['staloc', 'evloc',
   'phases', 'format']) {
     expect(url).toContain('&'+k+'=');
   }
   expect(url).toContain("http://"+IRIS_HOST+"/irisws/traveltime/1/query?");
   return query.queryJson().then( tt => {
     expect(tt.arrivals.length).toEqual(11);
     expect(tt.sourcedepth).toEqual(query.getEvdepth());
     expect(tt.receiverdepth).toEqual(0);
   });

});


test("multiple distances", () => {
  const query = new traveltime.TraveltimeQuery();
  query.format(traveltime.JSON_FORMAT);
  query.distdeg([ 10, 30, 60]);
  query.phases("P");
  return query.queryJson().then( tt => {
    expect(tt.arrivals.length).toEqual(3);
  });
});
