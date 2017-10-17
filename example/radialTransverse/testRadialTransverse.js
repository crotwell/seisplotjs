
// test radial transverse plotStartDate


// seisplotjs comes from the seisplotjs standalone bundle
var wp = seisplotjs.waveformplot;
var traveltime = seisplotjs.traveltime;
var fdsnevent = seisplotjs.fdsnevent;
var fdsnstation = seisplotjs.fdsnstation;
var miniseed = seisplotjs.miniseed;

var USGS = "earthquake.usgs.gov";
var IRIS = "service.iris.edu";

fdsnstation.RSVP.on('error', function(reason) {
  console.assert(false, reason);
});

var daysAgo = 365;
var netCode = 'US';
var staCode = 'LONY';
var locCode = '--';
var chanCode = 'BH?';
var datahost = IRIS;
var quakehost = USGS;
var preOffset = 5;
var dur = 25;

var protocol = 'http:';
if ("https:" == document.location.protocol) {
  protocol = 'https:'
}
console.log("Protocol: "+protocol+"  host: "+quakehost);

var quakeQuery = new fdsnevent.EventQuery()
  .host(quakehost)
  .protocol(protocol)
  .minLat(36).maxLat(37)
  .minLon(-4).maxLon(-3)
  .startTime(new Date("2010-04-11T22:08:00.000Z"))
  .endTime(new Date("2010-04-11T22:09:00.000Z"));
wp.d3.select("div.recentQuakesUrl")
    .append("p")
    .text("Quakes URL: "+quakeQuery.formURL());

var stationQuery = new fdsnstation.StationQuery()
  .protocol(protocol)
  .networkCode(netCode)
  .stationCode(staCode)
  .channelCode(chanCode);
wp.d3.select("div.recentQuakesUrl")
    .append("p")
    .text("Stations URL: "+stationQuery.formURL(fdsnstation.LEVEL_STATION));

var stationPromise = stationQuery.queryStations().then(function(netArray) {
          staCodes = [];
          for (var i=0;i<netArray[0].stations().length; i++) {
            staCodes.push(netArray[0].stations()[i].stationCode());
          }
          console.log("sta codes: "+staCodes.join());
          return netArray[0].stations()[0];
});

var quakePromise = quakeQuery.query().then(function(quakes) {
  var q = quakes[0];
  console.log("quake: "+q.time().toISOString()+" "+q.magnitude().mag()+" "
        +q.magnitude().type()+" ("+q.latitude()+", "+q.longitude()+") "
        +(q.depth()/1000)+" km ");
  return q;
});

