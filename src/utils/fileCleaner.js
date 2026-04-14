import fs from "fs";
import path from "path";

const uploadDir = path.resolve("src/uploads");

// =======================
// DELETE OLD FILES
// =======================
export const deleteOldFiles = () => {
  console.log("UPLOAD DIR:", uploadDir);

  if (!fs.existsSync(uploadDir)) {
    console.log("Folder uploads tidak ditemukan");
    return;
  }

  const files = fs.readdirSync(uploadDir);

  files.forEach((file) => {
    const filePath = path.join(uploadDir, file);
    fs.unlinkSync(filePath);
  });
};

// =======================
// CHECK DAILY LIMIT
// =======================
export const checkDailyLimit = () => {
  if (!fs.existsSync(uploadDir)) return false;

  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const shortYear = String(now.getFullYear()).slice(-2);

  const baseName = `data-${day}${month}${shortYear}`;

  const files = fs.readdirSync(uploadDir);
  const matching = files.filter((f) => f.startsWith(baseName));

  return matching.length >= 10;
};