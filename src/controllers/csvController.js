import fs from "fs";
import path from "path";
import { parseCSV } from "../utils/csvParser.js";
import { fileURLToPath } from "url";
import { pool } from "../config/db.js";
import { createTable } from "../models/orderModel.js";
import { normalizeOrder } from "../utils/normalization/normalizeOrder.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ================= HELPERS =================

const normalizeText = (text) => {
  if (!text) return "";
  return text.toString().toLowerCase().trim().replace(/\s+/g, " ");
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
    shipping_status: hour < 12 ? "Kirim Hari ini" : "Kirim Besok",
  };
};

const getFileBuffer = (file) => {
  if (file.buffer) return file.buffer;
  if (file.path) return fs.readFileSync(file.path);
  throw new Error("File tidak valid");
};

const HEADER_MAP = {
  order_id: ["order id", "order_id", "id pesanan"],
  product_name: ["product name", "product_name", "produk", "nama produk"],
  quantity: ["quantity", "qty", "jumlah", "sku quantity"],
  variation: ["variation", "variasi", "size"],
  created_time: ["created time", "created_at", "tanggal"],
};

const pickField = (row, keys) => {
  for (const key of keys) {
    if (row[key]) return row[key];
  }

  return null;
};

const parseQty = (val) => {
  if (!val) return 0;
  return parseInt(val.toString().replace(/[^0-9]/g, "")) || 0;
};

// ================= TRANSFORM =================

const transformData = (rawData) => {
  const result = [];

  rawData.forEach((row, index) => {
    const order_id = pickField(row, HEADER_MAP.order_id);
    const product_name = pickField(row, HEADER_MAP.product_name);
    const quantityRaw = pickField(row, HEADER_MAP.quantity);
    const raw_variation = pickField(row, HEADER_MAP.variation);
    const created_time = pickField(row, HEADER_MAP.created_time);

    const quantity = parseQty(quantityRaw);

    const rawItem = {
      order_id,
      product_name,
      quantity,
      variation: raw_variation,
      created_time,
      ...getStatusFromTime(created_time),
      status: "pending",
    };

    const item = normalizeOrder(rawItem);

    if (!item.product_name) {
      console.log(`❌ DROP row ${index}: no product_name`);
      return;
    }

    if (item.quantity <= 0) {
      console.log(`❌ DROP row ${index}: invalid quantity`);
      return;
    }

    result.push(item);
  });

  return result;
};

