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
    if [ -e mod_desc/${jsfile}.desc ]
    then
      echo "mod_desc/${jsfile}.desc exists"
      descText=`cat mod_desc/${jsfile}.desc`
      descArg='--project-description'
    else
        echo "mod_desc/${jsfile}.desc does not exists"
    fi
    echo npx documentation build -f ${format} -o docs/api/${jsfile}${md} --document-exported --github  --project-name seisplotjs.${jsfile} ${descArg} \'${descText}\' src/${jsfile}.js
    npx documentation build -f ${format} -o docs/api/${jsfile}${md} --document-exported --github --project-name seisplotjs.${jsfile}  ${descArg} \'${descText}\' src/${jsfile}.js
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
