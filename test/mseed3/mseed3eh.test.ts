
import { TextDecoder } from 'util';
// @ts-expect-error browser and node TextDecoder are somehow different???
global.TextDecoder = TextDecoder;

import {isoToDateTime} from '../../src/util';
import * as mseed3 from '../../src/mseed3';
import * as mseed3eh from '../../src/mseed3eh';
import fs from 'fs';

const filename = "test/mseed3/testeh.ms3";
test("bag mseed3 extra headers"+filename, () => {
  expect(fs.existsSync(filename)).toEqual(true);
  const xData = fs.readFileSync(filename);
  expect(xData.length).toEqual(251);
  expect(xData[0]).toEqual(77);
  expect(xData[1]).toEqual(83);
  expect(xData[2]).toEqual(3);
  const ab = xData.buffer.slice(xData.byteOffset, xData.byteOffset + xData.byteLength);
  const dataView = new DataView(ab);
  expect(dataView.getUint8(0)).toEqual(77);
  expect(dataView.getUint8(1)).toEqual(83);
  expect(dataView.getUint8(2)).toEqual(3);
  const parsed = mseed3.parseMSeed3Records(ab);
  expect(parsed.length).toEqual(1);
  const rec = parsed[0];
  expect(mseed3.crcToHexString(rec.header.crc)).toEqual("0x59A83F5A");
  const eh = rec.extraHeaders;
  const q = mseed3eh.ehToQuake(eh);
  expect(q).not.toBeNull();
  expect(q?.preferredOrigin).toBeDefined();
  expect(q?.preferredOrigin?.time).toEqual(isoToDateTime("2024-02-06T11:30:03Z"))
});
