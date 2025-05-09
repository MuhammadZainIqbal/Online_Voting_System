/**
 * Complete Database Setup Script
 * This script sets up the entire database for the online voting system using a consolidated SQL file
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Create a connection to the database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function setupDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('Starting complete database setup...');
    
    // Read the consolidated SQL file
    const sqlFilePath = path.join(__dirname, 'src', 'database', 'setup-complete.sql');
    const sqlScript = fs.readFileSync(sqlFilePath, 'utf8');
    
    // Execute SQL script
    await client.query(sqlScript);
    
    console.log('Database setup completed successfully!');
    console.log('All tables, indexes, and initial data have been created.');
  } catch (err) {
    console.error('Error setting up database:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the database setup function
setupDatabase();