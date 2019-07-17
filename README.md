# seisplotjs
Javascript modules for parsing, manipulating and plotting seismic data.

Examples of various access and display types can be seen at
[http://www.seis.sc.edu/~crotwell/seisplotjs_demo/](http://www.seis.sc.edu/~crotwell/seisplotjs_demo/). Also see the [wiki](https://github.com/crotwell/seisplotjs/wiki).


Seisplotjs is divided into submodules:

* [datalink](https://github.com/crotwell/seisplotjs/blob/version2.0/src/datalink.js) datalink protocol over web socket to a [Ringserver](https://seiscode.iris.washington.edu/projects/ringserver) datalink server
* [datechooser](https://github.com/crotwell/seisplotjs/blob/version2.0/src/datechooser.js) widget to choose dates and times
* [distaz](https://github.com/crotwell/seisplotjs/blob/version2.0/src/distaz.js) calculates distance between to lat/lon points
* [fdsnavailability](https://github.com/crotwell/seisplotjs/blob/version2.0/src/fdsnavailability.js) query data availability from an FDSN availability web service
* [fdsndataselect](https://github.com/crotwell/seisplotjs/blob/version2.0/src/fdsndataselect.js) query seismograms from an FDSN web service
* [fdsnevent](https://github.com/crotwell/seisplotjs/blob/version2.0/src/fdsnevent.js) query earthquakes from an FDSN web service
* [fdsnstation](https://github.com/crotwell/seisplotjs/blob/version2.0/src/fdsnstation.js) query networks, stations and channels from an FDSN web service
* [fdsnws-availability-1.0.schema.json.flow](https://github.com/crotwell/seisplotjs/blob/version2.0/src/fdsnws-availability-1.0.schema.json.flow.js)
* [fft](https://github.com/crotwell/seisplotjs/blob/version2.0/src/fft.js) discrete fourier transforms via [OregonDSP](https://www.npmjs.com/package/oregondsp)
* [fftplot](https://github.com/crotwell/seisplotjs/blob/version2.0/src/fftplot.js) plotting of specta output from the fft module using [d3](http://d3js.org)
* [filter](https://github.com/crotwell/seisplotjs/blob/version2.0/src/filter.js) timeseries filtering and utility functionality via [OregonDSP](https://www.npmjs.com/package/oregondsp)
* [helicorder](https://github.com/crotwell/seisplotjs/blob/version2.0/src/helicorder.js) helicorder style 24 hour plots using [d3](http://d3js.org)
* [index](https://github.com/crotwell/seisplotjs/blob/version2.0/src/index.js)
* [knowndatacenters](https://github.com/crotwell/seisplotjs/blob/version2.0/src/knowndatacenters.js) known FDSN datacenters and web services, predates the FDSN datacenters web service
* [miniseed](https://github.com/crotwell/seisplotjs/blob/version2.0/src/miniseed.js) parsing miniseed files
* [mseedarchive](https://github.com/crotwell/seisplotjs/blob/version2.0/src/mseedarchive.js) http access to remote miniseed files in a archive format
* [particlemotion](https://github.com/crotwell/seisplotjs/blob/version2.0/src/particlemotion.js) plot of particle motion from seismograms
* [plotutil](https://github.com/crotwell/seisplotjs/blob/version2.0/src/plotutil.js) utility functions for plotting
* [quakeml](https://github.com/crotwell/seisplotjs/blob/version2.0/src/quakeml.js) objects corresponding to elements in a QuakeML xml file
* [ringserverweb](https://github.com/crotwell/seisplotjs/blob/version2.0/src/ringserverweb.js) presentation of data pulled from the web interface of a [Ringserver](https://seiscode.iris.washington.edu/projects/ringserver)
* [sacpolezero](https://github.com/crotwell/seisplotjs/blob/version2.0/src/sacpolezero.js) parsing of SAC polezero response file
* [seedcodec](https://github.com/crotwell/seisplotjs/blob/version2.0/src/seedcodec.js) decompression for seismic data, often used from miniseed
* [seedlink](https://github.com/crotwell/seisplotjs/blob/version2.0/src/seedlink.js) seedlink protocol over web socket to a [Ringserver](https://seiscode.iris.washington.edu/projects/ringserver) seedlink server
* [seismogram](https://github.com/crotwell/seisplotjs/blob/version2.0/src/seismogram.js) objects representing seismograms and timeseries
* [seismograph](https://github.com/crotwell/seisplotjs/blob/version2.0/src/seismograph.js) plotting of seismograms using [d3](http://d3js.org)
* [seismographconfig](https://github.com/crotwell/seisplotjs/blob/version2.0/src/seismographconfig.js) configuration of seismograph plots
* [stationxml](https://github.com/crotwell/seisplotjs/blob/version2.0/src/stationxml.js) objects corresponding to elements in a StationXML xml file
* [taper](https://github.com/crotwell/seisplotjs/blob/version2.0/src/taper.js) tapering of timeseries
* [transfer](https://github.com/crotwell/seisplotjs/blob/version2.0/src/transfer.js) instrument deconvolution of seismograms using response
* [traveltime](https://github.com/crotwell/seisplotjs/blob/version2.0/src/traveltime.js) travel times of seismic waves via the IRIS traveltime web service
* [util](https://github.com/crotwell/seisplotjs/blob/version2.0/src/util.js) general utility functions
* [vector](https://github.com/crotwell/seisplotjs/blob/version2.0/src/vector.js) vector process of seismograms
* [xseed](https://github.com/crotwell/seisplotjs/blob/version2.0/src/xseed.js) next generation miniseed-like file format for seismic data
