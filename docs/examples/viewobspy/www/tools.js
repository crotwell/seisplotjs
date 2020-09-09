/*global seisplotjs */


function createTools(viewObspy) {

  seisplotjs.d3.select("button#refresh").on("click", function() {
    viewObspy.clearAll();
    viewObspy.loadAllAndPlot();
  });
  seisplotjs.d3.select("button#reprocess").on("click", function() {
    viewObspy.reprocess();
  });
  seisplotjs.d3.select("input#linkx").on("change", function() {
    viewObspy.replot();
  });
  seisplotjs.d3.select("input#linky").on("change", function() {
    viewObspy.replot();
  });

  seisplotjs.d3.select("input#doGain").on("change", function() {
    viewObspy.replot();
  });

  seisplotjs.d3.select("input#orientz").on("change", () => viewObspy.replot());
  seisplotjs.d3.select("input#orienty").on("change", () => viewObspy.replot());
  seisplotjs.d3.select("input#orientx").on("change", () => viewObspy.replot());
  seisplotjs.d3.select("input#orientr").on("change", () => viewObspy.replot());
  seisplotjs.d3.select("input#orientt").on("change", () => viewObspy.replot());

  seisplotjs.d3.select("input#radio_organize_individual").on("change", () => {
    viewObspy.organizetype = "individual";
    viewObspy.replot();
  });
  seisplotjs.d3.select("input#radio_organize_overlay_bystation").on("change", () => {
    viewObspy.organizetype = "bystation";
    viewObspy.replot();
  });
  seisplotjs.d3.select("input#radio_organize_overlay_bycomponent").on("change", () => {
    viewObspy.organizetype = "bycomponent";
    viewObspy.replot();
  });

  seisplotjs.d3.select("button#bandpass").on("click", () => {
    let lowFreq = seisplotjs.d3.select("#lowfreq").property("value");
    let highFreq = seisplotjs.d3.select("#highfreq").property("value");

    viewObspy.applyAllSeismograms(sdd => {
        let butterworth = seisplotjs.filter.createButterworth(2, seisplotjs.filter.BAND_PASS, lowFreq, highFreq, 1/sdd.seismogram.sampleRate);
        let filtSeis = seisplotjs.filter.applyFilter(butterworth, sdd.seismogram);
        return sdd.cloneWithNewSeismogram(filtSeis);
    }, `bp ${lowFreq}  ${highFreq}`);

  });

  seisplotjs.d3.select("button#lowpass").on("click", () => {
    let lowFreq = seisplotjs.d3.select("#lowfreq").property("value");
    let highFreq = seisplotjs.d3.select("#highfreq").property("value");

    viewObspy.applyAllSeismograms(sdd => {
        let butterworth = seisplotjs.filter.createButterworth(2, seisplotjs.filter.LOW_PASS, lowFreq, highFreq, 1/sdd.seismogram.sampleRate);
        let filtSeis = seisplotjs.filter.applyFilter(butterworth, sdd.seismogram);
        return sdd.cloneWithNewSeismogram(filtSeis);
    }, `lp   ${highFreq}`);

  });

  seisplotjs.d3.select("button#highpass").on("click", () => {
    let lowFreq = seisplotjs.d3.select("#lowfreq").property("value");
    let highFreq = seisplotjs.d3.select("#highfreq").property("value");
    viewObspy.applyAllSeismograms(sdd => {
        let butterworth = seisplotjs.filter.createButterworth(2, seisplotjs.filter.HIGH_PASS, lowFreq, highFreq, 1/sdd.seismogram.sampleRate);
        let filtSeis = seisplotjs.filter.applyFilter(butterworth, sdd.seismogram);
        return sdd.cloneWithNewSeismogram(filtSeis);
    }, `hp ${lowFreq} `);
  });


  seisplotjs.d3.select("button#rmean").on("click", () => {
    viewObspy.applyAllSeismograms(sdd => {
        let filtSeis = seisplotjs.filter.rMean(sdd.seismogram);
        return sdd.cloneWithNewSeismogram(filtSeis);
    }, `rmean`);
  });

  seisplotjs.d3.select("button#rtrend").on("click", () => {
    viewObspy.applyAllSeismograms(sdd => {
        let filtSeis = seisplotjs.filter.rTrend(sdd.seismogram);
        return sdd.cloneWithNewSeismogram(filtSeis);
      }, `rtrend`);
  });

  seisplotjs.d3.select("button#taper").on("click", () => {
    let width = seisplotjs.d3.select("#taperwidth").property("value");
    let type = seisplotjs.taper.HANNING;
    viewObspy.applyAllSeismograms(sdd => {
      let filtSeis = seisplotjs.taper.taper(sdd.seismogram, width, type);
      return sdd.cloneWithNewSeismogram(filtSeis);
    }, `taper ${width} ${type}`);
  });

  seisplotjs.d3.selectAll('input[name="plottype"]').on("change", function() {
    let myvalue = seisplotjs.d3.select(this).property('value');
    let plottype = seisplotjs.d3.select('input[name="plottype"]:checked').property("value");
    if (myvalue !== plottype) { return; }
    viewObspy.plottype = plottype;
    viewObspy.replot();
  });

  seisplotjs.d3.select("button#ttimeRecalc").on("click", () => {
    let plotPredicted = seisplotjs.d3.select("#phases").property("checked");
    let phaseList = seisplotjs.d3.select("#phaseList").property("value");
    if ( ! phaseList || phaseList.length === 0) {
      phaseList = "P,S";
    }
    console.log(`ttimeRecalc  ${plotPredicted}  ${phaseList}`)
    viewObspy.applyAllSeismograms((seisData, index, array, dataset, catalog, inventory) =>{
      // only do on index 0 as we want to do for all quakes/stations at once to
      // minimize trips to traveltime web service
console.log(`recalc proc func ${index}  ${array.length}`)
      if (index !== 0) { return seisData; }
      return viewObspy.addTravelTimes(array, phaseList).then(travelTimes => {
        if (plotPredicted) {
          viewObspy.replot();
        }
        return seisData;
      });
    }, "add travel times "+phaseList);
  });
}
