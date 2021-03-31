// @flow

import { FedCatalogQuery } from '../src/irisfedcatalog.js';
import { allChannels } from '../src/stationxml.js';
import { StartEndDuration } from '../src/util.js';
import { SeismogramDisplayData } from '../src/seismogram.js';
import { isDef } from '../src/util.js';
import moment from 'moment';

// eslint-disable-next-line no-undef
const fetch = require('node-fetch');
// eslint-disable-next-line no-undef
global.fetch = fetch;


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

test("channels for CO", () => {
  let fedCatQuery = new FedCatalogQuery();
  const NET = 'CO';
  const STA = 'BIRD';
  const CHAN = 'HHZ';
  fedCatQuery.networkCode(NET);
  fedCatQuery.stationCode(STA);
  fedCatQuery.channelCode(CHAN);

  const START = moment.utc('2013-09-01T00:00:00Z');
  const END = moment.utc('2013-09-01T00:10:00Z');
  fedCatQuery.startTime(START);
  fedCatQuery.endTime(END);
  return fedCatQuery.queryChannels().then(netList => {
    expect(netList).toHaveLength(1);
    const net = netList[0];
    expect(net.stations).toHaveLength(1);
    expect(net.stations[0].channels).toHaveLength(1);
  });
});

test("seismograms for CO.BIRD for timewindow", () => {
  let fedCatQuery = new FedCatalogQuery();
  const NET = 'CO';
  const STA = 'BIRD';
  const CHAN = 'HHZ';
  fedCatQuery.networkCode(NET);
  fedCatQuery.stationCode(STA);
  fedCatQuery.channelCode(CHAN);

  const START = moment.utc('2013-09-01T00:00:00Z');
  const END = moment.utc('2013-09-01T00:01:00Z');
  const sed = new StartEndDuration(START, END);
  fedCatQuery.startTime(START);
  fedCatQuery.endTime(END);
  return fedCatQuery.queryFdsnDataselect().then(sddList => {
    expect(sddList).toHaveLength(1);
    const sdd = sddList[0];
    expect(sdd.stationCode).toEqual(STA);
    expect(sdd.channelCode).toEqual(CHAN);
    // for flow
    const seismogram = isDef(sdd.seismogram) ? sdd.seismogram : null;
    expect(seismogram).toBeDefined();
    // $FlowExpectedError[incompatible-use]
    expect(seismogram.isContiguous()).toBeTrue();
    // $FlowExpectedError[incompatible-use]
    expect(seismogram.y).toHaveLength(sed.duration.asSeconds()*100+1);
  });
});


test("sddlist seismograms for CO.BIRD for timewindow", () => {
  let fedCatQuery = new FedCatalogQuery();
  const NET = 'CO';
  const STA = 'BIRD';
  const CHAN = 'HHZ';
  fedCatQuery.networkCode(NET);
  fedCatQuery.stationCode(STA);
  fedCatQuery.channelCode(CHAN);

  const START = moment.utc('2013-09-01T00:00:00Z');
  const END = moment.utc('2013-09-01T00:01:00Z');
  const sed = new StartEndDuration(START, END);
  fedCatQuery.startTime(START);
  fedCatQuery.endTime(END);
  return fedCatQuery.queryChannels().then(netList => {
    let sddList = [];
    for(let c of allChannels(netList)) {
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

    const seismogram = isDef(sdd.seismogram) ? sdd.seismogram : null;
    expect(seismogram).toBeDefined();
    // $FlowExpectedError[incompatible-use]
    expect(seismogram.isContiguous()).toBeTrue();
    // $FlowExpectedError[incompatible-use]
    expect(seismogram.y).toHaveLength(sed.duration.asSeconds()*100+1);
  });
});
