

import {setDefaultFetch} from '../src/util';
import fetch from 'cross-fetch';
setDefaultFetch(fetch);

import * as taup3 from '../src/taup3';

test("formURL", () => {
  const query = new taup3.TauPQuery(taup3.USC_HOST);
  query.pathBase("uscws");
  query.format(taup3.JSON_FORMAT);
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
  for(const k of ['station', 'event',
   'phase', 'format']) {
     expect(url).toContain('&'+k+'=');
   }
   expect(url).toContain("http://"+taup3.USC_HOST+"/uscws/taup/3/time?");
   return query.queryJson().then( tt => {
     expect(tt.arrivals.length).toEqual(11);
     expect(tt.sourcedepthlist).toEqual(query.getEvdepth());
     const recDepthList = query.getReceiverdepth() ? query.getReceiverdepth() : [0];
     expect(tt.receiverdepthlist).toEqual(recDepthList);
   });

});


test("multiple distances", () => {
  const query = new taup3.TauPQuery(taup3.USC_HOST);
  query.pathBase("uscws");
  //  const query = new taup3.TauPQuery("localhost");
  //  query.pathBase(fdsncommon.LOCALWS_PATH_BASE);
  //query.port(7409);
  query.format(taup3.JSON_FORMAT);
  query.distdeg([ 10, 30, 60]);
  query.phases("P");
  return query.queryJson().then( tt => {
    expect(tt.arrivals.length).toEqual(3);
  });
});
