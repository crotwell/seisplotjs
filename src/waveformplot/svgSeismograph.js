// @flow

/*global window*/
/**
 * Philip Crotwell
 * University of South Carolina, 2014
 * http://www.seis.sc.edu
 */

import {
    moment,
    d3,
    miniseed,
    createPlotsBySelectorPromise,
    findStartEnd,
    findMinMax
  } from './util';
import SeismographConfig from './seismographconfig';
import {Seismogram, Trace, ensureIsTrace } from './seismogram';
import {InstrumentSensitivity} from './stationxml';
import type { PlotDataType } from './util';
import type { TimeRangeType } from './chooser';
import {multiFormatHour,
  formatMillisecond, formatSecond, formatMinute,
  formatHour, formatDay, formatMonth, formatYear} from './seismographconfig';


const CLIP_PREFIX = "seismographclip";

/** A seismogram plot, using d3. Note that you must have
  * stroke and fill set in css like:<br>
  * path.seispath {
  *   stroke: skyblue;
  *   fill: none;
  * }<br/>
  * in order to have the seismogram display.
  */
export class SvgSeismograph {
  static _lastID: number;
  plotId: number;
  beforeFirstDraw: boolean;
  seismographConfig: SeismographConfig;

  svgParent: any;
  segments: Array<Trace>;
  markers: Array<MarkerType>;
  width: number;
  height: number;
  outerWidth: number;
  outerHeight: number;
  scaleChangeListeners: Array<ScaleChangeListenerType>;
  svg: any;
  xScale: any;
  origXScale: any;
  currZoomXScale: any;
  yScale: any;
  yScaleRmean: any;
  instrumentSensitivity: InstrumentSensitivity;
  lineFunc: any;
  zoom: any;
  xAxis: any;
  yAxis: any;
  g: any;
  throttleRescale: any;
  throttleResize: any;
  constructor(inSvgParent :any, seismographConfig, inSegments: Array<Trace>, plotStartDate :moment, plotEndDate :moment) {
    if (inSvgParent == null) {throw new Error("inSvgParent cannot be null");}
    this.plotId = ++SvgSeismograph._lastID;
    this.beforeFirstDraw = true;
    this.seismographConfig = seismographConfig;
    this.width = 200;
    this.height = 100;

    this.svgParent = inSvgParent;
    this.traces = [];
    this._internalAppend(inSegments);
    this.markers = [];

    this.svg = inSvgParent.append("svg");
    this.svg.classed("seismograph", true);
    this.svg.classed("svg-content-responsive", true);
    this.svg.attr("version", "1.1");
    //this.svg.attr("preserveAspectRatio", "xMinYMin meet");
    //this.svg.attr("viewBox", `0 0 ${this.width} ${this.height}`)
    this.svg.attr("plotId", this.plotId);

    if ( ! plotStartDate || ! plotEndDate) {
      let st = findStartEnd(inSegments);
      plotStartDate = st.start;
      plotEndDate = st.end;
    }

    this.xScale = d3.scaleUtc()
      .domain([plotStartDate, plotEndDate]);
    this.origXScale = this.xScale;
    this.currZoomXScale = this.xScale;
    this.yScale = d3.scaleLinear();
    // yScale for axis (not drawing) that puts mean at 0 in center
    this.yScaleRmean = d3.scaleLinear();
    this.scaleChangeListeners = [];

    this.xAxis = d3.axisBottom(this.xScale).tickFormat(this.seismographConfig.xScaleFormat);
    this.yAxis = d3.axisLeft(this.yScaleRmean).ticks(8, this.seismographConfig.yScaleFormat);

    let mythis = this;
    this.lineFunc = d3.line()
      .curve(d3.curveLinear)
      .x(function(d) {return mythis.xScale(d.time); })
      .y(function(d) {return mythis.yScale(d.y); });

    let maxZoom = 8;
    if (this.traces && this.traces.length>0) {
      let maxSps = 1;
      maxSps = this.traces.reduce(function(accum, seg) {
        return Math.max(accum, seg.sampleRate);
      }, maxSps);
      let secondsPerPixel = this.calcSecondsPerPixel( mythis.xScale);
      let samplesPerPixel = maxSps * secondsPerPixel;
      let zoomLevelFactor = samplesPerPixel*this.seismographConfig.maxZoomPixelPerSample;
      maxZoom = Math.max(maxZoom,
                         Math.pow(2, Math.ceil(Math.log(zoomLevelFactor)/Math.log(2))));
    }

    this.zoom = d3.zoom()
            .scaleExtent([1/4, maxZoom ] )
            .on("zoom", function() {
                mythis.zoomed(mythis);
              });

    this.g = this.svg.append("g")
      .attr("transform", "translate(" + this.seismographConfig.margin.left + "," + this.seismographConfig.margin.top + ")");
    this.g.append("g").attr("class", "allsegments");
    this.svg.call(this.zoom);
    this.calcScaleDomain();

    // create marker g
    this.g.append("g").attr("class", "allmarkers")
        .attr("style", "clip-path: url(#"+CLIP_PREFIX+this.plotId+")");

    d3.select(window).on('resize.seismograph'+this.plotId, function() {
      if ( ! mythis.beforeFirstDraw && mythis.checkResize() ) {
        mythis.draw();
      }
    });

  }

