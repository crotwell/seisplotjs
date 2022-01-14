
const d3 = seisplotjs.d3;
const hostUrl = "http://eeyore.seis.sc.edu/ringserver";
const wsUrl = "ws://eeyore.seis.sc.edu/ringserver/datalink";
const rs = new seisplotjs.ringserverweb.RingserverConnection(hostUrl);
let numPackets = 0;

  console.log(`XXXXXXX host: ${rs._host}`);
  d3.select("button#id").on("click", function(d) {
    console.log("id")
    clear_plots()
    d3.select("div.results").select("pre").text("...loading");
    rs.pullId().then(o => {
      d3.select("div.results").select("pre").text(o.ringserverVersion+"\n"+o.serverId);
    });
  });
  d3.select("button#streamids").on("click", function(d) {
    clear_plots()
      console.log("streamids")
    d3.select("div.results").select("pre").text("...loading");
    let level = Number(d3.select("input#level").property("value"));
    let match = d3.select("input#match").property("value");
    rs.pullStreamIds(level, match).then(o => {

      d3.select("div.results").select("pre").text(o.join("\n"));
    });
  });
  d3.select("button#streams").on("click", function(d) {
    clear_plots()
      console.log("streams")
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
  document.querySelector("pre").textContent+=`${packet.header}\n`
}
const datalink = new seisplotjs.datalink.DataLinkConnection(
    "ws://thecloud.seis.sc.edu/ringserver/datalink",
    packetHandler,
    errorFn);


function display_realtime(streamstat) {
  d3.select("div.results").select("pre").text(`realtime: ${streamstat.key}`);
  toggleConnect(streamstat);
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
  const streamChooser = document.querySelector("stream-list-chooser");
  streamChooser.setStreamStats([]);
  document.querySelector("pre").textContent="";
}
