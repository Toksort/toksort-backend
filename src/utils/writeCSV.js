import fs from "fs";

export const writeCSV = (filePath, data) => {
  if (!data.length) return;

  const headers = Object.keys(data[0]);

  const csvRows = [
    headers.join(","), // header
    ...data.map(row =>
      headers.map(h => `"${row[h] ?? ""}"`).join(",")
    )
  ];

  fs.writeFileSync(filePath, csvRows.join("\n"));
};