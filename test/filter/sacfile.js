// @flow

/* global Buffer */

import fs from 'fs';
import {SacPoleZero} from '../../src/sacPoleZero.js';
import {Seismogram} from '../../src/seismogram.js';
import moment from 'moment';

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
  start: moment,
  y: Float32Array
}

export function readDataView(filename: string): Promise<DataView> {
  return new Promise(function(resolve, reject) {
    fs.readFile(filename, function (err, data) {
      if (err) reject(err);
      else resolve(data.buffer);
    });
  }).then(data => {
    return new DataView(data);
  });
}

export function readSac(filename: string): Promise<sacType> {
  return readDataView(filename).then(dataView => {
    return parseSac(dataView);
  });
}

export function asSeismogram(sac: sacType): Seismogram {
  return Seismogram.createFromContiguousData(sac.y, 1/sac.delta, sac.start);
}

export function parseSac(dataView: DataView): sacType {
  let out = {};
  let littleEndian = false;
  let sacVer = dataView.getUint32(NVHDR_OFFSET, true);
  if (sacVer === 6) {
    littleEndian = true;
  }
  out.littleEndian = littleEndian;
  out.delta = dataView.getFloat32(0, littleEndian);
  out.npts = dataView.getUint32(NPTS_OFFSET, littleEndian);
  out.start = moment.utc([dataView.getUint32(YEAR_OFFSET),
                          0,
                          1,
                          dataView.getUint32(HOUR_OFFSET),
                          dataView.getUint32(MIN_OFFSET),
                          dataView.getUint32(SEC_OFFSET),
                          dataView.getUint32(MSEC_OFFSET)]);
  out.start.add(dataView.getUint32(DAY_OF_YEAR_OFFSET), "days");
  let y = new Float32Array(out.npts);
  let j=0;
  for(let i=DATA_OFFSET; i < dataView.byteLength; i+=4, j++) {
    y[j] = dataView.getFloat32(i, littleEndian);
  }
  out.y = y;
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
  return new Promise(function(resolve, reject) {
    fs.writeFile(filename, Buffer.from(new Uint8Array(sacDataView.buffer)), function (err) {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function readSacPoleZero(filename: string): Promise<SacPoleZero> {
  return new Promise(function(resolve, reject) {
    fs.readFile(filename, "utf8", function (err, data) {
      if (err) reject(err);
      else resolve(data);
    });
  }).then(data => {
    return SacPoleZero.parse(data);
  });
}
