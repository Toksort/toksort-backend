import { classifyVariation } from "./classifyVariation.js";
import { normalizeProductName } from "./normalizeProductName.js";
import { extractASeries } from "./extractASeries.js";
import { extractDimension } from "./extractDimension.js";

const PRODUCT_CATEGORIES = {
  KARUNG_KURIR: "KARUNG_KURIR",
};

const detectProductCategory = (productName) => {
  if (!productName) return null;

  const text = productName.toString().toLowerCase();

  if (
    text.includes("terpal karung kurir") ||
    text.includes("karung kurir") ||
    (text.includes("karung") && text.includes("anti air"))
  ) {
    return PRODUCT_CATEGORIES.KARUNG_KURIR;
  }

  return null;
};

export const normalizeOrder = (item) => {
  const variationMeta = classifyVariation(item.variation);

  const productSizeSeries = extractASeries(item.product_name);
  const productDimension = extractDimension(item.product_name);

  const sizeSeries = variationMeta.size_series || productSizeSeries || null;
  const dimension = variationMeta.dimension || productDimension || null;

  const productCategory = detectProductCategory(item.product_name);

  const specialCategory =
    productCategory ||
    variationMeta.special_category ||
    null;

  const normalizedProductName = normalizeProductName(item.product_name, {
    ...variationMeta,
    size_series: sizeSeries,
    dimension,
  });

  const variationType = productCategory ? "SPECIAL" : variationMeta.variation_type;

  return {
    ...item,

    raw_product_name: item.product_name,
    normalized_product_name: normalizedProductName,

    raw_variation: variationMeta.raw_variation,
    normalized_variation: variationMeta.normalized_variation,

    variation_type: variationType,

    size_series: sizeSeries,
    dimension,

    special_category: specialCategory,

    product_name: normalizedProductName,
    variation: variationMeta.normalized_variation,
  };
};