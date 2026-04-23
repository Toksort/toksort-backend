import sqlite3 from "sqlite3";
import { open } from "sqlite";

export const initDB = async () => {
  const db = await open({
    filename: "./src/db/database.sqlite",
    driver: sqlite3.Database,
  });

  // 🔥 bikin table kalau belum ada
  await db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT,
      product_name TEXT,
      variation TEXT,
      quantity INTEGER,
      created_time TEXT,
      shipping_status TEXT,
      order_status TEXT,
      status TEXT DEFAULT 'pending',
      filename TEXT
    )
  `);

  return db;
};