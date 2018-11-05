import * as model from '../../src/model';

test("simple station", () => {
  const NET_CODE = "AA";
  const STA_CODE = "JSC";
  let net = new model.Network(NET_CODE);
  let station = new model.Station(net, STA_CODE);
  station.latitude = 47;
  expect(station.latitude).toBe(47);
  expect(station.stationCode).toBe(STA_CODE);
});
