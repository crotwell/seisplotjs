/*
 * Philip Crotwell
 * University of South Carolina, 2022
 * https://www.seis.sc.edu
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
  constructor(
    networkCode: string,
    stationCode: string,
    locationCode: string,
    bandCode: string,
    sourceCode: string,
    subsourceCode: string,
  ) {
    this.networkCode = networkCode;
    this.stationCode = stationCode;
    this.locationCode = locationCode;
    this.bandCode = bandCode;
    this.sourceCode = sourceCode;
    this.subsourceCode = subsourceCode;
  }
  static createUnknown(
    sampRate?: number,
    source?: string,
    subsource?: string,
  ): FDSNSourceId {
    const s = source ? source : "Y";
    const ss = subsource ? subsource : "X";
    return new FDSNSourceId("XX", "ABC", "", bandCodeForRate(sampRate), s, ss);
  }
  static parse(id: string): FDSNSourceId {
    if (!id.startsWith(FDSN_PREFIX)) {
      throw new Error(`sourceid must start with ${FDSN_PREFIX}: ${id}`);
    }
    const items = id.slice(FDSN_PREFIX.length).split(SEP);
    if (items.length === 6) {
      return new FDSNSourceId(
        items[0],
        items[1],
        items[2],
        items[3],
        items[4],
        items[5],
      );
    } else {
      throw new Error(
        `FDSN sourceid must have 6 items for channel; separated by '${SEP}': ${id}`,
      );
    }
  }
  static fromNslc(
    net: string,
    sta: string,
    loc: string,
    channelCode: string,
  ): FDSNSourceId {
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
        throw new Error(
          `channel code must be length 3 or have 3 items separated by '${SEP}': ${channelCode}`,
        );
      }
    }
    return new FDSNSourceId(net, sta, loc, band, source, subsource);
  }
  static fromNslcId(nslcId: NslcId): FDSNSourceId {
    return FDSNSourceId.fromNslc(
      nslcId.networkCode,
      nslcId.stationCode,
      nslcId.locationCode,
      nslcId.channelCode,
    );
  }
  static parseNslc(nslc: string, sep = "."): FDSNSourceId {
    const items = nslc.split(sep);
    if (items.length < 4) {
      throw new Error(
        `channel nslc must have 4 items separated by '${sep}': ${nslc}`,
      );
    }
    return FDSNSourceId.fromNslc(items[0], items[1], items[2], items[3]);
  }
  stationSourceId(): StationSourceId {
    return new StationSourceId(this.networkCode, this.stationCode);
  }
  networkSourceId(): NetworkSourceId {
    return new NetworkSourceId(this.networkCode);
  }
  asNslc(): NslcId {
    let chanCode;
    if (
      this.bandCode.length === 1 &&
      this.sourceCode.length === 1 &&
      this.subsourceCode.length === 1
    ) {
      chanCode = `${this.bandCode}${this.sourceCode}${this.subsourceCode}`;
    } else {
      chanCode = `${this.bandCode}${SEP}${this.sourceCode}${SEP}${this.subsourceCode}`;
    }
    return new NslcId(
      this.networkCode,
      this.stationCode,
      this.locationCode,
      chanCode,
    );
  }
  /**
   * returns a channel code. If this is an old style NSLC, it will be 3 chars,
   * but if either source or subsouce is more than one char, it will be
   * three fields delimited by underscores.
   *
   * @returns the channel code part of the id
   */
  formChannelCode(): string {
    return this.asNslc().channelCode;
  }
  toString(): string {
    return `${FDSN_PREFIX}${this.networkCode}${SEP}${this.stationCode}${SEP}${this.locationCode}${SEP}${this.bandCode}${SEP}${this.sourceCode}${SEP}${this.subsourceCode}`;
  }
  toStringNoPrefix(): string {
    return `${this.networkCode}${SEP}${this.stationCode}${SEP}${this.locationCode}${SEP}${this.bandCode}${SEP}${this.sourceCode}${SEP}${this.subsourceCode}`;
  }
  equals(other: FDSNSourceId | null): boolean {
    if (!other) {
      // useful to be able to check equals to null
      return false;
    }
    return this.toString() === other.toString();
  }
  clone(): FDSNSourceId {
    return new FDSNSourceId(
      this.networkCode,
      this.stationCode,
      this.locationCode,
      this.bandCode,
      this.sourceCode,
      this.subsourceCode,
    );
  }
}

