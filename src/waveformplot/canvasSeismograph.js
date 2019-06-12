// @flow

/*global window*/
/**
 * Philip Crotwell
 * University of South Carolina, 2014
 * http://www.seis.sc.edu
 */


import moment from 'moment';
import * as d3 from 'd3';

import {
    findStartEnd,
    findMinMax
  } from './util';
import {SeismographConfig, DRAW_SVG, DRAW_CANVAS, DRAW_BOTH} from './seismographconfig';
import type { MarginType, MarkerType } from './seismographconfig';
import {SeismogramSegment, Trace, ensureIsTrace } from '../seismogram';
import {InstrumentSensitivity} from '../stationxml';
import type {TimeRangeType} from '../seismogram';



const CLIP_PREFIX = "seismographclip";


export type ScaleChangeListenerType = {
  notifyScaleChange: (value: any) => void
}

/** A seismogram plot, using d3. The actual waveform can be drawn
  * with a separate Canvas (default) or with SVG.
  * Note that for SVG you must have
  * stroke and fill set in css like:<br>
  * path.seispath {
  *   stroke: skyblue;
  *   fill: none;
  * }<br/>
  * in order to have the seismogram display.
  */
export class CanvasSeismograph {
  static _lastID: number;
  plotId: number;
  beforeFirstDraw: boolean;
  seismographConfig: SeismographConfig;
  plotStartDate: moment;
  plotEndDate: moment;

  svgParent: any;
  traces: Array<Trace>;
  markers: Array<MarkerType>;
  width: number;
  height: number;
  outerWidth: number;
  outerHeight: number;
  scaleChangeListeners: Array<ScaleChangeListenerType>;
  svg: any;
  canvas: any;
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
  constructor(inSvgParent: any,
              seismographConfig: SeismographConfig,
              inSegments: Array<Trace>,
              plotStartDate: moment,
              plotEndDate: moment) {
    if (inSvgParent == null) {throw new Error("inSvgParent cannot be null");}
    this.plotId = ++CanvasSeismograph._lastID;
    this.beforeFirstDraw = true;
    this.seismographConfig = seismographConfig;
    this.plotStartDate = plotStartDate;
    this.plotEndDate = plotEndDate;
    this.width = 200;
    this.height = 100;

    this.svgParent = inSvgParent;
    // need relative position in parent div to allow absolute position
    // of svg and canvas for overlaying
    this.svgParent.style("position", "relative");
    this.traces = [];
    this._internalAppend(inSegments);
    this.markers = [];

    this.canvas = null;

    this.svg = this.svgParent.append("svg")
      .style("z-index", 100);
    this.svg.classed("seismograph", true);
    //this.svg.classed("svg-content-responsive", true);
    this.svg.attr("version", "1.1");
    this.svg.style("postition", "absolute");
    this.svg.style("top", "0px");
    this.svg.style("left", "0px");
    //this.svg.attr("preserveAspectRatio", "xMinYMin meet");
    //this.svg.attr("viewBox", `0 0 ${this.width} ${this.height}`);
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
  //  this.svg.call(this.zoom);

    this.calcScaleDomain();
    //this.setWidthHeight(this.width, this.height);

    // create marker g
    this.g.append("g").attr("class", "allmarkers")
        .attr("style", "clip-path: url(#"+CLIP_PREFIX+this.plotId+")");
    d3.select(window).on('resize.canvasseismograph'+mythis.plotId, function() {
      console.log('canvas resize.seismograph'+mythis.plotId+" ");
      if ( ! mythis.beforeFirstDraw && mythis.checkResize() ) {
        mythis.draw();
      }
    });

  }

  disableWheelZoom(): void {
    this.svg.call(this.zoom).on("wheel.zoom", null);
    if (this.canvas) {
      this.canvas.call(this.zoom).on("wheel.zoom", null);
    }
  }

