
// eslint-disable-next-line no-undef
const fetch = require('node-fetch');
// eslint-disable-next-line no-undef
global.fetch = fetch;

import * as traveltime from '../src/traveltime';

test("formURL", () => {
  let query = new traveltime.TraveltimeQuery();
  query.format(traveltime.JSON_FORMAT);
  expect(query.evdepth(50)).toBe(query);
  expect(query.stalat(34)).toBe(query);
  expect(query.stalon(-81)).toBe(query);
  expect(query.evlat(35)).toBe(query);
  expect(query.evlon(-101)).toBe(query);
  expect(query.phases("P,S,PcP,PKiKP,PKPPKP")).toBe(query);
  let url = query.formURL();
  expect(url).toBeDefined();
  // evdepth is first, so no &
  expect(url).toContain('?evdepth=');
  for(const k of ['staloc', 'evloc',
   'phases', 'format']) {
     expect(url).toContain('&'+k+'=');
   }
   expect(url).toContain("http://"+traveltime.IRIS_HOST+"/irisws/traveltime/1/query?");
   return query.query().then( tt => {
     console.log(`got something: ${tt.arrivals.length}`);
     expect(tt.arrivals.length).toEqual(11);
   });

});
