const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('azure')
    ? { rejectUnauthorized: false }
    : (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('sslmode=require')
      ? { rejectUnauthorized: false }
      : false),
  max: 20,
  idleTimeoutMillis: 30000,
});

module.exports = pool;
