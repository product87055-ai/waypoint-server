require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { pool, initSchema } = require('./db');

const app = express();
app.use(cors());
app.use(express.json({ limit: '8mb' })); // generous limit so a small itinerary photo still fits

// ---------- Users ----------
app.post('/api/login', async (req, res) => {
  const { name, password } = req.body;
  if (!name || !password) return res.status(400).json({ error: 'Name and password required.' });
  const clean = name.trim().toLowerCase();
  const { rows } = await pool.query('SELECT * FROM users WHERE name = $1', [clean]);
  const user = rows[0];
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Name or password not recognized.' });
  }
  res.json({ name: user.name, role: user.role });
});

app.get('/api/users', async (req, res) => {
  const { rows } = await pool.query('SELECT name, password, role FROM users ORDER BY name');
  res.json(rows);
});

app.post('/api/users', async (req, res) => {
  const { name, password, role } = req.body;
  if (!name || !password) return res.status(400).json({ error: 'Name and password required.' });
  const clean = name.trim().toLowerCase();
  try {
    await pool.query(
      'INSERT INTO users (name, password, role) VALUES ($1, $2, $3)',
      [clean, password, role || 'member']
    );
    res.json({ ok: true });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'That name is already taken.' });
    console.error(e);
    res.status(500).json({ error: 'Server error.' });
  }
});

app.delete('/api/users/:name', async (req, res) => {
  await pool.query('DELETE FROM users WHERE name = $1', [req.params.name.toLowerCase()]);
  res.json({ ok: true });
});

// ---------- Itinerary ----------
app.get('/api/itinerary', async (req, res) => {
  const { rows } = await pool.query('SELECT days FROM itinerary WHERE id = 1');
  res.json(rows[0]?.days || []);
});

app.put('/api/itinerary', async (req, res) => {
  const days = req.body.days || [];
  await pool.query('UPDATE itinerary SET days = $1 WHERE id = 1', [JSON.stringify(days)]);
  res.json({ ok: true });
});

// ---------- Safety zone ----------
app.get('/api/safety', async (req, res) => {
  const { rows } = await pool.query('SELECT center, radius FROM safety WHERE id = 1');
  res.json(rows[0] || { center: null, radius: 500 });
});

app.put('/api/safety', async (req, res) => {
  const { center, radius } = req.body;
  await pool.query('UPDATE safety SET center = $1, radius = $2 WHERE id = 1', [
    center ? JSON.stringify(center) : null,
    radius || 500,
  ]);
  res.json({ ok: true });
});

// ---------- Live locations ----------
app.get('/api/locations', async (req, res) => {
  const { rows } = await pool.query('SELECT name, lat, lng, ts FROM locations');
  const out = {};
  rows.forEach((r) => (out[r.name] = { lat: r.lat, lng: r.lng, ts: Number(r.ts) }));
  res.json(out);
});

app.put('/api/locations/:name', async (req, res) => {
  const { lat, lng } = req.body;
  const name = req.params.name.toLowerCase();
  await pool.query(
    `INSERT INTO locations (name, lat, lng, ts) VALUES ($1, $2, $3, $4)
     ON CONFLICT (name) DO UPDATE SET lat = $2, lng = $3, ts = $4`,
    [name, lat, lng, Date.now()]
  );
  res.json({ ok: true });
});

// ---------- Serve the front-end ----------
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
initSchema()
  .then(() => {
    app.listen(PORT, () => console.log(`Waypoint server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to set up database schema:', err);
    process.exit(1);
  });

