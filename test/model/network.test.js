import {Network} from '../../src/stationxml';

test("simple network", () => {
  let NET_CODE = "AA";
  let net = new Network(NET_CODE);
  expect(net.networkCode).toBe(NET_CODE);
});
