import * as sp from '../../seisplotjs_3.1.1_standalone.mjs';

const hostUrl = "https://eeyore.seis.sc.edu/ringserver";
const rs = new sp.ringserverweb.RingserverConnection(hostUrl);
let numPackets = 0;
document.querySelector("div.results pre").textContent = hostUrl+'\n'+rs.getDataLinkURL();

document.querySelector("button#id").addEventListener("click", function(evt) {
  clear_plots();
  document.querySelector("div.results pre").textContent = "...loading";
  rs.pullId().then(o => {
    document.querySelector("div.results pre").textContent = o.ringserverVersion+"\n"+o.serverId;
  });
});
document.querySelector("button#streamids").addEventListener("click", function(evt) {
  clear_plots();
  document.querySelector("div.results pre").textContent = "...loading";
  let level = Number(document.querySelector("input#level").value);
  let match = document.querySelector("input#match").value.trim();
  rs.pullStreamIds(level, match).then(o => {

    document.querySelector("div.results pre").textContent = o.join("\n");
  });
});
document.querySelector("button#streams").addEventListener("click", function(evt) {
  clear_plots();
  document.querySelector("div.results pre").textContent = "...loading";
  let match = document.querySelector("input#streammatch").value.trim();
  rs.pullStreams(match).then(o => {
    const streamChooser = document.querySelector("stream-list-chooser");
    streamChooser.setCallback(c => display_realtime(c));
    streamChooser.setStreamStats(o.streams);
    let text = "";
    o.streams.forEach( sstat => text+=`${sstat.key} ${sstat.start.toISO()} ${sstat.end.toISO()} (${sstat.calcLatency(o.accessTime).toHuman()})\n`);
    document.querySelector("div.results pre").textContent = text;
  });
});


const errorFn = function(error) {
  console.assert(false, error);
  if (datalink) {datalink.close();}
  document.querySelector("div.results pre").textContent = "Error: "+error;
};
const packetHandler = function(packet) {
  if (packet.isMiniseed()) {
    numPackets++;
    document.querySelector("span#numPackets").textContent=numPackets;
  }
  if (lastPackets.length > 10) {
    lastPackets = lastPackets.slice(lastPackets.length-10);
  }
  lastPackets.push(packet);
  let packetText = "";
  lastPackets.forEach(p => packetText+=`${p.streamId} ${p.pktid} ${p.packetStart.toISO()} to ${p.packetEnd.toISO()}\n`);
  document.querySelector("pre").textContent=packetText;
};
const datalink = new sp.datalink.DataLinkConnection(
    rs.getDataLinkURL(),
    packetHandler,
    errorFn);

let lastPackets = [];
function display_realtime(streamstat) {
  datalink.endStream();
  lastPackets = [];
  document.querySelector("div.results pre").textContent = `realtime: ${streamstat.key}\n`;
  datalink.connect()
  .then(serverId => {
    document.querySelector("button#disconnect").textContent = "Disconnect";
    return datalink.match(streamstat.key);
  }).then(response => {
    stopped = false;
    console.log(`match response: ${response}`);
    return datalink.stream();
  }).catch( function(error) {
    addToDebug("Error: " +error);
    console.assert(false, error);
  });
}

function addToDebug(message) {
  const debugDiv = document.querySelector("div#debug");
  if (!debugDiv) { return; }
  const pre = debugDiv.appendChild(document.createElement("pre"));
  const code = pre.appendChild(document.createElement("code"));
  code.textContent = message;
}

let stopped = true;

document.querySelector("button#disconnect").addEventListener("click", function(evt) {
  toggleConnect();
});

let toggleConnect = function(streamstat) {
  stopped = ! stopped;
  if (stopped) {
    if (datalink) {
      datalink.endStream();
      datalink.close();
    }
    document.querySelector("button#disconnect").textContent = "Reconnect";
  } else {
    let matchPattern = streamstat.key;
    if (datalink) {
      datalink.connect()
      .then(serverId => {
        console.log(`id response: ${serverId}, match ${matchPattern}`);
        return datalink.match(matchPattern);
      }).then(response => {
        console.log(`match response: ${response}`);
        return datalink.stream();
      }).catch( function(error) {
        addToDebug("Error: " +error);
        console.assert(false, error);
      });
    }
    document.querySelector("button#disconnect").textContent = "Disconnect";
  }
};

function clear_plots() {
  if (! stopped) {
    if (datalink) {
      datalink.endStream();
      stopped = true;
    }
  }
  document.querySelector("span#numPackets").textContent="0";
  const streamChooser = document.querySelector("stream-list-chooser");
  streamChooser.setStreamStats([]);
  document.querySelector("pre").textContent="";
};
