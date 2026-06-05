
import {RingserverConnection} from "../src/ringserverweb4.mjs";


import {setDefaultFetch} from "../src/util.mjs";
import fetch from "cross-fetch";
setDefaultFetch(fetch);


test("do id test", () => {
  // def is IRIS, but is only ringserver 3
  const ring = new RingserverConnection();
  expect(ring.formBaseURL()).toEqual("https://rtserve.earthscope.org/");
  return ring.pullId().then(id => {
    expect(id.organization).toBeDefined();
    expect(id.software).toContain("ringserver/4");
    expect(id.organization).toContain("EarthScope");
    expect(id.datalink_protocol.length).toEqual(1);
    expect(id.seedlink_protocol.length).toEqual(2);
    expect(id.datalink_protocol[0]).toContain("DLPROTO:1.1");
    expect(id.seedlink_protocol[0]).toContain("SLPROTO:4.0");
  });
});

test("do usc id test", () => {
  // test ringserver4 at usc
  const ring = new RingserverConnection();
  const USC_HOST = "eeyore.seis.sc.edu";
  ring.host(USC_HOST);
  ring.prefix("testringserver");
  expect(ring.formBaseURL()).toEqual("https://eeyore.seis.sc.edu/testringserver/");
  expect(ring.formIdURL()).toEqual("https://eeyore.seis.sc.edu/testringserver/id/json");

  return ring.pullId().then(id => {
    expect(id.software).toContain("ringserver/4");
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
  expect(ring.formBaseURL()).toEqual("https://eeyore.seis.sc.edu/testringserver/");

  return ring.pullStreams().then(id => {
    expect(id.software).toContain("ringserver/4");
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
  expect(ring.formBaseURL()).toEqual("https://eeyore.seis.sc.edu/testringserver/");

  return ring.pullStreamIds().then(idList => {
    expect(idList).toBeArray();
    expect(idList.length).toBeGreaterThan(1);
    const streamid = idList[0];
    expect(streamid).toContain("FDSN:CO");
  });
});
