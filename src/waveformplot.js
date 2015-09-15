/**
 * Philip Crotwell
 * University of South Carolina, 2014
 * http://www.seis.sc.edu
 */
/**
 * AMD style define, see https://github.com/amdjs/amdjs-api/wiki/AMD
 */

import miniseed from './miniseed';
//import seedcodec from './seedcodec';
import d3 from 'd3';

 
class chart {
    constructor(inSvgParent, inSegments) {
        console.log("In waveformplot");
        this.throttleResize = true;
        this.plotStart;
        this.plotEnd;
        
        // d3 margin convention, see http://bl.ocks.org/mbostock/3019563
        this.margin = {top: 20, right: 20, bottom: 40, left: 75};
        this.outerWidth = 960;
        this.outerHeight = 500;
        this.width = this.outerWidth - this.margin.left - this.margin.right;
        this.height = this.outerHeight - this.margin.top - this.margin.bottom;
        // d3 margin convention, see http://bl.ocks.org/mbostock/3019563
    
        this.segments = [];
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
        this.clipPathId = "clippath_"+plotUUID;
        segments.push(inSegments);
        this.svgParent = inSvgParent;
        draw();
        
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
        let svg = this.svgP.select("svg");
        let svgG = svg.select("g");
        /* Find the new window dimensions */
        let targetWidth = this.svgP[0][0].clientWidth;
        let targetHeight = this.svgP[0][0].clientHeight;
        console.log("target parent: "+targetWidth+"  "+targetHeight);
        
        let styleWidth = parseInt(svgP.style("width")) ;
        let styleHeight = parseInt(svgP.style("height")) ;
        if (styleHeight == 0) { styleHeight = 100;}
        console.log("style parent: "+styleWidth+"  "+styleHeight);
        setWidthHeight(svg, styleWidth, styleHeight);
        console.log("resize "+width+" "+height);

        /* Update the range of the scale with new width/height */
        this.xScale.range([0, this.width]);
        this.yScale.range([this.height/this.segments.length, 0]);
        
        /* Update the axis with the new scale */
        svgG.select('.x.axis')
          .attr("transform",  "translate(0," + (this.height ) + " )")
          .call(xAxis);

        svgG.selectAll('.y.axis')
          .call(yAxis);

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
                console.log("resize select: "+'#'+this.segments[plotNum][drNum].seisId()+'_'+this.plotUUID);
                svgG.select('#'+segments[plotNum][drNum].seisId()+'_'+this.plotUUID)
                .attr("d", createLineFunction(segments[plotNum][drNum]));
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
    
    createLineFunction(segment) {
        this.seg = segment;
        return d3.svg.line()
        .x(function(d, i) {
            return xScale(seg.timeOfSample(i));
        }).y(function(d, i) {
            return yScale(d);
        }).interpolate("linear")(seg); // call the d3 function created by line with data
    }
    
    draw() {
        console.log("In waveformplot.draw "+this.plots.length+" "+this.width+" "+this.height);
        let sampPeriod = 1;
        let minAmp = 2 << 24;
        let maxAmp = -1 * (minAmp);
        let count = 0;
        let s;
        let e;
        let record;
        let n;
        let connectingDR;
        if (this.plots.length > 0) {
            if(!this.plotStart) {
               this.plotStart = segments[0][0].start;
            }
            if(!this.plotEnd) {
                this.plotEnd = segments[0][0].end;
            }
        }
        for (let plotNum=0; plotNum < this.segments.length; plotNum++) {
            for (let drNum = 0; drNum < this.segments.length; drNum++) {
                record = this.segments[plotNum][drNum];
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
                if (s < this.plotStart) {
                    this.plotStart = s;
                }
                if (this.plotEnd < e) {
                    this.plotEnd = e;
                }
            }
        }
        this.outerWidth = parseInt(svgParent.style("width")) ;
        this.outerHeight = parseInt(svgParent.style("height")) ;
        let svg = svgParent.append("svg");
        setWidthHeight(svg, outerWidth, outerHeight);

        let svgG = svg
            .append("g")
            .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");
        

        svgG.append("defs").append("clipPath").attr("id", this.clipPathId)
            .append("rect")
              .attr("width", this.width)
              .attr("height", this.height);
        xScale = d3.time.scale().domain([ this.plotStart, this.plotEnd ])
            .range([ 0, this.width ])
            .nice();
        yScale = d3.scale.linear().domain([ minAmp, maxAmp ])
            .range([ this.height/this.segments/length, 0 ])
            .nice();
        xAxis = d3.svg.axis().scale(this.xScale).orient("bottom").ticks(5);

        yAxis = d3.svg.axis().scale(this.yScale).orient("left").ticks(5);
        
        svgG.append("g").attr("class", "x axis")
            .attr("transform",  "translate(0," + (this.height ) + " )")
            .call(this.xAxis);
        svgG.append("g").attr("class", "y axis").call(this.yAxis);
        
        
        let seisG = svgG.selectAll("g").data(this.segments).enter().append("g").attr("id", function(d) {return d[0].seisId();});
        let seisPath = seisG.selectAll("path").data(function(d) {return d;})
            .enter().append("path")
            .classed("seispath")
            .attr("id", function(d) {return d.seisId()+'_'+this.plotUUID})
            .attr("d", function(d) {return createLineFunction(d)});
        
        /*
        let seismogram = svgG.append("g").attr("class", "seismogram").attr("clip-path", "url(#"+clipPathId+")");
        
        let seisLine = seismogram.selectAll("path").data(segments, function(d) {return d.seisId();});
        seisLine.enter().append("path")
            .attr("id", function(d) {return d.seisId()+'_'+plotUUID})
            .attr("d", function(d) {return createLineFunction(d)});
        seisLine.exit().remove();
*/
        svg.append("g")
            .attr("class", "xLabel")
            .attr("transform", "translate("+(this.margin.left+(this.width)/2)+", "+(this.outerHeight  - 6)+")")
            .append("text").attr("class", "x label")
            .attr("text-anchor", "middle")
            .text(this.xLabel);
        svg.append("g")
            .attr("class", "yLabel")
            .attr("x", 0)
            .attr("transform", "translate(0, "+(this.margin.top+(this.height)/2)+")")
           .append("text")
            .attr("class", "y label")
            .attr("text-anchor", "middle")
            .attr("dy", ".75em")
            .attr("transform-origin", "center center")
            .attr("transform", "rotate(-90)")
            .text(yLabel);
        svgG.append("rect").attr("class", "graphClickPane")
            .attr("width", this.width)
            .attr("height", this.height);
        resize();
    }
    
    


    setWidthHeight(svg, nOuterWidth, nOuterHeight) {
        this.outerWidth = nOuterWidth;
        this.outerHeight = nOuterHeight;
        this.width = outerWidth - this.margin.left - this.margin.right;
        this.height = outerHeight - this.margin.top - this.margin.bottom;
        svg
          .attr("width", this.outerWidth)
          .attr("height", this.outerHeight);
    }
    
    /*
     * from http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript
     */
    s4() {
          return Math.floor((1 + Math.random()) * 0x10000)
                     .toString(16)
                     .substring(1);
    }
    guid() {
          return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
                 s4() + '-' + s4() + s4() + s4();
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

    set plotStart(value) {
        if (!arguments.length)
            return this.plotStart;
        this.plotStart = value;
        this.xScale.domain([ this.plotStart, this.plotEnd ])
        resizeNeeded();
        return this;
    }
    set plotEnd(value) {
        if (!arguments.length)
            return this.plotEnd;
        this.plotEnd = value;
        this.xScale.domain([ this.plotStart, this.plotEnd ])
        resizeNeeded();
        return this;
    }
    
    set width(value) {
        if (!arguments.length)
            return this.width;
        this.width = value;
        return this;
    }

    set height(value) {
        if (!arguments.length)
            return this.height;
        this.height = value;
        return this;
    }

    set margin(value) {
        if (!arguments.length)
            return this.margin;
        this.margin = value;
        return this;
    }
    set xLabel(value) {
        if (!arguments.length)
            return this.xLabel;
        this.xLabel = value;
        return this;
    }
    set yLabel(value) {
        if (!arguments.length)
            return this.yLabel;
        this.yLabel = value;
        return this;
    }
    set xSublabel(value) {
        if (!arguments.length)
            return this.xSublabel;
        this.xSublabel = value;
        return this;
    }
    set ySublabel(value) {
        if (!arguments.length)
            return this.ySublabel;
        this.ySublabel = value;
        return this;
    }
}

let seedcodec = miniseed.seedcodec;

export { chart, miniseed, seedcodec }

