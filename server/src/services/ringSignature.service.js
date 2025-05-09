const voterModel = require('../models/voter.model');
const RingSignature = require('../crypto/ringSignature');

/**
 * Ring Signature Service
 * Provides voter anonymity for the voting system
 */
class RingSignatureService {
  /**
   * Generate a ring signature for a vote
   * @param {Object} voteData - The vote data to sign
   * @param {String} voterPrivateKey - The voter's private key
   * @param {Number} ringSize - The size of the anonymity set (default: 5)
   * @returns {Promise<Object>} - The generated ring signature
   */
  static async generateVoteRingSignature(voteData, voterPrivateKey, ringSize = 5) {
    try {
      // Select a random group of voters to form the anonymity ring
      const voters = await voterModel.getRandomVoters(ringSize);
      
      // Extract public keys to form the ring
      const publicKeys = voters.map(voter => voter.public_key);
      
      // Sign the vote with the ring signature
      const voteMessage = JSON.stringify(voteData);
      const ringSignature = RingSignature.generateSignature(
        voteMessage,
        voterPrivateKey,
        publicKeys
      );
      
      return ringSignature;
    } catch (error) {
      console.error(`Error generating ring signature: ${error.message}`);
      throw new Error('Failed to generate ring signature');
    }
  }
  
  /**
   * Verify a ring signature for a vote
   * @param {Object} ringSignature - The ring signature to verify
   * @returns {Boolean} - Whether the signature is valid
   */
  static verifyVoteRingSignature(ringSignature) {
    return RingSignature.verifySignature(ringSignature);
  }
  
  /**
   * Generate native ECC key pair for a voter
   * Better suited for ring signatures than RSA keys
   * @returns {Promise<Object>} The generated ECC key pair
   */
  static generateVoterECCKeyPair() {
    return RingSignature.generateECCKeyPair();
  }
  
  /**
   * Check if a key image has been used before (prevents double voting)
   * @param {String} keyImage - The key image to check
   * @param {Number} electionId - The election ID
   * @returns {Promise<Boolean>} - Whether the key image has been used
   */
  static async isKeyImageUsed(keyImage, electionId) {
    try {
      // Get all votes for this election from the blockchain
      const blockchain = require('../blockchain/blockchain');
      const votes = await blockchain.getVotesByElection(electionId);
      
      // Check if any existing vote has the same key image
      const keyImageExists = votes.some(vote => 
        vote.ringSignature && vote.ringSignature.keyImage === keyImage
      );
      
      return keyImageExists;
    } catch (error) {
      console.error(`Error checking key image: ${error.message}`);
      // In case of error, assume the key image is used (safer)
      return true;
    }
  }
}

// Export the service class
module.exports = RingSignatureService;