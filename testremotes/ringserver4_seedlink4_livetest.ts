
import {RingserverConnection} from '../src/ringserverweb4';
import {SeedlinkConnection as Seedlink4Connection,
  SEPacket, createDataTimeCommand} from '../src/seedlink4';
import { DateTime, Duration} from 'luxon';


import {setDefaultFetch} from '../src/util';
import fetch from 'cross-fetch';
setDefaultFetch(fetch);

test.skip("do id test", () => {
  // def is IRIS
  const ring = new RingserverConnection();
  const USC_HOST = "eeyore.seis.sc.edu";
  ring.host(USC_HOST);
  ring.prefix("testringserver");
  return ring.pullId().then(id => {
    expect(id.organization).toContain("Test");
  });

});

let sl4Conn: Seedlink4Connection ;

test("do seedlink4 test", done => {
  // def is IRIS
  const ring = new RingserverConnection();
  const USC_HOST = "eeyore.seis.sc.edu";
  const USC_PREFIX = "testringserver";
  ring.host(USC_HOST);
  ring.prefix(USC_PREFIX);
  //ring.protocol("https");
  expect(ring.getSeedLinkURL()).toEqual(`ws://${USC_HOST}/${USC_PREFIX}/seedlink`);

  const start = DateTime.utc().minus(Duration.fromISO('PT3M'));
  const dataCmd = createDataTimeCommand(start);
  const config = ['STATION CO_JSC',
                  'SELECT 00_H_H_Z',
                  dataCmd ];

  function packetFun(mseedPacket: SEPacket) {
    expect(mseedPacket).toBeDefined();
    if (sl4Conn) {sl4Conn.close();}
    done();
  }
  function errorFun(e: any) {
    if (sl4Conn) {sl4Conn.close();}
    done(e);
  }
/*
  function errorFnB(error: any) {
    console.assert(false, error);
  };
  const LOCAL_SEEDLINK_V4 = "ws://eeyore.seis.sc.edu/testringserver/seedlink";
  let seedlink = new Seedlink4Connection(
    LOCAL_SEEDLINK_V4,
    config,
    (packet: SEPacket) => {

      console.log(`got a packet: ${packet}`);
    },
    errorFnB,
  );
  sl4Conn = seedlink;
  seedlink.connect().then(_servId => {
    return new Promise(resolve => setTimeout(resolve, 1000)).then(() => {console.log("finish sleep");});
  }).then(_response => {
    console.log("send close()");
      return seedlink.close();
    }).then(_response => {
      expect(seedlink.isConnected()).toBeFalse();
      done();
    }).catch( err=> {
      done(err);
    });
*/
  sl4Conn = new Seedlink4Connection(ring.getSeedLinkURL(), config, packetFun, errorFun);
  sl4Conn.connect().then(servId => {
    expect(servId).toBeDefined();
    expect(sl4Conn.isConnected()).toBeTrue();
  }).then(()=> {
    return new Promise(resolve => setTimeout(resolve, 2000)).then(() => {console.log("finish sleep");});
  }).then(_response => {
    return sl4Conn.close();
  }).then(_response => {
    expect(sl4Conn.isConnected()).toBeFalse();
    done();
  }).catch( err=> {
    done(err);
  });

});

afterEach(() => {
  if (sl4Conn) { sl4Conn.close();}
});
