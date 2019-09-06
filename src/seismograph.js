// @flow

/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */


import moment from 'moment';
import * as d3 from 'd3';

import {insertCSS} from './plotutil.js';

import {SeismographConfig,
        DRAW_SVG, DRAW_CANVAS, DRAW_BOTH, DRAW_BOTH_ALIGN} from './seismographconfig';
import type { MarkerType } from './seismogram.js';
import type { MarginType } from './seismographconfig';
import {SeismogramDisplayData, findStartEnd, findMinMax, findMinMaxOverTimeRange,
        SeismogramSegment, Seismogram, ensureIsSeismogram } from './seismogram.js';
import {InstrumentSensitivity} from './stationxml.js';
import {Quake} from './quakeml.js';

import {StartEndDuration, isDef} from './util';



const CLIP_PREFIX = "seismographclip";


export type ScaleChangeListenerType = {
  destinationKey: any,
  notifyScaleChange: (value: any) => void
}

/* A seismogram plot, using d3. The actual waveform can be drawn
  * with a separate Canvas (default) or with SVG.
  * Note that for SVG you must have
  * stroke and fill set in css like:<br>
  * path.seispath {
  *   stroke: skyblue;
  *   fill: none;
  * }<br/>
  * in order to have the seismogram display.
  */
export class Seismograph {
  /** @private */
  static _lastID: number;
  plotId: number;
  beforeFirstDraw: boolean;

  svgParent: any;
  seismographConfig: SeismographConfig;
  seisDataList: Array<SeismogramDisplayData>;

  width: number;
  height: number;
  outerWidth: number;
  outerHeight: number;
  svg: any;
  canvas: any;
  xScale: any;
  origXScale: any;
  currZoomXScale: any;
  yScale: any;
  yScaleRmean: any;
  lineFunc: any;
  zoom: any;
  xAxis: any;
  yAxis: any;
  g: any;
  throttleRescale: any;
  throttleResize: any;
  xScaleChangeListeners: Array<ScaleChangeListenerType>;
  yScaleChangeListeners: Array<ScaleChangeListenerType>;
  constructor(inSvgParent: any,
              seismographConfig: SeismographConfig,
              seisData: Array<SeismogramDisplayData> | Array<Seismogram> | SeismogramDisplayData | Seismogram) {
    if (inSvgParent === null) {throw new Error("inSvgParent cannot be null");}
    this.plotId = ++Seismograph._lastID;
    this.beforeFirstDraw = true;
    this.seismographConfig = seismographConfig;
    this.seisDataList = [];
    this._internalAppend(seisData);

    this.width = 200;
    this.height = 100;

    this.svgParent = inSvgParent;
    // need relative position in parent div to allow absolute position
    // of svg and canvas for overlaying
    this.svgParent.style("position", "relative");

    this.canvas = null;

    this.svg = this.svgParent.append("svg")
      .style("z-index", 100);
    this.svg.classed("seismograph", true);
    //this.svg.classed("svg-content-responsive", true);
    this.svg.attr("version", "1.1");
    this.svg.style("position", "absolute");
    this.svg.style("top", "0px");
    this.svg.style("left", "0px");
    //this.svg.attr("preserveAspectRatio", "xMinYMin meet");
    //this.svg.attr("viewBox", `0 0 ${this.width} ${this.height}`);
    this.svg.attr("plotId", this.plotId);


    this.calcTimeScaleDomain();
    this.yScale = d3.scaleLinear();
    // yScale for axis (not drawing) that puts mean at 0 in center
    this.yScaleRmean = d3.scaleLinear();
    this.xScaleChangeListeners = [];
    this.yScaleChangeListeners = [];

    this.xAxis = d3.axisBottom(this.xScale).tickFormat(this.seismographConfig.xScaleFormat);
    this.yAxis = d3.axisLeft(this.yScaleRmean).ticks(8, this.seismographConfig.yScaleFormat);

    let mythis = this;
    this.lineFunc = d3.line()
      .curve(d3.curveLinear)
      .x(function(d) {return mythis.xScale(d.time); })
      .y(function(d) {return mythis.yScale(d.y); });

    let maxZoom = 8;
    if (this.seisDataList && this.seisDataList.length>0) {
      let maxSps = 1;
      maxSps = this.seisDataList.filter(sdd => sdd.seismogram !== null)
          .reduce(function(accum, sdd) {
            // for flow
            if ( ! sdd.seismogram) {return 1;}
            return Math.max(accum, sdd.seismogram.sampleRate);
          }, maxSps);
      let secondsPerPixel = this.calcSecondsPerPixel( mythis.xScale);
      let samplesPerPixel = maxSps * secondsPerPixel;
      let zoomLevelFactor = samplesPerPixel*this.seismographConfig.maxZoomPixelPerSample;
      maxZoom = Math.max(maxZoom,
                         Math.pow(2, Math.ceil(Math.log(zoomLevelFactor)/Math.log(2))));
    }

    this.g = this.svg.append("g")
      .attr("transform", "translate(" + this.seismographConfig.margin.left + "," + this.seismographConfig.margin.top + ")");
    this.g.append("g").attr("class", "allsegments");
    let z = this.svg.call(d3.zoom().on("zoom", function () {
        mythis.zoomed(mythis);
      }));
    if ( ! this.seismographConfig.wheelZoom) {
      z.on("wheel.zoom", null);
    }

    this.calcAmpScaleDomain();
    //this.setWidthHeight(this.width, this.height);

    // create marker g
    this.g.append("g").attr("class", "allmarkers")
        .attr("style", "clip-path: url(#"+CLIP_PREFIX+this.plotId+")");
    d3.select(window).on('resize.canvasseismograph'+mythis.plotId, function() {
      if ( ! mythis.beforeFirstDraw && mythis.checkResize() ) {
        mythis.draw();
      }
    });

  }
  static fromSeismograms(inSvgParent: any,
                seismographConfig: SeismographConfig,
                seismogramList: Array<Seismogram>) {
    return new Seismograph(inSvgParent,
                           seismographConfig,
                           seismogramList.map(s => SeismogramDisplayData.fromSeismogram(s)));
  }

