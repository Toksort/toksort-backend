import { Readable } from "stream";
import csv from "csv-parser";

const normalizeHeader = (header) => {
  if (!header) return "";

  return header
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
};

const normalizeValue = (value) => {
  if (value === undefined || value === null) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }

  return value;
};

const isEmptyRow = (row) => {
  return !Object.values(row).some((value) => {
    if (value === null || value === undefined) return false;
    return value.toString().trim() !== "";
  });
};

export function parseCSV(buffer) {
  return new Promise((resolve, reject) => {
    if (!buffer) {
      return reject(new Error("CSV buffer tidak ditemukan"));
    }

    const content = buffer.toString("utf-8").trim();

    if (!content) {
      return reject(new Error("CSV kosong"));
    }

    const results = [];

    const stream = Readable.from([content]);

    stream
      .pipe(
        csv({
          mapHeaders: ({ header }) => normalizeHeader(header),
          mapValues: ({ value }) => normalizeValue(value),
          skipLines: 0,
          strict: false,
        })
      )
      .on("data", (row) => {
        const cleanRow = {};

        Object.entries(row).forEach(([key, value]) => {
          const cleanKey = normalizeHeader(key);

          if (!cleanKey) return;

          cleanRow[cleanKey] = normalizeValue(value);
        });

        if (isEmptyRow(cleanRow)) {
          return;
        }

        results.push(cleanRow);
      })
      .on("end", () => {
        resolve(results);
      })
      .on("error", (err) => {
        reject(new Error(`CSV parse error: ${err.message}`));
      });
  });
}