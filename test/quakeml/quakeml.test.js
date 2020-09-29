// @flow

import fs from 'fs';

import * as quakeml from '../../src/quakeml.js';

import {Quake} from '../../src/quakeml';

import moment from 'moment';

test("viewobspy quake", () => {

  let filename = "./test/quakeml/data/obspy_catalog.xml";
  let rawData = fs.readFileSync(filename, 'utf8');
  const xml = new DOMParser().parseFromString(rawData, "text/xml");
  const quakes = quakeml.parseQuakeML(xml);
  expect(quakes).toHaveLength(2);
  expect(quakes[0].time).toEqual(moment.utc(("2019-10-31T01:20:58.661000Z")));
});
