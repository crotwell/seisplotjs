
import * as util from '../src/util.js';
import {isoToDateTime, toIsoWoZ} from '../src/util.js';

test( "_toIsoWoZ test", () => {
  const s = "2018-01-01T12:34:45.000";
  expect(toIsoWoZ(isoToDateTime(s))).toBe(s);
  const sz = "2018-01-01T12:34:45.000Z";
  expect(toIsoWoZ(isoToDateTime(sz))).toBe(s);
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

test("clone fetch init", () => {
  let fetchInit = util.defaultFetchInitObj();
  let cloned = util.cloneFetchInitObj(fetchInit);
  expect(cloned.cache).toEqual(fetchInit.cache);
  expect(cloned.redirect).toEqual(fetchInit.redirect);
  expect(cloned.mode).toEqual(fetchInit.mode);
  expect(cloned.referrer).toEqual(fetchInit.referrer);
  for (const [key, value] of Object.entries(fetchInit.headers)) {
    expect(cloned.headers[key]).toEqual(fetchInit.headers[key]);
    expect(cloned.headers[key]).toEqual(value);
  }
});
