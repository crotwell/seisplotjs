// @flow

import fs from 'fs';

import * as stationxml from '../../src/stationxml.js';
import { PolesZeros, Network, Station, Channel } from '../../src/stationxml';
import {convertToSacPoleZero} from '../../src/transfer.js';
import { createComplex} from '../../src/oregondsputil.js';

let networks = null;

beforeAll(() => {
  let filename = "./test/stationxml/data/co_jsc.staxml";
  let rawData = fs.readFileSync(filename, 'utf8');
  const xml = new DOMParser().parseFromString(rawData, "text/xml");
  networks = stationxml.parseStationXml(xml);
});

test( "stationxml parse test", () => {
  expect(networks).not.toBeNull();
  networks = ((networks: any): Array<Network>);
  expect(networks).toHaveLength(1);
  expect(networks[0].stations.length).toBe(1);
  expect(networks[0].stations[0].channels.length).toBe(1);
  expect(networks[0].stations[0].channels[0].sensor).toBeDefined();
  expect(networks[0].stations[0].channels[0].sensor.description).not.toBeNull();
  const response = networks[0].stations[0].channels[0].response;
  expect(response.stages[0].filter).toBeInstanceOf(PolesZeros);
  const pz = ((response.stages[0].filter: any): PolesZeros);
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
  networks = ((networks: any): Array<Network>);
  let stations = networks[0].stations;
  expect(stations).not.toBeNull();
  stations = ((stations: any): Array<Station>);
  let channels = stations[0].channels;
  expect(channels).not.toBeNull();
  channels = ((channels: any): Array<Channel>);
  const response = channels[0].response;
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
  let chanList = stationxml.findChannels(
    networks,
    'CO',
    'JSC',
    '00',
    'HHZ');
  for (let c of chanList) {
    expect(c.channelCode).toEqual('HHZ');
    expect(c.locationCode).toEqual('00');
    expect(c.stationCode).toEqual('JSC');
    expect(c.networkCode).toEqual('CO');
  }
});
