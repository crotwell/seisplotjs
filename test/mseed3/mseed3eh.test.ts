

import { TextDecoder } from 'util';
global.TextDecoder = TextDecoder;

import {isoToDateTime} from '../../src/util';

import {MS3ExtraHeader} from '../../src/ms3ehtypes';
import * as mseed3 from '../../src/mseed3';
import * as mseed3eh from '../../src/mseed3eh';
import fs from 'fs';

const filename = "test/mseed3/testeh.ms3";
test("bag mseed3 extra headers"+filename, () => {
  expect(fs.existsSync(filename)).toEqual(true);
  const xData = fs.readFileSync(filename);
  expect(xData.length).toEqual(4322);
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
  expect(mseed3.crcToHexString(rec.header.crc)).toEqual("0x4F8F5F90");
  const eh = rec.extraHeaders as MS3ExtraHeader; // fake out typescript
  expect(eh).toBeDefined();
  expect((typeof eh)).toEqual("object");
  expect(eh?.bag?.ev?.or).toBeDefined();
  expect(mseed3eh.isValidBagOriginJsonEHType(eh?.bag?.ev?.or)).toBeTrue();
  expect(mseed3eh.isValidBagMagJsonEHType(eh?.bag?.ev?.mag)).toBeTrue();
  expect(mseed3eh.isValidBagEventJsonEHType(eh?.bag?.ev)).toBeTrue();

  const qtime = isoToDateTime("2024-02-06T11:30:03Z");
  const q = mseed3eh.ehToQuake(eh);
  expect(q).not.toBeNull();
  expect(q?.origin).toBeDefined();
  expect(q?.origin?.time).toEqual(qtime);
});

const bag_eh_filename = "test/mseed3/bag_eh.json";
test("validate bag mseed3 extra headers"+bag_eh_filename, () => {
    expect(fs.existsSync(bag_eh_filename)).toEqual(true);
    const ehData = fs.readFileSync(bag_eh_filename);
    const ab = ehData.buffer.slice(ehData.byteOffset, ehData.byteOffset + ehData.byteLength);
    const dataView = new DataView(ab);
    const jsonEH = JSON.parse(mseed3.makeString(dataView, 0, dataView.byteLength));
    expect(mseed3eh.isValidBagChannelJsonEHType(jsonEH.bag.ch)).toBeTrue();
    expect(mseed3eh.isValidBagOriginJsonEHType(jsonEH?.bag?.ev?.or)).toBeTrue();
    expect(mseed3eh.isValidBagMagJsonEHType(jsonEH?.bag?.ev?.mag)).toBeTrue();
    expect(mseed3eh.isValidBagEventJsonEHType(jsonEH?.bag?.ev)).toBeTrue();
    expect(mseed3eh.isValidBagJsonEHType(jsonEH)).toBeTrue();
});
