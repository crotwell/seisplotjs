//@flow

export default function() {
  let _protocol = 'http:';
  if (typeof document !== 'undefined' && document.location && "https:" === document.location.protocol) {
    _protocol = 'https:';
  }
  return _protocol;
}
