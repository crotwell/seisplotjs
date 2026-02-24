
import {RingserverConnection} from '../src/ringserverweb4';


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
