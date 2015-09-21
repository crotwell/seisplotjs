/**
 * Philip Crotwell
 * University of South Carolina, 2014
 * http://www.seis.sc.edu
 */

import d3 from 'd3';

    /*
     * from http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript
     */
    var s4 = function() {
          return Math.floor((1 + Math.random()) * 0x10000)
                     .toString(16)
                     .substring(1);
    }
    var guid = function() {
          return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
                 s4() + '-' + s4() + s4() + s4();
    }
    
 
class chart {
    constructor(inSvgParent, inSegments) {
        console.log("In waveformplot");
        this.throttleResize = true;
        this.plotStart;
        this.plotEnd;
        
        let styleWidth = parseInt(inSvgParent.style("width")) ;
        let styleHeight = parseInt(inSvgParent.style("height")) ;
        if (styleWidth == 0) { styleWidth = 50;}
        if (styleHeight == 0) { styleHeight = 100;}

        // d3 margin convention, see http://bl.ocks.org/mbostock/3019563
        this.margin = {top: 20, right: 20, bottom: 40, left: 75};
        this.outerWidth = styleWidth;
        this.outerHeight = styleHeight;
        this.width = this.outerWidth - this.margin.left - this.margin.right;
        this.height = this.outerHeight - this.margin.top - this.margin.bottom;
        // d3 margin convention, see http://bl.ocks.org/mbostock/3019563
    
        this.segments = inSegments;
        this.svgParent;
        this.xScale;
        this.yScale;
        this.xAxis;
        this.yAxis;
        this.xLabel = "Time";
        this.xSublabel = "";
        this.yLabel = "Amplitude";
        this.ySublabel = "";
        this.plotUUID = guid();
        this.clipPathId = "clippath_"+this.plotUUID;
        this.svgParent = inSvgParent;
        
      //  fix this....
      //  addResizeHandler(resize);
    }

    
    append(key, segment) {
        this.segments.push(segment);
    }
    
    resize() {
        /*
         * This only works if added to the window, see addResizeHandler in crocusplot.js
         */

        let svgP = this.svgParent;
        let svg = svgP.select("svg");
        svg.classed("waveformPlotSVG", true);
        let svgG = svg.select("g");
        
        let styleWidth = parseInt(svgP.style("width")) ;
        let styleHeight = parseInt(svgP.style("height")) ;
        this.setWidthHeight(svg, styleWidth, styleHeight);

        /* Update the range of the scale with new width/height */
        this.xScale.range([0, this.width]);
        this.yScale.range([this.height/this.segments.length, 0]);
        
        /* Update the axis with the new scale */
        svgG.select('.x.axis')
          .attr("transform",  "translate(0," + (this.height ) + " )")
          .call(this.xAxis);

        svgG.selectAll('.y.axis')
          .call(this.yAxis);

        svg.select('g.xLabel')
            .attr("transform", "translate("+(this.margin.left+(this.width)/2)+", "+(this.outerHeight  - 6)+")");
            
            
        svg.select('g.yLabel')
            .attr("transform", "translate(0, "+(this.margin.top+(this.height)/2)+")");
            

        svg.select('#'+this.clipPathId).select("rect")
              .attr("width", this.width)
              .attr("height", this.height);
        
        svgG.select("rect.graphClickPane")
              .attr("width", this.width)
              .attr("height", this.height);
        
        /* Force D3 to recalculate and update the line segments*/
        for (let plotNum=0; plotNum < this.segments.length; plotNum++) {
            for (let drNum = 0; drNum < this.segments[plotNum].length; drNum++) { 
                svgG.select('#'+this.segments[plotNum][drNum].seisId()+'_'+this.plotUUID)
                .attr("d", this.createLineFunction(this.segments[plotNum][drNum], this.xScale, this.yScale));
        }
        }
    }

    getXScale() {
        return this.xScale;
    }
    getYScale() {
        return this.yScale;
    }
    getResizeFunction() {
        return this.resize;
    }
    
    createLineFunction(segment, in_xScale, in_yScale) {
        let seg = segment;
        let xScale = in_xScale;
        let yScale = in_yScale;
        return d3.svg.line()
        .x(function(d, i) {
            return xScale(seg.timeOfSample(i));
        }).y(function(d, i) {
            return yScale(d);
        }).interpolate("linear")(seg); // call the d3 function created by line with data
    }
    
