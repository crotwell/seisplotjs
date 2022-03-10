import type {TraveltimeJsonType} from "./traveltime";
import {distaz, DistAzOutput} from "./distaz";
import {StartEndDuration} from "./util";
import {TraveltimeQuery, createOriginArrival} from "./traveltime";
import {DataSelectQuery} from "./fdsndataselect";
import {EventQuery} from "./fdsnevent";
import {StationQuery} from "./fdsnstation";
import {FedCatalogQuery} from "./irisfedcatalog";
import {Quake} from "./quakeml";
import {allStations, Network, Station} from "./stationxml";
import {SeismogramDisplayData} from "./seismogram";
import {
  createMarkersForTravelTimes,
  createMarkerForOriginTime,
} from "./seismograph";
import {isDef, isStringArg, stringify} from "./util";
import moment from "moment";
import RSVP from "rsvp";
export class SeismogramLoader {
  stationQuery: StationQuery;
  withResponse: boolean;
  markOrigin: boolean;
  eventQuery: EventQuery;
  dataselectQuery: null | DataSelectQuery;
  _startPhaseList: Array<string>;
  _endPhaseList: Array<string>;
  _markedPhaseList: Array<string>;
  _startOffset: moment.Duration;
  _endOffset: moment.Duration;
  networkList: Promise<Array<Network>> | null;
  quakeList: Promise<Array<Quake>> | null;
  traveltimeList: Promise<Array<[Station, Quake, TraveltimeJsonType, DistAzOutput]>> | null;
  sddList: Promise<Array<SeismogramDisplayData>> | null;

  constructor(
    stationQuery: StationQuery,
    eventQuery: EventQuery,
    dataselectQuery?: DataSelectQuery,
  ) {
    if (!isDef(stationQuery)) {
      throw new Error("stationQuery must not be null");
    }

    if (!(stationQuery instanceof StationQuery)) {
      throw new Error(
        "1st arg must be a StationQuery: " +
          stringify(stationQuery),
      );
    }

    if (!isDef(eventQuery)) {
      throw new Error("eventQuery must not be null");
    }

    if (!(eventQuery instanceof EventQuery)) {
      throw new Error(
        "2nd arg must be a EventQuery: " + stringify(eventQuery),
      );
    }

    this.stationQuery = stationQuery;
    this.withResponse = false;
    this.eventQuery = eventQuery;
    this.markOrigin = true;
    this.dataselectQuery = null;

    if (isDef(dataselectQuery)) {
      this.dataselectQuery = dataselectQuery;
    }

    this._startPhaseList = ["p", "P", "Pdiff", "PKP"];
    this._endPhaseList = ["s", "S", "Sdiff", "SKS"];
    this._markedPhaseList = [];
    this._startOffset = moment.duration(-30, "seconds");
    this._endOffset = moment.duration(60, "seconds");
    this.networkList = null;
    this.quakeList = null;
    this.traveltimeList = null;
    this.sddList = null;
  }

  get startPhaseList(): Array<string> {
    return this._startPhaseList;
  }

  set startPhaseList(val: Array<string> | string) {
    if (Array.isArray(val)) {
      this._startPhaseList = val;
    } else if (isStringArg(val)) {
      this._startPhaseList = val.split(",");
    } else {
      throw new Error(
        "value argument is string or array of string, but was " + typeof val,
      );
    }
  }

  get startOffset(): moment.Duration {
    return this._startOffset;
  }

  set startOffset(val: moment.Duration) {
    if (moment.isDuration(val)) {
      this._startOffset = val;
    } else if (typeof val === "number") {
      this.startOffsetOfSeconds(val);
    } else {
      throw new Error("startOffset must be moment Duration: " + stringify(val));
    }
  }

  startOffsetOfSeconds(val: number) {
    this._startOffset = moment.duration(val, "seconds");
  }

  get endPhaseList(): Array<string> {
    return this._endPhaseList;
  }

  set endPhaseList(val: Array<string> | string) {
    if (Array.isArray(val)) {
      this._endPhaseList = val;
    } else if (isStringArg(val)) {
      this._endPhaseList = val.split(",");
    } else {
      throw new Error(
        "value argument is string or array of string, but was " + typeof val,
      );
    }
  }

  get endOffset(): moment.Duration {
    return this._endOffset;
  }

  set endOffset(val: moment.Duration) {
    if (moment.isDuration(val)) {
      this._endOffset = val;
    } else if (typeof val === "number") {
      this.endOffsetOfSeconds(val);
    } else {
      throw new Error("startOffset must be moment Duration: " + stringify(val));
    }
  }

  endOffsetOfSeconds(val: number) {
    this._endOffset = moment.duration(val, "seconds");
  }

  get markedPhaseList(): Array<string> {
    return this._markedPhaseList;
  }

