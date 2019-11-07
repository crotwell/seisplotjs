
const loadDataset = function() {
  return seisplotjs.util.doFetchWithTimeout('/dataset').then(response => {
    console.log("response to fetch: ");
    return response.json();
  }).then(dataset => {
      console.log(`dataset: ${JSON.stringify(dataset, null, 2)}`)
      seisplotjs.d3.select("#myseismograph").selectAll("div").remove();
      seisplotjs.d3.select("#title").text(dataset.data.attributes.title);
      seisplotjs.d3.select("#myseismograph").selectAll("div")
        .data(dataset.data.relationships.seismograms.data)
        .enter().append("div")
        .attr("seisid", d => d.id).append("p").text(d => d.type+" "+d.id+" ");
      let urlList = dataset.data.relationships.seismograms.data.map(d => {
        return `/seismograms/${d.id}`;
      });
      let allSeis = seisplotjs.mseedarchive.loadDataRecords(urlList)
          .then(dataRecords => {
            let seisArray = seisplotjs.miniseed.seismogramPerChannel(dataRecords);
            return seisArray;
          });
      let quake = null;
      if (dataset.data.relationships.quake) {
        const qid = dataset.data.relationships.quake.data.id;
        console.log(`quake: ${dataset.data.relationships.quake.data.id}`);
        quake = seisplotjs.util.doFetchWithTimeout(`/quake/${qid}`).then(response => {
          console.log("response to fetch: ");
          return response.text();
        }).then(xml => {
          return (new window.DOMParser()).parseFromString(xml, "text/xml");
        }).then(quakeml => {
          return seisplotjs.quakeml.parseQuakeML(quakeml);
        });
      }
      return Promise.all([dataset, allSeis, quake]);
    }).then( ( [ dataset, allSeis, quake ] ) => {
      console.log(`plot ${allSeis.length} seismograms`);
      allSeis.forEach((seismogram, myid) => {
        let div = seisplotjs.d3.select('div#myseismograph').select(`div[seisid="${myid}"]`);
        div.selectAll('*').remove();
        let seisConfig = new seisplotjs.seismographconfig.SeismographConfig();
        seisConfig.title = seismogram.codes();
        let seisData = seisplotjs.seismogram.SeismogramDisplayData.fromSeismogram(seismogram);
        seisData.addQuake( quake);
        let graph = new seisplotjs.seismograph.Seismograph(div, seisConfig, seisData);
        graph.draw();
      });
      return Promise.all([dataset, allSeis, quake])
    }).catch( function(error) {
      seisplotjs.d3.select("div#myseismograph").append('p').html("Error loading data." +error);
      console.assert(false, error);
    });
}
