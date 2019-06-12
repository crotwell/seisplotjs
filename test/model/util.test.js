// @flow

import * as util from '../../src/util.js';

test( "_toIsoWoZ test", () => {
  const s = "2018-01-01T12:34:45.000";
  expect(util.toIsoWoZ(util.moment.utc(s))).toBe(s);
});
