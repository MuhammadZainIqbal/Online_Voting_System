const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import routes
const authRoutes = require('./routes/auth.routes');
const electionRoutes = require('./routes/election.routes');
const candidateRoutes = require('./routes/candidate.routes');
const voteRoutes = require('./routes/vote.routes');
const blockchainRoutes = require('./routes/blockchain.routes');
const homomorphicRoutes = require('./routes/homomorphic.routes');

// Import blockchain, mixnet and config
const blockchain = require('./blockchain/blockchain');
const blockchainConfig = require('./config/blockchain.config');
const authorityNode = require('./blockchain/authority');
const mixnet = require('./crypto/mixnet');

// Initialize express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json({
  // Increase JSON payload size limit for blockchain data
  limit: '5mb'
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/elections', electionRoutes);
app.use('/api/candidates', candidateRoutes);
app.use('/api/vote', voteRoutes);
app.use('/api/blockchain', blockchainRoutes);
app.use('/api/homomorphic', homomorphicRoutes);

// Default route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Online Voting System API' });
});

// Initialize blockchain node
async function initializeBlockchain() {
  try {
    // Initialize with node URL from config (or environment)
    await blockchain.initialize(
      blockchainConfig.blockchain.nodeUrl,
      blockchainConfig.blockchain.isAuthority,
      blockchainConfig.blockchain.nodeId
    );
    
    // Connect to the blockchain network if seed nodes are configured
    if (blockchainConfig.blockchain.seedNodes && blockchainConfig.blockchain.seedNodes.length > 0) {
      await blockchain.connectToNetwork(blockchainConfig.blockchain.seedNodes);
      console.log(`Connected to blockchain network with ${blockchain.node.peers.size} peers`);
    }
    
    console.log(`Blockchain node initialized: ${blockchain.node.nodeId}`);
    console.log(`Node type: ${blockchain.node.isAuthority ? 'Authority (Validator)' : 'Regular'}`);
    console.log(`Consensus method: ${blockchain.consensusMethod}`);
    
    // Start authority node processing if this is an authority node
    if (blockchain.node.isAuthority) {
      await authorityNode.start();
      console.log('Authority node processing started');
    }
  } catch (error) {
    console.error('Failed to initialize blockchain:', error);
  }
}

// Handle mixnet processed votes - adds to blockchain after anonymization
function setupMixnetProcessing() {
  // Override the mixnet process votes method to add votes to blockchain after processing
  const originalProcessVotes = mixnet.processVotes;
  mixnet.processVotes = function() {
    const shuffledVotes = originalProcessVotes.call(this);
    
    // Add the processed votes to the blockchain
    if (shuffledVotes.length > 0) {
      console.log(`Adding batch of ${shuffledVotes.length} anonymized votes to blockchain`);
      
      // Add each vote to the blockchain
      shuffledVotes.forEach(async (vote) => {
        try {
          if (blockchain.node) {
            // Submit to the network for processing and validation by authority nodes
            blockchain.node.addPendingTransaction(vote);
          } else {
            // Legacy mode: add directly to local blockchain
            await blockchain.addBlock(vote);
          }
        } catch (error) {
          console.error('Error adding vote to blockchain:', error);
        }
      });
    }
    
    return shuffledVotes;
  };
  
  // Also override forceProcessVotes to handle votes the same way
  const originalForceProcessVotes = mixnet.forceProcessVotes;
  mixnet.forceProcessVotes = function() {
    const shuffledVotes = originalForceProcessVotes.call(this);
    
    // Add the processed votes to the blockchain
    if (shuffledVotes.length > 0) {
      console.log(`Force adding batch of ${shuffledVotes.length} anonymized votes to blockchain`);
      
      // Add each vote to the blockchain
      shuffledVotes.forEach(async (vote) => {
        try {
          if (blockchain.node) {
            // Submit to the network for processing and validation by authority nodes
            blockchain.node.addPendingTransaction(vote);
          } else {
            // Legacy mode: add directly to local blockchain
            await blockchain.addBlock(vote);
          }
        } catch (error) {
          console.error('Error force adding vote to blockchain:', error);
        }
      });
    }
    
    return shuffledVotes;
  };
}

// Set port and start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  
  // Initialize blockchain after server starts
  await initializeBlockchain();
  
  // Start mixnet processing for vote anonymization
  mixnet.start();
  console.log('Mixnet processing started - collecting votes in batches of 3 for anonymity');
  
  // Setup mixnet processing to handle votes and add to blockchain
  setupMixnetProcessing();
  
  // Database connection is already established when the module is imported
  console.log('Connected to PostgreSQL database');
  
  // Run validation for all completed elections to detect and fix inconsistent vote counts
  try {
    const electionModel = require('./models/election.model');
    // First update statuses to make sure completed elections are marked properly
    await electionModel.updateElectionStatuses();
    // Then check and fix any elections with inconsistent vote counts
    await electionModel.checkAndFixElectionResults();
  } catch (error) {
    console.error('Error during election validation:', error);
  }
});