export class NetworkSourceId {
  networkCode: string;
  constructor(networkCode: string) {
    this.networkCode = networkCode;
  }
  static parse(id: string): NetworkSourceId {
    if (!id.startsWith(FDSN_PREFIX)) {
      throw new Error(`sourceid must start with ${FDSN_PREFIX}: ${id}`);
    }
    const items = id.slice(FDSN_PREFIX.length).split(SEP);
    if (items.length === 1) {
      return new NetworkSourceId(items[0]);
    } else {
      throw new Error(
        `FDSN network sourceid must have 1 items; separated by '${SEP}': ${id}`,
      );
    }
    return new NetworkSourceId(items[0]);
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
  static parse(id: string): StationSourceId {
    if (!id.startsWith(FDSN_PREFIX)) {
      throw new Error(`station sourceid must start with ${FDSN_PREFIX}: ${id}`);
    }
    const items = id.slice(FDSN_PREFIX.length).split(SEP);
    if (items.length === 2) {
      return new StationSourceId(items[0], items[1]);
    } else {
      throw new Error(
        `FDSN station sourceid must have 2 items; separated by '${SEP}': ${id}`,
      );
    }
    return new StationSourceId(items[0], items[1]);
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
  constructor(networkCode: string, stationCode: string, locationCode: string) {
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

/**
 * Generates the best band code for a channel based on the sample rate and
 * optionally the response lower bound period, which is mostly useful for
 * separating broadband from short period seismometers.
 *
 * @param  sampRate  sample rate in samples per second
 * @param  resp_lb   response long period bound in seconds
 * @returns          single character band code
 */
export function bandCodeForRate(sampRate?: number, resp_lb?: number): string {
  if (!sampRate) {
    return "I";
  }
  if (sampRate >= 5000) {
    return "J";
  } else if (sampRate >= 1000 && sampRate < 5000) {
    if (resp_lb && resp_lb < 0.1) {
      return "F";
    }
    return "G";
  } else if (sampRate >= 250 && sampRate < 1000) {
    if (resp_lb && resp_lb < 0.1) {
      return "C";
    }
    return "D";
  } else if (sampRate >= 80 && sampRate < 250) {
    if (resp_lb && resp_lb < 0.1) {
      return "H";
    }
    return "E";
  } else if (sampRate >= 10 && sampRate < 80) {
    if (resp_lb && resp_lb < 0.1) {
      return "B";
    }
    return "S";
  } else if (sampRate > 1.05 && sampRate < 10) {
    return "M";
  } else if (sampRate >= 0.95 && sampRate <= 1.05) {
    // spec not clear about how far from 1 is L, guess 5%
    return "L";
  } else if (sampRate >= 0.1 && sampRate < 1) {
    return "V";
  } else if (sampRate >= 0.01 && sampRate < 0.1) {
    return "U";
  } else if (sampRate >= 0.001 && sampRate < 0.01) {
    return "W";
  } else if (sampRate >= 0.0001 && sampRate < 0.001) {
    return "R";
  } else if (sampRate >= 0.00001 && sampRate < 0.0001) {
    return "P";
  } else if (sampRate >= 0.000001 && sampRate < 0.00001) {
    return "T";
  } else if (sampRate < 0.000001) {
    return "Q";
  } else {
    throw new Error(`Unable to calc band code for: ${sampRate} ${resp_lb}`);
  }
}

export const EMPTY_LOC_CODE = "--";

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
  static parse(nslc: string, sep = "."): NslcId {
    const items = nslc.split(SEP);
    if (items.length !== 4) {
      throw new Error(
        `NSLC id must have 4 items; separated by '${sep}': ${nslc}`,
      );
    }
    return new NslcId(items[0], items[1], items[2], items[3]);
  }
  toString(): string {
    return `${this.networkCode}_${this.stationCode}_${this.locationCode}_${this.channelCode}`;
  }
  equals(other: NslcId): boolean {
    if (this.networkCode !== other.networkCode) {
      return false;
    }
    if (this.stationCode !== other.stationCode) {
      return false;
    }
    const myLoc = this.locationCode === EMPTY_LOC_CODE ? "" : this.locationCode;
    const otherLoc =
      other.locationCode === EMPTY_LOC_CODE ? "" : other.locationCode;
    if (myLoc !== otherLoc) {
      return false;
    }
    if (this.channelCode !== other.channelCode) {
      return false;
    }
    return true;
  }
}

export function parseSourceId(
  id: string,
): FDSNSourceId | NetworkSourceId | StationSourceId {
  if (!id.startsWith(FDSN_PREFIX)) {
    throw new Error(`sourceid must start with ${FDSN_PREFIX}: ${id}`);
  }
  const items = id.slice(FDSN_PREFIX.length).split(SEP);
  if (items.length === 1) {
    return new NetworkSourceId(items[0]);
  } else if (items.length === 2) {
    return new StationSourceId(items[0], items[1]);
  } else if (items.length !== 6) {
    throw new Error(
      `FDSN sourceid must have 6 items for channel, 2 for station or 1 for network; separated by '${SEP}': ${id}`,
    );
  }
  return new FDSNSourceId(
    items[0],
    items[1],
    items[2],
    items[3],
    items[4],
    items[5],
  );
}

export function SourceIdSorter(aSid: FDSNSourceId, bSid: FDSNSourceId): number {
  if (aSid.networkCode !== bSid.networkCode) {
    return aSid.networkCode.localeCompare(bSid.networkCode);
  }
  if (aSid.stationCode !== bSid.stationCode) {
    return aSid.stationCode.localeCompare(bSid.stationCode);
  }
  if (aSid.locationCode !== bSid.locationCode) {
    return aSid.locationCode.localeCompare(bSid.locationCode);
  }
  if (aSid.bandCode !== bSid.bandCode) {
    return aSid.bandCode.localeCompare(bSid.bandCode);
  }
  if (aSid.sourceCode !== bSid.sourceCode) {
    return aSid.sourceCode.localeCompare(bSid.sourceCode);
  }
  return aSid.subsourceCode.localeCompare(bSid.subsourceCode);
}
