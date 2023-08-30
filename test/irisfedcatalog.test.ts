
import {FedCatalogQuery} from '../src/irisfedcatalog.js';


test( "query setter test", () => {
  const fedCatQuery = new FedCatalogQuery();
  const net = 'CO';
  fedCatQuery.networkCode(net);
  expect(fedCatQuery.getNetworkCode()).toBe(net);
});

test("parse response test", () => {
  const text = `level=network

DATACENTER=IRISDMC,http://ds.iris.edu
STATIONSERVICE=http://service.iris.edu/fdsnws/station/1/
CO * * * 1987-01-01T00:00:00 2599-12-31T23:59:59`;

  const lines = text.split('\n');
  const fedCatQuery = new FedCatalogQuery();
  const resp = fedCatQuery.parseRequest(text);
  expect(resp.params.size).toEqual(1);
  expect(resp.params.get('level')).toEqual('network');
  expect(resp.queries).toHaveLength(1);
  expect(resp.queries[0].services.size).toEqual(1);
  expect(resp.queries[0].services.get('STATIONSERVICE')).toEqual('http://service.iris.edu/fdsnws/station/1/');
  expect(resp.queries[0].postLines).toHaveLength(1);
  expect(resp.queries[0].postLines[0]).toEqual(lines[lines.length-1]);
});
