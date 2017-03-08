
console.log("in allServiceTests.js");
var allFdsnTests = function() {

console.log("in outer function of allServiceTests.js");

// seisplotjs comes from the seisplotjs standalone bundle
var d3 = seisplotjs.d3;
var wp = seisplotjs.waveformplot;
var traveltime = seisplotjs.traveltime;
var fdsnevent = seisplotjs.fdsnevent;
var fdsnstation = seisplotjs.fdsnstation;
var fdsndataselect = seisplotjs.fdsndataselect;
var RSVP = fdsnstation.RSVP;


var DS = "fdsnws-dataselect";
var EV = "fdsn-event";
var ST = "fdsn-station";



// all tests should be object with testid, testname and test: function(datacenter, d3selector)

var testEventVersion = {
  testname: "Ev Ver",
  testid: "eventversion",
  test: function(dc) {
    var mythis = this;
    var host = serviceHost(dc, EV);

    var quakeQuery = new fdsnevent.EventQuery()
      .host(host);
    var url = quakeQuery.formVersionURL();
    return quakeQuery.queryVersion().then(function(version) {
      return {
        text: version,
        output: version,
        url: url
      };
    }).catch(function(err) {
      if (! err.url) {err.url = url};
      throw err;
    });
  }
};


var testStationVersion = {
  testname: "Sta Ver",
  testid: "stationversion",
  test: function(dc) {
    var mythis = this;
    var host = serviceHost(dc, ST);

    var query = new fdsnstation.StationQuery()
      .host(host);
    var url = query.formVersionURL();
    return query.queryVersion().then(function(version) {
      return {
        text: version,
        output: version,
        url: url
      };
    }).catch(function(err) {
      if (! err.url) {err.url = url};
      throw err;
    });
  }
};

var testDataSelectVersion = {
  testname: "DS Ver",
  testid: "dataselectversion",
  test: function(dc) {
    var mythis = this;
    var host = serviceHost(dc, ST);

    var query = new fdsndataselect.DataSelectQuery()
      .host(host);
    var url = query.formVersionURL();
    return query.queryVersion().then(function(version) {
      return {
        text: version,
        output: version,
        url: url
      };
    }).catch(function(err) {
      if (! err.url) {err.url = url};
      throw err;
    });
  }
};


var testLastDay = {
  testname: "Last Day",
  testid: "lastday",
  test: function(dc) {
    return new RSVP.Promise(function(resolve, reject) {
    var mythis = this;
    if ( ! doesSupport(dc, EV) ) {
      reject(UNSUPPORTED);
    } else {
      resolve(null);
    }
   }).then(function(val) { 
    var daysAgo = 1;
    var host = serviceHost(dc, EV);
    var quakeQuery = new fdsnevent.EventQuery()
      .host(host)
      .startTime(new Date(new Date().getTime()-86400*daysAgo*1000))
      .endTime(new Date());
    var url = quakeQuery.formURL();
    return quakeQuery.query().then(function(quakes) {
      return {
        text: "Found "+quakes.length+" events.",
        url: url,
        output: quakes
      };
    }).catch(function(err) {
      if (! err.url) {err.url = url};
      throw err;
    });
    });
  }
};

var testCatalogs = {
  testname: "Catalogs",
  testid: "catalogs",
  test: function(dc) {
    return new RSVP.Promise(function(resolve, reject) {
    var mythis = this;
    if ( ! doesSupport(dc, EV) ) {
      reject(UNSUPPORTED);
    } else {
      resolve(null);
    }
   }).then(function(val) {
    var host = serviceHost(dc, EV);
    var quakeQuery = new fdsnevent.EventQuery()
      .host(host);
    var url = quakeQuery.formCatalogsURL();
    return quakeQuery.queryCatalogs().then(function(catalogs) {
      return {
        text: "Found "+catalogs.length+" catalogs.",
        url: url,
        output: catalogs
      };
    }).catch(function(err) {
      if (! err.url) {err.url = url};
      throw err;
    });
    });
  }
};

var testContributors = {
  testname: "Contributors",
  testid: "contributors",
  test: function(dc) {
    return new RSVP.Promise(function(resolve, reject) {
    var mythis = this;
    if ( ! doesSupport(dc, EV) ) {
      reject(UNSUPPORTED);
    } else {
      resolve(null);
    }
   }).then(function(val) {
    var host = serviceHost(dc, EV);
    var quakeQuery = new fdsnevent.EventQuery()
      .host(host);
    var url = quakeQuery.formContributorsURL();
    return quakeQuery.queryContributors().then(function(contributors) {
      return {
        text: "Found "+contributors.length+" contributors.",
        url: url,
        output: contributors
      };
    }).catch(function(err) {
      if (! err.url) {err.url = url};
      throw err;
    });
    });
  }
};

var testNetworks = {
  testname: "Networks",
  testid: "networks",
  test: function(dc) {
    return new RSVP.Promise(function(resolve, reject) {
    var mythis = this;
    if ( ! doesSupport(dc, ST) ) {
      reject(UNSUPPORTED);
    } else {
      resolve(null);
    }
   }).then(function(val) { 
    var mythis = this;
    var host = serviceHost(dc, ST);
   
    var query = new fdsnstation.StationQuery()
      .host(host);
    var sel =d3.select("tr."+dc.id).select("td."+mythis.testid);
    var url = query.formURL(fdsnstation.LEVEL_NETWORK);
    return query.queryNetworks().then(function(networks) {
      return {
        text: "Found "+networks.length+" networks.",
        url: url,
        output: networks
      };
    }).catch(function(err) {
      if (! err.url) {err.url = url};
      throw err;
    });
    });
  }
};

// end test defs

var RUN = "Run";
var UNSUPPORTED = "Unsupported";
var FAIL = "Fail";
var OK = "OK";

function doesSupport(dc, type) {
  var out = dc.supports.find(function(s) { return s.type == type;});
//  if (! out) {
//    console.log("doesSupport "+dc.id+" "+type+" undef");
//  }
  return out;
}

function serviceHost(dc, type) {
  var does = doesSupport(dc, type);
  if (does) {
    return does.host ? does.host : dc.host;
  }
  return null;
}

var tests = {
     fdsnEventTests: [ testEventVersion, testLastDay, testCatalogs, testContributors ],
     fdsnStationTests: [ testStationVersion, testNetworks ],
     fdsnDataTests: [ testDataSelectVersion ]
 }

return tests;
}();
