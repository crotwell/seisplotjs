

// seisplotjs comes from the seisplotjs bundle
let wp = seisplotjs.waveformplot
let traveltime = seisplotjs.traveltime
let fdsnevent = seisplotjs.fdsnevent
let fdsnstation = seisplotjs.fdsnstation
let fdsndataselect = seisplotjs.fdsndataselect;
let moment = fdsnevent.moment;
let RSVP = fdsnstation.RSVP;

fdsnstation.RSVP.on('error', function(reason) {
  console.assert(false, reason);
});

let daysAgo = 365;
let netCode = 'NL';
let staCodes = '*';
let chanCode = 'BHZ';
let HOST = 'www.orfeus-eu.org';
let ISC_HOST = 'www.isc.ac.uk';

let protocol = 'http:';
if ("https:" == document.location.protocol) {
  protocol = 'https:'
}

let quakeQuery = new fdsnevent.EventQuery()
  .protocol(protocol)
  .minLat(45).maxLat(58)
  .minLon(-2).maxLon(11)
  .minMag(4)
  .startTime(moment.utc().subtract(daysAgo, 'days'))
  .endTime(moment.utc());
let eventUrl = quakeQuery.formURL();
wp.d3.select("div.recentQuakesUrl")
    .append("p")
    .text("Quakes URL: ")
    .append('a').attr('href', eventUrl)
    .text(eventUrl);

let stationQuery = new fdsnstation.StationQuery()
  .protocol(protocol)
  .host(HOST)
  .networkCode(netCode)
  .channelCode(chanCode);

let stationsUrl = stationQuery.formURL(fdsnstation.LEVEL_STATION);
wp.d3.select("div.stationsUrl")
    .append("p")
    .text("Stations URL: ")
    .append('a').attr('href', stationsUrl)
    .text(stationsUrl);
let networkPromise = stationQuery.queryStations().then(function(netArray) {
          staCodes = [];
          for (let i=0;i<netArray[0].stations().length; i++) {
            staCodes.push(netArray[0].stations()[i].stationCode());
          }
          wp.d3.select("div.stationCodes").append('p').text(staCodes.join());
          console.log("sta codes: "+staCodes.join());
          return netArray;
});

