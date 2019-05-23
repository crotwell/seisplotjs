//@flow
import {Trace} from '../seismogram';

export function alphabeticalSort(traceA: Trace, traceB: Trace) {
  if (traceA.codes() < traceB.codes()) {
    return -1;
  } else {
    return 1;
  }
}
