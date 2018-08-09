// @flow

import { checkStringOrDate, hasArgs, hasNoArgs, isStringArg, isNumArg, stringify } from './util';

// flow type for moment type
import { moment } from './util';

// QuakeML classes

/** Represent a QuakeML Event. Renamed to Quake as Event conflicts with
  * other uses in javascript.
  */
export class Quake {
  /** @private */
  _eventid: string;
  /** @private */
  _publicID: string;
  /** @private */
  _time: moment;
  /** @private */
  _latitude: number;
  /** @private */
  _longitude: number;
  /** @private */
  _depth: number;
  /** @private */
  _description: string;
  /** @private */
  _magnitude: Magnitude;
  /** @private */
  _magnitudeList: Array<Magnitude>;
  /** @private */
  _originList: Array<Origin>;
  /** @private */
  _arrivalList: Array<Arrival>;
  /** @private */
  _pickList: Array<Pick>;

  constructor() {
// what is essential???
  }
  eventid(value?: string) :string | Quake {
    if (isStringArg(value)) {
      this._eventid = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._eventid;
    } else {
      throw new Error('value argument is optional or string, but was '+typeof value);
    }
  }
  publicID(value?: string) :string | Quake {
    if (isStringArg(value)) {
      this._publicID = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._publicID;
    } else {
      throw new Error('value argument is optional or string, but was '+typeof value);
    }
  }
  time(value?: moment): moment | Quake {
    if (hasNoArgs(value)) {
      return this._time;
    } else if (hasArgs(value)) {
      this._time = checkStringOrDate(value);
      return this;
    } else {
      throw new Error('value argument is optional or moment or string, but was '+typeof value);
    }
  }
  latitude(value?: number): number | Quake {
    if (isNumArg(value)) {
      this._latitude = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._latitude;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  longitude(value?: number): number | Quake {
    if (isNumArg(value)) {
      this._longitude = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._longitude;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  depth(value?: number): number | Quake {
    if (isNumArg(value)) {
      this._depth = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._depth;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  description(value?: string) :string | Quake {
    if (isStringArg(value)) {
      this._description = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._description;
    } else {
      throw new Error('value argument is optional or string, but was '+typeof value);
    }
  }
  magnitude(value?: Magnitude): Magnitude | Quake {
    if (hasArgs(value)) {
      this._magnitude = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._magnitude;
    } else {
      throw new Error('value argument is optional or Magnitude, but was '+typeof value);
    }
  }
  originList(value?: Array<Origin>): Array<Origin> | Quake {
    if (hasArgs(value)) {
      this._originList = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._originList;
    } else {
      throw new Error('value argument is optional or Array<Origin>, but was '+typeof value);
    }
  }
  magnitudeList(value?: Array<Magnitude>): Array<Magnitude> | Quake {
    if (hasArgs(value)) {
      this._magnitudeList = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._magnitudeList;
    } else {
      throw new Error('value argument is optional or Array<Magnitude>, but was '+typeof value);
    }
  }
  arrivals(value?: Array<Arrival>): Array<Arrival> | Quake {
    return this.arrivalList(value);
  }
  arrivalList(value?: Array<Arrival>): Array<Arrival> | Quake {
    if (hasArgs(value)) {
      this._arrivalList = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._arrivalList;
    } else {
      throw new Error('value argument is optional or Array<Arrival>, but was '+typeof value);
    }
  }
  picks(value?: Array<Pick>): Array<Pick> | Quake {
    return this.pickList(value);
  }
  pickList(value?: Array<Pick>): Array<Pick> | Quake {
    if (hasArgs(value)) {
      this._pickList = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._pickList;
    } else {
      throw new Error('value argument is optional or Array<Pick>, but was '+typeof value);
    }
  }
  toString() {
    return stringify(this.time())
    +' '+stringify(this.latitude())
    +" "+stringify(this.longitude())
    +' '+stringify(this.depth())
    +' '+this.magnitude().toString();
  }
}
/** Represents a QuakeML Origin. */
export class Origin {
  /** @private */
  _time: moment;
  /** @private */
  _latitude: number;
  /** @private */
  _longitude: number;
  /** @private */
  _depth: number;

  constructor() {
// what is essential???
  }
  time(value?: moment): moment | Origin {
    if (hasNoArgs(value)) {
      return this._time;
    } else if (hasArgs(value)) {
      this._time = checkStringOrDate(value);
      return this;
    } else {
      throw new Error('value argument is optional or moment or string, but was '+typeof value);
    }
  }
  latitude(value?: number): number | Origin {
    if (isNumArg(value)) {
      this._latitude = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._latitude;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  longitude(value?: number): number | Origin {
    if (isNumArg(value)) {
      this._longitude = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._longitude;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  depth(value?: number): number | Origin {
    if (isNumArg(value)) {
      this._depth = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._depth;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  toString() {
    return stringify(this.time())
      +' '+stringify(this.latitude())
      +" "+stringify(this.longitude())
      +' '+stringify(this.depth());
  }
}
/** Represents a QuakeML Magnitude.
 */
export class Magnitude {
  /** @private */
  _mag: number;
  /** @private */
  _type: string;

  constructor(mag: number, type: string) {
    this._mag = mag;
    this._type = type;
  }
  mag(value?: number): number | Magnitude {
    if (isNumArg(value)) {
      this._mag = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._mag;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  type(value?: string) :string | Magnitude {
    if (isStringArg(value)) {
      this._type = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._type;
    } else {
      throw new Error('value argument is optional or string, but was '+typeof value);
    }
  }
  toString() {
    return stringify(this.mag())+" "+stringify(this.type());
  }
}

/** Represents a QuakeML Arrival, a combination of a Pick with a phase name.
 */
export class Arrival {
  /** @private */
  _phase: string;
  /** @private */
  _pick: Pick;
  /** @private */
  _publicID: string;

  constructor(phase: string, pick: Pick) {
    this._phase = phase;
    this._pick = pick;
  }
  phase(value?: string) :string | Arrival {
    if (isStringArg(value)) {
      this._phase = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._phase;
    } else {
      throw new Error('value argument is optional or string, but was '+typeof value);
    }
  }
  publicID(value?: string) :string | Arrival {
    if (isStringArg(value)) {
      this._publicID = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._publicID;
    } else {
      throw new Error('value argument is optional or string, but was '+typeof value);
    }
  }
  pick(value?: Pick) :Pick | Arrival {
    if (hasArgs(value)) {
      this._pick = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._pick;
    } else {
      throw new Error('value argument is optional or Pick, but was '+typeof value);
    }
  }
}

/** Represents a QuakeML Pick.
 */
export class Pick {
  /** @private */
  _time: moment;
  /** @private */
  _networkCode: string;
  /** @private */
  _stationCode: string;
  /** @private */
  _locationCode: string;
  /** @private */
  _channelCode: string;
  /** @private */
  _publicID: string;
  constructor(time: moment,
      networkCode: string,
      stationCode:string,
      locationCode:string,
      channelCode:string) {
    this._time = checkStringOrDate(time);
    this._networkCode = networkCode;
    this._stationCode = stationCode;
    this._locationCode = locationCode;
    this._channelCode = channelCode;
  }
  publicID(value?: string) :string | Pick {
    if (isStringArg(value)) {
      this._publicID = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._publicID;
    } else {
      throw new Error('value argument is optional or string, but was '+typeof value);
    }
  }
  time(value?: moment): moment | Pick {
    if (hasNoArgs(value)) {
      return this._time;
    } else if (hasArgs(value)) {
      this._time = checkStringOrDate(value);
      return this;
    } else {
      throw new Error('value argument is optional or moment or string, but was '+typeof value);
    }
  }

  networkCode(value?: string) :string | Pick {
    if (isStringArg(value)) {
      this._networkCode = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._networkCode;
    } else {
      throw new Error('value argument is optional or string, but was '+typeof value);
    }
  }
  stationCode(value?: string) :string | Pick {
    if (isStringArg(value)) {
      this._stationCode = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._stationCode;
    } else {
      throw new Error('value argument is optional or string, but was '+typeof value);
    }
  }
  locationCode(value?: string) :string | Pick {
    if (isStringArg(value)) {
      this._locationCode = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._locationCode;
    } else {
      throw new Error('value argument is optional or string, but was '+typeof value);
    }
  }
  channelCode(value?: string) :string | Pick {
    if (isStringArg(value)) {
      this._channelCode = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._channelCode;
    } else {
      throw new Error('value argument is optional or string, but was '+typeof value);
    }
  }
}
