# seisplotjs
Javascript modules for parsing, manipulating and plotting seismic data.

Examples of various access and display types can be seen at
[http://www.seis.sc.edu/~crotwell/seisplotjs_demo/](http://www.seis.sc.edu/~crotwell/seisplotjs_demo/).


Seisplotjs is divided into submodules:

* [distaz](https://github.com/crotwell/seisplotjs-distaz) - calculates distance between to lat/lon points
* [fdsnevent](https://github.com/crotwell/seisplotjs-fdsnevent) - query earthquakes from an FDSN web service
* [fdsnstation](https://github.com/crotwell/seisplotjs-fdsnstation) - query networks, stations and channels from an FDSN web service
* [fdsndataselect](https://github.com/crotwell/seisplotjs-fdsndataselect) - query seismograms from an FDSN web service
* [filter](https://github.com/crotwell/seisplotjs-filter) - timeseries filtering and fourier transforms
* [miniseed](https://github.com/crotwell/seisplotjs-miniseed) - parsing miniseed files
* [model](https://github.com/crotwell/seisplotjs-model) - various objects used by the other modules
* [seedcodec](https://github.com/crotwell/seisplotjs-seedcodec) - decompression for seismic data, often used from miniseed
* [seedlink](https://github.com/crotwell/seisplotjs-seedlink) - seedlink protocol over web socket to a [Ringserver](https://seiscode.iris.washington.edu/projects/ringserver) seedlink server
* [traveltime](https://github.com/crotwell/seisplotjs-traveltime) - travel times of seismic waves via the IRIS traveltime web service
* [waveformplot](https://github.com/crotwell/seisplotjs-waveformplot) - plotting of seismograms via [d3](http://d3js.org)
* d3 - the [d3](http://d3js.org) library, for easy access
* moment - the [momentjs](http://momentjs.com) library, for easy access


