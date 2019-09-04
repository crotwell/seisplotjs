// @flow

/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */

import { checkStringOrDate, stringify } from './util';

import moment from 'moment';

// QuakeML classes

/** Represent a QuakeML Event. Renamed to Quake as Event conflicts with
  * other uses in javascript.
  */
export class Quake {
  eventId: string;
  publicId: string;
  _time: moment;
  latitude: number;
  longitude: number;
  depth: number;
  description: string;
  magnitude: Magnitude;
  magnitudeList: Array<Magnitude>;
  originList: Array<Origin>;
  pickList: Array<Pick>;
  preferredOriginId: ?string;
  preferredOrigin: Origin;
  preferredMagnitudeId: ?string;
  preferredMagnitude: Magnitude;
  constructor() {
// what is essential???
  }
  get time(): moment {
    return this._time;
  }
  set time(value: moment | string) {
    this._time = moment.utc(value);
  }
  get arrivals(): Array<Arrival> {
    return this.preferredOrigin.arrivalList;
  }
  get picks(): Array<Pick> {
    return this.pickList;
  }
  toString() {
    return stringify(this.time)
    +' '+stringify(this.latitude)
    +" "+stringify(this.longitude)
    +' '+stringify(this.depth)
    +' '+this.magnitude.toString();
  }
}
/** Represents a QuakeML Origin. */
export class Origin {
  time: moment;
  latitude: number;
  longitude: number;
  depth: number;
  arrivalList: Array<Arrival>;
  publicId: string;

  constructor() {
// what is essential???
  }
  toString() {
    return stringify(this.time)
      +' '+stringify(this.latitude)
      +" "+stringify(this.longitude)
      +' '+stringify(this.depth);
  }
  get arrivals(): Array<Arrival> {
    return this.arrivalList;
  }
}
/** Represents a QuakeML Magnitude.
 */
export class Magnitude {
  mag: number;
  type: string;
  publicId: string;

  constructor(mag: number, type: string) {
    this.mag = mag;
    this.type = type;
  }
  toString() {
    return stringify(this.mag)+" "+stringify(this.type);
  }
}

/** Represents a QuakeML Arrival, a combination of a Pick with a phase name.
 */
export class Arrival {
  phase: string;
  pick: Pick;
  publicId: string;

  constructor(phase: string, pick: Pick) {
    this.phase = phase;
    this.pick = pick;
  }
}

/** Represents a QuakeML Pick.
 */
export class Pick {
  time: moment;
  networkCode: string;
  stationCode: string;
  locationCode: string;
  channelCode: string;
  publicId: string;
  constructor(time: moment,
      networkCode: string,
      stationCode: string,
      locationCode: string,
      channelCode: string) {
    this.time = checkStringOrDate(time);
    this.networkCode = networkCode;
    this.stationCode = stationCode;
    this.locationCode = locationCode;
    this.channelCode = channelCode;
  }
}