    draw() {
        console.log("In waveformplot.draw "+this.segments.length+" "+this.width+" "+this.height+"  s"+this.segments[0][0].length);
        let sampPeriod = 1;
        let minAmp = 2 << 24;
        let maxAmp = -1 * (minAmp);
        let count = 0;
        let s;
        let e;
        let record;
        let n;
        let connectingDR;
        if (this.segments.length > 0) {
            if(!this.plotStart) {
               this.plotStart = this.segments[0][0].start;
            }
            if(!this.plotEnd) {
// fix this????
                this.plotEnd = this.segments[0][0].end;
            }
        } else {
            console.log("WARN: segments length 0");
        }
        for (let plotNum=0; plotNum < this.segments.length; plotNum++) {
            for (let drNum = 0; drNum < this.segments[plotNum].length; drNum++) {
                record = this.segments[plotNum][drNum];
                s = record.start;
                e = record.end;
                for (n = 0; n < record.length; n++) {
                    if (minAmp > record[n]) {
                        minAmp = record[n];
                    }
                    if (maxAmp < record[n]) {
                        maxAmp = record[n];
                    }
                }
                if (s < this.plotStart) {
                    this.plotStart = s;
                }
                if (this.plotEnd < e) {
                    this.plotEnd = e;
                }
            }
        }
        this.outerWidth = parseInt(this.svgParent.style("width")) ;
        this.outerHeight = parseInt(this.svgParent.style("height")) ;
        let svg = this.svgParent.append("svg");
        this.setWidthHeight(svg, this.outerWidth, this.outerHeight);

        let svgG = svg
            .append("g")
            .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");
        

        svgG.append("defs").append("clipPath").attr("id", this.clipPathId)
            .append("rect")
              .attr("width", this.width)
              .attr("height", this.height);
        this.xScale = d3.time.scale().domain([ this.plotStart, this.plotEnd ])
            .range([ 0, this.width ])
            .nice();
        this.yScale = d3.scale.linear().domain([ minAmp, maxAmp ])
            .range([ this.height/this.segments.length, 0 ])
            .nice();
        this.xAxis = d3.svg.axis().scale(this.xScale).orient("bottom").ticks(5);

        this.yAxis = d3.svg.axis().scale(this.yScale).orient("left").ticks(5);
        
        svgG.append("g").classed("x axis", true)
            .attr("transform",  "translate(0," + (this.height ) + " )")
            .call(this.xAxis);
        svgG.append("g").classed("y axis", true).call(this.yAxis);
        let dataSvgG = svgG.append("g").classed("seisdata", true);
        
        
        let insidePlotUUID = this.plotUUID;
        let insideCreateLineFunction = this.createLineFunction;
        let xScale = this.xScale;
        let yScale = this.yScale;
        let seisG = dataSvgG.selectAll("g").data(this.segments).enter().append("g").attr("id", function(d) {return d[0].seisId();});
        let seisPath = seisG.selectAll("path").data(function(d) {return d;})
            .enter().append("path")
            .classed("seispath", true)
            .attr("id", function(d) { return d.seisId()+'_'+insidePlotUUID})
            .attr("d", function(d) {return insideCreateLineFunction(d, xScale, yScale)});
        
        /*
        let seismogram = svgG.append("g").attr("class", "seismogram").attr("clip-path", "url(#"+clipPathId+")");
        
        let seisLine = seismogram.selectAll("path").data(segments, function(d) {return d.seisId();});
        seisLine.enter().append("path")
            .attr("id", function(d) {return d.seisId()+'_'+plotUUID})
            .attr("d", function(d) {return createLineFunction(d)});
        seisLine.exit().remove();
*/
        svg.append("g")
            .classed("xLabel", true)
            .attr("transform", "translate("+(this.margin.left+(this.width)/2)+", "+(this.outerHeight  - 6)+")")
            .append("text").classed("x label", true)
            .attr("text-anchor", "middle")
            .text(this.xLabel);
        svg.append("g")
            .classed("yLabel", true)
            .attr("x", 0)
            .attr("transform", "translate(0, "+(this.margin.top+(this.height)/2)+")")
           .append("text")
            .classed("y label", true)
            .attr("text-anchor", "middle")
            .attr("dy", ".75em")
            .attr("transform-origin", "center center")
            .attr("transform", "rotate(-90)")
            .text(this.yLabel);
        svgG.append("rect").classed("graphClickPane", true)
            .attr("width", this.width)
            .attr("height", this.height);
        this.resize();
    }
    
    


    setWidthHeight(svg, nOuterWidth, nOuterHeight) {
        this.outerWidth = Math.max(200, nOuterWidth);
        this.outerHeight = Math.max(100, nOuterHeight);
        this.height = this.outerHeight - this.margin.top - this.margin.bottom;
        this.width = this.outerWidth - this.margin.left - this.margin.right;
        svg
          .attr("width", this.outerWidth)
          .attr("height", this.outerHeight);
    }
    

    // see http://blog.kevinchisholm.com/javascript/javascript-function-throttling/
    throttle(func, delay){
        if (throttleResize) {
            window.clearTimeout(throttleResize);
        }
        throttleResize = window.setTimeout(func, delay);
    }
    
    resizeNeeded() {
        throttle(function(){
            resize();
        }, 250);
    }

    setPlotStart(value) {
        if (!arguments.length)
            return this.plotStart;
        this.plotStart = value;
        this.xScale.domain([ this.plotStart, this.plotEnd ])
        resizeNeeded();
        return this;
    }
    setPlotEnd(value) {
        if (!arguments.length)
            return this.plotEnd;
        this.plotEnd = value;
        this.xScale.domain([ this.plotStart, this.plotEnd ])
        resizeNeeded();
        return this;
    }
    
    setWidth(value) {
        if (!arguments.length)
            return this.width;
        this.width = value;
        return this;
    }

    setHeight(value) {
        if (!arguments.length)
            return this.height;
        this.height = value;
        return this;
    }

    setMargin(value) {
        if (!arguments.length)
            return this.margin;
        this.margin = value;
        return this;
    }
    setXLabel(value) {
        if (!arguments.length)
            return this.xLabel;
        this.xLabel = value;
        return this;
    }
    setYLabel(value) {
        if (!arguments.length)
            return this.yLabel;
        this.yLabel = value;
        return this;
    }
    setXSublabel(value) {
        if (!arguments.length)
            return this.xSublabel;
        this.xSublabel = value;
        return this;
    }
    setYSublabel(value) {
        if (!arguments.length)
            return this.ySublabel;
        this.ySublabel = value;
        return this;
    }
}

let waveformplot = { chart, miniseed, seedcodec }

