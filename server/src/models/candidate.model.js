const db = require('../database');

const candidateModel = {
  // Create a new candidate
  async create(electionId, name, party, symbol) {
    // First check if candidate with same name already exists in this election
    const checkQuery = `
      SELECT * FROM candidate 
      WHERE election_id = $1 AND LOWER(name) = LOWER($2)
    `;
    const checkResult = await db.query(checkQuery, [electionId, name]);
    
    if (checkResult.rows.length > 0) {
      throw new Error(`A candidate with the name "${name}" already exists in this election`);
    }
    
    const query = `
      INSERT INTO candidate (election_id, name, party, symbol)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const values = [electionId, name, party, symbol];
    const result = await db.query(query, values);
    return result.rows[0];
  },

  // Get candidate by ID
  async findById(candidateId) {
    const query = 'SELECT * FROM candidate WHERE candidate_id = $1';
    const result = await db.query(query, [candidateId]);
    return result.rows[0];
  },

  // Get all candidates for a specific election
  async getByElection(electionId) {
    const query = 'SELECT * FROM candidate WHERE election_id = $1';
    const result = await db.query(query, [electionId]);
    return result.rows;
  },

  // Update candidate details
  async update(candidateId, name, party, symbol) {
    // Check if there's already another candidate with the same name in this election
    const candidateQuery = 'SELECT election_id FROM candidate WHERE candidate_id = $1';
    const candidateResult = await db.query(candidateQuery, [candidateId]);
    
    if (candidateResult.rows.length === 0) {
      throw new Error('Candidate not found');
    }
    
    const electionId = candidateResult.rows[0].election_id;
    
    // Check for duplicate names in the same election (excluding this candidate)
    const checkQuery = `
      SELECT * FROM candidate 
      WHERE election_id = $1 
      AND LOWER(name) = LOWER($2) 
      AND candidate_id != $3
    `;
    const checkResult = await db.query(checkQuery, [electionId, name, candidateId]);
    
    if (checkResult.rows.length > 0) {
      throw new Error(`A candidate with the name "${name}" already exists in this election`);
    }
    
    const query = `
      UPDATE candidate
      SET name = $1, party = $2, symbol = $3
      WHERE candidate_id = $4
      RETURNING *
    `;
    const values = [name, party, symbol, candidateId];
    const result = await db.query(query, values);
    return result.rows[0];
  },

  // Delete a candidate
  async delete(candidateId) {
    const query = 'DELETE FROM candidate WHERE candidate_id = $1 RETURNING *';
    const result = await db.query(query, [candidateId]);
    return result.rows[0];
  },

  // Delete all candidates for a specific election
  async deleteByElection(electionId) {
    const query = 'DELETE FROM candidate WHERE election_id = $1 RETURNING *';
    const result = await db.query(query, [electionId]);
    return result.rows;
  },

  // Get total count of candidates
  async getCount() {
    const query = 'SELECT COUNT(*) as count FROM candidate';
    const result = await db.query(query);
    return parseInt(result.rows[0].count);
  }
};

module.exports = candidateModel;