  checkResize(): boolean {
    let rect = this.svg.node().getBoundingClientRect();
    if (rect.width != this.outerWidth || rect.height != this.outerHeight) {
      return true;
    }
    return false;
  }
  draw(): void {
    let rect = this.svg.node().getBoundingClientRect();
    if ((rect.width != this.outerWidth || rect.height != this.outerHeight)) {
      if (rect.height < this.seismographConfig.minHeight) { rect.height = this.seismographConfig.minHeight; }
      if (rect.height > this.seismographConfig.maxHeight) { rect.height = this.seismographConfig.maxHeight; }
      this.setWidthHeight(rect.width, rect.height);
    }
    if ( ! this.canvas ) {
      this.canvas = this.svgParent.insert("canvas",":first-child").classed("seismograph", true);
      const mythis = this;
      this.canvas.call(d3.zoom().on("zoom", function () {
        mythis.zoomed(mythis);
     }));
     if (this.seismographConfig.disableWheelZoom) {
       this.disableWheelZoom();
     }
      this.canvas.attr("height", this.outerHeight)
        .attr("width", this.outerWidth)
        .style("z-index", "-1"); // make sure canvas is below svg
      let style = window.getComputedStyle(this.canvas.node());
      let padTop = style.getPropertyValue('padding-top');
      if (padTop.endsWith("px")) {
        padTop = Number(padTop.replace("px", ""));
      }
      let borderTop = style.getPropertyValue('border-top-width');
      if (borderTop.endsWith("px")) {
        borderTop = Number(borderTop.replace("px", ""));
      }
      this.sizeCanvas();
    }
    this.drawTraces();
    this.drawAxis(this.g);
    this.drawAxisLabels();
    this.drawMarkers(this.markers, this.g.select("g.allmarkers"));
    //this.drawCanvasAlignment();
    this.beforeFirstDraw = false;
  }
  printSizes(): void {
    let rect = this.svg.node().getBoundingClientRect();
    console.log("svg rect.height "+rect.height);
    console.log("svg rect.width "+rect.width);
    let grect = this.svgParent.node().getBoundingClientRect();
    console.log("parent rect.height "+grect.height);
    console.log("parent rect.width "+grect.width);
      let crect = this.canvas.node().getBoundingClientRect();
      console.log("c rect.height "+crect.height);
      console.log("c rect.width "+crect.width);
        console.log("c style.height "+this.canvas.style("height"));
        console.log("c style.width "+this.canvas.style("width"));
    console.log("this.height "+this.height);
    console.log("this.width "+this.width);
  console.log("canvas.height "+this.canvas.node().height);
  console.log("canvas.width "+this.canvas.node().width);
    console.log("this.outerHeight "+this.outerHeight);
    console.log("this.outerWidth "+this.outerWidth);
    // $FlowFixMe
    console.log("this.margin "+this.seismographConfig.margin);
  }
  sizeCanvas(): void {
    // resize canvas if exists
    if ( this.canvas) {
      // this.canvas
      //     .attr('height', this.outerHeight- this.seismographConfig.margin.top- this.seismographConfig.margin.bottom)
      //.attr('width', this.outerWidth- this.seismographConfig.margin.left- this.seismographConfig.margin.right)
      //.style('position', 'absolute')
      //     .style('top', Math.round(1.0*this.outerHeight/this.height*this.seismographConfig.margin.top) + 'px')
      //     .style('left', Math.round(1.0*this.outerWidth/this.width*this.seismographConfig.margin.left) + 'px');
      //this.svg.attr('height', this.outerHeight+'px').attr('width', this.outerWidth+'px');

      this.canvas
        .style('position', 'absolute')
        .style('top', (0) + 'px')
        .style('left', (0) + 'px');
        //.style('top', (this.seismographConfig.margin.top) + 'px')
        //.style('left', (this.seismographConfig.margin.left) + 'px');
            //  .attr('height', (this.height)+'px')
            //  .attr('width', (this.width)+'px');
          //    .style('position', 'absolute')

      const canvasNode = this.canvas.node();
      if ( ! canvasNode) {
        console.log("sizeCanvas Canvas.node() is null: "+canvasNode);
      }
      canvasNode.height = this.outerHeight;
      canvasNode.width = this.outerWidth;
    }
  }

