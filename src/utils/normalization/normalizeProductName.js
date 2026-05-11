import { extractASeries } from "./extractASeries.js";
import { extractDimension } from "./extractDimension.js";

export const normalizeProductName = (productName, variationMeta = {}) => {
  if (!productName) return "unknown_product";

  const sizeSeries =
    variationMeta.size_series ||
    extractASeries(productName);

  const dimension =
    variationMeta.dimension ||
    extractDimension(productName);

  if (sizeSeries && dimension) {
    return `${sizeSeries} ${dimension}`;
  }

  if (sizeSeries) {
    return sizeSeries;
  }

  if (dimension) {
    return dimension;
  }

  return productName.toString().trim();
};