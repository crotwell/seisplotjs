// @flow

import * as traveltime from '../../src/traveltime';

test("formURL", () => {
  // $FlowFixMe
  let query = new traveltime.TraveltimeQuery()
    .evdepth(50)
    .stalat(34).stalon(-81)
    .evlat(35).evlon(-101)
    .phases("P,S,PcP,PKiKP,PKPPKP");
  // for flow
  query = ((query: any): traveltime.TraveltimeQuery);
  let url = query.formURL();
  expect(url).toBeDefined();
  // evdepth is first, so no &
  expect(url).toContain('?evdepth=');
  for(const k of ['staloc', 'evloc',
   'phases', 'format']) {
     expect(url).toContain('&'+k+'=');
   }
   expect(url).toContain("http://"+traveltime.IRIS_HOST+"/irisws/traveltime/1/query?");

});
