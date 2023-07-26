
// eslint-disable-next-line no-undef
const fetch = require('node-fetch');
// eslint-disable-next-line no-undef
global.fetch = fetch;

import * as usgsgeosjon from '../src/usgsgeojson';
import type {Quake} from '../src/quakeml';

test("grab", () => {
  return usgsgeosjon.loadHourSummaryAll().then((quakeList: Array<Quake>) => {
    expect(quakeList).toBeDefined();
    expect(quakeList).not.toHaveLength(0);
  });
});
