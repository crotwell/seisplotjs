
/**
 * Repeatedly calls the given function with increasing values from 0 to 1,
 * by rescheduling animation frame after completion. Value is calculated from
 * the elapsed time with 0 being the beginning time of the transition and
 * 1 corresponding to the duration given.
 * @param  drawFn  drawing function to call with the value
 * @param  duration_millis  milliseconds for the total transition
 */
export function transition(drawFn: (x: number) => void,
    duration_millis: number) {
  let startTimestamp: DOMHighResTimeStamp|null = null;
  const transFn = (timestamp: DOMHighResTimeStamp) => {
    if (startTimestamp == null) { startTimestamp = timestamp;}
    const timeOffset = (timestamp-startTimestamp);
    if (timeOffset < duration_millis) {
      drawFn(timeOffset/duration_millis);
      window.requestAnimationFrame(transFn);
    } else {
      drawFn(1.0);
    }
  };
  window.requestAnimationFrame(transFn);
}
