
import {downloadBlobAsFile} from "./download";
import {toMSeed3} from "./mseed3";
import {Quake} from "./quakeml";
import {Network, Station} from "./stationxml";
import {Seismogram, SeismogramDisplayData} from "./seismogram";
import {Seismograph} from "./seismograph";
import {SeismographConfig} from "./seismographconfig";
import {SeismogramLoader} from "./seismogramloader";
import JSZip from "jszip";

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
  saveToZipFile(filename: string = "dataset.zip") {
    let zip = new JSZip();

    zip.file("Hello.txt", "Hello World\n");

    let img = zip.folder("seismograms");
    if (img === null) {throw new Error("can't make folder");}
    img.file("seis.ms3", this.waveformToMSeed3());

    zip.generateAsync({type:"uint8array", compression: "DEFLATE"}).then(function(content) {
        downloadBlobAsFile(content, filename);
    });

  }
  waveformToMSeed3(): ArrayBuffer {
    let mseed3Records =
    this.waveforms.map( sdd => sdd.seismogram ? toMSeed3(sdd.seismogram): [])
    .reduce((acc,cur) => acc.concat(cur), []);
    let byteSize = mseed3Records.reduce( (acc, cur) => acc+cur.calcSize(), 0);
    let outBuf = new ArrayBuffer(byteSize);
    let offset = 0;
    mseed3Records.forEach(ms3Rec => {
      let recSize = ms3Rec.calcSize();
      console.log(`Record: ${offset} + ${recSize}  of ${byteSize}`);
      let dv = new DataView(outBuf, offset, recSize);
      ms3Rec.save(dv);
      offset += recSize;
    });
    //seisplotjs.download.downloadBlobAsFile(outBuf, "waveform.ms3");
    return outBuf;
  }

}
