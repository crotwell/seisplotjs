

// seisplotjs comes from the seisplotjs standalone bundle
let wp = seisplotjs.waveformplot;
let traveltime = seisplotjs.traveltime;
let fdsnevent = seisplotjs.fdsnevent;
let fdsnstation = seisplotjs.fdsnstation;
let fdsndataselect = seisplotjs.fdsndataselect;
let moment = seisplotjs.moment;
let RSVP = seisplotjs.RSVP;

let USGS = "earthquake.usgs.gov";
let IRIS = "service.iris.edu";

RSVP.on('error', function(reason) {
  console.assert(false, reason);
});

let daysAgo = 365;
let netCode = 'CO';
let locCode = '00';
let chanCode = 'HHZ';
let datahost = IRIS;
let quakehost = USGS;
let minLat = 31;
let maxLat = 36;
let minLon = -84;
let maxLon = -79;
let centerLat = (minLat+maxLat)/2;
let centerLon = (minLon+maxLon)/2;
let mapZoomLevel = 7;

let dur = 300;
let pOffset = -120;
let clockOffset = 0; // set this from server somehow!!!!

let protocol = 'http:';
if ("https:" == document.location.protocol) {
  protocol = 'https:'
}
console.log("Protocol: "+protocol+"  host: "+quakehost);

let quakeQuery = new fdsnevent.EventQuery()
  .host(quakehost)
  .protocol(protocol)
  .minLat(minLat).maxLat(maxLat)
  .minLon(minLon).maxLon(maxLon)
  .startTime(moment.utc().subtract(daysAgo, 'days'))
  .endTime(moment.utc());
wp.d3.select("div.recentQuakesUrl")
    .append("p")
    .text("Quakes URL: "+quakeQuery.formURL());

let stationQuery = new fdsnstation.StationQuery()
  .protocol(protocol)
  .networkCode(netCode)
  .minLat(minLat).maxLat(maxLat)
  .minLon(minLon).maxLon(maxLon)
  .channelCode(chanCode);
wp.d3.select("div.recentQuakesUrl")
    .append("p")
    .text("Stations URL: "+stationQuery.formURL(fdsnstation.LEVEL_STATION));
