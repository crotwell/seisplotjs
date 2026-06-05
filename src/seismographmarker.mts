import type { TraveltimeJsonType } from "./traveltime";
import { Quake, Origin } from "./quakeml";
import { Station, Channel } from "./stationxml";
import * as distaz from "./distaz";

import { DateTime, Duration } from "luxon";

export const MARKERTYPE_PICK = "pick";
export const MARKERTYPE_PREDICTED = "predicted";

export type MarkerType = {
  name: string;
  time: DateTime;
  markertype: string;
  description: string;
  link?: string;
};

export function isValidMarker(v: unknown): v is MarkerType {
  if (!v || typeof v !== "object") {
    return false;
  }
  const m = v as Record<string, unknown>;

  return (
    typeof m.time === "string" &&
    typeof m.name === "string" &&
    typeof m.markertype === "string" &&
    typeof m.description === "string" &&
    (!("link" in m) || typeof m.link === "string")
  );
}

/**
 * Creates Markers for all of the arrivals in ttime.arrivals, relative
 * to the given Quake.
 *
 * @param   quake quake the travel times are relative to
 * @param   ttime travel times json object as returned from the
 * IRIS traveltime web service, or the json output of TauP
 * @returns        array of Markers suitable for adding to a seismograph
 */
export function createMarkersForTravelTimes(
  quake: Quake,
  ttime: TraveltimeJsonType,
): Array<MarkerType> {
  return ttime.arrivals.map((a) => {
    return {
      markertype: MARKERTYPE_PREDICTED,
      name: a.phase,
      time: quake.time.plus(Duration.fromMillis(1000 * a.time)),
      description: "",
    };
  });
}

/**
 * Creates a Marker for the origin time in ttime.arrivals, for the given Quake.
 *
 * @param   quake quake the travel times are relative to
 * @returns        Marker suitable for adding to a seismograph
 */
export function createMarkerForOriginTime(quake: Quake): MarkerType {
  return {
    markertype: MARKERTYPE_PREDICTED,
    name: "origin",
    time: quake.time,
    description: "",
  };
}
export function createFullMarkersForQuakeAtStation(
  quake: Quake,
  station: Station,
): Array<MarkerType> {
  const markers: Array<MarkerType> = [];
  if (quake.hasOrigin()) {
    const daz = distaz.distaz(
      station.latitude,
      station.longitude,
      quake.latitude,
      quake.longitude,
    );
    let magVal = "";
    let magStr = "";
    if (quake.hasPreferredMagnitude()) {
      magVal = quake.preferredMagnitude
        ? `${quake.preferredMagnitude.mag}`
        : "";
      magStr = quake.preferredMagnitude
        ? quake.preferredMagnitude.toString()
        : "";
    }
    markers.push({
      markertype: MARKERTYPE_PREDICTED,
      name: `M${magVal} ${quake.time.toFormat("HH:mm")}`,
      time: quake.time,
      link: `https://earthquake.usgs.gov/earthquakes/eventpage/${quake.eventId}/executive`,
      description: `${quake.time.toISO()}
${quake.latitude.toFixed(2)}/${quake.longitude.toFixed(2)} ${(
        quake.depth / 1000
      ).toFixed(2)} km
${quake.description}
${magStr}
${daz.delta.toFixed(2)} deg to ${station.stationCode} (${daz.distanceKm} km)
`,
    });
  }
  return markers;
}
export function createFullMarkersForQuakeAtChannel(
  quake: Quake,
  channel: Channel,
): Array<MarkerType> {
  let markers = createFullMarkersForQuakeAtStation(quake, channel.station);
  if (quake.preferredOrigin) {
    markers = markers.concat(
      createMarkerForPicks(quake.preferredOrigin, channel),
    );
  }
  return markers;
}

/**
 * Creates a Marker for the picked arrival times in quake.pickList, for the given Quake.
 *
 * @param quake quake the travel times are relative to
 * @param channel channel picks made on
 * @returns        Marker suitable for adding to a seismograph
 */
export function createMarkerForQuakePicks(
  quake: Quake,
  channel: Channel,
): Array<MarkerType> {
  const markers: Array<MarkerType> = [];

  if (quake.pickList) {
    quake.pickList.forEach((pick) => {
      if (pick && pick.isOnChannel(channel)) {
        markers.push({
          markertype: MARKERTYPE_PICK,
          name: "pick",
          time: pick.time,
          description: "",
        });
      }
    });
  }
  return markers;
}

/**
 * Creates a Marker for the picked arrival times in quake.arrivals, for the given Quake.
 *
 * @param origin quake the travel times are relative to
 * @param channel channel picks made on
 * @returns        Marker suitable for adding to a seismograph
 */
export function createMarkerForPicks(
  origin: Origin,
  channel: Channel,
): Array<MarkerType> {
  const markers: Array<MarkerType> = [];

  if (origin.arrivals) {
    origin.arrivals.forEach((arrival) => {
      if (arrival && arrival.pick.isOnChannel(channel)) {
        markers.push({
          markertype: MARKERTYPE_PICK,
          name: arrival.phase,
          time: arrival.pick.time,
          description: "",
        });
      }
    });
  }
  return markers;
}
