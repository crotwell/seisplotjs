/* eslint-disable */
/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */

/**
 * Standard metadata about a seismogram.
 */
export interface MS3ExtraHeader {
  bag?: Bag;
  [k: string]: unknown;
}
/**
 * Common seismic values that are useful to embed in header
 */
export interface Bag {
  /**
   * timeseries amplitude
   */
  y?: {
    /**
     * si units of the timeseries amplitude, ex m/s m/s2
     */
    si?: string;
    [k: string]: unknown;
  };
  st?: Station;
  ev?: Origin;
  /**
   * path between source and receiver
   */
  path?: {
    /**
     * great circle arc distance in degrees, for uses when only distance is needed
     */
    gcarc?: number;
    /**
     * great circle azimuth degrees from event to station, for uses when only distance is needed
     */
    az?: number;
    /**
     * great circle back azimuth in degrees back from station to event, for uses when only distance is needed
     */
    baz?: number;
    [k: string]: unknown;
  };
  mark?: Marker[];
  [k: string]: unknown;
}
/**
 * receiver station
 */
export interface Station {
  /**
   * latitude in degrees
   */
  la: number;
  /**
   * longitude in degrees
   */
  lo: number;
  /**
   * elevation in meters
   */
  elev?: number;
  /**
   * depth below surface in meters
   */
  dp?: number;
  [k: string]: unknown;
}
/**
 * source earthquake
 */
export interface Origin {
  /**
   * origin time as ISO8601
   */
  time: string;
  /**
   * latitude in degrees
   */
  la: number;
  /**
   * longitude in degrees
   */
  lo: number;
  /**
   * depth in kilometers
   */
  dp: number;
  /**
   * magnitude value
   */
  mag?: number;
  /**
   * magnitude type
   */
  magtype?: string;
  [k: string]: unknown;
}
export interface Marker {
  time: string;
  name: string;
  amp?: number;
  [k: string]: unknown;
}
