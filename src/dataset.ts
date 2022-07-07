
import {Interval} from "luxon";
import {downloadBlobAsFile} from "./util";
import * as mseed3 from "./mseed3";
import {Quake, parseQuakeML} from "./quakeml";
import {Network, parseStationXml, allChannels} from "./stationxml";
import {SeismogramDisplayData} from "./seismogram";
import {SeismogramLoader} from "./seismogramloader";
import {doFetchWithTimeout, defaultFetchInitObj,
  isDef, XML_MIME, BINARY_MIME, isoToDateTime} from "./util";
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
      if (quakeList !== null ) {
        dataset.catalog = quakeList;
      }
      if (networkList !== null) {
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
    const zipfile = new JSZip();
    const zip = zipfile.folder(dirname);
    if (!zip) {
      throw new Error("unable to create subfolder in zip file: "+dirname);
    }

    zip.file("Hello.txt", "Hello World\n");

    const seisFolder = zip.folder(SEISMOGRAM_DIR);
    if (seisFolder === null) {throw new Error("can't make folder");}
    for (const [key,val] of this.waveformsToMSeed3()) {
      seisFolder.file(key, val);
    }
    return zipfile.generateAsync({type:"uint8array", compression: "DEFLATE"}).then(function(content) {
        downloadBlobAsFile(content, filename);
    });

  }
  waveformsToMSeed3(): Map<string, ArrayBuffer> {
    const out = new Map<string, ArrayBuffer>();
    const ext = "ms3";
    this.waveforms.forEach(sdd => {
      if (sdd.seismogram) {
        const mseed3Records = mseed3.toMSeed3(sdd.seismogram, createExtraHeaders("spjs", sdd));
        const byteSize = mseed3Records.reduce( (acc, cur) => acc+cur.calcSize(), 0);
        const outBuf = new ArrayBuffer(byteSize);
        let offset = 0;
        mseed3Records.forEach(ms3Rec => {
          const recSize = ms3Rec.calcSize();
          const dv = new DataView(outBuf, offset, recSize);
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
          seisId = `${seisId}_${sdd.startTime.year}-${sdd.startTime.month}-${sdd.startTime.day}`;
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
  associateQuakes(timeOverlapSecs = 1800) {
    this.waveforms.forEach((w: SeismogramDisplayData) => {
      // only try to set quake if don't already have one
      if ( ! w.hasQuake) {
        this.catalog.forEach((q:Quake)=> {
          if (isDef(q.preferredOrigin)) {
            const window = Interval.after(q.preferredOrigin.time, timeOverlapSecs);
            if (window.overlaps(w.timeRange)) {
              w.addQuake(q);
            }
          }
        });
      }
    });
  }
  associateChannels() {
    this.waveforms.forEach(sdd => {
      if ( ! sdd.hasChannel) {
        for (const c of allChannels(this.inventory)) {
          if (c.sourceId === sdd.sourceId && sdd.timeRange.overlaps(c.timeRange)) {
            sdd.channel = c;
            break;
          }
        }
      }
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
    const possibleDirs = zip.folder(new RegExp('/'+SEISMOGRAM_DIR));
    if (possibleDirs.length === 0) {
      throw new Error("Unable to find dataset directory in zip file");
    } else {
      const tmpdatasetDir = zip.folder(possibleDirs[0].name.slice(0, -1*(SEISMOGRAM_DIR.length+1)));
      if (tmpdatasetDir === null) {
        // can't happen, just to keep typescript happy
        throw new Error("Unable to find dataset directory in zip file");
      } else {
        datasetDir = tmpdatasetDir;
      }
      const seisDir = datasetDir.folder(SEISMOGRAM_DIR);
      if (isDef(seisDir)) {
        seisDir.forEach(function (relativePath, file){
          if (file.name.endsWith(".ms3")) {
            const seisPromise = file.async("arraybuffer").then(function (buffer) {
              const ms3records = mseed3.parseMSeed3Records(buffer);
              return sddFromMSeed3(ms3records);
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
      const qml = catalogFile ? catalogFile.async("string").then(function (rawXmlText) {
        if (rawXmlText.length < 10) {
          console.warn(`qml text is really short: ${rawXmlText}`);
          return [];
        } else {
          const rawXml = new DOMParser().parseFromString(rawXmlText, XML_MIME);
          return parseQuakeML(rawXml);
        }
      }) : [];
      const inventoryFile = datasetDir.file(INVENTORY_FILE);
      const staml = inventoryFile ? inventoryFile.async("string").then(function (rawXmlText) {
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
      dataset.associateChannels();
      dataset.associateQuakes();
      return dataset;
    });
}

export function sddFromMSeed3(ms3records: Array<mseed3.MSeed3Record>, ds?: Dataset): Array<SeismogramDisplayData> {
  const out: Array<SeismogramDisplayData> = [];
  const byChannelMap = mseed3.byChannel(ms3records);
  byChannelMap.forEach(ms3segments => {
    const seis = mseed3.merge(ms3segments);
    const sdd = SeismogramDisplayData.fromSeismogram(seis);
    ms3segments.forEach(msr => {
      insertExtraHeaders(msr.extraHeaders, sdd, "spjs", ds);
    })
    out.push(sdd);
  });
  return out;
}

export function insertExtraHeaders(eh: Record<string, any>, sdd: SeismogramDisplayData, key: string, ds?: Dataset) {
  const myEH = eh[key];
  if (! myEH) {
    // key not in extra headers
    return;
  }
  if ("quake" in myEH) {
    for(const pid of myEH["quake"]) {
      if (ds) {
        for(const q of ds.catalog) {
          if (q.publicId === pid) {
            sdd.addQuake(q);
          }
        }
      } else {
        // no dataset, how to find Quake from publicId?
      }
    }
  }
  if ("traveltimes" in myEH) {
    sdd.traveltimeList = myEH["traveltimes"];
  }
  if ("markers" in myEH) {
    myEH["markers"].forEach((m: any) => {
      if (typeof m === 'object' && 'time' in m) {
        m.time = isoToDateTime(m.time);
        sdd.markerList.push(m);
      }
    })
  }
}

export function createExtraHeaders(key: string, sdd: SeismogramDisplayData): Record<string, any> {
  const h: Record<string, any> = {};
  const out: Record<string, any> = {};
  out[key] = h;
  if (sdd.quakeList && sdd.quakeList.length > 0) {
    h["quake"] = sdd.quakeList.map(q => q.publicId);
  }
  if (sdd.traveltimeList && sdd.traveltimeList.length > 0) {
    h["traveltimes"] = sdd.traveltimeList;
  }
  if (sdd.markerList && sdd.markerList.length > 0) {
    h["markers"] = sdd.markerList;
  }
  return out;
}
