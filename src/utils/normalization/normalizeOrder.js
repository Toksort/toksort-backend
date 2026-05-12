import { classifyVariation } from "./classifyVariation.js";
import { normalizeProductName } from "./normalizeProductName.js";
import { extractASeries } from "./extractASeries.js";
import { extractDimension } from "./extractDimension.js";

export const PRODUCT_CATEGORIES = {
  TERPAL_KOLAM: "TERPAL_KOLAM",
  PEMBUANGAN_KOLAM_TERPAL: "PEMBUANGAN_KOLAM_TERPAL",
  KARUNG_KURIR: "KARUNG_KURIR",
};

const detectProductCategory = (productName, variationMeta) => {
  const text = productName?.toString().toLowerCase() || "";

  // 1. KARUNG KURIR harus dicek dulu
  if (
    text.includes("karung kurir") ||
    text.includes("terpal karung") ||
    text.includes("kurir anti air") ||
    text.includes("resleting anti air") ||
    (text.includes("karung") && text.includes("anti air"))
  ) {
    return PRODUCT_CATEGORIES.KARUNG_KURIR;
  }

  // 2. PEMBUANGAN KOLAM dari variation
  if (
    variationMeta.special_category ===
    PRODUCT_CATEGORIES.PEMBUANGAN_KOLAM_TERPAL
  ) {
    return PRODUCT_CATEGORIES.PEMBUANGAN_KOLAM_TERPAL;
  }

  // 3. default
  return PRODUCT_CATEGORIES.TERPAL_KOLAM;
};

export const normalizeOrder = (item) => {
  const variationMeta = classifyVariation(item.variation);

  const productSizeSeries = extractASeries(item.product_name);
  const productDimension = extractDimension(item.product_name);

  const sizeSeries =
    variationMeta.size_series ||
    productSizeSeries ||
    null;

  const dimension =
    variationMeta.dimension ||
    productDimension ||
    null;

  const specialCategory = detectProductCategory(
    item.product_name,
    variationMeta
  );

  const normalizedProductName = normalizeProductName(item.product_name, {
    ...variationMeta,
    size_series: sizeSeries,
    dimension,
  });

  return {
    ...item,

    raw_product_name: item.product_name,
    normalized_product_name: normalizedProductName,

    raw_variation: variationMeta.raw_variation,
    normalized_variation: variationMeta.normalized_variation,

    variation_type: variationMeta.variation_type,

    size_series: sizeSeries,
    dimension,

    special_category: specialCategory,

    product_name: normalizedProductName,
    variation: variationMeta.normalized_variation,
  };
};