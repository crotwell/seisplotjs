const lang =
  typeof navigator !== "undefined" && navigator?.language
    ? navigator?.language
    : "en-US";

export const latlonFormat = new Intl.NumberFormat(lang, {
  style: "unit",
  unit: "degree",
  unitDisplay: "narrow",
  maximumFractionDigits: 2,
});

export const magFormat = new Intl.NumberFormat(lang, {
  style: "decimal",
  maximumFractionDigits: 2,
});

export const depthNoUnitFormat = new Intl.NumberFormat(lang, {
  style: "decimal",
  maximumFractionDigits: 2,
});

export const depthFormat = new Intl.NumberFormat(lang, {
  style: "unit",
  unit: "kilometer",
  unitDisplay: "narrow",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});
export const depthMeterFormat = new Intl.NumberFormat(lang, {
  style: "unit",
  unit: "meter",
  unitDisplay: "narrow",
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});
