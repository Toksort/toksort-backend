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

      upload_id INTEGER REFERENCES uploads(id) ON DELETE CASCADE,

      order_id TEXT,

      -- raw data
      raw_product_name TEXT,
      raw_variation TEXT,

      -- normalized data
      product_name TEXT,
      normalized_product_name TEXT,
      variation TEXT,
      normalized_variation TEXT,
      variation_type TEXT,
      size_series TEXT,
      dimension TEXT,
      special_category TEXT,

      quantity INTEGER NOT NULL DEFAULT 0,
      processed_quantity INTEGER NOT NULL DEFAULT 0,

      created_time TEXT,
      order_status TEXT,
      shipping_status TEXT,

      status TEXT DEFAULT 'pending',

      -- carry system
      source_upload_id INTEGER,
      is_carry_over BOOLEAN DEFAULT FALSE,

      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const columns = [
    `ADD COLUMN IF NOT EXISTS raw_product_name TEXT`,
    `ADD COLUMN IF NOT EXISTS raw_variation TEXT`,
    `ADD COLUMN IF NOT EXISTS normalized_product_name TEXT`,
    `ADD COLUMN IF NOT EXISTS normalized_variation TEXT`,
    `ADD COLUMN IF NOT EXISTS variation_type TEXT`,
    `ADD COLUMN IF NOT EXISTS size_series TEXT`,
    `ADD COLUMN IF NOT EXISTS dimension TEXT`,
    `ADD COLUMN IF NOT EXISTS special_category TEXT`,
    `ADD COLUMN IF NOT EXISTS source_upload_id INTEGER`,
    `ADD COLUMN IF NOT EXISTS is_carry_over BOOLEAN DEFAULT FALSE`,
    `ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`
  ];

  for (const column of columns) {
    await pool.query(`
      ALTER TABLE orders
      ${column};
    `);
  }

  await pool.query(`
    ALTER TABLE orders
    ALTER COLUMN processed_quantity SET DEFAULT 0;
  `);

  await pool.query(`
    ALTER TABLE orders
    ALTER COLUMN quantity SET DEFAULT 0;
  `);

  await pool.query(`
    ALTER TABLE orders
    ALTER COLUMN status SET DEFAULT 'pending';
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
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_variation_type'
      ) THEN
        ALTER TABLE orders
        ADD CONSTRAINT chk_variation_type
        CHECK (
          variation_type IS NULL OR variation_type IN (
            'A_SERIES',
            'DIMENSION',
            'QUANTITY',
            'RATIO',
            'SPECIAL',
            'UNKNOWN'
          )
        );
      END IF;
    END
    $$;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_uploads_created_at
    ON uploads(created_at);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_orders_upload
    ON orders(upload_id);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_orders_upload_variation_type
    ON orders(upload_id, variation_type);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_orders_upload_normalized_variation
    ON orders(upload_id, normalized_variation);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_orders_upload_shipping_status
    ON orders(upload_id, shipping_status);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_orders_upload_size_series
    ON orders(upload_id, size_series);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_orders_upload_processed_quantity
    ON orders(upload_id, processed_quantity);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_orders_lookup
    ON orders(upload_id, variation, shipping_status);
  `);
};