
const { Pool } = require('pg');

// Render gives you a DATABASE_URL automatically when you attach a Postgres
// database to this web service (see README step 3). Locally, put the same
// variable in a .env file.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render.com')
    ? { rejectUnauthorized: false }
    : false,
});

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      name TEXT PRIMARY KEY,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member'
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS itinerary (
      id INT PRIMARY KEY DEFAULT 1,
      days JSONB NOT NULL DEFAULT '[]'::jsonb
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS safety (
      id INT PRIMARY KEY DEFAULT 1,
      center JSONB,
      radius INT NOT NULL DEFAULT 500
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS locations (
      name TEXT PRIMARY KEY,
      lat DOUBLE PRECISION NOT NULL,
      lng DOUBLE PRECISION NOT NULL,
      ts BIGINT NOT NULL
    );
  `);

  // Seed the default admin account if it doesn't exist yet.
  await pool.query(
    `INSERT INTO users (name, password, role) VALUES ('harry', 'Harry1234', 'admin')
     ON CONFLICT (name) DO NOTHING;`
  );
  // Seed a single empty itinerary/safety row so later UPDATEs have something to hit.
  await pool.query(`INSERT INTO itinerary (id, days) VALUES (1, '[]') ON CONFLICT (id) DO NOTHING;`);
  await pool.query(`INSERT INTO safety (id, center, radius) VALUES (1, NULL, 500) ON CONFLICT (id) DO NOTHING;`);
}

module.exports = { pool, initSchema };
