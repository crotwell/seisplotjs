/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * https://www.seis.sc.edu
 */

/** const for kilometers per degree on the earth, 111.19 */
export const kmPerDeg = 111.19;

/**
 * Convert degrees into kilometers along the earth surface
 *
 * @param deg degrees to convert
 * @returns kilometers
 */
export function degtokm(deg: number): number {
  return deg * kmPerDeg;
}

/**
 * Convert kilometers into degrees along the earth surface
 *
 * @param km kilometers to convert
 * @returns degrees
 */
export function kmtodeg(km: number): number {
  return km / kmPerDeg;
}
export class DistAzOutput {
  delta: number;
  az: number;
  baz: number;
  stalat: number | undefined;
  stalon: number | undefined;
  evtlat: number | undefined;
  evtlon: number | undefined;

  constructor(delta: number, az: number, baz: number) {
    this.delta = delta ? delta : 0.0;
    this.az = az ? az : 0.0;
    this.baz = baz ? baz : 0.0;
  }

  get distance(): number {
    return this.delta;
  }

  get distanceKm(): number {
    return degtokm(this.delta);
  }

  get distanceDeg(): number {
    return this.delta;
  }

  get azimuth(): number {
    return this.az;
  }

  get backazimuth(): number {
    return this.baz;
  }
}

/**
 *
 * Returns a simple object (DistAzOutput) with:
 *```
 *     delta       => Great Circle Arc distance in degrees
 *     az          => Azimuth of pt. 1 wrt pt. 2 in degrees
 *     baz         => Azimuth of pt. 2 wrt pt. 1 in degrees
 *```
 *
 * azimuth is if you stand at point 2 and measure angle between north
 *   and point 1. I.E. point 1 is the station and point 2 is the event.
 *
 * @param lat1 Latitude of first point (station) (+N, -S) in degrees
 * @param lon1 Longitude of first point(station) (+E, -W) in degrees
 * @param lat2 Latitude of second point (event)
 * @param lon2 Longitude of second point (event)
 * @returns delta, az, baz in a DistAzOutput
 */
export function distaz(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): DistAzOutput {
  if (lat1 === lat2 && lon1 === lon2) {
    // don't do calc, just return zero for idential points
    const result = new DistAzOutput(0, 0, 0);
    result.stalat = lat1;
    result.stalon = lon1;
    result.evtlat = lat2;
    result.evtlon = lon2;
    return result;
  }

  const rad = (2 * Math.PI) / 360.0;

  /*
   *
   * scolat and ecolat are the geocentric colatitudes
   * as defined by Richter (pg. 318)
   *
   * Earth Flattening of 1/298.257 take from Bott (pg. 3)
   *
   */
  const sph = 1.0 / 298.257;
  const scolat =
    Math.PI / 2.0 - Math.atan((1 - sph) * (1 - sph) * Math.tan(lat1 * rad));
  const ecolat =
    Math.PI / 2.0 - Math.atan((1 - sph) * (1 - sph) * Math.tan(lat2 * rad));
  const slon = lon1 * rad;
  const elon = lon2 * rad;

  /*
   *
   *  a - e are as defined by Bullen (pg. 154, Sec 10.2)
   *     These are defined for the pt. 1
   *
   */
  const a = Math.sin(scolat) * Math.cos(slon);
  const b = Math.sin(scolat) * Math.sin(slon);
  const c = Math.cos(scolat);
  const d = Math.sin(slon);
  const e = -Math.cos(slon);
  const g = -c * e;
  const h = c * d;
  const k = -Math.sin(scolat);

  /*
   *
   *  aa - ee are the same as a - e, except for pt. 2
   *
   */
  const aa = Math.sin(ecolat) * Math.cos(elon);
  const bb = Math.sin(ecolat) * Math.sin(elon);
  const cc = Math.cos(ecolat);
  const dd = Math.sin(elon);
  const ee = -Math.cos(elon);
  const gg = -cc * ee;
  const hh = cc * dd;
  const kk = -Math.sin(ecolat);

  /*
   *
   *  Bullen, Sec 10.2, eqn. 4
   *
   */
  const del = Math.acos(a * aa + b * bb + c * cc);
  const result_delta = del / rad;

  /*
   *
   *  Bullen, Sec 10.2, eqn 7 / eqn 8
   *
   *    pt. 1 is unprimed, so this is technically the baz
   *
   *  Calculate baz this way to avoid quadrant problems
   *
   */
  const baz_rhs1 = (aa - d) * (aa - d) + (bb - e) * (bb - e) + cc * cc - 2;
  const baz_rhs2 =
    (aa - g) * (aa - g) + (bb - h) * (bb - h) + (cc - k) * (cc - k) - 2;
  let dbaz = Math.atan2(baz_rhs1, baz_rhs2);

  if (dbaz < 0.0) {
    dbaz = dbaz + 2 * Math.PI;
  }

  let result_baz = dbaz / rad;

  /*
   *
   *  Bullen, Sec 10.2, eqn 7 / eqn 8
   *
   *    pt. 2 is unprimed, so this is technically the az
   *
   */
  const daz_rhs1 = (a - dd) * (a - dd) + (b - ee) * (b - ee) + c * c - 2;
  const daz_rhs2 =
    (a - gg) * (a - gg) + (b - hh) * (b - hh) + (c - kk) * (c - kk) - 2;
  let daz = Math.atan2(daz_rhs1, daz_rhs2);

  if (daz < 0.0) {
    daz = daz + 2 * Math.PI;
  }

  let result_az = daz / rad;

  /*
   *
   *   Make sure 0.0 is always 0.0, not 360.
   *
   */
  if (Math.abs(result_baz - 360) < 0.00001) result_baz = 0.0;
  if (Math.abs(result_az - 360) < 0.00001) result_az = 0.0;
  const result = new DistAzOutput(result_delta, result_az, result_baz);
  result.stalat = lat1;
  result.stalon = lon1;
  result.evtlat = lat2;
  result.evtlon = lon2;
  return result;
}
