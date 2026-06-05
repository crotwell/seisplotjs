

import {setDefaultFetch} from '../src/util';
import fetch from 'cross-fetch';
setDefaultFetch(fetch);

import * as usgsgeosjon from '../src/usgsgeojson';
import type {Quake} from '../src/quakeml';

test("grab", () => {
  return usgsgeosjon.loadHourSummaryAll().then((quakeList: Array<Quake>) => {
    expect(quakeList).toBeDefined();
    expect(quakeList).not.toHaveLength(0);
  });
});

test("grabHour", () => {
  const sig = usgsgeosjon.loadHourSummarySignificant().then((quakeList: Array<Quake>) => {
    expect(quakeList).toBeDefined();
  });
  const m45 = usgsgeosjon.loadHourSummaryM4_5().then((quakeList: Array<Quake>) => {
    expect(quakeList).toBeDefined();
  });
  const m25 = usgsgeosjon.loadHourSummaryM2_5().then((quakeList: Array<Quake>) => {
    expect(quakeList).toBeDefined();
  });
  const m1 = usgsgeosjon.loadHourSummaryM1_0().then((quakeList: Array<Quake>) => {
    expect(quakeList).toBeDefined();
  });
  const all = usgsgeosjon.loadHourSummaryAll().then((quakeList: Array<Quake>) => {
    expect(quakeList).toBeDefined();
  });
  return Promise.all([sig, m45, m25, m1, all]);
});
test("grabDay", () => {
  const sig = usgsgeosjon.loadDaySummarySignificant().then((quakeList: Array<Quake>) => {
    expect(quakeList).toBeDefined();
  });
  const m45 = usgsgeosjon.loadDaySummaryM4_5().then((quakeList: Array<Quake>) => {
    expect(quakeList).toBeDefined();
  });
  const m25 = usgsgeosjon.loadDaySummaryM2_5().then((quakeList: Array<Quake>) => {
    expect(quakeList).toBeDefined();
  });
  const m1 = usgsgeosjon.loadDaySummaryM1_0().then((quakeList: Array<Quake>) => {
    expect(quakeList).toBeDefined();
  });
  const all = usgsgeosjon.loadDaySummaryAll().then((quakeList: Array<Quake>) => {
    expect(quakeList).toBeDefined();
  });
  return Promise.all([sig, m45, m25, m1, all]);
});
test("grabWeek", () => {
  const sig = usgsgeosjon.loadWeekSummarySignificant().then((quakeList: Array<Quake>) => {
    expect(quakeList).toBeDefined();
  });
  const m45 = usgsgeosjon.loadWeekSummaryM4_5().then((quakeList: Array<Quake>) => {
    expect(quakeList).toBeDefined();
  });
  const m25 = usgsgeosjon.loadWeekSummaryM2_5().then((quakeList: Array<Quake>) => {
    expect(quakeList).toBeDefined();
  });
  const m1 = usgsgeosjon.loadWeekSummaryM1_0().then((quakeList: Array<Quake>) => {
    expect(quakeList).toBeDefined();
  });
  const all = usgsgeosjon.loadWeekSummaryAll().then((quakeList: Array<Quake>) => {
    expect(quakeList).toBeDefined();
  });
  return Promise.all([sig, m45, m25, m1, all]);
});
test("grabMonth", () => {
  const sig = usgsgeosjon.loadMonthSummarySignificant().then((quakeList: Array<Quake>) => {
    expect(quakeList).toBeDefined();
  });
  const m45 = usgsgeosjon.loadMonthSummaryM4_5().then((quakeList: Array<Quake>) => {
    expect(quakeList).toBeDefined();
  });
  const m25 = usgsgeosjon.loadMonthSummaryM2_5().then((quakeList: Array<Quake>) => {
    expect(quakeList).toBeDefined();
  });
  const m1 = usgsgeosjon.loadMonthSummaryM1_0().then((quakeList: Array<Quake>) => {
    expect(quakeList).toBeDefined();
  });
  const all = usgsgeosjon.loadMonthSummaryAll().then((quakeList: Array<Quake>) => {
    expect(quakeList).toBeDefined();
  });
  return Promise.all([sig, m45, m25, m1, all]);
});

test("grabYearSignificant", () => {
  const sig = usgsgeosjon.loadYearSignificant().then((quakeList: Array<Quake>) => {
    expect(quakeList).toBeDefined();
  });
  return Promise.all([sig]);
});
