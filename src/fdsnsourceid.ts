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
  static createUnknown(sampRate?: number): FDSNSourceId {
    return new FDSNSourceId("XX", "ABC", "", bandCodeForRate(sampRate)+"YX");
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
  static fromNslc(net: string, sta: string, loc: string, channelCode: string): FDSNSourceId {
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
  static parseNslc(nslc: string, sep = '.'): FDSNSourceId {
    const items = nslc.split(sep);
    if (items.length < 4) {
      throw new Error(`channel nslc must have 4 items separated by '${sep}': ${nslc}`);
    }
    return FDSNSourceId.fromNslc(items[0],items[1],items[2],items[3]);
  }
  stationSourceId(): StationSourceId {
    return new StationSourceId(this.networkCode, this.stationCode);
  }
  networkSourceId(): NetworkSourceId {
    return new NetworkSourceId(this.networkCode);
  }
  asNslc(): NslcId {
    let chanCode;
    if (this.bandCode.length === 1 && this.sourceCode.length === 1 && this.subsourceCode.length === 1) {
      chanCode = `${this.bandCode}${this.sourceCode}${this.subsourceCode}`;
    } else {
      chanCode = `${this.bandCode}${SEP}${this.sourceCode}${SEP}${this.subsourceCode}`;
    }
    return new NslcId(this.networkCode, this.stationCode, this.locationCode, chanCode);
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
  networkSourceId(): NetworkSourceId {
    return new NetworkSourceId(this.networkCode);
  }
  equals(other: StationSourceId): boolean {
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

export function bandCodeForRate(sampRate?: number, resp_lb?: number): string {
  if ( ! sampRate) {
    return 'I';
  }
  if (sampRate >= 5000) {
    return 'J';
  } else if (sampRate >= 1000 && sampRate < 5000) {
    if (resp_lb && resp_lb < 0.1) {
      return 'F';
    }
    return 'G';
  } else if (sampRate >= 250 && sampRate < 1000) {
    if (resp_lb && resp_lb < 0.1) {
      return 'C';
    }
    return 'D';
  } else if (sampRate >= 80 && sampRate < 250) {
    if (resp_lb && resp_lb < 0.1) {
      return 'H';
    }
    return 'E';
  } else if (sampRate >= 10 && sampRate < 80) {
    if (resp_lb && resp_lb < 0.1) {
      return 'B';
    }
    return 'S';
  } else if (sampRate > 1 && sampRate < 10) {
    return 'M';
  } else if (sampRate > 0.5 && sampRate < 1.5) {
    // spec not clear about how far from 1 is L
    return 'L';
  } else if (sampRate >= 0.1 && sampRate < 1) {
    return 'V';
  } else if (sampRate >= 0.01 && sampRate < 0.1) {
    return 'U';
  } else if (sampRate >= 0.001 && sampRate < 0.01) {
    return 'W';
  } else if (sampRate >= 0.0001 && sampRate < 0.001) {
    return 'R';
  } else if (sampRate >= 0.00001 && sampRate < 0.0001) {
    return 'P';
  } else if (sampRate >= 0.000001 && sampRate < 0.00001) {
    return 'T';
  } else if (sampRate < 0.000001) {
    return 'Q';
  } else {
    throw new Error(`Unable to calc band code for: ${sampRate} ${resp_lb}`);
  }
}

export class NslcId {
  networkCode: string;
  stationCode: string;
  locationCode: string;
  channelCode: string;
  constructor(net: string, sta: string, loc: string, chan: string) {
    this.networkCode = net;
    this.stationCode = sta;
    this.locationCode = loc;
    this.channelCode = chan;
  }
}
