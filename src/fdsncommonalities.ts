
/**
 * commonalities with all types of FDSN Web Services
*/

import { isNonEmptyStringArg, checkProtocol,} from './util';

export const IRIS_HOST = "service.iris.edu";

export class FDSNCommon {
  /** @private */
  _specVersion: string;

  /** @private */
  _protocol: string;

  /** @private */
  _host: string;

  /** @private */
  _port: number;

  /** @private */
  _nodata: number|undefined;

  /** @private */
  _timeoutSec: number;

  constructor(host?: string) {
    this._specVersion = "1";
    this._host = IRIS_HOST;
    this._protocol = checkProtocol();

    if (isNonEmptyStringArg(host)) {
      this._host = host;
    }

    this._port = 80;
    this._timeoutSec = 30;
  }

}
