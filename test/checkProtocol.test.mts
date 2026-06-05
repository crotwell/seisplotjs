
import {checkProtocol} from '../src/util';

test("simple protocol check", () => {
  expect(checkProtocol()).toBe('http:');
});
