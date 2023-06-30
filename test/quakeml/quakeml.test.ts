// @flow

import fs from 'fs';

import * as quakeml from '../../src/quakeml.js';
import {isoToDateTime} from '../../src/util';

test("time getset", () => {
  const t = isoToDateTime("2019-10-31T01:20:58.661000Z");
  const wid = new quakeml.WaveformID("XX","FAKE");
  const p = new quakeml.Pick(t, wid)
  expect(p.time).toBe(t);
  expect(p.timeQuantity.value).toBe(t);
  const othert = isoToDateTime("2019-10-31T02:22:22.222000Z");
  p.time = othert;
  expect(p.time).toBe(othert);
  expect(p.timeQuantity.value).toBe(othert);
  const lat = 34.1;
  const lon = -80;
  const depth = 5.2;
  const o = new quakeml.Origin(t, lat, lon);
  expect(o.time).toBe(t);
  expect(o.timeQuantity.value).toBe(t);
  expect(o.latitude).toBe(lat);
  expect(o.latitudeQuantity.value).toBe(lat);
  expect(o.longitude).toBe(lon);
  expect(o.longitudeQuantity.value).toBe(lon);
  // depth unset
  expect(o.depth).toBeNaN();
  expect(o.depthQuantity).not.toBeDefined();
  // now depth is set
  o.depth = depth;
  expect(o.depth).toBe(depth);
  expect(o.depthQuantity?.value).toBe(depth);
  const mag = 3.2;
  const m = new quakeml.Magnitude(mag);
  expect(m.mag).toBe(mag);
  expect(m.magQuantity.value).toBe(mag);

});

test("viewobspy quake", () => {

  const filename = "./test/quakeml/data/obspy_catalog.xml";
  const rawData = fs.readFileSync(filename, 'utf8');
  const xml = new DOMParser().parseFromString(rawData, "text/xml");
  const quakes = quakeml.parseQuakeML(xml).eventList;
  expect(quakes).toHaveLength(2);
  expect(quakes[0].time).toEqual(isoToDateTime(("2019-10-31T01:20:58.661000Z")));
});

