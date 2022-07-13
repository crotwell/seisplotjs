# seisplotjs
Javascript modules for parsing, manipulating and plotting seismic data.

A tutorial with examples of various access and display types can be seen at
[crotwell.github.io/seisplotjs](http://crotwell.github.io/seisplotjs/).
Also see the [wiki](https://github.com/crotwell/seisplotjs/wiki).

Install with `npm i --save seisplotjs`

Seisplotjs is divided into submodules:

* [axisutil](https://crotwell.github.io/seisplotjs/api/axisutil.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.0/src/axisutil.ts)
* [components](https://crotwell.github.io/seisplotjs/api/components.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.0/src/components.ts)
* [cssutil](https://crotwell.github.io/seisplotjs/api/cssutil.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.0/src/cssutil.ts) simple util to inject css into web document
* [datalink](https://crotwell.github.io/seisplotjs/api/datalink.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.0/src/datalink.ts) datalink protocol over web socket to a [Ringserver](https://seiscode.iris.washington.edu/projects/ringserver) datalink server
* [dataset](https://crotwell.github.io/seisplotjs/api/dataset.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.0/src/dataset.ts)
* [datechooser](https://crotwell.github.io/seisplotjs/api/datechooser.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.0/src/datechooser.ts) widget to choose dates and times
* [displayorganize](https://crotwell.github.io/seisplotjs/api/displayorganize.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.0/src/displayorganize.ts) organize more complex displays composed of individual pieces
* [distaz](https://crotwell.github.io/seisplotjs/api/distaz.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.0/src/distaz.ts) calculates distance between to lat/lon points
* [fdsnavailability](https://crotwell.github.io/seisplotjs/api/fdsnavailability.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.0/src/fdsnavailability.ts) query data availability from an FDSN availability web service
* [fdsndatacenters](https://crotwell.github.io/seisplotjs/api/fdsndatacenters.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.0/src/fdsndatacenters.ts) query FDSN data center registry
* [fdsndataselect](https://crotwell.github.io/seisplotjs/api/fdsndataselect.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.0/src/fdsndataselect.ts) query seismograms from an FDSN web service
* [fdsnevent](https://crotwell.github.io/seisplotjs/api/fdsnevent.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.0/src/fdsnevent.ts) query earthquakes from an FDSN web service
* [fdsnsourceid](https://crotwell.github.io/seisplotjs/api/fdsnsourceid.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.0/src/fdsnsourceid.ts)
* [fdsnstation](https://crotwell.github.io/seisplotjs/api/fdsnstation.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.0/src/fdsnstation.ts) query networks, stations and channels from an FDSN web service
* [fft](https://crotwell.github.io/seisplotjs/api/fft.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.0/src/fft.ts) discrete fourier transforms via [OregonDSP](https://www.npmjs.com/package/oregondsp)
* [filter](https://crotwell.github.io/seisplotjs/api/filter.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.0/src/filter.ts) timeseries filtering and utility functionality via [OregonDSP](https://www.npmjs.com/package/oregondsp)
* [handlebarshelpers](https://crotwell.github.io/seisplotjs/api/handlebarshelpers.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.0/src/handlebarshelpers.ts) helpers for use with [handlebars](http://handlebarsjs.com/), eg in titles
* [helicorder](https://crotwell.github.io/seisplotjs/api/helicorder.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.0/src/helicorder.ts) helicorder style 24 hour plots using [d3](http://d3js.org)
* [infotable](https://crotwell.github.io/seisplotjs/api/infotable.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.0/src/infotable.ts)
* [irisfedcatalog](https://crotwell.github.io/seisplotjs/api/irisfedcatalog.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.0/src/irisfedcatalog.ts) query IRIS fedcatalog web service
* [leafletutil](https://crotwell.github.io/seisplotjs/api/leafletutil.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.0/src/leafletutil.ts)
* [miniseed](https://crotwell.github.io/seisplotjs/api/miniseed.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.0/src/miniseed.ts) parsing miniseed files
* [mseed3](https://crotwell.github.io/seisplotjs/api/mseed3.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.0/src/mseed3.ts) next generation miniseed file format for seismic data
* [mseedarchive](https://crotwell.github.io/seisplotjs/api/mseedarchive.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.0/src/mseedarchive.ts) http access to remote miniseed files in a archive format
* [oregondsputil](https://crotwell.github.io/seisplotjs/api/oregondsputil.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.0/src/oregondsputil.ts) utils for using the [OregonDSP](https://www.npmjs.com/package/oregondsp) package
* [particlemotion](https://crotwell.github.io/seisplotjs/api/particlemotion.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.0/src/particlemotion.ts) plot of particle motion from seismograms
* [quakeml](https://crotwell.github.io/seisplotjs/api/quakeml.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.0/src/quakeml.ts) objects corresponding to elements in a QuakeML xml file
* [ringserverweb](https://crotwell.github.io/seisplotjs/api/ringserverweb.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.0/src/ringserverweb.ts) presentation of data pulled from the web interface of a [Ringserver](https://seiscode.iris.washington.edu/projects/ringserver)
* [sacpolezero](https://crotwell.github.io/seisplotjs/api/sacpolezero.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.0/src/sacpolezero.ts) parsing of SAC polezero response file
* [scale](https://crotwell.github.io/seisplotjs/api/scale.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.0/src/scale.ts)
* [seedcodec](https://crotwell.github.io/seisplotjs/api/seedcodec.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.0/src/seedcodec.ts) decompression for seismic data, often used from miniseed
* [seedlink](https://crotwell.github.io/seisplotjs/api/seedlink.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.0/src/seedlink.ts) seedlink protocol over web socket to a [Ringserver](https://seiscode.iris.washington.edu/projects/ringserver) seedlink server
* [seedlink4](https://crotwell.github.io/seisplotjs/api/seedlink4.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.0/src/seedlink4.ts)
* [seismogram](https://crotwell.github.io/seisplotjs/api/seismogram.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.0/src/seismogram.ts) objects representing seismograms and timeseries
* [seismogramloader](https://crotwell.github.io/seisplotjs/api/seismogramloader.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.0/src/seismogramloader.ts) uses fdsnstation, fdsnevent, traveltime and fdsndataselect to load seismograms
* [seismogramsegment](https://crotwell.github.io/seisplotjs/api/seismogramsegment.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.0/src/seismogramsegment.ts) objects representing contiguous segments of seismograms
* [seismograph](https://crotwell.github.io/seisplotjs/api/seismograph.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.0/src/seismograph.ts) plotting of seismograms using [d3](http://d3js.org)
* [seismographconfig](https://crotwell.github.io/seisplotjs/api/seismographconfig.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.0/src/seismographconfig.ts) configuration of seismograph plots
* [sorting](https://crotwell.github.io/seisplotjs/api/sorting.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.0/src/sorting.ts)
* [spectraplot](https://crotwell.github.io/seisplotjs/api/spectraplot.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.0/src/spectraplot.ts)
* [spelement](https://crotwell.github.io/seisplotjs/api/spelement.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.0/src/spelement.ts)
* [stationxml](https://crotwell.github.io/seisplotjs/api/stationxml.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.0/src/stationxml.ts) objects corresponding to elements in a StationXML xml file
* [taper](https://crotwell.github.io/seisplotjs/api/taper.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.0/src/taper.ts) tapering of timeseries
* [transfer](https://crotwell.github.io/seisplotjs/api/transfer.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.0/src/transfer.ts) instrument deconvolution of seismograms using response
* [traveltime](https://crotwell.github.io/seisplotjs/api/traveltime.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.0/src/traveltime.ts) travel times of seismic waves via the IRIS traveltime web service
* [util](https://crotwell.github.io/seisplotjs/api/util.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.0/src/util.ts) general utility functions
* [vector](https://crotwell.github.io/seisplotjs/api/vector.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.0/src/vector.ts) vector process of seismograms
* [version](https://crotwell.github.io/seisplotjs/api/version.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.0/src/version.ts)


# Upgrade 2 -> 3

Seisplotjs 3 now uses typescript,
[luxon](https://moment.github.io/luxon/#/) instead of moment,
html components instead of inserting into a div,
and tries to have a more vanillajs style.
