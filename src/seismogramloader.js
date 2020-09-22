//@flow

import {StartEndDuration} from './util.js';
import {TraveltimeQuery} from './traveltime.js';
import {DataSelectQuery} from './fdsndataselect.js';
import {Channel} from './stationxml.js';
import {Quake} from './quakeml.js';
import {SeismogramDisplayData} from './seismogram.js';
import {createMarkersForTravelTimes} from './seismograph.js';
import {isDef} from './util.js';
import moment from 'moment';

export function loadSeismograms(channelList: Array<Channel>,
                quakeList: Array<Quake>,
                startPhaseList: Array<string>,
                endPhaseList: Array<string>,
                otherPhaseList: Array<string>,
                startOffset: moment$MomentDuration,
                endOffset: moment$MomentDuration,
                dsQuery?: DataSelectQuery): Promise<Array<SeismogramDisplayData>> {
  let stationList = new Set();
  let allPhaseList = [];
  allPhaseList = allPhaseList.concat(startPhaseList, endPhaseList, otherPhaseList);
  let allPhases = allPhaseList.join(',');
  if ( ! isDef(allPhases)) { allPhases = "";}

  for (let chan of channelList) {
    stationList.add(chan.station);
  }
  let ttPromiseList = [];
  for (let s of stationList) {
    for (let q of quakeList) {
      if (s.timeRange.contains(q.time)) {
        let taupQuery = new TraveltimeQuery()
          .latLonFromStation(s)
          .latLonFromQuake(q);
        // for flow
        if (allPhases) {taupQuery.phases(allPhases);}
        let queryPromise = taupQuery.queryJson().then(ttimes => {
          return {
            ttimes: ttimes,
            quake: q,
            station: s,
            sddList: [],
            startArrival: null,
            endArrival: null
          };
        });
        ttPromiseList.push(queryPromise);
      }
    }
  }
  // $FlowFixMe[incompatible-call]
  return Promise.all(ttPromiseList).then(ttList => {
    let seismogramDataList = [];
    for (let tt of ttList) {
      for (let pname of startPhaseList) {
        for (let a of tt.ttimes.arrivals) {
          if (a.phase === pname && ( ! tt.startArrival || tt.startArrival.time > a.time)) {
            tt.startArrival = a;
          }
        }
      }
      for (let pname of endPhaseList) {
        for (let a of tt.ttimes.arrivals) {
          if (a.phase === pname && ( ! tt.endArrival || tt.endArrival.time > a.time)) {
            tt.endArrival = a;
          }
        }
      }
      let startTime = moment.utc(tt.quake.time)
        .add(tt.startArrival.time, 'seconds').add(startOffset);
      let endTime = moment.utc(tt.quake.time)
        .add(tt.endArrival.time, 'seconds').add(endOffset);
      let timeWindow = new StartEndDuration(startTime, endTime);
      let phaseMarkers = createMarkersForTravelTimes(tt.quake, tt.ttimes);
      phaseMarkers.push({
        type: 'predicted',
        name: "origin",
        time: moment.utc(tt.quake.time),
        description: ""
      });

      for (let chan of channelList) {
        if (tt.station === chan.station) {
          let sdd = SeismogramDisplayData.fromChannelAndTimeWindow(chan, timeWindow);
          sdd.addQuake(tt.quake);
          sdd.addTravelTimes(tt.ttimes);
          sdd.addMarkers(phaseMarkers);
          tt.sddList.push(sdd);
          seismogramDataList.push(sdd);
        }
      }
    }

    if ( ! dsQuery) {
      dsQuery = new DataSelectQuery();
    }
    return dsQuery.postQuerySeismograms(seismogramDataList);

  });
}
