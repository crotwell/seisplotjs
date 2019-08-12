// @flow
// test radial transverse plotStartDate

// just to get flow working...
//import * as seisplotjs from '../../src/index';

// seisplotjs comes from the seisplotjs standalone bundle
let traveltime = seisplotjs.traveltime;
let fdsnevent = seisplotjs.fdsnevent;
let fdsnstation = seisplotjs.fdsnstation;
let miniseed = seisplotjs.miniseed;
const moment = seisplotjs.moment;
let RSVP = seisplotjs.RSVP;
const d3 = seisplotjs.d3;
const SeismographConfig = seisplotjs.seismographconfig.SeismographConfig;
const SeismogramDisplayData = seisplotjs.seismographconfig.SeismogramDisplayData;
const Seismograph = seisplotjs.seismograph.Seismograph;

let USGS = "earthquake.usgs.gov";
let IRIS = "service.iris.edu";

RSVP.on('error', function(reason) {
  console.assert(false, reason);
});

let daysAgo = 365;
let netCode = 'US';
let staCode = 'LONY';
let locCode = '--';
let chanCode = 'BH?';
let datahost = IRIS;
let quakehost = USGS;
let preOffset = 25;
let dur = 125;

let protocol = 'http:';
if ("https:" == document.location.protocol) {
  protocol = 'https:'
}
console.log("Protocol: "+protocol+"  host: "+quakehost);

let quakeQuery = new fdsnevent.EventQuery()
  .host(quakehost)
  .protocol(protocol)
  .minLat(36).maxLat(37)
  .minLon(-4).maxLon(-3)
  .startTime(moment.utc("2010-04-11T22:08:00.000Z"))
  .endTime(moment.utc("2010-04-11T22:09:00.000Z"));
d3.select("div.recentQuakesUrl")
    .append("p")
    .text("Quakes URL: "+quakeQuery.formURL());

let stationQuery = new fdsnstation.StationQuery()
  .protocol(protocol)
  .networkCode(netCode)
  .stationCode(staCode)
  .channelCode(chanCode);
d3.select("div.recentQuakesUrl")
    .append("p")
    .text("Stations URL: "+stationQuery.formURL(fdsnstation.LEVEL_STATION));

let stationPromise = stationQuery.queryStations().then(function(netArray) {
          let staCodes = [];
          for (let i=0;i<netArray[0].stations.length; i++) {
            staCodes.push(netArray[0].stations[i].stationCode);
          }
          console.log("sta codes: "+staCodes.join());
          return netArray[0].stations[0];
});

let quakePromise = quakeQuery.query().then(function(quakes) {
  let q = quakes[0];
  console.log("quake: "+q.time.toISOString()+" "+q.magnitude.mag+" "
        +q.magnitude.type+" ("+q.latitude+", "+q.longitude+") "
        +(q.depth/1000)+" km ");
  return q;
});

