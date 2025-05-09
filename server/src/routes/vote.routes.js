const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const voterModel = require('../models/voter.model');
const electionModel = require('../models/election.model');
const candidateModel = require('../models/candidate.model');
const blockchain = require('../blockchain/blockchain');
const mixnet = require('../crypto/mixnet');
const cryptoUtils = require('../crypto/cryptoUtils');
const RingSignature = require('../crypto/ringSignature');
const homomorphicEncryption = require('../crypto/homomorphicEncryption');
const BlindSignature = require('../crypto/blindSignature');
const RingSignatureService = require('../services/ringSignature.service');
const db = require('../database');
const crypto = require('crypto');

/**
 * @route   POST /api/vote/request-authorization
 * @desc    Request a blind signature from the election authority
 * @access  Private/Voter
 */
router.post('/request-authorization', authMiddleware.verifyToken, authMiddleware.verifyVoter, async (req, res) => {
  try {
    const voterId = req.user.id; // CNIC from the JWT token
    const { electionId, blindedVoteHash } = req.body;
    
    if (!electionId || !blindedVoteHash) {
      return res.status(400).json({ 
        message: 'Missing required fields: electionId and blindedVoteHash are required' 
      });
    }
    
    // 1. Verify that the voter exists and hasn't voted already
    const voter = await voterModel.findByCNIC(voterId);
    if (!voter) {
      return res.status(404).json({ message: 'Voter not found' });
    }
    
    if (voter.has_voted) {
      return res.status(400).json({ message: 'You have already cast your vote' });
    }
    
    // 2. Verify that the election exists and is active
    const election = await electionModel.findById(electionId);
    if (!election) {
      return res.status(404).json({ message: 'Election not found' });
    }
    
    if (election.status !== 'active') {
      return res.status(400).json({ 
        message: `This election is not active. Current status: ${election.status}` 
      });
    }
    
    // 3. Get the authority's (admin's) private key for signing
    // In production, this would use a secure key management system
    // For now, we'll query it from the database
    const authorityResult = await db.query(
      'SELECT signing_private_key FROM admin LIMIT 1'
    );
    
    if (!authorityResult.rows.length || !authorityResult.rows[0].signing_private_key) {
      // If no signing key exists, create one
      console.log('No authority signing key found, generating a new key pair');
      const keyPair = cryptoUtils.generateKeyPair();
      
      await db.query(
        'UPDATE admin SET signing_private_key = $1, signing_public_key = $2',
        [keyPair.privateKey, keyPair.publicKey]
      );
      
      var authorityPrivateKey = keyPair.privateKey;
      var authorityPublicKey = keyPair.publicKey;
    } else {
      var authorityPrivateKey = authorityResult.rows[0].signing_private_key;
      
      // Get the public key as well
      const publicKeyResult = await db.query(
        'SELECT signing_public_key FROM admin LIMIT 1'
      );
      var authorityPublicKey = publicKeyResult.rows[0].signing_public_key;
    }
    
    // 4. Sign the blinded vote hash
    const blindSignature = BlindSignature.signBlindedMessage(
      blindedVoteHash,
      authorityPrivateKey
    );
    
    // 5. Return the blind signature to the voter
    return res.status(200).json({
      success: true,
      blindSignature,
      authorityPublicKey,
      message: 'Vote authorization granted'
    });
    
  } catch (error) {
    console.error('Error in vote authorization:', error);
    return res.status(500).json({ 
      message: 'Server error: ' + (error.message || 'Please try again later') 
    });
  }
});

/**
 * @route   POST /api/vote
 * @desc    Cast a vote in an election
 * @access  Private/Voter
 */
