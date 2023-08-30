
import fs from 'fs';

import * as traveltime from '../../src/traveltime';

test("formURL", () => {
  const query = new traveltime.TraveltimeQuery();
  query.protocol("https:");
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
   expect(url).toContain("https://"+traveltime.IRIS_HOST+"/irisws/traveltime/1/query?");

});

test("createEmptyJsonResult", () => {
  const query = new traveltime.TraveltimeQuery();
  const emptyJson = traveltime.createEmptyTraveltimeJson(query);
  expect(traveltime.isValidTraveltimeJsonType(emptyJson)).toBeTrue();
});

test("IRISWSisValidJson", () => {
  // iris ws has cap D in sourceDepth and receiverDepth while
  // TauP has sourcedepth and receiverdepth
  // make sure can read iris style, converted internally to lower case
    const filename = "./test/traveltime/data/hodge_eq_tt.json";
    const rawData = fs.readFileSync(filename, 'utf8');
    const json = JSON.parse(rawData) as unknown;
    expect(traveltime.isValidTraveltimeJsonType(json)).toBeTrue();
});
