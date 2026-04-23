import fs from "fs";
import path from "path";
import parseCSV from "../utils/csvParser.js";
import { fileURLToPath } from "url";
import { pool } from "../config/db.js";
import { createTable } from "../models/orderModel.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// NORMALIZER
const normalizeVariant = (variant) => {
  if (!variant) return "unknown";

  const text = variant.toString().trim().toUpperCase();

  if (text === "DEFAULT") return "A5";

  const match = text.match(/A(2[0]|1[0-9]|[2-9])/);
  return match ? `A${match[1]}` : "unknown";
};

const mapShippingToDB = (val) => {
  if (!val) return "";

  val = val.toLowerCase();

  if (val.includes("hari ini") || val === "today") return "Kirim Hari ini";
  if (val.includes("besok") || val === "tomorrow") return "Kirim Besok";

  return val;
};

const getStatusFromTime = (createdTime) => {
  if (!createdTime) {
    return { order_status: "unknown", shipping_status: "unknown" };
  }

  const hour = parseInt(createdTime.split(" ")[1]?.split(":")[0]);

  return {
    order_status: hour < 12 ? "urgent" : "normal",
    shipping_status: hour < 12 ? "Kirim Hari ini" : "Kirim Besok"
  };
};

// TRANSFORM
const transformData = (rawData) => {
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

// UPLOAD CSV → DB (MULTI UPLOAD)
export const uploadCSV = async (req, res) => {
  try {
    await createTable();

    const filePath = path.join(__dirname, "../uploads", req.file.filename);

    const rawData = await parseCSV(filePath);
    const cleanedData = transformData(rawData);

    // 🔥 1. insert ke uploads
    const uploadResult = await pool.query(
      `INSERT INTO uploads (filename) VALUES ($1) RETURNING id`,
      [req.file.filename]
    );

    const upload_id = uploadResult.rows[0].id;

    // 🔥 2. insert orders
    for (const item of cleanedData) {
      await pool.query(
        `INSERT INTO orders 
        (upload_id, order_id, product_name, quantity, variation, created_time, order_status, shipping_status, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          upload_id,
          item.order_id,
          item.product_name,
          item.quantity,
          item.variation,
          item.created_time,
          item.order_status,
          item.shipping_status,
          item.status
        ]
      );
    }

    res.json({
      success: true,
      upload_id,
      total: cleanedData.length,
      message: "Upload sukses (multi batch ready 🚀)"
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "upload failed" });
  }
};

export const getUploads = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, filename, created_at
      FROM uploads
      ORDER BY created_at DESC
    `);

    res.json({
      success: true,
      total: result.rows.length,
      data: result.rows
    });

  } catch (err) {
    res.status(500).json({ error: "failed get uploads" });
  }
};

export const getUploadDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT *
      FROM orders
      WHERE upload_id = $1
      ORDER BY id ASC
    `, [id]);

    res.json({
      success: true,
      upload_id: id,
      total: result.rows.length,
      data: result.rows
    });

  } catch (err) {
    res.status(500).json({ error: "failed get upload detail" });
  }
};

export const getUploadGrouped = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT 
        variation,
        shipping_status,
        COUNT(*) as total_orders,
        SUM(quantity) as total_quantity,
        COUNT(*) FILTER (WHERE status = 'done') as completed,
        ROUND(
          COUNT(*) FILTER (WHERE status = 'done') * 100.0 / COUNT(*),
          2
        ) as progress
      FROM orders
      WHERE upload_id = $1
      GROUP BY variation, shipping_status
      ORDER BY variation ASC
    `, [id]);

    res.json({
      success: true,
      upload_id: id,
      total_groups: result.rows.length,
      data: result.rows.map(r => ({
        ...r,
        total_orders: parseInt(r.total_orders),
        total_quantity: parseInt(r.total_quantity),
        completed: parseInt(r.completed),
        progress: parseFloat(r.progress)
      }))
    });

  } catch (err) {
    res.status(500).json({ error: "failed grouped data" });
  }
};

