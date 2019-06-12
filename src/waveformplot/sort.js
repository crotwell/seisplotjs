//@flow
import {Seismogram} from '../seismogram';

export function alphabeticalSort(traceA: Seismogram, traceB: Seismogram) {
  if (traceA.codes() < traceB.codes()) {
    return -1;
  } else {
    return 1;
  }
}