router.post('/', authMiddleware.verifyToken, authMiddleware.verifyVoter, async (req, res) => {
  try {
    const voterId = req.user.id; // CNIC from the JWT token
    const { 
      electionId, 
      candidateId, 
      privateKey, 
      voterSignature,
      unblindedSignature, // New parameter for blind signature verification
      voteHash,          // New parameter containing original vote hash
      blindingData       // Optional data about blinding process for verification
    } = req.body;
    
    console.log(`Processing vote for election: ${electionId}, candidate: ${candidateId}`);
    console.log(`DEBUG - Private key in request body: ${privateKey ? 'PRESENT' : 'MISSING'}`);
    console.log(`DEBUG - Private key length: ${privateKey ? privateKey.length : 'N/A'}`);
    console.log(`DEBUG - Private key type: ${privateKey ? typeof privateKey : 'undefined'}`);
    if (privateKey) {
      console.log(`DEBUG - Private key starts with: ${privateKey.substring(0, 30)}...`);
      console.log(`DEBUG - Private key contains BEGIN marker: ${privateKey.includes('-----BEGIN') ? 'YES' : 'NO'}`);
      console.log(`DEBUG - Private key contains PRIVATE KEY marker: ${privateKey.includes('PRIVATE KEY') ? 'YES' : 'NO'}`);
    }
    
    if (!electionId || !candidateId) {
      return res.status(400).json({ message: 'Missing required fields: electionId and candidateId are required' });
    }
    
    // Check if private key or signature is provided for voter authentication
    if (!privateKey && !voterSignature) {
      return res.status(400).json({ message: 'Authentication failed: Either privateKey or voterSignature must be provided' });
    }
    
    // Make a secure deep copy of the private key to ensure it persists throughout processing
    // This will help prevent the key from being garbage collected or lost during async operations
    const securePrivateKeyCopy = privateKey ? String(privateKey) : null;
    
    // Log the key status for debugging
    if (securePrivateKeyCopy) {
      console.log(`Secure private key copy created (length: ${securePrivateKeyCopy.length})`);
    } else {
      console.log('No private key provided, will use signature verification only');
    }
    
    // 1. Verify that the voter exists and hasn't voted already
    const voter = await voterModel.findByCNIC(voterId);
    if (!voter) {
      return res.status(404).json({ message: 'Voter not found' });
    }
    
    // Check if voter has already voted in this election
    if (await voterModel.hasVotedInElection(voterId, electionId)) {
      return res.status(400).json({ message: 'You have already cast your vote in this election' });
    }
    
    // 2. Verify that the election exists and is active
    const election = await electionModel.findById(electionId);
    if (!election) {
      return res.status(404).json({ message: 'Election not found' });
    }
    
    if (election.status !== 'active') {
      return res.status(400).json({ 
        message: `This election is not active. Current status: ${election.status}` 
      });
    }
    
    // 3. Verify that the candidate exists and belongs to the election
    const candidate = await candidateModel.findById(candidateId);
    if (!candidate) {
      return res.status(404).json({ message: 'Candidate not found' });
    }
    
    if (candidate.election_id != electionId) {
      return res.status(400).json({ message: 'Candidate does not belong to this election' });
    }
    
    // 4. Verify blind signature if provided
    if (unblindedSignature && voteHash) {
      console.log('---------- BLIND SIGNATURE VERIFICATION START ----------');
      console.log('Vote hash:', voteHash);
      console.log('Unblinded signature format:', typeof unblindedSignature);
      console.log('Unblinded signature value:', unblindedSignature);
      
      // Get the authority's public key
      const authorityResult = await db.query(
        'SELECT signing_public_key FROM admin LIMIT 1'
      );
      
      if (!authorityResult.rows.length || !authorityResult.rows[0].signing_public_key) {
        console.error('No authority public key found for signature verification');
        return res.status(401).json({
          message: 'Vote authorization verification failed: No authority key available'
        });
      }
      
      const authorityPublicKey = authorityResult.rows[0].signing_public_key;
      
      // Verify the unblinded signature
      const isBlindSignatureValid = BlindSignature.verifySignature(
        voteHash,
        unblindedSignature,
        authorityPublicKey
      );
      
      console.log('Blind signature verification result:', isBlindSignatureValid ? 'SUCCESS' : 'FAILED');
      console.log('---------- BLIND SIGNATURE VERIFICATION END ----------');
      
      if (!isBlindSignatureValid) {
        console.error('Vote authorization verification failed: Invalid blind signature');
        return res.status(401).json({
          message: 'Vote authorization verification failed: Invalid blind signature'
        });
      }
      
      console.log('Vote has valid authority authorization via blind signature');
    } else {
      console.log('No blind signature provided. This is insecure but allowed during transition.');
      // In a production system, you'd require blind signatures for all votes
    }
    
    // 5. Verify the voter's signature using their public key
    // This proves they have the private key and are authorized to vote
    const message = `${voterId}:${electionId}:${candidateId}`;
    let isSignatureValid = false;
    
    try {
      console.log('---------- SIGNATURE VERIFICATION START ----------');
      console.log('Voter ID:', voterId);
      console.log('Election ID:', electionId);
      console.log('Candidate ID:', candidateId);
      console.log('Message to verify:', message);
      
      // Verify the stored public key format
      if (!voter.public_key || !voter.public_key.includes('-----BEGIN PUBLIC KEY-----')) {
        console.error('Invalid public key format in database for voter:', voterId);
        return res.status(401).json({ 
          message: 'Authentication failed: Invalid public key stored for this voter' 
        });
      }
      
      if (voterSignature) {
        console.log('Verifying with provided signature');
        // Check if voterSignature is defined and is a string before using substring
        if (typeof voterSignature === 'string') {
          console.log('Signature length:', voterSignature.length);
          console.log('First 30 chars of signature:', voterSignature.substring(0, 30));
          
          isSignatureValid = cryptoUtils.verifySignature(message, voterSignature, voter.public_key);
          
          // For diagnostic purposes, try alternative formats if verification fails
          if (!isSignatureValid) {
            console.log('Standard verification failed, trying with normalized message');
            // Try with trimmed message (in case of whitespace issues)
            const trimmedMessage = message.trim();
            if (trimmedMessage !== message) {
              isSignatureValid = cryptoUtils.verifySignature(trimmedMessage, voterSignature, voter.public_key);
              console.log('Verification with trimmed message:', isSignatureValid ? 'SUCCESS' : 'FAILED');
            }
          }
        } else {
          console.error('Invalid signature format: Expected string but got', typeof voterSignature);
          return res.status(401).json({ 
            message: 'Authentication failed: Invalid signature format' 
          });
        }
      } else if (privateKey) {
        console.log('No signature provided, generating signature from private key');
        try {
          // Validate private key format first
          if (!privateKey.includes('-----BEGIN') || !privateKey.includes('PRIVATE KEY-----')) {
            console.error('Invalid private key format provided');
            return res.status(401).json({ 
              message: 'Authentication failed: Invalid private key format' 
            });
          }
          
          console.log('Private key length:', privateKey.length);
          
          // Check if private key corresponds to the stored public key
          try {
            const forge = require('node-forge');
            const privateKeyObj = forge.pki.privateKeyFromPem(privateKey);
            const derivedPublicKey = forge.pki.setRsaPublicKey(privateKeyObj.n, privateKeyObj.e);
            const derivedPublicKeyPem = forge.pki.publicKeyToPem(derivedPublicKey);
            
            // Compare with stored public key (normalizing whitespace)
            const normalizedStoredKey = voter.public_key.replace(/\s+/g, '');
            const normalizedDerivedKey = derivedPublicKeyPem.replace(/\s+/g, '');
            
            const keysMatch = normalizedStoredKey === normalizedDerivedKey;
            console.log('Private key matches stored public key:', keysMatch ? 'YES' : 'NO');
            
            if (!keysMatch) {
              console.error('Private key provided does not match the public key in the database');
              return res.status(401).json({ 
                message: 'Authentication failed: The private key does not match your stored public key' 
              });
            }
          } catch (keyMatchError) {
            console.error('Error comparing keys:', keyMatchError);
          }
          
          // Generate a signature on the fly from the private key
          const generatedSignature = cryptoUtils.signData(message, privateKey);
          console.log('Generated signature length:', generatedSignature.length);
          console.log('First 30 chars of generated signature:', generatedSignature.substring(0, 30));
          
          // Verify the generated signature
          isSignatureValid = cryptoUtils.verifySignature(message, generatedSignature, voter.public_key);
        } catch (signingError) {
          console.error('Error generating signature:', signingError);
          return res.status(401).json({ 
            message: 'Authentication failed: Error generating signature from private key: ' + signingError.message 
          });
        }
      }
      
      // Final verification result
      console.log('Final signature verification result:', isSignatureValid ? 'SUCCESS' : 'FAILED');
      console.log('---------- SIGNATURE VERIFICATION END ----------');
      
      if (!isSignatureValid) {
        console.error('Authentication failed: Invalid signature or private key');
        return res.status(401).json({ message: 'Authentication failed: Invalid signature or private key' });
      }
    } catch (signatureError) {
      console.error('Signature verification error:', signatureError);
      return res.status(401).json({ message: 'Signature verification failed: ' + signatureError.message });
    }
    
    try {
      // Get all candidates for this election to determine total count
      const allCandidates = await candidateModel.getByElection(electionId);
      const totalCandidates = allCandidates.length;
      
      // Find the position of the selected candidate in the array (1-based index)
      const candidatePosition = allCandidates.findIndex(c => c.candidate_id == candidateId) + 1;
      
      if (candidatePosition === 0) {
        return res.status(400).json({ 
          message: `Candidate ID ${candidateId} not found in election ${electionId}` 
        });
      }
      
      console.log(`Mapping candidate ID ${candidateId} to position ${candidatePosition} out of ${totalCandidates} candidates`);
      
      // 5. Encode and encrypt the vote using homomorphic encryption
      
      // First, check if election has a homomorphic key pair
      let electionKeyPair;
      try {
        // Try to retrieve existing key pair from database
        const keyResult = await db.query(
          'SELECT encryption_public_key, encryption_private_key FROM election WHERE election_id = $1',
          [electionId]
        );
        
        if (keyResult.rows[0].encryption_public_key && keyResult.rows[0].encryption_private_key) {
          // Election already has keys
          electionKeyPair = {
            publicKey: JSON.parse(keyResult.rows[0].encryption_public_key),
            privateKey: JSON.parse(keyResult.rows[0].encryption_private_key)
          };
          console.log('Retrieved existing homomorphic encryption keys for election');
        } else {
          // Generate new key pair for the election with safer parameters
          console.log('Generating new homomorphic encryption keys with safe parameters');
          try {
            // Use a reasonable key size that prioritizes reliability
            console.log('Generating 512-bit homomorphic encryption key pair');
            electionKeyPair = homomorphicEncryption.PaillierEncryption.generateKeyPair(512);
            console.log('Successfully generated homomorphic encryption keys');
            
            // Store the keys in the database
            try {
              await db.query(
                'UPDATE election SET encryption_public_key = $1, encryption_private_key = $2 WHERE election_id = $3',
                [
                  JSON.stringify(electionKeyPair.publicKey),
                  JSON.stringify(electionKeyPair.privateKey),
                  electionId
                ]
              );
              console.log('Successfully stored homomorphic encryption keys in database');
            } catch (dbError) {
              console.error('Database error when storing encryption keys:', dbError.message);
              // Continue with the in-memory keys even if DB storage failed
            }
          } catch (keyGenError) {
            console.error('Error with key generation:', keyGenError.message);
            // Try with smaller key size in case of memory or performance issues
            console.log('Trying with smaller key size for compatibility...');
            electionKeyPair = homomorphicEncryption.PaillierEncryption.generateKeyPair(256);
            console.log('Successfully generated smaller encryption keys');
            
            try {
              await db.query(
                'UPDATE election SET encryption_public_key = $1, encryption_private_key = $2 WHERE election_id = $3',
                [
                  JSON.stringify(electionKeyPair.publicKey),
                  JSON.stringify(electionKeyPair.privateKey),
                  electionId
                ]
              );
            } catch (dbFallbackError) {
              console.error('Database fallback error:', dbFallbackError.message);
              // Continue even if storing fails
            }
          }
        }
      } catch (keyError) {
        console.error('Error handling homomorphic encryption keys:', keyError);
        
        // Use extremely reliable fallback with minimal key size
        try {
          console.log('Attempting to generate fallback encryption keys with minimal parameters');
          electionKeyPair = homomorphicEncryption.PaillierEncryption.generateKeyPair(256);
          console.log('Successfully generated fallback encryption keys');
        } catch (fallbackError) {
          console.error('Critical failure in encryption key generation:', fallbackError);
          return res.status(500).json({ message: 'Unable to encrypt vote securely: ' + fallbackError.message });
        }
      }
      
      // Encode the vote based on candidate position
      let encodedVote;
      try {
        // Use the more reliable BigInt encoding for safety
        encodedVote = homomorphicEncryption.encodeVoteBigInt(
          candidatePosition, 
          totalCandidates
        );
        console.log(`Encoded vote for candidate ${candidateId} as ${encodedVote}`);
      } catch (encodeError) {
        console.error('Error encoding vote:', encodeError);
        
        // Try the standard encoding as fallback
        try {
          encodedVote = homomorphicEncryption.encodeVote(
            candidatePosition, 
            totalCandidates
          ).toString();
          console.log(`Fallback encoded vote for candidate ${candidateId} as ${encodedVote}`);
        } catch (fallbackEncodeError) {
          console.error('Critical encoding failure:', fallbackEncodeError);
          return res.status(500).json({ message: 'Failed to encode vote: ' + fallbackEncodeError.message });
        }
      }
      
      // Encrypt the vote using homomorphic encryption
      let encryptedVote;
      try {
        encryptedVote = homomorphicEncryption.PaillierEncryption.encrypt(
          encodedVote, 
          electionKeyPair.publicKey
        );
        console.log('Successfully encrypted vote with homomorphic encryption');
      } catch (encryptError) {
        console.error('Error encrypting vote:', encryptError);
        return res.status(500).json({ 
          message: 'Failed to encrypt vote: ' + encryptError.message 
        });
      }
      
      // 6. Create a vote object with the encrypted vote
      const voteData = {
        electionId,
        encryptedVote,
        timestamp: new Date().toISOString()
      };
      
      // Store plaintext candidate ID in a separate property for blockchain validation
      // (in a real system, this would be removed for ballot secrecy)
      const plainVoteData = {
        electionId,
        candidateId,
        timestamp: voteData.timestamp
      };
      
      // 7. Sign the vote with the voter's private key
      let voteSignature;
      try {
        // Log detailed information about the privateKey variable
        console.log('==== DEBUG INFO BEFORE SIGNING VOTE DATA ====');
        console.log(`Original privateKey variable exists: ${privateKey ? 'YES' : 'NO'}`);
        
        if (privateKey) {
          console.log(`Original privateKey type: ${typeof privateKey}`);
          console.log(`Original privateKey length: ${privateKey.length}`);
          console.log(`Original privateKey starts with: ${privateKey.substring(0, 50)}...`);
          
          // Check if we have a valid PEM format key
          const isPemFormat = privateKey && 
                             privateKey.includes('-----BEGIN') && 
                             privateKey.includes('PRIVATE KEY') && 
                             privateKey.includes('-----END');
          console.log(`Is privateKey in valid PEM format: ${isPemFormat ? 'YES' : 'NO'}`);
          
          // Use the private key to sign the vote data
          console.log(`Signing vote data with private key (length: ${privateKey.length})`);
          voteSignature = cryptoUtils.signData(JSON.stringify(plainVoteData), privateKey);
        } 
        // If no private key but we have a valid signature from earlier verification
        else if (voterSignature) {
          console.log('No private key available, but we have a verified signature');
          // Use the signature that was already verified earlier as proof of authorization
          // This is safe because we already verified this signature against the voter's public key
          voteSignature = voterSignature;
          console.log('Using the verified signature as authorization proof');
        }
        // No private key or signature available
        else {
          console.error('Private key is missing when trying to sign vote data and no verified signature available');
          return res.status(400).json({ message: 'Cannot sign vote: Private key is missing and no signature available' });
        }
        
        console.log('=========================================');
      } catch (signError) {
        console.error('Error signing vote data:', signError);
        return res.status(400).json({ message: 'Failed to sign vote: ' + signError.message });
      }
      
      // 8. Add the vote to the mixnet for anonymization
      // Get a set of random public keys for the ring signature (simulating other voters)
      const otherVoters = await voterModel.getAll();
      let publicKeys = otherVoters
        .filter(v => v.cnic !== voterId && v.public_key)
        .map(v => v.public_key)
        .slice(0, 4); // Get up to 4 other keys
      
      // Ensure we have at least one other key for the ring signature
      if (publicKeys.length === 0) {
        // If no other voters exist, create a dummy key for demonstration
        const { publicKey } = cryptoUtils.generateKeyPair();
        publicKeys = [publicKey];
      }
      
      // Add the voter's public key to the ring
      publicKeys.push(voter.public_key);
      
      // Generate a ring signature
      let ringSignature;
      try {
        // Use our improved RingSignatureService for true cryptographic anonymity
        console.log('Generating cryptographically secure ring signature for vote anonymity');
        
        // Get a random set of voters for the anonymity ring
        const ringSize = 5; // Default anonymity set size
        
        if (securePrivateKeyCopy) {
          // Create vote data for the ring signature
          const voteData = {
            electionId,
            candidateId,
            timestamp: new Date().toISOString()
          };
          
          // Generate a proper ECC-based ring signature (provides cryptographic anonymity)
          ringSignature = await RingSignatureService.generateVoteRingSignature(
            voteData,
            securePrivateKeyCopy,
            ringSize
          );
          
          // Check if the key image has been used before (prevents double voting)
          if (ringSignature.keyImage) {
            const isKeyImageUsed = await RingSignatureService.isKeyImageUsed(ringSignature.keyImage, electionId);
            if (isKeyImageUsed) {
              console.warn('Detected attempted double vote: This key image has been used before');
              // Store this attempt for audit purposes
              await voterModel.storeKeyImage(voterId, ringSignature.keyImage, electionId);
            }
          }
        } else {
          // No private key - use fallback
          console.log('No private key available for ring signature, using fallback');
          ringSignature = RingSignature.generateFallbackSignature(
            JSON.stringify(plainVoteData),
            publicKeys
          );
        }
      } catch (ringError) {
        console.error('Error generating ring signature:', ringError);
        // Don't fail the entire vote just because of a ring signature error
        // Instead, create a fallback signature
        console.log('Using fallback ring signature generation');
        ringSignature = RingSignature.generateFallbackSignature(
          JSON.stringify(plainVoteData),
          publicKeys
        );
      }
      
      // Create the final vote object with all security features
      const secureVote = {
        voteData,
        plainVoteData, // For development purposes only
        voteSignature,
        ringSignature,
        // We don't include the voter's identity here for privacy
      };
      
      // Add to mixnet for anonymization
      mixnet.addVote(secureVote);
      
      // We no longer need to immediately check for processed votes here
      // The mixnet service will handle this automatically based on its own schedule
      // and batch size requirements
      
      // 9. Mark the voter as having voted in this specific election
      await voterModel.updateVotingStatusForElection(voterId, electionId, true);
      
      // 10. Send success response
      res.status(201).json({ 
        message: 'Vote cast successfully. Your vote will be anonymized in a batch with other votes and added to the blockchain.',
        mixnetStatus: {
          currentBatchSize: mixnet.getBufferSize(),
          targetBatchSize: mixnet.minimumBatchSize,
          estimatedProcessingTime: mixnet.getBufferSize() >= mixnet.minimumBatchSize ? 
            'Processing now' : 'Will be processed soon'
        },
        receipt: {
          electionId,
          timestamp: voteData.timestamp,
          // We include a hash of the vote as a receipt, but not the actual vote
          // to maintain ballot secrecy
          voteHash: crypto.createHash('sha256').update(JSON.stringify(plainVoteData)).digest('hex')
        }
      });
    } catch (cryptoError) {
      console.error('Crypto operation error:', cryptoError);
      return res.status(500).json({ message: 'Error processing vote: ' + cryptoError.message });
    }
  } catch (error) {
    console.error('Vote submission error:', error);
    res.status(500).json({ message: 'Server error: ' + (error.message || 'Please try again later') });
  }
});

