// @flow

test("metatest", () => {
  // $FlowFixMe
  expect(.0001).toBeCloseToRatio(0, 3, .0002, 3);
    // $FlowFixMe
  expect(7.001).toBeCloseToRatio(7, 3);
    // $FlowFixMe
  expect([7001, 1999]).arrayToBeCloseToRatio([7000, 2000], 3);
});
