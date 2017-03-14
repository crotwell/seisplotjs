
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
  testname: "Event Version",
  testid: "eventversion",
  description: "Queries the version of the service, success as long as the query returns something",
  webservices: [ 'EV' ],
  test: function(dc) {
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
      if (! err.url) {err.url = url;}
      throw err;
    });
  }
};


var testStationVersion = {
  testname: "Station Version",
  testid: "stationversion",
  description: "Queries the version of the service, success as long as the query returns something",
  webservices: [ 'ST' ],
  test: function(dc) {
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
      if (! err.url) {err.url = url;}
      throw err;
    });
  }
};

var testDataSelectVersion = {
  testname: "DataSelect Version",
  testid: "dataselectversion",
  description: "Queries the version of the service, success as long as the query returns something",
  webservices: [ 'DS' ],
  test: function(dc) {
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
      if (! err.url) {err.url = url;}
      throw err;
    });
  }
};


var testLastDay = {
  testname: "Last Day",
  testid: "lastday",
  description: "Queries for events in the past 24 hours",
  webservices: [ 'EV' ],
  test: function(dc) {
    return new RSVP.Promise(function(resolve, reject) {
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
        text: "Found "+quakes.length,
        url: url,
        output: quakes
      };
    }).catch(function(err) {
      if (! err.url) {err.url = url;}
      throw err;
    });
    });
  }
};



var testEventFromPublicID = {
  testname: "eventid=publicID",
  testid: "eventid_publicid",
  description: "Queries events in the past 24 hours, then tries to make an eventid= query for the first event using its entire publicID with no modification. This allows a client to do a general then specific query style.",
  webservices: [ 'EV' ],
  test: function(dc) {
    return new RSVP.Promise(function(resolve, reject) {
      if ( ! doesSupport(dc, EV) ) {
        reject(UNSUPPORTED);
      } else {
        resolve(null);
      }
   }).then(function(val) {
    var daysAgo = .5;
    var host = serviceHost(dc, EV);
    var quakeQuery = new fdsnevent.EventQuery()
      .host(host)
      .startTime(new Date(new Date().getTime()-86400*daysAgo*1000))
      .endTime(new Date());
    var url = quakeQuery.formURL();
    return quakeQuery.query().then(function(quakes) {
        if (quakes.length == 0) {
          throw new Error("No quakes returned");
        }
        var singleQuakeQuery = new fdsnevent.EventQuery()
          .host(host)
          .eventid(encodeURIComponent(quakes[0].publicID));
        url = singleQuakeQuery.formURL();
        return singleQuakeQuery.query();
      }).then(function(singleQuake) {
      return {
        text: "Found "+singleQuake.time(),
        url: url,
        output: singleQuake
      };
    }).catch(function(err) {
      if (! err.url) {err.url = url;}
      throw err;
    });
    });
  }
};

var testEventFromBestGuessEventId = {
  testname: "Best Guess EventId",
  testid: "guesseventid",
  description: "Queries events in the past 24 hours, then tries to make an eventid= query for the first event using a huristic to determine the eventid. This allows a client to do a general then specific query style, but with more effort than eventid=publicID as the client must guess the value for eventid in the specific query. This is also fragile as the huristic must be updated for each new server.",
  webservices: [ 'EV' ],
  test: function(dc) {
    return new RSVP.Promise(function(resolve, reject) {
      if ( ! doesSupport(dc, EV) ) {
        reject(UNSUPPORTED);
      } else {
        resolve(null);
      }
   }).then(function(val) {
    var daysAgo = .5;
    var host = serviceHost(dc, EV);
    var quakeQuery = new fdsnevent.EventQuery()
      .host(host)
      .startTime(new Date(new Date().getTime()-86400*daysAgo*1000))
      .endTime(new Date());
    var url = quakeQuery.formURL();
    return quakeQuery.query().then(function(quakes) {
        if (quakes.length == 0) {
          throw new Error("No quakes returned");
        }
        var singleQuakeQuery = new fdsnevent.EventQuery()
          .host(host)
          .eventid(encodeURIComponent(quakes[0].eventid));
        return singleQuakeQuery.query();
      }).then(function(quakes) {
      return {
        text: "Found "+quakes.length,
        url: url,
        output: quakes
      };
    }).catch(function(err) {
      if (! err.url) {err.url = url;}
      throw err;
    });
    });
  }
};

var testCatalogs = {
  testname: "Catalogs",
  testid: "catalogs",
  description: "Queries the list of catalogs of the event service, success as long as the query returns something",
  webservices: [ 'EV' ],
  test: function(dc) {
    return new RSVP.Promise(function(resolve, reject) {
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
        text: "Found "+catalogs.length,
        url: url,
        output: catalogs
      };
    }).catch(function(err) {
      if (! err.url) {err.url = url;}
      throw err;
    });
    });
  }
};

var testContributors = {
  testname: "Contributors",
  testid: "contributors",
  description: "Queries the list of contributors of the event service, success as long as the query returns something",
  webservices: [ 'EV' ],
  test: function(dc) {
    return new RSVP.Promise(function(resolve, reject) {
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
        text: "Found "+contributors.length,
        url: url,
        output: contributors
      };
    }).catch(function(err) {
      if (! err.url) {err.url = url;}
      throw err;
    });
    });
  }
};

