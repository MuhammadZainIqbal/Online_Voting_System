const db = require('../database');
const bcrypt = require('bcrypt');

const voterModel = {
  // Create a new voter
  async create(cnic, email, password, publicKey) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const query = `
      INSERT INTO voter (cnic, email, password_hash, public_key, has_voted)
      VALUES ($1, $2, $3, $4, false)
      RETURNING cnic, email, public_key
    `;
    const values = [cnic, email, hashedPassword, publicKey];
    const result = await db.query(query, values);
    return result.rows[0];
  },

  // Find voter by CNIC
  async findByCNIC(cnic) {
    const query = 'SELECT * FROM voter WHERE cnic = $1';
    const result = await db.query(query, [cnic]);
    return result.rows[0];
  },

  // Find voter by email
  async findByEmail(email) {
    const query = 'SELECT * FROM voter WHERE email = $1';
    const result = await db.query(query, [email]);
    return result.rows[0];
  },

  // Update voter's has_voted status
  async updateVotingStatus(cnic, hasVoted) {
    const query = 'UPDATE voter SET has_voted = $1 WHERE cnic = $2 RETURNING *';
    const result = await db.query(query, [hasVoted, cnic]);
    return result.rows[0];
  },

  // Check if voter has voted in a specific election
  async hasVotedInElection(cnic, electionId) {
    const query = 'SELECT has_voted FROM voter_election WHERE voter_id = $1 AND election_id = $2';
    const result = await db.query(query, [cnic, electionId]);
    return result.rows.length > 0 ? result.rows[0].has_voted : false;
  },

  // Update voting status for a specific election
  async updateVotingStatusForElection(cnic, electionId, hasVoted) {
    const votedAt = hasVoted ? new Date() : null;
    
    // Use upsert (INSERT ... ON CONFLICT) to either insert or update
    const query = `
      INSERT INTO voter_election (voter_id, election_id, has_voted, voted_at)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (voter_id, election_id) 
      DO UPDATE SET has_voted = $3, voted_at = $4
      RETURNING *
    `;
    
    const result = await db.query(query, [cnic, electionId, hasVoted, votedAt]);
    return result.rows[0];
  },

  // Get all elections a voter has voted in
  async getVotedElections(cnic) {
    const query = `
      SELECT ve.election_id, ve.has_voted, ve.voted_at, e.title, e.status
      FROM voter_election ve
      JOIN election e ON ve.election_id = e.election_id
      WHERE ve.voter_id = $1 AND ve.has_voted = true
    `;
    
    const result = await db.query(query, [cnic]);
    return result.rows;
  },

  // Get all voters (for admin use)
  async getAll() {
    const query = 'SELECT cnic, email, public_key, has_voted FROM voter';
    const result = await db.query(query);
    return result.rows;
  },
  
  /**
   * Get random voters for forming an anonymity ring
   * Used for ring signatures to provide voter anonymity
   * @param {Number} count - Number of random voters to fetch
   * @returns {Promise<Array>} - Array of voter objects with public keys
   */
  async getRandomVoters(count = 5) {
    try {
      // Fetch random voters including their public keys
      // Order by random() for true randomness
      const query = `
        SELECT cnic, public_key 
        FROM voter 
        WHERE public_key IS NOT NULL 
        ORDER BY RANDOM() 
        LIMIT $1
      `;
      
      const result = await db.query(query, [count]);
      
      // If we don't have enough voters, fill with dummy keys
      if (result.rows.length < count) {
        const crypto = require('crypto');
        
        // Generate dummy voters with placeholder public keys
        for (let i = result.rows.length; i < count; i++) {
          const dummyKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA${crypto.randomBytes(20).toString('base64')}
${crypto.randomBytes(20).toString('base64')}${crypto.randomBytes(20).toString('base64')}
${crypto.randomBytes(12).toString('base64')}==
-----END PUBLIC KEY-----`;
          
          result.rows.push({
            cnic: `dummy-${i}`,
            public_key: dummyKey
          });
        }
      }
      
      return result.rows;
    } catch (error) {
      console.error(`Error getting random voters: ${error.message}`);
      
      // In case of failure, return dummy keys for the ring
      const crypto = require('crypto');
      const dummyVoters = [];
      
      for (let i = 0; i < count; i++) {
        const dummyKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA${crypto.randomBytes(20).toString('base64')}
${crypto.randomBytes(20).toString('base64')}${crypto.randomBytes(20).toString('base64')}
${crypto.randomBytes(12).toString('base64')}==
-----END PUBLIC KEY-----`;
        
        dummyVoters.push({
          cnic: `dummy-${i}`,
          public_key: dummyKey
        });
      }
      
      return dummyVoters;
    }
  },
  
  /**
   * Create a new voter with ECC keys (better for ring signatures)
   * @param {String} cnic - Voter's CNIC
   * @param {String} email - Voter's email
   * @param {String} password - Voter's password
   * @returns {Promise<Object>} - The created voter
   */
  async createWithECCKeys(cnic, email, password) {
    try {
      // Generate ECC key pair for the voter
      const RingSignatureService = require('../services/ringSignature.service');
      const keyPair = await RingSignatureService.generateVoterECCKeyPair();
      
      // Create the voter with the ECC public key
      return this.create(cnic, email, password, keyPair.publicKey);
    } catch (error) {
      console.error(`Error creating voter with ECC keys: ${error.message}`);
      throw new Error('Failed to create voter with ECC keys');
    }
  },
  
  /**
   * Store the key image from a ring signature to prevent double voting
   * @param {String} cnic - Voter's CNIC
   * @param {String} keyImage - The key image from the ring signature
   * @param {Number} electionId - The election ID
   * @returns {Promise<Boolean>} - Whether the key image was stored successfully
   */
  async storeKeyImage(cnic, keyImage, electionId) {
    try {
      // First check if the key_images column exists, if not create it
      const checkColumnQuery = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'voter' AND column_name = 'key_images'
      `;
      
      const columnCheck = await db.query(checkColumnQuery);
      
      // If column doesn't exist, add it
      if (columnCheck.rows.length === 0) {
        await db.query(`ALTER TABLE voter ADD COLUMN key_images JSONB DEFAULT '{}'::jsonb`);
      }
      
      // Get current key images for this voter
      const currentImagesQuery = 'SELECT key_images FROM voter WHERE cnic = $1';
      const currentResult = await db.query(currentImagesQuery, [cnic]);
      
      let keyImages = {};
      if (currentResult.rows.length > 0 && currentResult.rows[0].key_images) {
        keyImages = currentResult.rows[0].key_images;
      }
      
      // Add the new key image for this election
      keyImages[electionId] = keyImage;
      
      // Update the voter record
      const updateQuery = 'UPDATE voter SET key_images = $1 WHERE cnic = $2';
      await db.query(updateQuery, [keyImages, cnic]);
      
      return true;
    } catch (error) {
      console.error(`Error storing key image: ${error.message}`);
      return false;
    }
  },

  /**
   * Update voter's password
   * @param {String} cnic - Voter's CNIC
   * @param {String} newPassword - New password to set
   * @returns {Promise<Object>} - Updated voter object
   */
  async updatePassword(cnic, newPassword) {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const query = 'UPDATE voter SET password_hash = $1 WHERE cnic = $2 RETURNING cnic, email';
    const result = await db.query(query, [hashedPassword, cnic]);
    return result.rows[0];
  },
  
  /**
   * Find voter by CNIC and email (for password reset verification)
   * @param {String} cnic - Voter's CNIC
   * @param {String} email - Voter's email
   * @returns {Promise<Object>} - The voter if found
   */
  async findByCNICAndEmail(cnic, email) {
    const query = 'SELECT * FROM voter WHERE cnic = $1 AND email = $2';
    const result = await db.query(query, [cnic, email]);
    return result.rows[0];
  },
  
  /**
   * Store reset token and expiry for a voter
   * @param {String} cnic - Voter's CNIC
   * @param {String} resetToken - Hashed reset token
   * @param {Date} resetExpires - Token expiry date
   * @returns {Promise<Boolean>} - Whether the token was stored successfully
   */
  async storeResetToken(cnic, resetToken, resetExpires) {
    try {
      // First check if the reset columns exist, if not create them
      const checkColumnsQuery = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'voter' AND column_name IN ('reset_token', 'reset_expires')
      `;
      
      const columnCheck = await db.query(checkColumnsQuery);
      
      // If columns don't exist, add them
      if (columnCheck.rows.length < 2) {
        await db.query(`
          ALTER TABLE voter 
          ADD COLUMN IF NOT EXISTS reset_token TEXT,
          ADD COLUMN IF NOT EXISTS reset_expires TIMESTAMP
        `);
      }
      
      // Store the reset token and expiry
      const query = 'UPDATE voter SET reset_token = $1, reset_expires = $2 WHERE cnic = $3 RETURNING cnic';
      const result = await db.query(query, [resetToken, resetExpires, cnic]);
      
      return result.rows.length > 0;
    } catch (error) {
      console.error(`Error storing reset token: ${error.message}`);
      return false;
    }
  },
  
  /**
   * Validate reset token
   * @param {String} cnic - Voter's CNIC
   * @param {String} token - Hashed reset token to validate
   * @returns {Promise<Object>} - The voter if token is valid and not expired
   */
  async validateResetToken(cnic, token) {
    const query = `
      SELECT * FROM voter 
      WHERE cnic = $1 
      AND reset_token = $2 
      AND reset_expires > NOW()
    `;
    const result = await db.query(query, [cnic, token]);
    return result.rows[0];
  },
  
  /**
   * Clear reset token after password change
   * @param {String} cnic - Voter's CNIC
   * @returns {Promise<Boolean>} - Whether the token was cleared successfully
   */
  async clearResetToken(cnic) {
    try {
      const query = 'UPDATE voter SET reset_token = NULL, reset_expires = NULL WHERE cnic = $1';
      await db.query(query, [cnic]);
      return true;
    } catch (error) {
      console.error(`Error clearing reset token: ${error.message}`);
      return false;
    }
  }
};

module.exports = voterModel;