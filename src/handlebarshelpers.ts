
// browser field in package.json for handlebars 4.7.7 is bad,
// direct import from file works for now, but is fragile
import Handlebars from "handlebars/dist/cjs/handlebars.js";
//import Handlebars from "handlebars";
import {DateTime, Duration} from "luxon";
import {checkStringOrDate} from './util';

export function registerHelpers() {
  Handlebars.registerHelper(
    "onlyChangesChannel",
    function (sddDataList, index) {
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
  Handlebars.registerHelper("distdeg", function (sdd) {
    const distaz = sdd.distaz;

    if (distaz) {
      return distaz.distanceDeg;
    } else {
      return "";
    }
  });
  Handlebars.registerHelper("distkm", function (sdd) {
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
  Handlebars.registerHelper("formatIsoDate", function (param, hash) {
    if (typeof param === "undefined" || param === null) return "no time";
    const defaultFormat = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'";
    const format = hash.format === undefined ? defaultFormat : hash.format;
    let m = param;

    if (!DateTime.isDateTime(param)) {
      m = checkStringOrDate(param);
    }

    return m.toFormat(format);
  });
  Handlebars.registerHelper("formatDuration", function (param) {
    if (typeof param === "undefined" || param === null) return "no time";

    if (!Duration.isDuration(param)) {
      return `${param}`;
    }
    return `${param.toMillis()/1000} sec`;
  });
}
