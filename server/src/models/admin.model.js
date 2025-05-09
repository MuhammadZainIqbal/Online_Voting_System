const db = require('../database');
const bcrypt = require('bcrypt');

const adminModel = {
  // Create a new admin
  async create(cnic, email, password) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const query = `
      INSERT INTO admin (cnic, email, password_hash)
      VALUES ($1, $2, $3)
      RETURNING cnic, email
    `;
    const values = [cnic, email, hashedPassword];
    const result = await db.query(query, values);
    return result.rows[0];
  },

  // Find admin by CNIC
  async findByCNIC(cnic) {
    const query = 'SELECT * FROM admin WHERE cnic = $1';
    const result = await db.query(query, [cnic]);
    return result.rows[0];
  },

  // Find admin by email
  async findByEmail(email) {
    const query = 'SELECT * FROM admin WHERE email = $1';
    const result = await db.query(query, [email]);
    return result.rows[0];
  },

  // Update admin's password
  async updatePassword(cnic, newPassword) {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const query = 'UPDATE admin SET password_hash = $1 WHERE cnic = $2 RETURNING cnic, email';
    const result = await db.query(query, [hashedPassword, cnic]);
    return result.rows[0];
  }
};

module.exports = adminModel;