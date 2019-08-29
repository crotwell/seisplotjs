// @flow

import * as fdsndatacenters from '../src/fdsndatacenters.js';
import * as util from '../src/util.js';
let moment = util.moment;


test( "form url test", () => {
  let query = new fdsndatacenters.DataCentersQuery();
  const NAME = "IRISDMC";
  const SERVICES = "fdsnws-dataselect-1";
  const INCLUDE_DATASETS = true;
  const FDNS_HOST = "www.fdsn.org";
  const MAG_TYPE = "mw";
  expect(query.host(FDNS_HOST)).toBe(query);
  expect(query.host()).toBe(FDNS_HOST);
  expect(query.name(NAME)).toBe(query);
  expect(query.name()).toBe(NAME);
  expect(query.services(SERVICES)).toBe(query);
  expect(query.services()).toBe(SERVICES);
  expect(query.includeDataSets(INCLUDE_DATASETS)).toBe(query);
  expect(query.includeDataSets()).toBe(INCLUDE_DATASETS);
  const url = query.formURL();
  expect(url).toBeDefined();
  // eventid is first, so no &
  expect(url).toContain('?name=');
  for(const k of ['services', 'includedatasets']) {
    expect(url).toContain('&'+k+'=');
  }
  expect(query.formURL()).toContain("http"); // might be http or https
  expect(query.formURL()).toContain("://www.fdsn.org/ws/datacenters/1/query?");
});
