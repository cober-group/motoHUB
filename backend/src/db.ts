import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('railway') || process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
});

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS stores (
      id        SERIAL PRIMARY KEY,
      name      VARCHAR(255) NOT NULL,
      sqm       INTEGER DEFAULT 150,
      odoo_location_id INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      email         VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role          VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'store')),
      store_id      INTEGER REFERENCES stores(id) ON DELETE SET NULL,
      created_at    TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS layouts (
      id         SERIAL PRIMARY KEY,
      store_id   INTEGER REFERENCES stores(id) ON DELETE CASCADE UNIQUE,
      items      JSONB DEFAULT '[]',
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id           SERIAL PRIMARY KEY,
      store_id     INTEGER REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
      sender_role  VARCHAR(10) NOT NULL CHECK (sender_role IN ('admin', 'store')),
      sender_email VARCHAR(255),
      content      TEXT NOT NULL,
      read_at      TIMESTAMP,
      created_at   TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_messages_store ON messages(store_id, created_at DESC);
  `);

  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_editor BOOLEAN DEFAULT false;
  `);

  // Safe migrations for new columns
  await pool.query(`
    ALTER TABLE layouts ADD COLUMN IF NOT EXISTS width_m NUMERIC DEFAULT 15;
    ALTER TABLE layouts ADD COLUMN IF NOT EXISTS depth_m NUMERIC DEFAULT 10;
  `);

  // Seed default admin if not exists
  const { rows } = await pool.query(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`);
  if (rows.length === 0) {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10);
    await pool.query(
      `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'admin')`,
      [process.env.ADMIN_EMAIL || 'admin@motohub.it', hash]
    );
    console.log('[DB] Admin di default creato: admin@motohub.it / admin123');
  }

  console.log('[DB] Schema inizializzato.');
}
