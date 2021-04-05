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

test("isStringArg isNumArg", () => {
  const s1 = "asad";
  const s2 = new String("fdsafdsa");
  const n1 = 7;
  const n2 = new Number(8);
  const o = {h: "w"};
  expect(util.isStringArg(s1)).toBeTrue();
  expect(util.isStringArg(s2)).toBeTrue();
  expect(util.isStringArg(n1)).toBeFalse();
  expect(util.isStringArg(n2)).toBeFalse();
  expect(util.isStringArg(null)).toBeFalse();
  expect(util.isStringArg(o)).toBeFalse();

  expect(util.isNumArg(s1)).toBeFalse();
  expect(util.isNumArg(s2)).toBeFalse();
  expect(util.isNumArg(n1)).toBeTrue();
  expect(util.isNumArg(n2)).toBeTrue();
  expect(util.isNumArg(null)).toBeFalse();
  expect(util.isNumArg(o)).toBeFalse();
});
