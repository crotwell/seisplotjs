import * as Handlebars from "handlebars";
// re-export
export {Handlebars};

import {SeismogramDisplayData} from './seismogram';
import {DateTime, Duration, Interval} from "luxon";
import {checkStringOrDate} from './util';

/**
 * Registers Handlebars helpers like onlyChangesChannel and other formatters
 * 
 */
export function registerHelpers() {
  Handlebars.registerHelper(
    "onlyChangesChannel",
    function (sddDataList: Array<SeismogramDisplayData>, index: number): string {
      let out = "";
      const curr = sddDataList[index];

      if (typeof curr === "undefined" || curr === null) {
        return "unknown";
      }

      if (index === 0) {
        out = curr.codes();
      } else {
        const prev = sddDataList[index - 1];

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
    },
  );
  Handlebars.registerHelper("distdeg", function (sdd: SeismogramDisplayData) {
    const distaz = sdd.distaz;

    if (distaz) {
      return distaz.distanceDeg;
    } else {
      return "";
    }
  });
  Handlebars.registerHelper("distkm", function (sdd: SeismogramDisplayData) {
    const distaz = sdd.distaz;

    if (distaz) {
      return distaz.distanceKm;
    } else {
      return "";
    }
  });
  Handlebars.registerHelper(
    "formatNumber",
    function (val: number, digits = 2) {
      if (typeof val === "undefined" || val === null) {
        return "";
      }
      if (typeof digits === 'string') {
        digits = parseInt(digits);
      }

      if (typeof val === "number" && typeof digits === "number") {
        return val.toFixed(digits);
      }

      // not number, so just return unmodified
      return val;
    },
  );
  Handlebars.registerHelper("formatIsoDate", function (param: DateTime, hash: Record<string, unknown>) {
    if (typeof param === "undefined" || param === null) return "no time";
    let m = param;

    if (!DateTime.isDateTime(param)) {
      m = checkStringOrDate(param);
    }
    if ("format" in hash && typeof hash.format === 'string') {
      return m.toFormat(hash.format);
    } else {
      return m.toISO();
    }
  });
  Handlebars.registerHelper("formatDuration", function (param: Duration | Interval) {
    if (typeof param === "undefined" || param === null) return "no time";
    if (Interval.isInterval(param)) {
      param = param.toDuration();
    }
    if (!Duration.isDuration(param)) {
      return `${String(param)}`;
    }
    return `${param.toMillis()/1000} sec`;
  });
}
