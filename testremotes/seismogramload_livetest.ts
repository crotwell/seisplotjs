import { SeismogramLoader } from '../src/seismogramloader.js';

import {isoToDateTime} from '../src/util.js';
import {EventQuery} from '../src/fdsnevent.js';
import {StationQuery, LEVEL_CHANNEL} from '../src/fdsnstation.js';
import { Duration, Interval} from 'luxon';

// eslint-disable-next-line no-undef
const fetch = require('node-fetch');
// eslint-disable-next-line no-undef
global.fetch = fetch;


test( "load HODGE for local eq test", () => {
  let localQueryTimeWindow = Interval.fromDateTimes(isoToDateTime('2020-08-21'), isoToDateTime('2020-08-22'));
  let localEventQuery = new EventQuery()
    .timeWindow(localQueryTimeWindow)
    .latitude(33.72).longitude(-81)
    .maxRadius(2);
  let stationQuery = new StationQuery()
    .networkCode('CO')
    .stationCode('HODGE')
    .locationCode('00')
    .channelCode('LH?')
    .timeWindow(localQueryTimeWindow);
  let staUrl = stationQuery.formURL(LEVEL_CHANNEL);
  expect(staUrl).toContain('cha=');
//  expect(localEventQuery instanceof StationQuery).toBeTrue();
  const seisLoad = new SeismogramLoader(stationQuery, localEventQuery );
  seisLoad.startPhaseList = "P";
  seisLoad.endPhaseList = "S";
  seisLoad.markedPhaseList = "PcP";
  seisLoad.startOffset = Duration.fromMillis(-30*1000); // seconds
  seisLoad.endOffset = Duration.fromMillis(120*1000); // or as duration
  return seisLoad.load().then( loadResult  => {
      expect(loadResult.sddList).toHaveLength(3);
      expect(loadResult.networkList).toHaveLength(1);
      expect(loadResult.quakeList).toHaveLength(1);
    });

});
