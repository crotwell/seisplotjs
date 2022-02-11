
export function downloadBlobAsFile(data: ArrayBuffer, filename: string, mimeType: string = 'application/octet-stream') {
  if(!data) {
      console.error(' No data')
      return;
  }

  if(!filename) filename = 'filetodownload.txt'

  const blob = new Blob([data], {type: mimeType});
  const e    = document.createEvent('MouseEvents');
  const a    = document.createElement('a');

  a.download = filename;
  a.href = window.URL.createObjectURL(blob);
  a.dataset.downloadurl =  [mimeType, a.download, a.href].join(':');
  e.initMouseEvent('click', true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
  a.dispatchEvent(e);
}
