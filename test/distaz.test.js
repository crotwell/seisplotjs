// @flow
let { expect, test } = global;

import {kmtodeg, degtokm, distaz } from '../src/distaz.js';

test("deg km convert", () => {
  expect(kmtodeg(degtokm(45))).toBe(45);
});

test("basic dist south pole", () => {
    var result = distaz(0, 0, -90, 0);
    expect(result.delta).toBe(90);
    expect(result.az).toBe(0);
    expect(result.baz).toBe(180);
});

test("basic dist north pole", () => {
    var result = distaz(0, 0, 90, 0);
    expect(result.delta).toBe(90);
    expect(result.az).toBe(180);
    expect(result.baz).toBe(0);
});
