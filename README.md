# seisplotjs
Javascript modules for parsing, manipulating and plotting seismic data.

A tutorial with examples of various access and display types can be seen at
[crotwell.github.io/seisplotjs](http://crotwell.github.io/seisplotjs/).
Also see the [wiki](https://github.com/crotwell/seisplotjs/wiki).

Install with `npm i --save seisplotjs`

Seisplotjs is divided into submodules:

* [cssutil](https://crotwell.github.io/seisplotjs/api/cssutil.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/cssutil.js) simple util to inject css into web document
* [datalink](https://crotwell.github.io/seisplotjs/api/datalink.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/datalink.js) datalink protocol over web socket to a [Ringserver](https://seiscode.iris.washington.edu/projects/ringserver) datalink server
* [datechooser](https://crotwell.github.io/seisplotjs/api/datechooser.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/datechooser.js) widget to choose dates and times
* [distaz](https://crotwell.github.io/seisplotjs/api/distaz.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/distaz.js) calculates distance between to lat/lon points
* [fdsnavailability](https://crotwell.github.io/seisplotjs/api/fdsnavailability.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/fdsnavailability.js) query data availability from an FDSN availability web service
* [fdsndatacenters](https://crotwell.github.io/seisplotjs/api/fdsndatacenters.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/fdsndatacenters.js) query FDSN data center registry
* [fdsndataselect](https://crotwell.github.io/seisplotjs/api/fdsndataselect.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/fdsndataselect.js) query seismograms from an FDSN web service
* [fdsnevent](https://crotwell.github.io/seisplotjs/api/fdsnevent.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/fdsnevent.js) query earthquakes from an FDSN web service
* [fdsnstation](https://crotwell.github.io/seisplotjs/api/fdsnstation.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/fdsnstation.js) query networks, stations and channels from an FDSN web service
* [fft](https://crotwell.github.io/seisplotjs/api/fft.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/fft.js) discrete fourier transforms via [OregonDSP](https://www.npmjs.com/package/oregondsp)
* [fftplot](https://crotwell.github.io/seisplotjs/api/fftplot.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/fftplot.js) plotting of specta output from the fft module using [d3](http://d3js.org)
* [filter](https://crotwell.github.io/seisplotjs/api/filter.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/filter.js) timeseries filtering and utility functionality via [OregonDSP](https://www.npmjs.com/package/oregondsp)
* [helicorder](https://crotwell.github.io/seisplotjs/api/helicorder.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/helicorder.js) helicorder style 24 hour plots using [d3](http://d3js.org)
* [knowndatacenters](https://crotwell.github.io/seisplotjs/api/knowndatacenters.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/knowndatacenters.js) known FDSN datacenters and web services, predates the FDSN datacenters web service
* [miniseed](https://crotwell.github.io/seisplotjs/api/miniseed.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/miniseed.js) parsing miniseed files
* [mseedarchive](https://crotwell.github.io/seisplotjs/api/mseedarchive.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/mseedarchive.js) http access to remote miniseed files in a archive format
* [oregondsputil](https://crotwell.github.io/seisplotjs/api/oregondsputil.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/oregondsputil.js) utils for using the [OregonDSP](https://www.npmjs.com/package/oregondsp) package
* [particlemotion](https://crotwell.github.io/seisplotjs/api/particlemotion.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/particlemotion.js) plot of particle motion from seismograms
* [plotutil](https://crotwell.github.io/seisplotjs/api/plotutil.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/plotutil.js) utility functions for plotting
* [quakeml](https://crotwell.github.io/seisplotjs/api/quakeml.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/quakeml.js) objects corresponding to elements in a QuakeML xml file
* [ringserverweb](https://crotwell.github.io/seisplotjs/api/ringserverweb.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/ringserverweb.js) presentation of data pulled from the web interface of a [Ringserver](https://seiscode.iris.washington.edu/projects/ringserver)
* [sacpolezero](https://crotwell.github.io/seisplotjs/api/sacpolezero.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/sacpolezero.js) parsing of SAC polezero response file
* [seedcodec](https://crotwell.github.io/seisplotjs/api/seedcodec.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/seedcodec.js) decompression for seismic data, often used from miniseed
* [seedlink](https://crotwell.github.io/seisplotjs/api/seedlink.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/seedlink.js) seedlink protocol over web socket to a [Ringserver](https://seiscode.iris.washington.edu/projects/ringserver) seedlink server
* [seismogram](https://crotwell.github.io/seisplotjs/api/seismogram.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/seismogram.js) objects representing seismograms and timeseries
* [seismograph](https://crotwell.github.io/seisplotjs/api/seismograph.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/seismograph.js) plotting of seismograms using [d3](http://d3js.org)
* [seismographconfig](https://crotwell.github.io/seisplotjs/api/seismographconfig.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/seismographconfig.js) configuration of seismograph plots
* [stationxml](https://crotwell.github.io/seisplotjs/api/stationxml.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/stationxml.js) objects corresponding to elements in a StationXML xml file
* [taper](https://crotwell.github.io/seisplotjs/api/taper.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/taper.js) tapering of timeseries
* [transfer](https://crotwell.github.io/seisplotjs/api/transfer.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/transfer.js) instrument deconvolution of seismograms using response
* [traveltime](https://crotwell.github.io/seisplotjs/api/traveltime.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/traveltime.js) travel times of seismic waves via the IRIS traveltime web service
* [util](https://crotwell.github.io/seisplotjs/api/util.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/util.js) general utility functions
* [vector](https://crotwell.github.io/seisplotjs/api/vector.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/vector.js) vector process of seismograms
* [xseed](https://crotwell.github.io/seisplotjs/api/xseed.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/xseed.js) next generation miniseed-like file format for seismic data
