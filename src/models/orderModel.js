import { pool } from "../config/db.js";

export const createTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS uploads (
      id SERIAL PRIMARY KEY,
      filename TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      upload_id INTEGER,
      order_id TEXT,
      product_name TEXT,
      quantity INTEGER,
      variation TEXT,
      created_time TEXT,
      order_status TEXT,
      shipping_status TEXT,
      status TEXT
    );
  `);
};