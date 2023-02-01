
import {Network, allStations, allChannels} from '../../src/stationxml';

test("simple network", () => {
  const NET_CODE = "AA";
  const net = new Network(NET_CODE);
  expect(net.networkCode).toBe(NET_CODE);
});

test("empty iterate", () => {
  const inventory = new Array<Network>(0);
  let i=0;
  for (const s of allStations(inventory)) {
    // keep typescrip happy
    if (s) {
      i+=1;
    }
  }
  expect(i).toEqual(0);
  const chanList = allChannels(inventory);
  for (const c of chanList) {
    if (c) {
      i+=1;
    }
  }
  expect(i).toEqual(0);
});
