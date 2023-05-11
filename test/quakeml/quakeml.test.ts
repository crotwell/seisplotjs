// @flow

import fs from 'fs';

import * as quakeml from '../../src/quakeml.js';
import {isoToDateTime} from '../../src/util';

test("viewobspy quake", () => {

  const filename = "./test/quakeml/data/obspy_catalog.xml";
  const rawData = fs.readFileSync(filename, 'utf8');
  const xml = new DOMParser().parseFromString(rawData, "text/xml");
  const quakes = quakeml.parseQuakeML(xml);
  expect(quakes).toHaveLength(2);
  expect(quakes[0].time).toEqual(isoToDateTime(("2019-10-31T01:20:58.661000Z")));
});

test("USGS quake", () => {

  const filename = "./test/quakeml/data/usgs.xml";
  const rawData = fs.readFileSync(filename, 'utf8');
  const xml = new DOMParser().parseFromString(rawData, "text/xml");
  const quakes = quakeml.parseQuakeML(xml);
  expect(quakes).toHaveLength(1);
  expect(quakes[0].time).toEqual(isoToDateTime(("2023-05-10T16:02:00.451000Z")));
  expect(quakes[0].hasOrigin()).toBeTrue();
  expect(quakes[0].origin.arrivalList).toHaveLength(117);
  expect(quakes[0].origin.arrivalList[0].phase).toBe("Pn");
  expect(quakes[0].origin.arrivalList[0].timeCorrection).toBe(undefined);
  expect(quakes[0].origin.arrivalList[0].azimuth).toBe(290.266);
  expect(quakes[0].origin.arrivalList[0].distance).toBe(3.63079);
  expect(quakes[0].origin.arrivalList[0].takeoffAngle).toMatchObject<quakeml.RealQuantity>({value: 69});
  expect(quakes[0].origin.arrivalList[0].timeResidual).toBe(2.15);
  expect(quakes[0].origin.arrivalList[0].timeWeight).toBe(0.87);
  expect(quakes[0].origin.arrivalList[0].creationInfo).toMatchObject<quakeml.CreationInfo>({
    agencyID: 'us',
    agencyURI: "smi:anss.org/metadata/agencyid/us",
    author: "manual"
  });
  expect(quakes[0].origin.arrivalList[0].creationInfo?.creationTime).toEqual(isoToDateTime("2023-05-10T16:08:11.000000Z"));
});
