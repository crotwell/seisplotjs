
const d3 = seisplotjs.d3;
const hostUrl = "http://eeyore.seis.sc.edu/ringserver";
const rs = new seisplotjs.ringserverweb.RingserverConnection(hostUrl);
let numPackets = 0;
d3.select("div.results").select("pre").text(hostUrl+'\n'+rs.getDataLinkURL());

d3.select("button#id").on("click", function(d) {
  clear_plots()
  d3.select("div.results").select("pre").text("...loading");
  rs.pullId().then(o => {
    d3.select("div.results").select("pre").text(o.ringserverVersion+"\n"+o.serverId);
  });
});
d3.select("button#streamids").on("click", function(d) {
  clear_plots()
  d3.select("div.results").select("pre").text("...loading");
  let level = Number(d3.select("input#level").property("value"));
  let match = d3.select("input#match").property("value");
  rs.pullStreamIds(level, match).then(o => {

    d3.select("div.results").select("pre").text(o.join("\n"));
  });
});
d3.select("button#streams").on("click", function(d) {
  clear_plots()
  d3.select("div.results").select("pre").text("...loading");
  let match = d3.select("input#streammatch").property("value");
  rs.pullStreams(match).then(o => {
    const streamChooser = document.querySelector("stream-list-chooser");
    streamChooser.setCallback(c => display_realtime(c));
    streamChooser.setStreamStats(o.streams);
    let text = "";
    o.streams.forEach( sstat => text+=`${sstat.key} ${sstat.start.toISOString()} ${sstat.end.toISOString()} (${sstat.calcLatency(o.accessTime).humanize()})\n`);
    d3.select("div.results").select("pre").text(text);
  });
});


const errorFn = function(error) {
  console.assert(false, error);
  if (datalink) {datalink.close();}
  seisplotjs.d3.select("pre").text("Error: "+error);
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
  lastPackets.forEach(p => packetText+=`${p.streamId} ${p.pktid} ${p.packetStart.toISOString()} to ${p.packetEnd.toISOString()}\n`);
  document.querySelector("pre").textContent=packetText;
}
const datalink = new seisplotjs.datalink.DataLinkConnection(
    rs.getDataLinkURL(),
    packetHandler,
    errorFn);

let lastPackets = [];
function display_realtime(streamstat) {
  datalink.endStream();
  lastPackets = [];
  d3.select("div.results").select("pre").text(`realtime: ${streamstat.key}\n`);
  datalink.connect()
  .then(serverId => {
    seisplotjs.d3.select("button#disconnect").text("Disconnect");
    return datalink.match(streamstat.key);
  }).then(response => {
    stopped = false;
    console.log(`match response: ${response}`)
    return datalink.stream();
  }).catch( function(error) {
    seisplotjs.d3.select("div#debug").append('p').html("Error: " +error);
    console.assert(false, error);
  });
}

let stopped = true;

seisplotjs.d3.select("button#disconnect").on("click", function(d) {
  toggleConnect();
});

let toggleConnect = function(streamstat) {
  stopped = ! stopped;
  if (stopped) {
    if (datalink) {
      datalink.endStream();
      datalink.close();
    }
    seisplotjs.d3.select("button#disconnect").text("Reconnect");
  } else {
    let matchPattern = streamstat.key;
    if (datalink) {
      datalink.connect()
      .then(serverId => {
        console.log(`id response: ${serverId}, match ${matchPattern}`);
        return datalink.match(matchPattern);
      }).then(response => {
        console.log(`match response: ${response}`)
      //  return datalink.positionAfter(timeWindow.start);
      }).then(response => {
        console.log(`positionAfter response: ${response}`)
        return datalink.stream();
      }).catch( function(error) {
        seisplotjs.d3.select("div#debug").append('p').html("Error: " +error);
        console.assert(false, error);
      });
    }
    seisplotjs.d3.select("button#disconnect").text("Disconnect");
  }
}

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
}