var bothPromise = fdsnstation.RSVP.hash({
    station: stationPromise,
    quake: quakePromise
  }).then(function(hash) {
    console.log("quake network Promise then");
    console.log("distaz for "+hash.quake.latitude()+" "+ hash.quake.longitude()+" "+ hash.station.latitude()+" "+hash.station.longitude());
    hash.distaz = seisplotjs.distaz.distaz(hash.station.latitude(), hash.station.longitude(), hash.quake.latitude(), hash.quake.longitude());
    hash.traveltime = new traveltime.TraveltimeQuery()
        .protocol(protocol)
        .evdepth( hash.quake.depth() > 0 ? hash.quake.depth()/1000 : 0)
        .evlat(hash.quake.latitude()).evlon(hash.quake.longitude())
        .stalat(hash.station.latitude()).stalon(hash.station.longitude())
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
          return { firstP: firstP, firstS: firstS, arrivals: ttimes.arrivals };
        });
    return fdsnstation.RSVP.hash(hash);
  }).then(function(hash) {
    hash.S_arrival = new Date(hash.quake.time().getTime()+(hash.traveltime.firstS.time)*1000);
    hash.P_arrival = new Date(hash.quake.time().getTime()+(hash.traveltime.firstP.time)*1000);
    hash.seisDates = wp.calcStartEndDates(new Date(hash.S_arrival.getTime()-preOffset*1000), null, dur, 0);
    hash.miniseed = new seisplotjs.fdsndataselect.DataSelectQuery()
      .host(IRIS)
      .nodata(404)
      .networkCode(hash.station.network().networkCode())
      .stationCode(hash.station.stationCode())
      .locationCode(locCode)
      .channelCode(chanCode)
      .startTime(hash.seisDates.start)
      .endTime(hash.seisDates.end)
      .query();
    return fdsnstation.RSVP.hash(hash);
  }).then(function(hash) {

    let byChannel = miniseed.byChannel(hash.miniseed);
    let keys = Array.from(byChannel.keys());
    console.log("keys: "+keys);
    hash.seismograms = [];
    for(let i=0; i<keys.length; i++) {
      let key = keys[i];
      hash.seismograms.push(miniseed.merge(byChannel.get(key)));
    }
    return fdsnstation.RSVP.hash(hash);
  }).then(function(hash) {
    let div = seisplotjs.d3.select("div.seismograms");
    let svgDiv = div.append("div");
    svgDiv.classed("svg-container-wide", true);
    if (hash.seismograms.length > 0) {
      console.log("hash.seismograms "+hash.seismograms.length+" "+hash.seismograms[0].length);
        var seismograph = new wp.Seismograph(svgDiv, hash.seismograms, hash.seisDates.start, hash.seisDates.end);
        titles = [hash.seismograms[0][0].codes(),
                  hash.seismograms[1][0].chanCode(),
                  hash.seismograms[2][0].chanCode()];
        seismograph.setTitle(titles);
        var markers = [];
          markers.push({ markertype: 'predicted', name: "origin", time: hash.quake.time() });
          markers.push({ markertype: 'predicted', name: hash.traveltime.firstP.phase, time: hash.P_arrival });
          markers.push({ markertype: 'predicted', name: hash.traveltime.firstS.phase, time: hash.S_arrival });

        if (hash.quake.arrivals()) {
          for ( let aNum=0; aNum < hash.quake.arrivals().length; aNum++) {
            let arrival = hash.quake.arrivals()[aNum];
            if (! arrival) {console.log("arrival is undef??? "+aNum); }
            if (arrival && arrival.pick().stationCode() == mystation.stationCode()) {
              markers.push({ markertype: 'pick', name: arrival.phase(), time: arrival.pick().time() });
              console.log("markers.push({ markertype: 'pick', name: "+arrival.phase()+", time: "+arrival.pick().time() );
            }
          }
        }
        seismograph.appendMarkers(markers);
        seismograph.draw();

        // rotated
        console.log("### Rotated");

        let rotdiv = seisplotjs.d3.select("div.rotatedseismograms");
        let rotsvgDiv = rotdiv.append("div");
        rotsvgDiv.classed("svg-container-wide", true);

        var seisZ = null;
        var seisNorth = null;
        var seisEast = null;
        for (var i = 0; i < hash.seismograms.length; i++) {
          if (hash.seismograms[i][0].chanCode().charAt(2) === "Z") {
            seisZ = hash.seismograms[i];
          }
          if (hash.seismograms[i][0].chanCode().charAt(2) === "N") {
            seisNorth = hash.seismograms[i];
          }
          if (hash.seismograms[i][0].chanCode().charAt(2) === "E") {
            seisEast = hash.seismograms[i];
          }
        }
        if ( ! seisZ || ! seisNorth || ! seisEast) {
          throw new Error("unable to find ZNE: "+seisZ+" "+seisNorth+" "+seisEast);
        }
console.log("rotate to "+hash.distaz.baz+" "+((hash.distaz.baz+180)%360) );
        var rotated = seisplotjs.filter.rotate(seisNorth[0], 0, seisEast[0], 90, (hash.distaz.baz+180)%360);
        hash.rotatedSeismograms = [seisZ, [rotated.radial], [rotated.transverse]];
console.log("first points: "+seisZ[0].yAtIndex(0)+" "+rotated.radial.yAtIndex(0)+" "+rotated.transverse.yAtIndex(0))
        var rotatedSeismograph = new wp.Seismograph(rotsvgDiv, hash.rotatedSeismograms, hash.seisDates.start, hash.seisDates.end);
        titles = [hash.rotatedSeismograms[0][0].codes(),
                  hash.rotatedSeismograms[1][0].chanCode()+" "+rotated.azimuthRadial,
                  hash.rotatedSeismograms[2][0].chanCode()+" "+rotated.azimuthTransverse];
        rotatedSeismograph.setTitle(titles);
        var rotateMarkers = [];
          rotateMarkers.push({ markertype: 'predicted', name: "origin", time: hash.quake.time() });
          rotateMarkers.push({ markertype: 'predicted', name: hash.traveltime.firstP.phase, time: hash.P_arrival });
          rotateMarkers.push({ markertype: 'predicted', name: hash.traveltime.firstS.phase, time: hash.S_arrival });

        if (hash.quake.arrivals()) {
          for ( let aNum=0; aNum < hash.quake.arrivals().length; aNum++) {
            let arrival = hash.quake.arrivals()[aNum];
            if (! arrival) {console.log("arrival is undef??? "+aNum); }
            if (arrival && arrival.pick().stationCode() == mystation.stationCode()) {
            rotateMarkers.push({ markertype: 'pick', name: arrival.phase(), time: arrival.pick().time() });
            console.log("rotateMarkers.push({ markertype: 'pick', name: "+arrival.phase()+", time: "+arrival.pick().time() );
            }
          }
        }
        rotatedSeismograph.appendMarkers(rotateMarkers);
        rotatedSeismograph.draw();
    } else{
      div.append('p').html('No data found for '+hash.station.codes());
    }
  });
