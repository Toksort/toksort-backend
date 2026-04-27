import fs from "fs";
import path from "path";
import { parseCSV } from "../utils/csvParser.js";
import { fileURLToPath } from "url";
import { pool } from "../config/db.js";
import { createTable } from "../models/orderModel.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ================= NORMALIZER =================
const normalizeVariant = (variant) => {
  if (!variant) return "unknown";

  const text = variant.toString().trim().toUpperCase();

  if (text === "DEFAULT") return "A5";

  const match = text.match(/A(2[0]|1[0-9]|[2-9])/);
  return match ? `A${match[1]}` : "unknown";
};

const normalizeText = (text) => {
  if (!text) return "";

  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]/g, "");
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

// ================= TRANSFORM =================
const transformData = (rawData) => {
  return rawData.map((row) => ({
    order_id: row.order_id ?? null,
    product_name: row.product_name ?? null,
    quantity: parseInt(row.quantity) || 0,
    variation: normalizeVariant(row.variation),
    created_time: row.created_time ?? null,
    ...getStatusFromTime(row.created_time),
    status: "pending"
  }));
};

// ================= KEY BUILDER =================
const buildKey = (item) => {
  const shipping = item.shipping_status;
  const variation = item.variation;

  if (item.order_id) {
    return `OID-${item.order_id}-${variation}-${shipping}`;
  }

  const name = normalizeText(item.product_name);
  return `NAME-${name}-${variation}-${shipping}`;
};

