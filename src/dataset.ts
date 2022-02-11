
import {downloadBlobAsFile} from "./download";
import {Quake} from "./quakeml";
import {Network, Station} from "./stationxml";
import {Seismogram, SeismogramDisplayData} from "./seismogram";
import {Seismograph} from "./seismograph";
import {SeismographConfig} from "./seismographconfig";
import {SeismogramLoader} from "./seismogramloader";


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
}
