export const extractASeries = (value) => {
  if (!value) return null;

  const text = value.toString().trim().toUpperCase();

  const match = text.match(/\bA(2[0]|1[0-9]|[2-9])\b/);

  return match ? `A${match[1]}` : null;
};