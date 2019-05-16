// @flow

/*global DataView*/

// copy from model.util to make flow happy
// flow predicate %check functions
export function hasArgs(value: any): boolean %checks {
  return arguments.length != 0 && typeof value != 'undefined';
}
export function hasNoArgs(value: any): boolean %checks {
  return arguments.length == 0 || typeof value === 'undefined';
}
export function isStringArg(value: any): boolean %checks {
  return arguments.length != 0 && typeof value === 'string';
}
export function isNumArg(value: any): boolean %checks {
  return typeof value === 'number';
}

export function isDef(v: mixed) :boolean %checks {
  return typeof v !== 'undefined' && v !== null;
}

export function dataViewToString(dataView :DataView) {
  let out = "";
  for (let i=0; i< dataView.byteLength; i++) {
    out += String.fromCharCode(dataView.getUint8(i));
  }
  return out;
}


/** String representation of input. THis is kind of dumb but makes
 *  flow happier.
 */
export function stringify(value: mixed): string {
  if (typeof value === 'string') {
    return value;
  } else if (typeof value === 'number') {
    return value.toString();
  } else if (typeof value === 'boolean') {
    return value ? "true" : "false";
  } else if (typeof value === 'undefined') {
    return "undefined";
  } else if (typeof value === 'function') {
    return "function "+value.name;
  } else if (typeof value === 'object') {
    if (value) {
        return value.toString();
    } else {
      return "null";
    }
// symbol not yet supported by flow
//  } else if (typeof value === 'symbol') {
//    return value.toString();
  } else {
    return "<unknown"+(typeof value)+"???>";
  }
}
