export const createTable = async (db) => {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT,
      product_name TEXT,
      quantity INTEGER,
      variation TEXT,
      created_time TEXT,
      order_status TEXT,
      shipping_status TEXT,
      status TEXT DEFAULT 'pending'
    )
  `);
};