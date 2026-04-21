import fs from "fs";
import path from "path";
import parseCSV from "../utils/csvParser.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =======================
// CONFIG
// =======================
const allowedHeaders = [
  "order id",
  "product name",
  "variation",
  "quantity",
  "created time",
  "product category"
];

const headerMap = {
  "order id": "order_id",
  "product name": "product_name",
  "variation": "variation",
  "quantity": "quantity",
  "created time": "created_time",
  "product category": "product_category"
};

// =======================
// VARIANT NORMALIZER 🔥
// =======================
const allowedVariants = [
  "A2","A3","A4","A5","A6","A7","A8","A9",
  "A10","A11","A12","A13","A14","A15","A16","A17","A18","A19","A20"
];

const normalizeVariant = (variant) => {
  if (!variant) return "unknown";

  const text = variant.replace(/\s+/g, " ").toUpperCase();

  if (text === "DEFAULT") return "A5";

  for (let v of allowedVariants) {
    if (text.includes(v)) return v;
  }

  return "unknown";
};

// =======================
// STATUS LOGIC 🔥
// =======================
const getStatusFromTime = (createdTime) => {
  if (!createdTime) {
    return { order_status: "unknown", shipping_status: "unknown" };
  }

  const parts = createdTime.split(" ");
  if (parts.length < 2) {
    return { order_status: "unknown", shipping_status: "unknown" };
  }

  const hour = parseInt(parts[1].split(":")[0]);

  return {
    order_status: hour < 12 ? "urgent" : "normal",
    shipping_status: hour < 12 ? "today" : "tomorrow"
  };
};

// =======================
// CLEANER FUNCTION (REUSABLE)
// =======================
const transformData = (rawData) => {
  return rawData.map((row) => {
    const filtered = {};

    allowedHeaders.forEach((header) => {
      const newKey = headerMap[header];

      if (header === "quantity") {
        filtered[newKey] = parseInt(row[header]) || 0;

      } else if (header === "variation") {
        filtered[newKey] = normalizeVariant(row[header]);

      } else {
        filtered[newKey] = row[header] ?? null;
      }
    });

    const { order_status, shipping_status } =
      getStatusFromTime(row["created time"]);

    filtered.order_status = order_status;
    filtered.shipping_status = shipping_status;

    return filtered;
  });
};

// =======================
// UPLOAD CSV
// =======================
export const uploadCSV = async (req, res) => {
  try {
    if (req.fileValidationError) {
      return res.status(400).json({
        success: false,
        message: req.fileValidationError
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No CSV file uploaded"
      });
    }

    const filename = req.file.filename;
    const filePath = path.join(__dirname, "../uploads", filename);

    const rawData = await parseCSV(filePath);
    const cleanedData = transformData(rawData);

    // log
    const logPath = path.join(__dirname, "../logs/history.log");
    fs.appendFileSync(
      logPath,
      `${new Date().toISOString()} - Uploaded: ${filename} (${cleanedData.length} rows)\n`
    );

    return res.json({
      success: true,
      message: "CSV processed successfully",
      data: {
        filename,
        totalRows: cleanedData.length,
        preview: cleanedData.slice(0, 5)
      }
    });

  } catch (error) {
    console.error("Upload error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error"
    });
  }
};

// =======================
// READ CSV
// =======================
export const readCSV = async (req, res) => {
  try {
    const { filename } = req.params;

    const filePath = path.join(__dirname, "../uploads", filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: "File not found"
      });
    }

    const rawData = await parseCSV(filePath);
    const cleanedData = transformData(rawData);

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
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to read CSV"
    });
  }
};

// =======================
// GET LATEST CSV
// =======================
export const readLatestCSV = async (req, res) => {
  try {
    const uploadDir = path.join(__dirname, "../uploads");

    let files = fs.readdirSync(uploadDir)
      .filter(f => f.endsWith(".csv"));

    if (!files.length) {
      return res.status(404).json({
        success: false,
        message: "No CSV files"
      });
    }

    files.sort((a, b) =>
      fs.statSync(path.join(uploadDir, b)).mtime -
      fs.statSync(path.join(uploadDir, a)).mtime
    );

    const latestFile = files[0];
    const filePath = path.join(uploadDir, latestFile);

    const rawData = await parseCSV(filePath);
    const cleanedData = transformData(rawData);

    return res.json({
      success: true,
      message: "Latest file fetched",
      data: {
        filename: latestFile,
        totalRows: cleanedData.length,
        rows: cleanedData
      }
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Error reading latest file"
    });
  }
};

// =======================
// SUMMARY 🔥
// =======================
export const getSummary = async (req, res) => {
  try {
    const uploadDir = path.join(__dirname, "../uploads");

    let files = fs.readdirSync(uploadDir)
      .filter(f => f.endsWith(".csv"));

    if (!files.length) {
      return res.status(404).json({
        success: false,
        message: "No CSV files"
      });
    }

    files.sort((a, b) =>
      fs.statSync(path.join(uploadDir, b)).mtime -
      fs.statSync(path.join(uploadDir, a)).mtime
    );

    const latestFile = files[0];
    const rawData = await parseCSV(path.join(uploadDir, latestFile));
    const cleanedData = transformData(rawData);

    let totalQty = 0;
    const byVariation = {};
    const byStatus = {};

    cleanedData.forEach(item => {
      totalQty += item.quantity;

      byVariation[item.variation] =
        (byVariation[item.variation] || 0) + item.quantity;

      byStatus[item.shipping_status] =
        (byStatus[item.shipping_status] || 0) + 1;
    });

    return res.json({
      success: true,
      message: "Summary generated",
      data: {
        filename: latestFile,
        total_orders: cleanedData.length,
        total_quantity: totalQty,
        by_variation: byVariation,
        by_status: byStatus
      }
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Summary failed"
    });
  }
};

// =======================
// GET FILE LIST
// =======================
export const getAllFiles = (req, res) => {
  try {
    const uploadDir = path.join(__dirname, "../uploads");

    const files = fs.readdirSync(uploadDir)
      .filter(f => f.endsWith(".csv"));

    return res.json({
      success: true,
      data: files
    });

  } catch {
    return res.status(500).json({
      success: false,
      message: "Failed to get files"
    });
  }
};

// =======================
// DELETE FILE
// =======================
export const deleteFile = (req, res) => {
  try {
    let { filename } = req.params;

    if (!filename.endsWith(".csv")) {
      filename += ".csv";
    }

    const filePath = path.join(__dirname, "../uploads", filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: "File not found"
      });
    }

    fs.unlinkSync(filePath);

    return res.json({
      success: true,
      message: `${filename} deleted`
    });

  } catch {
    return res.status(500).json({
      success: false,
      message: "Delete failed"
    });
  }
};

// =======================
// DELETE ALL 🔥
// =======================
export const deleteAllFiles = (req, res) => {
  try {
    const uploadDir = path.join(__dirname, "../uploads");

    const files = fs.readdirSync(uploadDir);

    files.forEach(file => {
      fs.unlinkSync(path.join(uploadDir, file));
    });

    return res.json({
      success: true,
      message: "All files deleted"
    });

  } catch {
    return res.status(500).json({
      success: false,
      message: "Delete all failed"
    });
  }
};

export const getCSVHistory = (req, res) => {
  try {
    const logPath = path.join(__dirname, "../logs/history.log");

    if (!fs.existsSync(logPath)) {
      return res.json({
        success: true,
        data: []
      });
    }

    const logs = fs
      .readFileSync(logPath, "utf-8")
      .split("\n")
      .filter(Boolean);

    return res.json({
      success: true,
      data: logs
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to read history"
    });
  }
};