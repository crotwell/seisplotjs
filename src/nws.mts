import {defaultFetchInitObj, doFetchWithTimeout} from './util';
import {Station} from './stationxml';
import * as z from "zod";


export function loadNWSPointInfo(lat: number, lon: number): Promise<NWSPointInfo> {
  const fetchInit = defaultFetchInitObj();
  fetchInit["headers"] = {
      "accept": "application/geo+json"
    };
  const url = `https://api.weather.gov/points/${lat},${lon}`;
  return doFetchWithTimeout(url, fetchInit).then(resp => {
    if (resp.ok) {
      return resp.json();
    } else {
      throw new Error(`fetch ${url} from NWS not ok: ${resp.status}`);
    }
  }).then(nwsJson => {
    return NWSPointInfo.parse(nwsJson);
  });
}

export function loadForecast(station: Station): Promise<NWSForecast> {
  return loadNWSPointInfo(station.latitude, station.longitude)
  .then( pointInfo => {
    const fetchInit = defaultFetchInitObj();
    fetchInit["headers"] = {
        "accept": "application/geo+json"
      };
    const url = pointInfo.properties.forecast as string;
    return doFetchWithTimeout(url, fetchInit).then(resp => {
      if (resp.ok) {
        return resp.json();
      } else {
        throw new Error(`fetch forecast for ${station.sourceId.toString()} not ok: ${resp.status}`);
      }
    }).then(rawJson => {
      const nwsJson = NWSForecast.parse(rawJson);
      return nwsJson;
    });
  });
}


export function nwsObservation(nws_station: string): Promise<NWSObservation> {
  const fetchInit = defaultFetchInitObj();
  fetchInit["headers"] = {
      "accept": "application/geo+json"
    };
  const url = `https://api.weather.gov/stations/${nws_station}/observations/latest?require_qc=false`;
  return doFetchWithTimeout(url, fetchInit).then(resp => {
    if (resp.ok) {
      return resp.json();
    } else {
      throw new Error(`fetch observation ${nws_station} not ok: ${resp.status}`);
    }
  }).then(rawJson => {
    const nwsJson = NWSObservation.parse(rawJson);
    return nwsJson;
  });
}

export function loadObservation(station: Station): Promise<NWSObservation> {
  return loadNWSPointInfo(station.latitude, station.longitude)
  .then( pointInfo => {
    const fetchInit = defaultFetchInitObj();
    fetchInit["headers"] = {
        "accept": "application/geo+json"
      };
    const url = pointInfo.properties.observationStations as string;
    return doFetchWithTimeout(url, fetchInit).then(resp => {
      if (resp.ok) {
        return resp.json();
      } else {
        throw new Error(`fetch forecast fro ${station.sourceId.toString()} not ok: ${resp.status}`);
      }
    }).then(rawJson => {
      const nwsJson = NWSObsStationCollection.parse(rawJson);
      return nwsJson;
    });
  }).then( obsSta => {
    const nwsSta = obsSta.features[0].properties.stationIdentifier;
    return nwsObservation(nwsSta);
  });
}


export const NWSBaseObj = z.object({
  "@context": z.tuple([z.string(), z.object()]).optional(),
});

export const NWSPointInfo = NWSBaseObj.extend({
  id: z.string(),
  type: z.literal("Feature"),
  geometry: z.object({
    type: z.literal("Point"),
    coordinates: z.array(z.number()).length(2),
  }),
  properties: z.object({
    cwa: z.string(),
    gridId: z.string(),
    gridX: z.number(),
    gridY: z.number(),
    forecast: z.string(),
    forecastHourly: z.string(),
    forecastGridData: z.string(),
    observationStations: z.string(),
  })
});
export type NWSPointInfo = z.infer<typeof NWSPointInfo>;

export const NWSForecastPeriod = z.object({
  number: z.number(),
  name: z.string(),
  startTime: z.iso.datetime({ offset: true }),
  endTime: z.iso.datetime({ offset: true }),
  shortForecast: z.string(),
  detailedForecast: z.string(),
  icon: z.url(),
});
export type NWSForecastPeriod = z.infer<typeof NWSForecastPeriod>;

export const NWSForecast = NWSBaseObj.extend({
  type: z.literal("Feature"),
  geometry: z.object({
    type: z.literal("Polygon"),
    coordinates: z.array(z.array(z.array(z.number()).length(2))),
  }),
  properties: z.object({
    generatedAt: z.iso.datetime({ offset: true }),

    periods: z.array(NWSForecastPeriod)
  })
});
export type NWSForecast = z.infer<typeof NWSForecast>;


export const NWSObsMeasurement = z.object({
  unitCode: z.string(),
  value: z.nullable(z.number()),
  qualityControl: z.string().optional()
});
export type NWSObsMeasurement = z.infer<typeof NWSObsMeasurement>;


export const NWSObsStation = z.object({
  id: z.string(),
  type: z.literal("Feature"),
  geometry: z.object({
    type: z.literal("Point"),
    coordinates: z.array(z.number()).length(2),
  }),
  properties: z.object({
    "@id": z.string(),
    "@type": z.string(),
    elevation: NWSObsMeasurement,
    stationIdentifier: z.string(),
    name: z.string(),
    timeZone: z.string(),
    distance: NWSObsMeasurement,
    bearing: NWSObsMeasurement,
    forecast: z.string(),
    county: z.string(),
    fireWeatherZone: z.string(),
  })
});

export const NWSObsStationCollection = NWSBaseObj.extend({
  type: z.literal("FeatureCollection"),
  features: z.array(NWSObsStation),
  observationStations: z.array(z.string())
});
export type NWSObsStationCollection = z.infer<typeof NWSObsStationCollection>;

export const NWSObservation = NWSBaseObj.extend({
  id: z.string(),
  type: z.literal("Feature"),
  geometry: z.object({
    type: z.literal("Point"),
    coordinates: z.array(z.number()).length(2),
  }),
  properties: z.object({
    stationId: z.string(),
    stationName: z.string(),
    timestamp: z.iso.datetime({ offset: true }),
    textDescription: z.string(),
    temperature: NWSObsMeasurement.optional(),
    dewpoint: NWSObsMeasurement.optional(),
    windDirection: NWSObsMeasurement.optional(),
    windSpeed: NWSObsMeasurement.optional(),
    windGust: NWSObsMeasurement.optional(),
    barometricPressure: NWSObsMeasurement.optional(),
    seaLevelPressure: NWSObsMeasurement.optional(),
    visibility: NWSObsMeasurement.optional(),
    maxTemperatureLast24Hours: NWSObsMeasurement.optional(),
    minTemperatureLast24Hours: NWSObsMeasurement.optional(),
    precipitationLast3Hours: NWSObsMeasurement.optional(),
    relativeHumidity: NWSObsMeasurement.optional(),
    windChill: NWSObsMeasurement.optional(),
    cloudLayers: z.array(z.object({
      base: NWSObsMeasurement.optional(),
      amount: z.string()
    }))
  })
});
export type NWSObservation = z.infer<typeof NWSObservation>;
