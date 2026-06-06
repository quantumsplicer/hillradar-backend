require('dotenv').config();
const { Pool } = require('pg');

const isProduction = process.env.NODE_ENV === 'production';

// Supabase (production) supplies DATABASE_URL.
// Local dev uses individual DB_* vars from .env.
const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
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
