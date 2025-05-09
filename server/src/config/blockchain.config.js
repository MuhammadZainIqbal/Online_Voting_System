/**
 * Blockchain Configuration for Decentralized Network
 */

module.exports = {
  blockchain: {
    // Default configuration for the blockchain
    difficulty: 2,
    
    // Proof of Authority settings
    consensus: 'poa',
    requiredSignatures: 1, // Minimum signatures needed to accept a block
    
    // Network configuration
    networkId: 'secure-voting-chain',
    
    // Seed nodes for initial connection (validators)
    seedNodes: [
      // In a production system, you would include actual URLs here
      // e.g., 'https://validator1.voting-system.com', 'https://validator2.voting-system.com'
    ],
    
    // Authority settings
    isAuthority: process.env.IS_AUTHORITY === 'true' || true, // Default to true for development
    
    // Node settings
    nodeUrl: process.env.NODE_URL || `http://localhost:${process.env.PORT || 3001}`,
    nodeId: process.env.NODE_ID,
    
    // Block time settings
    blockInterval: 2000, // Changed from 10000ms to 2000ms (2 seconds) for faster processing
    
    // Authority rewards (not used in voting system but could be added)
    enableRewards: false,
    
    // Partial node synchronization
    partialSync: false
  },
  
  // Security settings for blockchain
  security: {
    // Maximum block size
    maxBlockSize: 1024 * 1024, // 1MB limit
    
    // Rate limiting
    maxTransactionsPerSecond: 10,
    
    // Signature validation timeout
    signatureValidationTimeout: 5000 // ms
  },
  
  // Storage settings
  storage: {
    persistChain: true, // Save chain to database
    backupInterval: 3600000, // Backup chain every hour
    
    // Chain pruning (remove old blocks to save space)
    enablePruning: false,
    pruneBlocksOlderThan: 30 * 24 * 60 * 60 * 1000, // 30 days
  }
};