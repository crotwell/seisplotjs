

// seisplotjs comes from the seisplotjs standalone bundle
var wp = seisplotjs.waveformplot;
var traveltime = seisplotjs.traveltime;
var fdsnevent = seisplotjs.fdsnevent;
var fdsnstation = seisplotjs.fdsnstation;
var fdsndataselect = seisplotjs.fdsndataselect;
var moment = fdsnevent.moment;
var RSVP = fdsnstation.RSVP;

var USGS = "earthquake.usgs.gov";
var IRIS = "service.iris.edu";

fdsnstation.RSVP.on('error', function(reason) {
  console.assert(false, reason);
});

var daysAgo = 365;
var netCode = 'CO';
var locCode = '00';
var chanCode = 'HHZ';
var datahost = IRIS;
var quakehost = USGS;
var minLat = 31;
var maxLat = 36;
var minLon = -84;
var maxLon = -79;
var centerLat = (minLat+maxLat)/2;
var centerLon = (minLon+maxLon)/2;
var mapZoomLevel = 7;

var dur = 300;
var pOffset = -120;
var clockOffset = 0; // set this from server somehow!!!!

var protocol = 'http:';
if ("https:" == document.location.protocol) {
  protocol = 'https:'
}
console.log("Protocol: "+protocol+"  host: "+quakehost);

var quakeQuery = new fdsnevent.EventQuery()
  .host(quakehost)
  .protocol(protocol)
  .minLat(minLat).maxLat(maxLat)
  .minLon(minLon).maxLon(maxLon)
  .startTime(moment.utc().subtract(daysAgo, 'days'))
  .endTime(moment.utc());
wp.d3.select("div.recentQuakesUrl")
    .append("p")
    .text("Quakes URL: "+quakeQuery.formURL());

var stationQuery = new fdsnstation.StationQuery()
  .protocol(protocol)
  .networkCode(netCode)
  .minLat(minLat).maxLat(maxLat)
  .minLon(minLon).maxLon(maxLon)
  .channelCode(chanCode);
wp.d3.select("div.recentQuakesUrl")
    .append("p")
    .text("Stations URL: "+stationQuery.formURL(fdsnstation.LEVEL_STATION));
var networkPromise = stationQuery.queryStations().then(function(netArray) {
          staCodes = [];
          for (var i=0;i<netArray[0].stations().length; i++) {
            staCodes.push(netArray[0].stations()[i].stationCode());
          }
          console.log("sta codes: "+staCodes.join());
          return netArray;
}).then(function(netArray) {
  wp.d3.select("ul.stations")
    .selectAll("li")
    .data(netArray[0].stations())
    .enter()
    .append("li")
    .text(function(d) {
      return d.stationCode()
          +" ("+d.latitude()+", "+d.longitude()+") "
          +d.name();
    });
  return netArray;
}).then(function(netArray) {
  for (let s of netArray[0].stations()) {
    let m = L.marker([s.latitude(), s.longitude()]);
    m.addTo(mymap);
    m.bindTooltip(s.codes());
  }
  return netArray;
});

quakeQuery.query().then(function(quakes) {
  var table = wp.d3.select("div.recentQuakes")
    .select("table");
  if ( table.empty()) {
    table = wp.d3.select("div.recentQuakes")
      .append("table");
    var th = table.append("thead").append("tr");
    th.append("th").text("Time");
    th.append("th").text("Mag");
    th.append("th").text("Lat,Lon");
    th.append("th").text("Depth");
    th.append("th").text("Decription");
    table.append("tbody");
  }
  var tableData = table.select("tbody")
    .selectAll("tr")
    .data(quakes, function(d) {return d.time();});
  tableData.exit().remove();

  for (const q of quakes) {
    let circle = L.circleMarker([q.latitude(), q.longitude()], {
      color: 'red',
      fillColor: '#f03',
      fillOpacity: 0.5,
      radius: q.magnitude() ? (q.magnitude().mag()*5) : 3 // in case no mag
    }).addTo(mymap);
    circle.on('click', function(e) {
        doEventClick(q);
    } );
    circle.bindTooltip(q.time().toISOString()+" "+(q.magnitude() ? (q.magnitude().mag()+" "+q.magnitude().type()) : "unkn"));
  }
  var tr = tableData
    .enter()
    .append("tr");
  tr.append("td")
    .text(function(d) {
      return d.time().toISOString();
      });
  tr.append("td")
    .text(function(d) {
      if (d.magnitude()) {
        return d.magnitude().mag()+" "
            +d.magnitude().type();
      } else {
        return "unknown";
      }
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
  tr.on("click", doEventClick);
  return quakes;
}, function(request) {
wp.d3.select("div.recentQuakes")
    .append("p")
    .text("Reject: "+request.statusText);
});

var doEventClick = function(d){
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
        let magStr = "unknown";
        if (d.magnitude()) {
          magStr = d.magnitude().mag()+" "
          +d.magnitude().type();
        }
        return "quake: "
            +d.time().toISOString()+" "
            +magStr+" "
            +"("+d.latitude()+", "+d.longitude()+") "
            +(d.depth()/1000)+"km "
            +d.description();
      });

      fdsnstation.RSVP.hash({
          network: networkPromise,
          quake: new fdsnevent.EventQuery()
              .protocol(quakeQuery.protocol())
              .host(quakeQuery.host())
              .eventid(d.eventid())
              .includearrivals(true)
              .query()
              .then(function(qArray) {return qArray[0];})
      }).then(function(hash) {
console.log("quake network Promise then");
        plotSeismograms(wp.d3.select("div.seismograms"),
                     hash.network[0].stations(), locCode, chanCode, hash.quake, datahost, protocol);
        return hash;
      });
  };

