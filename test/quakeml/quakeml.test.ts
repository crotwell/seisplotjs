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
  expect(quakes[0].magnitudeList).toHaveLength(2);
  expect(quakes[0].magnitudeList[0]).toMatchObject({
    mag: {
      value: 7.6,
      uncertainty: 0.055,
      confidenceLevel: 90,
    },
    type: 'Mww',
    stationCount: 32,
    evaluationMode: "manual",
    evaluationStatus: "preliminary",
    creationInfo: {
      agencyID: 'us',
      agencyURI: "smi:anss.org/metadata/agencyid/us",
      creationTime: isoToDateTime("2023-05-10T16:14:55.000000Z"),
    },
    publicId: "quakeml:us.anss.org/magnitude/6000kawn/mww",
  });
  expect(quakes[0].hasOrigin()).toBeTrue();
  expect(quakes[0].origin.arrivalList).toHaveLength(117);
  expect(quakes[0].origin.arrivalList[0]).toMatchObject({
    phase: "Pn",
    azimuth: 290.266,
    distance: 3.63079,
    takeoffAngle: {
      value: 69,
    },
    timeResidual: 2.15,
    timeWeight: 0.87,
    creationInfo: {
      agencyID: 'us',
      agencyURI: "smi:anss.org/metadata/agencyid/us",
      author: "manual",
      creationTime: isoToDateTime("2023-05-10T16:08:11.000000Z"),
    },
    publicId: "quakeml:us.anss.org/arrival/6000kawn/us_a7814_bpid-6003473869",
  });
  expect(quakes[0].picks).toHaveLength(117);
  expect(quakes[0].picks[0]).toMatchObject({
    time: {
      value: isoToDateTime("2023-05-10T16:03:00.280000Z"),
    },
    networkCode: "G",
    stationCode: "FUTU",
    locationCode: "00",
    channelCode: "BHZ",
    evaluationMode: "manual",
    creationInfo: {
      agencyID: 'us',
      agencyURI: "smi:anss.org/metadata/agencyid/us",
      creationTime: isoToDateTime("2023-05-10T16:08:11.000000Z"),
    },
    publicId: "quakeml:us.anss.org/pick/6000kawn/us_a7814_bpid-6003473869",
  });
});
