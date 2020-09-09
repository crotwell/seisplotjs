// @flow

import * as fdsnevent from '../../src/fdsnevent.js';
import * as quakeml from '../../src/quakeml.js';
import * as util from '../../src/util.js';
let moment = util.moment;

test( "query setter test", () => {
  let eventQuery = new fdsnevent.EventQuery();
  const MINMAG = 5.5;
  eventQuery.minMag(MINMAG);
  expect(eventQuery.minMag()).toBe(MINMAG);
});


test( "form url test", () => {
  let query = new fdsnevent.EventQuery();
  const NO_DATA = 404;
  const MINMAG = 5.5;
  const MIN_DEPTH = 100;
  const MAX_DEPTH = 500;
  const START = moment.utc("2018-01-01");
  const END = moment.utc("2018-01-11");
  const IRIS_HOST = "service.iris.edu";
  const MAG_TYPE = "mw";
  expect(query.host(IRIS_HOST)).toBe(query);
  expect(query.host()).toBe(IRIS_HOST);
  expect(query.startTime(START)).toBe(query);
  expect(query.startTime()).toBe(START);
  expect(query.endTime(END)).toBe(query);
  expect(query.endTime()).toBe(END);
  expect(query.updatedAfter(END)).toBe(query);
  expect(query.updatedAfter()).toBe(END);
  expect(query.minMag(MINMAG)).toBe(query);
  expect(query.minMag()).toBe(MINMAG);
  expect(query.maxMag(MINMAG)).toBe(query);
  expect(query.maxMag()).toBe(MINMAG);
  expect(query.magnitudeType(MAG_TYPE)).toBe(query);
  expect(query.magnitudeType()).toBe(MAG_TYPE);

  expect(query.nodata(NO_DATA)).toBe(query);
  expect(query.nodata()).toBe(NO_DATA);

  expect(query.minDepth(MIN_DEPTH)).toBe(query);
  expect(query.minDepth()).toBe(MIN_DEPTH);
  expect(query.maxDepth(MAX_DEPTH)).toBe(query);
  expect(query.maxDepth()).toBe(MAX_DEPTH);

  expect(query.minLat(12)).toBe(query);
  expect(query.minLat()).toBe(12);
  expect(query.maxLat(12)).toBe(query);
  expect(query.maxLat()).toBe(12);
  expect(query.minLon(12)).toBe(query);
  expect(query.minLon()).toBe(12);
  expect(query.maxLon(12)).toBe(query);
  expect(query.maxLon()).toBe(12);
  expect(query.latitude(12)).toBe(query);
  expect(query.latitude()).toBe(12);
  expect(query.longitude(12)).toBe(query);
  expect(query.longitude()).toBe(12);
  expect(query.minRadius(12)).toBe(query);
  expect(query.minRadius()).toBe(12);
  expect(query.maxRadius(12)).toBe(query);
  expect(query.maxRadius()).toBe(12);
  expect(query.includeArrivals(true)).toBe(query);
  expect(query.includeArrivals()).toBe(true);
  expect(query.includeAllOrigins(true)).toBe(query);
  expect(query.includeAllOrigins()).toBe(true);
  expect(query.includeAllMagnitudes(true)).toBe(query);
  expect(query.includeAllMagnitudes()).toBe(true);
  expect(query.updatedAfter(END)).toBe(query);
  expect(query.updatedAfter()).toBe(END);
  expect(query.format("miniseed")).toBe(query);
  expect(query.format()).toEqual("miniseed");
  expect(query.eventId("event7")).toBe(query);
  expect(query.eventId()).toEqual("event7");
  expect(query.limit(10)).toBe(query);
  expect(query.limit()).toEqual(10);
  expect(query.offset(40)).toBe(query);
  expect(query.offset()).toEqual(40);
  expect(query.orderBy("time-asc")).toBe(query);
  expect(query.orderBy()).toEqual("time-asc");
  expect(query.contributor("somebody")).toBe(query);
  expect(query.contributor()).toEqual("somebody");
  expect(query.catalog("someCatalog")).toBe(query);
  expect(query.catalog()).toEqual("someCatalog");
  expect(query.nodata(404)).toBe(query);
  expect(query.nodata()).toEqual(404);
  const url = query.formURL();
  expect(url).toBeDefined();
  // eventid is first, so no &
  expect(url).toContain('?eventid=');
  for(const k of ['starttime', 'endtime', 'updatedafter',
      'minmag', 'maxmag', 'magnitudetype',
      'mindepth', 'maxdepth',
      'minlat', 'maxlat', 'minlon', 'maxlon',
      'latitude', 'longitude', 'minradius', 'maxradius',
      'includearrivals', 'includeallorigins', 'includeallmagnitudes',
      'orderby', 'offset', 'limit',
      'catalog', 'contributor',
      'updatedafter', 'format', 'nodata']) {
    expect(url).toContain('&'+k+'=');
  }
  expect(query.formURL()).toContain("http"); // might be http or https
  expect(query.formURL()).toContain("://service.iris.edu/fdsnws/event/1/query?");
});


