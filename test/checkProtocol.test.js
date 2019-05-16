import {checkProtocol} from '../src/util.js';

test("simple protocol check", () => {
  expect(checkProtocol()).toBe('http:');
});
