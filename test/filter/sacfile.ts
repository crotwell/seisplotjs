
import * as fs from 'fs/promises';
import { Buffer } from 'buffer';
import {SacPoleZero} from '../../src/sacpolezero';
import {Seismogram} from '../../src/seismogram';
import {UTC_OPTIONS} from '../../src/util';
import {DateTime} from 'luxon';

export const NVHDR_OFFSET = 76 * 4;
export const NPTS_OFFSET = 79 * 4;
export const DATA_OFFSET = 632;
export const YEAR_OFFSET = 70 * 4;
export const DAY_OF_YEAR_OFFSET = 71 * 4;
export const HOUR_OFFSET = 72 * 4;
export const MIN_OFFSET = 73 * 4;
export const SEC_OFFSET = 74 * 4;
export const MSEC_OFFSET = 75 * 4;

export type sacType = {
  littleEndian: boolean,
  delta: number,
  npts: number,
  start: DateTime,
  y: Float32Array,
}

export function readDataView(filename: string): Promise<DataView> {
  return fs.open(filename, 'r')
  .then((fh: fs.FileHandle) => {
    const out = fh.readFile();
    fh.close();
    return out;
  })
  .then((b: Buffer) => b.buffer)
  .then((data: ArrayBuffer) => new DataView(data));
}

export function readSac(filename: string): Promise<sacType> {
  return readDataView(filename).then(dataView => {
    return parseSac(dataView);
  });
}

export function asSeismogram(sac: sacType): Seismogram {
  return Seismogram.createFromContiguousData(sac.y, 1/sac.delta, sac.start);
}

export function readSeismogram(filename: string): Promise<Seismogram> {
  return readSac(filename).then(sac => asSeismogram(sac));
}

export function parseSac(dataView: DataView): sacType {
  let littleEndian = false;
  let sacVer = dataView.getUint32(NVHDR_OFFSET, true);
  if (sacVer === 6) {
    littleEndian = true;
  }
  const delta = dataView.getFloat32(0, littleEndian);
  const npts = dataView.getUint32(NPTS_OFFSET, littleEndian);
  let start = DateTime.fromObject({ year: dataView.getUint32(YEAR_OFFSET),
                          ordinal: dataView.getUint32(DAY_OF_YEAR_OFFSET),
                          hour: dataView.getUint32(HOUR_OFFSET),
                          minute: dataView.getUint32(MIN_OFFSET),
                          second: dataView.getUint32(SEC_OFFSET),
                          millisecond: dataView.getUint32(MSEC_OFFSET)}, UTC_OPTIONS);
  let y = new Float32Array(npts);
  let j=0;
  for(let i=DATA_OFFSET; i < dataView.byteLength; i+=4, j++) {
    y[j] = dataView.getFloat32(i, littleEndian);
  }
  let out: sacType = {
    littleEndian: littleEndian,
    delta: delta,
    npts: npts,
    start: start,
    y: y,
  };
  return out;
}

export function replaceYData(dataView: DataView, yData: Float32Array): DataView {
  let littleEndian = false;
  let sacVer = dataView.getUint32(NVHDR_OFFSET, true);
  if (sacVer === 6) {
    littleEndian = true;
  }
  for(let i=DATA_OFFSET, j=0; i < dataView.byteLength && j < yData.length; i+=4, j++) {
     dataView.setFloat32(i, yData[j], littleEndian);
  }
  return dataView;
}

export function writeSac(sacDataView: DataView, filename: string): Promise<void> {
  return fs.open(filename, 'w')
  .then((fh: fs.FileHandle) => fh.writeFile(Buffer.from(new Uint8Array(sacDataView.buffer))));
}

export function readSacPoleZero(filename: string): Promise<SacPoleZero> {
  return fs.open(filename, 'r')
  .then((fh: fs.FileHandle) => {
    const out = fh.readFile("utf8");
    fh.close();
    return out;
  })
  .then((data: string) =>  SacPoleZero.parse(data));
}
