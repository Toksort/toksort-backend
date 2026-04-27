import { Readable } from "stream";
import csv from "csv-parser";

export function parseCSV(buffer) {
  return new Promise((resolve, reject) => {
    const results = [];

    const stream = Readable.from([buffer.toString("utf-8")]); // ✅ FIX

    stream
      .pipe(csv())
      .on("data", (row) => {
        const cleanRow = {};

        Object.keys(row).forEach((key) => {
          const cleanKey = key
            .replace(/^\uFEFF/, "") // ✅ remove BOM
            .trim()
            .toLowerCase();

          const value = row[key];

          cleanRow[cleanKey] =
            typeof value === "string" ? value.trim() : value ?? null;
        });

        // debug skip
        if (!Object.values(cleanRow).some((v) => v)) {
          console.log("⚠️ EMPTY ROW SKIPPED:", cleanRow);
          return;
        }

        results.push(cleanRow);
      })
      .on("end", () => {
        console.log("✅ PARSED ROWS:", results.length);
        resolve(results);
      })
      .on("error", (err) => {
        reject(new Error("CSV parse error (buffer): " + err.message));
      });
  });
}