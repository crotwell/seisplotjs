

// seisplotjs comes from the seisplotjs bundle
const traveltime = seisplotjs.traveltime;
const fdsnevent = seisplotjs.fdsnevent;
const fdsnstation = seisplotjs.fdsnstation;
const fdsndataselect = seisplotjs.fdsndataselect;
const d3 = seisplotjs.d3;
const moment = seisplotjs.moment;
const miniseed = seisplotjs.miniseed;
const SeismographConfig = seisplotjs.seismographconfig.SeismographConfig;
const SeismogramDisplayData = seisplotjs.seismogram.SeismogramDisplayData;
const Seismograph = seisplotjs.seismograph.Seismograph;

seisplotjs.RSVP.on('error', function(reason) {
  console.assert(false, reason);
});

let daysAgo = 1;
let netCode = 'CI';
let staCodes = 'BAR,BBR,BBS,BC3';
let chanCode = 'HHZ';
let HOST = 'service.scedc.caltech.edu';

let protocol = 'http:';
if ("https:" == document.location.protocol) {
  protocol = 'https:'
}

let quakeQuery = new fdsnevent.EventQuery()
  .protocol(protocol)
  .host(HOST)
  .minLat(32).maxLat(35)
  .minLon(-124).maxLon(-115)
  .startTime(moment.utc().subtract(daysAgo, 'days'))
  .endTime(moment.utc());
d3.select("div.recentQuakesUrl")
    .append("p")
    .text("Quakes URL: "+quakeQuery.formURL());

let stationQuery = new fdsnstation.StationQuery()
  .protocol(protocol)
  .host(HOST)
  .networkCode(netCode)
  .stationCode(staCodes)
  .channelCode(chanCode);

d3.select("div.recentQuakesUrl")
    .append("p")
    .text("Stations URL: "+stationQuery.formURL(fdsnstation.LEVEL_STATION));
let networkPromise = stationQuery.queryStations().then(function(netArray) {
          staCodes = [];
          for (let i=0;i<netArray[0].stations.length; i++) {
            staCodes.push(netArray[0].stations[i].stationCode);
          }
          console.log("sta codes: "+staCodes.join());
          return netArray;
});

quakeQuery.query().then(function(quakes) {
  let table = d3.select("div.recentQuakes")
    .select("table");
  if ( table.empty()) {
    table = d3.select("div.recentQuakes")
      .append("table");
    let th = table.append("thead").append("tr");
    th.append("th").text("Time");
    th.append("th").text("Mag");
    th.append("th").text("Lat,Lon");
    th.append("th").text("Depth");
    th.append("th").text("Decription");
    table.append("tbody");
  }
  let tableData = table.select("tbody")
    .selectAll("tr")
    .data(quakes, function(d) {return d.time;});
  tableData.exit().remove();

  let tr = tableData
    .enter()
    .append("tr");
  tr.append("td")
    .text(function(d) {
      return d.time.toISOString();
      });
  tr.append("td")
    .text(function(d) {
      return d.magnitude.mag+" "
          +d.magnitude.type;
      });
  tr.append("td")
    .text(function(d) {
      return "("+d.latitude+", "+d.longitude+")";
      });
  tr.append("td")
    .text(function(d) {
      return (d.depth/1000)+"km ";
      });
  tr.append("td")
    .text(function(d) {
      return d.description;
      });
  tr.on("click", function(d){
console.log("click "+d.time.toISOString());
      d3.select("div.seismograms")
        .selectAll("p")
        .remove();
      d3.select("div.seismograms")
        .selectAll("p")
        .data([d])
        .enter()
        .append("p")
        .text(function(d) {
          return "quake: "
              +d.time.toISOString()+" "
              +d.magnitude.mag+" "
              +d.magnitude.type+" "
              +"("+d.latitude+", "+d.longitude+") "
              +(d.depth/1000)+"km "
              +d.description;
        });
        seisplotjs.RSVP.hash({
            network: networkPromise,
            quake: new fdsnevent.EventQuery()
                .host(quakeQuery.host())
                .protocol(quakeQuery.protocol())
                .includearrivals(true)
                .eventId(d.eventId)
                .query()
                .then(function(qArray) {return qArray[0];})
        }).then(function(hash) {
console.log("quake network Promise then");
          hash.plotPromise = plotSeismograms(d3.select("div.seismograms"),
                       hash.network[0].stations, "--", chanCode, hash.quake, HOST, protocol);
          return seisplotjs.RSVP.hash(hash);
        });
    });
    return quakes;
}, function(reason) {
console.assert(false, reason);
console.log("Reject: "+reason);
d3.select("div.recentQuakes")
    .append("p")
    .text("Reject: "+reason);
});