// ================= KEY =================

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
  let rawData = [];
  let cleanedData = [];
  let finalData = [];

  try {
    await createTable();

    if (!req.file) {
      return res.status(400).json({ error: "File wajib diisi" });
    }

    const buffer = getFileBuffer(req.file);
    rawData = await parseCSV(buffer);

    if (!rawData.length) {
      return res.status(400).json({
        success: false,
        message: "CSV kosong / tidak terbaca",
      });
    }

    cleanedData = transformData(rawData);

    if (!cleanedData.length) {
      return res.status(400).json({
        success: false,
        message: "Semua data tidak valid",
      });
    }

    console.log("RAW:", rawData.length);
    console.log("CLEAN:", cleanedData.length);

    const lastUpload = await pool.query(`
      SELECT id FROM uploads ORDER BY created_at DESC LIMIT 1
    `);

    let carryData = [];

    if (lastUpload.rows.length) {
      const last_id = lastUpload.rows[0].id;

      const carry = await pool.query(
        `
        SELECT * FROM orders
        WHERE upload_id = $1
        AND processed_quantity < quantity
        `,
        [last_id]
      );

      carryData = carry.rows.map((row) => {
        const rawCarryItem = {
          order_id: row.order_id,
          product_name:
            row.raw_product_name ||
            row.normalized_product_name ||
            row.product_name,

          variation:
            row.raw_variation ||
            row.normalized_variation ||
            row.variation,

          quantity: row.quantity - row.processed_quantity,
          processed_quantity: 0,
          shipping_status: "Kirim Hari ini",
          order_status: row.order_status,
          created_time: row.created_time,
          source_upload_id: row.upload_id,
          is_carry_over: true,
          status: "pending",
        };

        return normalizeOrder(rawCarryItem);
      });
    }

    const mergedMap = new Map();

    const insertOrMerge = (item) => {
      const key = buildKey(item);

      if (mergedMap.has(key)) {
        mergedMap.get(key).quantity += item.quantity;
      } else {
        mergedMap.set(key, item);
      }
    };

    carryData.forEach(insertOrMerge);

    cleanedData.forEach((item) =>
      insertOrMerge({
        ...item,
        processed_quantity: 0,
        is_carry_over: false,
        source_upload_id: null,
        status: item.status || "pending",
      })
    );

    finalData = Array.from(mergedMap.values());

    if (!finalData.length) {
      return res.status(400).json({
        success: false,
        message: "Tidak ada data untuk disimpan",
      });
    }

    const uploadResult = await pool.query(
      `INSERT INTO uploads (filename) VALUES ($1) RETURNING id`,
      [req.file.originalname || "upload.csv"]
    );

    const upload_id = uploadResult.rows[0].id;

    const values = [];
    const placeholders = [];

    finalData.forEach((item, i) => {
      const idx = i * 20;

      placeholders.push(`(
        $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5},
        $${idx + 6}, $${idx + 7}, $${idx + 8}, $${idx + 9}, $${idx + 10},
        $${idx + 11}, $${idx + 12}, $${idx + 13}, $${idx + 14}, $${idx + 15},
        $${idx + 16}, $${idx + 17}, $${idx + 18}, $${idx + 19}, $${idx + 20}
      )`);

      values.push(
        upload_id,
        item.order_id,

        item.raw_product_name || item.product_name,
        item.product_name,
        item.normalized_product_name || item.product_name,

        item.raw_variation || item.variation,
        item.variation,
        item.normalized_variation || item.variation,
        item.variation_type || "UNKNOWN",
        item.size_series || null,
        item.dimension || null,
        item.special_category || null,

        item.quantity,
        item.processed_quantity || 0,

        item.created_time,
        item.order_status,
        item.shipping_status,
        item.status || "pending",

        item.source_upload_id || null,
        item.is_carry_over || false
      );
    });

    await pool.query(
      `
      INSERT INTO orders
      (
        upload_id,
        order_id,

        raw_product_name,
        product_name,
        normalized_product_name,

        raw_variation,
        variation,
        normalized_variation,
        variation_type,
        size_series,
        dimension,
        special_category,

        quantity,
        processed_quantity,

        created_time,
        order_status,
        shipping_status,
        status,

        source_upload_id,
        is_carry_over
      )
      VALUES ${placeholders.join(",")}
      `,
      values
    );

    return res.json({
      success: true,
      upload_id,
      total: finalData.length,
      carry_over: carryData.length,
      debug: {
        raw: rawData.length,
        cleaned: cleanedData.length,
        final: finalData.length,
      },
    });
  } catch (err) {
    console.error("UPLOAD ERROR:", err);

    return res.status(500).json({
      success: false,
      error: err.message,
      debug: {
        raw: rawData?.length,
        cleaned: cleanedData?.length,
        final: finalData?.length,
      },
    });
  }
};

// ================= GET ORDERS =================

