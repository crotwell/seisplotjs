
import {RingserverConnection} from '../src/ringserverweb4';
import {DataLinkConnection, DataLinkPacket} from '../src/datalink';
import {SeedlinkConnection, SEPacket, createDataTimeCommand} from '../src/seedlink4';
import { DateTime, Duration} from 'luxon';


import {setDefaultFetch} from '../src/util';
import fetch from 'cross-fetch';
setDefaultFetch(fetch);


test("do id test", () => {
  // def is IRIS, but is only ringserver 3
  const ring = new RingserverConnection();
  expect(ring.formBaseURL()).toEqual("http://rtserve.iris.washington.edu/");
  return ring.pullId().then(id => {
    expect(id.organization).toBeDefined();
    expect(id.software).toContain("ringserver/2");
    expect(id.organization).toContain("IRIS DMC");
    expect(id.datalink_protocol.length).toEqual(1);
    expect(id.seedlink_protocol.length).toEqual(1);
    expect(id.datalink_protocol[0]).toContain("DLPROTO:1.0");
    expect(id.seedlink_protocol[0]).toContain("SLPROTO:3.1");
  });
});

test("do usc id test", () => {
  // test ringserver4 at usc
  const ring = new RingserverConnection();
  const USC_HOST = "eeyore.seis.sc.edu";
  ring.host(USC_HOST);
  ring.prefix("testringserver");
  expect(ring.formBaseURL()).toEqual("http://eeyore.seis.sc.edu/testringserver/");
  expect(ring.formIdURL()).toEqual("http://eeyore.seis.sc.edu/testringserver/id/json");

  return ring.pullId().then(id => {
    expect(id.software).toContain("ringserver/4.1");
    expect(id.organization).toContain("Test Ring Server 4");
    expect(id.datalink_protocol.length).toEqual(1);
    expect(id.seedlink_protocol.length).toEqual(2);
    expect(id.datalink_protocol[0]).toContain("DLPROTO:1.1");
    expect(id.seedlink_protocol[0]).toContain("SLPROTO:4.0");
    expect(id.seedlink_protocol[1]).toContain("SLPROTO:3.1");
  });
});



test("do usc streams test", () => {
  // test ringserver4 at usc
  const ring = new RingserverConnection();
  const USC_HOST = "eeyore.seis.sc.edu";
  ring.host(USC_HOST);
  ring.prefix("testringserver");
  expect(ring.formBaseURL()).toEqual("http://eeyore.seis.sc.edu/testringserver/");

  return ring.pullStreams().then(id => {
    expect(id.software).toContain("ringserver/4.1");
    expect(id.organization).toContain("Test Ring Server 4");
    expect(id.stream.length).toBeGreaterThan(1);
    const stream = id.stream[0];
    expect(stream.id).toContain("FDSN:CO");
    expect(stream.start_time).toBeDefined();
    expect(stream.end_time).toBeDefined();
    expect(stream.data_latency).toBeGreaterThan(0);
  });
});

test("do usc streamids test", () => {
  // test ringserver4 at usc
  const ring = new RingserverConnection();
  const USC_HOST = "eeyore.seis.sc.edu";
  ring.host(USC_HOST);
  ring.prefix("testringserver");
  expect(ring.formBaseURL()).toEqual("http://eeyore.seis.sc.edu/testringserver/");

  return ring.pullStreamIds().then(idList => {
    expect(idList).toBeArray();
    expect(idList.length).toBeGreaterThan(1);
    const streamid = idList[0];
    expect(streamid).toContain("FDSN:CO");
  });
});


let slConn: SeedlinkConnection;
let dlConn: DataLinkConnection;

test("do seedlink test", (done) => {
  // def is IRIS
  const ring = new RingserverConnection();
  const USC_HOST = "eeyore.seis.sc.edu";
  ring.host(USC_HOST);
  ring.prefix("testringserver");
  expect(ring.getSeedLinkURL()).toEqual("ws://eeyore.seis.sc.edu/testringserver/seedlink");
  const requestConfig = [
    "STATION CO_HAW",
    "SELECT 00_H_H_Z",
    'STATION CO_JSC',
    'SELECT 00_H_H_Z'
  ];
  function packetFun(mseedPacket: SEPacket) {
    expect(mseedPacket).toBeDefined();
    console.log("seedlink packet, ok, closing");
    slConn.close();
    done();
  }
  function errorFun(err: any) {
    console.log(`seedlink err fun: ${JSON.stringify(err, ["message", "arguments", "type", "name"])}`)
    slConn.close();
    done(err);
  }
  const start = DateTime.utc().minus(Duration.fromISO('PT3M'));
  let dataCmd = createDataTimeCommand(start);
  let requestConfigWithData = requestConfig.concat([ dataCmd ]);
  //let endCommand = "END";
  slConn = new SeedlinkConnection(ring.getSeedLinkURL(),
                                  requestConfigWithData,
                                  packetFun,
                                  errorFun);
  //slConn.endCommand = endCommand;
  slConn.connect()
  .then(() => {
    //expect(slConn.isConnected()).toBeTrue();
  //}).then(()=> {
    return slConn.close();
  }).then(_response => {
    expect(slConn.isConnected()).toBeFalse();
    done();
  });

});

test("do datalink test", () => {
  // def is IRIS
  const ring = new RingserverConnection();
  const USC_HOST = "eeyore.seis.sc.edu";
  ring.host(USC_HOST);
  ring.prefix("testringserver");
  expect(ring.getDataLinkURL()).toEqual("ws://eeyore.seis.sc.edu/testringserver/datalink");
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
    return dlConn.match("CO_BIRD_00_H_H_Z");
  }).then(response => {
    expect(response.type).toContain("OK");
    return dlConn.positionAfter(start);
  }).then(response => {
    expect(response.type).toContain("OK");
    return dlConn.infoStreams();
  }).then(response => {
    expect(response.datalinkStats).toBeDefined();
    expect(response.streams).toBeArray();
    expect(response.streams.length).toBeGreaterThan(0);
    expect(response.streams[0].name).toContain("CO_BIRD_00_H_H_Z");
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