let plotSeismograms = function(div, stations, loc, chan, quake, dataHost, protocol) {
  div.selectAll('div.myseisplot').remove();
console.log("plot seis "+stations.length+" stations");
  let dur = 300;
  let pOffset = -120;
  let clockOffset = 0; // set this from server somehow!!!!
  console.log("calc start end: "+quake.time.toISOString()+" "+dur+" "+clockOffset);
  let promise = new seisplotjs.RSVP.Promise(function(resolve, reject) {
    resolve(true);
  });
  for (let s = 0; s<stations.length; s++) {
    const mysta = stations[s];
    console.log("plot s "+s+" of "+stations.length+"  "+mysta);
    promise = promise.then( () => {
      return plotOneStation(div, mysta, loc, chan, quake, pOffset, dur, clockOffset, protocol, dataHost);
    });
  }
  return promise;
}

let plotOneStation = function(div, mystation, loc, chan, quake, pOffset, dur, clockOffset, protocol, host) {
console.log("plotOneStation: "+mystation.codes());
    return new traveltime.TraveltimeQuery()
        .protocol(protocol)
        .evdepth( quake.depth > 0 ? quake.depth/1000 : 0)
        .evlat(quake.latitude).evlon(quake.longitude)
        .stalat(mystation.latitude).stalon(mystation.longitude)
        .phases('p,P,PKP,PKIKP,Pdiff,s,S,Sdiff,PKP,SKS,SKIKS')
        .query()
        .then(function(ttimes) {
    let firstP = null;
    let firstS = null;
    for (let p=0; p<ttimes.arrivals.length; p++) {
      if ((ttimes.arrivals[p].phase.startsWith('P') || ttimes.arrivals[p].phase.startsWith('p')) && ( ! firstP || firstP.time > ttimes.arrivals[p])) {
        firstP = ttimes.arrivals[p];
      }
      if ((ttimes.arrivals[p].phase.startsWith('S') || ttimes.arrivals[p].phase.startsWith('s')) && ( ! firstS || firstS.time > ttimes.arrivals[p])) {
        firstS = ttimes.arrivals[p];
      }
    }
    return { firstP: firstP, firstS: firstS };
    }).then(function(firstPS) {
    let PArrival = moment.utc(quake.time).add((firstPS.firstP.time+pOffset), 'seconds');
    let seisDates = new seisplotjs.util.StartEndDuration(PArrival, null, dur, clockOffset);
    let startDate = seisDates.startTime;
    let endDate = seisDates.endTime;

    console.log("Start end: "+startDate.toISOString()+" "+endDate.toISOString());
    return new fdsndataselect.DataSelectQuery(host)
      .protocol(protocol)
      .networkCode(mystation.network.networkCode)
      .stationCode(mystation.stationCode)
      .locationCode(loc)
      .channelCode(chan)
      .startTime(startDate)
      .endTime(endDate)
      .queryDataRecords()
      .then(dataRecords => {
        let byChannel = miniseed.byChannel(dataRecords);
        let keys = Array.from(byChannel.keys());
        console.log("Got "+dataRecords.length+" data records for "+keys.length+" channels");
        for (let key of byChannel.keys()) {
          let trace = miniseed.merge(byChannel.get(key));
            div.append('p').html('Plot for ' + key);
            let svgdiv = div.append('div').attr('class', 'myseisplot');
            if (trace) {
                let seisData = SeismogramDisplayData.fromSeismogram(trace);
                let seisConfig = new SeismographConfig()
                let seismograph = new Seismograph(svgdiv, seisConfig, seisData, startDate, endDate);
                let markers = [];
                  markers.push({ markertype: 'predicted', name: "origin", time: quake.time });
                  markers.push({ markertype: 'predicted', name: firstPS.firstP.phase, time: moment.utc(quake.time).add(firstPS.firstP.time, 'seconds') });
                  markers.push({ markertype: 'predicted', name: firstPS.firstS.phase, time: moment.utc(quake.time).add(firstPS.firstS.time, 'seconds') });

                if (quake.arrivals) {
                  for ( let aNum=0; aNum < quake.arrivals.length; aNum++) {
                    let arrival = quake.arrivals[aNum];
if (! arrival) {console.log("arrival is undef??? "+aNum); }
                    if (arrival && arrival.pick.stationCode == mystation.stationCode) {
                    markers.push({ markertype: 'pick', name: arrival.phase, time: arrival.pick.time });
                    console.log("markers.push({ markertype: 'pick', name: "+arrival.phase+", time: "+arrival.pick.time.toISOString() );
                    }
                  }
                }
                seisData.addMarkers(markers);
                console.log("draw");
                seismograph.draw();
            } else {
              div.append('p').html('Empty trace, No data found for '+mystation.codes());
            }
        }
        if (keys.length==0){
            div.append('p').html('No data found for '+mystation.codes());
        }
        return firstPS;
      })
      .catch(error => {
        console.log("error retrieve data: "+error);
        div.append('p').text("Error loading data." );
      });
    }).catch(function(e) {
      console.assert(false, e);
    });
};
