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

  if (
    text.includes("terpal karung kurir") ||
    text.includes("karung kurir") ||
    text.includes("resleting anti air") ||
    text.includes("anti air kurir") ||
    (text.includes("karung") && text.includes("kurir")) ||
    (text.includes("karung") && text.includes("anti air"))
  ) {
    return PRODUCT_CATEGORIES.KARUNG_KURIR;
  }

  if (
    variationMeta.special_category ===
    PRODUCT_CATEGORIES.PEMBUANGAN_KOLAM_TERPAL
  ) {
    return PRODUCT_CATEGORIES.PEMBUANGAN_KOLAM_TERPAL;
  }

  return PRODUCT_CATEGORIES.TERPAL_KOLAM;
};

export const normalizeOrder = (item) => {
  const variationMeta = classifyVariation(item.variation);

  const productSizeSeries = extractASeries(item.product_name);
  const productDimension = extractDimension(item.product_name);

  const variationSizeSeries = extractASeries(item.variation);
  const variationDimension = extractDimension(item.variation);

  const sizeSeries =
    variationMeta.size_series ||
    variationSizeSeries ||
    productSizeSeries ||
    null;

  const dimension =
    variationMeta.dimension ||
    variationDimension ||
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