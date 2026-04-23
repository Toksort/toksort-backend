import fs from "fs";
import path from "path";
import parseCSV from "../utils/csvParser.js";
import { fileURLToPath } from "url";
import { initDB } from "../config/db.js";
import { createTable } from "../models/orderModel.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// VARIANT NORMALIZER
const normalizeVariant = (variant) => {
  if (!variant) return "unknown";

  const text = variant
    .toString()
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

  if (text === "DEFAULT") return "A5";

  const match = text.match(/(?:^|[^A-Z0-9])A(2[0]|1[0-9]|[2-9])(?:[^0-9]|$)/);

  return match ? `A${match[1]}` : "unknown";
};


// SHIPPING NORMALIZER
const mapShippingToDB = (val) => {
  if (!val) return "";

  val = val.toLowerCase();

  if (val.includes("hari ini") || val === "today") return "Kirim Hari ini";
  if (val.includes("besok") || val === "tomorrow") return "Kirim Besok";

  return val;
};


// STATUS LOGIC
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
    shipping_status: hour < 12 ? "Kirim Hari ini" : "Kirim Besok"
  };
};


// TRANSFORM DATA
const transformData = (rawData) => {
  if (!Array.isArray(rawData)) return [];

  return rawData.map((row) => ({
    order_id: row["order id"] ?? null,
    product_name: row["product name"] ?? null,
    quantity: parseInt(row["quantity"]) || 0,
    variation: normalizeVariant(row["variation"]),
    created_time: row["created time"] ?? null,
    ...getStatusFromTime(row["created time"]),
    status: "pending"
  }));
};


// UPLOAD CSV → DB
export const uploadCSV = async (req, res) => {
  try {
    const db = await initDB();
    await createTable(db);

    const filePath = path.join(__dirname, "../uploads", req.file.filename);

    const rawData = await parseCSV(filePath);
    const cleanedData = transformData(rawData);

    // 🔥 HAPUS DATA LAMA BIAR GA DOUBLE
    await db.run(`DELETE FROM orders`);

    const stmt = await db.prepare(`
      INSERT INTO orders 
      (order_id, product_name, quantity, variation, created_time, order_status, shipping_status, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of cleanedData) {
      await stmt.run(
        item.order_id,
        item.product_name,
        item.quantity,
        item.variation,
        item.created_time,
        item.order_status,
        item.shipping_status,
        item.status
      );
    }

    await stmt.finalize();

    res.json({
      success: true,
      total: cleanedData.length,
      message: "Upload & insert DB sukses 🔥"
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "upload failed" });
  }
};


// GET ORDERS (PENDING)
export const getOrders = async (req, res) => {
  try {
    const db = await initDB();

    let query = `SELECT * FROM orders WHERE status != 'done'`;
    const params = [];

    if (req.query.variation) {
      query += ` AND variation = ?`;
      params.push(req.query.variation.toUpperCase());
    }

    if (req.query.shipping_status) {
      query += ` AND shipping_status = ?`;
      params.push(mapShippingToDB(req.query.shipping_status));
    }

    const data = await db.all(query, params);

    res.json({
      success: true,
      total: data.length,
      data
    });

  } catch (err) {
    res.status(500).json({ error: "failed get orders" });
  }
};


// GET HISTORY (DONE)
export const getHistory = async (req, res) => {
  try {
    const db = await initDB();

    const data = await db.all(`
      SELECT * FROM orders WHERE status = 'done'
    `);

    res.json({
      success: true,
      total: data.length,
      data
    });

  } catch {
    res.status(500).json({ error: "failed get history" });
  }
};


// COMPLETE GROUP
export const completeGroup = async (req, res) => {
  try {
    const { variation, shipping_status } = req.body;

    const db = await initDB();

    const result = await db.run(`
      UPDATE orders
      SET status = 'done'
      WHERE variation = ?
      AND shipping_status = ?
    `, [
      variation.toUpperCase(),
      mapShippingToDB(shipping_status)
    ]);

    res.json({
      success: true,
      updated: result.changes,
      message: "Group completed 🔥"
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "complete failed" });
  }
};


// SUMMARY
export const getSummary = async (req, res) => {
  try {
    const db = await initDB();

    const rows = await db.all(`
      SELECT variation, SUM(quantity) as total
      FROM orders
      WHERE status != 'done'
      GROUP BY variation
    `);

    res.json({
      success: true,
      data: rows
    });

  } catch {
    res.status(500).json({ error: "summary failed" });
  }
};


// FILE UTIL (OPTIONAL)
export const getAllFiles = (req, res) => {
  try {
    const files = fs.readdirSync(path.join(__dirname, "../uploads"))
      .filter(f => f.endsWith(".csv"));

    res.json({ success: true, data: files });

  } catch {
    res.status(500).json({ success: false });
  }
};

export const deleteFile = (req, res) => {
  try {
    let { filename } = req.params;

    if (!filename.endsWith(".csv")) filename += ".csv";

    const filePath = path.join(__dirname, "../uploads", filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false });
    }

    fs.unlinkSync(filePath);

    res.json({ success: true });

  } catch {
    res.status(500).json({ success: false });
  }
};

export const deleteAllFiles = (req, res) => {
  try {
    const dir = path.join(__dirname, "../uploads");

    fs.readdirSync(dir).forEach(f =>
      fs.unlinkSync(path.join(dir, f))
    );

    res.json({ success: true });

  } catch {
    res.status(500).json({ success: false });
  }
};