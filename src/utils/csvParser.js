import { Readable } from "stream";
import csv from "csv-parser";

export function parseCSV(buffer) {
  return new Promise((resolve, reject) => {
    const results = [];

    const stream = Readable.from(buffer.toString("utf-8"));

    stream
      .pipe(csv())
      .on("data", (row) => {
        const cleanRow = {};

        Object.keys(row).forEach((key) => {
          const cleanKey = key.trim().toLowerCase();
          const value = row[key];

          cleanRow[cleanKey] =
            typeof value === "string" ? value.trim() : value ?? null;
        });

        // skip row kosong
        if (!Object.values(cleanRow).some((v) => v)) return;

        results.push(cleanRow);
      })
      .on("end", () => resolve(results))
      .on("error", (err) =>
        reject(new Error("CSV parse error (buffer): " + err.message))
      );
  });
}