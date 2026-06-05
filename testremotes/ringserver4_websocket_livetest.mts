

//import {WS_DATALINK_SUBPROTOCOL} from '../src/datalink';
import {WS_SEEDLINK3_SUBPROTOCOL} from '../src/seedlink';
//import {WS_SEEDLINK4_SUBPROTOCOL} from '../src/seedlink4';

test("do websocket open test", (done) => {
  const USC_HOST = "eeyore.seis.sc.edu";
  const USC_PREFIX = "testringserver";
  const url = `ws://${USC_HOST}/${USC_PREFIX}/seedlink`;
  const webSocket = new WebSocket(url, WS_SEEDLINK3_SUBPROTOCOL);

  webSocket.binaryType = "arraybuffer";
  webSocket.onmessage = (event) => {
    console.log(`onmessage: ${event}`);
  };

  webSocket.onerror = (event) => {
    console.log(`onerror: ${event}`);
    done(event);
  };

  webSocket.onclose = (closeEvent) => {
    console.log(`onclose: ${closeEvent}`);
  };

  webSocket.onopen = () => {
    console.log(`onopen:`);
    webSocket.close();
    done();
  };


});
