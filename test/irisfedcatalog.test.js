// @flow

import {FedCatalogQuery} from '../src/irisfedcatalog.js';
import moment from 'moment';

// eslint-disable-next-line no-undef
const fetch = require('node-fetch');
// eslint-disable-next-line no-undef
global.fetch = fetch;


test( "query setter test", () => {
  let fedCatQuery = new FedCatalogQuery();
  const net = 'CO';
  fedCatQuery.networkCode(net);
  expect(fedCatQuery.networkCode()).toBe(net);
});

test("parse response test", () => {
  let text = `level=network

DATACENTER=IRISDMC,http://ds.iris.edu
STATIONSERVICE=http://service.iris.edu/fdsnws/station/1/
CO * * * 1987-01-01T00:00:00 2599-12-31T23:59:59`;

  let lines = text.split('\n');
  let fedCatQuery = new FedCatalogQuery();
  let resp = fedCatQuery.parseRequest(text);
  expect(resp.params.size).toEqual(1);
  expect(resp.params.get('level')).toEqual('network');
  expect(resp.queries).toHaveLength(1);
  expect(resp.queries[0].services.size).toEqual(1);
  expect(resp.queries[0].services.get('STATIONSERVICE')).toEqual('http://service.iris.edu/fdsnws/station/1/');
  expect(resp.queries[0].postLines).toHaveLength(1);
  expect(resp.queries[0].postLines[0]).toEqual(lines[lines.length-1]);
});

test("setup station queries test", () => {

    let fedCatQuery = new FedCatalogQuery();
    const NET = 'CO';
    expect(fedCatQuery.networkCode(NET)).toBe(fedCatQuery);
    expect(fedCatQuery.networkCode()).toBe(NET);
    return fedCatQuery.setupQueryFdsnStation('network').then(parsedResult => {
      expect(parsedResult.queries).toHaveLength(1);
      expect(parsedResult.queries[0]).toBeDefined();
    });
});