quakeQuery.query().then(function(quakes) {
  let table = wp.d3.select("div.recentQuakes")
    .select("table");
  if ( table.empty()) {
    table = wp.d3.select("div.recentQuakes")
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
    .data(quakes, function(d) {return d.time();});
  tableData.exit().remove();

  let tr = tableData
    .enter()
    .append("tr");
  tr.append("td")
    .text(function(d) {
      return d.time().toISOString();
      });
  tr.append("td")
    .text(function(d) {
      return d.magnitude().mag()+" "
          +d.magnitude().type();
      });
  tr.append("td")
    .text(function(d) {
      return "("+d.latitude()+", "+d.longitude()+")";
      });
  tr.append("td")
    .text(function(d) {
      return (d.depth()/1000)+"km ";
      });
  tr.append("td")
    .text(function(d) {
      return d.description();
      });
  tr.on("click", function(d){
console.log("click "+d.time().toISOString());
      wp.d3.select("div.seismograms")
        .selectAll("p")
        .remove();
      wp.d3.select("div.seismograms")
        .selectAll("p")
        .data([d])
        .enter()
        .append("p")
        .text(function(d) {
          return "quake: "
              +d.time().toISOString()+" "
              +d.magnitude().mag()+" "
              +d.magnitude().type()+" "
              +"("+d.latitude()+", "+d.longitude()+") "
              +(d.depth()/1000)+"km "
              +d.description();
        });
        fdsnstation.RSVP.hash({
            network: networkPromise,
            quake: new fdsnevent.EventQuery()
                .host(quakeQuery.host())
                .protocol(quakeQuery.protocol())
                .includearrivals(true)
                .eventid(d.eventid())
                .query()
                .then(function(qArray) {return qArray[0];})
        }).then(function(hash) {
console.log("quake network Promise then");
          plotSeismograms(wp.d3.select("div.seismograms"),
                       hash.network[0].stations(), "--", chanCode, hash.quake, HOST, protocol);
          return hash;
        });
    });
    return quakes;
}, function(reason) {
console.assert(false, reason);
console.log("Reject: "+reason);
wp.d3.select("div.recentQuakes")
    .append("p")
    .text("Reject: "+reason);
});

let plotSeismograms = function(div, stations, loc, chan, quake, dataHost, protocol) {
  div.selectAll('div.myseisplot').remove();
console.log("plot seis");
  let dur = 300;
  let pOffset = -120;
  let clockOffset = 0; // set this from server somehow!!!!
  console.log("calc start end: "+quake.time().toISOString()+" "+dur+" "+clockOffset);
  for (let s = 0; s<stations.length; s++) {
    plotOneStation(div, stations[s], loc, chan, quake, pOffset, dur, clockOffset, protocol, dataHost);
  }
}

let plotOneStation = function(div, mystation, loc, chan, quake, pOffset, dur, clockOffset, protocol, host) {
console.log("plotOneStation: "+mystation.codes());
return new traveltime.TraveltimeQuery()
    .protocol(protocol)
    .evdepth( quake.depth() > 0 ? quake.depth()/1000 : 0)
    .evlat(quake.latitude()).evlon(quake.longitude())
    .stalat(mystation.latitude()).stalon(mystation.longitude())
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
    let PArrival = moment.utc(quake.time()).add(firstPS.firstP.time+pOffset, 'seconds');
    let seisDates = new seisplotjs.fdsndataselect.StartEndDuration(PArrival, null, dur, clockOffset);
    let startDate = seisDates.start;
    let endDate = seisDates.end;

    console.log("Start end: "+startDate.toISOString()+" "+endDate.toISOString());
    let url = wp.formRequestUrl(protocol, host, mystation.network().networkCode(), mystation.stationCode(), loc, chan, startDate, endDate);
    console.log("Data request: "+url);
    let dsQuery = new fdsndataselect.DataSelectQuery()
        .protocol(protocol)
        .host(host)
        .networkCode(mystation.network().networkCode())
        .stationCode(mystation.stationCode())
        .locationCode(loc)
        .channelCode(chan)
        .startTime(startDate)
        .endTime(endDate);
    return RSVP.hash({
      "firstPS": firstPS,
      "PArrival": PArrival,
      "startDate": startDate,
      "endDate": endDate,
      "dataRecords": dsQuery.query(),
      "dsQuery": dsQuery,
      "quake": quake,
      "mystation": mystation
    });
  }).then(function(hash) {
        let byChannel = wp.miniseed.byChannel(hash.dataRecords);
        let keys = Array.from(byChannel.keys());
        console.log("Got "+hash.dataRecords.length+" data records for "+keys.length+" channels");
        for (let key of byChannel.keys()) {
          let segments = wp.miniseed.merge(byChannel.get(key));
            div.append('p').html('Plot for ' + key);
            let svgdiv = div.append('div').attr('class', 'myseisplot');
            if (segments.length > 0) {
                let seismogram = new wp.Seismograph(svgdiv, segments, hash.startDate, hash.endDate);
                let markers = [];
                  markers.push({ markertype: 'predicted', name: "origin", time: quake.time() });
                  markers.push({ markertype: 'predicted', name: hash.firstPS.firstP.phase, time: moment.utc(quake.time()).add(hash.firstPS.firstP.time, 'seconds') });
                  markers.push({ markertype: 'predicted', name: hash.firstPS.firstS.phase, time: moment.utc(quake.time()).add(hash.firstPS.firstS.time, 'seconds') });

                if (hash.quake.arrivals()) {
                  for ( let aNum=0; aNum < hash.quake.arrivals().length; aNum++) {
                    let arrival = hash.quake.arrivals()[aNum];
if (! arrival) {console.log("arrival is undef??? "+aNum); }
                    if (arrival && arrival.pick().stationCode() == mystation.stationCode()) {
                    markers.push({ markertype: 'pick', name: arrival.phase(), time: arrival.pick().time() });
                    console.log("markers.push({ markertype: 'pick', name: "+arrival.phase()+", time: "+arrival.pick().time().toISOString() );
                    }
                  }
                }
                seismogram.appendMarkers(markers);
                seismogram.draw();
            }
        }
        if (byChannel.size==0){
            div.append('p').html('No data found for '+mystation.codes());
        }
        return hash;
    }).catch(function(e) {
      console.log("catch in ttimes then"+e);
      console.assert(false, e);
      div.append('p').html("Error loading data."+e );
      throw e;
    });
};