  drawTraces() {
    if (this.seismographConfig.drawingType === DRAW_CANVAS || this.seismographConfig.drawingType === DRAW_BOTH) {
      this.drawTracesCanvas();
    }
    if (this.seismographConfig.drawingType === DRAW_SVG || this.seismographConfig.drawingType === DRAW_BOTH) {
      this.drawTracesSvg();
    }
  }
  isVisible(): boolean {
    const elem = this.canvas.node();
    if (! elem) { return false; }
    return !!( elem.offsetWidth || elem.offsetHeight || elem.getClientRects().length );
  }
  drawTracesCanvas(): void {
    if (! this.isVisible()) {
      // no need to draw if we are not visible
      return;
    }
    // get the canvas drawing context
    const canvasNode = this.canvas.node();
    if ( ! canvasNode) {
      console.log("Canvas.node() is null: "+canvasNode);
    }
    const context = canvasNode.getContext("2d");
    context.save();
    // clear the canvas from previous drawing
    context.clearRect(0, 0, canvasNode.width, canvasNode.height);
    context.translate(this.seismographConfig.margin.left, this.seismographConfig.margin.top);
    // Create clipping path
    context.beginPath();
    context.rect(0, 0, this.width, this.height);
    context.clip();

    context.lineWidth = this.seismographConfig.lineWidth;

    const plotStart = moment.utc(this.currZoomXScale.domain()[0]);
    const plotEnd = moment.utc(this.currZoomXScale.domain()[1]);
    const plotDuration = moment.duration(plotEnd.diff(plotStart));
    const secondsPerPixel = plotDuration.asSeconds()/
        (this.currZoomXScale.range()[1]-this.currZoomXScale.range()[0]);

    this.traces.forEach( (t,ti) => {
//      const color = d3.select(`svg g.allsegments g:nth-child(9n+1) g path.seispath`)
      const color = this.seismographConfig.getColorForIndex(ti);
      let firstTime = true;
      t.seisArray.forEach((s) => {
        if (s.start.isAfter(moment.utc(this.currZoomXScale.domain()[1])) ||
            s.end.isBefore(moment.utc(this.currZoomXScale.domain()[0]))) {
              // segment either totally off to left or right of visible
              return;
        }
        const samplesPerPixel = 1.0*s.sampleRate*secondsPerPixel;
        const pixelsPerSample = 1.0/samplesPerPixel;
        const startPixel = this.currZoomXScale(s.start.toDate());
        const endPixel = this.currZoomXScale(s.end.toDate());
        let leftVisibleSample = 0;
        let rightVisibleSample = s.y.length;
        let leftVisiblePixel = startPixel;
        if (startPixel < 0) {
          leftVisibleSample = Math.floor(-1*startPixel*samplesPerPixel) -1;
          leftVisiblePixel = 0;
        }
        if (endPixel > this.width) {
          rightVisibleSample = leftVisibleSample+Math.ceil((this.width+1)*samplesPerPixel) +1;
        }
        //console.log(`${ti} ${si} ls${leftVisibleSample} rs${rightVisibleSample}  lp${leftVisiblePixel} rp${rightVisiblePixel} `);
        if (firstTime || ! this.seismographConfig.connectSegments ){
          context.beginPath();
          context.strokeStyle = color;
          //context.lineWidth = 5;
          context.moveTo(leftVisiblePixel, this.yScale(s.y[leftVisibleSample]));
          firstTime = false;
        }
        for(let i=leftVisibleSample; i<rightVisibleSample && i<s.y.length; i++) {

          context.lineTo(startPixel+i*pixelsPerSample, this.yScale(s.y[i]));
        }
        if (! this.seismographConfig.connectSegments ){
          context.stroke();
        }
      });

      if (this.seismographConfig.connectSegments ){
        context.stroke();
      }
    });
    context.restore();
  }
  drawCanvasAlignment(): void {
    const mythis = this;
    let radius = 10;
    // draw corners in svg for comparison
    let minX = this.currZoomXScale.domain()[0];
    let maxX = this.currZoomXScale.domain()[1];
    let minY = this.yScale.domain()[0];
    let maxY = this.yScale.domain()[1];
    this.g.selectAll("circle").remove();
    let circles = this.g.selectAll("circle").data([ [minX, minY],
                                      [minX, maxY],
                                      [maxX, minY],
                                      [maxX, maxY]]);
    circles.exit().remove();
    circles
      .enter().append("circle")
      .attr('cx', function(d){  return mythis.currZoomXScale(d[0]);})
      .attr('cy', function(d){  return mythis.yScale(d[1]);})
      .attr('r', radius+2);
      console.log("svg draw red: "+mythis.currZoomXScale(maxX)+", "+mythis.yScale(minY));

    this.g.selectAll("path.diagonal").remove();
    this.g.append("path").attr("class",  "seispath diagonal").attr("d", "M0,0L"+mythis.currZoomXScale(maxX)+", "+mythis.yScale(minY));

    // get the canvas drawing context
    const canvasNode = this.canvas.node();
    if ( ! canvasNode) {
      console.log("Canvas.node() is null: "+canvasNode);
    }
    //canvasNode.height = this.height;
    //canvasNode.width = this.width;
    const context = canvasNode.getContext("2d");
    // clear the canvas from previous drawing
    context.clearRect(0, 0, canvasNode.width, canvasNode.height);
    context.translate(this.seismographConfig.margin.left, this.seismographConfig.margin.top);
    // Create clipping path
    //  context.beginPath();
    //  context.rect(0, 0, this.width, this.height);
    //  context.clip();
    context.beginPath();
    context.fillStyle = "lightblue";
    context.arc(this.xScale(minX), this.yScale(minY), radius, 0, 2*Math.PI, true);
    context.fill();
    context.beginPath();
    context.fillStyle = "red";
    console.log("draw red: "+this.xScale(this.xScale.domain()[1])+", "+this.yScale(this.yScale.domain()[0]));
    context.arc(this.xScale(maxX), this.yScale(minY), radius, 0, 2*Math.PI, true);
    //context.arc(this.width-10, 10, radius, 0, 2*Math.PI, true);
    context.fill();
    context.beginPath();
    context.fillStyle = "green";
    context.arc(this.xScale(minX), this.yScale(maxY), radius, 0, 2*Math.PI, true);
    //context.arc(this.width-10, this.height-10, radius, 0, 2*Math.PI, true);
    context.fill();
    context.beginPath();
    context.fillStyle = "black";
    context.arc(this.xScale(maxX), this.yScale(maxY), radius, 0, 2*Math.PI, true);
    //context.arc(10, this.height-10, radius, 0, 2*Math.PI, true);
    context.fill();
    context.beginPath();
    context.moveTo(this.xScale(this.xScale.domain()[0]), this.yScaleRmean(0));
    context.lineTo(this.xScale(this.xScale.domain()[1]), this.yScaleRmean(0));
    context.moveTo(0,0);
    context.lineTo(this.width, this.height);
    context.stroke();
    context.beginPath();
    context.strokeStyle = "red";
    context.moveTo(this.xScale(this.xScale.domain()[1]), this.yScaleRmean(this.yScaleRmean.domain()[0]));
    context.lineTo(this.xScale(this.xScale.domain()[0]), this.yScaleRmean(this.yScaleRmean.domain()[1]));
    context.stroke();
  //  this.printSizes();
  }
  calcScaleAndZoom(): void {
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
  drawTracesSvg() {
    const mythis = this;
    const allSegG = this.g.select("g.allsegments");
    const traceJoin = allSegG.selectAll("g")
      .data(this.traces);
    traceJoin.exit().remove();
    traceJoin.enter()
      .append("g")
        .attr("class", "trace");

    const subtraceJoin = allSegG.selectAll("g")
      .selectAll('g')
       .data(function(trace) {console.log(`segG trace seg: ${trace.segments.length}`);return trace.segments;});
    subtraceJoin.enter()
       .append("g")
         .attr("class", "segment")
    .append("path")
      .attr("class", function(seg) {
          return "seispath "+seg.codes()+" orient"+seg.chanCode.charAt(2);
      })
      .attr("style", "clip-path: url(#"+CLIP_PREFIX+mythis.plotId+")")
      .merge(subtraceJoin)
      .attr("d", function(seg) {
         return mythis.segmentDrawLine(seg, mythis.currZoomXScale);
       });
  }

  calcSecondsPerPixel(xScale: any): number {
    let domain = xScale.domain(); // time so milliseconds
    let range = xScale.range(); // pixels
    return (domain[1].getTime()-domain[0].getTime())/1000 / (range[1]-range[0]);
  }

  segmentDrawLine(seg: SeismogramSegment, xScale: any): void {
    let secondsPerPixel = this.calcSecondsPerPixel(xScale);
    let samplesPerPixel = seg.sampleRate * secondsPerPixel;
    this.lineFunc.x(function(d) { return xScale(d.time); });
    if (samplesPerPixel < this.seismographConfig.segmentDrawCompressedCutoff) {
      if (! seg.y) {
        // $FlowFixMe
        console.log("canvasSeis seg.y not defined: "+(typeof seg)+" "+(seg instanceof Trace));
        return;
      }
      return this.lineFunc(seg.y.map(function(d,i) {
        return {time: seg.timeOfSample(i).toDate(), y: d };
      }));
    } else {
      // lots of points per pixel so use high/low lines
      console.log('segmentDrawLine Lots points, draw using high/low');
      if ( ! seg._highlow
           || seg._highlow.secondsPerPixel != secondsPerPixel
           || seg._highlow.xScaleDomain[1] != xScale.domain()[1]) {
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
        seg._highlow = {
            xScaleDomain: xScale.domain(),
            xScaleRange: xScale.range(),
            secondsPerPixel: secondsPerPixel,
            samplesPerPixel: samplesPerPixel,
            highlowArray: highlow
        };
      }
      return this.lineFunc(seg._highlow.highlowArray.map(function(d: number,i: number) {
        return {time: new Date(seg.start.valueOf()+1000*((Math.floor(i/2)+.5)*secondsPerPixel)), y: d };
      }));
    }
  }

  drawAxis(svgG: any): void {
    this.xAxis.tickFormat(this.seismographConfig.xScaleFormat);
    this.yAxis.ticks(8, this.seismographConfig.yScaleFormat);
    svgG.selectAll("g.axis").remove();
    if (this.seismographConfig.isXAxis) {
      svgG.append("g")
          .attr("class", "axis axis--x")
          .attr("transform", "translate(0," + this.height + ")")
          .call(this.xAxis);
    }
    if (this.seismographConfig.isYAxis) {
      svgG.append("g")
          .attr("class", "axis axis--y")
          .call(this.yAxis);
    }
  }

  rescaleYAxis(): void {
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

  drawAxisLabels(): void {
    this.drawTitle();
    this.drawXLabel();
    this.drawXSublabel();
    this.drawYLabel();
    this.drawYSublabel();
  }

  resetZoom(): void {
    this.xScale = this.origXScale;
    if ( ! this.beforeFirstDraw) {
      this.redrawWithXScale(this.xScale);
    }
  }


  zoomed(mythis: CanvasSeismograph): void {
    console.log("zoomed");
    let t = d3.event.transform;
    let xt = t.rescaleX(this.xScale);
    mythis.redrawWithXScale(xt);
  }

  redrawWithXScale(xt: any): void {
    this.currZoomXScale = xt;
    let mythis = this;
    this.g.select("g.allsegments").selectAll("g.trace").remove();
      //
      // .each(function(d, i) {
      //   console.log(`redrawWithXScale trace ${i}`);
      //   let trace = mythis.traces[i];
      //   let segG = d3.select(this)
      //     .selectAll("g.segment")
      //     .select("path")
      //     .attr("d", function(dd, j) {
      //       console.log(`redrawWithXScale trace ${i} seg ${j}`);
      //        return mythis.segmentDrawLine(trace.segments[j], mythis.currZoomXScale);
      //      });
      // });
    this.drawTraces();
    //this.drawSegments(this.traces, this.g.select("g.allsegments"));
    this.g.select("g.allmarkers").selectAll("g.marker")
          .attr("transform", function(marker: MarkerType) {
            let textx = xt( marker.time);
            return  "translate("+textx+","+0+")";});

     this.g.select("g.allmarkers").selectAll("g.markertext")
         .attr("transform", function(marker: MarkerType) {
             // shift up by this.seismographConfig.markerTextOffset percentage
             let maxY = mythis.yScale.range()[0];
             let deltaY = mythis.yScale.range()[0]-mythis.yScale.range()[1];
             let texty = maxY - mythis.seismographConfig.markerTextOffset*(deltaY);
             return  "translate("+0+","+texty+") rotate("+mythis.seismographConfig.markerTextAngle+")";
           });

     this.g.select("g.allmarkers").selectAll("path.markerpath")
       .attr("d", function(marker: MarkerType) {
         return d3.line()
           .x(function() {
             return 0; // g is translated so marker time is zero
           }).y(function(d, i) {
             return (i==0) ? 0 : mythis.yScale.range()[0];
           }).curve(d3.curveLinear)([ mythis.yScale.domain()[0], mythis.yScale.domain()[1] ] ); // call the d3 function created by line with data
      });
    this.g.select(".axis--x").call(this.xAxis.scale(xt));
    this.scaleChangeListeners.forEach(l => l.notifyScaleChange(xt));
  }

  drawMarkers(markers: Array<MarkerType>, markerG: any) {
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
            if (marker.description) {
              return marker.description;
            } else {
              return marker.name+" "+marker.time.toISOString();
            }
          });
          let textSel = innerTextG.append("text");
          if (marker.link && marker.link.length > 0) {
            // if marker has link, make it clickable
            textSel.append("svg:a")
              .attr("xlink:href",function(marker) {return marker.link;})
              .text(function(marker) {return marker.name;});
          } else {
            textSel.text(function(marker) {return marker.name;});
          }
          textSel
              .attr("dy", "-0.35em")
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
                  let out = 0;
                  if (mythis.seismographConfig.markerFlagpoleBase === 'center') {
                    out = (i==0) ? 0: (mythis.yScale.range()[0]+mythis.yScale.range()[1])/2 ;
                  } else {
                    // mythis.seismographConfig.markerFlagpoleBase === 'bottom'
                    out = (i==0) ? 0 : mythis.yScale.range()[0];
                  }
                  return out;
                }).curve(d3.curveLinear)([ mythis.yScale.domain()[0], mythis.yScale.domain()[1] ] ); // call the d3 function created by line with data

            });
        });
  }

  setWidthHeight(nOuterWidth: number, nOuterHeight: number): void {
    //console.log("setWidthHeight: outer: "+nOuterWidth+" "+nOuterHeight);
    this.outerWidth = Math.round(nOuterWidth ? Math.max(200, nOuterWidth) : 200);
    this.outerHeight = Math.round(nOuterHeight ? Math.max(100, nOuterHeight): 100);
    this.height = this.outerHeight - this.seismographConfig.margin.top - this.seismographConfig.margin.bottom;
    this.width = this.outerWidth - this.seismographConfig.margin.left - this.seismographConfig.margin.right;

      //console.log("setWidthHeight: inner: "+this.width+" "+this.height);
    //this.svg.attr("viewBox", "0 0 "+this.outerWidth+" "+this.outerHeight);
    this.origXScale.range([0, this.width]);
    this.xScale.range([0, this.width]);
    this.currZoomXScale.range([0, this.width]);
    this.yScale.range([this.height, 0]);
    this.yScaleRmean.range([this.height, 0]);
    this.yAxis.scale(this.yScaleRmean);
    this.calcScaleAndZoom();
    this.sizeCanvas();
    if ( ! this.beforeFirstDraw) {
      this.redrawWithXScale(this.xScale);
    }
  }


  // see http://blog.kevinchisholm.com/javascript/javascript-function-throttling/
  throttle(func: () => void, delay: number): void {
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

  getPlotStart(): moment {
    return moment.utc(this.xScale.domain()[0]);
  }
  setPlotStart(value: moment): CanvasSeismograph {
    return this.setPlotStartEnd(value, this.xScale.domain()[1]);
  }
  getPlotEnd(): moment {
    return moment.utc(this.xScale.domain()[1]);
  }
  setPlotEnd(value: moment): CanvasSeismograph {
    return this.setPlotStartEnd(this.xScale.domain()[0], value);
  }
  setPlotStartEnd(startDate: moment, endDate: moment): CanvasSeismograph {
    const plotStart = (startDate instanceof Date) ? startDate : moment.utc(startDate).toDate();
    const plotEnd = (endDate instanceof Date) ? endDate : moment.utc(endDate).toDate();
    this.xScale.domain([ plotStart, plotEnd ]);
    if ( ! this.beforeFirstDraw) {
      this.redrawWithXScale(this.xScale);
    }
    return this;
  }
  setWidth(value: number): CanvasSeismograph {
    this.setWidthHeight(value, this.outerHeight);
    return this;
  }
  setHeight(value: number): CanvasSeismograph {
    this.setWidthHeight(this.outerWidth, value);
    return this;
  }

  setMargin(value: MarginType ): CanvasSeismograph {
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
        .text(this.seismographConfig.title);
    }
  }
  drawXLabel(): CanvasSeismograph {
    this.svg.selectAll("g.xLabel").remove();
    if (this.seismographConfig.xLabel && this.seismographConfig.xLabel.length > 0) {
      this.svg.append("g")
         .classed("xLabel", true)
         .attr("transform", "translate("+(this.seismographConfig.margin.left+(this.width)/2)+", "+(this.outerHeight - this.seismographConfig.margin.bottom/3  )+")")
         .append("text").classed("x label", true)
         .attr("text-anchor", "middle")
         .text(this.seismographConfig.xLabel);
    }
    return this;
  }
  drawYLabel(): CanvasSeismograph {
    this.svg.selectAll('g.yLabel').remove();
    let svgText = this.svg.append("g")
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
      svgText.attr("text-anchor", "start");
    }
    svgText.text(this.seismographConfig.yLabel);
    return this;
  }
  drawXSublabel(): CanvasSeismograph {
    this.svg.selectAll('g.xSublabel').remove();
    this.svg.append("g")
       .classed("xSublabel", true)
       .attr("transform", "translate("+(this.seismographConfig.margin.left+(this.width)/2)+", "+(this.outerHeight  )+")")
       .append("text").classed("x label sublabel", true)
       .attr("text-anchor", "middle")
       .text(this.seismographConfig.xSublabel);
    return this;
  }
  drawYSublabel(): CanvasSeismograph {
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
  isDoRMean(): boolean {
    return this.seismographConfig.doRMean;
  }
  setDoRMean(value: boolean) {
    this.seismographConfig.doRMean = value;
    this.redoDisplayYScale();
  }
  isDoGain(): boolean {
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
  clearMarkers(): CanvasSeismograph {
    this.markers.length = 0; //set array length to zero deletes all
    if ( ! this.beforeFirstDraw) {
      this.drawMarkers(this.markers, this.g.select("g.allmarkers"));
    }
    return this;
  }
  getMarkers(): Array<MarkerType> {
    return this.markers;
  }
  appendMarkers(value: Array<MarkerType> | MarkerType): CanvasSeismograph {
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

  calcScaleDomain(): void {
    if (this.seismographConfig.fixedYScale) {
      this.yScale.domain(this.seismographConfig.fixedYScale);
    } else {
      let minMax = findMinMax(this.traces);
      if (minMax[0] == minMax[1]) {
        // flatlined data, use -1, +1
        minMax = [ minMax[0]-1, minMax[1]+1];
      }
      this.yScale.domain(minMax).nice();
    }
    this.redoDisplayYScale();
  }
  redoDisplayYScale(): void {
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
  getSeismograms(): Array<Trace> {
    return this.traces;
  }
  /** can append single seismogram segment or an array of segments. */
  _internalAppend(seismogram: Array<Trace> | Trace ): void {
    if ( ! seismogram) {
      // don't append a null
    } else if (Array.isArray(seismogram)) {
      for(let s of seismogram) {
        this.traces.push(ensureIsTrace(s));
      }
    } else {
      this.traces.push(ensureIsTrace(seismogram));
    }
  }
  /** appends the seismogram(s) as separate time series. */
  append(seismogram: Array<Trace> | Trace) {
    this._internalAppend(seismogram);
    this.calcScaleDomain();
    if ( ! this.beforeFirstDraw) {
      // only trigger a draw if appending after already drawn on screen
      // otherwise, just append the data and wait for outside to call first draw()
      this.drawTraces();
      //this.drawSegments(this.traces, this.g.select("g.allsegments"));
    }
    return this;
  }
  remove(trace: Trace): void {
    this.traces = this.traces.filter( t => t !== trace);
  }
  replace(oldTrace: Trace, newTrace: Trace): void {
    let index = this.traces.findIndex(t => t === oldTrace);
    if (index !== -1) {
      this.traces[index] = newTrace;
    } else {
      index = this.traces.findIndex(t => t.codes() === oldTrace.codes());
      if (index !== -1) {
        this.traces[index] = newTrace;
      } else {
        this.traces.push(newTrace);
      }
    }
  }
  trim(timeWindow: TimeRangeType): void {
    if (this.traces) {
      this.traces = this.traces.filter(function(d) {
        return d.end.isAfter(timeWindow.start);
      });
      if (this.traces.length > 0) {
        this.calcScaleDomain();
        this.drawTraces();
        //this.drawSegments(this.traces, this.g.select("g.allsegments"));
      }
    }
  }
}


// static ID for seismogram
CanvasSeismograph._lastID = 0;
