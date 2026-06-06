require('dotenv').config();
const { Pool } = require('pg');

const isProduction = process.env.NODE_ENV === 'production';

// Supabase (production) supplies DATABASE_URL.
// Local dev uses individual DB_* vars from .env.
// Append sslmode=require if not already in the URL (needed for Supabase pooler)
function buildConnectionString(url) {
  if (!url) return null;
  return url.includes('sslmode') ? url : `${url}?sslmode=require`;
}

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: buildConnectionString(process.env.DATABASE_URL),
        ssl: { rejectUnauthorized: false },
        // Force IPv4 — Render free tier has no IPv6
        family: 4,
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
