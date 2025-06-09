
import {RingserverConnection} from '../src/ringserverweb';
import {DataLinkConnection, DataLinkPacket} from '../src/datalink';
import {SeedlinkConnection, SequencedDataRecord} from '../src/seedlink';
import { DateTime, Duration} from 'luxon';


import {setDefaultFetch} from '../src/util';
import fetch from 'cross-fetch';
setDefaultFetch(fetch);


test("do id test", () => {
  // def is IRIS
  const ring = new RingserverConnection();
  return ring.pullId().then(id => {
    expect(id.serverId).toContain("IRIS");
  });

});

let slConn: SeedlinkConnection;
let dlConn: DataLinkConnection;

test("do seedlink test", done => {
  // def is IRIS
  const ring = new RingserverConnection();
  expect(ring.getSeedLinkURL()).toEqual("ws://rtserve.iris.washington.edu/seedlink");
  const config = ['STATION JSC CO',
                  'SELECT 00HHZ.D' ];
  function packetFun(mseedPacket: SequencedDataRecord) {
    expect(mseedPacket).toBeDefined();
    slConn.close();
    done();
  }
  function errorFun(e: any) {
    slConn.close();
    done(e);
  }
  const start = DateTime.utc().minus(Duration.fromISO('PT3M'));
  slConn = new SeedlinkConnection(ring.getSeedLinkURL(), config, packetFun, errorFun);
  slConn.setTimeCommand(start);
  slConn.connect().then(servId => {
    expect(slConn.isConnected()).toBeTrue();
  });

});

test("do datalink test", () => {
  // def is IRIS
  const ring = new RingserverConnection();
  expect(ring.getDataLinkURL()).toEqual("ws://rtserve.iris.washington.edu/datalink");
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
    expect(servId).toContain("DLPROTO:1.0");
    return dlConn.id("seisplotjs", "anonymous", "0", "js");
  }).then(_servId => {
    //expect(_servId).toContain("DataLink");
    return dlConn.match("CO_.*_00_HHZ/MSEED");
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
  if (slConn) { slConn.close();}
  if (dlConn) { dlConn.close();}
});
