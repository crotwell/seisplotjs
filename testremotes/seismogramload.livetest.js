import { SeismogramLoader } from '../src/seismogramloader.js';

import {StartEndDuration} from '../src/util.js';
import {EventQuery} from '../src/fdsnevent.js';
import {StationQuery, LEVEL_CHANNEL} from '../src/fdsnstation.js';
import {allChannels} from '../src/stationxml.js';
import moment from 'moment';

// eslint-disable-next-line no-undef
const fetch = require('node-fetch');
// eslint-disable-next-line no-undef
global.fetch = fetch;

/*
*/
// oops, can't use fetch in jest test without mocking...

test( "load HODGE for local eq test", () => {
  let localQueryTimeWindow = new StartEndDuration('2020-08-21', '2020-08-22');
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
  seisLoad.startOffset = -30; // seconds
  seisLoad.endOffset = moment.duration(120, 'seconds'); // or as duration
  return seisLoad.loadSeismograms().then( sddList  => {
    expect(sddList).toHaveLength(3);

  });

});
/*
*/
