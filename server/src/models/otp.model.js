const db = require('../database');
const crypto = require('crypto');

const otpModel = {
  // Generate a random 6-digit OTP
  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  },

  // Store OTP in the database
  async storeOTP(cnic, email, otp) {
    try {
      // First, check if there's already an OTP for this CNIC/email
      const existingQuery = 'SELECT * FROM otp WHERE cnic = $1 OR email = $2';
      const existingResult = await db.query(existingQuery, [cnic, email]);
      
      if (existingResult.rows.length > 0) {
        // Update existing OTP
        const updateQuery = `
          UPDATE otp 
          SET otp = $1, created_at = NOW(), is_verified = false
          WHERE cnic = $2 OR email = $3
          RETURNING *
        `;
        const updateResult = await db.query(updateQuery, [otp, cnic, email]);
        return updateResult.rows[0];
      } else {
        // Insert new OTP
        const insertQuery = `
          INSERT INTO otp (cnic, email, otp, created_at, is_verified)
          VALUES ($1, $2, $3, NOW(), false)
          RETURNING *
        `;
        const insertResult = await db.query(insertQuery, [cnic, email, otp]);
        return insertResult.rows[0];
      }
    } catch (error) {
      console.error('Error storing OTP:', error);
      throw error;
    }
  },

  // Verify OTP
  async verifyOTP(cnic, email, otp) {
    try {
      // Find OTP in the database with a timeout safety mechanism
      const query = 'SELECT *, to_char(created_at, \'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"\') as created_at_iso FROM otp WHERE cnic = $1 AND email = $2 AND otp = $3 AND is_verified = false';
      
      // Use a promise with timeout to prevent hanging
      const result = await Promise.race([
        db.query(query, [cnic, email, otp]),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Database query timeout')), 5000)
        )
      ]);
      
      if (result.rows.length === 0) {
        return { isValid: false, message: 'Invalid or already used OTP' };
      }
      
      const otpRecord = result.rows[0];
      
      // Debug logging to check timestamps
      console.log('OTP created at (from DB):', otpRecord.created_at);
      console.log('OTP created at (ISO):', otpRecord.created_at_iso);
      
      // Use the ISO string format to ensure proper parsing
      const createdAt = new Date(otpRecord.created_at_iso || otpRecord.created_at);
      const now = new Date();
      
      console.log('Created at parsed:', createdAt.toISOString());
      console.log('Current time:', now.toISOString());
      console.log('Time difference (ms):', now - createdAt);
      
      // Properly calculate minutes difference
      const diffInMinutes = Math.floor((now - createdAt) / (1000 * 60));
      console.log('Difference in minutes:', diffInMinutes);
      
      if (diffInMinutes > 3) {
        return { isValid: false, message: 'OTP expired' };
      }
      
      // OTP is valid, mark it as verified - with timeout protection
      await Promise.race([
        db.query('UPDATE otp SET is_verified = true WHERE cnic = $1 AND email = $2', [cnic, email]),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Database update timeout')), 5000)
        )
      ]);
      
      return { isValid: true, message: 'OTP verified successfully' };
    } catch (error) {
      console.error('Error verifying OTP:', error);
      // Return a friendly error message instead of throwing
      return { isValid: false, message: `Verification failed: ${error.message}` };
    }
  },

  // Check if OTP is verified for a given CNIC and email
  async isOTPVerified(cnic, email) {
    try {
      const query = 'SELECT is_verified FROM otp WHERE cnic = $1 AND email = $2';
      const result = await db.query(query, [cnic, email]);
      
      if (result.rows.length === 0) {
        return false;
      }
      
      return result.rows[0].is_verified;
    } catch (error) {
      console.error('Error checking OTP verification status:', error);
      throw error;
    }
  },

  // Clear OTP after registration is complete
  async clearOTP(cnic, email) {
    try {
      const query = 'DELETE FROM otp WHERE cnic = $1 AND email = $2';
      await db.query(query, [cnic, email]);
      return true;
    } catch (error) {
      console.error('Error clearing OTP:', error);
      throw error;
    }
  }
};

module.exports = otpModel;