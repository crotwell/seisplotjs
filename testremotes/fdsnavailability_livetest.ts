
import {AvailabilityQuery} from '../src/fdsnavailability';
import { SeismogramDisplayData} from '../src/seismogram';
import {setDefaultFetch} from '../src/util';

import fetch from 'cross-fetch';
setDefaultFetch(fetch);


test("do test", () => {
  const avail = new AvailabilityQuery()
    .networkCode("CO")
    .stationCode("BIRD")
    .channelCode("HHZ")
    .startTime("2021-12-27T19:18:54Z")
    .endTime("2021-12-27T19:22:54Z");
  return avail.query().then((sddList: Array<SeismogramDisplayData>) => {
    expect(sddList.length).toEqual(1);
  });
});