  disableWheelZoom() :void {
    this.svg.call(this.zoom).on("wheel.zoom", null);
  }

  checkResize() :boolean {
    let rect = this.svgParent.node().getBoundingClientRect();
    if (rect.width != this.outerWidth || rect.height != this.outerHeight) {
      return true;
    }
    return false;
  }
  draw() :void {
    let rect = this.svg.node().getBoundingClientRect();
    console.log("svgSeis draw bound rect: "+rect.width +"!="+ this.outerWidth +"  "+ rect.height +"!="+ this.outerHeight);
    if ((rect.width != this.outerWidth || rect.height != this.outerHeight)) {
      if (rect.height > this.seismographConfig.maxHeight) { rect.height = this.seismographConfig.maxHeight; }
      this.setWidthHeight(rect.width, rect.height);
    }
    this.drawSegments(this.traces, this.g.select("g.allsegments"));
    this.drawAxis(this.g);
    this.drawAxisLabels();
    this.drawMarkers(this.markers, this.g.select("g.allmarkers"));
    this.beforeFirstDraw = false;
  }

  calcScaleAndZoom() :void {
    this.rescaleYAxis();
    this.zoom = d3.zoom()
          .translateExtent([[0, 0], [this.width, this.height]])
          .extent([[0, 0], [this.width, this.height]]);
    // check if clip exists, wonky d3 convention
    let container = this.svg.select("defs").select("#"+CLIP_PREFIX+this.plotId);
    if (container.empty()) {
      this.svg.append("defs").append("clipPath").attr("id", CLIP_PREFIX+this.plotId);
    }
    let clip = this.svg.select("defs").select("#"+CLIP_PREFIX+this.plotId);

    clip.selectAll("rect").remove();
    clip.append("rect")
            .attr("width", this.width)
            .attr("height", this.height);
  }
  drawSegments(traceList: Array<Trace>, svgG: any) :void {
    let drawG = svgG;
    let mythis = this;

    let traceG = drawG
      .selectAll("g")
      .data(traceList);

    traceG.exit().remove();
    let segG = traceG
      .enter()
      .append("g")
        .attr("class", "trace");

     segG.each(function(trace, i) {
       console.log("in segG.each: "+i+" "+trace.segments.length);
       d3.select(this)
         .selectAll("g")
         .data(trace.segments)
         .enter()
         .append("g")
           .attr("class", "segment")
      .append("path")
        .attr("class", function(seg) {
            return "seispath "+seg.codes()+" orient"+seg.chanCode.charAt(2);
        })
        .attr("style", "clip-path: url(#"+CLIP_PREFIX+mythis.plotId+")")
        .attr("d", function(seg) {
           return mythis.segmentDrawLine(seg, mythis.xScale);
         });
     });
  }

