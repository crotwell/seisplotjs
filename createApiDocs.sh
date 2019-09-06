#!/bin/bash

format=html
md='.md'

if [[ 'html' == "$format"  ]]
then
  md=''
elif [[ 'md' == "$format" ]]
then
  md='.md'
elif [[ 'json' == "$format" ]]
then
  md='.json'
fi

if [ ! -e docs/api ]; then
  mkdir docs/api
fi

# descriptions of each module
desc_datalink='datalink protocol over web socket to a [Ringserver](https://seiscode.iris.washington.edu/projects/ringserver) datalink server'
desc_datechooser='widget to choose dates and times'
desc_distaz='calculates distance between to lat/lon points'
desc_fdsnavailability='query data availability from an FDSN availability web service'
desc_fdsndatacenters='query FDSN data center registry'
desc_fdsndataselect='query seismograms from an FDSN web service'
desc_fdsnevent='query earthquakes from an FDSN web service'
desc_fdsnstation='query networks, stations and channels from an FDSN web service'
desc_fft='discrete fourier transforms via [OregonDSP](https://www.npmjs.com/package/oregondsp)'
desc_fftplot='plotting of specta output from the fft module using [d3](http://d3js.org)'
desc_filter='timeseries filtering and utility functionality via [OregonDSP](https://www.npmjs.com/package/oregondsp)'
desc_helicorder='helicorder style 24 hour plots using [d3](http://d3js.org)'
desc_knowndatacenters='known FDSN datacenters and web services, predates the FDSN datacenters web service'
desc_miniseed='parsing miniseed files'
desc_mseedarchive='http access to remote miniseed files in a archive format'
desc_particlemotion='plot of particle motion from seismograms'
desc_plotutil='utility functions for plotting'
desc_quakeml='objects corresponding to elements in a QuakeML xml file'
desc_ringserverweb='presentation of data pulled from the web interface of a [Ringserver](https://seiscode.iris.washington.edu/projects/ringserver)'
desc_sacpolezero='parsing of SAC polezero response file'
desc_seedcodec='decompression for seismic data, often used from miniseed'
desc_seedlink='seedlink protocol over web socket to a [Ringserver](https://seiscode.iris.washington.edu/projects/ringserver) seedlink server'
desc_seismogram='objects representing seismograms and timeseries'
desc_seismograph='plotting of seismograms using [d3](http://d3js.org)'
desc_seismographconfig='configuration of seismograph plots'
desc_stationxml='objects corresponding to elements in a StationXML xml file'
desc_taper='tapering of timeseries'
desc_transfer='instrument deconvolution of seismograms using response'
desc_traveltime='travel times of seismic waves via the IRIS traveltime web service'
desc_util='general utility functions'
desc_vector='vector process of seismograms'
desc_xseed='next generation miniseed-like file format for seismic data'
desc_d3='the [d3](http://d3js.org) library, for easy access'
desc_moment='the [momentjs](http://momentjs.com) library, for easy access'

if [ -e README_part.md ]; then
  rm README_part.md
fi


if [[ 'html' == "$format"  ]]
then
# top of index.html
cat > docs/api/index.html <<EOF
<html>
  <head>
    <meta charset='utf-8'>
    <title>Seisplotjs 2.0 API Documentation</title>
    <meta name='description' content='Javascript library for parsing, manipulating and displaying seismic data.'>
    <meta name='viewport' content='width=device-width,initial-scale=1'>
    <link href='../api/assets/bass.css' rel='stylesheet'>
    <link href='../api/assets/split.css' rel='stylesheet'>
  </head>
  <body>
    <div class='flex'>
      <div id='split-left' class='overflow-auto fs0 height-viewport-100'>
        <div class='py1 px2'>
          <div id='toc'>
            <ul class='list-reset h5 py1-ul'>
              <li><a href="../api/index.html" class="">API JS Docs</a></li>
              <li><a href="../examples/index.html" class="">Examples</a></li>
              <li><a href="../tutorial/index.html" class="">Tutorial</a></li>
            </ul>
          </div>
        </div>
      </div>
      <div id='split-right' class='relative overflow-auto height-viewport-100'>
              <section class='p2 mb2 clearfix bg-white minishadow'>
        <div class='clearfix'>

          <h3>Seisplotjs API Documentation</h3>
          <p>Seisplotjs is a collection of javascript routines for requesting,
            manipulating and plotting seismic data. It is divided into submodules,
            which are listed below.
          </p>
          <ul>
EOF
fi

for path in src/*.js
do
  f=${path##*/}
  jsfile=${f%.js}
  flowfile=${jsfile%.flow}
  if [ "${jsfile}" != "${flowfile}" ] || [ "${jsfile}" == "index" ]; then
    # skip .flow.js files
    continue
  fi
  if [ -e src/${jsfile}.js ]
  then
    descText=""
    descArg=""
    descVarName="desc_${jsfile}"
    if [ -n "${descVarName}" ]; then
      descText="${!descVarName}"
      descArg='--project-description'
    fi
    if [ 'index' != "$jsfile" ]
    then
      echo npx documentation build -f ${format} -o docs/api/${jsfile}${md} --document-exported --github  --project-name seisplotjs.${jsfile} src/${jsfile}.js
      npx documentation build -f ${format} -o docs/api/${jsfile}${md} --document-exported --github  --project-name seisplotjs.${jsfile} src/${jsfile}.js
      if [[ 'html' == "$format"  ]]
      then
        mv docs/api/${jsfile}/index.html docs/api/${jsfile}.html
      fi
      # modules links for README.md
      cat >> README_part.md <<EOF
  * [${jsfile}](http://www.seis.sc.edu/~crotwell/seisplotjs_v2/api/${jsfile}.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version2.0/src/${jsfile}.js) ${descText}
EOF

    fi
  elif [ -d src/${jsfile} ]
  then
    echo npx documentation build -f ${format} -o docs/api/${jsfile}${md} --document-exported --github --project-name seisplotjs.${jsfile} src/${jsfile}/[a-hj-z]*.js
    npx documentation build -f ${format} -o docs/api/${jsfile}${md} --document-exported --github --project-name seisplotjs.${jsfile} src/${jsfile}/[a-hj-z]*.js
  else
    echo unknown file ${f}
  fi
  if [[ 'html' == "$format" ]]
  then
    # entry of index.html
    cat >> docs/api/index.html <<EOF
      <li><a href="${jsfile}${md}.html">${jsfile}</a> - ${descText}</li>
EOF
  fi
done


if [[ 'html' == "$format" ]]
then
# bottom of index.html
cat >> docs/api/index.html <<EOF
          </ul>
        </div>
      </div>
    </div>
</body>
</html>
EOF
fi

# copy assets
if [[ 'html' == "$format"  ]]
then
  rm -rf docs/api/assets
  mv docs/api/helicorder/assets docs/api/.
  for f in src/*
  do
    jsfile=`basename ${f} .js`
    if [ -d docs/api/${jsfile} ]
    then
      rm -r docs/api/${jsfile}
    fi
  done
fi