  checkResize(): boolean {
    let rect = this.svg.node().getBoundingClientRect();
    if (rect.width !== this.outerWidth || rect.height !== this.outerHeight) {
      return true;
    }
    return false;
  }
  draw(): void {
    let rect = this.svg.node().getBoundingClientRect();
    if ((rect.width !== this.outerWidth || rect.height !== this.outerHeight)) {
      if (rect.height < this.seismographConfig.minHeight) { rect.height = this.seismographConfig.minHeight; }
      if (rect.height > this.seismographConfig.maxHeight) { rect.height = this.seismographConfig.maxHeight; }
      this.setWidthHeight(rect.width, rect.height);
    }
    if ( ! this.canvas ) {
      this.canvas = this.svgParent.insert("canvas",":first-child").classed("seismograph", true);
      const mythis = this;
      let z = this.canvas.call(d3.zoom().on("zoom", function () {
          mythis.zoomed(mythis);
        }));
      if ( ! this.seismographConfig.wheelZoom) {
        z.on("wheel.zoom", null);
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
    this.calcTimeScaleDomain();
    this.drawSeismograms();
    this.drawAxis(this.g);
    this.drawAxisLabels();
    if (this.seismographConfig.doMarkers) {
      this.drawMarkers();
    }
    this.beforeFirstDraw = false;
  }
  printSizes(): void {
    let out = "";
    let rect = this.svg.node().getBoundingClientRect();
    out += "svg rect.height "+rect.height+"\n";
    out += "svg rect.width "+rect.width+"\n";
    let grect = this.svgParent.node().getBoundingClientRect();
    out += "parent rect.height "+grect.height+"\n";
    out += "parent rect.width "+grect.width+"\n";
      let crect = this.canvas.node().getBoundingClientRect();
      out += "c rect.height "+crect.height+"\n";
      out += "c rect.width "+crect.width+"\n";
        out += "c style.height "+this.canvas.style("height")+"\n";
        out += "c style.width "+this.canvas.style("width")+"\n";
    out += "this.height "+this.height+"\n";
    out += "this.width "+this.width+"\n";
  out += "canvas.height "+this.canvas.node().height+"\n";
  out += "canvas.width "+this.canvas.node().width+"\n";
    out += "this.outerHeight "+this.outerHeight+"\n";
    out += "this.outerWidth "+this.outerWidth+"\n";
    // $FlowFixMe
    out += "this.margin "+this.seismographConfig.margin+"\n";
    console.log(out);
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
      canvasNode.height = this.outerHeight;
      canvasNode.width = this.outerWidth;
    }
  }

  drawSeismograms() {
    this.svg.classed("overlayPlot", this.seisDataList.length > 1);
    if (this.seismographConfig.drawingType === DRAW_CANVAS
      || this.seismographConfig.drawingType === DRAW_BOTH
      || this.seismographConfig.drawingType === DRAW_BOTH_ALIGN) {
      this.drawSeismogramsCanvas();
    }
    if (this.seismographConfig.drawingType === DRAW_SVG
      || this.seismographConfig.drawingType === DRAW_BOTH
      || this.seismographConfig.drawingType === DRAW_BOTH_ALIGN) {
      this.drawSeismogramsSvg();
    }
    if (this.seismographConfig.drawingType === DRAW_BOTH_ALIGN) {
      this.drawCanvasAlignment();
    }
  }
  isVisible(): boolean {
    const elem = this.canvas.node();
    if (! elem) { return false; }
    return !!( elem.offsetWidth || elem.offsetHeight || elem.getClientRects().length );
  }
  drawSeismogramsCanvas(): void {
    if (! this.isVisible()) {
      // no need to draw if we are not visible
      return;
    }
    // get the canvas drawing context
    const canvasNode = this.canvas.node();
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

    this.seisDataList.forEach( (t,ti) => {
//      const color = d3.select(`svg g.allsegments g:nth-child(9n+1) g path.seispath`)
      const color = this.seismographConfig.getColorForIndex(ti);
      let firstTime = true;
      if ( t.seismogram) {
        t.seismogram.segments.forEach((s) => {
          if (s.startTime.isAfter(plotEnd) ||
              s.endTime.isBefore(plotStart)) {
                // segment either totally off to left or right of visible
                return;
          }
          const samplesPerPixel = 1.0*s.sampleRate*secondsPerPixel;
          const pixelsPerSample = 1.0/samplesPerPixel;
          const startPixel = this.currZoomXScale(s.startTime.toDate());
          const endPixel = this.currZoomXScale(s.endTime.toDate());
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
      } else {
        console.log(`seisdta has no seismogram ${ti}`);
      }

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

    this.g.selectAll("path.diagonal").remove();
    this.g.append("path").attr("class",  "seispath diagonal").attr("d", "M0,0L"+mythis.currZoomXScale(maxX)+", "+mythis.yScale(minY));

    // get the canvas drawing context
    const canvasNode = this.canvas.node();
    //canvasNode.height = this.height;
    //canvasNode.width = this.width;
    const context = canvasNode.getContext("2d");
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
  drawSeismogramsSvg() {
    const mythis = this;
    const allSegG = this.g.select("g.allsegments");
    const traceJoin = allSegG.selectAll("g")
      .data(this.seisDataList);
    traceJoin.exit().remove();
    traceJoin.enter()
      .append("g")
        .attr("class", "trace");

    const subtraceJoin = allSegG.selectAll("g")
      .selectAll('g')
       .data(function(trace) {return trace.segments;});
    subtraceJoin.enter()
       .append("g")
         .attr("class", "segment")
    .append("path")
      .attr("class", function(seg) {
          return "seispath "+seg.codes()+(seg.chanCode ? " orient"+seg.chanCode.charAt(2) : "");
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
        console.log("canvasSeis seg.y not defined: "+(typeof seg)+" "+(seg instanceof Seismogram));
        return;
      }
      return this.lineFunc(Array.from(seg.y, function(d,i) {
        return {time: seg.timeOfSample(i).toDate(), y: d };
      }));
    } else {
      // lots of points per pixel so use high/low lines
      if ( ! seg._highlow
           || seg._highlow.secondsPerPixel !== secondsPerPixel
           || seg._highlow.xScaleDomain[1] !== xScale.domain()[1]) {
        let highlow = [];
        let numHL = 2*Math.ceil(seg.y.length/samplesPerPixel);
        for(let i=0; i<numHL; i++) {
          let snippet = seg.y.slice(i * samplesPerPixel,
                                    (i+1) * samplesPerPixel);
          if (snippet.length !== 0) {
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
        return {time: new Date(seg.startTime.valueOf()+1000*((Math.floor(i/2)+.5)*secondsPerPixel)), y: d };
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


  zoomed(mythis: Seismograph): void {
    let t = d3.event.transform;
    let xt = t.rescaleX(this.xScale);
    mythis.redrawWithXScale(xt);
  }

  redrawWithXScale(xt: any): void {
    if (xt.domain()[0].getTime() === this.currZoomXScale.domain()[0].getTime()
        && xt.domain()[1].getTime() === this.currZoomXScale.domain()[1].getTime()) {
      return;
    }

    if ( ! (xt.domain()[0]
        && xt.domain()[1]
        && Number.isFinite(xt.range()[0])
        && Number.isFinite(xt.range()[1]))) {
          console.assert(false, `xScale Nan: ${xt.domain()} ${xt.range()}`);
    }
    this.currZoomXScale = xt;
    let mythis = this;
    if (! this.beforeFirstDraw) {
      this.g.select("g.allsegments").selectAll("g.trace").remove();
      if (this.seismographConfig.windowAmp) {
        this.calcAmpScaleDomain();
      }
      this.drawSeismograms();
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
               return (i===0) ? 0 : mythis.yScale.range()[0];
             }).curve(d3.curveLinear)([ mythis.yScale.domain()[0], mythis.yScale.domain()[1] ] ); // call the d3 function created by line with data
        });
      this.g.select(".axis--x").call(this.xAxis.scale(xt));
    }
    this.xScaleChangeListeners.forEach(l => l.notifyScaleChange(xt));
  }

  drawMarkers() {
    let allMarkers = this.seisDataList.reduce((acc, sdd) => {
        sdd.markerList.forEach(m => acc.push(m));
        return acc;
      }, []);
    // marker overlay
    let mythis = this;
    let markerG = this.g.select("g.allmarkers");
    let labelSelection = markerG.selectAll("g.marker")
        .data(allMarkers, function(d) {
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
                    out = (i===0) ? 0: (mythis.yScale.range()[0]+mythis.yScale.range()[1])/2 ;
                  } else {
                    // mythis.seismographConfig.markerFlagpoleBase === 'bottom'
                    out = (i===0) ? 0 : mythis.yScale.range()[0];
                  }
                  return out;
                }).curve(d3.curveLinear)([ mythis.yScale.domain()[0], mythis.yScale.domain()[1] ] ); // call the d3 function created by line with data

            });
        });
  }

  setWidthHeight(nOuterWidth: number, nOuterHeight: number): void {
    this.outerWidth = Math.round(nOuterWidth ? Math.max(200, nOuterWidth) : 200);
    this.outerHeight = Math.round(nOuterHeight ? Math.max(100, nOuterHeight): 100);
    this.height = this.outerHeight - this.seismographConfig.margin.top - this.seismographConfig.margin.bottom;
    this.width = this.outerWidth - this.seismographConfig.margin.left - this.seismographConfig.margin.right;

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

  setWidth(value: number): Seismograph {
    this.setWidthHeight(value, this.outerHeight);
    return this;
  }
  setHeight(value: number): Seismograph {
    this.setWidthHeight(this.outerWidth, value);
    return this;
  }

  setMargin(value: MarginType ): Seismograph {
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
  drawXLabel(): Seismograph {
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
  drawYLabel(): Seismograph {
    this.svg.selectAll('g.yLabel').remove();
    let svgText = this.svg.append("g")
       .classed("yLabel", true)
       .attr("x", 0)
       .attr("transform", "translate(0, "+(this.seismographConfig.margin.top+(this.height)/2)+")")
       .append("text");
    svgText
       .classed("y label", true);
    if (this.seismographConfig.yLabelOrientation === "vertical") {
      // vertical
      svgText
        .attr("text-anchor", "middle")
        .attr("dy", ".75em")
        .attr("transform", "rotate(-90, 0, 0)");
    } else {
      // horizontal
      svgText.attr("text-anchor", "start")
      .attr("dominant-baseline", "central");
    }
    svgText.text(this.seismographConfig.yLabel);
    return this;
  }
  drawXSublabel(): Seismograph {
    this.svg.selectAll('g.xSublabel').remove();
    this.svg.append("g")
       .classed("xSublabel", true)
       .attr("transform", "translate("+(this.seismographConfig.margin.left+(this.width)/2)+", "+(this.outerHeight  )+")")
       .append("text").classed("x label sublabel", true)
       .attr("text-anchor", "middle")
       .text(this.seismographConfig.xSublabel);
    return this;
  }
  drawYSublabel(): Seismograph {
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
  calcTimeScaleDomain(): void {
      let timeWindow;
      if (this.seismographConfig.fixedTimeScale) {
        timeWindow = this.seismographConfig.fixedTimeScale;
      } else {
        timeWindow = findStartEnd(this.seisDataList);
      }
      if ( ! isDef(this.xScale)) {
        this.xScale = d3.scaleUtc();
      }
      this.xScale.domain([timeWindow.startTime.toDate(), timeWindow.endTime.toDate()]);
      this.origXScale = this.xScale;
      this.currZoomXScale = this.xScale;
  }
  calcAmpScaleDomain(): void {
    if (this.seismographConfig.fixedYScale) {
      this.yScale.domain(this.seismographConfig.fixedYScale);
    } else {
      let minMax;
      if (this.seismographConfig.windowAmp) {
        let timeWindow = new StartEndDuration(this.currZoomXScale.domain()[0], this.currZoomXScale.domain()[1]);
        minMax = findMinMaxOverTimeRange(this.seisDataList, timeWindow);
      } else {
        minMax = findMinMax(this.seisDataList);
      }
      if (minMax[0] === minMax[1]) {
        // flatlined data, use -1, +1
        minMax = [ minMax[0]-1, minMax[1]+1];
      }
      this.yScale.domain(minMax).nice();
      this.yScaleChangeListeners.forEach(l => l.notifyScaleChange(this.yScale));
    }
    this.redoDisplayYScale();
  }
  redoDisplayYScale(): void {
    let niceMinMax = this.yScale.domain();
    if (this.seismographConfig.doGain
        && this.seisDataList.length > 0
        && this.seisDataList.every(sdd => sdd.hasSensitivity())) {
      // each has seisitivity
      let firstSensitivity = this.seisDataList[0].sensitivity;
      if (isDef(firstSensitivity) && this.seisDataList.every(sdd => (
          isDef(firstSensitivity) && sdd.sensitivity
          && firstSensitivity.sensitivity===sdd.sensitivity.sensitivity
          && firstSensitivity.inputUnits===sdd.sensitivity.inputUnits
          && firstSensitivity.outputUnits===sdd.sensitivity.outputUnits
        ))) {
          niceMinMax[0] = niceMinMax[0] / firstSensitivity.sensitivity;
          niceMinMax[1] = niceMinMax[1] / firstSensitivity.sensitivity;
          if (this.seismographConfig.ySublabelIsUnits) {
            this.seismographConfig.ySublabel = firstSensitivity.inputUnits;
          }
      } else {
        throw new Error("doGain with different seisitivities not yet implemented.");
      }
    } else {
      if (this.seismographConfig.ySublabelIsUnits ) {
        this.seismographConfig.ySublabel = "";
        let allUnits = [];
        for (let t of this.seisDataList) {
          if (t.seismogram){
            let u = t.seismogram.yUnit;
            allUnits.push(u);
            this.seismographConfig.ySublabel += `${u} `;
          }
        }
        if (allUnits.length === 0) {
          allUnits.push("Count");
        }
        this.seismographConfig.ySublabel = allUnits.join(' ');
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
  getSeismogramData(): Array<SeismogramDisplayData> {
    return this.seisDataList;
  }
  /** can append single seismogram segment or an array of segments. */
  _internalAppend(sddList: Array<SeismogramDisplayData> | SeismogramDisplayData | Array<Seismogram> | Seismogram  ): void {
    if ( ! sddList) {
      // don't append a null
    } else if (Array.isArray(sddList)) {
      for(let s of sddList) {
        if (s instanceof SeismogramDisplayData ) {
          this.seisDataList.push(s);
        } else {
          this.seisDataList.push(SeismogramDisplayData.fromSeismogram(s));
        }
      }
    } else {
      if (sddList instanceof SeismogramDisplayData ) {
        this.seisDataList.push(sddList);
      } else {
        this.seisDataList.push(SeismogramDisplayData.fromSeismogram(sddList));
      }
    }
  }
  /** appends the seismogram(s) as separate time series. */
  append(seismogram: Array<Seismogram> | Seismogram) {
    if (Array.isArray(seismogram)) {
      let sdd = seismogram.map(s => new SeismogramDisplayData.fromSeismogram(s));
      this._internalAppend(sdd);
    } else {
      this._internalAppend(new SeismogramDisplayData.fromSeismogram(seismogram));
    }
    this.calcAmpScaleDomain();
    if ( ! this.beforeFirstDraw) {
      // only trigger a draw if appending after already drawn on screen
      // otherwise, just append the data and wait for outside to call first draw()
      this.drawSeismograms();
    }
    return this;
  }
  getDisplayDataForSeismogram(seis: Seismogram): SeismogramDisplayData | null {
    let out = this.seisDataList.find(sd => sd.seismogram === seis);
    if (out) {return out; } else { return null;}
  }
  remove(seisData: SeismogramDisplayData): void {
    this.seisDataList = this.seisDataList.filter( sd => sd !== seisData);
  }
  trim(timeWindow: StartEndDuration): void {
    if (this.seisDataList) {
      this.seisDataList = this.seisDataList.filter(function(d) {
        return d.timeWindow.overlaps(timeWindow);
      });
      if (this.seisDataList.length > 0) {
        this.calcAmpScaleDomain();
        this.drawSeismograms();
      }
    }
  }
  linkXScaleTo(seismograph: Seismograph) {
    this.origXScale.domain(seismograph.origXScale.domain());
    this.xScale.domain(seismograph.xScale.domain());
    if ( ! this.beforeFirstDraw && seismograph.currZoomXScale.range()[1] !== 1) {
      // default range is 0,1, so don't draw then.
      this.redrawWithXScale(seismograph.currZoomXScale);
    }
    if ( ! this.xScaleChangeListeners.find(l => l.destinationKey === seismograph)) {
      this.xScaleChangeListeners.push({
          destinationKey: seismograph,
          notifyScaleChange: function(xScale) {
            if ( ! seismograph.beforeFirstDraw) {
              seismograph.redrawWithXScale(xScale);
            }
          }
        });
    }
    if (! seismograph.xScaleChangeListeners.find(l => l.destinationKey === this)) {
      seismograph.linkXScaleTo(this);
    }
  }
  unlinkXScaleTo(seismograph: Seismograph) {
    this.xScaleChangeListeners = this.xScaleChangeListeners.filter( l => l.destinationKey !==seismograph);
  }
  linkYScaleTo(seismograph: Seismograph) {
    let mythis = this;
    if ( ! this.yScaleChangeListeners.find(l => l.destinationKey === seismograph)) {
      let schangeListen = {
          destinationKey: seismograph,
          notifyScaleChange: function(yScale) {
            if (Number.isFinite(yScale.domain()[0])
                && Number.isFinite(yScale.domain()[1])
                && Number.isFinite(mythis.yScale.domain()[0])
                && Number.isFinite(mythis.yScale.domain()[1])) {
              seismograph.updateYScaleLinkedTo(yScale);
            }
          }
        };
        mythis.updateYScaleLinkedTo(seismograph.yScale);
        this.yScaleChangeListeners.push(schangeListen);
        schangeListen.notifyScaleChange(this.yScale);
    }
    if (! seismograph.yScaleChangeListeners.find(l => l.destinationKey === this)) {
      seismograph.linkYScaleTo(this);
    }
  }
  unlinkYScaleTo(seismograph: Seismograph) {
    this.yScaleChangeListeners = this.yScaleChangeListeners.filter( l => l.destinationKey !==seismograph);
  }
  updateYScaleLinkedTo(otherYScale: any) {
    if (Number.isFinite(otherYScale.domain()[0])
          && Number.isFinite(otherYScale.domain()[1])) {

      let didModify = false;
      if( ! (Number.isFinite(this.yScale.domain()[0])
          && Number.isFinite(this.yScale.domain()[1]))) {
        this.yScale = otherYScale;
        didModify = true;
      } else {

        if (this.seismographConfig.doRMean) {
          let seisYInterval = otherYScale.domain()[1]-otherYScale.domain()[0];
          let myYInterval = this.yScale.domain()[1]-this.yScale.domain()[0];
          if (seisYInterval > myYInterval){
            let center = this.yScale.domain()[0]+myYInterval/2;
            this.yScale.domain([ center - seisYInterval/2, center + seisYInterval/2]);
            didModify = true;
          }
        } else {
          let max = this.yScale.domain()[1];
          let min = this.yScale.domain()[0];
          if (max < otherYScale.domain()[1]) {
            max = otherYScale.domain()[1];
            didModify = true;
          }
          if (min > otherYScale.domain()[0]) {
            min = otherYScale.domain()[0];
            didModify = true;
          }
          if (didModify) {
            this.yScale.domain([min, max]);
          }
        }
      }
      if (didModify) {
        this.redoDisplayYScale();
        if ( ! this.beforeFirstDraw ) {
          this.drawSeismograms();
        }
      }
    }
  }
}


// static ID for seismogram
Seismograph._lastID = 0;

/**
 * Creates Markers for all of the arrivals in ttime.arrivals, relative
 * to the given Quake.
 * @param  {[type]} quake quake the travel times are relative to
 * @param  {[type]} ttime travel times json object as returned from the
 * IRIS traveltime web service, or the json output of TauP
 * @return {[type]}       array of Markers suitable for adding to a seismograph
 */
export function createMarkersForTravelTimes(quake: Quake, ttime: any): Array<MarkerType> {
  return ttime.arrivals.map( a => {
    return {
      markertype: 'predicted',
      name: a.phase,
      time: moment.utc(quake.time).add(a.time, 'seconds')
    };
  });
}

export const seismograph_css = `

.predicted polygon {
  fill: rgba(220,220,220,.4);
}

.pick polygon {
  fill: rgba(255,100,100,.4);
}

path.seispath {
  stroke: skyblue;
  fill: none;
  stroke-width: 1px;
}

path.orientZ {
  stroke: seagreen;
}

path.orientN {
  stroke: cornflowerblue;
}

path.orientE {
  stroke: orange;
}


path.seispath {
  stroke: skyblue;
  fill: none;
  stroke-width: 1px;
}

svg.seismograph {
  height: 100%;
  width: 100%;
}

div.container-wide {
  display: inline-block;
  position: relative;
  width: 100%;
  padding-bottom: 40%; /* aspect ratio */
  vertical-align: top;
  overflow: hidden;
}

svg.realtimePlot g.allsegments g path.seispath {
  stroke: skyblue;
}

svg.overlayPlot g.allsegments g:nth-child(9n+1) path.seispath {
  stroke: skyblue;
}

svg.overlayPlot g.allsegments g:nth-child(9n+2) path.seispath {
  stroke: olivedrab;
}

svg.overlayPlot g.allsegments g:nth-child(9n+3) path.seispath {
  stroke: goldenrod;
}

svg.overlayPlot g.allsegments g:nth-child(9n+4) path.seispath {
  stroke: firebrick;
}

svg.overlayPlot g.allsegments g:nth-child(9n+5) path.seispath {
  stroke: darkcyan;
}

svg.overlayPlot g.allsegments g:nth-child(9n+6) path.seispath {
  stroke: orange;
}

svg.overlayPlot g.allsegments g:nth-child(9n+7) path.seispath {
  stroke: darkmagenta;
}

svg.overlayPlot g.allsegments g:nth-child(9n+8) path.seispath {
  stroke: mediumvioletred;
}

svg.overlayPlot g.allsegments g:nth-child(9n+9) path.seispath {
  stroke: sienna;
}

/* same colors for titles */

svg.overlayPlot g.title tspan:nth-child(9n+1)  {
  fill: skyblue;
}

svg.overlayPlot g.title text tspan:nth-child(9n+2)  {
  stroke: olivedrab;
}

svg.overlayPlot g.title text tspan:nth-child(9n+3)  {
  stroke: goldenrod;
}

svg.overlayPlot g.title tspan:nth-child(9n+4)  {
  stroke: firebrick;
}

svg.overlayPlot g.title tspan:nth-child(9n+5)  {
  stroke: darkcyan;
}

svg.overlayPlot g.title tspan:nth-child(9n+6)  {
  stroke: orange;
}

svg.overlayPlot g.title tspan:nth-child(9n+7)  {
  stroke: darkmagenta;
}

svg.overlayPlot g.title tspan:nth-child(9n+8)  {
  stroke: mediumvioletred;
}

svg.overlayPlot g.title tspan:nth-child(9n+9)  {
  stroke: sienna;
}


/* links in svg */
svg text a {
  fill: #0000EE;
  text-decoration: underline;
}

`;

if (document){
  insertCSS(seismograph_css);
}
