import { extractASeries } from "./extractASeries.js";
import { extractDimension } from "./extractDimension.js";

export const VARIATION_TYPES = {
  A_SERIES: "A_SERIES",
  DIMENSION: "DIMENSION",
  QUANTITY: "QUANTITY",
  RATIO: "RATIO",
  SPECIAL: "SPECIAL",
  UNKNOWN: "UNKNOWN",
};

const detectQuantity = (value) => {
  if (!value) return null;

  const text = value.toString().trim().toLowerCase();
  const match = text.match(/\b\d+\s*(pcs|pc|buah|set)\b/);

  return match ? match[0].replace(/\s+/g, " ") : null;
};

const detectRatio = (value) => {
  if (!value) return null;

  const text = value.toString().trim().toLowerCase();
  const match = text.match(/\b\d+\/\d+\s*\d*\s*cm\b|\b\d+\/\d+\b/);

  return match ? match[0].replace(/\s+/g, " ") : null;
};

const detectSpecialCategory = (value) => {
  if (!value) return null;

  const text = value.toString().trim().toLowerCase();

  if (/\b(1\/2|3\/4)\b/.test(text) && text.includes("cm")) {
    return "PEMBUANGAN_KOLAM_TERPAL";
  }

  return null;
};

export const classifyVariation = (variation) => {
  const raw = variation?.toString().trim() || null;

  if (!raw || raw.toUpperCase() === "DEFAULT") {
    return {
      raw_variation: raw,
      normalized_variation: "A5",
      variation_type: VARIATION_TYPES.A_SERIES,
      size_series: "A5",
      dimension: null,
      special_category: null,
    };
  }

  const specialCategory = detectSpecialCategory(raw);

  if (specialCategory) {
    return {
      raw_variation: raw,
      normalized_variation: raw,
      variation_type: VARIATION_TYPES.SPECIAL,
      size_series: null,
      dimension: null,
      special_category: specialCategory,
    };
  }

  const aSeries = extractASeries(raw);
  const dimension = extractDimension(raw);

  if (aSeries) {
    return {
      raw_variation: raw,
      normalized_variation: aSeries,
      variation_type: VARIATION_TYPES.A_SERIES,
      size_series: aSeries,
      dimension,
      special_category: null,
    };
  }

  if (dimension) {
    return {
      raw_variation: raw,
      normalized_variation: dimension,
      variation_type: VARIATION_TYPES.DIMENSION,
      size_series: null,
      dimension,
      special_category: null,
    };
  }

  const quantity = detectQuantity(raw);

  if (quantity) {
    return {
      raw_variation: raw,
      normalized_variation: quantity,
      variation_type: VARIATION_TYPES.QUANTITY,
      size_series: null,
      dimension: null,
      special_category: null,
    };
  }

  const ratio = detectRatio(raw);

  if (ratio) {
    return {
      raw_variation: raw,
      normalized_variation: ratio,
      variation_type: VARIATION_TYPES.RATIO,
      size_series: null,
      dimension: null,
      special_category: null,
    };
  }

  return {
    raw_variation: raw,
    normalized_variation: "unknown",
    variation_type: VARIATION_TYPES.UNKNOWN,
    size_series: null,
    dimension: null,
    special_category: null,
  };
};