// ================= UPLOAD =================
export const uploadCSV = async (req, res) => {
  try {
    await createTable();

    // ================= VALIDATION =================
    if (!req.file) {
      return res.status(400).json({ error: "File wajib diisi" });
    }

    let rawData;
    let filename;

    console.log("RAW SAMPLE:", rawData[0]);
    console.log("CLEANED SAMPLE:", cleanedData[0]);
    console.log("FINAL DATA:", finalData.length);

    // ================= HANDLE FILE SOURCE =================
    if (req.file.buffer) {
      // 🔥 dari Flutter
      rawData = await parseCSV(req.file.buffer);
      filename = req.file.originalname || `upload_${Date.now()}.csv`;
    } else if (req.file.path) {
      // 🔥 dari Swagger / disk
      rawData = await parseCSV(req.file.path);
      filename = req.file.filename;
    } else {
      throw new Error("File tidak valid");
    }

    const cleanedData = transformData(rawData);

    // ================= GET LAST UPLOAD =================
    const lastUpload = await pool.query(`
      SELECT id FROM uploads ORDER BY created_at DESC LIMIT 1
    `);

    let carryData = [];

    if (lastUpload.rows.length) {
      const last_id = lastUpload.rows[0].id;

      const carry = await pool.query(`
        SELECT *
        FROM orders
        WHERE upload_id = $1
        AND processed_quantity < quantity
      `, [last_id]);

      carryData = carry.rows.map(row => {
        const remaining = row.quantity - row.processed_quantity;

        return {
          order_id: row.order_id,
          product_name: row.product_name,
          variation: row.variation,
          quantity: remaining,
          processed_quantity: 0,
          shipping_status: "Kirim Hari ini",
          order_status: row.order_status,
          created_time: row.created_time,
          source_upload_id: row.upload_id,
          is_carry_over: true
        };
      });
    }

    // ================= MERGE ENGINE =================
    const mergedMap = new Map();

    const buildKey = (item) => {
      const shipping = item.shipping_status;
      const variation = item.variation;

      if (item.order_id) {
        return `OID-${item.order_id}-${variation}-${shipping}`;
      }

      const name = normalizeText(item.product_name);
      return `NAME-${name}-${variation}-${shipping}`;
    };

    const insertOrMerge = (item) => {
      const key = buildKey(item);

      if (mergedMap.has(key)) {
        mergedMap.get(key).quantity += Number(item.quantity);
      } else {
        mergedMap.set(key, {
          ...item,
          quantity: Number(item.quantity),
          processed_quantity: item.processed_quantity || 0,
          is_carry_over: item.is_carry_over || false,
          source_upload_id: item.source_upload_id || null
        });
      }
    };

    // carry dulu
    carryData.forEach(insertOrMerge);

    // data baru
    cleanedData.forEach(item =>
      insertOrMerge({
        ...item,
        processed_quantity: 0,
        is_carry_over: false,
        source_upload_id: null
      })
    );

    const finalData = Array.from(mergedMap.values());

    // ================= INSERT UPLOAD =================
    const uploadResult = await pool.query(
      `INSERT INTO uploads (filename) VALUES ($1) RETURNING id`,
      [filename] // 🔥 FIX disini
    );

    const upload_id = uploadResult.rows[0].id;

    // ================= BATCH INSERT =================
    if (finalData.length > 0) {
      const values = [];
      const placeholders = [];

      finalData.forEach((item, i) => {
        const idx = i * 11;

        placeholders.push(`(
          $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4},
          $${idx + 5}, $${idx + 6}, $${idx + 7}, $${idx + 8},
          $${idx + 9}, $${idx + 10}, $${idx + 11}
        )`);

        values.push(
          upload_id,
          item.order_id,
          item.product_name,
          item.quantity,
          item.variation,
          item.created_time,
          item.order_status,
          item.shipping_status,
          item.processed_quantity,
          item.source_upload_id,
          item.is_carry_over
        );
      });

      await pool.query(`
        INSERT INTO orders
        (
          upload_id,
          order_id,
          product_name,
          quantity,
          variation,
          created_time,
          order_status,
          shipping_status,
          processed_quantity,
          source_upload_id,
          is_carry_over
        )
        VALUES ${placeholders.join(",")}
      `, values);
    }

    // ================= RESPONSE =================
    res.json({
      success: true,
      upload_id,
      total: finalData.length,
      carry_over: carryData.length,
      message: "Upload + carry SUCCESS 🚀"
    });

  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    res.status(500).json({ error: err.message });
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

    let query = `
      SELECT 
        id,
        upload_id,
        order_id,
        product_name,
        variation,
        quantity,
        COALESCE(processed_quantity, 0) as processed_quantity,
        shipping_status,
        order_status,
        created_time
      FROM orders
      WHERE upload_id = $1
      AND COALESCE(processed_quantity, 0) < quantity
    `;

    const values = [upload_id];

    // 🔥 filter variation
    if (req.query.variation) {
      values.push(req.query.variation.toUpperCase());
      query += ` AND variation = $${values.length}`;
    }

    // 🔥 filter shipping
    if (req.query.shipping_status) {
      const mapped = mapShippingToDB(req.query.shipping_status);
      values.push(mapped);
      query += ` AND shipping_status = $${values.length}`;
    }

    const result = await pool.query(query, values);

    // 🔥 format response biar FE aman
    const data = result.rows.map(row => {
      const processed = Number(row.processed_quantity) || 0;
      const total = Number(row.quantity) || 0;

      return {
        upload_id: row.upload_id,
        product_name: row.product_name,
        variation: row.variation,
        quantity: total,
        processed_quantity: processed,

        // 🔥 standard shipping
        shipping_status:
          row.shipping_status === "Kirim Hari ini" ? "today" :
            row.shipping_status === "Kirim Besok" ? "tomorrow" :
              row.shipping_status,

        order_status: row.order_status,

        // 🔥 tambahan (biar FE ga hitung)
        remaining_quantity: total - processed
      };
    });

    res.json({
      success: true,
      upload_id,
      total: data.length,
      data
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed get orders" });
  }
};

export const getGroupedOrdersCarryAware = async (req, res) => {
  try {
    let upload_id = req.query.upload_id;

    // 🔥 fallback ke latest upload
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

        COUNT(*) AS total_orders,

        SUM(quantity) AS total_quantity,
        SUM(processed_quantity) AS total_processed,

        SUM(quantity - processed_quantity) AS total_remaining,

        -- 🔥 progress berbasis quantity (bukan count)
        ROUND(
          SUM(processed_quantity) * 100.0 / NULLIF(SUM(quantity), 0),
          2
        ) AS progress,

        -- 🔥 breakdown status (quantity-based)
        SUM(
          CASE WHEN processed_quantity = 0 THEN quantity ELSE 0 END
        ) AS qty_not_started,

        SUM(
          CASE 
            WHEN processed_quantity > 0 AND processed_quantity < quantity 
            THEN quantity 
            ELSE 0 
          END
        ) AS qty_partial,

        SUM(
          CASE WHEN processed_quantity >= quantity THEN quantity ELSE 0 END
        ) AS qty_done

      FROM orders
      WHERE upload_id = $1
      GROUP BY variation, shipping_status
      ORDER BY variation ASC
    `, [upload_id]);

    const data = result.rows.map(row => ({
      variation: row.variation,
      shipping_status: row.shipping_status,

      total_orders: Number(row.total_orders),

      total_quantity: Number(row.total_quantity),
      total_processed: Number(row.total_processed),
      total_remaining: Number(row.total_remaining),

      progress: Number(row.progress),

      breakdown: {
        not_started: Number(row.qty_not_started),
        partial: Number(row.qty_partial),
        done: Number(row.qty_done)
      }
    }));

    res.json({
      success: true,
      upload_id,
      total_groups: data.length,
      data
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed grouped carry-aware" });
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
      SET 
        processed_quantity = quantity,
        status = 'done'
      WHERE upload_id = $1
      AND variation = $2
      AND shipping_status = $3
      AND processed_quantity < quantity
    `, [
      upload_id,
      variation.toUpperCase(),
      mapShippingToDB(shipping_status)
    ]);

    return res.json({
      success: true,
      updated: result.rowCount
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "complete failed" });
  }
};

// COMPLETE PARTIAL
export const completePartial = async (req, res) => {
  try {
    let { upload_id, variation, shipping_status, quantity } = req.body;

    let remaining = parseInt(quantity);

    if (!remaining || remaining <= 0) {
      return res.status(400).json({ error: "Invalid quantity" });
    }

    if (!upload_id) {
      const latest = await pool.query(`
        SELECT id FROM uploads ORDER BY created_at DESC LIMIT 1
      `);

      if (!latest.rows.length) {
        return res.status(404).json({ error: "No upload found" });
      }

      upload_id = latest.rows[0].id;
    }

    const result = await pool.query(`
      SELECT *
      FROM orders
      WHERE upload_id = $1
      AND variation = $2
      AND shipping_status = $3
      AND processed_quantity < quantity
      ORDER BY id ASC
    `, [
      upload_id,
      variation.toUpperCase(),
      mapShippingToDB(shipping_status)
    ]);

    const rows = result.rows;

    let processed = 0;

    for (const row of rows) {
      if (remaining <= 0) break;

      const available = row.quantity - row.processed_quantity;
      if (available <= 0) continue;

      const take = Math.min(available, remaining);

      await pool.query(`
        UPDATE orders
        SET 
          processed_quantity = processed_quantity + $1,
          status = CASE 
            WHEN processed_quantity + $1 >= quantity THEN 'done'
            WHEN processed_quantity + $1 > 0 THEN 'partial'
            ELSE 'pending'
          END
        WHERE id = $2
      `, [take, row.id]);

      remaining -= take;
      processed += take;
    }

    return res.json({
      success: true,
      requested: quantity,
      processed,
      remaining
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "partial complete failed" });
  }
};

// HISTORY (ALL UPLOADS)
export const getHistoryOrders = async (req, res) => {
  try {
    let query = `
      SELECT 
        variation,
        shipping_status,

        SUM(quantity) as total_quantity,
        SUM(processed_quantity) as total_processed,
        SUM(quantity - processed_quantity) as total_remaining

      FROM orders
      WHERE processed_quantity > 0
    `;

    const values = [];

    if (req.query.status === "done") {
      query += ` AND processed_quantity >= quantity`;
    }

    if (req.query.status === "partial") {
      query += ` AND processed_quantity > 0 AND processed_quantity < quantity`;
    }

    if (req.query.variation) {
      values.push(req.query.variation.toUpperCase());
      query += ` AND variation = $${values.length}`;
    }

    if (req.query.shipping_status) {
      values.push(mapShippingToDB(req.query.shipping_status));
      query += ` AND shipping_status = $${values.length}`;
    }

    query += `
      GROUP BY variation, shipping_status
      ORDER BY total_processed DESC
    `;

    const result = await pool.query(query, values);

    const data = result.rows.map(row => ({
      variation: row.variation,

      shipping_status:
        row.shipping_status === "Kirim Hari ini" ? "today" :
          row.shipping_status === "Kirim Besok" ? "tomorrow" :
            row.shipping_status,

      total_quantity: Number(row.total_quantity),
      total_processed: Number(row.total_processed),
      total_remaining: Number(row.total_remaining),

      progress:
        row.total_quantity == 0
          ? 0
          : Number(row.total_processed) / Number(row.total_quantity),

      state:
        row.total_processed >= row.total_quantity ? "done" : "partial"
    }));

    res.json({
      success: true,
      total: data.length,
      data
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed get history" });
  }
};

// SUMMARY (LATEST UPLOAD)
export const getUploadSummary = async (req, res) => {
  try {
    const latest = await pool.query(`
      SELECT id FROM uploads ORDER BY created_at DESC LIMIT 1
    `);

    if (!latest.rows.length) {
      return res.json({
        success: true,
        message: "Belum ada upload",
        data: []
      });
    }

    const upload_id = latest.rows[0].id;

    const result = await pool.query(`
      SELECT 
        variation,
        SUM(quantity - processed_quantity) as remaining
      FROM orders
      WHERE upload_id = $1
      AND processed_quantity < quantity
      GROUP BY variation
      ORDER BY variation ASC
    `, [upload_id]);

    res.json({
      success: true,
      upload_id,
      total_variants: result.rows.length,
      data: result.rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "summary failed" });
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
      SET 
        status = 'pending',
        processed_quantity = 0
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