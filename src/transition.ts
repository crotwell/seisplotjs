
export function transition(drawFn: (x: number) => void, duration_millis: number) {
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
  }
  window.requestAnimationFrame(transFn);
}
