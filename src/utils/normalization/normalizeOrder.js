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
  if (!productName) {
    return PRODUCT_CATEGORIES.TERPAL_KOLAM;
  }

  const text = productName.toString().toLowerCase();

  // KARUNG KURIR
  if (
    text.includes("terpal karung kurir") ||
    text.includes("karung kurir") ||
    (text.includes("karung") && text.includes("anti air"))
  ) {
    return PRODUCT_CATEGORIES.KARUNG_KURIR;
  }

  // PEMBUANGAN KOLAM
  if (
    variationMeta.special_category ===
    PRODUCT_CATEGORIES.PEMBUANGAN_KOLAM_TERPAL
  ) {
    return PRODUCT_CATEGORIES.PEMBUANGAN_KOLAM_TERPAL;
  }

  // DEFAULT
  return PRODUCT_CATEGORIES.TERPAL_KOLAM;
};

export const normalizeOrder = (item) => {
  const variationMeta = classifyVariation(item.variation);

  const productSizeSeries =
    extractASeries(item.product_name);

  const productDimension =
    extractDimension(item.product_name);

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

  const normalizedProductName = normalizeProductName(
    item.product_name,
    {
      ...variationMeta,
      size_series: sizeSeries,
      dimension,
    }
  );

  const variationType =
    specialCategory === PRODUCT_CATEGORIES.KARUNG_KURIR
      ? "SPECIAL"
      : variationMeta.variation_type;

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

    // backward compatibility
    product_name: normalizedProductName,
    variation: variationMeta.normalized_variation,
  };
};