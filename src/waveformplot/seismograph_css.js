
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

canvas.seismograph {
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

svg.overlayPlot g.title tspan:nth-child(9n+2)  {
  stroke: olivedrab;
}

svg.overlayPlot g.title tspan:nth-child(9n+3)  {
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