var testNetworks = {
  testname: "Networks",
  testid: "networks",
  description: "Queries for all networks, success as long as the query returns something, even an empty result.",
  webservices: [ 'ST' ],
  test: function(dc) {
    return new RSVP.Promise(function(resolve, reject) {
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
        text: "Found "+networks.length,
        url: url,
        output: networks
      };
    }).catch(function(err) {
      if (! err.url) {err.url = url;}
      throw err;
    });
    });
  }
};

function randomNetwork(dc, startTime) {
  var host = serviceHost(dc, ST);
  var query = new fdsnstation.StationQuery()
      .host(host);
  if (startTime) {
    query.startTime(startTime);
  }
  return query.queryNetworks().then(function(networks) {
    if (networks.lengh == 0) {
      var err = new Error("No networks");
      err.url = query.formURL();
      throw err;
    }
    // got some nets
    var i = Math.floor(Math.random()*networks.length);
    var net = networks[i];
    net.url = query.formURL(fdsnstation.LEVEL_NETWORK);
    return net;
  });
}


function randomStation(dc, netCode, startTime) {
  var host = serviceHost(dc, ST);
  var query = new fdsnstation.StationQuery()
      .host(host)
      .networkCode(netCode);
  if (startTime) {
    query.startTime(startTime);
  }
  return query.queryStations().then(function(networks) {
    if (networks.length == 0) {
      var err = new Error("No networks");
      err.url = query.formURL();
      throw err;
    }
    if (networks[0].stations().length == 0) {
      var err = new Error("No networks");
      err.url = query.formURL();
      throw err;
    }
    // got some stations in first net
    var i = Math.floor(Math.random()*networks[0].stations().length);
    var sta = networks[0].stations()[i];
    sta.url = query.formURL(fdsnstation.LEVEL_STATION);
    return sta;
  });
}



var testStations = {
  testname: "Stations",
  testid: "stations",
  description: "Queries for stations within a random network returned from all networks, success as long as the query returns something, even an empty result.",
  webservices: [ 'ST' ],
  test: function(dc) {
    return new RSVP.Promise(function(resolve, reject) {
      if ( ! doesSupport(dc, ST) ) {
        reject(UNSUPPORTED);
      } else {
        resolve(null);
      }
    }).then(function(val) {
      var mythis = this;
      var host = serviceHost(dc, ST);
      return randomNetwork(dc);
    }).then(function(net) {
      return randomStation(dc, net.networkCode());
    }).then(function(sta) {
      return {
        text: "Found "+sta.stationCode(),
        url: sta.url,
        output: sta
      };
    });
  }
};

var testDataSelectRecent = {
  testname: "Recent Data",
  testid: "recentData",
  description: "Attempts to make a dataselect query by first querying for networks, then stations within the a random network and then using a random station to request the last 300 seconds for a BHZ channel. Success as long as the query returns, even with an empty result.",
  webservices: [ 'ST', 'DS' ],
  test: function(dc) {
    return new RSVP.Promise(function(resolve, reject) {
    if ( ! doesSupport(dc, DS) || ! doesSupport(dc, ST) ) {
      reject(UNSUPPORTED);
    } else {
      resolve(null);
    }
   }).then(function(val) {
    return randomNetwork(dc, new Date());
   }).then(function(net) {
     return randomStation(dc, net.networkCode(), new Date());
   }).then(function(station) {
    var host = serviceHost(dc, DS);

    var query = new fdsndataselect.DataSelectQuery()
      .host(host);
    var url = query
      .networkCode(station.network().networkCode())
      .stationCode(station.stationCode())
      .channelCode("SHZ,BHZ")
      .computeStartEnd(null, new Date(), 300, 0)
      .formURL(fdsnstation.LEVEL_NETWORK);
    return query.query().then(function(miniseed) {
      return {
        text: "Found "+miniseed.length,
        url: url,
        output: miniseed
      };
    }).catch(function(err) {
      if (! err.url) {err.url = url;}
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
     fdsnEventTests: [ testEventVersion, testLastDay, testCatalogs, testContributors, testEventFromBestGuessEventId, testEventFromPublicID ],
     fdsnStationTests: [ testStationVersion, testNetworks, testStations ],
     fdsnDataTests: [ testDataSelectVersion, testDataSelectRecent ]
 };

var notVersionTest = {
     fdsnEventTests: tests.fdsnEventTests.filter(function(d) {
         return d.testid.indexOf("version") === -1;
     }),
     fdsnStationTests: tests.fdsnStationTests.filter(function(d) {
         return d.testid.indexOf("version") === -1;
     }),
     fdsnDataTests: tests.fdsnDataTests.filter(function(d) {
         return d.testid.indexOf("version") === -1;
     })
 };
var justOneTest = {
     fdsnEventTests: [ ],
     fdsnStationTests: [ ],
     fdsnDataTests: [ testDataSelectRecent]
};
var justVersionTest = {
     fdsnEventTests: [ testEventVersion ],
     fdsnStationTests: [ testStationVersion ],
     fdsnDataTests: [ testDataSelectVersion ]
};

var out = notVersionTest;
//var out = justVersionTest;
//var out = justOneTest;
//var out = tests;
// util functions
out.serviceHost = serviceHost;
out.doesSupport = doesSupport;
return out;
}();