var plotSeismograms = function(div, stations, loc, chan, quake, host, protocol) {
  div.selectAll('div.myseisplot').remove();
console.log("plot seis");
  console.log("calc start end: "+quake.time()+" "+dur+" "+clockOffset);
  for (var s = 0; s<stations.length; s++) {
    plotOneStation(div, stations[s], loc, chan, quake, pOffset, dur, clockOffset, protocol, host);
  }
}

var plotOneStation = function(div, mystation, loc, chan, quake, pOffset, dur, clockOffset, protocol, host) {
  console.log("plotOneStation: "+mystation.codes());
  return new traveltime.TraveltimeQuery()
      .protocol(protocol)
      .evdepth( quake.depth() > 0 ? quake.depth()/1000 : 0)
      .evlat(quake.latitude()).evlon(quake.longitude())
      .stalat(mystation.latitude()).stalon(mystation.longitude())
      .phases('p,P,PKP,PKIKP,Pdiff,s,S,Sdiff,PKP,SKS,SKIKS')
      .query()
      .then(function(ttimes) {
      var firstP = null;
      var firstS = null;
      for (var p=0; p<ttimes.arrivals.length; p++) {
        if ((ttimes.arrivals[p].phase.startsWith('P') || ttimes.arrivals[p].phase.startsWith('p')) && ( ! firstP || firstP.time > ttimes.arrivals[p])) {
          firstP = ttimes.arrivals[p];
        }
        if ((ttimes.arrivals[p].phase.startsWith('S') || ttimes.arrivals[p].phase.startsWith('s')) && ( ! firstS || firstS.time > ttimes.arrivals[p])) {
          firstS = ttimes.arrivals[p];
        }
      }
      return { firstP: firstP, firstS: firstS };
    }).then(function(firstPS) {
      var PArrival = moment(quake.time()).add(firstPS.firstP.time+pOffset, 'seconds');
      var seisDates = wp.calcStartEndDates(PArrival, null, dur, clockOffset);
      var startDate = seisDates.start;
      var endDate = seisDates.end;

      console.log("Start end: "+startDate+" "+endDate);

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
        "dsQuery": dsQuery
      });
    }).then(function(hash) {
        var byChannel = wp.miniseed.byChannel(hash.dataRecords);
        var keys = Array.from(byChannel.keys());
        console.log("Got "+hash.dataRecords.length+" data records for "+keys.length+" channels");
        for (var key of byChannel.keys()) {
          var segments = wp.miniseed.merge(byChannel.get(key));
          div.append('p').html('Plot for ' + key);
          var svgdiv = div.append('div').attr('class', 'myseisplot');
          if (segments.length > 0) {
              var seismogram = new wp.Seismograph(svgdiv, segments, hash.startDate, hash.endDate);
              var markers = [];
                markers.push({ markertype: 'predicted', name: "origin", time: quake.time() });
                markers.push({ markertype: 'predicted', name: hash.firstPS.firstP.phase, time: moment(quake.time()).add(hash.firstPS.firstP.time, 'seconds') });
                markers.push({ markertype: 'predicted', name: hash.firstPS.firstS.phase, time: moment(quake.time()).add(hash.firstPS.firstS.time, 'seconds') });

              if (quake.arrivals()) {
                for ( let aNum=0; aNum < quake.arrivals().length; aNum++) {
                  let arrival = quake.arrivals()[aNum];
                  if (arrival && arrival.pick().stationCode() == mystation.stationCode()) {
                  markers.push({ markertype: 'pick', name: arrival.phase(), time: arrival.pick().time() });
                  console.log("markers.push({ markertype: 'pick', name: "+arrival.phase()+", time: "+arrival.pick().time() );
                  }
                }
              }

              seismogram.appendMarkers(markers);
              seismogram.draw();
          }
        }
        if (keys.length==0){
            div.append('p').html('No data found for '+mystation.codes());
        }
        return hash;
    }).catch(function(e) {
      console.log("catch in ttimes then"+e);
      console.assert(false, e);
      div.append('p').html("Error loading data."+e );
    });
};


// map
var mymap = L.map('mapid').setView([ centerLat, centerLon], mapZoomLevel);
var OpenTopoMap = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
	maxZoom: 17,
	attribution: 'Map data: &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
}).addTo(mymap);
