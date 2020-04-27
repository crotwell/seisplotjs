// @flow

/*
 * Philip Crotwell
 * University of South Carolina, 2019
 * http://www.seis.sc.edu
 */


import moment from 'moment';
import * as d3 from 'd3';

import {insertCSS} from './cssutil.js';

import {SeismographConfig,
        DRAW_SVG, DRAW_CANVAS, DRAW_BOTH, DRAW_BOTH_ALIGN} from './seismographconfig';
import type { MarkerType } from './seismogram.js';
import type { MarginType } from './seismographconfig';
import {SeismogramDisplayData, findStartEnd, findMinMax, findMinMaxOverTimeRange,
        SeismogramSegment, Seismogram, COUNT_UNIT } from './seismogram.js';
import {Quake} from './quakeml.js';

import * as util from './util.js';
import {StartEndDuration, isDef, isNumArg } from './util';



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
  alignmentSeisData: Array<SeismogramDisplayData>;

  width: number;
  height: number;
  outerWidth: number;
  outerHeight: number;
  svg: any;
  canvasHolder: any;
  canvas: any;
  origXScale: d3.scale;
  currZoomXScale: any;
  yScale: d3.scale; // for drawing seismogram
  yScaleRmean: d3.scale; // for drawing y axis
  yScaleData: d3.scale; // holds min max of data in time window
  linkedAmpScale: LinkedAmpScale;
  lineFunc: any;
  zoom: any;
  xAxis: any;
  xAxisTop: any;
  yAxis: any;
  yAxisRight: any;
  g: any;
  throttleRescale: any;
  throttleResize: any;
  xScaleChangeListeners: Array<ScaleChangeListenerType>;
  constructor(inSvgParent: any,
              seismographConfig: SeismographConfig,
              seisData: Array<SeismogramDisplayData> | Array<Seismogram> | SeismogramDisplayData | Seismogram) {
    if (inSvgParent === null) {throw new Error("inSvgParent cannot be null");}
    if ( ! isDef(seismographConfig)) {
      if (isDef(seisData) && ( ! Array.isArray(seisData) || seisData.length > 0)) {
        // need at least one of seismographConfig or seisData to get time window
        seismographConfig = new SeismographConfig();
      } else {
        throw new Error("seismographConfig and seisData cannot both be null");
      }
    }
    this.plotId = ++Seismograph._lastID;
    this.beforeFirstDraw = true;
    this.seismographConfig = seismographConfig;
    this.seisDataList = [];
    this._internalAppend(seisData);
    this.alignmentSeisData = [];

    this.width = 200;
    this.height = 100;

    if (typeof inSvgParent === 'string') {
      this.svgParent = d3.select(inSvgParent);
    } else {
      this.svgParent = inSvgParent;
    }

    this.canvas = null;

    this.svg = this.svgParent.append("svg")
      .style("z-index", 100);
    if (isNumArg(this.seismographConfig.minHeight) && this.seismographConfig.minHeight > 0) {
      this.svg.style("min-height", this.seismographConfig.minHeight+'px');
    }
    if (isNumArg(this.seismographConfig.maxHeight) && this.seismographConfig.maxHeight > 0) {
      this.svg.style("max-height", this.seismographConfig.maxHeight+'px');
    }
    this.svg.classed("seismograph", true);
    this.svg.attr("version", "1.1");
    this.svg.attr("plotId", this.plotId);


    this.calcTimeScaleDomain();
    this.yScale = d3.scaleLinear();
    this.yScaleData = d3.scaleLinear();
    // yScale for axis (not drawing) that puts mean at 0 in center
    this.yScaleRmean = d3.scaleLinear();
    this.linkedAmpScale = new LinkedAmpScale([this]);

    this.xScaleChangeListeners = [];

    if (this.seismographConfig.isXAxis) {
      this.xAxis = d3.axisBottom(this.currZoomXScale).tickFormat(this.seismographConfig.xScaleFormat);
    }
    if (this.seismographConfig.isXAxisTop) {
      this.xAxisTop = d3.axisTop(this.currZoomXScale).tickFormat(this.seismographConfig.xScaleFormat);
    }
    if (this.seismographConfig.isYAxis) {
      this.yAxis = d3.axisLeft(this.yScaleRmean).tickFormat(this.seismographConfig.yScaleFormat);
    }
    if (this.seismographConfig.isYAxisRight) {
      this.yAxisRight = d3.axisRight(this.yScaleRmean).tickFormat(this.seismographConfig.yScaleFormat);
    }

    let mythis = this;

    this.g = this.svg.append("g")
      .classed("marginTransform", true)
      .attr("transform", "translate(" + this.seismographConfig.margin.left + "," + (this.seismographConfig.margin.top) + ")");
    this.g.append("g").classed("allseismograms", true);

    let z = this.svg.call(d3.zoom().on("zoom", function () {
        mythis.zoomed(mythis);
      }));
    if ( ! this.seismographConfig.wheelZoom) {
      z.on("wheel.zoom", null);
    }

    this.calcAmpScaleDomain();

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
      if (rect.height < this.seismographConfig.minHeight) {
        rect.height = this.seismographConfig.minHeight;
      }
      if (rect.height > this.seismographConfig.maxHeight) {
        rect.height = this.seismographConfig.maxHeight;
      }
      this.calcWidthHeight(rect.width, rect.height);
    }
    if (this.canvas) {
      this.canvasHolder.attr("width", this.width)
         .attr("height", this.height);
      this.canvas.attr("width", this.width)
         .attr("height", this.height);
    } else {
      this.canvasHolder = this.svg
        .insert("foreignObject",":first-child").classed("seismograph", true)
        .attr("x", this.seismographConfig.margin.left)
        .attr("y", this.seismographConfig.margin.top)
        .attr("width", this.width)
        .attr("height", this.height+1);
      this.canvas = this.canvasHolder.append("xhtml:canvas").classed("seismograph", true)
        .attr("xmlns", "http://www.w3.org/1999/xhtml")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", this.width)
        .attr("height", this.height+1);
      const mythis = this;
      let z = this.canvas.call(d3.zoom().on("zoom", function () {
          mythis.zoomed(mythis);
        }));
      if ( ! this.seismographConfig.wheelZoom) {
        z.on("wheel.zoom", null);
      }

      let style = window.getComputedStyle(this.svg.node());
      let padTop = style.getPropertyValue('padding-top');
      if (padTop.endsWith("px")) {
        padTop = Number(padTop.replace("px", ""));
      }
      let borderTop = style.getPropertyValue('border-top-width');
      if (borderTop.endsWith("px")) {
        borderTop = Number(borderTop.replace("px", ""));
      }
    }
    this.drawSeismograms();
    this.drawAxis(this.g);
    this.drawAxisLabels();
    if (this.seismographConfig.doMarkers) {
      this.drawMarkers();
    }
    this.beforeFirstDraw = false;
    return this.svg;
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
    util.log(out);
  }

  drawSeismograms() {
    if (this.seismographConfig.drawingType === DRAW_BOTH_ALIGN) {
      if (this.alignmentSeisData.length === 0) {
        const startenddur = new StartEndDuration(this.currZoomXScale.domain()[0], this.currZoomXScale.domain()[1]);
        const fakeSDD = this.seismographConfig.createAlignmentData(startenddur);
        this.alignmentSeisData.push(fakeSDD);
      }
    } else {
      this.alignmentSeisData = [];
    }
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
    const mythis = this;
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

    context.lineWidth = this.seismographConfig.lineWidth;
    if (this.seismographConfig.drawingType === DRAW_BOTH_ALIGN) {
      context.lineWidth = this.seismographConfig.lineWidth *2;
    }

    const plotStart = moment.utc(this.currZoomXScale.domain()[0]);
    const plotEnd = moment.utc(this.currZoomXScale.domain()[1]);
    const plotDuration = moment.duration(plotEnd.diff(plotStart));
    const secondsPerPixel = plotDuration.asSeconds()/
        (this.currZoomXScale.range()[1]-this.currZoomXScale.range()[0]);
    const sddList = this.seisDataList.concat(this.alignmentSeisData);
    sddList.forEach( (t,ti) => {
      let color;
      if (this.seismographConfig.drawingType === DRAW_BOTH_ALIGN) {
        color = mythis.seismographConfig.getColorForIndex(ti + sddList.length);
      } else {
        color = mythis.seismographConfig.getColorForIndex(ti);
      }

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
          if (endPixel > this.currZoomXScale.range()[1]+1) {
            rightVisibleSample = leftVisibleSample+Math.ceil((this.width+1)*samplesPerPixel) +1;
          }
          if (firstTime || ! this.seismographConfig.connectSegments ){
            context.beginPath();
            context.strokeStyle = color;
            //context.lineWidth = 5;
            context.moveTo(leftVisiblePixel, this.yScale(s.y[leftVisibleSample]));
            firstTime = false;
          }
          for(let i=leftVisibleSample; i<rightVisibleSample+2 && i<s.y.length; i++) {
            context.lineTo(startPixel+i*pixelsPerSample, this.yScale(s.y[i]));
          }
          if (! this.seismographConfig.connectSegments ){
            context.stroke();
          }
        });
      } else {
        util.log(`seisdata has no seismogram ${util.stringify(ti)}`);
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
      .attr('fill-opacity', '0.4')
      .attr('cx', function(d){  return mythis.currZoomXScale(d[0]);})
      .attr('cy', function(d){  return mythis.yScale(d[1]);})
      .attr('r', radius-2);

    this.g.selectAll("path.diagonal").remove();
    this.g.append("path").attr("class",  "seispath diagonal").attr("d", "M0,0L"+mythis.currZoomXScale(maxX)+", "+mythis.yScale(minY));


    // svg text color
    let textcolor = this.seismographConfig.getColorForIndex(this.seisDataList.length);
    let textcolorArr = [ textcolor];
    this.g.selectAll("text").data(textcolorArr).enter().append("text").style("fill", textcolor).text("svg "+textcolor).attr("x", this.width*3/4).attr("y", this.height/4+20);


    // get the canvas drawing context
    const canvasNode = this.canvas.node();
    //canvasNode.height = this.height;
    //canvasNode.width = this.width;
    const context = canvasNode.getContext("2d");

    // canvas text color
    textcolor = this.seismographConfig.getColorForIndex(2*this.seisDataList.length+this.alignmentSeisData.length);
    context.strokeStyle=textcolor;
    context.strokeText("canvas "+textcolor, this.width*3/4, this.height/4);

    context.beginPath();
    context.fillStyle = "lightblue";
    context.arc(this.currZoomXScale((minX+maxX)/2), this.yScale((minY+maxY)/2), radius, 0, 2*Math.PI, true);
    context.fill();

    context.beginPath();
    context.fillStyle = "lightblue";
    context.arc(this.currZoomXScale(minX), this.yScale(minY), radius, 0, 2*Math.PI, true);
    context.fill();
    context.beginPath();
    context.fillStyle = "red";
    context.arc(this.currZoomXScale(maxX), this.yScale(minY), radius, 0, 2*Math.PI, true);
    context.fill();
    context.beginPath();
    context.fillStyle = "green";
    context.arc(this.currZoomXScale(minX), this.yScale(maxY), radius, 0, 2*Math.PI, true);
    context.fill();
    context.beginPath();
    context.fillStyle = "black";
    context.arc(this.currZoomXScale(maxX), this.yScale(maxY), radius, 0, 2*Math.PI, true);
    context.fill();
    context.beginPath();
    context.moveTo(this.currZoomXScale(this.currZoomXScale.domain()[0]), this.yScaleRmean(0));
    context.lineTo(this.currZoomXScale(this.currZoomXScale.domain()[1]), this.yScaleRmean(0));
    context.moveTo(0,0);
    context.lineTo(this.width, this.height);
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
    const sddList = this.seisDataList.concat(this.alignmentSeisData);
    const mythis = this;
    const allSegG = this.g.select("g.allseismograms");
    const traceJoin = allSegG.selectAll("g.seismogram")
      .data(sddList)
      .enter()
      .append("g")
        .attr("label", s => s ? s.label : 'none')
        .attr("codes", s => s.seismogram && s.seismogram.hasCodes() ? s.seismogram.codes() : 'none')
        .classed("seismogram", true);
    traceJoin.exit().remove();

    const subtraceJoin = traceJoin
      .selectAll('path')
       .data(sdd => sdd.seismogram ? sdd.seismogram.segments : []);
    subtraceJoin.enter()
      .append("path")
        .classed("seispath", true)
        .classed(DRAW_BOTH_ALIGN, this.seismographConfig.drawingType === DRAW_BOTH_ALIGN)
        .attr("style", "clip-path: url(#"+CLIP_PREFIX+mythis.plotId+")")
        .attr("shape-rendering", "crispEdges")
        .attr("d", function(seg) {
           return mythis.segmentDrawLine(seg, mythis.currZoomXScale);
         });
    subtraceJoin.exit().remove();
  }

  calcSecondsPerPixel(xScale: any): number {
    let domain = xScale.domain(); // time so milliseconds
    let range = xScale.range(); // pixels
    return (domain[1].getTime()-domain[0].getTime())/1000 / (range[1]-range[0]);
  }

  segmentDrawLine(seg: SeismogramSegment, xScale: any): void {
    const mythis = this;
    let secondsPerPixel = this.calcSecondsPerPixel(xScale);
    let samplesPerPixel = seg.sampleRate * secondsPerPixel;
    let lineFunc = d3.line()
      .curve(d3.curveLinear)
      .x(function(d) {return xScale(d.time); })
      .y(function(d) {return mythis.yScale(d.y); });
    if (samplesPerPixel < this.seismographConfig.segmentDrawCompressedCutoff) {
      if (! seg.y) {
        // $FlowFixMe
        util.log("canvasSeis seg.y not defined: "+(typeof seg)+" "+(seg instanceof Seismogram));
        return;
      }
      return lineFunc(Array.from(seg.y, function(d,i) {
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
      return lineFunc(seg._highlow.highlowArray.map(function(d: number,i: number) {
        return {time: new Date(seg.startTime.valueOf()+1000*((Math.floor(i/2)+.5)*secondsPerPixel)), y: d };
      }));
    }
  }

  drawAxis(svgG: any): void {
    svgG.selectAll("g.axis").remove();
    if (this.seismographConfig.isXAxis) {
      this.xAxis.scale(this.currZoomXScale);
      this.xAxis.tickFormat(this.seismographConfig.xScaleFormat);
      svgG.append("g")
          .attr("class", "axis axis--x")
          .attr("transform", "translate(0," + this.height + ")")
          .call(this.xAxis);
    }
    if (this.seismographConfig.isXAxisTop) {
      this.xAxisTop.scale(this.currZoomXScale);
      this.xAxisTop.tickFormat(this.seismographConfig.xScaleFormat);
      svgG.append("g")
          .attr("class", "axis axis--x")
          .call(this.xAxisTop);
    }
    if (this.seismographConfig.isYAxis) {
      this.yAxis.scale(this.yScaleRmean);
      this.yAxis.ticks(8, this.seismographConfig.yScaleFormat);
      svgG.append("g")
          .attr("class", "axis axis--y")
          .call(this.yAxis);
    }
    if (this.seismographConfig.isYAxisRight) {
      this.yAxisRight.scale(this.yScaleRmean);
      this.yAxisRight.ticks(8, this.seismographConfig.yScaleFormat);
      svgG.append("g")
          .attr("class", "axis axis--y-right")
          .attr("transform", "translate(" + this.width + ",0)")
          .call(this.yAxisRight);
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
          if (myThis.seismographConfig.isYAxis) {
            myThis.g.select(".axis--y").transition().duration(delay/2).call(myThis.yAxis);
          }
          if (myThis.seismographConfig.isYAxisRight) {
            myThis.g.select(".axis--y-right").transition().duration(delay/2).call(myThis.yAxisRight);
          }
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

  cloneXScale(scale: d3.scale): d3.scale {
    let outxScale = d3.scaleUtc();
    outxScale.domain([scale.domain()[0], scale.domain()[1]]);
    outxScale.range([scale.range()[0], scale.range()[1]]);
    return outxScale;
  }
  resetZoom(): void {
    this.redrawWithXScale(this.cloneXScale(this.origXScale));
  }

  zoomed(mythis: Seismograph): void {
    let t = d3.event.transform;
    let xt = t.rescaleX(this.origXScale);
    mythis.redrawWithXScale(xt);
  }

  redrawWithXScale(xt: any): void {
    if (xt.range()[0] === this.currZoomXScale.range()[0]
        && xt.range()[1] === this.currZoomXScale.range()[1]
        && xt.domain()[0].getTime() === this.currZoomXScale.domain()[0].getTime()
        && xt.domain()[1].getTime() === this.currZoomXScale.domain()[1].getTime()) {
      return;
    }
    let prevZoomXScale = this.currZoomXScale;
    this.currZoomXScale = xt;
    let mythis = this;
    if (! this.beforeFirstDraw) {
      this.g.select("g.allseismograms").selectAll("g.seismogram").remove();
      if (this.seismographConfig.windowAmp) {
        this.calcAmpScaleDomain();
      }
      this.drawSeismograms();
      this.g.select("g.allmarkers").selectAll("g.marker")
            .attr("transform", function(marker: MarkerType) {
              let textx = xt( marker.time.toDate());
              return  "translate("+textx+","+0+")";});

       this.g.select("g.allmarkers").selectAll("g.markertext")
           .attr("transform", function() {
               // shift up by this.seismographConfig.markerTextOffset percentage
               let maxY = mythis.yScale.range()[0];
               let deltaY = mythis.yScale.range()[0]-mythis.yScale.range()[1];
               let texty = maxY - mythis.seismographConfig.markerTextOffset*(deltaY);
               return  "translate("+0+","+texty+") rotate("+mythis.seismographConfig.markerTextAngle+")";
             });

       this.g.select("g.allmarkers").selectAll("path.markerpath")
         .attr("d", () => {
           return d3.line()
             .x(function() {
               return 0; // g is translated so marker time is zero
             }).y(function(d, i) {
               return (i===0) ? 0 : mythis.yScale.range()[0];
             }).curve(d3.curveLinear)([ mythis.yScale.domain()[0], mythis.yScale.domain()[1] ] ); // call the d3 function created by line with data
        });
        let startEnd = new StartEndDuration(prevZoomXScale.domain()[0], prevZoomXScale.domain()[1]);
        let undrawnMarkers = this.seisDataList.reduce((acc, sdd) => {
            sdd.markerList.forEach(m => acc.push(m));
            return acc;
          }, []).filter( m => ! startEnd.contains(m.time));
        if (undrawnMarkers.length !== 0) {
          this.drawMarkers();
        }

      if (this.seismographConfig.isXAxis) {
        this.g.select(".axis--x").call(this.xAxis.scale(xt));
      }
      if (this.seismographConfig.isXAxisTop) {
        this.g.select(".axis--x-top").call(this.xAxisTop.scale(xt));
      }
    }
    this.xScaleChangeListeners.forEach(l => l.notifyScaleChange(xt));
  }

  drawMarkers() {
    let startEnd = new StartEndDuration(this.currZoomXScale.domain()[0], this.currZoomXScale.domain()[1]);
    let allMarkers = this.seisDataList.reduce((acc, sdd) => {
        sdd.markerList.forEach(m => acc.push(m));
        return acc;
      }, []).filter( m => startEnd.contains(m.time));
    // marker overlay
    let mythis = this;
    let markerG = this.g.select("g.allmarkers");
    markerG.selectAll("g.marker").remove();
    let labelSelection = markerG.selectAll("g.marker")
        .data(allMarkers, function(d) {
              // key for data
              return `${d.name}_${d.time.toISOString()}`;
            });
    labelSelection.exit().remove();

    let radianTextAngle = this.seismographConfig.markerTextAngle*Math.PI/180;

    labelSelection.enter()
        .append("g")
        .classed("marker", true)
           // translate so marker time is zero
        .attr("transform", function(marker) {
            let textx = mythis.currZoomXScale( marker.time.toDate());
            return  "translate("+textx+","+0+")";
          })
        .each(function(marker) {

          let drawG = d3.select(this);
          drawG.classed(marker.name, true)
            .classed(marker.type, true);

          let innerTextG = drawG.append("g")
            .attr("class", "markertext")
            .attr("transform", () => {
              // shift up by this.seismographConfig.markerTextOffset percentage
              let maxY = mythis.yScale.range()[0];
              let deltaY = mythis.yScale.range()[0]-mythis.yScale.range()[1];
              let texty = maxY - mythis.seismographConfig.markerTextOffset*(deltaY);
              return  "translate("+0+","+texty+") rotate("+mythis.seismographConfig.markerTextAngle+")";});
          innerTextG.append("title").text( marker => {
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
                      // eslint-disable-next-line no-console
                      console.warn(error);
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
            .attr("d", () => {
              return d3.line()
                .x(0) // g is translated so marker time is zero
                .y(function(d, i) {
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

  calcWidthHeight(nOuterWidth: number, nOuterHeight: number): void {
    if (nOuterWidth < this.seismographConfig.margin.left + this.seismographConfig.margin.right) {
      throw new Error(`width too small for margin: ${nOuterWidth} < ${this.seismographConfig.margin.left} + ${this.seismographConfig.margin.right}`);
    }
    if (nOuterHeight < this.seismographConfig.margin.top + this.seismographConfig.margin.bottom) {
      throw new Error(`height too small for margin: ${nOuterWidth} < ${this.seismographConfig.margin.top} + ${this.seismographConfig.margin.bottom}`);
    }
    this.outerWidth = nOuterWidth;
    this.outerHeight = nOuterHeight;
    this.height = this.outerHeight - this.seismographConfig.margin.top - this.seismographConfig.margin.bottom;
    this.width = this.outerWidth - this.seismographConfig.margin.left - this.seismographConfig.margin.right;
    this.origXScale.range([0, this.width]);
    this.yScale.range([this.height, 0]);
    this.yScaleRmean.range([this.height, 0]);
    if (this.seismographConfig.isYAxis) {
      this.yAxis.scale(this.yScaleRmean);
    }
    if (this.seismographConfig.isYAxisRight) {
      this.yAxisRight.scale(this.yScaleRmean);
    }
    this.calcScaleAndZoom();
    if (this.canvas) {
      this.canvasHolder.attr("width", this.width)
        .attr("height", this.height+1);
      this.canvas.attr("width", this.width)
        .attr("height", this.height+1);
    }
    const resizeXScale = this.cloneXScale(this.currZoomXScale);
    // keep same time window
    // but use new pixel range
    resizeXScale.range([0, this.width]);
    // this updates currZoomXScale
    this.redrawWithXScale(resizeXScale);
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

  setMargin(value: MarginType ): Seismograph {
    this.seismographConfig.margin = value;
    if ( ! this.beforeFirstDraw) {
      this.calcWidthHeight(this.outerWidth, this.outerHeight);
      this.g.attr("transform", "translate(" + this.seismographConfig.margin.left + "," + this.seismographConfig.margin.top + ")");
    }
    return this;
  }
  drawTitle() {
    this.svg.selectAll("g.title").remove();
    let titleSVGText = this.svg.append("g")
       .classed("title", true)
       .attr("transform", "translate("+(this.seismographConfig.margin.left+(this.width)/2)+", "+0+")")
       .append("text").classed("title label", true)
       .attr("x",0).attr("y",0)
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
    for(let side of [ 'left', 'right']) {
      let hTranslate = (side==="left"?0:this.seismographConfig.margin.left+this.width+1);
      let svgText = this.svg.append("g")
         .classed("yLabel", true)
         .classed(side, true)
         .attr("x", 0)
         .attr("transform", `translate(${hTranslate}, ${(this.seismographConfig.margin.top+(this.height)/2)})`)
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
      if (side==="left") {
        svgText.text(this.seismographConfig.yLabel);
      } else {
        svgText.text(this.seismographConfig.yLabelRight);
      }
    }
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
    let svgText = this.svg.append("g")
       .classed("ySublabel", true)
       .attr("x", 0)
       .attr("transform", "translate( "+this.seismographConfig.ySublabelTrans+" , "+(this.seismographConfig.margin.top+(this.height)/2)+")")
       .append("text")
       .classed("y label sublabel", true);
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
    svgText
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
      if ( ! isDef(this.origXScale)) {
        this.origXScale = d3.scaleUtc();
      }
      this.origXScale.domain([timeWindow.startTime.toDate(), timeWindow.endTime.toDate()]);
      // force to be same but not to share same array
      this.currZoomXScale = this.cloneXScale(this.origXScale);
  }
  calcAmpScaleDomain(): void {
    const oldMinMax = this.yScaleData.domain();
    if (this.seismographConfig.fixedYScale) {
      this.yScaleData.domain(this.seismographConfig.fixedYScale);
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
      this.yScaleData.domain(minMax);

      if (this.linkedAmpScale) {
        if (oldMinMax[0] !== minMax[0] || oldMinMax[1] !== minMax[1]) {
          this.linkedAmpScale.recalculate(); // sets yScale.domain
        }
      } else {
        this.yScale.domain(minMax);
        if (this.seismographConfig.isYAxisNice) {
          this.yScale.nice();
        }
        this.redoDisplayYScale();
      }

    }
  }
  redoDisplayYScale(): void {
    let niceMinMax = this.yScale.domain();
    if (this.seismographConfig.doGain
        && this.seisDataList.length > 0
        && this.seisDataList.every(sdd => sdd.hasSensitivity())
        && this.seisDataList.every(sdd => sdd.seismogram.yUnit === COUNT_UNIT )) {
      // each has seisitivity
      const firstSensitivity = this.seisDataList[0].sensitivity;
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
      this.seismographConfig.ySublabel = `centered ${this.seismographConfig.ySublabel}`;
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
  /**
   * can append single seismogram segment or an array of segments.
   *
   * @param sddList array or single SeismogramDisplayData or Seismogram
   * @private
   */
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
  /**
   * appends the seismogram(s) or SeismogramDisplayData as separate time series.
   *
   * @param seismogram data to append
   * @returns this Seismograph
   */
  append(seismogram: Array<Seismogram> | Seismogram | SeismogramDisplayData) {
    if (seismogram instanceof SeismogramDisplayData) {
      this._internalAppend(seismogram);
    } else if (Array.isArray(seismogram)) {
      let sdd = seismogram.map(s => SeismogramDisplayData.fromSeismogram(s));
      this._internalAppend(sdd);
    } else if (seismogram instanceof Seismogram) {
      this._internalAppend(SeismogramDisplayData.fromSeismogram(seismogram));
    } else {
      throw new Error(`Unable to append, doesn't look like Array of Seismogram, Seismogram or SeismogramDisplayData: ${seismogram.constructor.name}`);
    }
    this.calcAmpScaleDomain();
    if ( ! this.beforeFirstDraw) {
      // only trigger a draw if appending after already drawn on screen
      // otherwise, just append the data and wait for outside to call first draw()
      this.drawSeismograms();
    }
    return this;
  }
  /**
   * Finds the SeismogramDisplayData within the display containing the given
   * Seismogram.
   *
   * @param   seis seismogram to search for
   * @returns       SeismogramDisplayData if found or null if not
   */
  getDisplayDataForSeismogram(seis: Seismogram): SeismogramDisplayData | null {
    let out = this.seisDataList.find(sd => sd.seismogram === seis);
    if (out) {return out; } else { return null;}
  }
  /**
   * Removes a seismogram from the display.
   *
   * @param   seisData seis data to remove
   */
  remove(seisData: SeismogramDisplayData): void {
    this.seisDataList = this.seisDataList.filter( sd => sd !== seisData);
  }
  /**
   * Removes seismograms that do not overlap the window.
   *
   * @param   timeWindow overlap data to keep
   */
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
    this.currZoomXScale.domain(seismograph.currZoomXScale.domain());
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
    if (seismograph.xScaleChangeListeners.find(l => l.destinationKey === this)) {
      seismograph.unlinkXScaleTo(this);
    }
  }
}

/**
 * Links amplitude scales across multiple seismographs, respecting doRmean.
 *
 * @param graphList optional list of Seismographs to link
 */
export class LinkedAmpScale {
  /**
   * @private
   */
  _graphSet: Set<Seismograph>;
  constructor(graphList: ?Array<Seismograph>) {
    const glist = graphList ? graphList : []; // in case null
    this._graphSet = new Set(glist);
    this._graphSet.forEach(g => {
      g.linkedAmpScale = this;
    });
  }
  /**
   * Link new Seismograph with this amplitude scale.
   *
   * @param   graph Seismograph to link
   */
  link(graph: Seismograph) {
    this._graphSet.add(graph);
    graph.linkedAmpScale = this;
    this.recalculate();
  }
  /**
   * Unlink Seismograph with this amplitude scale.
   *
   * @param   graph Seismograph to unlink
   */
  unlink(graph: Seismograph) {
    this._graphSet.delete(graph);
    this.recalculate();
  }
  /**
   * Recalculate the best amplitude scale for all Seismographs. Causes a redraw.
   */
  recalculate() {
    const graphList = Array.from(this._graphSet.values());
    const maxRange = graphList.reduce((acc, cur) => {
      let graphMaxRange = cur.yScaleData.domain()[1]-cur.yScaleData.domain()[0];
      return acc >  graphMaxRange ? acc : graphMaxRange;
    }, 0);
    const min = graphList.reduce((acc, cur) => {
      let graphMin = cur.yScaleData.domain()[0];
      return acc < graphMin ? acc : graphMin;
    }, Number.MAX_SAFE_INTEGER);
    const max = graphList.reduce((acc, cur) => {
      let graphMax = cur.yScaleData.domain()[1];
      return acc > graphMax ? acc : graphMax;
    }, -1*Number.MAX_SAFE_INTEGER);
    graphList.forEach(g => {
      if (g.seismographConfig.doRMean) {
        const mean = (g.yScaleData.domain()[1]+g.yScaleData.domain()[0]) / 2;
        g.yScale.domain([mean-maxRange/2, mean+maxRange/2]);
        g.yScaleRmean.domain([-1*maxRange/2, maxRange/2]);
      } else {
        g.yScale.domain([min, max]);
        g.yScaleRmean.domain([min, max]);
      }
      g.redoDisplayYScale();
      if ( ! g.beforeFirstDraw) {
        // only trigger a draw if appending after already drawn on screen
        // otherwise, just append the data and wait for outside to call first draw()
        g.draw();
      }
    });
  }
}


// static ID for seismogram
Seismograph._lastID = 0;

/**
 * Creates Markers for all of the arrivals in ttime.arrivals, relative
 * to the given Quake.
 *
 * @param   quake quake the travel times are relative to
 * @param   ttime travel times json object as returned from the
 * IRIS traveltime web service, or the json output of TauP
 * @returns        array of Markers suitable for adding to a seismograph
 */
export function createMarkersForTravelTimes(quake: Quake, ttime: any): Array<MarkerType> {
  return ttime.arrivals.map( a => {
    return {
      type: 'predicted',
      name: a.phase,
      time: moment.utc(quake.time).add(a.time, 'seconds')
    };
  });
}

export const seismograph_css = `


.marker .markerpath {
  fill: none;
  stroke: black;
  stroke-width: 1px;
}

.marker polygon {
  fill: rgba(150,220,150,.4);
}

.marker.predicted polygon {
  fill: rgba(220,220,220,.4);
}

.marker.pick polygon {
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

path.alignment {
  stroke-dasharray: 8;
  stroke-width: 2px;
}

svg.seismograph {
  height: 100%;
  width: 100%;
  min-height: 25px;
  min-width: 25px;
}

svg.seismograph g.ySublabel text {
  font-size: smaller;
}

svg.seismograph g.xSublabel text {
  font-size: smaller;
}

svg.seismograph text.title {
  font-size: larger;
  font-weight: bold;
  fill: black;
  color: black;
  dominant-baseline: hanging;
}

svg.realtimePlot g.allseismograms path.seispath {
  stroke: skyblue;
}

svg.seismograph g.allseismograms g:nth-child(9n+1) path.seispath {
  stroke: skyblue;
}

svg.seismograph g.allseismograms g:nth-child(9n+2) path.seispath {
  stroke: olivedrab;
}

svg.seismograph g.allseismograms g:nth-child(9n+3) path.seispath {
  stroke: goldenrod;
}

svg.seismograph g.allseismograms g:nth-child(9n+4) path.seispath {
  stroke: firebrick;
}

svg.seismograph g.allseismograms g:nth-child(9n+5) path.seispath {
  stroke: darkcyan;
}

svg.seismograph g.allseismograms g:nth-child(9n+6) path.seispath {
  stroke: orange;
}

svg.seismograph g.allseismograms g:nth-child(9n+7) path.seispath {
  stroke: darkmagenta;
}

svg.seismograph g.allseismograms g:nth-child(9n+8) path.seispath {
  stroke: mediumvioletred;
}

svg.seismograph g.allseismograms g:nth-child(9n+9) path.seispath {
  stroke: sienna;
}

/* same colors for titles */

svg.seismograph g.title text tspan:nth-child(9n+1)  {
  fill: skyblue;
}

svg.seismograph g.title text tspan:nth-child(9n+2)  {
  stroke: olivedrab;
}

svg.seismograph g.title text tspan:nth-child(9n+3)  {
  stroke: goldenrod;
}

svg.seismograph g.title tspan:nth-child(9n+4)  {
  stroke: firebrick;
}

svg.seismograph g.title tspan:nth-child(9n+5)  {
  stroke: darkcyan;
}

svg.seismograph g.title tspan:nth-child(9n+6)  {
  stroke: orange;
}

svg.seismograph g.title tspan:nth-child(9n+7)  {
  stroke: darkmagenta;
}

svg.seismograph g.title tspan:nth-child(9n+8)  {
  stroke: mediumvioletred;
}

svg.seismograph g.title tspan:nth-child(9n+9)  {
  stroke: sienna;
}


/* links in svg */
svg.seismograph text a {
  fill: #0000EE;
  text-decoration: underline;
}

`;

if (document){
  insertCSS(seismograph_css);
}
