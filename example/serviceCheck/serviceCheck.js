// seisplotjs comes from the seisplotjs standalone bundle
var d3 = seisplotjs.d3;
var wp = seisplotjs.waveformplot;
var traveltime = seisplotjs.traveltime;
var fdsnevent = seisplotjs.fdsnevent;
var fdsnstation = seisplotjs.fdsnstation;
var fdsndataselect = seisplotjs.fdsndataselect;
var RSVP = fdsnstation.RSVP;

console.log("allFdsnTests: "+allFdsnTests);

var DS = "fdsnws-dataselect";
var EV = "fdsn-event";
var ST = "fdsn-station";



// all tests should be object with testid, testname and test: function(datacenter, d3selector)
// allFdsnTests assumed to be global object with the tests in it, loaded from 
// separate file. It should have 3 fields, each an array of tests like:
// 
// allFdsnTests = {
//     fdsnEventTests = [ testEventVersion, testLastDay, testCatalogs, testContributors ],
//     fdsnStationTests = [ testStationVersion, testNetworks ],
//     fdsnDataTests = [ testDataSelectVersion ]
// }

var RUN = "Run";
var UNSUPPORTED = "Unsupported";
var FAIL = "Fail";
var OK = "OK";

function selectionForTestDC(test, dc) {
  var sel = d3.select("tr."+test.testid).select("td.testresult");
  return sel;
}

function runTestOnDC(test, dc, DCType) {
  var sel = selectionForTestDC(test, dc);
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
      sel.selectAll("*").remove();
      sel.append("a")
          .attr("class", "success")
          .attr("href", testOut.url)
          .attr("title", testOut.url)
          .text(testOut.text);
      return testOut;
  }).catch(function(err) {
console.log("catch "+test.testname+" on "+dc.id+" "+DCType);
if (err.url) {
console.log("   url: "+err.url);
}
      sel.selectAll("*").remove();
      if (err === UNSUPPORTED) {
         console.log("test "+test.testname+" on "+dc.id+" "+DCType+" unsupported.");
      } else {
        console.assert(false, err);
        if (err.url) {
          var popupText = err.status+" "+ err.statusText;
          if (err.status === 0) {
            popupText += " maybe CORS issue?";
          }
          sel.append("a").attr("class", "fail").attr("href", err.url).text("Oops").attr("title", popupText);
        } else {
console.log("error with no URL", err);
          sel.append("span").attr("class", "fail").attr("title", popupText).text("Oops");
        }
      }
      //return err;
  });
}

var fdsnDataCenters = null;

d3.json('fdsnDataCenters.json', function(fdsn) {
  fdsnDataCenters = fdsn;
  makeTable(fdsn);
});

function makeTable(fdsn) {
  var table = d3.select(".datacenters").select("table");
  if ( table.empty()) {
    table = d3.select(".datacenters").append("table");
    var thr = table.append("thead").append("tr");
    thr.append("th").text("Name");
    thr.append("th").text("Event");
    thr.append("th").text("Station");
    thr.append("th").text("DataSelect");
    thr.append("th").text("Run Tests");
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
    .append("span")
    .attr("class", "clickableText")
    .text(function(d) {
      if ( doesSupport(d, EV)) {
        return "Yes";
      } else {
        return "No";
      }
    });
  tr.append("td")
    .text(function(d) {
      if ( doesSupport(d, ST)) {
        return "Yes";
      } else {
        return "No";
      }
    });
  tr.append("td")
    .text(function(d) {
      if ( doesSupport(d, DS)) {
        return "Yes";
      } else {
        return "No";
      }
    });
  tr.append("td")
    .append("button")
    .attr("class", "clickableText")
    .text("Run")
    .on("click", function(d) {
      runAllTests(fdsn, d.id);
    });
}

function makeResultsTable(dc, tests) {
  var div = d3.select("div.results");
  div.selectAll("*").remove();
  var divP = div.append("p");
  divP.text("Results for ");
  divP.append("a").attr("href", dc.url).text(dc.name);
  var table = d3.select(".results").select("table");
  if ( table.empty()) {
    table = d3.select(".results").append("table");
    var thr = table.append("thead").append("tr");
    thr.append("th").text("Result");
    thr.append("th").text("Name");
    thr.append("th").text("Service");
    thr.append("th").text("Detail");
    table.append("tbody");
  }

  var allTests = allFdsnTests.fdsnEventTests.concat(allFdsnTests.fdsnStationTests).concat(allFdsnTests.fdsnDataTests);

  var tableData = table.select("tbody")
    .selectAll("tr")
    .data(allTests);
  tableData.exit().remove();
  var tr = tableData.enter().append("tr").attr("class", function(test) {return test.testid;});
  tr.append("td").attr("class", "testresult");
  tr.append("td").append("span").text(function(test) {
       return test.testname;
  });

}

function runAllTests(fdsn, dcid) {
// loop dc and tests...
  var dc = fdsn.datacenters.find(function(dc) {
    return dc.id === dcid;
  });
  makeResultsTable(dc, allFdsnTests);
  var dcTests = fdsn.datacenters
    .filter(function(dc) {
      return dc.id === dcid;
    }).map(function(dc) {
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
      combinedTests.fdsnevent = allFdsnTests.fdsnEventTests.reduce(function(acc, test) {
        return acc.then(function(prevResult) {
          if (prevResult) {
            var sel = selectionForTestDC(test, dc);
            sel.append("span").text("Run");
            return runTestOnDC(test, dc, EV);
          } else {
            return false;
          }
        });
      }, initEVTest);
    }
    if (doesSupport(dc, ST)) {
       combinedTests.fdsnstation = allFdsnTests.fdsnStationTests.reduce(function(acc, test) {
        return acc.then(function(prevResult) {
          if (prevResult) {
            var sel = selectionForTestDC(test, dc);
            sel.append("span").text("Run");
            return runTestOnDC(test, dc, ST);
          } else {
            return false;
          }
        });
      }, initSTTest);
    }
    if (doesSupport(dc, DS)) {
      combinedTests.fdsndataselect = allFdsnTests.fdsnDataTests.reduce(function(acc, test) {
        return acc.then(function(prevResult) {
          if (prevResult) {
            var sel = selectionForTestDC(test, dc);
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
}

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

