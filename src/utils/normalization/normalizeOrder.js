import {
  normalizeProductName,
  normalizeProductCategory,
  PRODUCT_CATEGORIES,
} from "./normalizeProductName.js";

import { classifyVariation } from "./classifyVariation.js";
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

  const productCategory = normalizeProductCategory(item.product_name);

  const specialCategory =
    productCategory === PRODUCT_CATEGORIES.KARUNG_KURIR
      ? PRODUCT_CATEGORIES.KARUNG_KURIR
      : productCategory === PRODUCT_CATEGORIES.PEMBUANGAN_KOLAM_TERPAL
        ? PRODUCT_CATEGORIES.PEMBUANGAN_KOLAM_TERPAL
        : PRODUCT_CATEGORIES.TERPAL_KOLAM;

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