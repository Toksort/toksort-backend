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
    if (req.fileValidationError) {
      return res.status(400).json({
        success: false,
        message: req.fileValidationError,
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No CSV file uploaded",
      });
    }

    // 🔥 INI YANG KURANG
    const filename = req.file.filename;
    const filePath = path.join(__dirname, "../uploads", filename);

    // 🔥 sekarang aman
    const rawData = await parseCSV(filePath);

    // 🔥 CLEAN + TRANSFORM DATA
    const cleanedData = rawData.map((row) => {
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

        } else if (header === "variation") {
          filtered[newKey] = normalizeVariant(row[header]);

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

        } else if (header === "variation") {
          filtered[newKey] = normalizeVariant(row[header]);

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

export const getSummary = async (req, res) => {
  try {
    const uploadDir = path.join(__dirname, "../uploads");

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

    // 🔥 CLEAN DATA (PASTIKAN PAKAI normalizeVariant)
    const cleanedData = rawData.map((row) => {
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

      const createdTime = row["created time"];
      filtered.shipping_status = getShippingStatus(createdTime);

      return filtered;
    });

    // =====================
    // 🔥 SUMMARY LOGIC
    // =====================
    let totalOrders = cleanedData.length;
    let totalQty = 0;

    const byVariation = {};
    const byStatus = {};

    cleanedData.forEach((item) => {
      const qty = item.quantity || 0;
      totalQty += qty;

      // variation
      const v = item.variation || "unknown";
      byVariation[v] = (byVariation[v] || 0) + qty;

      // status
      const s = item.shipping_status || "unknown";
      byStatus[s] = (byStatus[s] || 0) + 1;
    });

    return res.json({
      success: true,
      message: "Summary generated",
      data: {
        filename: latestFile,
        total_orders: totalOrders,
        total_quantity: totalQty,
        by_variation: byVariation,
        by_status: byStatus
      }
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate summary"
    });
  }
};

export const deleteAllFiles = (req, res) => {
  try {
    const uploadDir = path.join(__dirname, "../uploads");

    if (!fs.existsSync(uploadDir)) {
      return res.json({
        success: true,
        message: "Folder tidak ada, nothing to delete"
      });
    }

    const files = fs.readdirSync(uploadDir);

    let deletedCount = 0;

    files.forEach((file) => {
      const filePath = path.join(uploadDir, file);

      if (fs.statSync(filePath).isFile()) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    });

    // 🔥 BONUS: CLEAR LOG DI SINI
    const logPath = path.join(__dirname, "../logs/history.log");

    if (fs.existsSync(logPath)) {
      fs.writeFileSync(logPath, ""); // kosongin log
    }

    return res.json({
      success: true,
      message: `Berhasil hapus ${deletedCount} file & reset log`
    });

  } catch (error) {
    console.error("Delete all error:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal hapus semua file"
    });
  }
};

const allowedVariants = [
  "A2","A3","A4","A5","A6","A7","A8","A9",
  "A10","A11","A12","A13","A14","A15","A16","A17","A18","A19","A20"
];

const normalizeVariant = (variant) => {
  if (!variant) return "unknown";

  const text = variant.toUpperCase();

  if (text === "DEFAULT") return "A5";

  for (let v of allowedVariants) {
    if (text.includes(v)) {
      return v;
    }
  }

  return "unknown";
};