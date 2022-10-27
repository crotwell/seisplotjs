
import {FDSNSourceId, NetworkSourceId, StationSourceId} from '../src/fdsnsourceid';

test("simple FDSN sourceId", () => {
  let netCode = "XX";
  let staCode = "ABCD";
  let locCode = "00";
  let bandCode = "B";
  let sourceCode = "H";
  let subsourceCode = "Z";
  let sid = FDSNSourceId.parse(`FDSN:${netCode}_${staCode}_${locCode}_${bandCode}_${sourceCode}_${subsourceCode}`);
  expect(sid.networkCode).toBe(netCode);
  expect(sid.stationCode).toBe(staCode);
  expect(sid.locationCode).toBe(locCode);
  expect(sid.bandCode).toBe(bandCode);
  expect(sid.sourceCode).toBe(sourceCode);
  expect(sid.subsourceCode).toBe(subsourceCode);
});

test("test equals", () => {
  let sidA = FDSNSourceId.createUnknown(20);
  let sidB = FDSNSourceId.createUnknown(20);
  expect(sidA).toEqual(sidB);
  expect(sidA.equals(sidB)).toBeTrue();
})

test("simple FDSN station sourceId", () => {
  let netCode = "XX";
  let staCode = "ABCD";
  let sid = StationSourceId.parse(`FDSN:${netCode}_${staCode}`);
  expect(sid.networkCode).toBe(netCode);
  expect(sid.stationCode).toBe(staCode);
});


test("simple FDSN network sourceId", () => {
  let netCode = "XX";
  let sid = NetworkSourceId.parse(`FDSN:${netCode}`);
  expect(sid.networkCode).toBe(netCode);
});
