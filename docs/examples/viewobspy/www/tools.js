/*global seisplotjs */


function createTools(viewObspy) {

  seisplotjs.d3.select("button#refresh").on("click", function() {
    viewObspy.clearAll();
    viewObspy.loadAllAndPlot();
  });
  seisplotjs.d3.select("button#reprocess").on("click", function() {
    viewObspy.processedData.clear();
    viewObspy.applyProcessChain();
  });
  seisplotjs.d3.select("input#linkx").on("change", function() {
    viewObspy.linkAllTimeAxis();
  });
  seisplotjs.d3.select("input#linky").on("change", function() {
    viewObspy.linkAllAmpAxis();
  });

  seisplotjs.d3.select("input#doGain").on("change", function() {
    viewObspy.doGain();
  });

  function doOrientPlot() {
      let dataset = viewObspy.obspyData.get('dataset');
      const plottype = seisplotjs.d3.select('input[name="plottype"]:checked').property("value");
      viewObspy.plotDataset(dataset, plottype, viewObspy.seisChanQuakeFilter);
  }
  seisplotjs.d3.select("input#orientz").on("change", () => doOrientPlot());
  seisplotjs.d3.select("input#orienty").on("change", () => doOrientPlot());
  seisplotjs.d3.select("input#orientx").on("change", () => doOrientPlot());

  seisplotjs.d3.select("button#bandpass").on("click", () => {
    let lowFreq = seisplotjs.d3.select("#lowfreq").property("value");
    let highFreq = seisplotjs.d3.select("#highfreq").property("value");

    viewObspy.applyAllSeismograms(seis => {
        let butterworth = seisplotjs.filter.createButterworth(2, seisplotjs.filter.BAND_PASS, lowFreq, highFreq, 1/seis.sampleRate);
        return seisplotjs.filter.applyFilter(butterworth, seis);
    }, `bp ${lowFreq}  ${highFreq}`);

  });


  seisplotjs.d3.select("button#lowpass").on("click", () => {
    let lowFreq = seisplotjs.d3.select("#lowfreq").property("value");
    let highFreq = seisplotjs.d3.select("#highfreq").property("value");

    viewObspy.applyAllSeismograms(seis => {
        let butterworth = seisplotjs.filter.createButterworth(2, seisplotjs.filter.LOW_PASS, lowFreq, highFreq, 1/seis.sampleRate);
        return seisplotjs.filter.applyFilter(butterworth, seis);
    }, `lp   ${highFreq}`);

  });

  seisplotjs.d3.select("button#highpass").on("click", () => {
    let lowFreq = seisplotjs.d3.select("#lowfreq").property("value");
    let highFreq = seisplotjs.d3.select("#highfreq").property("value");
    viewObspy.applyAllSeismograms(seis => {
        let butterworth = seisplotjs.filter.createButterworth(2, seisplotjs.filter.HIGH_PASS, lowFreq, highFreq, 1/seis.sampleRate);
        return seisplotjs.filter.applyFilter(butterworth, seis);
    }, `hp ${lowFreq} `);
  });


  seisplotjs.d3.select("button#rmean").on("click", () => {
    viewObspy.applyAllSeismograms(seis => {
        return seisplotjs.filter.rMean(seis);
    }, `rmean`);
  });

  seisplotjs.d3.select("button#rtrend").on("click", () => {
    viewObspy.applyAllSeismograms(seis => {
        return seisplotjs.filter.rTrend(seis);
      }, `rtrend`);
  });

  seisplotjs.d3.select("button#taper").on("click", () => {
    let width = seisplotjs.d3.select("#taperwidth").property("value");
    let type = seisplotjs.taper.HANNING;
    viewObspy.applyAllSeismograms(seis => {
      return seisplotjs.taper.taper(seis, width, type);
    }, `taper ${width} ${type}`);
  });

  seisplotjs.d3.selectAll('input[name="plottype"]').on("change", function() {
    let myvalue = seisplotjs.d3.select(this).property('value');
    let plottype = seisplotjs.d3.select('input[name="plottype"]:checked').property("value");
    if (myvalue !== plottype) { return; }
    viewObspy.plotDiv.selectAll("*").remove();
    viewObspy.processedData.forEach((value, key) => {
      if (key.startsWith('graph')) {
        viewObspy.processedData.delete(key);
      }
    });
    viewObspy.checkProcessedDatasetLoaded();
    let dataset = viewObspy.processedData.get('dataset');
    viewObspy.plotDataset(dataset, plottype, viewObspy.seisChanQuakeFilter);
  });
}
