import {
  Quake,
  Origin,
  Magnitude,
  EventDescription,
} from './quakeml';
import {
  JSON_MIME,
  doFetchWithTimeout,
  defaultFetchInitObj,
} from "./util";
import { DateTime} from 'luxon';

const timeoutSec = 10;
export const hourSummerySignificantUrl = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_hour.geojson";
export const hourSummeryAllUrl = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson";

export const daySummerySignificantUrl = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_day.geojson";
export const daySummeryAllUrl = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson";

export const weekSummerySignificantUrl = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson";
export const weekSummeryAllUrl = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson";

export const monthSummerySignificantUrl = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.geojson";
export const monthSummeryAllUrl = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.geojson";

export function loadHourSummarySignificant(): Promise<Array<Quake>> {
  return loadUSGSSummary(hourSummerySignificantUrl);
}
export function loadHourSummaryAll(): Promise<Array<Quake>> {
  return loadUSGSSummary(hourSummeryAllUrl);
}

export function loadDaySummarySignificant(): Promise<Array<Quake>> {
  return loadUSGSSummary(daySummerySignificantUrl);
}
export function loadDaySummaryAll(): Promise<Array<Quake>> {
  return loadUSGSSummary(daySummeryAllUrl);
}

export function loadWeekSummarySignificant(): Promise<Array<Quake>> {
  return loadUSGSSummary(weekSummerySignificantUrl);
}
export function loadWeekSummaryAll(): Promise<Array<Quake>> {
  return loadUSGSSummary(weekSummeryAllUrl);
}

export function loadMonthSummarySignificant(): Promise<Array<Quake>> {
  return loadUSGSSummary(monthSummerySignificantUrl);
}
export function loadMonthSummaryAll(): Promise<Array<Quake>> {
  return loadUSGSSummary(monthSummeryAllUrl);
}

export function loadUSGSSummary(url: string): Promise<Array<Quake>> {
  const fetchInit = defaultFetchInitObj(JSON_MIME);
  return doFetchWithTimeout(url, fetchInit, timeoutSec * 1000)
    .then(function (response) {
      if (response.status !== 200) {
        // no data
        return [];
      } else {
        return response.json();
      }
    })
    .then(function (geojson: string) {
      return parseGeoJSON(geojson);
    });
}

/*
{
  "type":"Feature",
  "properties":{
    "mag":4.7,
    "place":"central Mid-Atlantic Ridge",
    "time":1676729263180,
    "updated":1676730921040,
    "tz":null,
    "url":"https://earthquake.usgs.gov/earthquakes/eventpage/us6000jpxe",
    "detail":"https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/us6000jpxe.geojson",
    "felt":null,
    "cdi":null,
    "mmi":null,
    "alert":null,
    "status":"reviewed",
    "tsunami":0,
    "sig":340,
    "net":"us",
    "code":"6000jpxe",
    "ids":",us6000jpxe,",
    "sources":",us,",
    "types":",origin,phase-data,",
    "nst":27,
    "dmin":14.339,
    "rms":0.71,
    "gap":90,
    "magType":"mb",
    "type":"earthquake",
    "title":"M 4.7 - central Mid-Atlantic Ridge"
  },
  "geometry":{
    "type":"Point",
    "coordinates":[-36.0365,7.3653,10]},
    "id":"us6000jpxe"}],
    "bbox":[-149.9803,7.3653,3.98,-36.0365,61.4684,32.6]
  }
 */

export function parseGeoJSON(geojson: any): Array<Quake> {
    const quakeList = [];
    for (const f of geojson.features) {
      const quake = parseFeatureAsQuake(f);
      quakeList.push(quake);
    }
    return quakeList;
}

export function parseFeatureAsQuake(feature: any): Quake {
  const quake = new Quake();
  quake.publicId = feature.geometry.id;
  const p = feature.properties;
  quake.descriptionList.push(new EventDescription(p.title));
  const origin = new Origin(DateTime.fromMillis(p.time),
                            feature.geometry.coordinates[1],
                            feature.geometry.coordinates[0]);
  origin.depth = feature.geometry.coordinates[2]*1000;
  quake.originList.push(origin);
  const mag = new Magnitude(p.mag);
  mag.type = p.magType;
  quake.magnitudeList.push(mag);
  quake.preferredOrigin = origin;
  quake.preferredMagnitude = mag;
  return quake;
}
