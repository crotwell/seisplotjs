import checkProtocol from '../src/checkProtocol.js';

test("simple protocol check", () => {
  expect(checkProtocol()).toBe('http:');
});
