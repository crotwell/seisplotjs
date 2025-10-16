
import * as nws from '../../src/nws';

import fs from 'fs';

let pointsJson: nws.NWSPointInfo;
let forecastJson: nws.NWSForecast;

beforeAll(() => {
  const pointsFilename = "./test/nws/nws_points.geojson";
  const pointsRawData = fs.readFileSync(pointsFilename, 'utf8');
  pointsJson = JSON.parse(pointsRawData);
  const forecastFilename = "./test/nws/nws_forecast.geojson";
  const forecastRawData = fs.readFileSync(forecastFilename, 'utf8');
  forecastJson = JSON.parse(forecastRawData);
});

test( "parsePoints", () => {
  expect(pointsJson).toBeObject();
  const points = nws.NWSPointInfo.parse(pointsJson);
  expect(points).toBeDefined();
});
test( "parseForecast", () => {
  const forecast = nws.NWSForecast.parse(forecastJson);
  expect(forecast).toBeDefined();
});
test( "parseObsStations", () => {
  const obsStaFilename = "./test/nws/nws_obs_stations.geojson";
  const obsStaRawData = fs.readFileSync(obsStaFilename, 'utf8');
  const obsStaJson = JSON.parse(obsStaRawData);
  const obsSta = nws.NWSObsStationCollection.parse(obsStaJson);
  expect(obsSta).toBeDefined();
});
