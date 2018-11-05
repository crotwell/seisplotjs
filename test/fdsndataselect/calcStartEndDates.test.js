import * as fdsndataselect from '../../src/fdsndataselect.js';

test("calcStartEndDates", () => {
  const duration = 300;
  const clockOffset = 0;
  let timeWindow = fdsndataselect.calcStartEndDates(null, null, duration, clockOffset);
  expect(timeWindow.end.valueOf()).toEqual(timeWindow.start.valueOf()+duration*1000);
  expect(timeWindow.duration.asSeconds()).toBe(duration);
  timeWindow = fdsndataselect.calcStartEndDates("2018-01-02T12:34:45", null, duration, clockOffset);
  expect(timeWindow.end.valueOf()).toEqual(timeWindow.start.valueOf()+duration*1000);
  timeWindow = fdsndataselect.calcStartEndDates(null, "2018-01-02T12:34:45", duration, clockOffset);
  expect(timeWindow.end.valueOf()).toEqual(timeWindow.start.valueOf()+duration*1000);
  timeWindow = fdsndataselect.calcStartEndDates("2018-01-02T12:34:45", "2018-01-02T12:34:46", null, clockOffset);
  expect(timeWindow.duration.seconds()).toBe(1);

});
