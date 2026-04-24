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
      status TEXT,
      original_quantity INT,
      processed_quantity INT DEFAULT 0
    );
  `);

  // 🔥 constraints safe
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
};