  set markedPhaseList(val: Array<string> | string) {
    if (Array.isArray(val)) {
      this._markedPhaseList = val;
    } else if (isStringArg(val)) {
      this._markedPhaseList = val.split(",");
    } else {
      throw new Error(
        "value argument is string or array of string, but was " + typeof val,
      );
    }
  }

  loadSeismograms(): Promise<Array<SeismogramDisplayData>> {
    return this.load().then(([netList, quakeList, sddList]) => sddList);
  }

  load(): Promise<[Array<Network>, Array<Quake>, Array<SeismogramDisplayData>]> {
    let fedcat = FedCatalogQuery.fromStationQuery(this.stationQuery);

    if (!this.stationQuery.isSomeParameterSet()) {
      throw new Error(
        "Must set some station parameter to avoid asking for everything.",
      );
    }

    if (!this.eventQuery.isSomeParameterSet()) {
      throw new Error(
        "Must set some event parameter to avoid asking for everything.",
      );
    }

    if (this.withResponse) {
      this.networkList = fedcat.queryResponses();
    } else {
      this.networkList = fedcat.queryChannels();
    }

    this.quakeList = this.eventQuery.query();
    let allPhaseList: Array<string> = [];
    allPhaseList = allPhaseList.concat(
      this.startPhaseList,
      this.endPhaseList,
      this.markedPhaseList,
    );

    if (allPhaseList.includes("origin")) {
      this.markOrigin = true;
    }

    const allPhasesWithoutOrigin = allPhaseList
      .filter(p => p !== "origin")
      .join(",");
    this.traveltimeList = RSVP.all([this.networkList, this.quakeList]).then(
      ([netList, quakeList]) => {
        let ttpromiseList: Array<Promise<[Station, Quake, TraveltimeJsonType, DistAzOutput]>> = [];

        for (let q of quakeList) {
          for (let s of allStations(netList)) {
            if (s.timeRange.contains(q.time)) {
              let taupQuery = new TraveltimeQuery();
              let daz = distaz(
                s.latitude,
                s.longitude,
                q.latitude,
                q.longitude,
              );
              taupQuery.distdeg(daz.distanceDeg);
              taupQuery.phases(allPhasesWithoutOrigin);
              // save quake and station along with result from traveltime
              ttpromiseList.push(
                Promise.all([s, q, taupQuery.queryJson(), daz]),
              );
            }
          }
        }

        return Promise.all(ttpromiseList);
      },
    );
    this.sddList = this.traveltimeList.then(ttpromiseList => {
      let seismogramDataList = [];

      for (let ttarr of ttpromiseList) {
        let station = ttarr[0];
        let quake = ttarr[1];
        let ttjson = ttarr[2];
        let distaz = ttarr[3];
        // find earliest start and end arrival
        let startArrival = null;
        let endArrival = null;

        for (let pname of this.startPhaseList) {
          if (
            pname === "origin" &&
            (startArrival === null || startArrival.time > 0)
          ) {
            startArrival = createOriginArrival(distaz.distanceDeg);
          } else {
            for (let a of ttjson.arrivals) {
              if (
                a.phase === pname &&
                (startArrival===null || startArrival.time > a.time)
              ) {
                startArrival = a;
              }
            }
          }
        }

        for (let pname of this.endPhaseList) {
          // weird, but might as well allow origin to be the end phase
          if (
            pname === "origin" &&
            (endArrival===null || endArrival.time < 0)
          ) {
            endArrival = createOriginArrival(distaz.distanceDeg);
          } else {
            for (let a of ttjson.arrivals) {
              if (
                a.phase === pname &&
                (endArrival===null || endArrival.time < a.time)
              ) {
                endArrival = a;
              }
            }
          }
        }

        if (isDef(startArrival) && isDef(endArrival)) {
          let startTime = moment
            .utc(quake.time)
            .add(startArrival.time, "seconds")
            .add(this.startOffset);
          let endTime = moment
            .utc(quake.time)
            .add(endArrival.time, "seconds")
            .add(this.endOffset);
          let timeRange = new StartEndDuration(startTime, endTime);
          let phaseMarkers = createMarkersForTravelTimes(quake, ttjson);

          if (this.markOrigin) {
            phaseMarkers.push(createMarkerForOriginTime(quake));
          }

          for (let chan of station.channels) {
            let sdd = SeismogramDisplayData.fromChannelAndTimeWindow(
              chan,
              timeRange,
            );
            sdd.addQuake(quake);
            sdd.addTravelTimes(ttjson);
            sdd.addMarkers(phaseMarkers);
            seismogramDataList.push(sdd);
          }
        }
      }

      let sddListPromise;

      if (this.dataselectQuery !== null) {
        sddListPromise = this.dataselectQuery.postQuerySeismograms(
          seismogramDataList,
        );
      } else {
        // use IrisFedCat
        let fedcatDS = new FedCatalogQuery();
        sddListPromise = fedcatDS.postQuerySeismograms(seismogramDataList);
      }

      return sddListPromise;
    });
    return Promise.all([this.networkList, this.quakeList, this.sddList]);
  }
}
