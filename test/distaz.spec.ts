

import {kmtodeg, degtokm, distaz } from '../src/distaz';

test("deg km convert", () => {
  expect(kmtodeg(degtokm(45))).toBe(45);
});

test("basic dist south pole", () => {
    const result = distaz(0, 0, -90, 0);
    expect(result.delta).toBe(90);
    expect(result.az).toBe(0);
    expect(result.baz).toBe(180);
});

test("basic dist north pole", () => {
    const result = distaz(0, 0, 90, 0);
    expect(result.delta).toBe(90);
    expect(result.az).toBe(180);
    expect(result.baz).toBe(0);
});
