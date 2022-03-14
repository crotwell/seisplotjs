
import * as util from '../src/util.js';
import {isoToDateTime, toIsoWoZ, StartEndDuration} from '../src/util.js';
import {DateTime, Duration} from 'luxon';

test( "_toIsoWoZ test", () => {
  const s = "2018-01-01T12:34:45.000";
  expect(toIsoWoZ(isoToDateTime(s))).toBe(s);
  const sz = "2018-01-01T12:34:45.000Z";
  expect(toIsoWoZ(isoToDateTime(sz))).toBe(s);
});

test("StartEndDuration", () => {
  const s = "2018-01-01T12:34:45.000";
  const e = "2018-01-01T12:44:45.000";
  const d = Duration.fromISO("PT10M");
  expect(d.toHuman()).toBe("10 minutes");
  let sed = new StartEndDuration(s,e);
  expect(sed.duration.toISO()).toBe("PT600S");
  // luxon toHuman doesn't work well yet
  //expect(sed.duration.toHuman()).toBe("10 minutes");
  sed = new StartEndDuration(s,null,d);
  expect(sed.duration.toISO()).toBe("PT10M");
  //expect(sed.duration.toHuman()).toBe("10 minutes");
  sed = new StartEndDuration(null,e,d);
  expect(sed.duration.toISO()).toBe("PT10M");
  //expect(sed.duration.toHuman()).toBe("10 minutes");

  sed = new StartEndDuration(null, null, d);
  expect(sed.duration.toHuman()).toBe("10 minutes");
  sed = new StartEndDuration(s,null,null);
  expect(sed.duration.as('years')).toBeGreaterThan(300);
  expect(sed.endTime).toEqual(util.WAY_FUTURE);

  let ss = isoToDateTime(s);
  let ee = isoToDateTime(e);
  let day = Duration.fromObject({ days: 1, hours: 2, minutes: 7 });
  let overlap = new StartEndDuration(ss.minus(day),ee.plus(day));
  expect(sed.overlaps(overlap)).toBeTrue();
  expect(overlap.overlaps(sed)).toBeTrue();
  overlap = new StartEndDuration(ss.minus(day),ee.minus(day));
  expect(sed.overlaps(overlap)).toBeFalse();
  expect(overlap.overlaps(sed)).toBeFalse();
  overlap = new StartEndDuration(ss.minus(day),ss.minus(Duration.fromMillis(1)));
  expect(sed.overlaps(overlap)).toBeFalse();
  expect(overlap.overlaps(sed)).toBeFalse();
  overlap = new StartEndDuration(ss.minus(day),ss.plus(Duration.fromMillis(1)));
  expect(sed.overlaps(overlap)).toBeTrue();
  expect(overlap.overlaps(sed)).toBeTrue();
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


test("version", () => {
  expect(util.version).toContain('3.0');
});
