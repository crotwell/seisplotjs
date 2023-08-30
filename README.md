# seisplotjs
Javascript modules for parsing, manipulating and plotting seismic data.

A tutorial with examples of various access and display types can be seen at
[crotwell.github.io/seisplotjs](https://crotwell.github.io/seisplotjs/).
Also see the [wiki](https://github.com/crotwell/seisplotjs/wiki).

Install with `npm i --save seisplotjs`

Seisplotjs is divided into submodules:

  * [animatedseismograph](https://crotwell.github.io/seisplotjs/api/animatedseismograph.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/animatedseismograph.ts) real time animated seismograph
  * [areautil](https://crotwell.github.io/seisplotjs/api/areautil.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/areautil.ts) area utils, lat,lon point inside area
  * [axisutil](https://crotwell.github.io/seisplotjs/api/axisutil.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/axisutil.ts) draw title and axis labels
  * [components](https://crotwell.github.io/seisplotjs/api/components.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/components.ts) simple web components
  * [cssutil](https://crotwell.github.io/seisplotjs/api/cssutil.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/cssutil.ts) simple util to inject css into web document
  * [datalink](https://crotwell.github.io/seisplotjs/api/datalink.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/datalink.ts) datalink protocol over web socket to a [Ringserver](https://seiscode.iris.washington.edu/projects/ringserver) datalink server
  * [dataset](https://crotwell.github.io/seisplotjs/api/dataset.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/dataset.ts) load/save seismic data as zip file
  * [datechooser](https://crotwell.github.io/seisplotjs/api/datechooser.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/datechooser.ts) widget to choose dates and times
  * [distaz](https://crotwell.github.io/seisplotjs/api/distaz.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/distaz.ts) calculates distance between to lat/lon points
  * [fdsnavailability](https://crotwell.github.io/seisplotjs/api/fdsnavailability.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/fdsnavailability.ts) query data availability from an FDSN availability web service
  * [fdsncommon](https://crotwell.github.io/seisplotjs/api/fdsncommon.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/fdsncommon.ts) common superclass for services following FDSN pattern
  * [fdsndatacenters](https://crotwell.github.io/seisplotjs/api/fdsndatacenters.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/fdsndatacenters.ts) query FDSN data center registry
  * [fdsndataselect](https://crotwell.github.io/seisplotjs/api/fdsndataselect.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/fdsndataselect.ts) query seismograms from an FDSN web service
  * [fdsnevent](https://crotwell.github.io/seisplotjs/api/fdsnevent.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/fdsnevent.ts) query earthquakes from an FDSN web service
  * [fdsnsourceid](https://crotwell.github.io/seisplotjs/api/fdsnsourceid.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/fdsnsourceid.ts) parse FDSN sourceId
  * [fdsnstation](https://crotwell.github.io/seisplotjs/api/fdsnstation.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/fdsnstation.ts) query networks, stations and channels from an FDSN web service
  * [fft](https://crotwell.github.io/seisplotjs/api/fft.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/fft.ts) discrete fourier transforms via [OregonDSP](https://www.npmjs.com/package/oregondsp)
  * [filter](https://crotwell.github.io/seisplotjs/api/filter.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/filter.ts) timeseries filtering and utility functionality via [OregonDSP](https://www.npmjs.com/package/oregondsp)
  * [handlebarshelpers](https://crotwell.github.io/seisplotjs/api/handlebarshelpers.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/handlebarshelpers.ts) helpers for use with [handlebars](https://handlebarsjs.com/), eg in titles
  * [helicorder](https://crotwell.github.io/seisplotjs/api/helicorder.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/helicorder.ts) helicorder style 24 hour plots
  * [infotable](https://crotwell.github.io/seisplotjs/api/infotable.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/infotable.ts) component to display information about seismograms
  * [irisfedcatalog](https://crotwell.github.io/seisplotjs/api/irisfedcatalog.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/irisfedcatalog.ts) query IRIS fedcatalog web service
  * [leaflet_css](https://crotwell.github.io/seisplotjs/api/leaflet_css.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/leaflet_css.ts) standard css for leaflet
  * [leafletutil](https://crotwell.github.io/seisplotjs/api/leafletutil.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/leafletutil.ts) create leaflet maps with stations and earthquakes
  * [miniseed](https://crotwell.github.io/seisplotjs/api/miniseed.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/miniseed.ts) parsing miniseed files
  * [mseed3](https://crotwell.github.io/seisplotjs/api/mseed3.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/mseed3.ts) next generation miniseed file format for seismic data
  * [mseedarchive](https://crotwell.github.io/seisplotjs/api/mseedarchive.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/mseedarchive.ts) http access to remote miniseed files in a archive format
  * [oregondsputil](https://crotwell.github.io/seisplotjs/api/oregondsputil.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/oregondsputil.ts) utils for using the [OregonDSP](https://www.npmjs.com/package/oregondsp) package
  * [organizeddisplay](https://crotwell.github.io/seisplotjs/api/organizeddisplay.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/organizeddisplay.ts) organize more complex displays composed of individual pieces
  * [particlemotion](https://crotwell.github.io/seisplotjs/api/particlemotion.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/particlemotion.ts) plot of particle motion from seismograms
  * [quakeml](https://crotwell.github.io/seisplotjs/api/quakeml.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/quakeml.ts) objects corresponding to elements in a QuakeML xml file
  * [ringserverweb](https://crotwell.github.io/seisplotjs/api/ringserverweb.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/ringserverweb.ts) presentation of data pulled from the web interface of a [Ringserver](https://seiscode.iris.washington.edu/projects/ringserver)
  * [sacpolezero](https://crotwell.github.io/seisplotjs/api/sacpolezero.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/sacpolezero.ts) parsing of SAC polezero response file
  * [scale](https://crotwell.github.io/seisplotjs/api/scale.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/scale.ts) time and amplitude scale change notification
  * [seedcodec](https://crotwell.github.io/seisplotjs/api/seedcodec.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/seedcodec.ts) decompression for seismic data, often used from miniseed
  * [seedlink](https://crotwell.github.io/seisplotjs/api/seedlink.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/seedlink.ts) seedlink protocol over web socket to a [Ringserver](https://seiscode.iris.washington.edu/projects/ringserver) seedlink server
  * [seedlink4](https://crotwell.github.io/seisplotjs/api/seedlink4.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/seedlink4.ts) seedlink version 4 protocol over web socket to a [Ringserver](https://seiscode.iris.washington.edu/projects/ringserver) seedlink server
  * [seismogram](https://crotwell.github.io/seisplotjs/api/seismogram.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/seismogram.ts) objects representing seismograms and timeseries
  * [seismogramloader](https://crotwell.github.io/seisplotjs/api/seismogramloader.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/seismogramloader.ts) uses fdsnstation, fdsnevent, traveltime and fdsndataselect to load seismograms
  * [seismogramsegment](https://crotwell.github.io/seisplotjs/api/seismogramsegment.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/seismogramsegment.ts) objects representing contiguous segments of seismograms
  * [seismograph](https://crotwell.github.io/seisplotjs/api/seismograph.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/seismograph.ts) plotting of seismograms
  * [seismographconfig](https://crotwell.github.io/seisplotjs/api/seismographconfig.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/seismographconfig.ts) configuration of seismograph plots
  * [seismographconfigeditor](https://crotwell.github.io/seisplotjs/api/seismographconfigeditor.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/seismographconfigeditor.ts) editor for configuration of seismograph plots
  * [seismographutil](https://crotwell.github.io/seisplotjs/api/seismographutil.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/seismographutil.ts) low level drawing functions for seismograph
  * [sorting](https://crotwell.github.io/seisplotjs/api/sorting.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/sorting.ts) sorting utilites for seismic data
  * [spectraplot](https://crotwell.github.io/seisplotjs/api/spectraplot.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/spectraplot.ts) plotting of specta output from the fft module
  * [spelement](https://crotwell.github.io/seisplotjs/api/spelement.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/spelement.ts) superclass for some custom elements
  * [stationxml](https://crotwell.github.io/seisplotjs/api/stationxml.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/stationxml.ts) objects corresponding to elements in a StationXML xml file
  * [taper](https://crotwell.github.io/seisplotjs/api/taper.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/taper.ts) tapering of timeseries
  * [transfer](https://crotwell.github.io/seisplotjs/api/transfer.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/transfer.ts) instrument deconvolution of seismograms using response
  * [traveltime](https://crotwell.github.io/seisplotjs/api/traveltime.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/traveltime.ts) travel times of seismic waves via the IRIS traveltime web service
  * [usgsgeojson](https://crotwell.github.io/seisplotjs/api/usgsgeojson.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/usgsgeojson.ts) query and parse GeoJson from USGS
  * [util](https://crotwell.github.io/seisplotjs/api/util.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/util.ts) general utility functions
  * [vector](https://crotwell.github.io/seisplotjs/api/vector.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/vector.ts) vector process of seismograms
  * [version](https://crotwell.github.io/seisplotjs/api/version.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.1/src/version.ts) version of this library



# Upgrade 2 -> 3

There are many incompatible changes, but the most important are that
Seisplotjs 3 now uses typescript,
[luxon](https://moment.github.io/luxon/#/) instead of moment,
html components instead of inserting into a div,
and tries to have a more vanillajs style.

Documentation for previous versions is archived at
[http://www.seis.sc.edu/software/seisplotjs](http://www.seis.sc.edu/software/seisplotjs)
