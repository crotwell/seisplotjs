/*
 * Philip Crotwell
 * University of South Carolina, 2022
 * http://www.seis.sc.edu
 */

export const FDSN_PREFIX = "FDSN:";

export const SEP = "_";

export class FDSNSourceId {
  networkCode: string;
  stationCode: string;
  locationCode: string;
  bandCode: string;
  sourceCode: string;
  subsourceCode: string;
  constructor(networkCode: string,
              stationCode: string,
              locationCode: string,
              bandCode: string,
              sourceCode: string,
              subsourceCode: string) {
    this.networkCode = networkCode;
    this.stationCode = stationCode;
    this.locationCode = locationCode;
    this.bandCode = bandCode;
    this.sourceCode = sourceCode;
    this.subsourceCode = subsourceCode;
  }
  static parse(id: string): FDSNSourceId {
    if (! id.startsWith(FDSN_PREFIX)) {
      throw new Error(`sourceid must start with ${FDSN_PREFIX}: ${id}`);
    }
    const items = id.slice(FDSN_PREFIX.length).split(SEP);
    if (items.length !== 6) {
      throw new Error(`channel sourceid must have 6 items separated by '${SEP}': ${id}`);
    }
    return new FDSNSourceId(items[0],items[1],items[2],items[3],items[4],items[5]);
  }
  static fromNSLC(net: string, sta: string, loc: string, channelCode: string): FDSNSourceId {
    let band;
    let source;
    let subsource;
    if (channelCode.length === 3) {
      band = channelCode.charAt(0);
      source = channelCode.charAt(1);
      subsource = channelCode.charAt(2);
    } else {
      const b_s_ss = /(\w)_(\w+)_(\w+)/;
      const match = b_s_ss.exec(channelCode);
      if (match) {
        band = match[1];
        source = match[2];
        subsource = match[3];
      } else {
        throw new Error(`channel code must be length 3 or have 3 items separated by '${SEP}': ${channelCode}`);
      }
    }
    return new FDSNSourceId(net, sta, loc,band,source,subsource);
  }
  static parseNSLC(nslc: string, sep = '.'): FDSNSourceId {
    const items = nslc.split(sep);
    if (items.length < 4) {
      throw new Error(`channel nslc must have 4 items separated by '${sep}': ${nslc}`);
    }
    return FDSNSourceId.fromNSLC(items[0],items[1],items[2],items[3]);
  }
  stationSourceId(): StationSouceId {
    return new StationSourceId(this.networkCode, this.stationCode);
  }
  networkSourceId(): StationSouceId {
    return new NetworkSourceId(this.networkCode);
  }
  toString(): string {
    return `${FDSN_PREFIX}${this.networkCode}${SEP}${this.stationCode}${SEP}${this.locationCode}${SEP}${this.bandCode}${SEP}${this.sourceCode}${SEP}${this.subsourceCode}`;
  }
  equals(other: FDSNSourceId): boolean {
    return this.toString() === other.toString();
  }
}

export class NetworkSourceId {
  networkCode: string;
  constructor(networkCode: string) {
    this.networkCode = networkCode;
  }
  toString(): string {
    return `${FDSN_PREFIX}${this.networkCode}`;
  }
  equals(other: NetworkSourceId): boolean {
    return this.toString() === other.toString();
  }
}

export class StationSourceId {
  networkCode: string;
  stationCode: string;
  constructor(networkCode: string, stationCode: string) {
    this.networkCode = networkCode;
    this.stationCode = stationCode;
  }
  toString(): string {
    return `${FDSN_PREFIX}${this.networkCode}${SEP}${this.stationCode}`;
  }
  networkSourceId(): StationSouceId {
    return new NetworkSourceId(this.networkCode);
  }
  equals(other: StationSouceId): boolean {
    return this.toString() === other.toString();
  }
}

export class LocationSourceId {
  networkCode: string;
  stationCode: string;
  locationCode: string;
  constructor(networkCode: string,
              stationCode: string,
              locationCode: string) {
    this.networkCode = networkCode;
    this.stationCode = stationCode;
    this.locationCode = locationCode;
  }
  toString(): string {
    return `${FDSN_PREFIX}${this.networkCode}${SEP}${this.stationCode}${SEP}${this.locationCode}`;
  }
  equals(other: LocationSourceId): boolean {
    return this.toString() === other.toString();
  }
}