  calcSecondsPerPixel(xScale :any) :number {
    let domain = xScale.domain(); // time so milliseconds
    let range = xScale.range(); // pixels
    return (domain[1].getTime()-domain[0].getTime())/1000 / (range[1]-range[0]);
  }

  segmentDrawLine(seg: Seismogram, xScale: any) :void {
    let secondsPerPixel = this.calcSecondsPerPixel(xScale);
    let samplesPerPixel = seg.sampleRate * secondsPerPixel;
    this.lineFunc.x(function(d) { return xScale(d.time); });
    if (samplesPerPixel < this.seismographConfig.segmentDrawCompressedCutoff) {
      if (! seg.y) {
        console.log("svgSeism seg.y not defined: "+(typeof seg)+" "+(seg instanceof Seismogram));
      return null;
      }
      return this.lineFunc(seg.y.map(function(d,i) {
        return {time: seg.timeOfSample(i).toDate(), y: d };
      }));
    } else {
      // lots of points per pixel so use high/low lines
      console.log('segmentDrawLine Lots points, draw using high/low');
      if ( ! seg.highlow
           || seg.highlow.secondsPerPixel != secondsPerPixel
           || seg.highlow.xScaleDomain[1] != xScale.domain()[1]) {
        let highlow = [];
        let numHL = 2*Math.ceil(seg.y.length/samplesPerPixel);
        for(let i=0; i<numHL; i++) {
          let snippet = seg.y.slice(i * samplesPerPixel,
                                    (i+1) * samplesPerPixel);
          if (snippet.length != 0) {
          highlow[2*i] = snippet.reduce(function(acc, val) {
            return Math.min(acc, val);
          }, snippet[0]);
          highlow[2*i+1] = snippet.reduce(function(acc, val) {
            return Math.max(acc, val);
          }, snippet[0]);
          }
        }
        seg.highlow = {
            xScaleDomain: xScale.domain(),
            xScaleRange: xScale.range(),
            secondsPerPixel: secondsPerPixel,
            samplesPerPixel: samplesPerPixel,
            highlowArray: highlow
        };
      }
      return this.lineFunc(seg.highlow.highlowArray.map(function(d :number,i :number) {
        return {time: new Date(seg.start.valueOf()+1000*((Math.floor(i/2)+.5)*secondsPerPixel)), y: d };
      }));
    }
  }

  drawAxis(svgG: any) :void {
    this.xAxis.tickFormat(this.seismographConfig.xScaleFormat);
    this.yAxis.ticks(8, this.seismographConfig.yScaleFormat);
    svgG.selectAll("g.axis").remove();
    svgG.append("g")
        .attr("class", "axis axis--x")
        .attr("transform", "translate(0," + this.height + ")")
        .call(this.xAxis);

    svgG.append("g")
        .attr("class", "axis axis--y")
        .call(this.yAxis);
  }

  rescaleYAxis() :void {
    if ( ! this.beforeFirstDraw) {
      let delay = 500;
      let myThis = this;
      if (this.throttleRescale) {
        window.clearTimeout(this.throttleRescale);
      }
      this.throttleRescale = window.setTimeout(
        function(){
          myThis.g.select(".axis--y").transition().duration(delay/2).call(myThis.yAxis);
          myThis.throttleRescale = null;
        }, delay);
    }
  }

  drawAxisLabels() :void {
    this.drawTitle();
    this.drawXLabel();
    this.drawXSublabel();
    this.drawYLabel();
    this.drawYSublabel();
  }

  resetZoom() :void {
    this.xScale = this.origXScale;
    if ( ! this.beforeFirstDraw) {
      this.redrawWithXScale(this.xScale);
    }
  }