test( "qml util test", () => {
  const xml = new DOMParser().parseFromString(RAW_XML_QML, "text/xml");
  expect(util.isObject(xml)).toBeTrue();
  let eventArray = xml.getElementsByTagName("event");
  for (let eventEl of eventArray) {
    expect(util.isObject(eventEl)).toBeTrue();

    let allMagEls = eventEl.getElementsByTagNameNS(quakeml.BED_NS, "magnitude");
    for (let magEl of allMagEls) {
      expect(util.isObject(magEl)).toBeTrue();
      let mag = quakeml.parseUtil._grabFirstElNS(magEl, quakeml.BED_NS, 'mag');
      expect(util.isObject(mag)).toBeTrue();
      expect(quakeml.parseUtil._grabFirstEl(mag, 'value')).toBeObject();
      expect(quakeml.parseUtil._grabFirstElNS(mag, quakeml.BED_NS, 'value')).toBeObject();
      expect(quakeml.parseUtil._grabFirstElText(mag, 'value')).toBeString();
      expect(quakeml.parseUtil._grabFirstElFloat(mag, 'value')).toBeDefined();
      let magVal = quakeml.parseUtil._grabFirstElFloat(mag, 'value');
      expect(magVal).toBeFinite();
      expect(magVal).toBeWithin(0, 10);
      let type = quakeml.parseUtil._grabFirstElText(magEl, 'type');
      expect(type).toBeString();
    }
  }
});

test( "qml parse test", () => {
  const xml = new DOMParser().parseFromString(RAW_XML_QML, "text/xml");
  let quakes = quakeml.parseQuakeML(xml);
  expect(quakes.length).toBe(7);
  expect(quakes[0].time.toISOString()).toEqual("2018-06-04T01:50:48.520Z");
  expect(quakes[0].latitude).toEqual(19.4053333);
  expect(quakes[0].longitude).toEqual(-155.2843333);
  expect(quakes[0].depth).toEqual(-1140);
  expect(quakes[0].magnitude.mag).toEqual(5.5);
  expect(quakes[0].magnitude.type).toEqual("mw");
  expect(quakes[0].toString()).toEqual("2018-06-04T01:50:48.520Z 19.4053333 -155.2843333 -1.14 km 5.5 mw");
});

