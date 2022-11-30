
import { Duration, Interval} from 'luxon';
import type {TraveltimeJsonType} from "./traveltime";
import {distaz} from "./distaz";
import {TraveltimeQuery, createOriginArrival} from "./traveltime";
import {DataSelectQuery} from "./fdsndataselect";
import {EventQuery} from "./fdsnevent";
import {StationQuery} from "./fdsnstation";
import {FedCatalogQuery} from "./irisfedcatalog";
import {Quake} from "./quakeml";
import {allStations, Network} from "./stationxml";
import {SeismogramDisplayData} from "./seismogram";
import {
  createMarkersForTravelTimes,
  createMarkerForOriginTime,
} from "./seismograph";
import {isDef, isStringArg, stringify} from "./util";

export class SeismogramLoadResult {
  withFedCatalog: boolean = true;
  withResponse: boolean = false;
  markOrigin: boolean = true;
  startPhaseList: Array<string> = [];
  endPhaseList: Array<string> = [];
  markedPhaseList: Array<string> = [];
  startOffset: Duration;
  endOffset: Duration;
  networkList: Array<Network> = [];
  quakeList: Array<Quake> = [];
  traveltimeList: Array<[Quake, TraveltimeJsonType]> = [];
  sddList: Array<SeismogramDisplayData> = [];
  constructor() {
    this.startOffset = Duration.fromMillis(0);// seconds;
    this.endOffset = Duration.fromMillis(0); //seconds
  }
}
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
  withFedCatalog: boolean;
  withResponse: boolean;
  markOrigin: boolean;
  eventQuery: EventQuery;
  dataselectQuery: null | DataSelectQuery;
  _startPhaseList: Array<string>;
  _endPhaseList: Array<string>;
  _markedPhaseList: Array<string>;
  _startOffset: Duration;
  _endOffset: Duration;

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

    this.withFedCatalog = true;
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
      this.startOffsetSeconds(val);
    } else {
      throw new Error("startOffset must be luxon Duration or number of seconds: " + stringify(val));
    }
  }

  /**
   * Sets the startOffset Duration to be val seconds.
   * @param  val  number of seconds, negative for before, positive for after
   * @return     this
   */
  startOffsetSeconds(val: number): SeismogramLoader {
    this._startOffset = Duration.fromMillis(val*1000); // seconds
    return this;
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
      this.endOffsetSeconds(val);
    } else {
      throw new Error("startOffset must be luxon Duration or number of seconds: " + stringify(val));
    }
  }

  /**
   * Sets the endOffset Duration to be val seconds.
   * @param  val  number of seconds, negative for before, positive for after
   * @return     this
   */
  endOffsetSeconds(val: number): SeismogramLoader {
    this._endOffset = Duration.fromMillis(val*1000); //seconds
    return this;
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

  loadSeismograms(): Promise<Array<SeismogramDisplayData>> {
    return this.load().then(res => res.sddList);
  }

  load(): Promise<SeismogramLoadResult> {
    let fedcat;
    if (this.withFedCatalog) {
      fedcat = FedCatalogQuery.fromStationQuery(this.stationQuery);
    } else {
      fedcat = this.stationQuery;
    }

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

    let networkListPromise;
    if (this.withResponse) {
      networkListPromise = fedcat.queryResponses();
    } else {
      networkListPromise = fedcat.queryChannels();
    }

    let quakeListPromise = this.eventQuery.query();
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
    return Promise.all([networkListPromise, quakeListPromise]).then(
      ([netList, quakeList]) => {
        const ttpromiseList: Array<Promise<[Quake, TraveltimeJsonType]>> = [];

        for (const q of quakeList) {
          // separate call per quake as depth might be different
          const allDistDeg = [];
          for (const s of allStations(netList)) {
            if (s.timeRange.contains(q.time)) {
              const daz = distaz(
                s.latitude,
                s.longitude,
                q.latitude,
                q.longitude,
              );
              allDistDeg.push(daz.distanceDeg);
            }
          }
          const taupQuery = new TraveltimeQuery();
          taupQuery.distdeg(allDistDeg);
          taupQuery.phases(allPhasesWithoutOrigin);
          // save quake along with result from traveltime
          ttpromiseList.push(
            Promise.all([q, taupQuery.queryJson()]),
          );

        }

        return Promise.all([Promise.all(ttpromiseList), netList, quakeList]);
      },
    ).then(([ttList, netList, quakeList]) => {
      const seismogramDataList = [];

      for (const ttarr of ttList) {
        const quake = ttarr[0];
        const ttjson = ttarr[1];
        for (const station of allStations(netList)) {
          if ( ! station.timeRange.contains(quake.time)) {
            // skip stations not active during quake
            break;
          }
          const daz = distaz(
            station.latitude,
            station.longitude,
            quake.latitude,
            quake.longitude,
          );

          // find earliest start and end arrival
          let startArrival = null;
          let endArrival = null;

          for (const pname of this.startPhaseList) {
            if (pname === "origin" &&
                (startArrival === null || startArrival.time > 0)) {
              startArrival = createOriginArrival(daz.distanceDeg);
            } else {
              for (const a of ttjson.arrivals) {
                // look for station with same distance
                if ((Math.abs((a.distdeg % 360)-(daz.distanceDeg%360)) < 1e-6 ||
                     Math.abs(360-(a.distdeg % 360)-(daz.distanceDeg%360)) < 1e-6  ) &&
                    a.phase === pname &&
                    (startArrival===null || startArrival.time > a.time) ) {
                  startArrival = a;
                }
              }
            }
          }

          for (const pname of this.endPhaseList) {
            // weird, but might as well allow origin to be the end phase
            if (pname === "origin" &&
                (endArrival===null || endArrival.time < 0)) {
              endArrival = createOriginArrival(daz.distanceDeg);
            } else {
              for (const a of ttjson.arrivals) {
                if ((Math.abs((a.distdeg % 360)-(daz.distanceDeg%360)) < 1e-6 ||
                     Math.abs(360-(a.distdeg % 360)-(daz.distanceDeg%360)) < 1e-6  ) &&
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
      }

      let sddListPromise;

      if (this.dataselectQuery !== null) {
        sddListPromise = this.dataselectQuery.postQuerySeismograms(
          seismogramDataList,
        );
      } else if (this.withFedCatalog) {
        // use IrisFedCat
        const fedcatDS = new FedCatalogQuery();
        sddListPromise = fedcatDS.postQuerySeismograms(seismogramDataList);
      } else {
        // use default dataselect
        sddListPromise = new DataSelectQuery().postQuerySeismograms(
          seismogramDataList,
        );
      }

      return Promise.all([sddListPromise, ttList, netList, quakeList]);
    }).then(([sddList, ttList, netList, quakeList]) => {
      const out = new SeismogramLoadResult();
      out.withFedCatalog = this.withFedCatalog;
      out.withResponse = this.withResponse;
      out.markOrigin = this.markOrigin;
      out.startPhaseList = this.startPhaseList;
      out.endPhaseList = this.endPhaseList;
      out.markedPhaseList = this.markedPhaseList;
      out.startOffset = this.startOffset;
      out.endOffset = this.endOffset;
      out.networkList = netList;
      out.quakeList = quakeList;
      out.traveltimeList = ttList;
      out.sddList = sddList;
      return out;
    });
  }
}
