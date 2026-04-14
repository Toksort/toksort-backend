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
          const cleanKey = key.trim().toLowerCase(); // 🔥 MAGIC DI SINI
          cleanRow[cleanKey] = row[key]?.trim();
        });

        results.push(cleanRow);
      })
      .on("end", () => resolve(results))
      .on("error", (err) => reject(err));
  });
}