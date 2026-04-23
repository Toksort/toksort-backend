import fs from "fs";
import csv from "csv-parser";

export default function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => {
        const cleanRow = {};

        Object.keys(row).forEach((key) => {
          const cleanKey = key.trim().toLowerCase();
          const value = row[key];

          cleanRow[cleanKey] =
            typeof value === "string" ? value.trim() : value ?? null;
        });

        if (!Object.values(cleanRow).some(v => v)) return;

        results.push(cleanRow);
      })
      .on("end", () => resolve(results))
      .on("error", (err) =>
        reject(new Error("CSV parse error: " + err.message))
      );
  });
}