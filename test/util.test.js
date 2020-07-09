// @flow

import * as util from '../src/util.js';
import {toIsoWoZ, StartEndDuration, moment} from '../src/util.js';

test( "_toIsoWoZ test", () => {
  const s = "2018-01-01T12:34:45.000";
  expect(toIsoWoZ(util.moment.utc(s))).toBe(s);
});

test("StartEndDuration", () => {
  const s = "2018-01-01T12:34:45.000";
  const e = "2018-01-01T12:44:45.000";
  const d = moment.duration("PT10M");
  expect(d.humanize()).toBe("10 minutes");
  let sed = new StartEndDuration(s,e);
  expect(sed.duration.humanize()).toBe("10 minutes");
  sed = new StartEndDuration(s,null,d);
  expect(sed.duration.humanize()).toBe("10 minutes");
  sed = new StartEndDuration(null,e,d);
  expect(sed.duration.humanize()).toBe("10 minutes");

  sed = new StartEndDuration(null, null, d);
  expect(sed.duration.humanize()).toBe("10 minutes");
  sed = new StartEndDuration(s,null,null);
  expect(sed.duration.asYears()).toBeGreaterThan(300);
  expect(sed.endTime).toEqual(util.WAY_FUTURE);

});
