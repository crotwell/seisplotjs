
import {RingserverConnection} from '../src/ringserverweb';
import {DataLinkConnection} from '../src/datalink';
import {SeedlinkConnection} from '../src/seedlink';
import { SeismogramDisplayData} from '../src/seismogram';
import { DateTime, Duration, Interval} from 'luxon';

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

let slConn;
let dlConn;

test("do seedlink test", done => {
  // def is IRIS
  const ring = new RingserverConnection();
  expect(ring.getSeedLinkURL()).toEqual("ws://rtserve.iris.washington.edu/seedlink");
  const config = ['STATION JSC CO',
                  'SELECT 00HHZ.D' ];
  function packetFun(mseedPacket) {
    console.log(`got mseed`);
    expect(mseedPacket).toBeDefined();
    slConn.close();
    done();
  }
  function errorFun(e) {
    slConn.close();
    done(e);
  }
  let start = DateTime.utc().minus(Duration.fromISO('PT3M'));
  slConn = new SeedlinkConnection(ring.getSeedLinkURL(), config, packetFun, errorFun);
  slConn.setTimeCommand(start);
  slConn.connect();
  expect(slConn.isConnected()).toBeTrue();

});

test("do datalink test", done => {
  // def is IRIS
  const ring = new RingserverConnection();
  expect(ring.getDataLinkURL()).toEqual("ws://rtserve.iris.washington.edu/datalink");
  const dlpacketFun = function(packet) {
    console.log(`got packet`);
    expect(packet).toBeDefined();
    expect(packet.isMiniseed()).toBeTrue();
    done();
  }
  const dlerrorFun = function(e) {
    dlConn.close();
    done(e);
  }
  let start = DateTime.utc().minus(Duration.fromISO('PT10M'));
  dlConn = new DataLinkConnection(ring.getDataLinkURL(), dlpacketFun, dlerrorFun);
  return dlConn.connect().then(servId => {
    expect(servId).toContain("DataLink");
    expect(servId).toContain("DLPROTO:1.0");
    return dlConn.id("seisplotjs", "anonymous", "0", "js");
  }).then(servId => {
    //expect(servId).toContain("DataLink");
    return dlConn.match("CO_JSC_00_HHZ/MSEED");
  }).then(response => {
    console.log(`match response: ${response}`)
    return dlConn.positionAfter(start);
  }).then(response => {
    console.log(`positionAfter response: ${response}`)
    return dlConn.stream();
  });
});

afterEach(() => {
  if (slConn) { slConn.close();slConn = null;}
  if (dlConn) { dlConn.close();dlConn = null;}
})
