
let processedDataset = new Map();

let processChain = [];

function checkProcessedDatasetLoaded() {
  if (! processedDataset.has('dataset')) {
    processedDataset.set('dataset', obspyDataset.get('dataset'));
  }
}

function clearProcessedData() {
  processedDataset.clear();
}

function getSeismogram(id) {
  const key = `/seismograms/${id}`;
  if ( ! processedDataset.has(key)) {
    return loadSingleSeismogram(id).then(seis => {
      let clonedSeis = seis.clone();
      processedDataset.set(key, clonedSeis);
      return clonedSeis;
    })
  }
  return Promise.resolve(processedDataset.get(key));
}

function applyAllSeismograms(processFunc, desc) {
  console.log(`applyAllSeismograms: ${desc}`)
  processChain.push({desc: desc, processFunc: processFunc});
  updateProcessDisplay(processChain);
  checkProcessedDatasetLoaded();
  let dataset = processedDataset.get('dataset');
  return Promise.all(dataset.data.relationships.seismograms.data.map(d => {
    const key = `/seismograms/${d.id}`;
    return getSeismogram(d.id).then(seis => processFunc(seis))
      .then(seis => {
        processedDataset.set(key, seis);
        let graph = obspyDataset.get(`/seismograph/${d.id}`)

        graph.seisDataList.forEach(sdd => console.log(`look for ${sdd.id} === ${d.id}`));
        let sdd = graph.seisDataList.find(sdd => sdd.id === d.id);
        sdd.seismogram = seis;
        graph.redoDisplayYScale();
        graph.draw()
      });
  }));
}

function updateProcessDisplay(processChain) {
  let pc = seisplotjs.d3.select("div#processChain ul").selectAll("li")
    .data(processChain);
  pc
    .enter()
    .append('li').text(d => d.desc);
  pc.exit().remove();
}

seisplotjs.d3.select("button#refresh").on("click", function(d) {
  processedDataset.clear();
  processChain.length = 0;//clears the array
  updateProcessDisplay(processChain);
  loadDataset(baseUrl);
});
seisplotjs.d3.select("button#reprocess").on("click", function(d) {
  obspyDataset.clear();
  processedDataset.clear();
  let tmpProcessChain = Array.from(processChain);
  processChain.length = 0;//clears the array
  updateProcessDisplay(processChain);
  loadDataset(baseUrl).then( () => {
    tmpProcessChain.forEach(p => applyAllSeismograms(p.processFunc, p.desc));
  });
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
