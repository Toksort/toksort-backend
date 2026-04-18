import fs from "fs";
import path from "path";
import parseCSV from "../utils/csvParser.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ HEADER YANG DIAMBIL DARI CSV (TANPA shipping status)
const allowedHeaders = [
  "order id",
  "product name",
  "variation",
  "quantity",
  "created time",
  "product category"
];

// ✅ MAPPING KE FORMAT BACKEND
const headerMap = {
  "order id": "order_id",
  "product name": "product_name",
  "variation": "variation",
  "quantity": "quantity",
  "created time": "created_time",
  "product category": "product_category"
};

// ✅ LOGIC STATUS PENGIRIMAN (FIXED - TANPA Date parsing ribet)
const getShippingStatus = (createdTime) => {
  if (!createdTime) return "unknown";

  const parts = createdTime.split(" ");
  if (parts.length < 2) return "unknown";

  const timePart = parts[1];
  const hour = parseInt(timePart.split(":")[0]);

  return hour < 12 ? "urgent" : "normal";
};

// =======================
// UPLOAD CSV
// =======================
export const uploadCSV = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No CSV file uploaded" });
    }

    const filename = req.file.filename;
    const filePath = path.join(__dirname, "../uploads", filename);

    if (!fs.existsSync(filePath)) {
      return res.status(500).json({ error: "Uploaded file not found in server" });
    }

    const rawData = await parseCSV(filePath);

    // 🔥 CLEAN + TRANSFORM DATA
    const cleanedData = rawData.map((row) => {
      const filtered = {};

      allowedHeaders.forEach((header) => {
        const newKey = headerMap[header];

        if (header === "quantity") {
          filtered[newKey] = parseInt(row[header]) || 0;
        } else {
          filtered[newKey] = row[header] ?? null;
        }
      });

      // 🔥 TAMBAH SHIPPING STATUS
      const createdTime = row["created time"];
      filtered.shipping_status = getShippingStatus(createdTime);

      return filtered;
    });

    // ✅ LOG HISTORY
    const logPath = path.join(__dirname, "../logs/history.log");
    fs.appendFileSync(
      logPath,
      `${new Date().toISOString()} - Uploaded: ${filename} (${cleanedData.length} rows)\n`
    );

    // ✅ OPTIONAL: hapus file setelah diproses
    // fs.unlinkSync(filePath);

    return res.json({
      success: true,
      message: "CSV processed & cleaned successfully",
      rows: cleanedData.length,
      preview: cleanedData.slice(0, 5)
    });

  } catch (error) {
    console.error("CSV upload error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// =======================
// GET CSV UPLOAD HISTORY
// =======================
export const getCSVHistory = (req, res) => {
  try {
    const logPath = path.join(__dirname, "../logs/history.log");

    if (!fs.existsSync(logPath)) {
      return res.json({ history: [] });
    }

    const logs = fs
      .readFileSync(logPath, "utf-8")
      .split("\n")
      .filter(Boolean);

    return res.json({ history: logs });

  } catch (error) {
    console.error("Error reading history:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// =======================
// READ CSV BY FILENAME
// =======================
export const readCSV = async (req, res) => {
  try {
    const { filename } = req.params;

    if (!filename) {
      return res.status(400).json({ error: "Filename is required" });
    }

    // GANTI DARI: path.join(__dirname, "src/uploads", filename) 
    const filePath = path.join(__dirname, "../uploads", filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "CSV file not found" });
    }

    const rawData = await parseCSV(filePath);

    // 🔥 CLEAN + TAMBAH SHIPPING STATUS (FIXED)
    const cleanedData = rawData.map((row) => {
      const filtered = {};

      allowedHeaders.forEach((header) => {
        const newKey = headerMap[header];

        if (header === "quantity") {
          filtered[newKey] = parseInt(row[header]) || 0;
        } else {
          filtered[newKey] = row[header] ?? null;
        }
      });

      const createdTime = row["created time"];
      filtered.shipping_status = getShippingStatus(createdTime);

      return filtered;
    });

   return res.json({
      success: true,
      message: "File read successfully",
      data: {
        filename,
        totalRows: cleanedData.length,
        rows: cleanedData
      }
    });

  } catch (error) {
    console.error("Error reading CSV:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};


// =======================
// DELETE CSV BY SELECTED
// =======================
export const deleteFile = (req, res) => {
  try {
    let { filename } = req.params;

  if (!filename.endsWith(".csv")) {
    filename += ".csv";
  }

  const filePath = path.join(__dirname, "../uploads", filename);

  console.log("FINAL PATH:", filePath);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found", path: filePath });
  }

  fs.unlinkSync(filePath);

  return res.json({
    success: true,
    message: `${filename} deleted successfully`
  });

  } catch (error) {
    console.error("Delete file error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getAllFiles = (req, res) => {
  try {
    const uploadDir = path.resolve("src/uploads");

    if (!fs.existsSync(uploadDir)) {
      return res.json({
        success: true,
        data: []
      });
    }

    let files = fs
      .readdirSync(uploadDir)
      .filter((file) => file.endsWith(".csv"));

    // 🔥 sort terbaru (berdasarkan modified time)
    files = files.sort((a, b) => {
      const statA = fs.statSync(path.join(uploadDir, a));
      const statB = fs.statSync(path.join(uploadDir, b));
      return statB.mtime - statA.mtime;
    });

    return res.json({
      success: true,
      data: files
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to get files"
    });
  }
};

export const readLatestCSV = async (req, res) => {
  try {
    const uploadDir = path.resolve("src/uploads");

    if (!fs.existsSync(uploadDir)) {
      return res.status(404).json({
        success: false,
        message: "No files found"
      });
    }

    let files = fs
      .readdirSync(uploadDir)
      .filter((file) => file.endsWith(".csv"));

    if (files.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No CSV files available"
      });
    }

    // 🔥 ambil file terbaru
    files = files.sort((a, b) => {
      const statA = fs.statSync(path.join(uploadDir, a));
      const statB = fs.statSync(path.join(uploadDir, b));
      return statB.mtime - statA.mtime;
    });

    const latestFile = files[0];
    const filePath = path.join(uploadDir, latestFile);

    const rawData = await parseCSV(filePath);

    const cleanedData = rawData.map((row) => {
      const filtered = {};

      allowedHeaders.forEach((header) => {
        const newKey = headerMap[header];

        if (header === "quantity") {
          filtered[newKey] = parseInt(row[header]) || 0;
        } else {
          filtered[newKey] = row[header] ?? null;
        }
      });

      const createdTime = row["created time"];
      filtered.shipping_status = getShippingStatus(createdTime);

      return filtered;
    });

    return res.json({
      success: true,
      message: "Latest file fetched",
      data: {
        filename: latestFile,
        totalRows: cleanedData.length,
        rows: cleanedData
      }
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to read latest file"
    });
  }
};