test("USGS quake", () => {

  const filename = "./test/quakeml/data/usgs.xml";
  const rawData = fs.readFileSync(filename, 'utf8');
  const xml = new DOMParser().parseFromString(rawData, "text/xml");
  const qml = quakeml.parseQuakeML(xml);
  expect(qml).toMatchObject({
    publicId: "quakeml:us.anss.org/eventparameters/6000kawn/1683735567",
    comments: [
      { text: "HYDRA - us" },
    ],
    creationInfo: {
      agencyID: 'us',
      agencyURI: "smi:anss.org/metadata/agencyid/us",
      creationTime: isoToDateTime("2023-05-10T16:19:23.040000Z"),
    },
  });
  const quakes = qml.eventList;
  expect(quakes).toHaveLength(1);
  expect(quakes[0].description).toMatchObject([
    {
      text: "Tonga",
      type: "Flinn-Engdahl region",
    },
    {
      text: "84.6 km (52.6 miles) WNW of Hihifo, Niuas, Tonga (pop. 815)\n" +
"356.0 km (221.2 miles) WSW of Apia, Tuamasaga, Samoa (pop. 40407)\n" +
"436.1 km (271.0 miles) WSW of Pago Pago, Eastern District, American Samoa (pop. 11500)\n" +
"614.0 km (381.5 miles) N of Nuku`alofa, Tongatapu, Tonga (pop. 22400)\n" +
"661.5 km (411.0 miles) E of Labasa, Northern, Fiji (pop. 27949)\n",
      type: "nearest cities",
    },
  ]);
  expect(quakes[0].preferredOrigin?.publicId).toBe("quakeml:us.anss.org/origin/6000kawn");
  expect(quakes[0].preferredMagnitude?.publicId).toBe("quakeml:us.anss.org/magnitude/6000kawn/mww");
  expect(quakes[0].type).toBe("earthquake");
  expect(quakes[0].publicId).toEqual("quakeml:us.anss.org/event/6000kawn");
  expect(quakes[0].creationInfo).toMatchObject({
    agencyID: 'us',
    agencyURI: "smi:anss.org/metadata/agencyid/us",
    creationTime: isoToDateTime("2023-05-10T16:19:08.000000Z"),
  });
  expect(quakes[0].amplitudeList).toHaveLength(587);
  expect(quakes[0].amplitudeList[0]).toMatchObject({
    genericAmplitude: {
      value: 1.77555e-06,
    },
    type: 'AMB',
    unit: 'm',
    period: {
      value: 1.7,
    },
    timeWindow: {
      begin: 0,
      end: 191.37,
      reference: isoToDateTime("2023-05-10T16:13:01.660Z"),
    },
    waveformID: {
      networkCode: "AE",
      stationCode: "113A",
      locationCode: "--",
      channelCode: "HHZ",
    },
    scalingTime: {
      value: isoToDateTime("2023-05-10T16:13:27.160Z")
    },
    magnitudeHint: "mb",
    evaluationMode: "automatic",
    publicId: "quakeml:us.anss.org/amp/ae_113a_hhz_--/mb",
  });
  expect(quakes[0].stationMagnitudeList).toHaveLength(587);
  expect(quakes[0].stationMagnitudeList[0]).toMatchObject({
    origin: {
      publicId: "quakeml:us.anss.org/origin/6000kawn",
    },
    mag: {
     value: 6.52,
    },
    type: 'mb',
    amplitude: {
      publicId: "quakeml:us.anss.org/amp/ae_113a_hhz_--/mb",
    },
    publicId: "quakeml:us.anss.org/stationmagnitude/ae_113a_hhz_--/mb",
  });
  expect(quakes[0].magnitudeList).toHaveLength(2);
  expect(quakes[0].magnitudeList[0]).toMatchObject({
    magQuantity: {
      value: 7.6,
      uncertainty: 0.055,
      confidenceLevel: 90,
    },
    type: 'Mww',
    origin: {
      publicId: "quakeml:us.anss.org/origin/6000kawn/mww_trigger",
    },
    stationCount: 32,
    evaluationMode: "manual",
    evaluationStatus: "preliminary",
    creationInfo: {
      agencyID: 'us',
      agencyURI: "smi:anss.org/metadata/agencyid/us",
      creationTime: isoToDateTime("2023-05-10T16:14:55.000000Z"),
    },
    publicId: "quakeml:us.anss.org/magnitude/6000kawn/mww",
  });
  expect(quakes[0].magnitudeList[1].stationMagnitudeContributions).toHaveLength(587);
  expect(quakes[0].magnitudeList[1].stationMagnitudeContributions[0]).toMatchObject({
    stationMagnitude: {
      publicId: "quakeml:us.anss.org/stationmagnitude/ae_113a_hhz_--/mb",
    },
    weight: 1,
  });
  expect(quakes[0].hasOrigin()).toBeTrue();
  expect(quakes[0].origin).toMatchObject({
    originUncertainty: {
      horizontalUncertainty: 7680,
      minHorizontalUncertainty: 9657,
      maxHorizontalUncertainty: 10382,
      azimuthMaxHorizontalUncertainty: 184,
      confidenceEllipsoid: {
        semiMajorAxisLength: 12174,
        semiMinorAxisLength: 223,
        semiIntermediateAxisLength: 11268,
        majorAxisPlunge: 6,
        majorAxisAzimuth: 184,
        majorAxisRotation: 87,
      },
      preferredDescription: 'confidence ellipsoid',
      confidenceLevel: 90,
    },
    timeQuantity: {
      value: isoToDateTime("2023-05-10T16:02:00.451Z"),
      uncertainty: 1.65,
      confidenceLevel: 90,
    },
    latitudeQuantity: {
      value: -15.6002,
      uncertainty: .0715,
      confidenceLevel: 90,
    },
    longitudeQuantity: {
      value: -174.6077,
      uncertainty: .0692,
      confidenceLevel: 90,
    },
    depthQuantity: {
      value: 210097,
      uncertainty: 986,
      confidenceLevel: 90,
    },
    depthType: "from location",
    methodID: "smi:us.anss.org/metadata/methodid/origin/Java_Locator/",
    earthModelID: "smi:us.anss.org/metadata/methodid/earthModel/ak135/1.0",
    quality: {
      associatedPhaseCount: 908,
      usedPhaseCount: 111,
      associatedStationCount: 908,
      usedStationCount: 111,
      standardError: 0.81,
      azimuthalGap: 17,
      secondaryAzimuthalGap: 31,
      minimumDistance: 3.631,
    },
    type: "hypocenter",
    evaluationMode: "manual",
    evaluationStatus: "preliminary",
    publicId: "quakeml:us.anss.org/origin/6000kawn",
  });
  expect(quakes[0].origin.arrivalList).toHaveLength(117);
  expect(quakes[0].origin.arrivalList[0]).toMatchObject({
    phase: "Pn",
    azimuth: 290.266,
    distance: 3.63079,
    takeoffAngle: {
      value: 69,
    },
    timeResidual: 2.15,
    timeWeight: 0.87,
    creationInfo: {
      agencyID: 'us',
      agencyURI: "smi:anss.org/metadata/agencyid/us",
      author: "manual",
      creationTime: isoToDateTime("2023-05-10T16:08:11.000000Z"),
    },
    publicId: "quakeml:us.anss.org/arrival/6000kawn/us_a7814_bpid-6003473869",
  });
  expect(quakes[0].picks).toHaveLength(117);
  expect(quakes[0].picks[0]).toMatchObject({
    timeQuantity: {
      value: isoToDateTime("2023-05-10T16:03:00.280000Z"),
    },
    networkCode: "G",
    stationCode: "FUTU",
    locationCode: "00",
    channelCode: "BHZ",
    evaluationMode: "manual",
    creationInfo: {
      agencyID: 'us',
      agencyURI: "smi:anss.org/metadata/agencyid/us",
      creationTime: isoToDateTime("2023-05-10T16:08:11.000000Z"),
    },
    publicId: "quakeml:us.anss.org/pick/6000kawn/us_a7814_bpid-6003473869",
  });
  expect(quakes[0].focalMechanismList).toHaveLength(1);
  expect(quakes[0].focalMechanismList[0].waveformIDList).toHaveLength(32);
  expect(quakes[0].focalMechanismList[0].waveformIDList[0]).toMatchObject({
    networkCode: "NZ",
    stationCode: "BFZ",
    channelCode: "HHE",
    locationCode: "10",
  });
  expect(quakes[0].focalMechanismList[0].momentTensorList).toHaveLength(1);
  expect(quakes[0].focalMechanismList[0].momentTensorList[0]).toMatchObject({
    derivedOrigin: { publicId: "quakeml:us.anss.org/origin/6000kawn/mww" },
    momentMagnitude: { publicId: "quakeml:us.anss.org/magnitude/6000kawn/mww" },
    scalarMoment: { value: 2.68e+20 },
    tensor: {
      Mrr: { value: -2.3917e+20 },
      Mtt: { value: 1.3179e+20 },
      Mpp: { value: 1.0738e+20 },
      Mrt: { value: 2.884e+19 },
      Mrp: { value: -9.337e+19 },
      Mtp: { value: 1.388e+20 },
    },
    doubleCouple: 0.9222,
    clvd: 0.0778,
    sourceTimeFunction: {
      type: "triangle",
      duration: 29.76,
      riseTime: 14.88,
      decayTime: 14.88,
    },
    publicId: "quakeml:us.anss.org/momenttensor/6000kawn/mww",
  });
  expect(quakes[0].focalMechanismList[0]).toMatchObject({
    triggeringOrigin: {
      publicId: "quakeml:us.anss.org/origin/6000kawn/mww_trigger",
    },
    nodalPlanes: {
      nodalPlane1: {
        strike: { value: 245.58 },
        dip: { value: 43.28 },
        rake: { value: -61.73 }
      },
      nodalPlane2: {
        strike: { value: 29.12 },
        dip: { value: 52.86 },
        rake: { value: -114.04 }
      },
    },
    principalAxes: {
      tAxis: {
        azimuth: { value: 136 },
        plunge: { value: 5 },
        length: { value: 2.62605e+20 },
      },
      pAxis: {
        azimuth: { value: 240 },
        plunge: { value: 70 },
        length: { value: -2.73235e+20 },
      },
      nAxis: {
        azimuth: { value: 44 },
        plunge: { value: 19 },
        length: { value: 1.06295e+19 },
      },
    },
    evaluationMode: "manual",
    evaluationStatus: "preliminary",
    creationInfo: {
      agencyID: 'us',
      agencyURI: "smi:anss.org/metadata/agencyid/us",
      creationTime: isoToDateTime("2023-05-10T16:14:55.000000Z"),
    },
  });
});
