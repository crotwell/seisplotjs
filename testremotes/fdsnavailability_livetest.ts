
import {AvailabilityQuery} from '../src/fdsnavailability';
import { SeismogramDisplayData} from '../src/seismogram';

// eslint-disable-next-line no-undef
const fetch = require('node-fetch');
// eslint-disable-next-line no-undef
global.fetch = fetch;


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
