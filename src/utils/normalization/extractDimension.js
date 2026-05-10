export const extractDimension = (value) => {
  if (!value) return null;

  const text = value.toString().trim().toLowerCase();

  const match = text.match(
    /\b\d{2,4}\s*x\s*\d{2,4}(?:\s*x\s*\d{1,4})?\b/
  );

  return match
    ? match[0].replace(/\s+/g, "")
    : null;
};