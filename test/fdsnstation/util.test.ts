// @flow

import * as stationxml from '../../src/stationxml.js';

test( "_grabFirstEl test", () => {
  const LATITUDE = "Latitude";
  const xml = new DOMParser().parseFromString(rawXML, "text/xml")
    .documentElement;
  const net = stationxml.parseUtil._grabFirstEl(xml, "Network");
  expect(net).toBeDefined();
  const sta = stationxml.parseUtil._grabFirstEl(net, "Station");
  expect(sta).toBeDefined();
  const lat = stationxml.parseUtil._grabFirstEl(sta, LATITUDE);
  expect(lat).toBeDefined();
  expect(lat).not.toBeNull();
  if (lat) {
    expect(lat.textContent).toBe("34.2818");
    expect(stationxml.parseUtil._grabFirstElText(sta, LATITUDE)).toBe("34.2818");
    expect(stationxml.parseUtil._grabFirstElFloat(sta, LATITUDE)).toBe(34.2818);
  }
});

const rawXML = `<?xml version="1.0" encoding="ISO-8859-1"?>

<FDSNStationXML xmlns="http://www.fdsn.org/xml/station/1" schemaVersion="1.0" xsi:schemaLocation="http://www.fdsn.org/xml/station/1 http://www.fdsn.org/xml/station/fdsn-station-1.0.xsd" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:iris="http://www.fdsn.org/xml/station/1/iris">
 <Source>IRIS-DMC</Source>
 <Sender>IRIS-DMC</Sender>
 <Module>IRIS WEB SERVICE: fdsnws-station | version: 1.1.33</Module>
 <ModuleURI>http://service.iris.edu/fdsnws/station/1/query?level=station&amp;net=TA%2CCO&amp;sta=109C%2CJSC</ModuleURI>
 <Created>2018-06-01T12:29:16</Created>
 <Network code="CO" startDate="1987-01-01T00:00:00" endDate="2500-12-31T23:59:59" restrictedStatus="open">
  <Description>South Carolina Seismic Network</Description>
  <TotalNumberStations>14</TotalNumberStations>
  <SelectedNumberStations>1</SelectedNumberStations>
  <Station code="JSC" startDate="2009-04-13T00:00:00" endDate="2599-12-31T23:59:59" restrictedStatus="open" iris:alternateNetworkCodes="_CEUSN,.GREG,.CEUSN-CONTRIB,_US-REGIONAL,_REALTIME,.UNRESTRICTED">
   <Latitude>34.2818</Latitude>
   <Longitude>-81.25966</Longitude>
   <Elevation>103.0</Elevation>
   <Site>
    <Name>Jenkinsville, South Carolina</Name>
   </Site>
   <CreationDate>2009-04-13T00:00:00</CreationDate>
   <TotalNumberChannels>78</TotalNumberChannels>
   <SelectedNumberChannels>0</SelectedNumberChannels>
  </Station>
 </Network>
 <Network code="TA" startDate="2003-01-01T00:00:00" endDate="2500-12-31T23:59:59" restrictedStatus="open">
  <Description>USArray Transportable Array (NSF EarthScope Project)</Description>
  <TotalNumberStations>1890</TotalNumberStations>
  <SelectedNumberStations>1</SelectedNumberStations>
  <Station code="109C" startDate="2004-05-04T00:00:00" endDate="2599-12-31T23:59:59" restrictedStatus="open" iris:alternateNetworkCodes="_US-ALL,.EARTHSCOPE,_US-TA,_REALTIME,.UNRESTRICTED">
   <Latitude>32.8889</Latitude>
   <Longitude>-117.1051</Longitude>
   <Elevation>150.0</Elevation>
   <Site>
    <Name>Camp Elliot, Miramar, CA, USA</Name>
   </Site>
   <CreationDate>2004-05-04T00:00:00</CreationDate>
   <TotalNumberChannels>172</TotalNumberChannels>
   <SelectedNumberChannels>0</SelectedNumberChannels>
  </Station>
 </Network>
</FDSNStationXML>`;