// GET ORDERS (LATEST UPLOAD)
export const getOrders = async (req, res) => {
  try {
    // 🔥 ambil upload terbaru
    const latest = await pool.query(`
      SELECT id FROM uploads ORDER BY created_at DESC LIMIT 1
    `);

    if (!latest.rows.length) {
      return res.json({ success: true, data: [] });
    }

    const upload_id = latest.rows[0].id;

    let query = `SELECT * FROM orders WHERE upload_id = $1 AND status != 'done'`;
    const values = [upload_id];

    if (req.query.variation) {
      values.push(req.query.variation.toUpperCase());
      query += ` AND variation = $${values.length}`;
    }

    if (req.query.shipping_status) {
      values.push(mapShippingToDB(req.query.shipping_status));
      query += ` AND shipping_status = $${values.length}`;
    }

    const result = await pool.query(query, values);

    res.json({
      success: true,
      upload_id,
      total: result.rows.length,
      data: result.rows
    });

  } catch (err) {
    res.status(500).json({ error: "failed get orders" });
  }
};

export const getGroupedOrders = async (req, res) => {
  try {
    let upload_id = req.query.upload_id;

    // 🔥 kalau ga dikirim → ambil latest
    if (!upload_id) {
      const latest = await pool.query(`
        SELECT id FROM uploads ORDER BY created_at DESC LIMIT 1
      `);

      if (!latest.rows.length) {
        return res.json({ success: true, data: [] });
      }

      upload_id = latest.rows[0].id;
    }

    const result = await pool.query(`
      SELECT 
        variation,
        shipping_status,
        COUNT(*) as total_orders,
        SUM(quantity) as total_quantity
      FROM orders
      WHERE upload_id = $1
      AND status != 'done'
      GROUP BY variation, shipping_status
      ORDER BY variation ASC
    `, [upload_id]);

    res.json({
      success: true,
      upload_id,
      total_groups: result.rows.length,
      data: result.rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed grouping orders" });
  }
};

// COMPLETE GROUP 
export const completeGroup = async (req, res) => {
  try {
    let { upload_id, variation, shipping_status } = req.body;

    if (!variation || !shipping_status) {
      return res.status(400).json({
        success: false,
        message: "variation & shipping_status wajib diisi"
      });
    }

    // 🔥 kalau upload_id ga dikirim → pakai latest
    if (!upload_id) {
      const latest = await pool.query(`
        SELECT id FROM uploads ORDER BY created_at DESC LIMIT 1
      `);

      if (!latest.rows.length) {
        return res.status(404).json({
          success: false,
          message: "Tidak ada data upload"
        });
      }

      upload_id = latest.rows[0].id;
    }

    const result = await pool.query(`
      UPDATE orders
      SET status = 'done'
      WHERE upload_id = $1
      AND variation = $2
      AND shipping_status = $3
      AND status != 'done'
    `, [
      upload_id,
      variation.toUpperCase(),
      mapShippingToDB(shipping_status)
    ]);

    return res.json({
      success: true,
      upload_id,
      updated: result.rowCount,
      message: `${variation} - ${shipping_status} completed 🔥`
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "complete failed" });
  }
};

// HISTORY (ALL UPLOADS)
export const getHistory = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM uploads ORDER BY created_at DESC
    `);

    res.json({
      success: true,
      data: result.rows
    });

  } catch {
    res.status(500).json({ error: "failed get history" });
  }
};


// SUMMARY (LATEST UPLOAD)
export const getUploadSummary = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(quantity) as total_quantity,
        COUNT(*) FILTER (WHERE status = 'done') as completed
      FROM orders
      WHERE upload_id = $1
    `, [id]);

    const row = result.rows[0];

    res.json({
      success: true,
      upload_id: id,
      data: {
        total_orders: parseInt(row.total_orders),
        total_quantity: parseInt(row.total_quantity),
        completed: parseInt(row.completed)
      }
    });

  } catch (err) {
    res.status(500).json({ error: "failed summary" });
  }
};

export const undoCompleteGroup = async (req, res) => {
  try {
    const { upload_id, variation, shipping_status } = req.body;

    if (!upload_id || !variation || !shipping_status) {
      return res.status(400).json({
        success: false,
        message: "upload_id, variation, shipping_status wajib diisi"
      });
    }

    const result = await pool.query(`
      UPDATE orders
      SET status = 'pending'
      WHERE upload_id = $1
      AND variation = $2
      AND shipping_status = $3
      AND status = 'done'
    `, [
      upload_id,
      variation.toUpperCase(),
      mapShippingToDB(shipping_status)
    ]);

    res.json({
      success: true,
      updated: result.rowCount,
      message: "Undo complete berhasil 🔄"
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Undo failed"
    });
  }
};