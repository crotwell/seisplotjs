import Handlebars from 'handlebars';

import * as distaz from './distaz.js';

export function registerHelpers() {
  Handlebars.registerHelper("onlyChangesChannel", function(sddDataList, index) {
    let out = "";
    const curr = sddDataList[index];
    if (index === 0) {
      out = curr.codes();
    } else {
      const prev = sddDataList[index-1];
      if (prev.networkCode !== curr.networkCode) {
        out = curr.codes();
      } else if (prev.stationCode !== curr.stationCode) {
        out = `${curr.stationCode}.${curr.locationCode}.${curr.channelCode}`;
      } else if (prev.locationCode !== curr.locationCode) {
        out = `${curr.locationCode}.${curr.channelCode}`;
      } else {
        out = curr.channelCode;
      }
    }
    return out;
  });

  Handlebars.registerHelper("distdeg", function(sdd) {
    const distaz = sdd.distaz;
    if (distaz) {
      return distaz.distanceDeg;
    } else {
      return "";
    }
  });
  Handlebars.registerHelper("distkm", function(sdd) {
    const distaz = sdd.distaz;
    if (distaz) {
      return distaz.distanceKm;
    } else {
      return "";
    }
  });
}
