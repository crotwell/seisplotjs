//@flow

export function alphabeticalSort(traceA : model.seismogram.Trace, traceB : model.seismogram.Trace) {
  if (traceA.codes() < traceB.codes()) {
    return -1;
  } else {
    return 1;
  }
}
