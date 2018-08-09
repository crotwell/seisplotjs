// @flow

import { moment, checkStringOrDate, hasArgs, hasNoArgs, isStringArg } from './util';

/**
* A Seismogram object.
* @param {Array} yArray array of Y sample values, ie the timeseries
* @param {number} sampleRate sample rate of the seismogram, hertz
* @param {moment} start start time of seismogrm as a momentjs moment in utc or a string that can be parsed
*/
export class Seismogram {
  /** @private */
  _y: Array<number>;
  /** @private */
  _sampleRate:number;
  /** @private */
  _start:moment;
  /** @private */
  _networkCode:string;
  /** @private */
  _stationCode:string;
  /** @private */
  _locCode:string;
  /** @private */
  _channelCode:string;
  /** @private */
  _yUnit:string;
  constructor(yArray:Array<number>, sampleRate: number, start: moment) {
    this._y = yArray;
    this._sampleRate = sampleRate;
    this._start = checkStringOrDate(start);
    this._yUnit = 'count';
  }
/**
 * Get or set the sampleRate.
 * If value is defined, sets the sampleRate and returns the seismogram.
 * If undefined, returns the sampleRate.
 * @returns {number} the sample rate in hertz or this.
 */
  sampleRate(value?: number): number | Seismogram {
    if (hasNoArgs(value)) {
      return this._sampleRate;
    } else if (hasArgs(value)) {
      this._sampleRate = value;
      return this;
    } else {
      throw new Error('value argument is optional or number, but was '+typeof value);
    }
  }
  start(value?: moment) :moment | Seismogram {
    if (hasNoArgs(value)) {
      return this._start;
    } else if (hasArgs(value)) {
      this._start = checkStringOrDate(value);
      return this;
    } else {
      throw new Error('value argument is optional or moment or string, but was '+typeof value);
    }
  }
  end() :moment {
    return this.timeOfSample(this.numPoints()-1);
  }
  numPoints() :number {
    return this._y.length;
  }
  netCode(value?: string) :string | Seismogram {
    return this.networkCode(value);
  }
  networkCode(value?: string) :string | Seismogram {
    if (isStringArg(value)) {
      this._networkCode = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._networkCode;
    } else {
      throw new Error('value argument is optional or string, but was '+typeof value);
    }
  }
  staCode(value?: string) :string | Seismogram {
    return this.stationCode(value);
  }
  stationCode(value?: string) :string | Seismogram {
    if (isStringArg(value)) {
      this._stationCode = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._stationCode;
    } else {
      throw new Error('value argument is optional or string, but was '+typeof value);
    }
  }
  locId(value?: string) :string | Seismogram {
    return this.locCode(value);
  }
  locCode(value?: string) :string | Seismogram {
    if (isStringArg(value)) {
      this._locCode = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._locCode;
    } else {
      throw new Error('value argument is optional or string, but was '+typeof value);
    }
  }
  chanCode(value?: string) :string | Seismogram {
    return this.channelCode(value);
  }
  channelCode(value?: string) :string | Seismogram {
    if (isStringArg(value)) {
      this._channelCode = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._channelCode;
    } else {
      throw new Error('value argument is optional or string, but was '+typeof value);
    }
  }
  yUnit(value?: string) :string | Seismogram {
    if (isStringArg(value)) {
      this._yUnit = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._yUnit;
    } else {
      throw new Error('value argument is optional or string, but was '+typeof value);
    }
  }
  y(value?: Array<number>) : Array<number> | Seismogram {
    if (hasArgs(value)) {
      this._y = value;
      return this;
    } else if (hasNoArgs(value)) {
      return this._y;
    } else {
      throw new Error('value argument is optional or string, but was '+typeof value);
    }
  }
  yAtIndex(i: number) :number {
    return this._y[i];
  }

  timeOfSample(i:number ) :moment {
    return moment.utc(this._start).add(i/this._sampleRate, 'seconds');
  }
  codes() :string {
    return this._networkCode+"."+this._stationCode+"."+this._locCode+"."+this._channelCode;
  }
  seisId() :string {
   return (this.codes()+"_"+this._start.toISOString()+"_"+this.end().toISOString()).replace(/\./g,'_').replace(/:/g,'');
  }
  clone():Seismogram {
    let out = new Seismogram(this._y.slice(),
                          this._sampleRate,
                          moment.utc(this._start));
    out._networkCode = this._networkCode;
    out._stationCode = this._stationCode;
    out._locCode = this._locCode;
    out._channelCode = this._channelCode;
    return out;
  }
}
