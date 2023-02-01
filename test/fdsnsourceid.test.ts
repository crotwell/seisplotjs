
import {FDSNSourceId, NetworkSourceId, StationSourceId} from '../src/fdsnsourceid';

test("simple FDSN sourceId", () => {
  const netCode = "XX";
  const staCode = "ABCD";
  const locCode = "00";
  const bandCode = "B";
  const sourceCode = "H";
  const subsourceCode = "Z";
  const sid = FDSNSourceId.parse(`FDSN:${netCode}_${staCode}_${locCode}_${bandCode}_${sourceCode}_${subsourceCode}`);
  expect(sid.networkCode).toBe(netCode);
  expect(sid.stationCode).toBe(staCode);
  expect(sid.locationCode).toBe(locCode);
  expect(sid.bandCode).toBe(bandCode);
  expect(sid.sourceCode).toBe(sourceCode);
  expect(sid.subsourceCode).toBe(subsourceCode);
});

test("test equals", () => {
  const sidA = FDSNSourceId.createUnknown(20);
  const sidB = FDSNSourceId.createUnknown(20);
  expect(sidA).toEqual(sidB);
  expect(sidA.equals(sidB)).toBeTrue();
})

test("simple FDSN station sourceId", () => {
  const netCode = "XX";
  const staCode = "ABCD";
  const sid = StationSourceId.parse(`FDSN:${netCode}_${staCode}`);
  expect(sid.networkCode).toBe(netCode);
  expect(sid.stationCode).toBe(staCode);
});


test("simple FDSN network sourceId", () => {
  const netCode = "XX";
  const sid = NetworkSourceId.parse(`FDSN:${netCode}`);
  expect(sid.networkCode).toBe(netCode);
});
