const fs = require("fs");
const { format } = require("@fast-csv/format");

exports.writeSortedCSV = (data) => {
  return new Promise((resolve, reject) => {
    const fileName = `sorted_${Date.now()}.csv`;
    const path = `src/uploads/${fileName}`;
    const ws = fs.createWriteStream(path);

    const csvStream = format({ headers: true });
    csvStream.pipe(ws);

    data.forEach((row) => csvStream.write(row));
    csvStream.end();

    ws.on("finish", () => resolve(path));
    ws.on("error", reject);
  });
};
