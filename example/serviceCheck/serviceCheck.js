// seisplotjs comes from the seisplotjs standalone bundle
var d3 = seisplotjs.d3;
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

var UNSUPPORTED = "Unsupported";

function selectionForTestDC(test, dc) {
  var sel = d3.select("tr."+test.testid).select("td.testresult");
  return sel;
}

function runTestOnDC(test, dc, DCType) {
  var testRunStart = performance.now();
  var sel = selectionForTestDC(test, dc);
console.log("RunTestOnDC: "+test.testname+" "+dc.id+" "+DCType+"  sup="+doesSupport(dc, DCType));
  if ( ! doesSupport(dc, DCType) ) {
    return new RSVP.Promise(function(resolve) {
      resolve( {
        text: UNSUPPORTED,
        url: "none"
      });
    });
  }
  // dc type is supported
  return new RSVP.Promise(function(resolve) {
    resolve( {
        text: "",
        url: "none"
      });
  }).then(function() {
     // run test and package up result
console.log("run "+test.testname+" on "+dc.id+" "+DCType);
     return test.test(dc)
       .then(function(result) {
         var out = {
           text: "ok",
           test: test,
           dc: dc,
           runtime: ( performance.now() - testRunStart ),
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
          .text("OK");
      var messageSel = d3.select("tr."+test.testid).select("td.testmessage");
      messageSel.selectAll("*").remove();
      messageSel.append("span").text(testOut.text);
      var runtimeSel = d3.select("tr."+test.testid).select("td.runtime");
      runtimeSel.selectAll("*").remove();
      runtimeSel.append("span").text(Math.round(testOut.runtime));
      return testOut;
  }).catch(function(err) {
      var messageSel = d3.select("tr."+test.testid).select("td.testmessage");
console.log("catch in test='"+test.testname+"' on "+dc.id+" "+DCType);
console.assert(false, err);
if (err.url) {
console.log("   url: "+err.url);
}
      sel.selectAll("*").remove();
      messageSel.selectAll("*").remove();
      if (err === UNSUPPORTED) {
         console.log("test "+test.testname+" on "+dc.id+" "+DCType+" unsupported.");
         sel.append("span").text("unsupported");
      } else {
        console.assert(false, err);
        var popupText = "";
        if (err.message) {popupText += err.message;}
        if (typeof err.status != 'undefined') {
          popupText += " status="+err.status;
          if (err.status === 0) {
            popupText += ", maybe CORS issue?";
          }
        }
        if (err.statusText) {
          popupText += " "+ err.statusText;
        }
        if (err.url) {
          sel.append("a").attr("class", "fail").attr("href", err.url).text("Oops").attr("title", popupText);
        } else {
console.log("error with no URL", err);
          sel.append("span").attr("class", "fail").attr("title", popupText).text("Oops");
        }
        messageSel.append("span").text(popupText);
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
  var div = d3.select(".datacenters");
  div.select("p").remove();
  var table = div.select("table");
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
      .append(function(d) {
        if ( doesSupport(d, EV)) {
          var aElement = document.createElement("a");
          d3.select(aElement)
            .attr("href", new fdsnevent.EventQuery()
                .host(serviceHost(d, EV))
                .formBaseURL())
            .text( "Yes" );
          return aElement;
        } else {
          var spanElement = document.createElement("span");
          d3.select(spanElement)
            .text( "No");
          return spanElement;
        }
      });
    tr.append("td")
      .append(function(d) {
        if ( doesSupport(d, ST)) {
          var aElement = document.createElement("a");
          d3.select(aElement)
            .attr("href", new fdsnstation.StationQuery()
                .host(serviceHost(d, ST))
                .formBaseURL())
            .text( "Yes" );
          return aElement;
        } else {
          var spanElement = document.createElement("span");
          d3.select(spanElement)
            .text( "No");
          return spanElement;
        }
    });
  tr.append("td")
      .append(function(d) {
        if ( doesSupport(d, DS)) {
          var aElement = document.createElement("a");
          d3.select(aElement)
            .attr("href", new fdsndataselect.DataSelectQuery()
                .host(serviceHost(d, DS))
                .formBaseURL())
            .text( "Yes" );
          return aElement;
        } else {
          var spanElement = document.createElement("span");
          d3.select(spanElement)
            .text( "No");
          return spanElement;
        }
    });
  tr.append("td")
    .append("button")
    .text("Run")
    .on("click", function(d) {
      runAllTests(fdsn, d.id);
    });
}

function makeResultsTable(dc, inTests) {
  var div = d3.select("div.results");
  div.selectAll("*").remove();
  var divP = div.append("h3");
  divP.text("Results for ");
  divP.append("a").attr("href", dc.url).text(dc.name);
  var table = div.select("table");
  if ( table.empty()) {
    table = d3.select(".results").append("table");
    var thr = table.append("thead").append("tr");
    thr.append("th").text("Result");
    thr.append("th").text("Test Name");
    thr.append("th").text("Service");
    thr.append("th").text("Detail");
    thr.append("th").text("Output");
    thr.append("th").text("Runtime (ms)");
    table.append("tbody");
  }

  var allTests = inTests.fdsnEventTests.concat(inTests.fdsnStationTests).concat(inTests.fdsnDataTests);

  allTests = allTests.filter(function(test) {
    return test.webservices.reduce(function(acc, wsType) {
      return acc && doesSupport(dc, wsType);
    }, true);
  });

  var tableData = table.select("tbody")
    .selectAll("tr")
    .data(allTests);
  tableData.exit().remove();
  var tr = tableData.enter().append("tr").attr("class", function(test) {return test.testid;});
  tr.append("td").attr("class", "testresult");
  tr.append("td").append("span").text(function(test) {
       return test.testname;
  });
  tr.append("td").append("span").text(function(test) {
       return test.webservices.join(" ");
  });
  tr.append("td").append("span").text(function(test) {
       return test.description;
  });
  tr.append("td").attr("class", "testmessage");
  tr.append("td").attr("class", "runtime");
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
    var initEVTest = new RSVP.Promise(function(resolve) {
       resolve(true);
    });
    var initSTTest = new RSVP.Promise(function(resolve) {
       resolve(true);
    });
    var initDSTest = new RSVP.Promise(function(resolve) {
       resolve(true);
    });

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
.then(function() {console.log("tests finished"); })
.catch(function(r) {
  console.assert(false, r);
  console.log("oops, something didn't finish");
});



//.selectAll("p").data(fdsn.datacenters)
//    .enter().append('p').text(function(d) {
//        return d.name;
//    });
}

function doesSupport(dc, type) {
  var out = dc.supports.find(function(s) { return s.type === type;});
//  if (! out) {
//    var dcws = dc.supports.map(function(d) { return d.type; }).join(',');
//    console.log("not doesSupport "+dc.id+" "+dcws+" "+type+" undef");
//  }
  return typeof out != 'undefined';

}

function serviceHost(dc, type) {
  var does = doesSupport(dc, type);
  if (does) {
    return does.host ? does.host : dc.host;
  }
  return null;
}

