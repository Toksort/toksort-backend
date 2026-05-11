import { classifyVariation } from "./classifyVariation.js";
import { normalizeProductName } from "./normalizeProductName.js";
import { extractASeries } from "./extractASeries.js";
import { extractDimension } from "./extractDimension.js";

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

    special_category: variationMeta.special_category,

    // backward compatibility
    product_name: normalizedProductName,
    variation: variationMeta.normalized_variation,
  };
};