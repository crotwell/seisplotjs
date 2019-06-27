// @flow

import fs from 'fs';

import * as fdsnstation from '../../src/fdsnstation.js';
import {Response, PolesZeros } from '../../src/stationxml';
import {convertToSacPoleZero} from '../../src/filter/transfer.js';
import {Complex, createComplex} from '../../src/filter/filterUtil';
import * as util from '../../src/util.js';
let moment = util.moment;

let networks = null;

beforeAll(() => {
  let filename = "./test/stationxml/data/co_jsc.staxml";
  let rawData = fs.readFileSync(filename, 'utf8');
  const xml = new DOMParser().parseFromString(rawData, "text/xml");
  let stationQuery = new fdsnstation.StationQuery();
  networks = stationQuery.parseRawXml(xml);
});

test( "stationxml parse test", () => {
  expect(networks.length).toBe(1);
  expect(networks[0].stations.length).toBe(1);
  expect(networks[0].stations[0].channels.length).toBe(1);
  const response = networks[0].stations[0].channels[0].response;
  expect(response.stages[0].filter).toBeInstanceOf(PolesZeros);
  const pz = response.stages[0].filter;
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
  const response = networks[0].stations[0].channels[0].response;
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
