
function createTools(viewObspy) {

  seisplotjs.d3.select("button#refresh").on("click", function(d) {
    viewObspy.clearAll();
    viewObspy.loadAllAndPlot(baseUrl);
  });
  seisplotjs.d3.select("button#reprocess").on("click", function(d) {
    viewObspy.processedData.clear();
    viewObspy.applyProcessChain();
  });
  seisplotjs.d3.select("input#linkx").on("change", function() {
    viewObspy.linkAllTimeAxis();
  });
  seisplotjs.d3.select("input#linky").on("change", function() {
    viewObspy.linkAllAmpAxis();
  });

  function doOrientPlot() {
      let dataset = viewObspy.obspyData.get('dataset');
      const plottype = seisplotjs.d3.select('input[name="plottype"]:checked').property("value");
      viewObspy.plotDataset(dataset, plottype, viewObspy.seisChanQuakeFilter);
  }
  seisplotjs.d3.select("input#orientz").on("change", () => doOrientPlot());
  seisplotjs.d3.select("input#orienty").on("change", () => doOrientPlot());
  seisplotjs.d3.select("input#orientx").on("change", () => doOrientPlot());

  seisplotjs.d3.select("button#bandpass").on("click", d => {
    let lowFreq = seisplotjs.d3.select("#lowfreq").property("value");
    let highFreq = seisplotjs.d3.select("#highfreq").property("value");
    console.log(`${lowFreq}  ${highFreq}`);

    viewObspy.applyAllSeismograms(seis => {
        let butterworth = seisplotjs.filter.createButterworth(2, seisplotjs.filter.BAND_PASS, lowFreq, highFreq, 1/seis.sampleRate);
        return seisplotjs.filter.applyFilter(butterworth, seis);
    }, `bp ${lowFreq}  ${highFreq}`);

  });


  seisplotjs.d3.select("button#lowpass").on("click", d => {
    let lowFreq = seisplotjs.d3.select("#lowfreq").property("value");
    let highFreq = seisplotjs.d3.select("#highfreq").property("value");
    console.log(`${lowFreq}  ${highFreq}`);

    viewObspy.applyAllSeismograms(seis => {
        let butterworth = seisplotjs.filter.createButterworth(2, seisplotjs.filter.LOW_PASS, lowFreq, highFreq, 1/seis.sampleRate);
        return seisplotjs.filter.applyFilter(butterworth, seis);
    }, `lp   ${highFreq}`);

  });

  seisplotjs.d3.select("button#highpass").on("click", d => {
    let lowFreq = seisplotjs.d3.select("#lowfreq").property("value");
    let highFreq = seisplotjs.d3.select("#highfreq").property("value");
    console.log(`${lowFreq}  ${highFreq}`);
    viewObspy.applyAllSeismograms(seis => {
        let butterworth = seisplotjs.filter.createButterworth(2, seisplotjs.filter.HIGH_PASS, lowFreq, highFreq, 1/seis.sampleRate);
        return seisplotjs.filter.applyFilter(butterworth, seis);
    }, `hp ${lowFreq} `);
  });


  seisplotjs.d3.select("button#rmean").on("click", d => {
    console.log("rmean button pushed")
    viewObspy.applyAllSeismograms(seis => {
      console.log("rmean")
        return seisplotjs.filter.rMean(seis);
    }, `rmean`);
  });

  seisplotjs.d3.select("button#rtrend").on("click", d => {
    viewObspy.applyAllSeismograms(seis => {
      console.log("rtrend")
        return seisplotjs.filter.rTrend(seis);
      }, `rtrend`);
  });

  seisplotjs.d3.select("button#taper").on("click", d => {
    let width = seisplotjs.d3.select("#taperwidth").property("value");
    let type = seisplotjs.taper.HANNING;
    console.log(`${width}  ${type}`);
    viewObspy.applyAllSeismograms(seis => {
      console.log("taper")
      return seisplotjs.taper.taper(seis, width, type);
    }, `taper ${width} ${type}`);
  });

  seisplotjs.d3.selectAll('input[name="plottype"]').on("change", function() {
    let myvalue = seisplotjs.d3.select(this).property('value');
    let plottype = seisplotjs.d3.select('input[name="plottype"]:checked').property("value");
    if (myvalue !== plottype) { console.log(`not my job: ${myvalue} !== ${plottype}`);return; }
    console.log(`yep my job: ${myvalue} === ${plottype}`);
    viewObspy.checkProcessedDatasetLoaded();
    let dataset = viewObspy.processedData.get('dataset');
    if (plottype === 'seismograph') {
      viewObspy.plotDataset(dataset, plottype, viewObspy.seisChanQuakeFilter);
    } else if (plottype === 'particlemotion') {
      viewObspy.plotDataset(dataset, plottype, viewObspy.seisChanQuakeFilter);
    } else if (plottype === 'spectra') {
      viewObspy.plotDataset(dataset, plottype, viewObspy.seisChanQuakeFilter);
    }
  });
}
