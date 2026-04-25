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

      quantity INTEGER NOT NULL DEFAULT 0,
      processed_quantity INTEGER NOT NULL DEFAULT 0,

      variation TEXT,
      created_time TEXT,
      order_status TEXT,
      shipping_status TEXT,

      status TEXT,

      -- 🔥 carry system
      source_upload_id INTEGER,
      is_carry_over BOOLEAN DEFAULT FALSE
    );
  `);

  await pool.query(`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS source_upload_id INTEGER;
  `);

  await pool.query(`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS is_carry_over BOOLEAN DEFAULT FALSE;
  `);

  await pool.query(`
    ALTER TABLE orders
    ALTER COLUMN processed_quantity SET DEFAULT 0;
  `);


  await pool.query(`
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'chk_quantity'
    ) THEN
      ALTER TABLE orders
      ADD CONSTRAINT chk_quantity CHECK (quantity >= 0);
    END IF;
  END
  $$;
  `);

  await pool.query(`
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'chk_processed'
    ) THEN
      ALTER TABLE orders
      ADD CONSTRAINT chk_processed CHECK (processed_quantity >= 0);
    END IF;
  END
  $$;
  `);

  await pool.query(`
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'chk_processed_not_exceed'
    ) THEN
      ALTER TABLE orders
      ADD CONSTRAINT chk_processed_not_exceed 
      CHECK (processed_quantity <= quantity);
    END IF;
  END
  $$;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_orders_upload 
    ON orders(upload_id);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_orders_lookup 
    ON orders(upload_id, variation, shipping_status);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_orders_progress
    ON orders(upload_id, processed_quantity);
  `);
};