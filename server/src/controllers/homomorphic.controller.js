/**
 * Controllers for homomorphic encryption operations in the voting system
 */

const electionCryptoService = require('../services/electionCrypto.service');
const electionModel = require('../models/election.model');
const candidateModel = require('../models/candidate.model');
const db = require('../database');
const blockchain = require('../blockchain/blockchain');

const homomorphicController = {
  /**
   * Initialize encryption for an election
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async initializeElection(req, res) {
    try {
      const { electionId, keySize = 2048 } = req.body;

      if (!electionId) {
        return res.status(400).json({ 
          message: 'Missing required field: electionId is required' 
        });
      }

      // Verify the election exists
      const election = await electionModel.findById(electionId);
      if (!election) {
        return res.status(404).json({ message: 'Election not found' });
      }

      console.log(`[${new Date().toISOString()}] Initializing homomorphic encryption for election ${electionId} with ${keySize}-bit keys`);

      // Add encryption keys to the election
      const updatedElection = await electionModel.addEncryptionKeys(electionId, keySize);

      return res.status(200).json({
        message: 'Homomorphic encryption initialized successfully',
        electionId: updatedElection.election_id,
        keySize
      });
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error initializing homomorphic encryption:`, error);
      return res.status(500).json({ 
        message: 'Error initializing homomorphic encryption: ' + error.message 
      });
    }
  },

  /**
   * Generate an encrypted vote
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async encryptVote(req, res) {
    try {
      const { electionId, candidateId } = req.body;

      if (!electionId || !candidateId) {
        return res.status(400).json({ 
          message: 'Missing required fields: electionId and candidateId are required' 
        });
      }

      // Verify the election exists
      const election = await electionModel.findById(electionId);
      if (!election) {
        return res.status(404).json({ message: 'Election not found' });
      }

      // Get all candidates for this election to determine total count
      const candidates = await candidateModel.getByElection(electionId);
      const totalCandidates = candidates.length;

      // Find the position of the selected candidate in the array (1-based index)
      const candidateIndex = candidates.findIndex(c => c.candidate_id == candidateId);
      if (candidateIndex === -1) {
        return res.status(400).json({ 
          message: `Candidate ID ${candidateId} not found in election ${electionId}` 
        });
      }
      
      // Candidate position is 1-based
      const candidatePosition = candidateIndex + 1;

      console.log(`[${new Date().toISOString()}] Encrypting vote for election ${electionId}, candidate ${candidateId} (position ${candidatePosition})`);

      // Encrypt the vote
      const encryptedVoteData = await electionCryptoService.encryptVote(
        candidatePosition, 
        totalCandidates, 
        electionId
      );

      return res.status(200).json({
        message: 'Vote encrypted successfully',
        encryptedVote: encryptedVoteData.encryptedVote,
        proof: encryptedVoteData.proof
      });
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error encrypting vote:`, error);
      return res.status(500).json({ 
        message: 'Error encrypting vote: ' + error.message 
      });
    }
  },

  /**
   * Verify an encrypted vote
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async verifyVote(req, res) {
    try {
      const { electionId, encryptedVote, proof } = req.body;

      if (!electionId || !encryptedVote || !proof) {
        return res.status(400).json({ 
          message: 'Missing required fields: electionId, encryptedVote, and proof are required' 
        });
      }

      // Verify the vote
      const isValid = await electionCryptoService.verifyVote(
        { encryptedVote, proof }, 
        electionId
      );

      return res.status(200).json({
        message: isValid ? 'Vote verified successfully' : 'Vote verification failed',
        isValid
      });
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error verifying vote:`, error);
      return res.status(500).json({ 
        message: 'Error verifying vote: ' + error.message 
      });
    }
  },

  /**
   * Calculate election results using homomorphic tallying
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async calculateResults(req, res) {
    try {
      const { electionId } = req.body;

      if (!electionId) {
        return res.status(400).json({ 
          message: 'Missing required field: electionId is required' 
        });
      }

      // Verify the election exists
      const election = await electionModel.findById(electionId);
      if (!election) {
        return res.status(404).json({ message: 'Election not found' });
      }

      // Get all candidates for this election
      const candidates = await candidateModel.getByElection(electionId);
      const totalCandidates = candidates.length;

      console.log(`[${new Date().toISOString()}] Calculating homomorphic results for election ${electionId} with ${totalCandidates} candidates`);

      // Get all votes from the blockchain
      const votes = await blockchain.getAllVotes();

      // Filter votes for this election
      const electionVotes = votes.filter(vote => 
        vote.voteData && vote.voteData.electionId == electionId && vote.voteData.encryptedVote
      );

      console.log(`[${new Date().toISOString()}] Found ${electionVotes.length} encrypted votes for election ${electionId}`);

      if (electionVotes.length === 0) {
        return res.status(400).json({ 
          message: 'No encrypted votes found for this election' 
        });
      }

      // Get current encrypted tally from database or start with a new one
      let encryptedTally = await electionModel.getEncryptedTally(electionId);
      
      if (!encryptedTally) {
        // Initialize with a fresh encrypted zero
        const publicKey = await electionCryptoService.getElectionPublicKey(electionId);
        encryptedTally = electionCryptoService.PaillierEncryption.encrypt('0', publicKey);
        console.log(`[${new Date().toISOString()}] Initialized new encrypted tally for election ${electionId}`);
      }

      // Process votes in batches
      const batchSize = 10;
      for (let i = 0; i < electionVotes.length; i += batchSize) {
        const batch = electionVotes.slice(i, i + batchSize);
        const batchVotes = batch.map(vote => ({
          id: vote.voteData.timestamp,
          encryptedVote: vote.voteData.encryptedVote,
          proof: vote.voteData.proof || {} // Use empty object if no proof
        }));

        // Process this batch
        const batchResult = await electionCryptoService.processBatchVotes(
          batchVotes, 
          electionId, 
          encryptedTally
        );

        // Update the tally
        encryptedTally = batchResult.encryptedTally;
        
        console.log(`[${new Date().toISOString()}] Processed batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(electionVotes.length/batchSize)}`);
        console.log(`[${new Date().toISOString()}] Batch summary: ${batchResult.validVoteCount} valid, ${batchResult.invalidVoteCount} invalid`);
      }

      // Store the encrypted tally in the database
      await electionModel.updateEncryptedTally(electionId, encryptedTally);
      console.log(`[${new Date().toISOString()}] Updated encrypted tally in database for election ${electionId}`);

      // Decrypt the final tally and get vote counts
      const results = await electionCryptoService.decryptTally(
        encryptedTally, 
        totalCandidates, 
        electionId
      );

      console.log(`[${new Date().toISOString()}] Successfully decrypted tally for election ${electionId}`);

      // Map the vote counts to candidates
      const candidateResults = candidates.map((candidate, index) => {
        // Find the vote count for this candidate position (1-based index)
        const candidatePosition = index + 1;
        const voteResult = results.find(r => r.candidateId === candidatePosition);
        
        return {
          candidate: {
            id: candidate.candidate_id,
            name: candidate.name,
            party: candidate.party,
            symbol: candidate.symbol
          },
          votes: voteResult ? voteResult.votes : 0
        };
      });

      // Sort by vote count (highest first)
      candidateResults.sort((a, b) => b.votes - a.votes);

      // Update the election with the results
      const totalVotes = candidateResults.reduce((sum, result) => sum + result.votes, 0);
      
      await db.query(
        `UPDATE election 
         SET results = $1, count_method = $2, total_votes = $3, count_completed_at = NOW() 
         WHERE election_id = $4`,
        [JSON.stringify(candidateResults), 'homomorphic', totalVotes, electionId]
      );

      console.log(`[${new Date().toISOString()}] Saved homomorphic results for election ${electionId}: ${totalVotes} total votes`);

      return res.status(200).json({
        message: 'Election results calculated successfully',
        electionId,
        totalVotes,
        results: candidateResults
      });
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error calculating homomorphic results:`, error);
      return res.status(500).json({ 
        message: 'Error calculating results: ' + error.message 
      });
    }
  }
};

module.exports = homomorphicController;