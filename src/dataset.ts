
import {downloadBlobAsFile} from "./download";
import * as mseed3 from "./mseed3";
import {Quake} from "./quakeml";
import {Network, Station} from "./stationxml";
import {Seismogram, SeismogramDisplayData} from "./seismogram";
import {Seismograph} from "./seismograph";
import {SeismographConfig} from "./seismographconfig";
import {SeismogramLoader} from "./seismogramloader";
import JSZip from "jszip";

export const DATASET_DIR = "dataset";
export const DOT_ZIP_EXT = ".zip";
export const ZIP_FILENAME = DATASET_DIR+DOT_ZIP_EXT
export const SEISMOGRAM_DIR = "seismograms";

export class Dataset {
  catalog: Array<Quake>;
  inventory: Array<Network>;
  waveforms: Array<SeismogramDisplayData>;
  processedWaveforms: Array<SeismogramDisplayData>;
  constructor() {
    this.catalog = new Array<Quake>(0);
    this.inventory = new Array<Network>(0);
    this.waveforms = new Array<SeismogramDisplayData>(0);
    this.processedWaveforms = new Array<SeismogramDisplayData>(0);
  }
  static fromSeismogramLoader(loader: SeismogramLoader): Promise<Dataset> {
    return loader.load()
    .then( ([networkList, quakeList, sddList]) => {
      const dataset = new Dataset();
      dataset.waveforms = sddList;
      if (quakeList != null ) {
        dataset.catalog = quakeList;
      }
      if (networkList != null) {
        dataset.inventory = networkList;
      }
      return dataset;
    });
  }
  saveToZipFile(filename: string = ZIP_FILENAME) {
    let dirname = DATASET_DIR;
    if (filename.endsWith(DOT_ZIP_EXT)) {
      dirname = filename.slice(0,-4);
    }
    let zipfile = new JSZip();
    let zip = zipfile.folder(dirname);
    if (!zip) {
      throw new Error("unable to create subfolder in zip file: "+dirname);
    }

    zip.file("Hello.txt", "Hello World\n");

    let seisFolder = zip.folder(SEISMOGRAM_DIR);
    if (seisFolder === null) {throw new Error("can't make folder");}
    for (let [key,val] of this.waveformsToMSeed3()) {
      seisFolder.file(key, val);
    }
    zipfile.generateAsync({type:"uint8array", compression: "DEFLATE"}).then(function(content) {
        downloadBlobAsFile(content, filename);
    });

  }
  waveformsToMSeed3(): Map<string, ArrayBuffer> {
    const out = new Map<string, ArrayBuffer>();
    const ext = "ms3";
    this.waveforms.forEach(sdd => {
      if (sdd.seismogram) {
        let mseed3Records = mseed3.toMSeed3(sdd.seismogram);
        let byteSize = mseed3Records.reduce( (acc, cur) => acc+cur.calcSize(), 0);
        let outBuf = new ArrayBuffer(byteSize);
        let offset = 0;
        mseed3Records.forEach(ms3Rec => {
          let recSize = ms3Rec.calcSize();
          let dv = new DataView(outBuf, offset, recSize);
          ms3Rec.save(dv);
          offset += recSize;
        });
        let i=1;
        let seisId;
        if (!!sdd.id && sdd.id.length > 0) {
          seisId = sdd.id;
        } else {
          seisId = sdd.codes();
        }
        let filename = `${seisId}.${ext}`;
        if (out.has(filename)) {
          seisId = `${seisId}_${sdd.startTime.year()}-${sdd.startTime.month()}-${sdd.startTime.day()}`;
        }
        while (out.has(filename)) {
          i+=1;
          filename = `${seisId}_${i}.${ext}`;
        }
        out.set(filename, outBuf);
      }
    });
    return out;
  }

  merge(other: Dataset): Dataset {
    const out = new Dataset();
    out.waveforms = this.waveforms.concat(other.waveforms);
    out.inventory = this.inventory.concat(other.inventory);
    out.catalog = this.catalog.concat(other.catalog);
    return out;
  }

}
export function loadFromFile(file: File): Promise<Dataset> {
  return new JSZip().loadAsync(file)
  .then(function(zip) {
    // Read from the zip file!
    const promiseArray = new Array<Promise<Array<SeismogramDisplayData>>>(0);
    const seisDir = zip.folder(SEISMOGRAM_DIR);
    if (!!seisDir) {
      seisDir.forEach(function (relativePath, file){
        if (file.name.endsWith(".ms3")) {
          const seisPromise = file.async("arraybuffer").then(function (buffer) {
            let ms3records = mseed3.parseMSeed3Records(buffer);
            let seismograms = mseed3.seismogramPerChannel(ms3records)
              .map((seis: Seismogram) => SeismogramDisplayData.fromSeismogram(seis));
            return seismograms;
          });
          promiseArray.push(seisPromise);
        }
      });
    }
    return Promise.all(promiseArray).then((sddListList: Array<Array<SeismogramDisplayData>>) => {
      return sddListList.reduce((acc, sddList) => acc.concat(sddList), new Array<SeismogramDisplayData>(0));
    }).then((sddList: Array<SeismogramDisplayData>) => {
      const dataset = new Dataset();
      dataset.waveforms = sddList;
      return dataset;
    });
  });
}
