
seisplotjs.d3.select("button#refresh").on("click", function(d) {
  clearAll();
  loadAllAndPlot(baseUrl);
});
seisplotjs.d3.select("button#reprocess").on("click", function(d) {
  obspyDataset.clear();
  applyProcessChain();
});
seisplotjs.d3.select("input#linkx").on("change", function() {
  linkAllTimeAxis();
});
seisplotjs.d3.select("input#linky").on("change", function() {
  linkAllAmpAxis();
});

seisplotjs.d3.select("button#bandpass").on("click", d => {
  let lowFreq = seisplotjs.d3.select("#lowfreq").property("value");
  let highFreq = seisplotjs.d3.select("#highfreq").property("value");
  console.log(`${lowFreq}  ${highFreq}`);

  applyAllSeismograms(seis => {
      let butterworth = seisplotjs.filter.createButterworth(2, seisplotjs.filter.BAND_PASS, lowFreq, highFreq, 1/seis.sampleRate);
      return seisplotjs.filter.applyFilter(butterworth, seis);
  }, `bp ${lowFreq}  ${highFreq}`);

});


seisplotjs.d3.select("button#lowpass").on("click", d => {
  let lowFreq = seisplotjs.d3.select("#lowfreq").property("value");
  let highFreq = seisplotjs.d3.select("#highfreq").property("value");
  console.log(`${lowFreq}  ${highFreq}`);

  applyAllSeismograms(seis => {
      let butterworth = seisplotjs.filter.createButterworth(2, seisplotjs.filter.LOW_PASS, lowFreq, highFreq, 1/seis.sampleRate);
      return seisplotjs.filter.applyFilter(butterworth, seis);
  }, `lp   ${highFreq}`);

});

seisplotjs.d3.select("button#highpass").on("click", d => {
  let lowFreq = seisplotjs.d3.select("#lowfreq").property("value");
  let highFreq = seisplotjs.d3.select("#highfreq").property("value");
  console.log(`${lowFreq}  ${highFreq}`);
  applyAllSeismograms(seis => {
      let butterworth = seisplotjs.filter.createButterworth(2, seisplotjs.filter.HIGH_PASS, lowFreq, highFreq, 1/seis.sampleRate);
      return seisplotjs.filter.applyFilter(butterworth, seis);
  }, `hp ${lowFreq} `);
});


seisplotjs.d3.select("button#rmean").on("click", d => {
  console.log("rmean button pushed")
  applyAllSeismograms(seis => {
    console.log("rmean")
      return seisplotjs.filter.rMean(seis);
  }, `rmean`);
});

seisplotjs.d3.select("button#rtrend").on("click", d => {
  applyAllSeismograms(seis => {
    console.log("rtrend")
      return seisplotjs.filter.rTrend(seis);
    }, `rtrend`);
});

seisplotjs.d3.select("button#taper").on("click", d => {
  let width = seisplotjs.d3.select("#taperwidth").property("value");
  let type = seisplotjs.taper.HANNING;
  console.log(`${width}  ${type}`);
  applyAllSeismograms(seis => {
    console.log("taper")
    return seisplotjs.taper.taper(seis, width, type);
  }, `taper ${width} ${type}`);
});
