
/*
 * @jest-environment jsdom
 */

import fs from 'fs';

import * as stationxml from '../../src/stationxml';
import { PolesZeros, Network } from '../../src/stationxml';
import {convertToSacPoleZero} from '../../src/transfer';
import { createComplex} from '../../src/oregondsputil';

let networks: Array<Network> = [];

beforeAll(() => {
  const filename = "./test/stationxml/data/co_jsc.staxml";
  const rawData = fs.readFileSync(filename, 'utf8');
  const xml = new DOMParser().parseFromString(rawData, "text/xml");
  networks = stationxml.parseStationXml(xml);
});

test( "stationxml parse test", () => {
  expect(networks).not.toBeNull();
  expect(networks).toHaveLength(1);
  expect(networks[0].stations.length).toBe(1);
  expect(networks[0].stations[0].channels.length).toBe(1);
  expect(networks[0].stations[0].channels[0].sensor).toBeDefined();
  expect(networks[0].stations[0].channels[0].sensor?.description).not.toBeNull();
  const response = networks[0].stations[0].channels[0].response;
  expect(response?.stages[0]?.filter).toBeInstanceOf(PolesZeros);
  const pz = response?.stages[0]?.filter as PolesZeros;
  expect(pz).not.toBeNull();
  expect(pz.zeros).toHaveLength(5);
  expect(pz.zeros).toContainEqual(createComplex(0,0));
  pz.zeros.forEach( z => {
    expect(z.real()).toBeFinite();
    expect(z.imag()).toBeFinite();
  });
  expect(pz.poles).toHaveLength(7);
  pz.poles.forEach( p => {
    expect(p.real()).toBeFinite();
    expect(p.imag()).toBeFinite();
  });
});

test("convert to sac polezero", () => {
  expect(networks).not.toBeNull();
  const stations = networks[0].stations;
  expect(stations).not.toBeNull();
  const channels = stations[0].channels;
  expect(channels).not.toBeNull();
  const response = channels[0].response;
  expect(response).not.toBeNull();
  if (response == null) {
    throw new Error("response is null");
  }
  const pz = convertToSacPoleZero(response);
  expect(pz).toBeDefined();
  expect(pz.zeros).toHaveLength(6);
  pz.zeros.forEach( z => {
    expect(z.real()).toBeFinite();
    expect(z.imag()).toBeFinite();
  });
  expect(pz.poles).toHaveLength(7);
  pz.poles.forEach( p => {
    expect(p.real()).toBeFinite();
    expect(p.imag()).toBeFinite();
  });
});

test("findChannels", () => {
  const chanList = stationxml.findChannels(
    networks,
    'CO',
    'JSC',
    '00',
    'HHZ');
  for (const c of chanList) {
    expect(c.channelCode).toEqual('HHZ');
    expect(c.locationCode).toEqual('00');
    expect(c.stationCode).toEqual('JSC');
    expect(c.networkCode).toEqual('CO');
  }
});
