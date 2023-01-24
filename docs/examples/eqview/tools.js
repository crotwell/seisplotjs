import * as sp from '../../seisplotjs_3.0.0-alpha.4_standalone.mjs';


export function createTools(viewObspy) {
  sp.d3.select("div.seisConfig").selectAll("*").remove();
  sp.seismographconfigeditor.createEditor(sp.d3.select("div.seisConfig"),
                                            viewObspy.defaultSeismographConfig,
                                            () => {viewObspy.replot();});

  sp.d3.select("div.infoTemplate").select("#infoTemplateText")
    .property("value", viewObspy.infoTemplate)
    .on("change", () => {
      viewObspy.infoTemplate = sp.d3.select(`#infoTemplateText`).property("value");
      viewObspy.replot();
    });

  sp.d3.select("button#refresh").on("click", function() {
    viewObspy.clearAll();
    viewObspy.loadAllAndPlot();
  });
  sp.d3.select("button#reprocess").on("click", function() {
    viewObspy.reprocess();
  });
  sp.d3.select("button#saveZip").on("click", function() {
    viewObspy.saveToZipFile();
  });
  sp.d3.select("input#loadZip").on("change", function() {
    const input = document.querySelector('input#loadZip');
    viewObspy.loadFromZipFile(input.files);
  });
  sp.d3.select("input#linkx").on("change", function() {
    viewObspy.replot();
  });
  sp.d3.select("input#linky").on("change", function() {
    viewObspy.replot();
  });

  sp.d3.select("input#doGain").on("change", function() {
    viewObspy.replot();
  });

  sp.d3.select("input#orientz").on("change", () => viewObspy.replot());
  sp.d3.select("input#orienty").on("change", () => viewObspy.replot());
  sp.d3.select("input#orientx").on("change", () => viewObspy.replot());
  sp.d3.select("input#orientr").on("change", () => viewObspy.replot());
  sp.d3.select("input#orientt").on("change", () => viewObspy.replot());

  sp.d3.select("input#radio_organize_individual").on("change", () => {
    viewObspy.organizetype = "individual";
    viewObspy.replot();
  });
  sp.d3.select("input#radio_organize_overlay_bystation").on("change", () => {
    viewObspy.organizetype = "bystation";
    viewObspy.replot();
  });
  sp.d3.select("input#radio_organize_overlay_bycomponent").on("change", () => {
    viewObspy.organizetype = "bycomponent";
    viewObspy.replot();
  });
  sp.d3.select("input#radio_organize_overlay_all").on("change", () => {
    viewObspy.organizetype = "all";
    viewObspy.replot();
  });

  sp.d3.select("input#radio_sort_none").on("change", () => {
    viewObspy.sorttype = "none";
    viewObspy.replot();
  });
  sp.d3.select("input#radio_sort_alphabetical").on("change", () => {
    viewObspy.sorttype = "alphabetical";
    viewObspy.replot();
  });
  sp.d3.select("input#radio_sort_bydistance").on("change", () => {
    viewObspy.sorttype = "distance";
    viewObspy.replot();
  });
  sp.d3.select("input#radio_sort_bybackazimuth").on("change", () => {
    viewObspy.sorttype = "backazimuth";
    viewObspy.replot();
  });
  sp.d3.select("input#radio_sort_byazimuth").on("change", () => {
    viewObspy.sorttype = "azimuth";
    viewObspy.replot();
  });
  sp.d3.select("input#radio_sort_bystarttime").on("change", () => {
    viewObspy.sorttype = "starttime";
    viewObspy.replot();
  });
  sp.d3.select("input#radio_sort_byorigintime").on("change", () => {
    viewObspy.sorttype = "origintime";
    viewObspy.replot();
  });

  sp.d3.select("button#bandpass").on("click", () => {
    let lowFreq = sp.d3.select("#lowfreq").property("value");
    let highFreq = sp.d3.select("#highfreq").property("value");

    viewObspy.applyAllSeismograms(sdd => {
        let butterworth = sp.filter.createButterworth(2, sp.filter.BAND_PASS, lowFreq, highFreq, 1/sdd.seismogram.sampleRate);
        let filtSeis = sp.filter.applyFilter(butterworth, sdd.seismogram);
        return sdd.cloneWithNewSeismogram(filtSeis);
    }, `bp ${lowFreq}  ${highFreq}`);

  });

  sp.d3.select("button#lowpass").on("click", () => {
    let lowFreq = sp.d3.select("#lowfreq").property("value");
    let highFreq = sp.d3.select("#highfreq").property("value");

    viewObspy.applyAllSeismograms(sdd => {
        let butterworth = sp.filter.createButterworth(2, sp.filter.LOW_PASS, lowFreq, highFreq, 1/sdd.seismogram.sampleRate);
        let filtSeis = sp.filter.applyFilter(butterworth, sdd.seismogram);
        return sdd.cloneWithNewSeismogram(filtSeis);
    }, `lp   ${highFreq}`);

  });

  sp.d3.select("button#highpass").on("click", () => {
    let lowFreq = sp.d3.select("#lowfreq").property("value");
    let highFreq = sp.d3.select("#highfreq").property("value");
    viewObspy.applyAllSeismograms(sdd => {
        let butterworth = sp.filter.createButterworth(2, sp.filter.HIGH_PASS, lowFreq, highFreq, 1/sdd.seismogram.sampleRate);
        let filtSeis = sp.filter.applyFilter(butterworth, sdd.seismogram);
        return sdd.cloneWithNewSeismogram(filtSeis);
    }, `hp ${lowFreq} `);
  });


  sp.d3.select("button#rmean").on("click", () => {
    viewObspy.applyAllSeismograms(sdd => {
        let filtSeis = sp.filter.rMean(sdd.seismogram);
        return sdd.cloneWithNewSeismogram(filtSeis);
    }, `rmean`);
  });

  sp.d3.select("button#rtrend").on("click", () => {
    viewObspy.applyAllSeismograms(sdd => {
        let filtSeis = sp.filter.rTrend(sdd.seismogram);
        return sdd.cloneWithNewSeismogram(filtSeis);
      }, `rtrend`);
  });

  sp.d3.select("button#taper").on("click", () => {
    let width = sp.d3.select("#taperwidth").property("value");
    let type = sp.taper.HANNING;
    viewObspy.applyAllSeismograms(sdd => {
      let filtSeis = sp.taper.taper(sdd.seismogram, width, type);
      return sdd.cloneWithNewSeismogram(filtSeis);
    }, `taper ${width} ${type}`);
  });

  sp.d3.selectAll('input[name="plottype"]').on("change", function() {
    let myvalue = sp.d3.select(this).property('value');
    let plottype = sp.d3.select('input[name="plottype"]:checked').property("value");
    if (myvalue !== plottype) { return; }
    viewObspy.plottype = plottype;
    viewObspy.replot();
  });

  sp.d3.select("button#ttimeRecalc").on("click", () => {
    let phaseList = sp.d3.select("#phaseList").property("value");
    if ( ! phaseList || phaseList.length === 0) {
      phaseList = "P,S";
    }
    viewObspy.applyAllSeismograms((seisData, index, array, dataset, catalog, inventory) =>{
      // only do on index 0 as we want to do for all quakes/stations at once to
      // minimize trips to traveltime web service
      if (index !== 0) { return Promise.resolve(seisData); }
      return viewObspy.addTravelTimes(array, phaseList).then(ttarray => {return seisData;});
    }, "add travel times "+phaseList);
  });
}
