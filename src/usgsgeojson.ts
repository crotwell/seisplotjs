import {
  Quake,
  Origin,
  Magnitude,
  CreationInfo,
  EventDescription,
  EventParameters,
} from './quakeml';
import {
  JSON_MIME,
  doFetchWithTimeout,
  defaultFetchInitObj,
} from "./util";
import { DateTime} from 'luxon';

import type {Feature, Point} from  'geojson';

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
  return loadUSGSGeoJsonSummary(url).then(eventParameters => {
    return eventParameters.eventList;
  });
}

export function loadUSGSGeoJsonSummary(url: string): Promise<EventParameters> {
  return loadRawUSGSGeoJsonSummary(url)
  .then((geojson: USGSGeoJsonSummary) => {
    return parseGeoJSON(geojson);
  });
}

export function loadRawUSGSGeoJsonSummary(url: string): Promise<USGSGeoJsonSummary> {
  const fetchInit = defaultFetchInitObj(JSON_MIME);
  return doFetchWithTimeout(url, fetchInit, timeoutSec * 1000)
    .then( response => {
      if (response.status !== 200) {
        // no data
        return [];
      } else {
        return response.json();
      }
    }).then(jsonValue => {
      if (isValidUSGSGeoJsonSummary(jsonValue)) {
        return jsonValue;
      } else {
        throw new TypeError(`Oops, we did not get roottype JSON!`);
      }
    });
}

/*

[
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
    "coordinates":[-36.0365,7.3653,10]
  },
  "id":"us6000jpxe"}
],
    "bbox":[-149.9803,7.3653,3.98,-36.0365,61.4684,32.6]
  }
 */

/**
 * Parses geojson from USGS feeds. Not all fields are parsed, just
 * basic origin and magnitude along with the id.
 * See https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php
 * @param  geojson  text from USGS feed
 * @returns EventParameters, which holds an array of Quake objects
 */
export function parseGeoJSON(geojson: USGSGeoJsonSummary): EventParameters {
    const quakeList = [];
    const description = geojson.metadata.title;
    for (const f of geojson.features) {
      const quake = parseFeatureAsQuake(f);
      quakeList.push(quake);
    }

    const out = new EventParameters();
    out.creationInfo = new CreationInfo();
    out.creationInfo.agencyURI = geojson.metadata.url;
    out.creationInfo.creationTime = DateTime.fromMillis(geojson.metadata.generated);
    out.eventList = quakeList;
    out.description = description;

    return out;
}

/**
 * Parses a single GeoJson feature into a Quake.
 * @param  feature  from USGS style geojson
 * @returns Quake with origin and magnitude
 */
export function parseFeatureAsQuake(feature: USGSGeoJsonFeature): Quake {
  const quake = new Quake();
  quake.publicId = `quakeml:earthquake.usgs.gov/fdsnws/event/1/query?eventid={feature.id}`;
  const p = feature.properties;
  if ( p == null) { throw new Error("Geojson missing properties");}
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

export interface USGSGeoJsonMetaData {
  generated: number;
  url: string;
  title: string;
  api: string;
  count: number;
  status: number;
}

export interface USGSGeoJsonProperties  {
  mag: number;
  place: string;
  time: number;
  updated: number;
  tz: number;
  url: string;
  detail: string;
  felt:number;
  cdi: number;
  mmi: number;
  alert: string;
  status: string;
  tsunami: number;
  sig:number;
  net: string;
  code: string;
  ids: string;
  sources: string;
  types: string;
  nst: number;
  dmin: number;
  rms: number;
  gap: number;
  magType: string;
  type: string;
  title: string;
}

export interface USGSGeoJsonFeature extends Feature<Point, USGSGeoJsonProperties> {
}

// subtype of FeatureCollection
export interface USGSGeoJsonSummary {
  type: 'FeatureCollection';
  metadata: USGSGeoJsonMetaData;
  features: Array<USGSGeoJsonFeature>;
}

export function isValidUSGSGeoJsonSummary(jsonValue: unknown): jsonValue is USGSGeoJsonSummary {
  if (! jsonValue || typeof jsonValue !== 'object') {
    throw new TypeError("json is not object");
  }
  const jsonObj = jsonValue as Record<string, unknown>;
  if ( ! (typeof jsonObj.type === 'string' && jsonObj.type === "FeatureCollection") ) {
    throw new TypeError("geojson is not valid for USGS GeoJson, type should be FeatureCollection");
  }
  if ( ! (typeof jsonObj.metadata === 'object')) {
    throw new TypeError("geojson is not valid for USGS GeoJson, missing metadata");
  }
  if ( ! Array.isArray(jsonObj.features)) {
    throw new TypeError("geojson is not valid for USGS GeoJson, features should be array");
  } else {
    if ( ! jsonObj.features.every(isValidUSGSGeoJsonQuake)) {
      throw new TypeError("geojson is not valid for USGS GeoJson, feature should be USGSGeoJsonFeature");
    }
  }
  return true;
}

export function isValidUSGSGeoJsonQuake(jsonValue: unknown): jsonValue is USGSGeoJsonFeature {
  if (! jsonValue || typeof jsonValue !== 'object') {
    throw new TypeError("json is not object");
  }
  const jsonObj = jsonValue as Record<string, unknown>;
  if ( ! (typeof jsonObj.type === 'string' && jsonObj.type === "Feature") ) {
    throw new TypeError("geojson is not valid for USGS GeoJson, type should be Feature");
  }
  if ( ! (typeof jsonObj.properties === 'object')) {
    throw new TypeError("geojson is not valid for USGS GeoJson, missing properties");
  }
  if ( ! (typeof jsonObj.id === 'string') ) {
    throw new TypeError("geojson is not valid for USGS GeoJson, id should be string");
  }
  return true;
}
