
import {checkProtocol} from "../src/util.mjs";

test("simple protocol check", () => {
  expect(checkProtocol()).toBe('http:');
});