const RAW_XML_QML = `<?xml version="1.0" encoding="UTF-8"?>
<q:quakeml xmlns="http://quakeml.org/xmlns/bed/1.2" xmlns:anss="http://anss.org/xmlns/event/0.1" xmlns:catalog="http://anss.org/xmlns/catalog/0.1" xmlns:q="http://quakeml.org/xmlns/quakeml/1.2">
<eventParameters publicID="quakeml:earthquake.usgs.gov/fdsnws/event/1/query?starttime=2018-05-25T12%3A58%3A36&amp;endtime=2018-06-04T12%3A58%3A36&amp;minmag=5.5">
<event catalog:datasource="hv" catalog:eventsource="hv" catalog:eventid="70228857" publicID="quakeml:earthquake.usgs.gov/fdsnws/event/1/query?eventid=hv70228857&amp;format=quakeml"><description><type>earthquake name</type><text>5km WSW of Volcano, Hawaii</text></description><origin catalog:datasource="hv" catalog:dataid="hv70228857" catalog:eventsource="hv" catalog:eventid="70228857" publicID="quakeml:earthquake.usgs.gov/archive/product/origin/hv70228857/hv/1528078865270/product.xml"><time><value>2018-06-04T01:50:48.520Z</value></time><longitude><value>-155.2843333</value></longitude><latitude><value>19.4053333</value></latitude><depth><value>-1140</value><uncertainty>31610</uncertainty></depth><originUncertainty><horizontalUncertainty>250</horizontalUncertainty><preferredDescription>horizontal uncertainty</preferredDescription></originUncertainty><quality><usedPhaseCount>18</usedPhaseCount><usedStationCount>17</usedStationCount><standardError>0.18</standardError><azimuthalGap>88</azimuthalGap><minimumDistance>0.01227</minimumDistance></quality><evaluationMode>manual</evaluationMode><creationInfo><agencyID>HV</agencyID><creationTime>2018-06-04T02:21:05.270Z</creationTime><version>5</version></creationInfo></origin><magnitude catalog:datasource="hv" catalog:dataid="hv70228857" catalog:eventsource="hv" catalog:eventid="70228857" publicID="quakeml:earthquake.usgs.gov/archive/product/origin/hv70228857/hv/1528078865270/product.xml#magnitude"><mag><value>5.5</value></mag><type>mw</type><stationCount>8</stationCount><originID>quakeml:earthquake.usgs.gov/archive/product/origin/hv70228857/hv/1528078865270/product.xml</originID><evaluationMode>manual</evaluationMode><creationInfo><agencyID>HV</agencyID><creationTime>2018-06-04T02:21:05.270Z</creationTime></creationInfo></magnitude><preferredOriginID>quakeml:earthquake.usgs.gov/archive/product/origin/hv70228857/hv/1528078865270/product.xml</preferredOriginID><preferredMagnitudeID>quakeml:earthquake.usgs.gov/archive/product/origin/hv70228857/hv/1528078865270/product.xml#magnitude</preferredMagnitudeID><type>volcanic eruption</type><creationInfo><agencyID>hv</agencyID><creationTime>2018-06-04T09:15:53.249Z</creationTime><version>5</version></creationInfo></event>
<event catalog:datasource="us" catalog:eventsource="us" catalog:eventid="1000ehmb" publicID="quakeml:earthquake.usgs.gov/fdsnws/event/1/query?eventid=us1000ehmb&amp;format=quakeml"><description><type>earthquake name</type><text>82km ENE of Pangai, Tonga</text></description><origin catalog:datasource="us" catalog:dataid="us1000ehmb" catalog:eventsource="us" catalog:eventid="1000ehmb" publicID="quakeml:earthquake.usgs.gov/archive/product/origin/us1000ehmb/us/1527988097040/product.xml"><time><value>2018-06-03T00:48:09.090Z</value></time><longitude><value>-173.6821</value></longitude><latitude><value>-19.4045</value></latitude><depth><value>10000</value><uncertainty>1800</uncertainty></depth><originUncertainty><horizontalUncertainty>10800</horizontalUncertainty><preferredDescription>horizontal uncertainty</preferredDescription></originUncertainty><quality><usedPhaseCount>103</usedPhaseCount><standardError>1.06</standardError><azimuthalGap>36</azimuthalGap><minimumDistance>12.829</minimumDistance></quality><evaluationMode>manual</evaluationMode><creationInfo><agencyID>us</agencyID><creationTime>2018-06-03T01:08:17.040Z</creationTime></creationInfo></origin><magnitude catalog:datasource="us" catalog:dataid="us1000ehmb" catalog:eventsource="us" catalog:eventid="1000ehmb" publicID="quakeml:earthquake.usgs.gov/archive/product/origin/us1000ehmb/us/1527988097040/product.xml#magnitude"><mag><value>5.6</value><uncertainty>0.029</uncertainty></mag><type>mb</type><stationCount>407</stationCount><originID>quakeml:earthquake.usgs.gov/archive/product/origin/us1000ehmb/us/1527988097040/product.xml</originID><evaluationMode>manual</evaluationMode><creationInfo><agencyID>us</agencyID><creationTime>2018-06-03T01:08:17.040Z</creationTime></creationInfo></magnitude><preferredOriginID>quakeml:earthquake.usgs.gov/archive/product/origin/us1000ehmb/us/1527988097040/product.xml</preferredOriginID><preferredMagnitudeID>quakeml:earthquake.usgs.gov/archive/product/origin/us1000ehmb/us/1527988097040/product.xml#magnitude</preferredMagnitudeID><type>earthquake</type><creationInfo><agencyID>us</agencyID><creationTime>2018-06-03T02:56:23.383Z</creationTime></creationInfo></event>
<event catalog:datasource="us" catalog:eventsource="us" catalog:eventid="1000ehes" publicID="quakeml:earthquake.usgs.gov/fdsnws/event/1/query?eventid=us1000ehes&amp;format=quakeml"><description><type>earthquake name</type><text>163km SE of Sarangani, Philippines</text></description><origin catalog:datasource="us" catalog:dataid="us1000ehes" catalog:eventsource="us" catalog:eventid="1000ehes" publicID="quakeml:earthquake.usgs.gov/archive/product/origin/us1000ehes/us/1527957757040/product.xml"><time><value>2018-06-02T16:29:01.780Z</value></time><longitude><value>126.6861</value></longitude><latitude><value>4.5744</value></latitude><depth><value>40930</value><uncertainty>8000</uncertainty></depth><originUncertainty><horizontalUncertainty>9400</horizontalUncertainty><preferredDescription>horizontal uncertainty</preferredDescription></originUncertainty><quality><usedPhaseCount>54</usedPhaseCount><standardError>0.97</standardError><azimuthalGap>75</azimuthalGap><minimumDistance>3.837</minimumDistance></quality><evaluationMode>manual</evaluationMode><creationInfo><agencyID>us</agencyID><creationTime>2018-06-02T16:42:37.040Z</creationTime></creationInfo></origin><magnitude catalog:datasource="us" catalog:dataid="us1000ehes" catalog:eventsource="us" catalog:eventid="1000ehes" publicID="quakeml:earthquake.usgs.gov/archive/product/origin/us1000ehes/us/1527957757040/product.xml#magnitude"><mag><value>5.7</value><uncertainty>0.071</uncertainty></mag><type>mww</type><stationCount>19</stationCount><originID>quakeml:earthquake.usgs.gov/archive/product/origin/us1000ehes/us/1527957757040/product.xml</originID><evaluationMode>manual</evaluationMode><creationInfo><agencyID>us</agencyID><creationTime>2018-06-02T16:42:37.040Z</creationTime></creationInfo></magnitude><preferredOriginID>quakeml:earthquake.usgs.gov/archive/product/origin/us1000ehes/us/1527957757040/product.xml</preferredOriginID><preferredMagnitudeID>quakeml:earthquake.usgs.gov/archive/product/origin/us1000ehes/us/1527957757040/product.xml#magnitude</preferredMagnitudeID><type>earthquake</type><creationInfo><agencyID>us</agencyID><creationTime>2018-06-02T18:36:42.724Z</creationTime></creationInfo></event>
<event catalog:datasource="us" catalog:eventsource="us" catalog:eventid="1000ehd9" publicID="quakeml:earthquake.usgs.gov/fdsnws/event/1/query?eventid=us1000ehd9&amp;format=quakeml"><description><type>earthquake name</type><text>135km SW of Gataivai, Samoa</text></description><origin catalog:datasource="us" catalog:dataid="us1000ehd9" catalog:eventsource="us" catalog:eventid="1000ehd9" publicID="quakeml:earthquake.usgs.gov/archive/product/origin/us1000ehd9/us/1527941183040/product.xml"><time><value>2018-06-02T11:53:06.810Z</value></time><longitude><value>-173.1078</value></longitude><latitude><value>-14.7807</value></latitude><depth><value>49770</value><uncertainty>8200</uncertainty></depth><originUncertainty><horizontalUncertainty>8700</horizontalUncertainty><preferredDescription>horizontal uncertainty</preferredDescription></originUncertainty><quality><usedPhaseCount>32</usedPhaseCount><standardError>1.2</standardError><azimuthalGap>94</azimuthalGap><minimumDistance>1.553</minimumDistance></quality><evaluationMode>manual</evaluationMode><creationInfo><agencyID>us</agencyID><creationTime>2018-06-02T12:06:23.040Z</creationTime></creationInfo></origin><magnitude catalog:datasource="us" catalog:dataid="us1000ehd9" catalog:eventsource="us" catalog:eventid="1000ehd9" publicID="quakeml:earthquake.usgs.gov/archive/product/origin/us1000ehd9/us/1527941183040/product.xml#magnitude"><mag><value>5.6</value><uncertainty>0.126</uncertainty></mag><type>mb</type><stationCount>22</stationCount><originID>quakeml:earthquake.usgs.gov/archive/product/origin/us1000ehd9/us/1527941183040/product.xml</originID><evaluationMode>manual</evaluationMode><creationInfo><agencyID>us</agencyID><creationTime>2018-06-02T12:06:23.040Z</creationTime></creationInfo></magnitude><preferredOriginID>quakeml:earthquake.usgs.gov/archive/product/origin/us1000ehd9/us/1527941183040/product.xml</preferredOriginID><preferredMagnitudeID>quakeml:earthquake.usgs.gov/archive/product/origin/us1000ehd9/us/1527941183040/product.xml#magnitude</preferredMagnitudeID><type>earthquake</type><creationInfo><agencyID>us</agencyID><creationTime>2018-06-02T16:13:06.040Z</creationTime></creationInfo></event>
<event catalog:datasource="us" catalog:eventsource="us" catalog:eventid="1000ehc2" publicID="quakeml:earthquake.usgs.gov/fdsnws/event/1/query?eventid=us1000ehc2&amp;format=quakeml"><description><type>earthquake name</type><text>107km E of Shikotan, Russia</text></description><origin catalog:datasource="us" catalog:dataid="us1000ehc2" catalog:eventsource="us" catalog:eventid="1000ehc2" publicID="quakeml:earthquake.usgs.gov/archive/product/origin/us1000ehc2/us/1527934006040/product.xml"><time><value>2018-06-02T09:48:08.400Z</value></time><longitude><value>148.0441</value></longitude><latitude><value>43.9465</value></latitude><depth><value>10000</value><uncertainty>1800</uncertainty></depth><originUncertainty><horizontalUncertainty>8100</horizontalUncertainty><preferredDescription>horizontal uncertainty</preferredDescription></originUncertainty><quality><usedPhaseCount>118</usedPhaseCount><standardError>0.81</standardError><azimuthalGap>113</azimuthalGap><minimumDistance>3.934</minimumDistance></quality><evaluationMode>manual</evaluationMode><creationInfo><agencyID>us</agencyID><creationTime>2018-06-02T10:06:46.040Z</creationTime></creationInfo></origin><magnitude catalog:datasource="us" catalog:dataid="us1000ehc2" catalog:eventsource="us" catalog:eventid="1000ehc2" publicID="quakeml:earthquake.usgs.gov/archive/product/origin/us1000ehc2/us/1527934006040/product.xml#magnitude"><mag><value>5.5</value><uncertainty>0.069</uncertainty></mag><type>mww</type><stationCount>20</stationCount><originID>quakeml:earthquake.usgs.gov/archive/product/origin/us1000ehc2/us/1527934006040/product.xml</originID><evaluationMode>manual</evaluationMode><creationInfo><agencyID>us</agencyID><creationTime>2018-06-02T10:06:46.040Z</creationTime></creationInfo></magnitude><preferredOriginID>quakeml:earthquake.usgs.gov/archive/product/origin/us1000ehc2/us/1527934006040/product.xml</preferredOriginID><preferredMagnitudeID>quakeml:earthquake.usgs.gov/archive/product/origin/us1000ehc2/us/1527934006040/product.xml#magnitude</preferredMagnitudeID><type>earthquake</type><creationInfo><agencyID>us</agencyID><creationTime>2018-06-02T16:21:14.040Z</creationTime></creationInfo></event>
<event catalog:datasource="us" catalog:eventsource="us" catalog:eventid="1000eg6j" publicID="quakeml:earthquake.usgs.gov/fdsnws/event/1/query?eventid=us1000eg6j&amp;format=quakeml"><description><type>earthquake name</type><text>186km SSW of L'Esperance Rock, New Zealand</text></description><origin catalog:datasource="us" catalog:dataid="us1000eg6j" catalog:eventsource="us" catalog:eventid="1000eg6j" publicID="quakeml:earthquake.usgs.gov/archive/product/origin/us1000eg6j/us/1527829819040/product.xml"><time><value>2018-06-01T04:52:30.860Z</value></time><longitude><value>-179.4018</value></longitude><latitude><value>-33.0634</value></latitude><depth><value>10000</value><uncertainty>1800</uncertainty></depth><originUncertainty><horizontalUncertainty>8800</horizontalUncertainty><preferredDescription>horizontal uncertainty</preferredDescription></originUncertainty><quality><usedPhaseCount>91</usedPhaseCount><standardError>1.07</standardError><azimuthalGap>59</azimuthalGap><minimumDistance>4.01</minimumDistance></quality><evaluationMode>manual</evaluationMode><creationInfo><agencyID>us</agencyID><creationTime>2018-06-01T05:10:19.040Z</creationTime></creationInfo></origin><magnitude catalog:datasource="us" catalog:dataid="us1000eg6j" catalog:eventsource="us" catalog:eventid="1000eg6j" publicID="quakeml:earthquake.usgs.gov/archive/product/origin/us1000eg6j/us/1527829819040/product.xml#magnitude"><mag><value>5.6</value><uncertainty>0.073</uncertainty></mag><type>mww</type><stationCount>18</stationCount><originID>quakeml:earthquake.usgs.gov/archive/product/origin/us1000eg6j/us/1527829819040/product.xml</originID><evaluationMode>manual</evaluationMode><creationInfo><agencyID>us</agencyID><creationTime>2018-06-01T05:10:19.040Z</creationTime></creationInfo></magnitude><preferredOriginID>quakeml:earthquake.usgs.gov/archive/product/origin/us1000eg6j/us/1527829819040/product.xml</preferredOriginID><preferredMagnitudeID>quakeml:earthquake.usgs.gov/archive/product/origin/us1000eg6j/us/1527829819040/product.xml#magnitude</preferredMagnitudeID><type>earthquake</type><creationInfo><agencyID>us</agencyID><creationTime>2018-06-02T16:43:44.040Z</creationTime></creationInfo></event>
<event catalog:datasource="us" catalog:eventsource="us" catalog:eventid="1000ed0t" publicID="quakeml:earthquake.usgs.gov/fdsnws/event/1/query?eventid=us1000ed0t&amp;format=quakeml"><description><type>earthquake name</type><text>149km S of False Pass, Alaska</text></description><origin catalog:datasource="us" catalog:dataid="us1000ed0t" catalog:eventsource="us" catalog:eventid="1000ed0t" publicID="quakeml:earthquake.usgs.gov/archive/product/origin/us1000ed0t/us/1527960603040/product.xml"><time><value>2018-05-27T19:33:39.180Z</value></time><longitude><value>-163.6755</value></longitude><latitude><value>53.5159</value></latitude><depth><value>19930</value><uncertainty>3200</uncertainty></depth><originUncertainty><horizontalUncertainty>5200</horizontalUncertainty><preferredDescription>horizontal uncertainty</preferredDescription></originUncertainty><quality><usedPhaseCount>127</usedPhaseCount><standardError>1.44</standardError><azimuthalGap>82</azimuthalGap><minimumDistance>1.098</minimumDistance></quality><evaluationMode>manual</evaluationMode><creationInfo><agencyID>us</agencyID><creationTime>2018-06-02T17:30:03.040Z</creationTime></creationInfo></origin><magnitude catalog:datasource="us" catalog:dataid="us1000ed0t" catalog:eventsource="us" catalog:eventid="1000ed0t" publicID="quakeml:earthquake.usgs.gov/archive/product/origin/us1000ed0t/us/1527960603040/product.xml#magnitude"><mag><value>5.5</value><uncertainty>0.043</uncertainty></mag><type>mww</type><stationCount>51</stationCount><originID>quakeml:earthquake.usgs.gov/archive/product/origin/us1000ed0t/us/1527960603040/product.xml</originID><evaluationMode>manual</evaluationMode><creationInfo><agencyID>us</agencyID><creationTime>2018-06-02T17:30:03.040Z</creationTime></creationInfo></magnitude><preferredOriginID>quakeml:earthquake.usgs.gov/archive/product/origin/us1000ed0t/us/1527960603040/product.xml</preferredOriginID><preferredMagnitudeID>quakeml:earthquake.usgs.gov/archive/product/origin/us1000ed0t/us/1527960603040/product.xml#magnitude</preferredMagnitudeID><type>earthquake</type><creationInfo><agencyID>us</agencyID><creationTime>2018-06-02T17:36:46.386Z</creationTime></creationInfo></event>
<creationInfo><creationTime>2018-06-04T12:58:37.000Z</creationTime></creationInfo>
</eventParameters></q:quakeml>`;
