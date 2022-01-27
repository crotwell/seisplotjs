// @flow

import { knownDataCenters } from '../src/knownDataCenters.js';

// eslint-disable-next-line no-undef
const fetch = require('node-fetch');
// eslint-disable-next-line no-undef
global.fetch = fetch;

test("fetch directly", () => {
  // $FlowExpectedError[prop-missing]
  expect(knownDataCenters.knownDataCentersJsonURL).toBeDefined();
    // $FlowExpectedError[prop-missing]
  return fetch(knownDataCenters.knownDataCentersJsonURL)
  .then(response => {
    expect(response.status).toBe(200);
    expect(response.json()).toBeDefined();
  });
});


test("load known DCs", () => {
  // $FlowExpectedError[prop-missing]
  return knownDataCenters.getKnownDataCenters().then(knownDCs => {
    expect(knownDCs).toBeDefined();
  });
});
