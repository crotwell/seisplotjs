import { parseGeoJSON }  from '../src/usgsgeojson';
import { DateTime } from 'luxon';

test( "hour magnitude test", () => {
  const hour_mag1 = `{"type":"FeatureCollection","metadata":{"generated":1676731747000,"url":"https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/1.0_hour.geojson","title":"USGS Magnitude 1.0+ Earthquakes, Past Hour","status":200,"api":"1.10.3","count":5},"features":[{"type":"Feature","properties":{"mag":1.31,"place":"2km SSE of San Ramon, CA","time":1676731374430,"updated":1676731473387,"tz":null,"url":"https://earthquake.usgs.gov/earthquakes/eventpage/nc73848131","detail":"https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/nc73848131.geojson","felt":null,"cdi":null,"mmi":null,"alert":null,"status":"automatic","tsunami":0,"sig":26,"net":"nc","code":"73848131","ids":",nc73848131,","sources":",nc,","types":",nearby-cities,origin,phase-data,","nst":6,"dmin":0.08154,"rms":0.01,"gap":184,"magType":"md","type":"earthquake","title":"M 1.3 - 2km SSE of San Ramon, CA"},"geometry":{"type":"Point","coordinates":[-121.9691696,37.7678337,9.29]},"id":"nc73848131"},
{"type":"Feature","properties":{"mag":1.10000002,"place":"30 km S of Morton, Washington","time":1676730551750,"updated":1676730668280,"tz":null,"url":"https://earthquake.usgs.gov/earthquakes/eventpage/uw61898257","detail":"https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/uw61898257.geojson","felt":null,"cdi":null,"mmi":null,"alert":null,"status":"automatic","tsunami":0,"sig":19,"net":"uw","code":"61898257","ids":",uw61898257,","sources":",uw,","types":",origin,phase-data,","nst":19,"dmin":null,"rms":0.109999999,"gap":117,"magType":"md","type":"earthquake","title":"M 1.1 - 30 km S of Morton, Washington"},"geometry":{"type":"Point","coordinates":[-122.21466827392578,46.28483200073242,4.90000009536743]},"id":"uw61898257"},
{"type":"Feature","properties":{"mag":2.09,"place":"4km NNW of Pinnacles, CA","time":1676730271750,"updated":1676731575539,"tz":null,"url":"https://earthquake.usgs.gov/earthquakes/eventpage/nc73848126","detail":"https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/nc73848126.geojson","felt":null,"cdi":null,"mmi":null,"alert":null,"status":"automatic","tsunami":0,"sig":67,"net":"nc","code":"73848126","ids":",nc73848126,","sources":",nc,","types":",nearby-cities,origin,phase-data,scitech-link,","nst":25,"dmin":0.02442,"rms":0.07,"gap":118,"magType":"md","type":"earthquake","title":"M 2.1 - 4km NNW of Pinnacles, CA"},"geometry":{"type":"Point","coordinates":[-121.1553345,36.5685005,3.98]},"id":"nc73848126"},
{"type":"Feature","properties":{"mag":1.4,"place":"6 km SSW of Big Lake, Alaska","time":1676729392619,"updated":1676730314245,"tz":null,"url":"https://earthquake.usgs.gov/earthquakes/eventpage/ak023299q465","detail":"https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/ak023299q465.geojson","felt":1,"cdi":2.7,"mmi":null,"alert":null,"status":"automatic","tsunami":0,"sig":30,"net":"ak","code":"023299q465","ids":",ak023299q465,","sources":",ak,","types":",dyfi,origin,phase-data,","nst":null,"dmin":null,"rms":0.37,"gap":null,"magType":"ml","type":"earthquake","title":"M 1.4 - 6 km SSW of Big Lake, Alaska"},"geometry":{"type":"Point","coordinates":[-149.9803,61.4684,32.6]},"id":"ak023299q465"},
{"type":"Feature","properties":{"mag":4.7,"place":"central Mid-Atlantic Ridge","time":1676729263180,"updated":1676730921040,"tz":null,"url":"https://earthquake.usgs.gov/earthquakes/eventpage/us6000jpxe","detail":"https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/us6000jpxe.geojson","felt":null,"cdi":null,"mmi":null,"alert":null,"status":"reviewed","tsunami":0,"sig":340,"net":"us","code":"6000jpxe","ids":",us6000jpxe,","sources":",us,","types":",origin,phase-data,","nst":27,"dmin":14.339,"rms":0.71,"gap":90,"magType":"mb","type":"earthquake","title":"M 4.7 - central Mid-Atlantic Ridge"},"geometry":{"type":"Point","coordinates":[-36.0365,7.3653,10]},"id":"us6000jpxe"}],"bbox":[-149.9803,7.3653,3.98,-36.0365,61.4684,32.6]}`;

  const parsed = JSON.parse(hour_mag1);
  expect(parsed).toBeDefined();
  const quakeList = parseGeoJSON(parsed);
  expect(quakeList).toHaveLength(5);
  for (const q of quakeList) {
    expect(q.originList).toHaveLength(1);
    expect(q.magnitudeList).toHaveLength(1);
  }
  const q = quakeList[4];
  expect(q.time).toEqual(DateTime.fromISO("2023-02-18T14:07:43.180Z"));
  expect(q.latitude).toEqual(7.3653);
  expect(q.longitude).toEqual(-36.0365);
  expect(q.depthKm).toEqual(10);
});