  zoomed(mythis :SvgSeismograph) :void {
    let t = d3.event.transform;
    let xt = t.rescaleX(this.xScale);
    mythis.redrawWithXScale(xt);
  }

  redrawWithXScale(xt :any) :void {
    this.currZoomXScale = xt;
    let mythis = this;
    this.g.selectAll(".segment").select("path")
          .attr("d", function(seg) {
             return mythis.segmentDrawLine(seg, xt);
           });
    this.g.select("g.allmarkers").selectAll("g.marker")
          .attr("transform", function(marker :MarkerType) {
            let textx = xt( marker.time);
            return  "translate("+textx+","+0+")";});

     this.g.select("g.allmarkers").selectAll("g.markertext")
         .attr("transform", function(marker :MarkerType) {
           // shift up by this.seismographConfig.markerTextOffset percentage
           let maxY = mythis.yScale.range()[0];
           let deltaY = mythis.yScale.range()[0]-mythis.yScale.range()[1];
           let texty = maxY - mythis.seismographConfig.markerTextOffset*(deltaY);
           return  "translate("+0+","+texty+") rotate("+mythis.seismographConfig.markerTextAngle+")";});

     this.g.select("g.allmarkers").selectAll("path.markerpath")
       .attr("d", function(marker :MarkerType) {
         return d3.line()
           .x(function(d) {
             return 0; // g is translated so marker time is zero
           }).y(function(d, i) {
             return (i==0) ? 0 : mythis.yScale.range()[0];
           }).curve(d3.curveLinear)([ mythis.yScale.domain()[0], mythis.yScale.domain()[1] ] ); // call the d3 function created by line with data
      });
    this.g.select(".axis--x").call(this.xAxis.scale(xt));
    this.scaleChangeListeners.forEach(l => l.notifyScaleChange(xt));
  }

  drawMarkers(markers :Array<MarkerType>, markerG :any) {
    if ( ! markers) { markers = []; }
    // marker overlay
    let mythis = this;
    let labelSelection = markerG.selectAll("g.marker")
        .data(markers, function(d) {
              // key for data
              return d.name+"_"+d.time.valueOf();
            });
    labelSelection.exit().remove();

    let radianTextAngle = this.seismographConfig.markerTextAngle*Math.PI/180;

    labelSelection.enter()
        .append("g")
        .attr("class", function(m) { return "marker "+m.name+" "+m.markertype;})
           // translate so marker time is zero
        .attr("transform", function(marker) {
            let textx = mythis.currZoomXScale( marker.time);
            return  "translate("+textx+","+0+")";
          })
        .each(function(marker) {
          let drawG = d3.select(this);

          let innerTextG = drawG.append("g")
            .attr("class", "markertext")
            .attr("transform", function(marker) {
              // shift up by this.seismographConfig.markerTextOffset percentage
              let maxY = mythis.yScale.range()[0];
              let deltaY = mythis.yScale.range()[0]-mythis.yScale.range()[1];
              let texty = maxY - mythis.seismographConfig.markerTextOffset*(deltaY);
              return  "translate("+0+","+texty+") rotate("+mythis.seismographConfig.markerTextAngle+")";});
          innerTextG.append("title").text(function(marker) {
              return marker.name+" "+marker.time.toISOString();
          });
          innerTextG.append("text")
              .attr("dy", "-0.35em")
              .text(function(marker) {return marker.name;})
              .call(function(selection) {
                // this stores the BBox of the text in the bbox field for later use
                selection.each(function(t){
                    // set a default just in case
                    t.bbox = {height: 15, width:20};
                    try {
                      t.bbox = this.getBBox();
                    } catch(error) {
                      console.assert(false, error);
                      // this happens if the text is not yet in the DOM, I think
                      //  https://bugzilla.mozilla.org/show_bug.cgi?id=612118
                    }
                });
              });
          // draw/insert flag behind/before text
          innerTextG.insert("polygon", "text")
              .attr("points", function(marker) {
                let bboxH = marker.bbox.height+5;
                let bboxW = marker.bbox.width;
                return "0,0 "
                  +(-1*bboxH*Math.tan(radianTextAngle))+",-"+bboxH+" "
                  +bboxW+",-"+bboxH+" "
                  +bboxW+",0";
              });
// let style be in css?
//              .style("fill", "rgba(220,220,220,.4)");
          drawG.append("path")
            .classed("markerpath", true)
            .style("fill", "none")
            .style("stroke", "black")
            .style("stroke-width", "1px")
            .attr("d", function(marker) {
              return d3.line()
                .x(function(d) {
                  return 0; // g is translated so marker time is zero
                }).y(function(d, i) {
                  if (mythis.seismographConfig.markerFlagpoleBase === 'center') {
                    return (i==0) ? (mythis.yScale.range()[0]+mythis.yScale.range()[1])/2 : mythis.yScale.range()[0];
                  } else {
                    // mythis.seismographConfig.markerFlagpoleBase === 'bottom'
                    return (i==0) ? 0 : mythis.yScale.range()[0];
                  }
                }).curve(d3.curveLinear)([ mythis.yScale.domain()[0], mythis.yScale.domain()[1] ] ); // call the d3 function created by line with data

            });
        });
  }

