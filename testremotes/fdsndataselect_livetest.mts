
import {DataSelectQuery} from '../src/fdsndataselect';
import {Seismogram} from '../src/seismogram';
import {setDefaultFetch} from '../src/util';

import fetch from 'cross-fetch';
setDefaultFetch(fetch);

test("version", () => {
  const avail = new DataSelectQuery();
  return avail.queryVersion().then( res => {
    expect(res.length).toBeGreaterThan(1);
  });
});

test("do test", () => {
  const dsQuery = new DataSelectQuery()
    .networkCode("CO")
    .stationCode("BIRD")
    .channelCode("HHZ")
    .startTime("2021-12-27T19:18:54Z")
    .endTime("2021-12-27T19:22:54Z");
  return dsQuery.querySeismograms().then((seisList: Array<Seismogram>) => {
    expect(seisList.length).toEqual(1);
  });
});
