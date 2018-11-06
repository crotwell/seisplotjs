import * as filter from '../../src/filter/index.js';
import fs from 'fs';

export const NVHDR_OFFSET = 76 * 4;
export const NPTS_OFFSET = 79 * 4;
export const DATA_OFFSET = 632;

export function readDataView(filename) {
  return new Promise(function(resolve, reject) {
    fs.readFile(filename, function (err, data) {
      if (err) reject(err);
      else resolve(data.buffer);
    });
  }).then(data => {
    return new DataView(data);
  });
}

export function readSac(filename) {
  return readDataView(filename).then(dataView => {
    return parseSac(dataView);
  });
}

export function parseSac(dataView) {
  let out = {};
  let littleEndian = false;
  let sacVer = dataView.getUint32(NVHDR_OFFSET, true);
  if (sacVer === 6) {
    littleEndian = true;
  }
  out.littleEndian = littleEndian;
  out.delta = dataView.getFloat32(0, littleEndian);
  out.npts = dataView.getUint32(NPTS_OFFSET, littleEndian);
  let y = [];
  let j=0;
  for(let i=DATA_OFFSET; i < dataView.byteLength; i+=4, j++) {
    y[j] = dataView.getFloat32(i, littleEndian);
  }
  out.y = y;
  return out;
}

export function replaceYData(dataView, yData) {
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

export function writeSac(sacDataView, filename) {
  return new Promise(function(resolve, reject) {
    fs.writeFile(filename, new Uint8Array(sacDataView.buffer), function (err) {
      if (err) reject(err);
      else resolve();
    });
  })
}

export function readSacPoleZero(filename) {
  return new Promise(function(resolve, reject) {
    fs.readFile(filename, "utf8", function (err, data) {
      if (err) reject(err);
      else resolve(data);
    });
  }).then(data => {
    let pz = {
      zeros: [],
      poles: [],
      constant: 1
    };
    let lines = data.split('\n');
    let numZeros = 0;
    let numPoles = 0;
    let i=0;
    while (i < lines.length) {
      let l = lines[i];
      let items = l.trim().split(/ +/);
      if (items[0] === 'ZEROS') {
        numZeros = parseInt(items[1]);
        i++;
        l = lines[i];
        items = l.trim().split(/ +/);
        while (i < lines.length && pz.zeros.length < numZeros) {
          if (items[0] === 'POLES') {
            // no more zeros, fill array with 0
            for(let z = pz.zeros.length; z < numZeros; z++) {
              pz.zeros.push(filter.createComplex(0,0));
            }
            break;
          } else {
            let real = parseFloat(items[0]);
            let imag = parseFloat(items[1]);
            pz.zeros.push(filter.createComplex(real, imag));
          }
          i++;
          l = lines[i];
          items = l.trim().split(/ +/);
        }
      }
      if (items[0] === 'POLES') {
        numPoles = parseInt(items[1]);
        i++;
        l = lines[i];
        items = l.trim().split(/ +/);
        while (i < lines.length && pz.poles.length < numPoles) {
          if (items[0] === 'CONSTANT') {
            // no more poles, fill array with 0
            for(let z = pz.poles.length; z < numPoles; z++) {
              pz.poles.push(filter.createComplex(0,0));
            }
            break;
          } else {
            let real = parseFloat(items[0]);
            let imag = parseFloat(items[1]);
            pz.poles.push(filter.createComplex(real, imag));
          }
          i++;
          l = lines[i];
          items = l.trim().split(/ +/);
        }
      }
      if (items[0] === 'CONSTANT') {
        pz.constant = parseFloat(items[1]);
      }
      i++;
    }
    return pz;
  });
}
