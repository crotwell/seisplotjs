
// browser field in package.json for handlebars 4.7.7 is bad,
// direct import from file works for now, but is fragile
import Handlebars from "handlebars/dist/cjs/handlebars.js";
//import Handlebars from "handlebars";
import {SeismogramDisplayData} from './seismogram';
import {DateTime, Duration, Interval} from "luxon";
import {checkStringOrDate} from './util';

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

      const decimalDigits = digits === undefined ? 2 : digits;

      if (typeof val === "number") {
        return val.toFixed(decimalDigits);
      }

      // not number, so just return unmodified
      return val;
    },
  );
  Handlebars.registerHelper("formatIsoDate", function (param: DateTime, hash: Record<string, any>) {
    if (typeof param === "undefined" || param === null) return "no time";
    let m = param;

    if (!DateTime.isDateTime(param)) {
      m = checkStringOrDate(param);
    }
    if (hash.format) {
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
      return `${param}`;
    }
    return `${param.toMillis()/1000} sec`;
  });
}
