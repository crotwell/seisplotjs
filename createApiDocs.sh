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
desc_cssutil='simple util to inject css into web document'
desc_datalink='datalink protocol over web socket to a [Ringserver](https://seiscode.iris.washington.edu/projects/ringserver) datalink server'
desc_datechooser='widget to choose dates and times'
desc_displayorganize='organize more complex displays composed of individual pieces'
desc_distaz='calculates distance between to lat/lon points'
desc_fdsnavailability='query data availability from an FDSN availability web service'
desc_fdsndatacenters='query FDSN data center registry'
desc_fdsndataselect='query seismograms from an FDSN web service'
desc_fdsnevent='query earthquakes from an FDSN web service'
desc_fdsnstation='query networks, stations and channels from an FDSN web service'
desc_fft='discrete fourier transforms via [OregonDSP](https://www.npmjs.com/package/oregondsp)'
desc_fftplot='plotting of specta output from the fft module using [d3](http://d3js.org)'
desc_filter='timeseries filtering and utility functionality via [OregonDSP](https://www.npmjs.com/package/oregondsp)'
desc_handlebarshelpers='helpers for use with [handlebars](http://handlebarsjs.com/), eg in titles'
desc_helicorder='helicorder style 24 hour plots using [d3](http://d3js.org)'
desc_irisfedcatalog='query IRIS fedcatalog web service'
desc_miniseed='parsing miniseed files'
desc_mseed3='next generation miniseed file format for seismic data'
desc_mseedarchive='http access to remote miniseed files in a archive format'
desc_oregondsputil='utils for using the [OregonDSP](https://www.npmjs.com/package/oregondsp) package'
desc_particlemotion='plot of particle motion from seismograms'
desc_plotutil='utility functions for plotting'
desc_quakeml='objects corresponding to elements in a QuakeML xml file'
desc_ringserverweb='presentation of data pulled from the web interface of a [Ringserver](https://seiscode.iris.washington.edu/projects/ringserver)'
desc_sacpolezero='parsing of SAC polezero response file'
desc_seedcodec='decompression for seismic data, often used from miniseed'
desc_seedlink='seedlink protocol over web socket to a [Ringserver](https://seiscode.iris.washington.edu/projects/ringserver) seedlink server'
desc_seismogram='objects representing seismograms and timeseries'
desc_seismogramloader='uses fdsnstation, fdsnevent, traveltime and fdsndataselect to load seismograms'
desc_seismogramsegment='objects representing contiguous segments of seismograms'
desc_seismograph='plotting of seismograms using [d3](http://d3js.org)'
desc_seismographconfig='configuration of seismograph plots'
desc_stationxml='objects corresponding to elements in a StationXML xml file'
desc_taper='tapering of timeseries'
desc_transfer='instrument deconvolution of seismograms using response'
desc_traveltime='travel times of seismic waves via the IRIS traveltime web service'
desc_util='general utility functions'
desc_vector='vector process of seismograms'
desc_d3='the [d3](http://d3js.org) library, for easy access'
desc_luxon='the [luxon](https://moment.github.io/luxon/) library, for easy access'

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
              <li><a href="../index.html" class="">Seisplotjs</a></li>
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

          <h3>Seisplotjs 2.1.0-alpha.0 API Documentation</h3>
          <p>Seisplotjs is a collection of javascript routines for requesting,
            manipulating and plotting seismic data. It is divided into submodules,
            which are listed below.
          </p>
          <ul>
EOF
fi

for path in src/*.ts
do
  f=${path##*/}
  jsfile=${f%.ts}
  flowfile=${jsfile%.flow}
  if [ "${jsfile}" != "${flowfile}" ]  || [ "${jsfile}" == "index" ]; then
    # skip .flow.js files
    continue
  fi
  if [ -e src/${jsfile}.ts ]
  then
    descText=""
    descArg=""
    descVarName="desc_${jsfile}"
    if [ -n "${descVarName}" ]; then
      descText="${!descVarName}"
      descArg='--project-description'
    else
      echo "Missing Desc for ${jsfile} #################"
    fi
    # fix markdown style links with html
    re="(.*)\[(.+)\]\((.+)\)(.*)"
    descTextHtml="${descText}"
    while [[ $descTextHtml =~ $re ]]; do
      descTextHtml="${BASH_REMATCH[1]}<a href=\"${BASH_REMATCH[3]}\">${BASH_REMATCH[2]}</a>${BASH_REMATCH[4]}"
    done
    if [ 'index' != "$jsfile" ]
    then
      #echo npx documentation build --parse-extension ts -f ${format} -o docs/api/${jsfile}${md} --document-exported --github  --project-name seisplotjs.${jsfile} src/${jsfile}.ts
      npx documentation build --parse-extension ts -f ${format} -o docs/api/${jsfile}${md} --document-exported --github  --project-name seisplotjs.${jsfile} src/${jsfile}.ts
      if [ $? -ne 0 ]
      then
        exit $?
      fi
      if [[ 'html' == "$format"  ]]
      then
        mv docs/api/${jsfile}/index.html docs/api/${jsfile}.html
      fi
      # modules links for README.md
      cat >> README_part.md <<EOF
  * [${jsfile}](https://crotwell.github.io/seisplotjs/api/${jsfile}.html) [(source)](https://github.com/crotwell/seisplotjs/blob/version3.0/src/${jsfile}.ts) ${descText}
EOF

    fi
  elif [ -d src/${jsfile} ]
  then
    #echo npx documentation build -f ${format} -o docs/api/${jsfile}${md} --document-exported --github --project-name seisplotjs.${jsfile} src/${jsfile}/[a-hj-z]*.ts
    npx documentation build -f ${format} -o docs/api/${jsfile}${md} --document-exported --github --project-name seisplotjs.${jsfile} src/${jsfile}/[a-hj-z]*.ts
  else
    echo unknown file ${f}
  fi
  if [[ 'html' == "$format" ]]
  then
    # entry of index.html
    cat >> docs/api/index.html <<EOF
      <li><a href="${jsfile}${md}.html">${jsfile}</a> ( <a href="https://github.com/crotwell/seisplotjs/blob/version3.0/src/${jsfile}.ts">source</a> ) - ${descTextHtml}</li>
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

# fix up links
python3 replaceInHtml.py

# copy assets
if [[ 'html' == "$format"  ]]
then
  rm -rf docs/api/assets
  mv docs/api/helicorder/assets docs/api/.
  cp docs/api/assets/bass.css docs/.
  cp docs/api/assets/split.css docs/.
  for f in src/*
  do
    jsfile=`basename ${f} .ts`
    if [ -d docs/api/${jsfile} ]
    then
      rm -r docs/api/${jsfile}
    fi
  done
fi
