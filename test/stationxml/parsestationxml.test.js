// @flow

import fs from 'fs';

import * as fdsnstation from '../../src/fdsnstation.js';
import {Response, PolesZeros } from '../../src/stationxml';
import {convertToSacPoleZero} from '../../src/filter/transfer.js';
import * as util from '../../src/util.js';
let moment = util.moment;

test( "station parse test", () => {
  let filename = "./test/stationxml/data/co_jsc.staxml";
  let rawData = fs.readFileSync(filename, 'utf8');
  const xml = new DOMParser().parseFromString(rawData, "text/xml");
  let stationQuery = new fdsnstation.StationQuery();
  let networks = stationQuery.parseRawXml(xml);
  expect(networks.length).toBe(1);
  expect(networks[0].stations.length).toBe(1);
  expect(networks[0].stations[0].channels.length).toBe(1);
  const response = networks[0].stations[0].channels[0].response;
  expect(response.stages[0].filter).toBeInstanceOf(PolesZeros);
  const xpz = response.stages[0].filter;
  expect(xpz.zeros.length).toBe(5);
  expect(xpz.zeros[0].real()).not.toBeNaN();
  expect(xpz.zeros[0].imag()).not.toBeNaN();
  const pz = convertToSacPoleZero(response);
  expect(pz).toBeDefined();
  expect(pz.zeros.length).toEqual(6);
  expect(pz.zeros[0].real()).not.toBeNaN();
  expect(pz.zeros[0].imag()).not.toBeNaN();
  expect(pz.poles.length).toEqual(7);
  expect(pz.poles[0].real()).not.toBeNaN();
  expect(pz.poles[0].imag()).not.toBeNaN();
});