  setWidthHeight(nOuterWidth: number, nOuterHeight: number) :void {
    this.outerWidth = nOuterWidth ? Math.max(200, nOuterWidth) : 200;
    this.outerHeight = nOuterHeight ? Math.max(100, nOuterHeight): 100;
    this.height = this.outerHeight - this.seismographConfig.margin.top - this.seismographConfig.margin.bottom;
    this.width = this.outerWidth - this.seismographConfig.margin.left - this.seismographConfig.margin.right;
    //this.svg.attr("viewBox", "0 0 "+this.outerWidth+" "+this.outerHeight);
    this.origXScale.range([0, this.width]);
    this.xScale.range([0, this.width]);
    this.currZoomXScale.range([0, this.width]);
    this.yScale.range([this.height, 0]);
    this.yScaleRmean.range([this.height, 0]);
    this.yAxis.scale(this.yScaleRmean);
    this.calcScaleAndZoom();
    if ( ! this.beforeFirstDraw) {
      this.redrawWithXScale(this.xScale);
    }
  }


  // see http://blog.kevinchisholm.com/javascript/javascript-function-throttling/
  throttle(func :() => void, delay: number) :void {
    if (this.throttleResize) {
      window.clearTimeout(this.throttleResize);
    }
    this.throttleResize = window.setTimeout(func, delay);
  }

  resizeNeeded() {
    let myThis = this;
    this.throttle(function(){
        myThis.draw();
    }, 250);
  }

  getPlotStart() :moment {
    return moment.utc(this.xScale.domain()[0]);
  }
  setPlotStart(value :moment) :SvgSeismograph {
    return this.setPlotStartEnd(value, this.xScale.domain()[1]);
  }
  getPlotEnd() :moment {
    return moment.utc(this.xScale.domain()[1]);
  }
  setPlotEnd(value :moment) :SvgSeismograph {
    return this.setPlotStartEnd(this.xScale.domain()[0], value);
  }
  setPlotStartEnd(startDate :moment, endDate :moment) :SvgSeismograph {
    const plotStart = (startDate instanceof Date) ? startDate : moment.utc(startDate).toDate();
    const plotEnd = (endDate instanceof Date) ? endDate : moment.utc(endDate).toDate();
    this.xScale.domain([ plotStart, plotEnd ]);
    if ( ! this.beforeFirstDraw) {
      this.redrawWithXScale(this.xScale);
    }
    return this;
  }

