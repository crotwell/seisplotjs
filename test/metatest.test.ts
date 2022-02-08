import './jestRatioMatchers';

test("metatest", () => {
  expect(.0001).toBeCloseToRatio(0, 3, .0002, 3);
  expect(7.001).toBeCloseToRatio(7, 3);
  expect([7000.001, 1999.999]).arrayToBeCloseTo([7000, 2000], 2);
  expect([7001, 1999]).arrayToBeCloseToRatio([7000, 2000], 3);
});
