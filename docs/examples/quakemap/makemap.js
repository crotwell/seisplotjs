import * as sp from "../../seisplotjs_3.2.0-SNAPSHOT_standalone.mjs";

const WORLD_OCEAN =
  "https://services.arcgisonline.com/arcgis/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}";
const WORLD_OCEAN_ATTR = 'Tiles &copy; Esri &mdash; National Geographic, Esri, DeLorme, NAVTEQ, UNEP-WCMC, USGS, NASA, ESA, METI, NRCAN, GEBCO, NOAA, iPC'
const center = [0, -160];
const zoom = 1;
const quakeScale = 5;
const quakeExtraCssClass = [];
const stationExtraCssClass = [];

/*
Leaflet needs its own CSS and station marker uses a textual triangle
created via CSS. Seisplotjs provides a helper to insert this css
into the <head> element, but you can add it manually instead.
 */
sp.cssutil.insertCSS(sp.leafletutil.leaflet_css);
sp.cssutil.insertCSS(sp.leafletutil.stationMarker_css);

/*
Basic leaflet map creation.
 */
const mapDiv = document.querySelector("div#mymap");
const backgroundLayer = L.tileLayer(WORLD_OCEAN, {
  maxZoom: 11,
  attribution: WORLD_OCEAN_ATTR
});
const map = L.map(mapDiv, {
  center: center,
  zoom: zoom,
  layers: [backgroundLayer]
});
mapDiv.addEventListener("quakeclick", evt => {
  const infoDiv = document.querySelector("#quakeinfo");
  const quake = evt.detail.quake;
  infoDiv.innerHTML = `
  <h3>Quake: ${quake.description}</h3>
  <ul>
    <li>Time: ${quake.time}</li>
    <li>Mag: ${quake.magnitude}</li>
    <li>Location: ${quake.latitude}/${quake.longitude}</li>
    <li>Depth: ${quake.depthKm} km</li>
    <li>EventId: ${quake.eventId}</li>
  </ul>
  `;
});

mapDiv.addEventListener("stationclick", evt => {
  const infoDiv = document.querySelector("#stationinfo");
  const station = evt.detail.station;
  infoDiv.innerHTML = `
  <h3>Station: ${station.codes()} ${station.name}</h3>
  <ul>
    <li>Location: ${station.latitude}/${station.longitude}</li>
    <li>Description: ${station.description}</li>
  </ul>
  `;
});

function fixPolygonForCenter(centerLon, polygon) {
  const outPolygon = [];
  for (const linring of polygon) {
    let newLinRing = [];
    const point = linring[0];
    // geojson is lon,lat, but center is lat,lon
    if (Math.abs(point[0]-centerLon) > 180) {
      // check for polygons that are more than 180 away from center.
      // The tectonic regions are -180 to 180, but we are plotting near
      // the date line, so some regions will be off the map, but we
      // can just shift them back
      let shift = 0;
      if (point[0] > centerLon) {
        shift=-360;
      } else {
        shift = 360;
      }

      for (const point of linring) {
        newLinRing.push([point[0]+shift, point[1]]);
      }
    } else {
      // no change
      newLinRing=linring;
    }
    outPolygon.push(newLinRing);
  }
  return outPolygon;
}

sp.usgsgeojson.loadUSGSTectonicLayer().then(tectonicGeoJson => {
  const tectonicLayer = L.geoJSON().addTo(map);
  for (const tectFeature of tectonicGeoJson.tectonic.features) {
    if (tectFeature.geometry.type === "Polygon") {
      tectFeature.geometry.coordinates = fixPolygonForCenter(center[1], tectFeature.geometry.coordinates);
    } else if (tectFeature.geometry.type === "MultiPolygon") {
      for(let i=0; i<tectFeature.geometry.coordinates.length; i++) {
        tectFeature.geometry.coordinates[i] = fixPolygonForCenter(center[1], tectFeature.geometry.coordinates[i]);
      }
    }
    const titem = L.geoJSON(tectFeature);
    titem.addTo(map);
    titem.addEventListener("click", evt => {
      const infoDiv = document.querySelector("#tectonicinfo");
      infoDiv.innerHTML = `
        <h3>Tectonic Region: ${tectFeature.properties.name}</h3>
        <div>${tectFeature.properties.summary}</div>
      `;
      console.log(`tectonic click: ${tectFeature.properties.name}`);
    })
  }

});

/*
Here we load some earthquakes, the "significant" ones as defined by the USGS,
and plot markers for each on the map. We pass in the center longitude so
the location can be adjusted +-360 degrees in case the date line is on the map.
For example a 30 degree map centered on 170 would go from 140 to 200 degrees,
and quakes ploting at -175 longitude would not appear unless we adjust them
to -175+360=185 degrees longitude.
 */
sp.usgsgeojson.loadMonthSignificant().then(quakeList => {
  const quakeMarkers = [];
  quakeList.forEach(q => {
    const marker = sp.leafletutil.createQuakeMarker(q, quakeScale, quakeExtraCssClass, center[1]);
    quakeMarkers.push(marker);
    marker.addEventListener("click", (evt) => {
      const ce = sp.quakeml.createQuakeClickEvent(q, evt.originalEvent);
      mapDiv.dispatchEvent(ce);
    });
  });
  const quakeLayer = L.layerGroup(quakeMarkers);
  map.addLayer(quakeLayer);
  return Promise.all([quakeList, quakeLayer]);
});

const queryTimeWindow = sp.util.durationEnd('P1M', "now");
let stationQuery = new sp.fdsnstation.StationQuery()
.networkCode("IU,II")
.channelCode("LH?")
.timeRange(queryTimeWindow);
stationQuery.queryStations().then(netList => {
  const stationMarkers = [];
  for( const sta of sp.stationxml.allStations(netList)) {
    const marker = sp.leafletutil.createStationMarker(sta, [], true, center[1]);
    stationMarkers.push(marker);
    marker.addEventListener("click", (evt) => {
      const ce = sp.stationxml.createStationClickEvent(sta, evt.originalEvent);
      mapDiv.dispatchEvent(ce);
    });
  }

  const stationLayer = L.layerGroup(stationMarkers);
  map.addLayer(stationLayer);
});
