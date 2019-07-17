// @flow

/* global Buffer */

import fs from 'fs';
import {SacPoleZero} from '../../src/sacPoleZero.js';

export const NVHDR_OFFSET = 76 * 4;
export const NPTS_OFFSET = 79 * 4;
export const DATA_OFFSET = 632;

export function readDataView(filename: string) {
  return new Promise(function(resolve, reject) {
    fs.readFile(filename, function (err, data) {
      if (err) reject(err);
      else resolve(data.buffer);
    });
  }).then(data => {
    return new DataView(data);
  });
}

export function readSac(filename: string) {
  return readDataView(filename).then(dataView => {
    return parseSac(dataView);
  });
}

export function parseSac(dataView: DataView) {
  let out = {};
  let littleEndian = false;
  let sacVer = dataView.getUint32(NVHDR_OFFSET, true);
  if (sacVer === 6) {
    littleEndian = true;
  }
  out.littleEndian = littleEndian;
  out.delta = dataView.getFloat32(0, littleEndian);
  out.npts = dataView.getUint32(NPTS_OFFSET, littleEndian);
  let y = new Float32Array(out.npts);
  let j=0;
  for(let i=DATA_OFFSET; i < dataView.byteLength; i+=4, j++) {
    y[j] = dataView.getFloat32(i, littleEndian);
  }
  out.y = y;
  return out;
}

export function replaceYData(dataView: DataView, yData: Float32Array) {
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
