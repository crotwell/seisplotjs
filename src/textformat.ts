
export const latlonFormat = new Intl.NumberFormat(navigator.languages[0], {
  style: "unit",
  unit: "degree",
  unitDisplay: "narrow",
  maximumFractionDigits: 2,
});

export const magFormat = new Intl.NumberFormat(navigator.languages[0], {
  style: "decimal",
  maximumFractionDigits: 2,
});

export const depthNoUnitFormat = new Intl.NumberFormat(navigator.languages[0], {
  style: "decimal",
  maximumFractionDigits: 2,
});

export const depthFormat = new Intl.NumberFormat(navigator.languages[0], {
  style: "unit",
  unit: "kilometer",
  unitDisplay: "narrow",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});
export const depthMeterFormat = new Intl.NumberFormat(navigator.languages[0], {
  style: "unit",
  unit: "meter",
  unitDisplay: "narrow",
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});
