
import { Duration, Interval} from 'luxon';
import type {TraveltimeJsonType} from "./traveltime";
import {distaz, DistAzOutput} from "./distaz";
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

/**
 * Loads seismograms based on queries to Station and Event web services.
 * Uses the traveltime web service to create times for data query. Default
 * is P-30 sec to S+60 sec.
 *
 * @param stationQuery     query to find channels
 * @param eventQuery       query to find events
 * @param dataselectQuery  optional additional parameters for seismogram query
 */
export class SeismogramLoader {
  stationQuery: StationQuery;
  withResponse: boolean;
  markOrigin: boolean;
  eventQuery: EventQuery;
  dataselectQuery: null | DataSelectQuery;
  _startPhaseList: Array<string>;
  _endPhaseList: Array<string>;
  _markedPhaseList: Array<string>;
  _startOffset: Duration;
  _endOffset: Duration;
  _networkList: Promise<Array<Network>> | null;
  _quakeList: Promise<Array<Quake>> | null;
  traveltimeList: Promise<Array<[Station, Quake, TraveltimeJsonType, DistAzOutput]>> | null;
  _sddList: Promise<Array<SeismogramDisplayData>> | null;

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
    this._startOffset = Duration.fromMillis(-30*1000);// seconds;
    this._endOffset = Duration.fromMillis(60*1000); //seconds
    this._networkList = null;
    this._quakeList = null;
    this.traveltimeList = null;
    this._sddList = null;
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

  get startOffset(): Duration {
    return this._startOffset;
  }

  set startOffset(val: Duration) {
    if (Duration.isDuration(val)) {
      this._startOffset = val;
    } else if (typeof val === "number") {
      this.startOffsetOfSeconds(val);
    } else {
      throw new Error("startOffset must be luxon Duration or number of seconds: " + stringify(val));
    }
  }

  startOffsetOfSeconds(val: number) {
    this._startOffset = Duration.fromMillis(val*1000); // seconds
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

  get endOffset(): Duration {
    return this._endOffset;
  }

  set endOffset(val: Duration) {
    if (Duration.isDuration(val)) {
      this._endOffset = val;
    } else if (typeof val === "number") {
      this.endOffsetOfSeconds(val);
    } else {
      throw new Error("startOffset must be luxon Duration or number of seconds: " + stringify(val));
    }
  }

  endOffsetOfSeconds(val: number) {
    this._endOffset = Duration.fromMillis(val*1000); //seconds
  }

  /**
   * Additional phase arrival travel times to be marked, but do not effect
   * the request time window.
   * 
   * @return array of phase names.
   */
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
  get networkList(): Promise<Array<Network>> {
    if (this._networkList === null) {
      return this.load().then(([ netList, quakeList, sddList]) => netList);
    }
    return this._networkList;
  }
  get quakeList(): Promise<Array<Quake>> {
    if (this._quakeList === null) {
      return this.load().then(([ netList, quakeList, sddList]) => quakeList);
    }
    return this._quakeList;
  }
  get sddList(): Promise<Array<SeismogramDisplayData>> {
    if (this._sddList === null) {
      return this.load().then(([ netList, quakeList, sddList]) => sddList);
    }
    return this._sddList;
  }

  loadSeismograms(): Promise<Array<SeismogramDisplayData>> {
    return this.load().then(([netList, quakeList, sddList]) => sddList);
  }

  load(): Promise<[Array<Network>, Array<Quake>, Array<SeismogramDisplayData>]> {
    const fedcat = FedCatalogQuery.fromStationQuery(this.stationQuery);

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
      this._networkList = fedcat.queryResponses();
    } else {
      this._networkList = fedcat.queryChannels();
    }

    this._quakeList = this.eventQuery.query();
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
    this.traveltimeList = Promise.all([this._networkList, this._quakeList]).then(
      ([netList, quakeList]) => {
        const ttpromiseList: Array<Promise<[Station, Quake, TraveltimeJsonType, DistAzOutput]>> = [];

        for (const q of quakeList) {
          for (const s of allStations(netList)) {
            if (s.timeRange.contains(q.time)) {
              const taupQuery = new TraveltimeQuery();
              const daz = distaz(
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
    this._sddList = this.traveltimeList.then(ttpromiseList => {
      const seismogramDataList = [];

      for (const ttarr of ttpromiseList) {
        const station = ttarr[0];
        const quake = ttarr[1];
        const ttjson = ttarr[2];
        const distaz = ttarr[3];
        // find earliest start and end arrival
        let startArrival = null;
        let endArrival = null;

        for (const pname of this.startPhaseList) {
          if (
            pname === "origin" &&
            (startArrival === null || startArrival.time > 0)
          ) {
            startArrival = createOriginArrival(distaz.distanceDeg);
          } else {
            for (const a of ttjson.arrivals) {
              if (
                a.phase === pname &&
                (startArrival===null || startArrival.time > a.time)
              ) {
                startArrival = a;
              }
            }
          }
        }

        for (const pname of this.endPhaseList) {
          // weird, but might as well allow origin to be the end phase
          if (
            pname === "origin" &&
            (endArrival===null || endArrival.time < 0)
          ) {
            endArrival = createOriginArrival(distaz.distanceDeg);
          } else {
            for (const a of ttjson.arrivals) {
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
          const startTime = quake.time
            .plus(Duration.fromMillis(1000*startArrival.time)) // seconds
            .plus(this.startOffset);
          const endTime = quake.time
            .plus(Duration.fromMillis(1000*endArrival.time)) // seconds
            .plus(this.endOffset);
          const timeRange = Interval.fromDateTimes(startTime, endTime);
          const phaseMarkers = createMarkersForTravelTimes(quake, ttjson);

          if (this.markOrigin) {
            phaseMarkers.push(createMarkerForOriginTime(quake));
          }

          for (const chan of station.channels) {
            const sdd = SeismogramDisplayData.fromChannelAndTimeWindow(
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
        const fedcatDS = new FedCatalogQuery();
        sddListPromise = fedcatDS.postQuerySeismograms(seismogramDataList);
      }

      return sddListPromise;
    });
    return Promise.all([this._networkList, this._quakeList, this._sddList]);
  }
}