export const getOrders = async (req, res) => {
  try {
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
        COALESCE(processed_quantity, 0) AS processed_quantity,
        shipping_status,
        order_status,
        created_time
      FROM orders
      WHERE upload_id = $1
      AND COALESCE(processed_quantity, 0) < quantity
    `;

    const values = [upload_id];

    if (req.query.variation) {
      values.push(req.query.variation.toUpperCase());
      query += ` AND variation = $${values.length}`;
    }

    if (req.query.shipping_status) {
      const mapped = mapShippingToDB(req.query.shipping_status);
      values.push(mapped);
      query += ` AND shipping_status = $${values.length}`;
    }

    const result = await pool.query(query, values);

    const data = result.rows.map((row) => {
      const processed = Number(row.processed_quantity) || 0;
      const total = Number(row.quantity) || 0;

      return {
        upload_id: row.upload_id,
        product_name: row.product_name,
        variation: row.variation,
        quantity: total,
        processed_quantity: processed,
        shipping_status:
          row.shipping_status === "Kirim Hari ini"
            ? "today"
            : row.shipping_status === "Kirim Besok"
              ? "tomorrow"
              : row.shipping_status,
        order_status: row.order_status,
        remaining_quantity: total - processed,
      };
    });

    return res.json({
      success: true,
      upload_id,
      total: data.length,
      data,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "failed get orders" });
  }
};

// ================= GROUPED ORDERS =================

export const getGroupedOrdersCarryAware = async (req, res) => {
  try {
    let upload_id = req.query.upload_id;

    if (!upload_id) {
      const latest = await pool.query(`
        SELECT id FROM uploads ORDER BY created_at DESC LIMIT 1
      `);

      if (!latest.rows.length) {
        return res.json({ success: true, data: [] });
      }

      upload_id = latest.rows[0].id;
    }

    const result = await pool.query(
      `
      SELECT 
        variation,
        shipping_status,
        COUNT(*) AS total_orders,
        SUM(quantity) AS total_quantity,
        SUM(processed_quantity) AS total_processed,
        SUM(quantity - processed_quantity) AS total_remaining,
        ROUND(
          SUM(processed_quantity) * 100.0 / NULLIF(SUM(quantity), 0),
          2
        ) AS progress,
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
    `,
      [upload_id]
    );

    const data = result.rows.map((row) => ({
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
        done: Number(row.qty_done),
      },
    }));

    return res.json({
      success: true,
      upload_id,
      total_groups: data.length,
      data,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "failed grouped carry-aware" });
  }
};

// ================= GROUPED ORDERS BY SIZE =================

export const getOrdersBySize = async (req, res) => {
  try {
    let upload_id = req.query.upload_id;

    if (!upload_id) {
      const latest = await pool.query(`
        SELECT id FROM uploads ORDER BY created_at DESC LIMIT 1
      `);

      if (!latest.rows.length) {
        return res.json({
          success: true,
          data: [],
        });
      }

      upload_id = latest.rows[0].id;
    }

    const result = await pool.query(
      `
      SELECT
        size_series,
        dimension,
        shipping_status,

        COUNT(*) AS total_orders,
        SUM(quantity) AS total_quantity,
        SUM(processed_quantity) AS total_processed,
        SUM(quantity - processed_quantity) AS total_remaining,

        ROUND(
          SUM(processed_quantity) * 100.0 / NULLIF(SUM(quantity), 0),
          2
        ) AS progress

      FROM orders
      WHERE upload_id = $1
      AND variation_type = 'A_SERIES'
      AND size_series IS NOT NULL
      AND dimension IS NOT NULL
      AND size_series ~ '^A([2-9]|1[0-9]|20)$'
      GROUP BY size_series, dimension, shipping_status
      ORDER BY
        CAST(SUBSTRING(size_series FROM 2) AS INTEGER) ASC,
        dimension ASC,
        shipping_status ASC
      `,
      [upload_id]
    );

    const grouped = {};

    result.rows.forEach((row) => {
      const sizeSeries = row.size_series;
      const dimension = row.dimension;

      if (!grouped[sizeSeries]) {
        grouped[sizeSeries] = {
          size_series: sizeSeries,
          dimensions: [],
        };
      }

      let dimensionGroup = grouped[sizeSeries].dimensions.find(
        (item) => item.dimension === dimension
      );

      if (!dimensionGroup) {
        dimensionGroup = {
          dimension,
          shipping: [],
        };

        grouped[sizeSeries].dimensions.push(dimensionGroup);
      }

      dimensionGroup.shipping.push({
        shipping_status:
          row.shipping_status === "Kirim Hari ini"
            ? "today"
            : row.shipping_status === "Kirim Besok"
              ? "tomorrow"
              : row.shipping_status,

        total_orders: Number(row.total_orders),
        total_quantity: Number(row.total_quantity),
        total_processed: Number(row.total_processed),
        total_remaining: Number(row.total_remaining),
        progress: Number(row.progress) || 0,
      });
    });

    return res.json({
      success: true,
      upload_id: Number(upload_id),
      total_series: Object.keys(grouped).length,
      data: Object.values(grouped),
    });
  } catch (err) {
    console.error("GET ORDERS BY SIZE ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "failed get orders by size",
      error: err.message,
    });
  }
};

// ================= COMPLETE GROUP =================

export const completeGroup = async (req, res) => {
  try {
    let { upload_id, variation, shipping_status } = req.body;

    if (!variation || !shipping_status) {
      return res.status(400).json({
        success: false,
        message: "variation & shipping_status wajib diisi",
      });
    }

    if (!upload_id) {
      const latest = await pool.query(`
        SELECT id FROM uploads ORDER BY created_at DESC LIMIT 1
      `);

      if (!latest.rows.length) {
        return res.status(404).json({
          success: false,
          message: "Tidak ada data upload",
        });
      }

      upload_id = latest.rows[0].id;
    }

    const result = await pool.query(
      `
      UPDATE orders
      SET 
        processed_quantity = quantity,
        status = 'done'
      WHERE upload_id = $1
      AND variation = $2
      AND shipping_status = $3
      AND processed_quantity < quantity
    `,
      [upload_id, variation.toUpperCase(), mapShippingToDB(shipping_status)]
    );

    return res.json({
      success: true,
      updated: result.rowCount,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "complete failed" });
  }
};

// ================= COMPLETE PARTIAL =================

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

    const result = await pool.query(
      `
      SELECT *
      FROM orders
      WHERE upload_id = $1
      AND variation = $2
      AND shipping_status = $3
      AND processed_quantity < quantity
      ORDER BY id ASC
    `,
      [upload_id, variation.toUpperCase(), mapShippingToDB(shipping_status)]
    );

    const rows = result.rows;

    let processed = 0;

    for (const row of rows) {
      if (remaining <= 0) break;

      const available = row.quantity - row.processed_quantity;
      if (available <= 0) continue;

      const take = Math.min(available, remaining);

      await pool.query(
        `
        UPDATE orders
        SET 
          processed_quantity = processed_quantity + $1,
          status = CASE 
            WHEN processed_quantity + $1 >= quantity THEN 'done'
            WHEN processed_quantity + $1 > 0 THEN 'partial'
            ELSE 'pending'
          END
        WHERE id = $2
      `,
        [take, row.id]
      );

      remaining -= take;
      processed += take;
    }

    return res.json({
      success: true,
      requested: quantity,
      processed,
      remaining,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "partial complete failed" });
  }
};

// ================= HISTORY =================

export const getHistoryOrders = async (req, res) => {
  try {
    let query = `
      SELECT 
        variation,
        shipping_status,
        SUM(quantity) AS total_quantity,
        SUM(processed_quantity) AS total_processed,
        SUM(quantity - processed_quantity) AS total_remaining
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

    const data = result.rows.map((row) => ({
      variation: row.variation,
      shipping_status:
        row.shipping_status === "Kirim Hari ini"
          ? "today"
          : row.shipping_status === "Kirim Besok"
            ? "tomorrow"
            : row.shipping_status,
      total_quantity: Number(row.total_quantity),
      total_processed: Number(row.total_processed),
      total_remaining: Number(row.total_remaining),
      progress:
        row.total_quantity == 0
          ? 0
          : Number(row.total_processed) / Number(row.total_quantity),
      state: row.total_processed >= row.total_quantity ? "done" : "partial",
    }));

    return res.json({
      success: true,
      total: data.length,
      data,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "failed get history" });
  }
};

