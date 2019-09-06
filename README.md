# seisplotjs
Javascript modules for parsing, manipulating and plotting seismic data.

A tutorial with examples of various access and display types can be seen at
[http://www.seis.sc.edu/~crotwell/seisplotjs_v2/](http://www.seis.sc.edu/~crotwell/seisplotjs_v2/). Also see the [wiki](https://github.com/crotwell/seisplotjs/wiki).


Seisplotjs is divided into submodules:

* [datalink](http://www.seis.sc.edu/~crotwell/seisplotjs_v2/api/datalink.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/datalink.js) datalink protocol over web socket to a [Ringserver](https://seiscode.iris.washington.edu/projects/ringserver) datalink server
* [datechooser](http://www.seis.sc.edu/~crotwell/seisplotjs_v2/api/datechooser.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/datechooser.js) widget to choose dates and times
* [distaz](http://www.seis.sc.edu/~crotwell/seisplotjs_v2/api/distaz.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/distaz.js) calculates distance between to lat/lon points
* [fdsnavailability](http://www.seis.sc.edu/~crotwell/seisplotjs_v2/api/fdsnavailability.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/fdsnavailability.js) query data availability from an FDSN availability web service
* [fdsndatacenters](http://www.seis.sc.edu/~crotwell/seisplotjs_v2/api/fdsndatacenters.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/fdsndatacenters.js) query FDSN data center registry
* [fdsndataselect](http://www.seis.sc.edu/~crotwell/seisplotjs_v2/api/fdsndataselect.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/fdsndataselect.js) query seismograms from an FDSN web service
* [fdsnevent](http://www.seis.sc.edu/~crotwell/seisplotjs_v2/api/fdsnevent.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/fdsnevent.js) query earthquakes from an FDSN web service
* [fdsnstation](http://www.seis.sc.edu/~crotwell/seisplotjs_v2/api/fdsnstation.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/fdsnstation.js) query networks, stations and channels from an FDSN web service
* [fft](http://www.seis.sc.edu/~crotwell/seisplotjs_v2/api/fft.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/fft.js) discrete fourier transforms via [OregonDSP](https://www.npmjs.com/package/oregondsp)
* [fftplot](http://www.seis.sc.edu/~crotwell/seisplotjs_v2/api/fftplot.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/fftplot.js) plotting of specta output from the fft module using [d3](http://d3js.org)
* [filter](http://www.seis.sc.edu/~crotwell/seisplotjs_v2/api/filter.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/filter.js) timeseries filtering and utility functionality via [OregonDSP](https://www.npmjs.com/package/oregondsp)
* [helicorder](http://www.seis.sc.edu/~crotwell/seisplotjs_v2/api/helicorder.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/helicorder.js) helicorder style 24 hour plots using [d3](http://d3js.org)
* [knowndatacenters](http://www.seis.sc.edu/~crotwell/seisplotjs_v2/api/knowndatacenters.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/knowndatacenters.js) known FDSN datacenters and web services, predates the FDSN datacenters web service
* [miniseed](http://www.seis.sc.edu/~crotwell/seisplotjs_v2/api/miniseed.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/miniseed.js) parsing miniseed files
* [mseedarchive](http://www.seis.sc.edu/~crotwell/seisplotjs_v2/api/mseedarchive.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/mseedarchive.js) http access to remote miniseed files in a archive format
* [particlemotion](http://www.seis.sc.edu/~crotwell/seisplotjs_v2/api/particlemotion.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/particlemotion.js) plot of particle motion from seismograms
* [plotutil](http://www.seis.sc.edu/~crotwell/seisplotjs_v2/api/plotutil.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/plotutil.js) utility functions for plotting
* [quakeml](http://www.seis.sc.edu/~crotwell/seisplotjs_v2/api/quakeml.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/quakeml.js) objects corresponding to elements in a QuakeML xml file
* [ringserverweb](http://www.seis.sc.edu/~crotwell/seisplotjs_v2/api/ringserverweb.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/ringserverweb.js) presentation of data pulled from the web interface of a [Ringserver](https://seiscode.iris.washington.edu/projects/ringserver)
* [sacpolezero](http://www.seis.sc.edu/~crotwell/seisplotjs_v2/api/sacpolezero.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/sacpolezero.js) parsing of SAC polezero response file
* [seedcodec](http://www.seis.sc.edu/~crotwell/seisplotjs_v2/api/seedcodec.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/seedcodec.js) decompression for seismic data, often used from miniseed
* [seedlink](http://www.seis.sc.edu/~crotwell/seisplotjs_v2/api/seedlink.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/seedlink.js) seedlink protocol over web socket to a [Ringserver](https://seiscode.iris.washington.edu/projects/ringserver) seedlink server
* [seismogram](http://www.seis.sc.edu/~crotwell/seisplotjs_v2/api/seismogram.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/seismogram.js) objects representing seismograms and timeseries
* [seismograph](http://www.seis.sc.edu/~crotwell/seisplotjs_v2/api/seismograph.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/seismograph.js) plotting of seismograms using [d3](http://d3js.org)
* [seismographconfig](http://www.seis.sc.edu/~crotwell/seisplotjs_v2/api/seismographconfig.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/seismographconfig.js) configuration of seismograph plots
* [stationxml](http://www.seis.sc.edu/~crotwell/seisplotjs_v2/api/stationxml.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/stationxml.js) objects corresponding to elements in a StationXML xml file
* [taper](http://www.seis.sc.edu/~crotwell/seisplotjs_v2/api/taper.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/taper.js) tapering of timeseries
* [transfer](http://www.seis.sc.edu/~crotwell/seisplotjs_v2/api/transfer.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/transfer.js) instrument deconvolution of seismograms using response
* [traveltime](http://www.seis.sc.edu/~crotwell/seisplotjs_v2/api/traveltime.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/traveltime.js) travel times of seismic waves via the IRIS traveltime web service
* [util](http://www.seis.sc.edu/~crotwell/seisplotjs_v2/api/util.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/util.js) general utility functions
* [vector](http://www.seis.sc.edu/~crotwell/seisplotjs_v2/api/vector.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/vector.js) vector process of seismograms
* [xseed](http://www.seis.sc.edu/~crotwell/seisplotjs_v2/api/xseed.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/xseed.js) next generation miniseed-like file format for seismic data
