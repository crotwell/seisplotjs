import { loadSeismograms } from '../src/seismogramloader.js';

import {StartEndDuration} from '../src/util.js';
import {EventQuery} from '../src/fdsnevent.js';
import {StationQuery} from '../src/fdsnstation.js';
import {allChannels} from '../src/stationxml.js';
import moment from 'moment';

// eslint-disable-next-line no-undef
const fetch = require('node-fetch');
// eslint-disable-next-line no-undef
global.fetch = fetch;

/*
*/
// oops, can't use fetch in jest test without mocking...

test( "query setter test", () => {
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
  return Promise.all( [ localEventQuery.query(), stationQuery.queryChannels() ] )
    .then( ( [ localQuakeList, networks ] ) => {
      expect(localQuakeList).not.toBeEmpty();
      expect(networks).not.toBeEmpty();
      return loadSeismograms(Array.from(allChannels(networks)),
                                localQuakeList,
                              "P",
                              "S",
                              "PcP",
                              moment.duration(-30, 'seconds'),
                              moment.duration(120, 'seconds'));
    }).then(sddList => {
      expect(sddList).toHaveLength(3);
    });

});
/*
*/
