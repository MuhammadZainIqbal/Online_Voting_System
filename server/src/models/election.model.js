const db = require('../database');
const candidateModel = require('./candidate.model');

// Add a timestamp to track when we last updated election statuses
let lastStatusUpdate = 0;
const STATUS_UPDATE_INTERVAL = 60000; // Only update statuses once per minute

const electionModel = {
  // Create a new election
  async create(title, startTime, endTime) {
    // Validate that end time is after start time
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    
    if (endDate <= startDate) {
      throw new Error('End time must be after start time');
    }
    
    const status = startDate > new Date() ? 'upcoming' : 
                  (endDate < new Date() ? 'completed' : 'active');
    
    const query = `
      INSERT INTO election (title, start_time, end_time, status)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const values = [title, startTime, endTime, status];
    const result = await db.query(query, values);
    return result.rows[0];
  },

  // Get election by ID
  async findById(electionId) {
    // Check if we need to update statuses
    await this.checkAndUpdateStatuses();
    
    const query = 'SELECT * FROM election WHERE election_id = $1';
    const result = await db.query(query, [electionId]);
    return result.rows[0];
  },

  // Get all elections
  async getAll() {
    // Check if we need to update statuses
    await this.checkAndUpdateStatuses();
    
    const query = 'SELECT * FROM election ORDER BY start_time DESC';
    const result = await db.query(query);
    return result.rows;
  },

  // Get active elections
  async getActive() {
    // Check if we need to update statuses
    await this.checkAndUpdateStatuses();
    
    const query = 'SELECT * FROM election WHERE status = $1';
    const result = await db.query(query, ['active']);
    return result.rows;
  },

  // Check if we need to update election statuses based on time interval
  async checkAndUpdateStatuses() {
    const now = Date.now();
    if (now - lastStatusUpdate > STATUS_UPDATE_INTERVAL) {
      await this.updateElectionStatuses();
      lastStatusUpdate = now;
    }
  },

  // Check and update election statuses based on current time
  async updateElectionStatuses() {
    const now = new Date();
    console.log(`[${new Date().toISOString()}] Checking election statuses, current time: ${now}`);
    
    // Update upcoming elections to active if start time has passed
    const upcomingToActiveQuery = `
      UPDATE election 
      SET status = 'active' 
      WHERE status = 'upcoming' AND start_time <= $1
    `;
    await db.query(upcomingToActiveQuery, [now]);
    
    // Get elections that need to be marked as completed
    const electionsToComplete = `
      SELECT election_id 
      FROM election 
      WHERE status = 'active' AND end_time <= $1
    `;
    const completedElectionsResult = await db.query(electionsToComplete, [now]);
    console.log(`[${new Date().toISOString()}] Found ${completedElectionsResult.rowCount} elections to complete`);
    
    // For each newly completed election, process results before deleting candidates
    for (const row of completedElectionsResult.rows) {
      const electionId = row.election_id;
      try {
        console.log(`[${new Date().toISOString()}] Processing completion of election ${electionId}`);
        
        // First, store candidate information for historical records
        const candidates = await candidateModel.getByElection(electionId);
        
        if (candidates.length === 0) {
          console.log(`[${new Date().toISOString()}] Warning: No candidates found for election ${electionId}`);
        } else {
          console.log(`[${new Date().toISOString()}] Found ${candidates.length} candidates for election ${electionId}`);
          
          // Create a simplified historical record of candidates before deletion
          const candidateHistory = candidates.map(c => ({
            id: c.candidate_id,
            name: c.name,
            party: c.party,
            symbol: c.symbol
          }));
          
          // Store candidate history in election record
          await db.query(
            `UPDATE election SET candidate_history = $1 WHERE election_id = $2`,
            [JSON.stringify(candidateHistory), electionId]
          );
          console.log(`[${new Date().toISOString()}] Election ${electionId}: Saved candidate history with ${candidateHistory.length} candidates`);
          
          // Make sure results are calculated and stored before removing candidates
          try {
            // Fetch tally method to use
            const blockchain = require('../blockchain/blockchain');
            const homomorphicEncryption = require('../crypto/homomorphicEncryption');
            
            // Get the election encryption keys
            const keyResult = await db.query(
              'SELECT encryption_public_key, encryption_private_key FROM election WHERE election_id = $1',
              [electionId]
            );
            
            console.log(`[${new Date().toISOString()}] Election ${electionId}: Checking for encryption keys`);
            
            if (keyResult.rows.length > 0 && keyResult.rows[0].encryption_public_key && keyResult.rows[0].encryption_private_key) {
              const electionKeyPair = {
                publicKey: JSON.parse(keyResult.rows[0].encryption_public_key),
                privateKey: JSON.parse(keyResult.rows[0].encryption_private_key)
              };
              console.log(`[${new Date().toISOString()}] Election ${electionId}: Found encryption keys`);
              
              // Get votes from blockchain
              const votes = await blockchain.getAllVotes();
              console.log(`[${new Date().toISOString()}] Election ${electionId}: Retrieved ${votes.length} total votes from blockchain`);
              
              // Filter votes for this election
              const electionVotes = votes.filter(vote => 
                (vote.voteData && vote.voteData.electionId == electionId && vote.voteData.encryptedVote) ||
                (vote.plainVoteData && vote.plainVoteData.electionId == electionId)
              );
              
              console.log(`[${new Date().toISOString()}] Election ${electionId}: Found ${electionVotes.length} votes for this election`);
              console.log(`[${new Date().toISOString()}] Election ${electionId}: Vote breakdown - ${electionVotes.filter(v => v.voteData && v.voteData.encryptedVote).length} encrypted, ${electionVotes.filter(v => v.plainVoteData).length} plaintext`);
              
              let results;
              let countMethod = 'plaintext';
              
              if (electionVotes.length === 0) {
                console.log(`[${new Date().toISOString()}] Election ${electionId}: No votes found, creating empty results`);
                // Create empty results if no votes found
                results = candidates.map(candidate => ({
                  candidate: {
                    id: candidate.candidate_id,
                    name: candidate.name,
                    party: candidate.party,
                    symbol: candidate.symbol
                  },
                  votes: 0
                }));
              } else {
                // First try homomorphic tallying
                const encryptedVotes = electionVotes.filter(vote => 
                  vote.voteData && vote.voteData.electionId == electionId && vote.voteData.encryptedVote
                );
                
                if (encryptedVotes.length > 0) {
                  try {
                    console.log(`[${new Date().toISOString()}] Election ${electionId}: Performing homomorphic tallying with ${encryptedVotes.length} encrypted votes`);
                    console.log(`[${new Date().toISOString()}] Election ${electionId}: Sample encrypted vote: ${JSON.stringify(encryptedVotes[0].voteData).substring(0, 100)}...`);
                    
                    // Group votes by timestamp to prevent counting duplicates
                    const votesByTimestamp = {};
                    encryptedVotes.forEach(vote => {
                      if (vote.voteData && vote.voteData.timestamp) {
                        if (!votesByTimestamp[vote.voteData.timestamp]) {
                          votesByTimestamp[vote.voteData.timestamp] = [];
                        }
                        votesByTimestamp[vote.voteData.timestamp].push(vote);
                      }
                    });
                    
                    // Only use one vote per timestamp
                    const dedupedVotes = [];
                    Object.keys(votesByTimestamp).forEach(timestamp => {
                      // Just take the first vote for each timestamp
                      dedupedVotes.push(votesByTimestamp[timestamp][0]);
                    });
                    
                    console.log(`[${new Date().toISOString()}] Election ${electionId}: After deduplication, using ${dedupedVotes.length} unique votes out of ${encryptedVotes.length} total`);
                    
                    // Initialize with encryption of zero
                    let encryptedTally = homomorphicEncryption.PaillierEncryption.encrypt('0', electionKeyPair.publicKey);
                    
                    // Process votes in batches
                    const batchSize = 5;
                    for (let i = 0; i < dedupedVotes.length; i += batchSize) {
                      const batch = dedupedVotes.slice(i, i + batchSize);
                      const encryptedBatchVotes = batch.map(vote => vote.voteData.encryptedVote);
                      
                      if (encryptedBatchVotes.length > 0) {
                        console.log(`[${new Date().toISOString()}] Election ${electionId}: Processing batch ${Math.floor(i/batchSize) + 1} with ${encryptedBatchVotes.length} votes`);
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
                    
                    // Decrypt tally
                    const decryptedTally = homomorphicEncryption.PaillierEncryption.decrypt(
                      encryptedTally,
                      electionKeyPair.privateKey
                    );
                    
                    console.log(`[${new Date().toISOString()}] Election ${electionId}: Decrypted tally result: ${decryptedTally}`);
                    
                    // Try multiple decoding methods
                    let voteCounts;
                    try {
                      voteCounts = homomorphicEncryption.decodeVoteTally(decryptedTally, candidates.length);
                      console.log(`[${new Date().toISOString()}] Election ${electionId}: Successfully decoded tally using standard method`);
                      
                      // Log individual vote counts for debugging
                      voteCounts.forEach(vc => {
                        console.log(`[${new Date().toISOString()}] Election ${electionId}: Candidate ${vc.candidateId} has ${vc.votes} votes`);
                      });
                      
                    } catch (decodeError) {
                      console.log(`[${new Date().toISOString()}] Election ${electionId}: Standard decoding failed, trying BigInt method: ${decodeError.message}`);
                      try {
                        voteCounts = homomorphicEncryption.decodeVoteTallyBigInt(decryptedTally, candidates.length);
                        console.log(`[${new Date().toISOString()}] Election ${electionId}: Successfully decoded tally using BigInt method`);
                        
                        // Log individual vote counts for debugging
                        voteCounts.forEach(vc => {
                          console.log(`[${new Date().toISOString()}] Election ${electionId}: Candidate ${vc.candidateId} has ${vc.votes} votes`);
                        });
                      } catch (bigIntError) {
                        console.error(`[${new Date().toISOString()}] Election ${electionId}: BigInt decoding also failed: ${bigIntError.message}`);
                        throw new Error(`Failed to decode tally: ${bigIntError.message}`);
                      }
                    }
                    
                    // Map to candidate info
                    results = candidates.map((candidate, index) => {
                      // In homomorphic encryption, candidates are encoded by position (1-based index)
                      // not by their actual candidate_id
                      const candidatePosition = index + 1;
                      const candidateVotes = voteCounts.find(vc => vc.candidateId == candidatePosition);
                      const votes = candidateVotes ? candidateVotes.votes : 0;
                      console.log(`[${new Date().toISOString()}] Election ${electionId}: Mapping candidate ${candidate.candidate_id} (${candidate.name}) with ${votes} votes (position ${candidatePosition})`);
                      
                      return {
                        candidate: {
                          id: candidate.candidate_id,
                          name: candidate.name,
                          party: candidate.party,
                          symbol: candidate.symbol
                        },
                        votes: votes
                      };
                    });
                    
                    countMethod = 'homomorphic';
                    console.log(`[${new Date().toISOString()}] Election ${electionId}: Homomorphic tallying successful`);
                    
                  } catch (tallyError) {
                    console.error(`[${new Date().toISOString()}] Election ${electionId}: Homomorphic tallying failed: ${tallyError.message}`);
                    console.error(tallyError.stack);
                    console.log(`[${new Date().toISOString()}] Election ${electionId}: Falling back to plaintext counting`);
                    // Will fall back to plaintext counting below
                  }
                }
                
                // If homomorphic tallying failed or wasn't possible, use plaintext counting
                if (!results) {
                  console.log(`[${new Date().toISOString()}] Election ${electionId}: Performing plaintext vote counting`);
                  
                  // Get plaintext votes
                  const plainVotes = electionVotes
                    .filter(vote => vote.plainVoteData && vote.plainVoteData.electionId == electionId)
                    .map(vote => vote.plainVoteData.candidateId);
                  
                  console.log(`[${new Date().toISOString()}] Election ${electionId}: Found ${plainVotes.length} plaintext votes`);
                  if (plainVotes.length > 0) {
                    console.log(`[${new Date().toISOString()}] Election ${electionId}: Sample plaintext vote for candidate: ${plainVotes[0]}`);
                  }
                  
                  // Count votes for each candidate
                  results = candidates.map(candidate => {
                    const voteCount = plainVotes.filter(id => id == candidate.candidate_id).length;
                    console.log(`[${new Date().toISOString()}] Election ${electionId}: Candidate ${candidate.candidate_id} (${candidate.name}) has ${voteCount} plaintext votes`);
                    
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
                  
                  console.log(`[${new Date().toISOString()}] Election ${electionId}: Plaintext tallying successful with ${plainVotes.length} votes`);
                }
              }
              
              // Sort by vote count (highest first)
              results.sort((a, b) => b.votes - a.votes);
              
              // Convert any non-numeric vote counts to numbers and round them to integers
              results = results.map(result => ({
                ...result,
                votes: Math.round(Number(result.votes) || 0)
              }));
              
              // Calculate total votes after rounding to ensure consistency
              const totalVotes = results.reduce((sum, result) => sum + result.votes, 0);
              console.log(`[${new Date().toISOString()}] Election ${electionId}: Calculated total votes after rounding: ${totalVotes}`);
              
              // Store results in election record
              const resultsJson = JSON.stringify(results);
              console.log(`[${new Date().toISOString()}] Election ${electionId}: Storing results JSON with length ${resultsJson.length}`);
              
              await db.query(
                `UPDATE election 
                 SET results = $1, count_method = $2, total_votes = $3, count_completed_at = NOW() 
                 WHERE election_id = $4`,
                [resultsJson, countMethod, totalVotes, electionId]
              );
              
              console.log(`[${new Date().toISOString()}] Election ${electionId}: Results saved successfully. Total votes: ${totalVotes}`);
              
              // Verify results were stored correctly
              const verifyResult = await db.query(
                'SELECT results, total_votes FROM election WHERE election_id = $1',
                [electionId]
              );
              
              if (!verifyResult.rows[0].results) {
                console.error(`[${new Date().toISOString()}] Election ${electionId}: WARNING - Results may not have been stored properly!`);
              } else {
                const storedTotalVotes = verifyResult.rows[0].total_votes;
                console.log(`[${new Date().toISOString()}] Election ${electionId}: Results storage verified successfully. Stored total: ${storedTotalVotes}`);
                
                if (storedTotalVotes !== totalVotes) {
                  console.error(`[${new Date().toISOString()}] Election ${electionId}: WARNING - Total votes mismatch! Expected ${totalVotes}, got ${storedTotalVotes}`);
                  // Fix the total votes if there's a mismatch
                  await db.query(
                    'UPDATE election SET total_votes = $1 WHERE election_id = $2',
                    [totalVotes, electionId]
                  );
                  console.log(`[${new Date().toISOString()}] Election ${electionId}: Fixed total votes count to ${totalVotes}`);
                }
              }
              
            } else {
              console.error(`[${new Date().toISOString()}] Election ${electionId}: No encryption keys found, unable to tally properly`);
            }
          } catch (tallyError) {
            console.error(`[${new Date().toISOString()}] Election ${electionId}: Error in result calculation: ${tallyError.message}`);
            console.error(tallyError.stack);
          }
        }
        
        // Now that results are safely stored, delete the candidates
        await candidateModel.deleteByElection(electionId);
        console.log(`[${new Date().toISOString()}] Election ${electionId}: All candidates removed after saving results`);
        
      } catch (error) {
        console.error(`[${new Date().toISOString()}] Error processing completion of election ${electionId}: ${error.message}`);
        console.error(error.stack);
      }
    }
    
    // Update active elections to completed if end time has passed
    const activeToCompletedQuery = `
      UPDATE election 
      SET status = 'completed' 
      WHERE status = 'active' AND end_time <= $1
    `;
    await db.query(activeToCompletedQuery, [now]);
  },

  // Check if any active or upcoming elections exist
  async hasActiveOrUpcomingElections() {
    const query = "SELECT COUNT(*) as count FROM election WHERE status IN ('active', 'upcoming')";
    const result = await db.query(query);
    return parseInt(result.rows[0].count) > 0;
  },

  // Update election status
  async updateStatus(electionId, status) {
    const query = 'UPDATE election SET status = $1 WHERE election_id = $2 RETURNING *';
    const result = await db.query(query, [status, electionId]);
    return result.rows[0];
  },

  // Update election details
  async update(electionId, title, startTime, endTime, status) {
    // Validate that end time is after start time
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    
    if (endDate <= startDate) {
      throw new Error('End time must be after start time');
    }
    
    const query = `
      UPDATE election 
      SET title = $1, start_time = $2, end_time = $3, status = $4
      WHERE election_id = $5
      RETURNING *
    `;
    const values = [title, startTime, endTime, status, electionId];
    const result = await db.query(query, values);
    return result.rows[0];
  },

  // Check all completed elections for valid results and fix if needed
  async checkAndFixElectionResults() {
    try {
      console.log(`[${new Date().toISOString()}] Checking all completed elections for valid results`);
      
      // Get all completed elections
      const completedElectionsQuery = `
        SELECT election_id, title, total_votes 
        FROM election 
        WHERE status = 'completed'
      `;
      const completedElections = await db.query(completedElectionsQuery);
      
      console.log(`[${new Date().toISOString()}] Found ${completedElections.rowCount} completed elections to check`);
      
      for (const election of completedElections.rows) {
        const electionId = election.election_id;
        const totalVotes = election.total_votes || 0;
        
        // Get the actual vote count from blockchain
        const blockchain = require('../blockchain/blockchain');
        const votes = await blockchain.getAllVotes();
        
        // Filter votes for this election
        const electionVotes = votes.filter(vote => 
          (vote.voteData && vote.voteData.electionId == electionId) ||
          (vote.plainVoteData && vote.plainVoteData.electionId == electionId)
        );
        
        const blockchainVoteCount = electionVotes.length;
        
        // Check if there's a significant discrepancy between stored total and actual votes
        if (blockchainVoteCount > 0 && totalVotes === 0) {
          console.log(`[${new Date().toISOString()}] Election ${electionId} (${election.title}) has inconsistent votes: ${totalVotes} stored but ${blockchainVoteCount} in blockchain`);
          
          // We found votes in blockchain but 0 votes in the results - this election needs fixing
          try {
            // Call the existing regeneration logic for this election
            const candidates = await this.regenerateElectionResults(electionId);
            console.log(`[${new Date().toISOString()}] Successfully regenerated results for election ${electionId}`);
          } catch (error) {
            console.error(`[${new Date().toISOString()}] Error regenerating results for election ${electionId}: ${error.message}`);
          }
        } else {
          console.log(`[${new Date().toISOString()}] Election ${electionId} (${election.title}) results appear valid: ${totalVotes} stored votes`);
        }
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error in checkAndFixElectionResults: ${error.message}`);
    }
  },
  
  // Regenerate election results from blockchain
  async regenerateElectionResults(electionId) {
    console.log(`[${new Date().toISOString()}] Regenerating results for election ${electionId}`);
    
    // Get the election details
    const election = await this.findById(electionId);
    if (!election) {
      throw new Error(`Election ${electionId} not found`);
    }
    
    // Get candidate history from database
    let candidates = [];
    if (election.candidate_history) {
      if (typeof election.candidate_history === 'string') {
        candidates = JSON.parse(election.candidate_history);
      } else if (typeof election.candidate_history === 'object') {
        candidates = Array.isArray(election.candidate_history) 
          ? election.candidate_history 
          : Object.values(election.candidate_history);
      }
    }
    
    // If no candidates in history, try to get from candidates table
    if (candidates.length === 0) {
      const candidateModel = require('./candidate.model');
      const candidatesFromDb = await candidateModel.getByElection(electionId);
      candidates = candidatesFromDb.map(c => ({
        id: c.candidate_id,
        name: c.name,
        party: c.party,
        symbol: c.symbol
      }));
    }
    
    if (candidates.length === 0) {
      throw new Error(`No candidate information available for election ${electionId}`);
    }
    
    // Get votes from blockchain
    const blockchain = require('../blockchain/blockchain');
    const votes = await blockchain.getAllVotes();
    
    // Filter votes for this election
    const electionVotes = votes.filter(vote => 
      (vote.voteData && vote.voteData.electionId == electionId && vote.voteData.encryptedVote) ||
      (vote.plainVoteData && vote.plainVoteData.electionId == electionId)
    );
    
    console.log(`[${new Date().toISOString()}] Election ${electionId}: Found ${electionVotes.length} vote records in blockchain`);
    
    // Use a more robust deduplication approach based on timestamps and transaction IDs
    const uniqueVoterVotes = new Map(); // Maps voter ID or timestamp to candidateId
    
    // First pass: extract all information about votes
    const voteInfo = electionVotes.map(vote => {
      const info = {
        blockId: vote.blockId || null,
        timestamp: null,
        candidateId: null,
        voterId: null,
        isEncrypted: false,
        isPlaintext: false
      };
      
      if (vote.plainVoteData && vote.plainVoteData.electionId == electionId) {
        info.timestamp = vote.plainVoteData.timestamp;
        info.candidateId = vote.plainVoteData.candidateId;
        info.isPlaintext = true;
        // Extract voter ID if it exists in the data
        if (vote.plainVoteData.voterId) {
          info.voterId = vote.plainVoteData.voterId;
        }
      }
      
      if (vote.voteData && vote.voteData.electionId == electionId) {
        // If we didn't get a timestamp from plainVoteData, use the one from voteData
        if (!info.timestamp && vote.voteData.timestamp) {
          info.timestamp = vote.voteData.timestamp;
        }
        if (vote.voteData.encryptedVote) {
          info.isEncrypted = true;
        }
      }
      
      return info;
    });
    
    console.log(`[${new Date().toISOString()}] Election ${electionId}: Extracted info for ${voteInfo.length} votes`);
    
    // Group votes by timestamp to identify duplicates
    const votesByTimestamp = {};
    voteInfo.forEach(info => {
      if (info.timestamp) {
        if (!votesByTimestamp[info.timestamp]) {
          votesByTimestamp[info.timestamp] = [];
        }
        votesByTimestamp[info.timestamp].push(info);
      }
    });
    
    // Count how many votes have duplicate timestamps
    let duplicateTimestampCount = 0;
    Object.keys(votesByTimestamp).forEach(timestamp => {
      if (votesByTimestamp[timestamp].length > 1) {
        duplicateTimestampCount += votesByTimestamp[timestamp].length - 1;
      }
    });
    
    console.log(`[${new Date().toISOString()}] Election ${electionId}: Found ${duplicateTimestampCount} duplicate timestamp entries`);
    
    // Extract deduplicated candidate votes - prefer plaintext votes when available
    const uniqueVotes = [];
    Object.keys(votesByTimestamp).forEach(timestamp => {
      const votesForTimestamp = votesByTimestamp[timestamp];
      
      // Prefer plaintext votes (more reliable)
      const plaintextVotes = votesForTimestamp.filter(v => v.isPlaintext && v.candidateId);
      if (plaintextVotes.length > 0) {
        // If multiple plaintext votes exist with same timestamp (shouldn't happen), take the first
        uniqueVotes.push(plaintextVotes[0].candidateId);
      }
    });
    
    console.log(`[${new Date().toISOString()}] Election ${electionId}: After timestamp-based deduplication, found ${uniqueVotes.length} unique votes`);
    
    // Count votes for each candidate
    const results = candidates.map(candidate => {
      const candidateId = candidate.id;
      // Count actual votes for this candidate
      const voteCount = uniqueVotes.filter(id => id == candidateId).length;
      
      console.log(`[${new Date().toISOString()}] Election ${electionId}: Candidate ${candidateId} (${candidate.name}) has ${voteCount} deduplicated votes`);
      
      return {
        candidate: {
          id: candidateId,
          name: candidate.name,
          party: candidate.party,
          symbol: candidate.symbol
        },
        votes: voteCount
      };
    });
    
    // Sort by vote count (highest first)
    results.sort((a, b) => b.votes - a.votes);
    
    // Calculate total votes
    const totalVotes = results.reduce((sum, result) => sum + result.votes, 0);
    
    // Store results in election record
    const resultsJson = JSON.stringify(results);
    await db.query(
      `UPDATE election 
       SET results = $1, count_method = $2, total_votes = $3
       WHERE election_id = $4`,
      [resultsJson, 'auto regenerated', totalVotes, electionId]
    );
    
    console.log(`[${new Date().toISOString()}] Election ${electionId}: Updated with ${totalVotes} votes`);
    return candidates;
  },

  // Add encryption keys to an election
  async addEncryptionKeys(electionId, keySize = 2048) {
    try {
      // Import our election crypto service
      const electionCryptoService = require('../services/electionCrypto.service');
      
      // Generate a new key pair for this election
      const keys = await electionCryptoService.generateElectionKeys(electionId, keySize);
      
      // Store only the public key in the database
      // The private key will be stored securely by the electionCryptoService
      const query = `
        UPDATE election 
        SET encryption_public_key = $1, key_size = $2
        WHERE election_id = $3
        RETURNING *
      `;
      
      const values = [JSON.stringify(keys.publicKey), keySize, electionId];
      const result = await db.query(query, values);
      
      console.log(`[${new Date().toISOString()}] Added encryption keys for election ${electionId}`);
      return result.rows[0];
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error adding encryption keys for election ${electionId}:`, error);
      throw new Error(`Failed to add encryption keys: ${error.message}`);
    }
  },

  // Update the encrypted tally for an election
  async updateEncryptedTally(electionId, encryptedTally) {
    try {
      const query = `
        UPDATE election 
        SET encrypted_tally = $1, tally_last_updated = NOW()
        WHERE election_id = $2
        RETURNING *
      `;
      const values = [encryptedTally, electionId];
      const result = await db.query(query, values);
      
      console.log(`[${new Date().toISOString()}] Updated encrypted tally for election ${electionId}`);
      return result.rows[0];
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error updating encrypted tally for election ${electionId}:`, error);
      throw new Error(`Failed to update encrypted tally: ${error.message}`);
    }
  },

  // Get the encrypted tally for an election
  async getEncryptedTally(electionId) {
    try {
      const query = 'SELECT encrypted_tally FROM election WHERE election_id = $1';
      const result = await db.query(query, [electionId]);
      
      if (result.rows.length === 0) {
        throw new Error(`Election ${electionId} not found`);
      }
      
      return result.rows[0].encrypted_tally;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error getting encrypted tally for election ${electionId}:`, error);
      throw new Error(`Failed to get encrypted tally: ${error.message}`);
    }
  },
};

module.exports = electionModel;