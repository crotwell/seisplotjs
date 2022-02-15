// @flow

import {Network, allStations, allChannels} from '../../src/stationxml';

test("simple network", () => {
  let NET_CODE = "AA";
  let net = new Network(NET_CODE);
  expect(net.networkCode).toBe(NET_CODE);
});

test("empty iterate", () => {
  let inventory = new Array<Network>(0);
  let i=0;
  for (let s of allStations(inventory)) {
    i+=1;
  }
  expect(i).toEqual(0);
  let chanList = allChannels(inventory);
  for (let c of chanList) {
    i+=1;
  }
  expect(i).toEqual(0);
});
