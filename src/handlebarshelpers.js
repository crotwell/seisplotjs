// @flow

import Handlebars from 'handlebars';
import moment from 'moment';

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
  Handlebars.registerHelper("formatIsoDate", function(param, hash) {
    if (typeof param === 'undefined' || param === null ) return "no time";
    let defaultFormat = 'YYYY-MM-DD[T]HH:mm:ss.SSSS';
    let format = hash.format===undefined ? defaultFormat : hash.format;
    let m = param;
    if ( ! moment.isMoment(param)) {
      m = moment(param).utc()
    }
    return m.format(format);
  });

  Handlebars.registerHelper("formatDuration", function(param, hash) {
    if (typeof param === 'undefined' || param === null ) return "no time";
    return `${param.asSeconds()} sec`;
  });
}
