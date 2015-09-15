
rm -r dist
mkdir dist
cat src/miniseed.js src/seedcodec.js src/waveformplot.js src/seisplot.js | babel --out-file dist/seisplot.js
cp package.json dist/.