  setWidth(value :number) :SvgSeismograph {
    this.setWidthHeight(value, this.outerHeight);
    return this;
  }

  setHeight(value :number) :SvgSeismograph {
    this.setWidthHeight(this.outerWidth, value);
    return this;
  }

  setMargin(value :MarginType ) :SvgSeismograph {
    this.seismographConfig.margin = value;
    this.setWidthHeight(this.outerWidth, this.outerHeight);
    this.g.attr("transform", "translate(" + this.seismographConfig.margin.left + "," + this.seismographConfig.margin.top + ")");
    return this;
  }
  drawTitle() {
    this.svg.selectAll("g.title").remove();
    let titleSVGText = this.svg.append("g")
       .classed("title", true)
       .attr("transform", "translate("+(this.seismographConfig.margin.left+(this.width)/2)+", "+( this.seismographConfig.margin.bottom/3  )+")")
       .append("text").classed("title label", true)
       .attr("text-anchor", "middle");
    if (Array.isArray(this.seismographConfig.title)) {
      this.seismographConfig.title.forEach(function(s) {
        titleSVGText.append("tspan").text(s+" ");
      });
    } else {
      titleSVGText
        .text(thisseismographConfig.title);
    }
  }
  drawXLabel() :SvgSeismograph {
    this.svg.selectAll("g.xLabel").remove();
    this.svg.append("g")
       .classed("xLabel", true)
       .attr("transform", "translate("+(this.seismographConfig.margin.left+(this.width)/2)+", "+(this.outerHeight - this.seismographConfig.margin.bottom/3  )+")")
       .append("text").classed("x label", true)
       .attr("text-anchor", "middle")
       .text(this.seismographConfig.xLabel);
    return this;
  }
  drawYLabel() :SvgSeismograph {
    this.svg.selectAll('g.yLabel').remove();
    this.svg.append("g")
       .classed("yLabel", true)
       .attr("x", 0)
       .attr("transform", "translate(0, "+(this.seismographConfig.margin.top+(this.height)/2)+")")
       .append("text");
    svgText
       .classed("y label", true)
       .attr("dy", ".75em");
    if (this.seismographConfig.yLabelOrientation === "vertical") {
      // vertical
       svgText
       .attr("text-anchor", "middle")
       .attr("transform-origin", "center center")
       .attr("transform", "rotate(-90)");
    } else {
      // horizontal
      svgText.attr("text-anchor", "start")
    }
    svgText.text(this.seismographConfig.yLabel);
    return this;
  }
  drawXSublabel() :SvgSeismograph {
    this.svg.selectAll('g.xSublabel').remove();
    this.svg.append("g")
       .classed("xSublabel", true)
       .attr("transform", "translate("+(this.seismographConfig.margin.left+(this.width)/2)+", "+(this.outerHeight  )+")")
       .append("text").classed("x label sublabel", true)
       .attr("text-anchor", "middle")
       .text(this.seismographConfig.xSublabel);
    return this;
  }
  drawYSublabel() :SvgSeismograph {
    this.svg.selectAll('g.ySublabel').remove();
    this.svg.append("g")
       .classed("ySublabel", true)
       .attr("x", 0)
       .attr("transform", "translate( "+this.seismographConfig.ySublabelTrans+" , "+(this.seismographConfig.margin.top+(this.height)/2)+")")
       .append("text")
       .classed("y label sublabel", true)
       .attr("text-anchor", "middle")
       .attr("dy", ".75em")
       .attr("transform-origin", "center center")
       .attr("transform", "rotate(-90)")
       .text(this.seismographConfig.ySublabel);
    return this;
  }
  isDoRMean() :boolean {
    return this.seismographConfig.doRMean;
  }
  setDoRMean(value: boolean) {
    this.seismographConfig.doRMean = value;
    this.redoDisplayYScale();
  }
  isDoGain() :boolean {
    return this.seismographConfig.doGain;
  }
  setDoGain(value: boolean) {
    this.seismographConfig.doGain = value;
    this.redoDisplayYScale();
  }
  setInstrumentSensitivity(value: InstrumentSensitivity) {
    this.instrumentSensitivity = value;
    this.redoDisplayYScale();
  }
  clearMarkers() :SvgSeismograph {
    this.markers.length = 0; //set array length to zero deletes all
    if ( ! this.beforeFirstDraw) {
      this.drawMarkers(this.markers, this.g.select("g.allmarkers"));
    }
    return this;
  }
  getMarkers() :Array<MarkerType> {
    return this.markers;
  }
  appendMarkers(value: Array<MarkerType> | MarkerType) :SvgSeismograph {
    if (Array.isArray(value)) {
      for( let m of value) {
        this.markers.push(m);
      }
    } else {
      this.markers.push(value);
    }
    if ( ! this.beforeFirstDraw) {
      this.drawMarkers(this.markers, this.g.select("g.allmarkers"));
    }
    return this;
  }

