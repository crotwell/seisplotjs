// @flow

import fs from 'fs';

import * as quakeml from '../../src/quakeml.js';
import {isoToDateTime} from '../../src/util';

test("viewobspy quake", () => {

  let filename = "./test/quakeml/data/obspy_catalog.xml";
  let rawData = fs.readFileSync(filename, 'utf8');
  const xml = new DOMParser().parseFromString(rawData, "text/xml");
  const quakes = quakeml.parseQuakeML(xml);
  expect(quakes).toHaveLength(2);
  expect(quakes[0].time).toEqual(isoToDateTime(("2019-10-31T01:20:58.661000Z")));
});
