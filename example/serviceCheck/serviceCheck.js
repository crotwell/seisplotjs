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

function runTestOnDC(test, dc, DCType) {
  if ( ! doesSupport(dc, DCType) ) {
    return new RSVP.Promise(function(resolve, reject) {
      resolve( {
        text: UNSUPPORTED,
        url: "none"
      });
    });
  }
  var mytest = test;
  // dc type is supported
  return new RSVP.Promise(function(resolve, reject) {
    resolve( {
        text: "",
        url: "none"
      });
  }).then(function(val) {
     // run test and package up result
console.log("run "+test.testname+" on "+dc.id+" "+DCType);
     return test.test(dc)
       .then(function(result) {
         var out = {
           text: "ok",
           test: test,
           dc: dc,
           output: "",
           result: result
         };
         if (result.text) {
           out.text = result.text;
         }
         if (result.url) {
           out.url = result.url;
         }
         if (result.output) {
           out.output = result.output;
         }
         return out;
       });
  }).then(function(testOut) {
      console.log(dc.host+" "+test.testname+" is ok "+testOut);
      console.log(dc.host+" "+test.testname+" is ok "+testOut.text);
      var sel = d3.select("tr."+dc.id).select("td."+test.testid);
      sel.selectAll("*").remove();
      sel.append("a").attr("class", "success").attr("href", testOut.url).text(testOut.text);
      return testOut;
  }).catch(function(err) {
console.log("catch "+test.testname+" on "+dc.id+" "+DCType);
      var sel = d3.select("tr."+dc.id).select("td."+test.testid);
      sel.selectAll("*").remove();
      if (err === UNSUPPORTED) {
         console.log("test "+test.testname+" on "+dc.id+" "+DCType+" unsupported.");
      } else {
        console.assert(false, err);
        if (err.url) {
          sel.append("a").attr("class", "fail").attr("href", err.url).text("FAIL").attr("title", err.status+" "+ err.statusText);
        } else {
console.log("error with no URL", err);
          sel.append("p").text("FAIL").attr("title", ""+err);
        }
      }
      //return err;
  });
}

var fdsnEventTests = [ testEventVersion, testLastDay, testCatalogs, testContributors ];
var fdsnStationTests = [ testStationVersion, testNetworks ];
var fdsnDataTests = [ testDataSelectVersion ];

d3.json('fdsnDataCenters.json', function(fdsn) {
  var table = d3.select(".results").select("table");
  if ( table.empty()) {
    table = d3.select(".results").append("table");
    var thr = table.append("thead").append("tr");
    thr.append("th").text("Name");
    thr.append("th").text("Event");
    fdsnEventTests.forEach(function(test) {
      thr.append("th").text(test.testname);
    });
    thr.append("th").text("Station");
    fdsnStationTests.forEach(function(test) {
      thr.append("th").text(test.testname);
    });
    thr.append("th").text("DataSelect");
    fdsnDataTests.forEach(function(test) {
      thr.append("th").text(test.testname);
    });
    table.append("tbody");
  }
  var tableData = table.select("tbody")
    .selectAll("tr")
    .data(fdsn.datacenters);
  tableData.exit().remove();

  var tr = tableData.enter().append("tr").attr("class", function(dc) {return dc.id;});
  
  tr.append("td")
    .append("a").attr("href", function(d) {
      if (d.website) {
        return d.website;
      } else {
        return "http://"+d.host;
      }
    }).html(function(d) {
      return d.name;
    });
  tr.append("td")
    .text(function(d) {
      if ( doesSupport(d, EV)) {
        return "Yes";
      } else {
        return "No";
      }
    });
  fdsnEventTests.forEach(function(test) {
    tr.append("td").attr("class", test.testid).text(" ");
  });
  tr.append("td")
    .text(function(d) {
      if ( doesSupport(d, ST)) {
        return "Yes";
      } else {
        return "No";
      }
    });
  fdsnStationTests.forEach(function(test) {
    tr.append("td").attr("class", test.testid).text(" ");
  });
  tr.append("td")
    .text(function(d) {
      if ( doesSupport(d, DS)) {
        return "Yes";
      } else {
        return "No";
      }
    });
  fdsnDataTests.forEach(function(test) {
    tr.append("td").attr("class", test.testid).text(" ");
  });

// loop dc and tests...
  var dcTests = fdsn.datacenters.map(function(dc) {
    var combinedTests = { dc: dc };
    var initEVTest = new RSVP.Promise(function(resolve, reject) {
       resolve(true);
    });
    var prevEVTest = initEVTest;
    var initSTTest = new RSVP.Promise(function(resolve, reject) {
       resolve(true);
    });
    var prevSTTest = initSTTest;
    var initDSTest = new RSVP.Promise(function(resolve, reject) {
       resolve(true);
    });
    var prevDSTest = initDSTest;

    if (doesSupport(dc, EV)) {
      combinedTests.fdsnevent = fdsnEventTests.reduce(function(acc, test) {
        return acc.then(function(prevResult) {
          if (prevResult) {
            var sel =d3.select("tr."+dc.id).select("td."+test.testid);
            sel.append("span").text("Run");
            return runTestOnDC(test, dc, EV);
          } else {
            return false;
          }
        });
      }, initEVTest);
    }
    if (doesSupport(dc, ST)) {
       combinedTests.fdsnstation = fdsnStationTests.reduce(function(acc, test) {
        return acc.then(function(prevResult) {
          if (prevResult) {
            var sel =d3.select("tr."+dc.id).select("td."+test.testid);
            sel.append("span").text("Run");
            return runTestOnDC(test, dc, ST);
          } else {
            return false;
          }
        });
      }, initSTTest);
    }
    if (doesSupport(dc, DS)) {
      combinedTests.fdsndataselect = fdsnDataTests.reduce(function(acc, test) {
        return acc.then(function(prevResult) {
          if (prevResult) {
            var sel =d3.select("tr."+dc.id).select("td."+test.testid);
            sel.append("span").text("Run");
            return runTestOnDC(test, dc, DS);
          } else {
            return false;
          }
        });
      }, initDSTest);
    }
    return combinedTests;
  });

RSVP.all(dcTests.map(function(dcT) { return RSVP.hash(dcT);}))
.then(function(r) {console.log("tests finished"); })
.catch(function(r) {console.log("oops, something didn't finish");});



//.selectAll("p").data(fdsn.datacenters)
//    .enter().append('p').text(function(d) {
//        return d.name;
//    });
});

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

function createSupportsItem(selector, isSupported) {
  if (isSupported) {
    selector.text("Yes");
  } else {
    selector.text("No");
  }
}