  calcScaleDomain() :void {
    let minMax = findMinMax(this.traces);
    if (minMax[0] == minMax[1]) {
      // flatlined data, use -1, +1
      minMax = [ minMax[0]-1, minMax[1]+1];
    }
    this.yScale.domain(minMax).nice();
    this.redoDisplayYScale();
  }

  redoDisplayYScale() :void {
    let niceMinMax = this.yScale.domain();
    if (this.seismographConfig.doGain && this.instrumentSensitivity) {
      niceMinMax[0] = niceMinMax[0] / this.instrumentSensitivity.sensitivity;
      niceMinMax[1] = niceMinMax[1] / this.instrumentSensitivity.sensitivity;
      if (this.seismographConfig.ySublabelIsUnits) {
        this.seismographConfig.ySublabel = this.instrumentSensitivity.inputUnits;
      }
    } else {
      if (this.seismographConfig.ySublabelIsUnits && ! this.seismographConfig.ySublabel && ! this.instrumentSensitivity ) {
        this.seismographConfig.ySublabel = "";
        for (let t of this.traces) {
          this.seismographConfig.ySublabel += `${t.yUnit} `;
        }
        //this.seismographConfig.ySublabel = "Count";
      }
    }
    if (this.seismographConfig.doRMean) {
      this.yScaleRmean.domain([ (niceMinMax[0]-niceMinMax[1])/2, (niceMinMax[1]-niceMinMax[0])/2 ]);
    } else {
      this.yScaleRmean.domain(niceMinMax);
    }
    this.rescaleYAxis();
    this.drawYSublabel();
  }
  getSeismograms() :Array<Trace> {
    return this.traces;
  }
  /** can append single seismogram segment or an array of segments. */
  _internalAppend(seismogram: Array<Seismogram> | Seismogram| Trace ) :void {
    if (Array.isArray(seismogram)) {
      for(let s of seismogram) {
        this._internalAppend(s);
      }
    } else {
      this.traces.push(ensureIsTrace(seismogram));
    }
  }
  /** appends the seismogram(s) as separate time series. */
  append(seismogram: Array<Seismogram> | Seismogram) {
    this._internalAppend(seismogram);
    this.calcScaleDomain();
    if ( ! this.beforeFirstDraw) {
      // only trigger a draw if appending after already drawn on screen
      // otherwise, just append the data and wait for outside to call first draw()
      this.drawSegments(this.traces, this.g.select("g.allsegments"));
    }
    return this;
  }

  trim(timeWindow: TimeRangeType) :void {
    if (this.traces) {
      this.traces = this.traces.filter(function(d) {
        return d.end.isAfter(timeWindow.start);
      });
      if (this.traces.length > 0) {
        this.calcScaleDomain();
        this.drawSegments(this.traces, this.g.select("g.allsegments"));
      }
    }
  }
}


// static ID for seismogram
SvgSeismograph._lastID = 0;
