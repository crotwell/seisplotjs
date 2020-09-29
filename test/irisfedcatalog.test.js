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

test("live parse result", () => {
  let fedCatQuery = new FedCatalogQuery();
  const NET = 'CO';
  const LEVEL = 'station';
  expect(fedCatQuery.networkCode(NET)).toBe(fedCatQuery);
  fedCatQuery._level = LEVEL;
  fedCatQuery.targetService('station');
  return fedCatQuery.queryRaw().then(function(parsedResult) {
    expect(parsedResult.queries).toHaveLength(1);
    expect(parsedResult.params.get('level')).toEqual(LEVEL);
  });
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

test( "run test", () => {
  let fedCatQuery = new FedCatalogQuery();
  const NET = 'CO';
  expect(fedCatQuery.networkCode(NET)).toBe(fedCatQuery);
  expect(fedCatQuery.networkCode()).toBe(NET);
  return fedCatQuery.queryFdsnStation('station').then(netArray => {
    expect(netArray[0]).toBeDefined();
    expect(netArray[0].networkCode).toBe(NET);
    expect(netArray[0].stations).toHaveLength(14);
  });
});

test("run CO active stations", () => {
    let fedCatQuery = new FedCatalogQuery();
    const NET = 'CO';
    expect(fedCatQuery.networkCode(NET)).toBe(fedCatQuery);
    expect(fedCatQuery.networkCode()).toBe(NET);
    expect(fedCatQuery.endAfter(moment.utc())).toBe(fedCatQuery);
    return fedCatQuery.queryStations().then(netArray => {
      expect(netArray[0]).toBeDefined();
      expect(netArray[0].networkCode).toBe(NET);
      expect(netArray[0].stations).toHaveLength(10);
    });
});


test("run BK networks", () => {
    let fedCatQuery = new FedCatalogQuery();
    const NET = 'BK';
    expect(fedCatQuery.networkCode(NET)).toBe(fedCatQuery);
    expect(fedCatQuery.networkCode()).toBe(NET);
    return fedCatQuery.queryNetworks().then(netArray => {
      expect(netArray).toHaveLength(2);
      expect(netArray[0]).toBeDefined();
      expect(netArray[0].networkCode).toBe(NET);
      expect(netArray[1]).toBeDefined();
      expect(netArray[1].networkCode).toBe(NET);
    });
});


test( "run dataselect test", () => {
  let fedCatQuery = new FedCatalogQuery();
  const NET = 'CO';
  const STA = 'JSC';
  const LOC = '00';
  const CHAN = "HHZ";
  const START = moment.utc('2020-09-01T00:00:00Z');
  const END = moment.utc('2020-09-01T00:10:00Z');
  expect(fedCatQuery.networkCode(NET)).toBe(fedCatQuery);
  expect(fedCatQuery.networkCode()).toBe(NET);
  expect(fedCatQuery.stationCode(STA)).toBe(fedCatQuery);
  expect(fedCatQuery.locationCode(LOC)).toBe(fedCatQuery);
  expect(fedCatQuery.channelCode(CHAN)).toBe(fedCatQuery);
  expect(fedCatQuery.startTime(START)).toBe(fedCatQuery);
  expect(fedCatQuery.endTime(END)).toBe(fedCatQuery);
  return fedCatQuery.queryFdsnDataselect().then(sddList => {
    expect(sddList).toHaveLength(1);
    expect(sddList[0]).toBeDefined();
    expect(sddList[0].networkCode).toBe(NET);
    expect(sddList[0].stationCode).toBe(STA);
    expect(sddList[0].locationCode).toBe(LOC);
    expect(sddList[0].channelCode).toBe(CHAN);
    expect(sddList[0].seismogram).toBeDefined();
  });
});
