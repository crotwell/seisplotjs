
import { FedCatalogQuery } from '../src/irisfedcatalog';
import { allChannels } from '../src/stationxml';
import { isoToDateTime } from '../src/util';
import { SeismogramDisplayData } from '../src/seismogram';
import { isDef } from '../src/util';
import {Interval} from 'luxon';

import {setDefaultFetch} from '../src/util';
import fetch from 'cross-fetch';
setDefaultFetch(fetch);

test("version", () => {
  const fcQuery = new FedCatalogQuery();
  return fcQuery.queryVersion().then( res => {
    expect(res.length).toBeGreaterThan(1);
  });
});

test("station queries test", () => {

    const fedCatQuery = new FedCatalogQuery();
    const NET = 'CO';
    expect(fedCatQuery.networkCode(NET)).toBe(fedCatQuery);
    expect(fedCatQuery.getNetworkCode()).toBe(NET);
    return fedCatQuery.setupQueryFdsnStation('network').then(parsedResult => {
      expect(parsedResult.queries).toHaveLength(1);
      expect(parsedResult.queries[0]).toBeDefined();
    });
});

test("live parse result", () => {
  const fedCatQuery = new FedCatalogQuery();
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

jest.setTimeout(20*1000); // berkeley server takes a long time
test("run BK networks", () => {
    const fedCatQuery = new FedCatalogQuery();
    const NET = 'BK';
    expect(fedCatQuery.networkCode(NET)).toBe(fedCatQuery);
    expect(fedCatQuery.getNetworkCode()).toBe(NET);
    return fedCatQuery.queryNetworks().then(netArray => {
      expect(netArray).toHaveLength(2);
      expect(netArray[0]).toBeDefined();
      expect(netArray[0].networkCode).toBe(NET);
      expect(netArray[1]).toBeDefined();
      expect(netArray[1].networkCode).toBe(NET);
    });
});

test("run CO active stations", () => {
    const fedCatQuery = new FedCatalogQuery();
    const NET = 'CO';
    expect(fedCatQuery.networkCode(NET)).toBe(fedCatQuery);
    expect(fedCatQuery.getNetworkCode()).toBe(NET);
    expect(fedCatQuery.endAfter('2021-01-01')).toBe(fedCatQuery);
    expect(fedCatQuery.startBefore('2021-01-01')).toBe(fedCatQuery);
    return fedCatQuery.queryStations().then(netArray => {
      expect(netArray[0]).toBeDefined();
      expect(netArray[0].networkCode).toBe(NET);
      expect(netArray[0].stations).toHaveLength(10);
      expect(netArray[0].stations[0].channels).toHaveLength(0); // stations query, so no channels
    });
});

test("channels for CO", () => {
  const fedCatQuery = new FedCatalogQuery();
  const NET = 'CO';
  const STA = 'BIRD';
  const CHAN = 'HHZ';
  fedCatQuery.networkCode(NET);
  fedCatQuery.stationCode(STA);
  fedCatQuery.channelCode(CHAN);

  const START = isoToDateTime('2013-09-01T00:00:00Z');
  const END = isoToDateTime('2013-09-01T00:10:00Z');
  fedCatQuery.startTime(START);
  fedCatQuery.endTime(END);
  return fedCatQuery.queryChannels().then(netList => {
    expect(netList).toHaveLength(1);
    const net = netList[0];
    expect(net.stations).toHaveLength(1);
    expect(net.stations[0].channels).toHaveLength(1);
  });
});


test( "run dataselect test", () => {
  const fedCatQuery = new FedCatalogQuery();
  const NET = 'CO';
  const STA = 'JSC';
  const LOC = '00';
  const CHAN = "HHZ";
  const START = isoToDateTime('2020-09-01T00:00:00Z');
  const END = isoToDateTime('2020-09-01T00:10:00Z');
  expect(fedCatQuery.networkCode(NET)).toBe(fedCatQuery);
  expect(fedCatQuery.getNetworkCode()).toBe(NET);
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


test("seismograms for CO.BIRD for timewindow", () => {
  const fedCatQuery = new FedCatalogQuery();
  const NET = 'CO';
  const STA = 'BIRD';
  const CHAN = 'HHZ';
  fedCatQuery.networkCode(NET);
  fedCatQuery.stationCode(STA);
  fedCatQuery.channelCode(CHAN);

  const START = isoToDateTime('2013-09-01T00:00:00Z');
  const END = isoToDateTime('2013-09-01T00:01:00Z');
  const sed = Interval.fromDateTimes(START, END);
  fedCatQuery.startTime(START);
  fedCatQuery.endTime(END);
  return fedCatQuery.queryFdsnDataselect().then(sddList => {
    expect(sddList).toHaveLength(1);
    const sdd = sddList[0];
    expect(sdd.stationCode).toEqual(STA);
    expect(sdd.channelCode).toEqual(CHAN);
    const seismogram = sdd.seismogram;
    expect(seismogram).toBeDefined();
    if (! isDef(seismogram)) {
      throw new Error("seis is null");
    }
    expect(seismogram.isContiguous()).toBeTrue();
    expect(seismogram.y).toHaveLength(sed.toDuration().toMillis()/1000*100+1);
  });
});

test("sddlist seismograms for CO.BIRD for timewindow", () => {
  const fedCatQuery = new FedCatalogQuery();
  const NET = 'CO';
  const STA = 'BIRD';
  const CHAN = 'HHZ';
  fedCatQuery.networkCode(NET);
  fedCatQuery.stationCode(STA);
  fedCatQuery.channelCode(CHAN);

  const START = isoToDateTime('2013-09-01T00:00:00Z');
  const END = isoToDateTime('2013-09-01T00:01:00Z');
  const sed = Interval.fromDateTimes(START, END);
  fedCatQuery.startTime(START);
  fedCatQuery.endTime(END);
  return fedCatQuery.queryChannels().then(netList => {
    const sddList = [];
    for(const c of allChannels(netList)) {
      sddList.push(SeismogramDisplayData.fromChannelAndTimeWindow(c, sed));
    }
    expect(sddList).toHaveLength(1);
    return sddList;
  }).then(sddList => {
    return fedCatQuery.postQuerySeismograms(sddList);
  }).then(sddList => {
    expect(sddList).toHaveLength(1);
    const sdd = sddList[0];
    expect(sdd.stationCode).toEqual(STA);
    expect(sdd.channelCode).toEqual(CHAN);

    const seismogram = sdd.seismogram;
    expect(seismogram).toBeDefined();
    if (! isDef(seismogram)) {
      throw new Error("seis is null");
    }
    expect(seismogram.isContiguous()).toBeTrue();
    expect(seismogram.y).toHaveLength(sed.toDuration().toMillis()/1000*100+1);
  });
});
