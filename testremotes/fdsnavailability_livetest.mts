import {describe, expect, test} from 'vitest';

import {AvailabilityQuery} from "../src/fdsnavailability.mjs";
import { SeismogramDisplayData} from "../src/seismogram.mjs";
import {setDefaultFetch} from "../src/util.mjs";

import fetch from "cross-fetch";
setDefaultFetch(fetch);

/**
 * @module-tag remotes
 */


test("version", () => {
  const avail = new AvailabilityQuery();
  return avail.queryVersion().then( res => {
    expect(res.length).toBeGreaterThan(1);
  });
});

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
