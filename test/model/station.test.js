import {Network, Station, Channel} from '../../src/stationxml';

test("simple station", () => {
  const NET_CODE = "AA";
  const STA_CODE = "JSC";
  let net = new Network(NET_CODE);
  let station = new Station(net, STA_CODE);
  station.latitude = 47;
  expect(station.latitude).toBe(47);
  expect(station.stationCode).toBe(STA_CODE);
});
