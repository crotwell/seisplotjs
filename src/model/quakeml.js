// @flow

import { checkStringOrDate, hasArgs, hasNoArgs, isStringArg, isNumArg, stringify } from './util';

// flow type for moment type
import { moment } from './util';

// QuakeML classes

/** Represent a QuakeML Event. Renamed to Quake as Event conflicts with
  * other uses in javascript.
  */
export class Quake {
  eventid: string;
  publicID: string;
  _time: moment;
  latitude: number;
  longitude: number;
  depth: number;
  description: string;
  magnitude: Magnitude;
  magnitudeList: Array<Magnitude>;
  originList: Array<Origin>;
  arrivalList: Array<Arrival>;
  pickList: Array<Pick>;
  preferredOriginId: string;
  preferredMagnitudeID: string;
  constructor() {
// what is essential???
  }
  get time(): moment {
    return this._time;
  }
  set time(value:moment | string) {
    this._time = moment.utc(value);
  }
  get arrivals(): Array<Arrival> {
    return this.arrivalList;
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
  publicID: string;

  constructor() {
// what is essential???
  }
  toString() {
    return stringify(this.time)
      +' '+stringify(this.latitude)
      +" "+stringify(this.longitude)
      +' '+stringify(this.depth);
  }
}
/** Represents a QuakeML Magnitude.
 */
export class Magnitude {
  mag: number;
  type: string;
  publicID: string;

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
  publicID: string;

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
  publicID: string;
  constructor(time: moment,
      networkCode: string,
      stationCode:string,
      locationCode:string,
      channelCode:string) {
    this.time = checkStringOrDate(time);
    this.networkCode = networkCode;
    this.stationCode = stationCode;
    this.locationCode = locationCode;
    this.channelCode = channelCode;
  }
}