let bothPromise = RSVP.hash({
    station: stationPromise,
    quake: quakePromise
  }).then(function(hash) {
    console.log("quake network Promise then");
    console.log("distaz for "+hash.quake.latitude+" "+ hash.quake.longitude+" "+ hash.station.latitude+" "+hash.station.longitude);
    hash.distaz = seisplotjs.distaz.distaz(hash.station.latitude, hash.station.longitude, hash.quake.latitude, hash.quake.longitude);
    hash.traveltime = new traveltime.TraveltimeQuery()
        .protocol(protocol)
        .evdepth( hash.quake.depth > 0 ? hash.quake.depth/1000 : 0)
        .evlat(hash.quake.latitude).evlon(hash.quake.longitude)
        .stalat(hash.station.latitude).stalon(hash.station.longitude)
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
          return { firstP: firstP, firstS: firstS, arrivals: ttimes.arrivals };
        });
    return RSVP.hash(hash);
  }).then(function(hash) {
    hash.S_arrival = moment.utc(hash.quake.time).add(hash.traveltime.firstS.time,'seconds');
    hash.P_arrival = moment.utc(hash.quake.time).add(hash.traveltime.firstP.time, 'seconds');
    hash.seisDates = new seisplotjs.util.StartEndDuration(moment.utc(hash.S_arrival).subtract(preOffset, 'seconds'), null, dur, 0);
    hash.seismograms = new seisplotjs.fdsndataselect.DataSelectQuery()
      .host(IRIS)
      .nodata(404)
      .networkCode(hash.station.network.networkCode)
      .stationCode(hash.station.stationCode)
      .locationCode(locCode)
      .channelCode(chanCode)
      .startTime(hash.seisDates.startTime)
      .endTime(hash.seisDates.endTime)
      .querySeismograms();
    return RSVP.hash(hash);
  }).then(function(hash) {
    let div = seisplotjs.d3.select("div.seismograms");
    let svgDiv = div.append("div");
    svgDiv.style("position", "relative");
    svgDiv.style("width", "100%");
    svgDiv.style("height", "450px");
    console.log("hash.seismograms size: "+hash.seismograms.size);
    if (hash.seismograms.size > 0) {
      console.log("hash.seismograms "+hash.seismograms.size+" ");
        let seisConfig = new SeismographConfig();
        let markers = [];
        markers.push({ markertype: 'predicted', name: "origin", time: hash.quake.time });
        markers.push({ markertype: 'predicted', name: hash.traveltime.firstP.phase, time: hash.P_arrival });
        markers.push({ markertype: 'predicted', name: hash.traveltime.firstS.phase, time: hash.S_arrival });
        if (hash.quake.arrivals) {
          for ( let aNum=0; aNum < hash.quake.arrivals.length; aNum++) {
            let arrival = hash.quake.arrivals[aNum];
            if (! arrival) {console.log("arrival is undef??? "+aNum); }
            if (arrival && arrival.pick.stationCode == hash.station.stationCode) {
              markers.push({ markertype: 'pick', name: arrival.phase, time: arrival.pick.time });
              console.log("markers.push({ markertype: 'pick', name: "+arrival.phase+", time: "+arrival.pick.time );
            }
          }
        }

        let traceArray = Array.from(hash.seismograms.values());
        traceArray.sort(seisplotjs.plotutil.alphabeticalSort);
        console.log("traceArray: "+traceArray.length+"  "+traceArray[0]+"  "+(typeof traceArray[0]))
        let seisData = traceArray.map( s => {
            let sdd = SeismogramDisplayData.fromSeismogram(s);
            sdd.addQuake(hash.quake);
            sdd.addMarkers(markers);
            return sdd;
          });

        let seismograph = new Seismograph(svgDiv, seisConfig, seisData, hash.seisDates.startTime, hash.seisDates.endTime);
        let titles = [traceArray[0].codes(),
                  traceArray[1].channelCode,
                  traceArray[2].channelCode];
        seisConfig.title = titles;

        seismograph.draw();

        // rotated
        console.log("### Rotated");

        let rotdiv = seisplotjs.d3.select("div.rotatedseismograms");
        let rotsvgDiv = rotdiv.append("div");
        rotsvgDiv.classed("svg-container-wide", true);
        rotsvgDiv.style("position", "relative");
        rotsvgDiv.style("width", "100%");
        rotsvgDiv.style("height", "450px");

        let seisZ = null;
        let seisNorth = null;
        let seisEast = null;
        for (let [key, trace] of hash.seismograms) {
          if (trace.channelCode.charAt(2) === "Z") {
            seisZ = trace;
          }
          if (trace.channelCode.charAt(2) === "N") {
            seisNorth = trace;
          }
          if (trace.channelCode.charAt(2) === "E") {
            seisEast = trace;
          }
        }
        if ( ! seisZ || ! seisNorth || ! seisEast) {
          throw new Error("unable to find ZNE: ${seisZ} ${seisNorth} ${seisEast}");
        }
console.log("rotate to "+hash.distaz.baz+" "+((hash.distaz.baz+180)%360) );
        let rotated = seisplotjs.vector.rotate(seisNorth, 0, seisEast, 90, (hash.distaz.baz+180)%360);
        hash.rotatedSeismograms = [ seisZ, rotated.radial, rotated.transverse ];
        hash.rotatedSeismograms.sort(seisplotjs.plotutil.alphabeticalSort);
console.log("first points: "+seisZ.segments[0].yAtIndex(0)+" "+rotated.radial.segments[0].yAtIndex(0)+" "+rotated.transverse.segments[0].yAtIndex(0))
        let rotSeisConfig = new SeismographConfig();
        let rotData = hash.rotatedSeismograms.map( s => {
            let sdd = SeismogramDisplayData.fromSeismogram(s);
            sdd.addQuake(hash.quake);
            sdd.addMarkers(markers);
            return sdd;
          });
        let rotatedSeismograph = new Seismograph(rotsvgDiv, rotSeisConfig, rotData, hash.seisDates.startTime, hash.seisDates.endTime);
        titles = [hash.rotatedSeismograms[0].codes(),
                  hash.rotatedSeismograms[1].channelCode+" "+rotated.azimuthRadial.toFixed(2),
                  hash.rotatedSeismograms[2].channelCode+" "+rotated.azimuthTransverse.toFixed(2)];
        rotSeisConfig.title = titles;
        rotatedSeismograph.draw();
    } else{
      div.append('p').html('No data found for '+hash.station.codes());
      console.log("hash.seismograms: "+hash.seismograms.size);
    }
  });