let networkPromise = stationQuery.queryStations().then(function(netArray) {
          staCodes = [];
          for (let i=0;i<netArray[0].stations.length; i++) {
            staCodes.push(netArray[0].stations[i].stationCode);
          }
          console.log("sta codes: "+staCodes.join());
          return netArray;
}).then(function(netArray) {
  wp.d3.select("ul.stations")
    .selectAll("li")
    .data(netArray[0].stations)
    .enter()
    .append("li")
    .text(function(d) {
      return d.stationCode
          +" ("+d.latitude+", "+d.longitude+") "
          +d.name;
    });
  return netArray;
}).then(function(netArray) {
  for (let s of netArray[0].stations) {
    let m = L.marker([s.latitude, s.longitude]);
    m.addTo(mymap);
    m.bindTooltip(s.codes());
  }
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
    .data(quakes, function(d) {return d.time;});
  tableData.exit().remove();

  for (const q of quakes) {
    let circle = L.circleMarker([q.latitude, q.longitude], {
      color: 'red',
      fillColor: '#f03',
      fillOpacity: 0.5,
      radius: q.magnitude ? (q.magnitude.mag*5) : 3 // in case no mag
    }).addTo(mymap);
    circle.on('click', function(e) {
        doEventClick(q);
    } );
    circle.bindTooltip(q.time.toISOString()+" "+(q.magnitude ? (q.magnitude.mag+" "+q.magnitude.type) : "unkn"));
  }
  let tr = tableData
    .enter()
    .append("tr");
  tr.append("td")
    .text(function(d) {
      return d.time.toISOString();
      });
  tr.append("td")
    .text(function(d) {
      if (d.magnitude) {
        return d.magnitude.mag+" "
            +d.magnitude.type;
      } else {
        return "unknown";
      }
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
  tr.on("click", doEventClick);
  return quakes;
}, function(request) {
wp.d3.select("div.recentQuakes")
    .append("p")
    .text("Reject: "+request.statusText);
});

let doEventClick = function(d){
console.log("click "+d.time.toISOString());
    wp.d3.select("div.seismograms")
      .selectAll("p")
      .remove();
    wp.d3.select("div.seismograms")
      .selectAll("p")
      .data([d])
      .enter()
      .append("p")
      .text(function(d) {
        let magStr = "unknown";
        if (d.magnitude) {
          magStr = d.magnitude.mag+" "
          +d.magnitude.type;
        }
        return "quake: "
            +d.time.toISOString()+" "
            +magStr+" "
            +"("+d.latitude+", "+d.longitude+") "
            +(d.depth/1000)+"km "
            +d.description;
      });

      RSVP.hash({
          network: networkPromise,
          quake: new fdsnevent.EventQuery()
              .protocol(quakeQuery.protocol())
              .host(quakeQuery.host())
              .eventId(d.eventId)
              .includearrivals(true)
              .query()
              .then(function(qArray) {return qArray[0];})
      }).then(function(hash) {
console.log("quake network Promise then");
        plotSeismograms(wp.d3.select("div.seismograms"),
                     hash.network[0].stations, locCode, chanCode, hash.quake, datahost, protocol);
        return hash;
      });
  };

let plotSeismograms = function(div, stations, loc, chan, quake, host, protocol) {
  div.selectAll('div.myseisplot').remove();
console.log("plot seis");
  console.log("calc start end: "+quake.time+" "+dur+" "+clockOffset);
  for (let s = 0; s<stations.length; s++) {
    plotOneStation(div, stations[s], loc, chan, quake, pOffset, dur, clockOffset, protocol, host);
  }
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
      let PArrival = moment(quake.time).add(firstPS.firstP.time+pOffset, 'seconds');
      let seisDates = wp.calcStartEndDates(PArrival, null, dur, clockOffset);
      let startDate = seisDates.start;
      let endDate = seisDates.end;

      console.log("Start end: "+startDate+" "+endDate);

      let dsQuery = new fdsndataselect.DataSelectQuery()
          .protocol(protocol)
          .host(host)
          .networkCode(mystation.network.networkCode)
          .stationCode(mystation.stationCode)
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
        "dsQuery": dsQuery
      });
    }).then(function(hash) {
        let byChannel = seisplotjs.miniseed.mergeByChannel(hash.dataRecords);
        let keys = Array.from(byChannel.keys());
        console.log("Got "+hash.dataRecords.length+" data records for "+keys.length+" channels");
        for (let key of byChannel.keys()) {
          let segments = byChannel.get(key);
          div.append('p').html('Plot for ' + key);
          let svgdiv = div.append('div').attr('class', 'myseisplot');
          if (segments) {
              let seisConfig = new wp.SeismographConfig();
              let seismogram = new wp.CanvasSeismograph(svgdiv, seisConfig, segments, hash.startDate, hash.endDate);
              let markers = [];
                markers.push({ markertype: 'predicted', name: "origin", time: quake.time });
                markers.push({ markertype: 'predicted', name: hash.firstPS.firstP.phase, time: moment(quake.time).add(hash.firstPS.firstP.time, 'seconds') });
                markers.push({ markertype: 'predicted', name: hash.firstPS.firstS.phase, time: moment(quake.time).add(hash.firstPS.firstS.time, 'seconds') });

              if (quake.arrivals) {
                for ( let aNum=0; aNum < quake.arrivals.length; aNum++) {
                  let arrival = quake.arrivals[aNum];
                  if (arrival && arrival.pick.stationCode == mystation.stationCode) {
                  markers.push({ markertype: 'pick', name: arrival.phase, time: arrival.pick.time });
                  console.log("markers.push({ markertype: 'pick', name: "+arrival.phase+", time: "+arrival.pick.time );
                  }
                }
              }

              seismogram.appendMarkers(markers);
              seismogram.draw();
          } else {
            console.log(`no segments for ${key}`)
          }
        }
        if (keys.length==0){
            div.append('p').html('No data found for '+mystation.codes);
        }
        return hash;
    }).catch(function(e) {
      console.log("catch in ttimes then"+e);
      console.assert(false, e);
      div.append('p').html("Error loading data."+e );
    });
};


// map
let mymap = L.map('mapid').setView([ centerLat, centerLon], mapZoomLevel);
let OpenTopoMap = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
	maxZoom: 17,
	attribution: 'Map data: &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
}).addTo(mymap);
