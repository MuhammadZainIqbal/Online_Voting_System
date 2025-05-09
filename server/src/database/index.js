const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

// Create a connection pool to the PostgreSQL database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for some hosted PostgreSQL services like Neon
  },
  // Add connection pool settings to prevent timeouts
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection could not be established
  maxUses: 7500 // Close and replace a connection after it has been used 7500 times
});

// Add error handler for unexpected pool errors
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
});

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    return console.error('Error acquiring client', err.stack);
  }
  console.log('Connected to PostgreSQL database');
  release();
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};