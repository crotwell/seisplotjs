
import {AvailabilityQuery} from '../src/fdsnavailability';
import { SeismogramDisplayData} from '../src/seismogram';
import * as util from '../src/util.js';
let moment = util.moment;

// eslint-disable-next-line no-undef
const fetch = require('node-fetch');
// eslint-disable-next-line no-undef
global.fetch = fetch;


test("do test", () => {
  const avail = new AvailabilityQuery()
    .networkCode("CO")
    .stationCode("BIRD")
    .startTime(moment.utc("2021-12-27T19:18:54Z")
    .endTime(moment.utc("2021-12-27T19:22:54Z"));
  avail.query().then((sddList: Array<SeismogramDisplayData>) => {
     sddList.forEach(sdd => console.log(sdd))
  });
});
