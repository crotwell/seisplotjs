// @flow

import {StartEndDuration} from '../../src/util.js';

test("calcStartEndDates", () => {
  const duration = 300;
  const clockOffset = 0;
  let timeWindow = new StartEndDuration(null, null, duration, clockOffset);
  expect(timeWindow.endTime.valueOf()).toEqual(timeWindow.startTime.valueOf()+duration*1000);
  expect(timeWindow.duration.toMillis()/1000).toBe(duration);
  timeWindow = new StartEndDuration("2018-01-02T12:34:45", null, duration, clockOffset);
  expect(timeWindow.endTime.valueOf()).toEqual(timeWindow.startTime.valueOf()+duration*1000);
  timeWindow = new StartEndDuration(null, "2018-01-02T12:34:45", duration, clockOffset);
  expect(timeWindow.endTime.valueOf()).toEqual(timeWindow.startTime.valueOf()+duration*1000);
  timeWindow = new StartEndDuration("2018-01-02T12:34:45", "2018-01-02T12:34:46", null, clockOffset);
  expect(timeWindow.duration.toMillis()).toBe(1000);

});
