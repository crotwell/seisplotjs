
import {RingserverConnection} from '../src/ringserverweb4';
import {DataLinkConnection, DataLinkPacket} from '../src/datalink';
import { DateTime, Duration} from 'luxon';


import {setDefaultFetch} from '../src/util';
import fetch from 'cross-fetch';
setDefaultFetch(fetch);

test("do id test", () => {
  // def is IRIS
  const ring = new RingserverConnection();
  const USC_HOST = "eeyore.seis.sc.edu";
  ring.host(USC_HOST);
  ring.prefix("testringserver");
  return ring.pullId().then(id => {
    expect(id.organization).toContain("Test");
  });

});

let dlConn: DataLinkConnection;

test("do datalink test", () => {
  // def is IRIS
  const ring = new RingserverConnection();
  const USC_HOST = "eeyore.seis.sc.edu";
  const USC_PREFIX = "testringserver"
  ring.host(USC_HOST);
  ring.prefix(USC_PREFIX);
  expect(ring.getDataLinkURL()).toEqual(`ws://${USC_HOST}/${USC_PREFIX}/datalink`);
  const dlpacketFun = function(packet: DataLinkPacket) {
    expect(packet).toBeDefined();
    expect(packet.isMiniseed()).toBeTrue();
    dlConn.close();
  };
  const dlerrorFun = function(_e: any) {
    dlConn.close();
  };
  const start = DateTime.utc().minus(Duration.fromISO('PT10M'));
  dlConn = new DataLinkConnection(ring.getDataLinkURL(), dlpacketFun, dlerrorFun);
  return dlConn.connect().then(servId => {
    expect(servId).toContain("DataLink");
    expect(servId).toContain("DLPROTO:1.1");
    return dlConn.id("seisplotjs", "anonymous", "0", "js");
  }).then(_servId => {
    //expect(_servId).toContain("DataLink");
    return dlConn.match("CO_.*_00_H_H_Z/MSEED");
  }).then(response => {
    expect(response.type).toContain("OK");
    return dlConn.positionAfter(start);
  }).then(response => {
    expect(response.type).toContain("OK");
    return dlConn.infoStreams();
  }).then(response => {
    expect(response.streams.length).toBeGreaterThan(0);
    expect(response.streams[0].name).toContain("CO_");
    expect(response.streams[0].dataLatency).toBeGreaterThan(0);
    return response;
  }).then(_response => {
    return dlConn.close();
  }).then(_response => {
    expect(dlConn.isConnected()).toBeFalse();
  });
});

afterEach(() => {
  if (dlConn) { dlConn.close();}
});
