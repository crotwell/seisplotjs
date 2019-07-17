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
  <body>
    <ul>
EOF
fi

for f in src/*
do
  jsfile=`basename ${f} .js`
  if [ -e src/${jsfile}.js ]
  then
    descText=""
    descArg=""
    descVarName="desc_${jsfile}"
    if [ -n "${descVarName}" ]; then
      descText="${!descVarName}"
      descArg='--project-description'
    fi

    echo npx documentation build -f ${format} -o docs/api/${jsfile}${md} --document-exported --github  --project-name seisplotjs.${jsfile} ${descArg} ${descText} src/${jsfile}.js
    npx documentation build -f ${format} -o docs/api/${jsfile}${md} --document-exported --github --project-name seisplotjs.${jsfile}  ${descArg} \'${descText}\' src/${jsfile}.js

      # modules links for README.md
      cat >> README_part.md <<EOF
  * [${jsfile}](https://github.com/crotwell/seisplotjs/blob/version2.0/src/${jsfile}.js) ${descText}
EOF


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
      <li><a href="${jsfile}${md}/index.html">${jsfile}</a></li>
EOF
  fi
done


if [[ 'html' == "$format" ]]
then
# bottom of index.html
cat >> docs/api/index.html <<EOF
  </ul>
</body>
</html>
EOF
fi
