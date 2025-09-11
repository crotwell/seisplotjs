
import {RingserverConnection} from '../src/ringserverweb4';
import {SeedlinkConnection as Seedlink3Connection, SequencedDataRecord} from '../src/seedlink';
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

let sl3Conn: Seedlink3Connection;

test("do seedlink3 test", done => {
  // def is IRIS
  const ring = new RingserverConnection();
  const USC_HOST = "eeyore.seis.sc.edu";
  const USC_PREFIX = "testringserver"
  ring.host(USC_HOST);
  ring.prefix(USC_PREFIX);
  expect(ring.getSeedLinkURL()).toEqual(`ws://${USC_HOST}/${USC_PREFIX}/seedlink`);
  const config = ['STATION JSC CO',
                  'SELECT 00HHZ.D' ];
  function packetFun(mseedPacket: SequencedDataRecord) {
    expect(mseedPacket).toBeDefined();
    sl3Conn.close();
    done();
  }
  function errorFun(e: any) {
    sl3Conn.close();
    done(e);
  }
  const start = DateTime.utc().minus(Duration.fromISO('PT3M'));
  sl3Conn = new Seedlink3Connection(ring.getSeedLinkURL(), config, packetFun, errorFun);
  sl3Conn.setTimeCommand(start);
  sl3Conn.connect().then(servId => {
    expect(servId).toBeDefined();
    expect(sl3Conn.isConnected()).toBeTrue();
  }).then(()=> {
    return sl3Conn.close();
  }).then(_response => {
    expect(sl3Conn.isConnected()).toBeFalse();
    done();
  }).catch( err=> {
    done(err);
  });

});

afterEach(() => {
  if (sl3Conn) { sl3Conn.close();}
});