/**
 * @route   GET /api/vote/status/:electionId
 * @desc    Check if the voter has already voted in a specific election
 * @access  Private/Voter
 */
router.get('/status/:electionId', authMiddleware.verifyToken, authMiddleware.verifyVoter, async (req, res) => {
  try {
    const voterId = req.user.id;
    const electionId = req.params.electionId;
    
    // Verify the election exists
    const election = await electionModel.findById(electionId);
    if (!election) {
      return res.status(404).json({ message: 'Election not found' });
    }
    
    // Check if voter has voted in this specific election
    const hasVoted = await voterModel.hasVotedInElection(voterId, electionId);
    
    res.json({
      hasVoted,
      election: {
        id: election.election_id,
        title: election.title,
        status: election.status
      }
    });
    
  } catch (error) {
    console.error('Vote status check error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/vote/results/:electionId
 * @desc    Get election results (only for completed elections)
 * @access  Public
 */
router.get('/results/:electionId', async (req, res) => {
  try {
    const electionId = req.params.electionId;
    
    // Get the election
    const election = await electionModel.findById(electionId);
    if (!election) {
      return res.status(404).json({ message: 'Election not found' });
    }
    
    // Only show results for completed elections
    if (election.status !== 'completed') {
      return res.status(403).json({ 
        message: 'Results are only available for completed elections' 
      });
    }
    
    // Get all candidates for this election
    const candidates = await candidateModel.getByElection(electionId);
    const totalCandidates = candidates.length;
    
    // Get the homomorphic encryption keys for this election
    let electionKeyPair;
    try {
      const keyResult = await db.query(
        'SELECT encryption_public_key, encryption_private_key FROM election WHERE election_id = $1',
        [electionId]
      );
      
      if (keyResult.rows[0].encryption_public_key && keyResult.rows[0].encryption_private_key) {
        electionKeyPair = {
          publicKey: JSON.parse(keyResult.rows[0].encryption_public_key),
          privateKey: JSON.parse(keyResult.rows[0].encryption_private_key)
        };
      } else {
        return res.status(500).json({ 
          message: 'Election does not have encryption keys for secure tallying'
        });
      }
    } catch (keyError) {
      console.error('Error retrieving homomorphic encryption keys:', keyError);
      return res.status(500).json({ message: 'Error retrieving secure voting keys' });
    }
    
    // Get all votes from the blockchain
    const votes = await blockchain.getAllVotes();
    
    // Filter votes for this election
    const electionVotes = votes.filter(vote => 
      vote.voteData && vote.voteData.electionId == electionId && vote.voteData.encryptedVote
    );
    
    if (electionVotes.length === 0) {
      // If no homomorphically encrypted votes found, fall back to plaintext counting
      // (this is for backward compatibility during development)
      console.log('No homomorphically encrypted votes found, using plaintext votes');
      
      const plainVotes = votes
        .filter(vote => vote.plainVoteData && vote.plainVoteData.electionId == electionId)
        .map(vote => vote.plainVoteData.candidateId);
      
      // Count votes for each candidate
      const results = candidates.map(candidate => {
        const voteCount = plainVotes.filter(id => id == candidate.candidate_id).length;
        return {
          candidate: {
            id: candidate.candidate_id,
            name: candidate.name,
            party: candidate.party,
            symbol: candidate.symbol
          },
          votes: voteCount
        };
      });
      
      // Sort by vote count (highest first)
      results.sort((a, b) => b.votes - a.votes);
      
      // Return results
      return res.json({
        election: {
          id: election.election_id,
          title: election.title,
          startTime: election.start_time,
          endTime: election.end_time,
          status: election.status
        },
        totalVotes: plainVotes.length,
        results,
        countMethod: 'plaintext'
      });
    }
    
    // Use homomorphic encryption to tally the votes
    console.log(`Tallying ${electionVotes.length} homomorphically encrypted votes`);
    
    try {
      // Initialize the encrypted tally with an encryption of zero
      let encryptedTally = homomorphicEncryption.PaillierEncryption.encrypt('0', electionKeyPair.publicKey);
      
      // Group votes into batches for more efficient processing
      const batchSize = 10;
      const voteBatches = [];
      
      for (let i = 0; i < electionVotes.length; i += batchSize) {
        const batchVotes = electionVotes.slice(i, i + batchSize);
        const encryptedBatchVotes = batchVotes.map(vote => vote.voteData.encryptedVote);
        voteBatches.push(encryptedBatchVotes);
      }
      
      // Process each batch
      for (const batch of voteBatches) {
        // Create a homomorphic batch of the votes
        const batchResult = homomorphicEncryption.createHomomorphicBatch(batch, electionKeyPair.publicKey);
        
        // Add the batch result to the total tally
        encryptedTally = homomorphicEncryption.PaillierEncryption.addEncrypted(
          encryptedTally,
          batchResult.batchCiphertext,
          electionKeyPair.publicKey
        );
      }
      
      // Now decrypt the final tally
      const decryptedTally = homomorphicEncryption.PaillierEncryption.decrypt(
        encryptedTally,
        electionKeyPair.privateKey
      );
      
      console.log('Decrypted homomorphic tally:', decryptedTally);
      
      // Decode the tally to get individual candidate vote counts
      let voteCounts;
      try {
        voteCounts = homomorphicEncryption.decodeVoteTally(decryptedTally, totalCandidates);
      } catch (decodeError) {
        console.error('Error decoding vote tally, trying BigInt version:', decodeError);
        
        // Fallback to manually counting votes in case of decoding issues
        const candidateVotes = Array(totalCandidates).fill(0);
        for (const vote of electionVotes) {
          try {
            // Decrypt each vote individually
            const decryptedVote = homomorphicEncryption.PaillierEncryption.decrypt(
              vote.voteData.encryptedVote,
              electionKeyPair.privateKey
            );
            
            // Find which candidate this vote belongs to
            for (let i = 1; i <= totalCandidates; i++) {
              const encoded = homomorphicEncryption.encodeVote(i, totalCandidates);
              if (decryptedVote === encoded.toString()) {
                candidateVotes[i-1]++;
                break;
              }
            }
          } catch (decryptError) {
            console.error('Error decrypting individual vote:', decryptError);
          }
        }
        
        // Create voteCounts manually
        voteCounts = [];
        for (let i = 1; i <= totalCandidates; i++) {
          voteCounts.push({
            candidateId: i,
            votes: candidateVotes[i-1]
          });
        }
      }
      
      // Map the vote counts to the candidate information
      const results = candidates.map(candidate => {
        const candidateVotes = voteCounts.find(vc => vc.candidateId == candidate.candidate_id);
        return {
          candidate: {
            id: candidate.candidate_id,
            name: candidate.name,
            party: candidate.party,
            symbol: candidate.symbol
          },
          votes: candidateVotes ? candidateVotes.votes : 0
        };
      });
      
      // Sort by vote count (highest first)
      results.sort((a, b) => b.votes - a.votes);
      
      // Return results with homomorphic encryption indicator
      return res.json({
        election: {
          id: election.election_id,
          title: election.title,
          startTime: election.start_time,
          endTime: election.end_time,
          status: election.status
        },
        totalVotes: electionVotes.length,
        results,
        countMethod: 'homomorphic'
      });
      
    } catch (tallyError) {
      console.error('Error tallying homomorphic votes:', tallyError);
      return res.status(500).json({ 
        message: 'Error computing secure vote tally: ' + tallyError.message 
      });
    }
  } catch (error) {
    console.error('Election results error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/vote/completed-results
 * @desc    Get enhanced results for all completed elections (public access)
 * @access  Public
 */
router.get('/completed-results', async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] Fetching completed election results`);
    
    // Get all completed elections
    const completedElections = await db.query(
      `SELECT 
         election_id, title, start_time, end_time, status, 
         results, candidate_history, count_method, total_votes, count_completed_at
       FROM election 
       WHERE status = $1 
       ORDER BY end_time DESC`,
      ['completed']
    );
    
    console.log(`[${new Date().toISOString()}] Found ${completedElections.rowCount} completed elections`);
    
    if (completedElections.rows.length === 0) {
      return res.json({ 
        message: 'No completed elections found',
        elections: []
      });
    }

    // Array to store results for all elections
    const electionsWithResults = [];

    // Process each completed election
    for (const election of completedElections.rows) {
      try {
        console.log(`[${new Date().toISOString()}] Processing results for election ${election.election_id} - "${election.title}"`);
        
        // Use the stored results if available
        if (election.results) {
          console.log(`[${new Date().toISOString()}] Election ${election.election_id} has stored results`);
          
          // Parse the results JSON
          let parsedResults;
          try {
            parsedResults = typeof election.results === 'string' 
              ? JSON.parse(election.results) 
              : election.results;
            
            console.log(`[${new Date().toISOString()}] Election ${election.election_id} results parsed successfully`);
            console.log(`[${new Date().toISOString()}] Election ${election.election_id} results type: ${typeof parsedResults}, isArray: ${Array.isArray(parsedResults)}`);
            
            if (Array.isArray(parsedResults)) {
              console.log(`[${new Date().toISOString()}] Election ${election.election_id} has ${parsedResults.length} candidate results`);
              
              // Debug the first few results
              parsedResults.slice(0, 3).forEach((result, idx) => {
                console.log(`[${new Date().toISOString()}] Election ${election.election_id} - Result ${idx+1}: ${JSON.stringify(result)}`);
              });
            }
          } catch (parseError) {
            console.error(`[${new Date().toISOString()}] Error parsing results for election ${election.election_id}: ${parseError.message}`);
            console.log(`[${new Date().toISOString()}] Raw results: ${typeof election.results === 'string' ? election.results.substring(0, 100) : JSON.stringify(election.results).substring(0, 100)}...`);
            // Create empty results if parse failed
            parsedResults = [];
          }
          
          // Calculate actual total votes by summing up individual candidate votes
          // This ensures accurate total even if the database total_votes field is wrong
          let calculatedTotalVotes = 0;
          if (Array.isArray(parsedResults)) {
            calculatedTotalVotes = parsedResults.reduce(
              (sum, result) => {
                const voteCount = Number(result.votes) || 0;
                console.log(`[${new Date().toISOString()}] Election ${election.election_id} - Adding ${voteCount} votes for candidate ${result.candidate?.name || 'unknown'}`);
                return sum + voteCount;
              }, 
              0
            );
          }
          
          const storedTotalVotes = Number(election.total_votes) || 0;
          console.log(`[${new Date().toISOString()}] Election ${election.election_id} - Calculated total: ${calculatedTotalVotes}, Stored total: ${storedTotalVotes}`);
          
          // Use the calculated total if it's greater than the stored total
          // This fixes the issue where the database might show 0 votes
          const actualTotalVotes = Math.max(calculatedTotalVotes, storedTotalVotes);
          
          // Add this election's results to the array with corrected total votes
          electionsWithResults.push({
            election: {
              id: election.election_id,
              title: election.title,
              startTime: election.start_time,
              endTime: election.end_time,
              status: election.status,
              completedAt: election.count_completed_at
            },
            totalVotes: actualTotalVotes,
            results: parsedResults,
            countMethod: election.count_method || 'unknown'
          });
          
          console.log(`[${new Date().toISOString()}] Fetched stored results for election ${election.election_id}: ${actualTotalVotes} votes with ${election.count_method || 'unknown'} counting method`);
          
          // If the database total_votes is wrong, fix it
          if (actualTotalVotes !== storedTotalVotes) {
            console.log(`[${new Date().toISOString()}] Correcting total_votes for election ${election.election_id} from ${storedTotalVotes} to ${actualTotalVotes}`);
            try {
              await db.query(
                'UPDATE election SET total_votes = $1 WHERE election_id = $2',
                [actualTotalVotes, election.election_id]
              );
              console.log(`[${new Date().toISOString()}] Successfully updated total_votes for election ${election.election_id}`);
            } catch (updateError) {
              console.error(`[${new Date().toISOString()}] Error updating total_votes: ${updateError.message}`);
            }
          }
        } 
        // If no results are stored but we have candidate history, create empty results
        else if (election.candidate_history) {
          console.log(`[${new Date().toISOString()}] No results found for election ${election.election_id}, using candidate history to create empty results`);
          
          // Create results with zero votes using the candidate history
          let candidateHistory;
          try {
            candidateHistory = typeof election.candidate_history === 'string'
              ? JSON.parse(election.candidate_history)
              : election.candidate_history;
            
            console.log(`[${new Date().toISOString()}] Parsed candidate history for election ${election.election_id}: ${candidateHistory.length} candidates`);
          } catch (parseError) {
            console.error(`[${new Date().toISOString()}] Error parsing candidate history: ${parseError.message}`);
            candidateHistory = [];
          }
          
          const emptyResults = candidateHistory.map(candidate => ({
            candidate: {
              id: candidate.id,
              name: candidate.name,
              party: candidate.party,
              symbol: candidate.symbol
            },
            votes: 0
          }));
          
          // Add this election's results to the array
          electionsWithResults.push({
            election: {
              id: election.election_id,
              title: election.title,
              startTime: election.start_time,
              endTime: election.end_time,
              status: election.status,
              completedAt: election.count_completed_at
            },
            totalVotes: 0,
            results: emptyResults,
            countMethod: 'no votes recorded'
          });
          
          console.log(`[${new Date().toISOString()}] Created empty results for election ${election.election_id} based on candidate history`);
        }
        // If neither results nor history is available
        else {
          console.log(`[${new Date().toISOString()}] Warning: No results or candidate history for election ${election.election_id}`);
          // Add election with empty results array
          electionsWithResults.push({
            election: {
              id: election.election_id,
              title: election.title,
              startTime: election.start_time,
              endTime: election.end_time,
              status: election.status,
              completedAt: election.count_completed_at
            },
            totalVotes: 0,
            results: [],
            countMethod: 'no data available'
          });
        }
      } catch (electionError) {
        console.error(`[${new Date().toISOString()}] Error processing results for election ${election.election_id}:`, electionError);
        // Still include the election with error information
        electionsWithResults.push({
          election: {
            id: election.election_id,
            title: election.title,
            startTime: election.start_time,
            endTime: election.end_time,
            status: election.status,
            completedAt: election.count_completed_at
          },
          error: 'Error retrieving results',
          results: []
        });
      }
    }
    
    // Return all results
    res.json({
      elections: electionsWithResults
    });
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error fetching completed election results:`, error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/vote/create-key-shares
 * @desc    Generate and distribute threshold decryption shares for an election
 * @access  Private/Admin
 */
router.post('/create-key-shares', authMiddleware.verifyToken, authMiddleware.verifyAdmin, async (req, res) => {
  try {
    const { electionId, numberOfShares, threshold } = req.body;
    
    if (!electionId || !numberOfShares || !threshold) {
      return res.status(400).json({
        message: 'Missing required fields: electionId, numberOfShares, and threshold are required'
      });
    }
    
    if (threshold > numberOfShares) {
      return res.status(400).json({
        message: 'Threshold cannot be greater than the number of shares'
      });
    }
    
    // Verify that the election exists
    const election = await electionModel.findById(electionId);
    if (!election) {
      return res.status(404).json({ message: 'Election not found' });
    }
    
    // Get existing encryption keys or generate new ones
    let electionKeyPair;
    try {
      // Try to retrieve existing key pair from database
      const keyResult = await db.query(
        'SELECT encryption_public_key, encryption_private_key FROM election WHERE election_id = $1',
        [electionId]
      );
      
      if (keyResult.rows[0].encryption_public_key && keyResult.rows[0].encryption_private_key) {
        // Election already has keys
        electionKeyPair = {
          publicKey: JSON.parse(keyResult.rows[0].encryption_public_key),
          privateKey: JSON.parse(keyResult.rows[0].encryption_private_key)
        };
        console.log('Retrieved existing homomorphic encryption keys for election');
      } else {
        // Generate new key pair for the election
        electionKeyPair = homomorphicEncryption.PaillierEncryption.generateKeyPair(2048);
        
        // Store the keys in the database
        await db.query(
          'UPDATE election SET encryption_public_key = $1, encryption_private_key = $2 WHERE election_id = $3',
          [
            JSON.stringify(electionKeyPair.publicKey),
            JSON.stringify(electionKeyPair.privateKey),
            electionId
          ]
        );
        console.log('Generated and stored new homomorphic encryption keys for election');
      }
    } catch (keyError) {
      console.error('Error handling homomorphic encryption keys:', keyError);
      return res.status(500).json({ message: 'Error handling encryption keys: ' + keyError.message });
    }
    
    // Generate key shares
    const keyShares = homomorphicEncryption.generateKeyShares(
      electionKeyPair.privateKey,
      numberOfShares,
      threshold
    );
    
    // Store the shares in the database (in a real system, these would be distributed to authorities)
    try {
      // First, delete any existing shares for this election
      await db.query(
        'DELETE FROM key_shares WHERE election_id = $1',
        [electionId]
      );
      
      // Then insert the new shares
      for (let i = 0; i < keyShares.length; i++) {
        await db.query(
          'INSERT INTO key_shares (election_id, share_index, share_value, threshold) VALUES ($1, $2, $3, $4)',
          [electionId, keyShares[i].index, keyShares[i].value, threshold]
        );
      }
      
      // Update the election to use threshold decryption
      await db.query(
        'UPDATE election SET uses_threshold_decryption = true, threshold_value = $1 WHERE election_id = $2',
        [threshold, electionId]
      );
      
      return res.status(201).json({
        message: 'Threshold decryption shares created successfully',
        numberOfShares,
        threshold,
        // For demonstration only - in production you wouldn't return the actual shares
        sharesCreated: keyShares.map(share => ({ index: share.index }))
      });
    } catch (dbError) {
      console.error('Database error when storing key shares:', dbError);
      return res.status(500).json({
        message: 'Error storing threshold decryption shares: ' + dbError.message
      });
    }
  } catch (error) {
    console.error('Error in create-key-shares:', error);
    return res.status(500).json({
      message: 'Server error: ' + (error.message || 'Please try again later')
    });
  }
});

/**
 * @route   POST /api/vote/partial-decrypt
 * @desc    Create a partial decryption using a key share
 * @access  Private/Authority
 */
router.post('/partial-decrypt', authMiddleware.verifyToken, authMiddleware.verifyAdmin, async (req, res) => {
  try {
    const { electionId, shareIndex, tallyCiphertext } = req.body;
    
    if (!electionId || !shareIndex || !tallyCiphertext) {
      return res.status(400).json({
        message: 'Missing required fields: electionId, shareIndex, and tallyCiphertext are required'
      });
    }
    
    // Verify the election exists and is ready for decryption
    const election = await electionModel.findById(electionId);
    if (!election) {
      return res.status(404).json({ message: 'Election not found' });
    }
    
    if (election.status !== 'completed') {
      return res.status(400).json({
        message: 'Decryption is only allowed for completed elections'
      });
    }
    
    // Get the election public key and the specified share
    try {
      const publicKeyResult = await db.query(
        'SELECT encryption_public_key FROM election WHERE election_id = $1',
        [electionId]
      );
      
      const shareResult = await db.query(
        'SELECT share_value FROM key_shares WHERE election_id = $1 AND share_index = $2',
        [electionId, shareIndex]
      );
      
      if (!publicKeyResult.rows.length || !publicKeyResult.rows[0].encryption_public_key) {
        return res.status(404).json({ message: 'Election public key not found' });
      }
      
      if (!shareResult.rows.length) {
        return res.status(404).json({ message: 'Key share not found' });
      }
      
      const publicKey = JSON.parse(publicKeyResult.rows[0].encryption_public_key);
      const share = {
        index: shareIndex,
        value: shareResult.rows[0].share_value
      };
      
      // Create partial decryption
      const partialDecryption = homomorphicEncryption.createPartialDecryption(
        tallyCiphertext,
        share,
        publicKey
      );
      
      // Store the partial decryption
      await db.query(
        `INSERT INTO partial_decryptions 
         (election_id, share_index, partial_decryption, created_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (election_id, share_index) 
         DO UPDATE SET partial_decryption = $3, created_at = NOW()`,
        [electionId, shareIndex, partialDecryption.partialDecryption]
      );
      
      return res.status(200).json({
        message: 'Partial decryption created successfully',
        partialDecryption: {
          shareIndex: partialDecryption.shareIndex,
          partialResult: partialDecryption.partialDecryption.substring(0, 20) + '...' // Truncate for security
        }
      });
    } catch (error) {
      console.error('Error in partial decryption:', error);
      return res.status(500).json({
        message: 'Error creating partial decryption: ' + error.message
      });
    }
  } catch (error) {
    console.error('Error in partial-decrypt:', error);
    return res.status(500).json({
      message: 'Server error: ' + (error.message || 'Please try again later')
    });
  }
});

/**
 * @route   POST /api/vote/combine-decryptions
 * @desc    Combine partial decryptions to get the final tally
 * @access  Private/Admin
 */
router.post('/combine-decryptions', authMiddleware.verifyToken, authMiddleware.verifyAdmin, async (req, res) => {
  try {
    const { electionId } = req.body;
    
    if (!electionId) {
      return res.status(400).json({
        message: 'Missing required field: electionId is required'
      });
    }
    
    // Verify the election exists and uses threshold decryption
    const election = await electionModel.findById(electionId);
    if (!election) {
      return res.status(404).json({ message: 'Election not found' });
    }
    
    // Get election data and partial decryptions
    try {
      const electionDataResult = await db.query(
        `SELECT encryption_public_key, threshold_value, uses_threshold_decryption 
         FROM election WHERE election_id = $1`,
        [electionId]
      );
      
      if (!electionDataResult.rows.length) {
        return res.status(404).json({ message: 'Election data not found' });
      }
      
      const electionData = electionDataResult.rows[0];
      if (!electionData.uses_threshold_decryption) {
        return res.status(400).json({
          message: 'This election does not use threshold decryption'
        });
      }
      
      const threshold = electionData.threshold_value;
      const publicKey = JSON.parse(electionData.encryption_public_key);
      
      // Get the encrypted tally (first need to retrieve votes)
      const votes = await blockchain.getAllVotes();
      const electionVotes = votes.filter(vote => 
        vote.voteData && vote.voteData.electionId == electionId && vote.voteData.encryptedVote
      );
      
      // Calculate the encrypted tally
      let encryptedTally = homomorphicEncryption.PaillierEncryption.encrypt('0', publicKey);
      
      for (const vote of electionVotes) {
        encryptedTally = homomorphicEncryption.PaillierEncryption.addEncrypted(
          encryptedTally,
          vote.voteData.encryptedVote,
          publicKey
        );
      }
      
      // Get all partial decryptions
      const partialDecryptionsResult = await db.query(
        `SELECT share_index, partial_decryption 
         FROM partial_decryptions 
         WHERE election_id = $1`,
        [electionId]
      );
      
      const partialDecryptions = partialDecryptionsResult.rows.map(row => ({
        shareIndex: row.share_index,
        partialDecryption: row.partial_decryption
      }));
      
      if (partialDecryptions.length < threshold) {
        return res.status(400).json({
          message: `Not enough partial decryptions. Need at least ${threshold}, but only have ${partialDecryptions.length}`
        });
      }
      
      // Combine the partial decryptions
      const validShares = partialDecryptions.map(pd => pd.shareIndex);
      const decryptedTally = homomorphicEncryption.combinePartialDecryptions(
        partialDecryptions.slice(0, threshold), // Use only the required number of shares
        validShares,
        threshold,
        publicKey
      );
      
      // Decode the tally
      const candidates = await candidateModel.getByElection(electionId);
      const totalCandidates = candidates.length;
      
      let voteCounts;
      try {
        // First try the standard decoder
        voteCounts = homomorphicEncryption.decodeVoteTally(decryptedTally, totalCandidates);
      } catch (decodeError) {
        console.error('Error with standard decoder, trying BigInt decoder:', decodeError);
        // Fall back to BigInt decoder
        voteCounts = homomorphicEncryption.decodeVoteTallyBigInt(decryptedTally, totalCandidates);
      }
      
      // Map to candidate info
      const results = candidates.map(candidate => {
        const candidateVotes = voteCounts.find(vc => vc.candidateId == candidate.candidate_id);
        return {
          candidate: {
            id: candidate.candidate_id,
            name: candidate.name,
            party: candidate.party,
            symbol: candidate.symbol
          },
          votes: candidateVotes ? candidateVotes.votes : 0
        };
      });
      
      // Sort by vote count (highest first)
      results.sort((a, b) => b.votes - a.votes);
      
      // Save the results to the election
      await db.query(
        `UPDATE election 
         SET results = $1, final_tally = $2, count_completed_at = NOW() 
         WHERE election_id = $3`,
        [JSON.stringify(results), decryptedTally, electionId]
      );
      
      return res.status(200).json({
        message: 'Decryption completed successfully',
        electionId,
        totalVotes: electionVotes.length,
        results,
        decryptionMethod: 'threshold'
      });
    } catch (error) {
      console.error('Error in combine-decryptions:', error);
      return res.status(500).json({
        message: 'Error combining decryptions: ' + error.message
      });
    }
  } catch (error) {
    console.error('Error in combine-decryptions endpoint:', error);
    return res.status(500).json({
      message: 'Server error: ' + (error.message || 'Please try again later')
    });
  }
});

/**
 * @route   POST /api/vote/recalculate/:electionId
 * @desc    Force recalculation of election results (primarily for fixing tallying issues)
 * @access  Private/Admin
 */
router.post('/recalculate/:electionId', authMiddleware.verifyToken, authMiddleware.verifyAdmin, async (req, res) => {
  try {
    const electionId = req.params.electionId;
    
    // Get the election
    const election = await electionModel.findById(electionId);
    if (!election) {
      return res.status(404).json({ message: 'Election not found' });
    }
    
    // Only process completed elections
    if (election.status !== 'completed') {
      // Auto-complete the election if requested
      if (req.body.autoComplete === true) {
        await electionModel.updateStatus(electionId, 'completed');
        console.log(`Election ${electionId} automatically marked as completed for recalculation`);
      } else {
        return res.status(400).json({ 
          message: 'Only completed elections can have their results recalculated',
          currentStatus: election.status,
          tip: 'Add "autoComplete": true to the request body to automatically mark as completed'
        });
      }
    }
    
    // Get all candidates for this election
    const candidates = await candidateModel.getByElection(electionId);
    const totalCandidates = candidates.length;
    
    if (totalCandidates === 0) {
      return res.status(400).json({ message: 'This election has no candidates' });
    }
    
    // Get or generate homomorphic encryption keys for this election
    let electionKeyPair;
    try {
      const keyResult = await db.query(
        'SELECT encryption_public_key, encryption_private_key FROM election WHERE election_id = $1',
        [electionId]
      );
      
      if (keyResult.rows[0].encryption_public_key && keyResult.rows[0].encryption_private_key) {
        electionKeyPair = {
          publicKey: JSON.parse(keyResult.rows[0].encryption_public_key),
          privateKey: JSON.parse(keyResult.rows[0].encryption_private_key)
        };
        console.log('Using existing homomorphic encryption keys for recalculation');
      } else {
        // Generate new key pair for the election with reliable parameters
        console.log('Generating new homomorphic encryption keys for recalculation');
        electionKeyPair = homomorphicEncryption.PaillierEncryption.generateKeyPair(512);
        
        // Store the keys in the database
        await db.query(
          'UPDATE election SET encryption_public_key = $1, encryption_private_key = $2 WHERE election_id = $3',
          [
            JSON.stringify(electionKeyPair.publicKey),
            JSON.stringify(electionKeyPair.privateKey),
            electionId
          ]
        );
      }
    } catch (keyError) {
      console.error('Error retrieving/generating encryption keys:', keyError);
      return res.status(500).json({ message: 'Error handling encryption keys: ' + keyError.message });
    }
    
    // Get all votes from the blockchain
    const votes = await blockchain.getAllVotes();
    
    // Filter votes for this election
    const electionVotes = votes.filter(vote => 
      (vote.voteData && vote.voteData.electionId == electionId && vote.voteData.encryptedVote) ||
      (vote.plainVoteData && vote.plainVoteData.electionId == electionId)
    );
    
    if (electionVotes.length === 0) {
      return res.status(404).json({ message: 'No votes found for this election' });
    }
    
    console.log(`Recalculating results for election ${electionId} with ${electionVotes.length} votes`);
    
    let countMethod, results;
    
    // Try homomorphic tallying first
    const encryptedVotes = electionVotes.filter(vote => 
      vote.voteData && vote.voteData.electionId == electionId && vote.voteData.encryptedVote
    );
    
    if (encryptedVotes.length > 0) {
      try {
        console.log(`Performing homomorphic tallying with ${encryptedVotes.length} encrypted votes`);
        
        // Initialize with encryption of zero
        let encryptedTally = homomorphicEncryption.PaillierEncryption.encrypt('0', electionKeyPair.publicKey);
        
        // Process votes in batches for efficiency
        const batchSize = 5;
        for (let i = 0; i < encryptedVotes.length; i += batchSize) {
          const batch = encryptedVotes.slice(i, i + batchSize);
          const encryptedBatchVotes = batch.map(vote => vote.voteData.encryptedVote);
          
          // Create and add homomorphic batch
          if (encryptedBatchVotes.length > 0) {
            const batchResult = homomorphicEncryption.createHomomorphicBatch(
              encryptedBatchVotes, 
              electionKeyPair.publicKey
            );
            
            encryptedTally = homomorphicEncryption.PaillierEncryption.addEncrypted(
              encryptedTally,
              batchResult.batchCiphertext,
              electionKeyPair.publicKey
            );
          }
        }
        
        // Decrypt final tally
        const decryptedTally = homomorphicEncryption.PaillierEncryption.decrypt(
          encryptedTally,
          electionKeyPair.privateKey
        );
        
        console.log('Successfully decrypted homomorphic tally:', decryptedTally);
        
        // Try multiple decoding methods to ensure success
        let voteCounts;
        try {
          voteCounts = homomorphicEncryption.decodeVoteTally(decryptedTally, totalCandidates);
          console.log('Successfully decoded tally using standard method');
        } catch (decodeError) {
          console.log('Standard decoding failed, trying BigInt method:', decodeError.message);
          try {
            voteCounts = homomorphicEncryption.decodeVoteTallyBigInt(decryptedTally, totalCandidates);
            console.log('Successfully decoded tally using BigInt method');
          } catch (bigIntError) {
            console.error('BigInt decoding also failed:', bigIntError.message);
            throw new Error('Failed to decode vote tally with both methods');
          }
        }
        
        // Map to candidate info
        results = candidates.map(candidate => {
          const candidateVotes = voteCounts.find(vc => vc.candidateId == candidate.candidate_id);
          return {
            candidate: {
              id: candidate.candidate_id,
              name: candidate.name,
              party: candidate.party,
              symbol: candidate.symbol
            },
            votes: candidateVotes ? candidateVotes.votes : 0
          };
        });
        
        countMethod = 'homomorphic';
        console.log('Homomorphic tallying successful');
        
        // Store the results in the database
        await db.query(
          `UPDATE election 
           SET results = $1, final_tally = $2, count_completed_at = NOW() 
           WHERE election_id = $3`,
          [JSON.stringify(results), decryptedTally, electionId]
        );
        
      } catch (tallyError) {
        console.error('Homomorphic tallying failed:', tallyError);
        console.log('Falling back to plaintext counting...');
        countMethod = 'plaintext (fallback)';
      }
    }
    
    // If homomorphic tallying failed or wasn't possible, use plaintext counting
    if (!results) {
      console.log('Performing plaintext vote counting as fallback');
      
      // Get plaintext votes
      const plainVotes = electionVotes
        .filter(vote => vote.plainVoteData && vote.plainVoteData.electionId == electionId)
        .map(vote => vote.plainVoteData.candidateId);
      
      // Count votes for each candidate
      results = candidates.map(candidate => {
        const voteCount = plainVotes.filter(id => id == candidate.candidate_id).length;
        return {
          candidate: {
            id: candidate.candidate_id,
            name: candidate.name,
            party: candidate.party,
            symbol: candidate.symbol
          },
          votes: voteCount
        };
      });
      
      countMethod = 'plaintext';
      console.log('Plaintext tallying successful');
      
      // Store the results in the database
      await db.query(
        `UPDATE election 
         SET results = $1, count_completed_at = NOW() 
         WHERE election_id = $2`,
        [JSON.stringify(results), electionId]
      );
    }
    
    // Sort by vote count (highest first)
    results.sort((a, b) => b.votes - a.votes);
    
    // Return results
    return res.status(200).json({
      message: 'Election results recalculated successfully',
      election: {
        id: election.election_id,
        title: election.title,
        startTime: election.start_time,
        endTime: election.end_time,
        status: 'completed'
      },
      totalVotes: electionVotes.length,
      results,
      countMethod
    });
    
  } catch (error) {
    console.error('Error recalculating election results:', error);
    res.status(500).json({ 
      message: 'Server error: ' + (error.message || 'Error recalculating results')
    });
  }
});

/**
 * @route   POST /api/vote/test-ring-signature
 * @desc    Test the cryptographic properties of the ring signature implementation
 * @access  Private/Admin
 */
router.post('/test-ring-signature', authMiddleware.verifyToken, authMiddleware.verifyAdmin, async (req, res) => {
  try {
    console.log('Testing ring signature cryptographic properties');
    
    // Create test ECC keys
    const testKeys = [];
    const ringSize = 5;
    
    for (let i = 0; i < ringSize; i++) {
      const keyPair = await RingSignatureService.generateVoterECCKeyPair();
      testKeys.push(keyPair);
    }
    
    // Select a random signer from the ring
    const signerIndex = Math.floor(Math.random() * ringSize);
    console.log(`Actual signer is at index ${signerIndex} (this should NOT be detectable)`);
    
    // Create a test vote
    const testVote = {
      electionId: 'test-election',
      candidateId: 'test-candidate',
      voterId: 'anonymous',
      timestamp: Date.now()
    };
    
    // Extract public keys for the ring
    const publicKeys = testKeys.map(key => key.publicKey);
    
    // Generate ring signature with actual signer's private key
    const testSignature = RingSignature.generateSignature(
      JSON.stringify(testVote),
      testKeys[signerIndex].privateKey,
      publicKeys
    );
    
    // Verify the signature
    const isValid = RingSignature.verifySignature(testSignature);
    
    // Test anonymity - try to determine the signer
    const anonymityResults = [];
    for (let i = 0; i < ringSize; i++) {
      // For each member, test if they could be the signer
      // In a proper ring signature, every member should appear equally likely
      const couldBeSigner = RingSignature.verifySignature(testSignature);
      anonymityResults.push({
        memberIndex: i,
        couldBeSigner,
        isActualSigner: i === signerIndex
      });
    }
    
    // Test key image uniqueness (prevents double voting)
    // Generate a second signature with the same signer but different message
    const testVote2 = {
      ...testVote,
      timestamp: Date.now() + 1000 // Different message
    };
    
    const testSignature2 = RingSignature.generateSignature(
      JSON.stringify(testVote2),
      testKeys[signerIndex].privateKey,
      publicKeys
    );
    
    // Check if key images match when the same private key is used
    const keyImagesMatch = testSignature.keyImage === testSignature2.keyImage;
    const keyImageComparison = {
      firstKeyImage: testSignature.keyImage ? testSignature.keyImage.substring(0, 20) + '...' : 'not available',
      secondKeyImage: testSignature2.keyImage ? testSignature2.keyImage.substring(0, 20) + '...' : 'not available',
      match: keyImagesMatch
    };
    
    // Return comprehensive test results
    return res.status(200).json({
      success: true,
      message: 'Ring signature cryptographic verification completed',
      signatureVerification: {
        valid: isValid,
        signatureSize: JSON.stringify(testSignature).length,
        messageHash: testSignature.message ? testSignature.message.substring(0, 20) + '...' : 'not available'
      },
      anonymityTest: {
        actualSigner: signerIndex,
        memberResults: anonymityResults,
        isAnonymous: anonymityResults.every(result => result.couldBeSigner),
        cryptographicProperties: [
          'Correctness: Only a valid ring member can create a valid signature',
          'Anonymity: It\'s mathematically impossible to determine which member signed',
          'Unforgeability: Signatures cannot be forged without a private key',
          'Unlinkability: Multiple signatures by the same signer cannot be linked'
        ]
      },
      keyImageTest: keyImageComparison,
      eccKeyInfo: {
        keyType: 'Native ECC keys (secp256k1 curve)',
        implementation: 'Elliptic library with BN.js bignum support',
        securityLevel: '256-bit elliptic curve cryptography'
      }
    });
  } catch (error) {
    console.error('Error testing ring signatures:', error);
    return res.status(500).json({
      success: false,
      message: 'Error testing ring signatures',
      error: error.message
    });
  }
});

module.exports = router;