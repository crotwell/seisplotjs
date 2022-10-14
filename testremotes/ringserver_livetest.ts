
import {RingserverConnection} from '../src/ringserverweb';
import {DataLinkConnection, DataLinkPacket} from '../src/datalink';
import {SeedlinkConnection, SequencedDataRecord} from '../src/seedlink';
import { DateTime, Duration} from 'luxon';

// eslint-disable-next-line no-undef
const fetch = require('node-fetch');
// eslint-disable-next-line no-undef
global.fetch = fetch;



test("do id test", () => {
  // def is IRIS
  const ring = new RingserverConnection();
  return ring.pullId().then(id => {
    console.log(`id: ${id}`);
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
    console.log(`got mseed`);
    expect(mseedPacket).toBeDefined();
    slConn.close();
    done();
  }
  function errorFun(e: any) {
    slConn.close();
    done(e);
  }
  let start = DateTime.utc().minus(Duration.fromISO('PT3M'));
  slConn = new SeedlinkConnection(ring.getSeedLinkURL(), config, packetFun, errorFun);
  slConn.setTimeCommand(start);
  slConn.connect();
  expect(slConn.isConnected()).toBeTrue();

});

test("do datalink test", () => {
  // def is IRIS
  const ring = new RingserverConnection();
  expect(ring.getDataLinkURL()).toEqual("ws://rtserve.iris.washington.edu/datalink");
  const dlpacketFun = function(packet: DataLinkPacket) {
    console.log(`got packet`);
    expect(packet).toBeDefined();
    expect(packet.isMiniseed()).toBeTrue();
    dlConn.close();
  }
  const dlerrorFun = function(e: any) {
    dlConn.close();
  }
  let start = DateTime.utc().minus(Duration.fromISO('PT10M'));
  dlConn = new DataLinkConnection(ring.getDataLinkURL(), dlpacketFun, dlerrorFun);
  return dlConn.connect().then(servId => {
    expect(servId).toContain("DataLink");
    expect(servId).toContain("DLPROTO:1.0");
    return dlConn.id("seisplotjs", "anonymous", "0", "js");
  }).then(servId => {
    //expect(servId).toContain("DataLink");
    return dlConn.match("CO_.*_00_HHZ/MSEED");
  }).then(response => {
    console.log(`match response: ${response}`)
    expect(response.type).toContain("OK");
    return dlConn.positionAfter(start);
  }).then(response => {
    console.log(`positionAfter response: ${response}`)
    expect(response.type).toContain("OK");
    return dlConn.infoStreams();
  }).then(response => {
    expect(response.streams.length).toBeGreaterThan(0);
    expect(response.streams[0].name).toContain("CO_");
    expect(response.streams[0].dataLatency).toBeGreaterThan(0);
    return response;
  }).then(response => {
    return dlConn.close();
  }).then(response => {
    expect(dlConn.isConnected()).toBeFalse();
  });
});

afterEach(() => {
  if (slConn) { slConn.close();}
  if (dlConn) { dlConn.close();}
})
