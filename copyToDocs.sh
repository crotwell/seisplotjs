#!/bin/bash

# exit on first fail exit code
set -e

npm_package_version="3.0.0-alpha.1"

if [ ! -e docs ]; then
  mkdir docs
fi

rm -f docs/seisplotjs_*_standalone.mjs 
cp dist/seisplotjs_${npm_package_version}_standalone.mjs docs/.

cd docs

for path in gallery tutorial
do
  echo $path
  if [ -d $path ]; then
    cd $path
    rm -f seisplotjs_*_standalone.mjs
    ln -s ../seisplotjs_${npm_package_version}_standalone.mjs
    cd ..
  fi
done

cd examples
for path in *
do
  echo $path
  f=${path##*/}
  echo $f
  if [ -d $f ]; then
    cd $f
    rm -f seisplotjs_*_standalone.mjs
    ln -s ../../seisplotjs_${npm_package_version}_standalone.mjs
    cd ..
  fi
done

cd viewobspy/www
rm -f seisplotjs_*_standalone.mjs
ln -s ../../../seisplotjs_${npm_package_version}_standalone.mjs
cd ../..
