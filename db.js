require('dotenv').config();
const { Pool } = require('pg');

const isProduction = process.env.NODE_ENV === 'production';

// Supabase (production) supplies DATABASE_URL.
// Local dev uses individual DB_* vars from .env.
// Strip any sslmode param from the URL — we control SSL via the Pool config below
function stripSslMode(url) {
  if (!url) return url;
  return url.replace(/[?&]sslmode=[^&]*/g, '').replace(/[?&]$/, '');
}

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: stripSslMode(process.env.DATABASE_URL),
        ssl: { rejectUnauthorized: false },
        family: 4,  // Force IPv4 — Render free tier has no IPv6
      }
    : {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl: false,
      }
);

module.exports = pool;