// ================= SUMMARY =================

export const getUploadSummary = async (req, res) => {
  try {
    const latest = await pool.query(`
      SELECT id FROM uploads ORDER BY created_at DESC LIMIT 1
    `);

    if (!latest.rows.length) {
      return res.json({
        success: true,
        message: "Belum ada upload",
        data: [],
      });
    }

    const upload_id = latest.rows[0].id;

    const result = await pool.query(
      `
      SELECT 
        variation,
        SUM(quantity - processed_quantity) AS remaining
      FROM orders
      WHERE upload_id = $1
      AND processed_quantity < quantity
      GROUP BY variation
      ORDER BY variation ASC
    `,
      [upload_id]
    );

    return res.json({
      success: true,
      upload_id,
      total_variants: result.rows.length,
      data: result.rows,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "summary failed" });
  }
};

// ================= UNDO COMPLETE GROUP =================

export const undoCompleteGroup = async (req, res) => {
  try {
    const { upload_id, variation, shipping_status } = req.body;

    if (!upload_id || !variation || !shipping_status) {
      return res.status(400).json({
        success: false,
        message: "upload_id, variation, shipping_status wajib diisi",
      });
    }

    const result = await pool.query(
      `
      UPDATE orders
      SET 
        status = 'pending',
        processed_quantity = 0
      WHERE upload_id = $1
      AND variation = $2
      AND shipping_status = $3
      AND status = 'done'
    `,
      [upload_id, variation.toUpperCase(), mapShippingToDB(shipping_status)]
    );

    return res.json({
      success: true,
      updated: result.rowCount,
      message: "Undo complete berhasil",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Undo failed",
    });
  }
};