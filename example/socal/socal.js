

// seisplotjs comes from the seisplotjs bundle
var wp = seisplotjs.waveformplot
var traveltime = seisplotjs.traveltime
var fdsnevent = seisplotjs.fdsnevent
var fdsnstation = seisplotjs.fdsnstation

fdsnstation.RSVP.on('error', function(reason) {
  console.assert(false, reason);
});

var daysAgo = 1;
var netCode = 'CI';
var staCodes = 'BAR,BBR,BBS,BC3';
var chanCode = 'HHZ';
var HOST = 'service.scedc.caltech.edu';

var protocol = 'http:';
if ("https:" == document.location.protocol) {
  protocol = 'https:'
}

var quakeQuery = new fdsnevent.EventQuery()
  .protocol(protocol)
  .host(HOST)
  .minLat(32).maxLat(35)
  .minLon(-124).maxLon(-115)
  .startTime(new Date(new Date().getTime()-86400*daysAgo*1000))
  .endTime(new Date());
wp.d3.select("div.recentQuakesUrl")
    .append("p")
    .text("Quakes URL: "+quakeQuery.formURL());

var stationQuery = new fdsnstation.StationQuery()
  .protocol(protocol)
  .host(HOST)
  .networkCode(netCode)
  .stationCode(staCodes)
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

  var tr = tableData
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

var plotSeismograms = function(div, stations, loc, chan, quake, dataHost, protocol) {
  div.selectAll('div.myseisplot').remove();
console.log("plot seis");
  var dur = 300;
  var pOffset = -120;
  var clockOffset = 0; // set this from server somehow!!!!
  console.log("calc start end: "+quake.time().toISOString()+" "+dur+" "+clockOffset);
  for (var s = 0; s<stations.length; s++) {
    plotOneStation(div, stations[s], loc, chan, quake, pOffset, dur, clockOffset, protocol, dataHost);
  }
}

var plotOneStation = function(div, mystation, loc, chan, quake, pOffset, dur, clockOffset, protocol, host) {
console.log("plotOneStation: "+mystation.codes());
    new traveltime.TraveltimeQuery()
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
    var PArrival = new Date(quake.time().getTime()+(firstPS.firstP.time+pOffset)*1000);
    var seisDates = wp.calcStartEndDates(PArrival, null, dur, clockOffset);
    var startDate = seisDates.start;
    var endDate = seisDates.end;

    console.log("Start end: "+startDate.toISOString()+" "+endDate.toISOString());
    var url = wp.formRequestUrl(protocol, host, mystation.network().networkCode(), mystation.stationCode(), loc, chan, startDate, endDate);
    console.log("Data request: "+url);
    wp.loadParse(url, function (error, dataRecords) {
      if (error) {
console.log("error from loadParse: "+error);
        div.append('p').html("Error loading data." );
      } else {
          var byChannel = wp.miniseed.byChannel(dataRecords);
          var keys = Object.keys(byChannel);
          for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var segments = wp.miniseed.merge(byChannel[key]);
            div.append('p').html('Plot for ' + key);
            var svgdiv = div.append('div').attr('class', 'myseisplot');
            if (segments.length > 0) {
                var seismogram = new wp.chart(svgdiv, segments, startDate, endDate);
                var markers = [];
                  markers.push({ markertype: 'predicted', name: "origin", time: quake.time() });
                  markers.push({ markertype: 'predicted', name: firstPS.firstP.phase, time: new Date(quake.time().getTime()+(firstPS.firstP.time)*1000) });
                  markers.push({ markertype: 'predicted', name: firstPS.firstS.phase, time: new Date(quake.time().getTime()+(firstPS.firstS.time)*1000) });
                
                if (quake.arrivals()) {
                  for ( let aNum=0; aNum < quake.arrivals().length; aNum++) {
                    let arrival = quake.arrivals()[aNum];
if (! arrival) {console.log("arrival is undef??? "+aNum); }
                    if (arrival && arrival.pick().stationCode() == mystation.stationCode()) {
                    markers.push({ markertype: 'pick', name: arrival.phase(), time: arrival.pick().time() });
                    console.log("markers.push({ markertype: 'pick', name: "+arrival.phase()+", time: "+arrival.pick().time().toISOString() );
                    }
                  }
                }
/*
                for (var m=0;m<ttimes.arrivals.length; m++) {
                  markers.push({ name: ttimes.arrivals[m].phase, time: new Date(quake.time().getTime()+(ttimes.arrivals[m].time)*1000) });
                }
*/
                seismogram.appendMarkers(markers);
                seismogram.draw();
            }
        }
        if (keys.length==0){
            div.append('p').html('No data found for '+mystation.codes());
        }
      }
    });
    return firstPS;
    }).catch(function(e) {
console.log("catch in ttimes then"+e);
    });
};
