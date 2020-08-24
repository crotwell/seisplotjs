import { loadSeismograms } from '../src/seismogramloader.js';

import {StartEndDuration} from '../src/util.js';
import {EventQuery} from '../src/fdsnevent.js';
import {StationQuery} from '../src/fdsnstation.js';
import {allChannels} from '../src/stationxml.js';
import moment from 'moment';

test( "query setter test", () => {
  let localQueryTimeWindow = new StartEndDuration('2020-08-20', '2020-08-21');
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
  Promise.all( [ localEventQuery.query(), stationQuery.queryChannels() ] )
    .then( ( [ localQuakeList, networks ] ) => {
      return loadSeismograms(Array.from(allChannels(networks)),
                                localQuakeList,
                              "P",
                              "S",
                              "PcP",
                              moment.duration(-30, 'seconds'),
                              moment.duration(120, 'seconds'));
    }).then(sddList => {
      console.log(`got ${sddList.length} seismograms`);
    });

});
