const homomorphicEncryption = require('../crypto/homomorphicEncryption');

/**
 * Service for handling election crypto operations
 * Provides an interface for homomorphic encryption operations related to elections
 */
class ElectionCryptoService {
  /**
   * Generate encryption keys for an election
   * @param {string} electionId - The ID of the election
   * @param {number} keySize - Size of the key in bits (default: 2048)
   * @returns {Object} - The generated key pair (publicKey, privateKey)
   */
  async generateElectionKeys(electionId, keySize = 2048) {
    try {
      console.log(`[${new Date().toISOString()}] Generating ${keySize}-bit encryption keys for election ${electionId}`);
      
      // Generate key pair using the homomorphic encryption module
      const keyPair = homomorphicEncryption.PaillierEncryption.generateKeys(keySize);
      
      return {
        publicKey: keyPair.publicKey,
        privateKey: keyPair.privateKey
      };
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error generating keys for election ${electionId}:`, error);
      throw new Error(`Failed to generate election keys: ${error.message}`);
    }
  }

  /**
   * Encrypt a vote for a specific candidate in an election
   * @param {string} candidateId - The ID of the candidate
   * @param {number} totalCandidates - Total number of candidates in the election
   * @param {Object} publicKey - The election's public key
   * @returns {Object} - The encrypted vote
   */
  encryptVote(candidateId, totalCandidates, publicKey) {
    try {
      // Encode the vote - this creates a special format where only the selected candidate gets a '1'
      const encodedVote = homomorphicEncryption.encodeVote(candidateId, totalCandidates);
      
      // Encrypt the encoded vote
      const encryptedVote = homomorphicEncryption.PaillierEncryption.encrypt(encodedVote, publicKey);
      
      return {
        encryptedVote,
        encodedVote // Useful for verification
      };
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error encrypting vote:`, error);
      throw new Error(`Failed to encrypt vote: ${error.message}`);
    }
  }

  /**
   * Process a batch of encrypted votes
   * @param {Array} encryptedVotes - Array of encrypted votes
   * @param {Object} publicKey - The election's public key
   * @returns {Object} - Batch processing results
   */
  processBatch(encryptedVotes, publicKey) {
    try {
      // Create a homomorphic batch from multiple encrypted votes
      return homomorphicEncryption.createHomomorphicBatch(encryptedVotes, publicKey);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error processing vote batch:`, error);
      throw new Error(`Failed to process vote batch: ${error.message}`);
    }
  }

  /**
   * Process all votes and get final tally
   * @param {Array} encryptedVotes - Array of all encrypted votes
   * @param {Object} publicKey - The election's public key
   * @param {Object} privateKey - The election's private key
   * @param {number} totalCandidates - Total number of candidates
   * @returns {Array} - Vote counts for each candidate
   */
  async processAllVotes(encryptedVotes, publicKey, privateKey, totalCandidates) {
    try {
      // Initialize with encryption of zero
      let encryptedTally = homomorphicEncryption.PaillierEncryption.encrypt('0', publicKey);
      
      // Process votes in batches
      const batchSize = 5;
      let validVoteCount = 0;
      let invalidVoteCount = 0;
      
      for (let i = 0; i < encryptedVotes.length; i += batchSize) {
        const batch = encryptedVotes.slice(i, i + batchSize);
        
        if (batch.length > 0) {
          const batchResult = this.processBatch(batch, publicKey);
          
          encryptedTally = homomorphicEncryption.PaillierEncryption.addEncrypted(
            encryptedTally,
            batchResult.batchCiphertext,
            publicKey
          );
          
          validVoteCount += batchResult.validVoteCount || 0;
          invalidVoteCount += batchResult.invalidVoteCount || 0;
        }
      }
      
      // Decrypt the final tally
      const decryptedTally = homomorphicEncryption.PaillierEncryption.decrypt(
        encryptedTally,
        privateKey
      );
      
      // Try to decode the tally using multiple methods if needed
      let voteCounts;
      try {
        voteCounts = homomorphicEncryption.decodeVoteTally(decryptedTally, totalCandidates);
      } catch (error) {
        // Fallback to BigInt method
        voteCounts = homomorphicEncryption.decodeVoteTallyBigInt(decryptedTally, totalCandidates);
      }
      
      return {
        voteCounts,
        validVoteCount,
        invalidVoteCount,
        encryptedTally,
        decryptedTally
      };
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error processing all votes:`, error);
      throw new Error(`Failed to process all votes: ${error.message}`);
    }
  }
}

// Export a singleton instance
module.exports = new ElectionCryptoService();