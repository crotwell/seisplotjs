/**
 * Philip Crotwell
 * University of South Carolina, 2014
 * http://www.seis.sc.edu
 */
/**
 * AMD style define, see https://github.com/amdjs/amdjs-api/wiki/AMD
 */
define('waveformplot',
        ['miniseed', 'd3'],
        function(miniseed, d3) {
  
function waveformplot() {
    console.log("In waveformplot");
    var plotStart;
    var plotEnd;
    
    // d3 margin convention, see http://bl.ocks.org/mbostock/3019563
    var margin = {top: 20, right: 20, bottom: 40, left: 75};
    var outerWidth = 960;
    var outerHeight = 500;
    var width = outerWidth - margin.left - margin.right;
    var height = outerHeight - margin.top - margin.bottom;
    // d3 margin convention, see http://bl.ocks.org/mbostock/3019563
    
    var segments = [];
    var svgParent;
    var xScale;
    var yScale;
    var xAxis;
    var yAxis;
    var xLabel = "Time";
    var xSublabel = "";
    var yLabel = "Amplitude";
    var ySublabel = "";
    var plotUUID = guid();
    var clipPathId = "clippath_"+plotUUID;

    function my(inSvgParent, inSegments) {
        segments.push(inSegments);
        svgParent = inSvgParent;
        draw();
        
      //  fix this....
      //  addResizeHandler(resize);
    }
    
    my.append = function(key, segment) {
        segments.push(segment);
    }
    
    function resize() {
        /*
         * This only works if added to the window, see addResizeHandler in crocusplot.js
         */

        var svg = svgParent.select("svg");
        var svgG = svg.select("g");
        /* Find the new window dimensions */
        var targetWidth = svgParent[0][0].clientWidth;
        var targetHeight = svgParent[0][0].clientWidth;
        console.log("target parent: "+targetWidth+"  "+targetHeight);
        
        var styleWidth = parseInt(svgParent.style("width")) ;
        var styleHeight = parseInt(svgParent.style("height")) ;
        if (styleHeight == 0) { styleHeight = 100;}
        console.log("style parent: "+styleWidth+"  "+styleHeight);
        setWidthHeight(svg, styleWidth, styleHeight);
        console.log("resize "+width+" "+height);

        /* Update the range of the scale with new width/height */
        xScale.range([0, width]);
        yScale.range([height/segments.length, 0]);
        
        /* Update the axis with the new scale */
        svgG.select('.x.axis')
          .attr("transform",  "translate(0," + (height ) + " )")
          .call(xAxis);

        svgG.selectAll('.y.axis')
          .call(yAxis);

        svg.select('g.xLabel')
            .attr("transform", "translate("+(margin.left+(width)/2)+", "+(outerHeight  - 6)+")");
            
            
        svg.select('g.yLabel')
            .attr("transform", "translate(0, "+(margin.top+(height)/2)+")");
            

        svg.select('#'+clipPathId).select("rect")
              .attr("width", width)
              .attr("height", height);
        
        svgG.select("rect.graphClickPane")
              .attr("width", width)
              .attr("height", height);
        
        /* Force D3 to recalculate and update the line segments*/
        for (var plotNum=0; plotNum < segments.length; plotNum++) {
            for (var drNum = 0; drNum < segments[plotNum].length; drNum++) { 
                console.log("resize select: "+'#'+segments[plotNum][drNum].seisId()+'_'+plotUUID);
                svgG.select('#'+segments[plotNum][drNum].seisId()+'_'+plotUUID)
                .attr("d", createLineFunction(segments[plotNum][drNum]));
        }
        }
    }

    my.xScale = function() {
        return xScale;
    };
    my.yScale = function() {
        return yScale;
    }
    my.getResizeFunction = function() {
        return resize;
    }
    
    function createLineFunction(segment) {
        this.seg = segment;
        return d3.svg.line()
        .x(function(d, i) {
            return xScale(seg.timeOfSample(i));
        }).y(function(d, i) {
            return yScale(d);
        }).interpolate("linear")(seg); // call the d3 function created by line with data
    }
    
    function draw() {
        console.log("In waveformplot.draw "+plots.length+" "+width+" "+height);
        var sampPeriod = 1;
        var minAmp = 2 << 24;
        var maxAmp = -1 * (minAmp);
        var count = 0;
        var s;
        var e;
        var record;
        var n;
        var connectingDR;
        if (plots.length > 0) {
            if(!plotStart) {
               plotStart = segments[0][0].start;
            }
            if(!plotEnd) {
                plotEnd = segments[0][0].end;
            }
        }
        for (var plotNum=0; plotNum < segments.length; plotNum++) {
            for (var drNum = 0; drNum < segments.length; drNum++) {
                record = segments[plotNum][drNum];
                s = record.start;
                e = record.end;
                console.log("segment "+plotNum+" " + drNum + " " + s + "  " + e);
                for (n = 0; n < record.length; n++) {
                    if (minAmp > record[n]) {
                        minAmp = record[n];
                    }
                    if (maxAmp < record[n]) {
                        maxAmp = record[n];
                    }
                }
                if (s < plotStart) {
                    plotStart = s;
                }
                if (plotEnd < e) {
                    plotEnd = e;
                }
            }
        }
        outerWidth = parseInt(svgParent.style("width")) ;
        outerHeight = parseInt(svgParent.style("height")) ;
        var svg = svgParent.append("svg");
        setWidthHeight(svg, outerWidth, outerHeight);

        var svgG = svg
            .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
        

        svgG.append("defs").append("clipPath").attr("id", clipPathId)
            .append("rect")
              .attr("width", width)
              .attr("height", height);
        xScale = d3.time.scale().domain([ plotStart, plotEnd ])
            .range([ 0, width ])
            .nice();
        yScale = d3.scale.linear().domain([ minAmp, maxAmp ])
            .range([ height/segments/length, 0 ])
            .nice();
        xAxis = d3.svg.axis().scale(xScale).orient("bottom").ticks(5);

        yAxis = d3.svg.axis().scale(yScale).orient("left").ticks(5);
        
        svgG.append("g").attr("class", "x axis")
            .attr("transform",  "translate(0," + (height ) + " )")
            .call(xAxis);
        svgG.append("g").attr("class", "y axis").call(yAxis);
        
        
        var seisG = svgG.selectAll("g").data(segments).enter().append("g").attr("id", function(d) {return d[0].seisId();});
        var seisPath = seisG.selectAll("path").data(function(d) {return d;})
            .enter().append("path")
            .classed("seispath")
            .attr("id", function(d) {return d.seisId()+'_'+plotUUID})
            .attr("d", function(d) {return createLineFunction(d)});
        
        /*
        var seismogram = svgG.append("g").attr("class", "seismogram").attr("clip-path", "url(#"+clipPathId+")");
        
        var seisLine = seismogram.selectAll("path").data(segments, function(d) {return d.seisId();});
        seisLine.enter().append("path")
            .attr("id", function(d) {return d.seisId()+'_'+plotUUID})
            .attr("d", function(d) {return createLineFunction(d)});
        seisLine.exit().remove();
*/
        svg.append("g")
            .attr("class", "xLabel")
            .attr("transform", "translate("+(margin.left+(width)/2)+", "+(outerHeight  - 6)+")")
            .append("text").attr("class", "x label")
            .attr("text-anchor", "middle")
            .text(xLabel);
        svg.append("g")
            .attr("class", "yLabel")
            .attr("x", 0)
            .attr("transform", "translate(0, "+(margin.top+(height)/2)+")")
           .append("text")
            .attr("class", "y label")
            .attr("text-anchor", "middle")
            .attr("dy", ".75em")
            .attr("transform-origin", "center center")
            .attr("transform", "rotate(-90)")
            .text(yLabel);
        svgG.append("rect").attr("class", "graphClickPane")
            .attr("width", width)
            .attr("height", height);
        resize();
    }
    
    


    function setWidthHeight(svg, nOuterWidth, nOuterHeight) {
        outerWidth = nOuterWidth;
        outerHeight = nOuterHeight;
        width = outerWidth - margin.left - margin.right;
        height = outerHeight - margin.top - margin.bottom;
        svg
          .attr("width", outerWidth)
          .attr("height", outerHeight);
    };
    
    /*
     * from http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript
     */
    function s4() {
          return Math.floor((1 + Math.random()) * 0x10000)
                     .toString(16)
                     .substring(1);
    };
    function guid() {
          return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
                 s4() + '-' + s4() + s4() + s4();
    };
    

    // see http://blog.kevinchisholm.com/javascript/javascript-function-throttling/
    var throttleResize = true;
    var throttle = function(func, delay){
        if (throttleResize) {
            window.clearTimeout(throttleResize);
        }
        throttleResize = window.setTimeout(func, delay);
    };
    
    my.resizeNeeded = function() {
        throttle(function(){
            resize();
        }, 250);
    };

    my.plotStart = function(value) {
        if (!arguments.length)
            return plotStart;
        plotStart = value;
        xScale.domain([ plotStart, plotEnd ])
        my.resizeNeeded();
        return my;
    };
    my.plotEnd = function(value) {
        if (!arguments.length)
            return plotEnd;
        plotEnd = value;
        xScale.domain([ plotStart, plotEnd ])
        my.resizeNeeded();
        return my;
    };
    
    my.width = function(value) {
        if (!arguments.length)
            return width;
        width = value;
        return my;
    };

    my.height = function(value) {
        if (!arguments.length)
            return height;
        height = value;
        return my;
    };

    my.margin = function(value) {
        if (!arguments.length)
            return margin;
        margin = value;
        return my;
    }
    my.xLabel = function(value) {
        if (!arguments.length)
            return xLabel;
        xLabel = value;
        return my;
    }
    my.yLabel = function(value) {
        if (!arguments.length)
            return yLabel;
        yLabel = value;
        return my;
    }
    my.xSublabel = function(value) {
        if (!arguments.length)
            return xSublabel;
        xSublabel = value;
        return my;
    }
    my.ySublabel = function(value) {
        if (!arguments.length)
            return ySublabel;
        ySublabel = value;
        return my;
    }

    return my;
};

return waveformplot;
        });
