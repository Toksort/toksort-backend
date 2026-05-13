import { extractASeries } from "./extractASeries.js";
import { extractDimension } from "./extractDimension.js";

export const PRODUCT_CATEGORIES = {
  TERPAL_KOLAM: "TERPAL_KOLAM",
  PEMBUANGAN_KOLAM_TERPAL: "PEMBUANGAN_KOLAM_TERPAL",
  KARUNG_KURIR: "KARUNG_KURIR",
};

export const normalizeProductCategory = (productName) => {
  if (!productName) return PRODUCT_CATEGORIES.TERPAL_KOLAM;

  const text = productName.toString().toLowerCase();

  if (
    text.includes("terpal karung kurir") ||
    text.includes("karung kurir") ||
    text.includes("resleting anti air kurir") ||
    (text.includes("karung") && text.includes("kurir")) ||
    (text.includes("karung") && text.includes("anti air"))
  ) {
    return PRODUCT_CATEGORIES.KARUNG_KURIR;
  }

  if (
    text.includes("pembuangan") ||
    text.includes("penguras") ||
    text.includes("air kolam terpal")
  ) {
    return PRODUCT_CATEGORIES.PEMBUANGAN_KOLAM_TERPAL;
  }

  return PRODUCT_CATEGORIES.TERPAL_KOLAM;
};

export const normalizeProductName = (productName, variationMeta = {}) => {
  const category = normalizeProductCategory(productName);

  if (category === PRODUCT_CATEGORIES.KARUNG_KURIR) {
    return PRODUCT_CATEGORIES.KARUNG_KURIR;
  }

  if (category === PRODUCT_CATEGORIES.PEMBUANGAN_KOLAM_TERPAL) {
    return PRODUCT_CATEGORIES.PEMBUANGAN_KOLAM_TERPAL;
  }

  const sizeSeries =
    variationMeta.size_series ||
    extractASeries(productName);

  const dimension =
    variationMeta.dimension ||
    extractDimension(productName);

  if (sizeSeries && dimension) return `${sizeSeries} ${dimension}`;
  if (sizeSeries) return sizeSeries;
  if (dimension) return dimension;

  return PRODUCT_CATEGORIES.TERPAL_KOLAM;
};