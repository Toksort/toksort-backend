import { pool } from "../config/db.js";

export const createTable = async () => {
  // 🔥 uploads table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS uploads (
      id SERIAL PRIMARY KEY,
      filename TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 🔥 orders table
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
      status TEXT,
      CONSTRAINT fk_upload
        FOREIGN KEY(upload_id)
        REFERENCES uploads(id)
        ON DELETE CASCADE
    );
  `);

  // 🔥 add column kalau belum ada (safe)
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='orders' AND column_name='upload_id'
      ) THEN
        ALTER TABLE orders ADD COLUMN upload_id INTEGER;
      END IF;
    END
    $$;
  `);
};