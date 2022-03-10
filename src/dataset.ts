
import {downloadBlobAsFile} from "./download";
import * as mseed3 from "./mseed3";
import {Quake, parseQuakeML} from "./quakeml";
import {Network, Station, parseStationXml} from "./stationxml";
import {Seismogram, SeismogramDisplayData} from "./seismogram";
import {Seismograph} from "./seismograph";
import {SeismographConfig} from "./seismographconfig";
import {SeismogramLoader} from "./seismogramloader";
import {StartEndDuration, doFetchWithTimeout, defaultFetchInitObj,
  isDef, XML_MIME, BINARY_MIME} from "./util";
import JSZip from "jszip";

export const DATASET_DIR = "dataset";
export const DOT_ZIP_EXT = ".zip";
export const ZIP_FILENAME = DATASET_DIR+DOT_ZIP_EXT;
export const SEISMOGRAM_DIR = "seismograms";
export const CATALOG_FILE = "catalog.quakeml";
export const INVENTORY_FILE = "inventory.staxml";

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
  associate(timeOverlapSecs: number = 1800) {
    this.catalog.forEach((q:Quake)=> {
      this.waveforms.forEach((w: SeismogramDisplayData) => {
        if (isDef(q.preferredOrigin)) {
          let window = new StartEndDuration(q.preferredOrigin.time, null, timeOverlapSecs);
          if (window.overlaps(w.timeRange)) {
            w.addQuake(q);
          }
        }
      })
    });
  }

}
export function load(url: string): Promise<Dataset> {
  const fetchInitOptions = defaultFetchInitObj(BINARY_MIME);
  return doFetchWithTimeout(url, fetchInitOptions)
  .then(function (response) {
    if (response.status === 200 || response.status === 0) {
      return response.blob();
    } else {
      // no data
      throw new Error("No data");
    }
  }).then(data => JSZip.loadAsync(data)).then(zip => loadFromZip(zip));
}
export function loadFromFile(file: File): Promise<Dataset> {
  return new JSZip().loadAsync(file)
  .then(loadFromZip);
}
export function loadFromZip(zip: JSZip): Promise<Dataset> {
    // Read from the zip file!
    const promiseArray = new Array<Promise<Array<SeismogramDisplayData>>>(0);
    let datasetDir: JSZip;
    let possibleDirs = zip.folder(new RegExp('/'+SEISMOGRAM_DIR));
    /*
    let possibleDirs = zip.filter(function (relativePath, file){
      if (!file.dir) {return false;}
      if (relativePath == DATASET_DIR) { return true; }
      let possibleSeisDirs = zip.filter(function (seisPath, seisDir){
        if (seisPath.startsWith(relativePath) && seisDir.dir && seisPath.endsWith(SEISMOGRAM_DIR)) {
          return true;
        }
        return false;
      });
      return possibleSeisDirs.length > 0;
    });
    */
    if (possibleDirs.length == 0) {
      throw new Error("Unable to find dataset directory in zip file");
    } else {
      let tmpdatasetDir = zip.folder(possibleDirs[0].name.slice(0, -1*(SEISMOGRAM_DIR.length+1)));
      if (tmpdatasetDir === null) {
        // can't happen, just to keep typescript happy
        throw new Error("Unable to find dataset directory in zip file");
      } else {
        datasetDir = tmpdatasetDir;
      }
      const seisDir = datasetDir.folder(SEISMOGRAM_DIR);
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
    }

    return Promise.all(promiseArray).then((sddListList: Array<Array<SeismogramDisplayData>>) => {
      return sddListList.reduce((acc, sddList) => acc.concat(sddList), new Array<SeismogramDisplayData>(0));
    }).then((sddList: Array<SeismogramDisplayData>) => {

      const catalogFile = datasetDir.file(CATALOG_FILE);
      let qml = catalogFile ? catalogFile.async("string").then(function (rawXmlText) {
        if (rawXmlText.length < 10) {
          console.log(`qml text is really short: ${rawXmlText}`);
          return [];
        } else {
          let rawXml = new DOMParser().parseFromString(rawXmlText, XML_MIME);
          return parseQuakeML(rawXml);
        }
      }) : [];
      const inventoryFile = datasetDir.file(CATALOG_FILE);
      let staml = inventoryFile ? inventoryFile.async("string").then(function (rawXmlText) {
        if (rawXmlText.length < 10) {
          console.log(`staxml text is really short: ${rawXmlText}`);
          return [];
        } else {
          const rawXml = new DOMParser().parseFromString(rawXmlText, XML_MIME);
          return parseStationXml(rawXml);
        }
      }) : [];
      return Promise.all([sddList, qml, staml]);
    }).then(promises => {
      const dataset = new Dataset();
      dataset.waveforms = promises[0];
      dataset.catalog = promises[1];
      dataset.inventory = promises[2];
      return dataset;
    });
}
