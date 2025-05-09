/**
 * Blockchain Node API Routes
 * Handles peer-to-peer communication between nodes
 */

const express = require('express');
const router = express.Router();
const blockchain = require('../blockchain/blockchain');
const config = require('../config/blockchain.config');
const crypto = require('crypto');

// Middleware to ensure blockchain is initialized
const ensureBlockchainInitialized = async (req, res, next) => {
  if (!blockchain.initialized) {
    try {
      await blockchain.initialize(
        config.blockchain.nodeUrl,
        config.blockchain.isAuthority,
        config.blockchain.nodeId
      );
      next();
    } catch (error) {
      console.error('Failed to initialize blockchain:', error);
      return res.status(500).json({ error: 'Blockchain initialization failed' });
    }
  } else {
    next();
  }
};

// Apply middleware to all routes
router.use(ensureBlockchainInitialized);

// Get node information
router.get('/node/info', (req, res) => {
  if (!blockchain.node) {
    return res.status(500).json({ error: 'Node not initialized' });
  }
  
  // Create response with node information
  const nodeInfo = {
    nodeId: blockchain.node.nodeId,
    status: blockchain.node.status,
    isAuthority: blockchain.node.isAuthority,
    url: blockchain.node.url,
    // Only include public key if this is an authority node
    publicKey: blockchain.node.isAuthority ? blockchain.node.authorityKeyPair?.publicKey : undefined,
    peerCount: blockchain.node.peers.size,
    blockchainLength: blockchain.chain.length,
    consensusMethod: blockchain.consensusMethod
  };
  
  res.json(nodeInfo);
});

// Get peers list
router.get('/node/peers', (req, res) => {
  if (!blockchain.node) {
    return res.status(500).json({ error: 'Node not initialized' });
  }
  
  const peers = blockchain.node.getPeers();
  res.json(peers);
});

// Register a new peer
router.post('/node/peers', async (req, res) => {
  const { url, nodeId, isAuthority } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'Peer URL is required' });
  }
  
  if (!blockchain.node) {
    return res.status(500).json({ error: 'Node not initialized' });
  }
  
  // Add the peer
  const success = blockchain.node.addPeer(url, nodeId, isAuthority);
  
  // If this is an authority peer, we need to get its public key
  if (success && isAuthority) {
    try {
      const response = await fetch(`${url}/api/blockchain/node/info`);
      if (response.ok) {
        const nodeInfo = await response.json();
        if (nodeInfo.publicKey) {
          blockchain.authorityNodes.set(nodeId, nodeInfo.publicKey);
        }
      }
    } catch (error) {
      console.error(`Failed to get authority key from ${url}:`, error);
    }
  }
  
  res.json({ success, peersCount: blockchain.node.peers.size });
});

// Node status (for heartbeat)
router.get('/node/status', (req, res) => {
  if (!blockchain.node) {
    return res.status(500).json({ error: 'Node not initialized' });
  }
  
  res.json({ status: blockchain.node.status });
});

// Get the latest block
router.get('/blockchain/latestBlock', async (req, res) => {
  try {
    const latestBlock = await blockchain.getLatestBlock();
    res.json({
      hash: latestBlock.hash,
      previousHash: latestBlock.previousHash,
      timestamp: latestBlock.timestamp,
      blockNumber: blockchain.chain.length - 1,
      validatorId: latestBlock.validatorId || null
    });
  } catch (error) {
    console.error('Error getting latest block:', error);
    res.status(500).json({ error: 'Failed to get latest block' });
  }
});

// Get the full blockchain
router.get('/blockchain/chain', async (req, res) => {
  try {
    // Optionally support a startBlock parameter for partial sync
    const startBlock = parseInt(req.query.startBlock) || 0;
    
    if (startBlock < 0 || startBlock >= blockchain.chain.length) {
      return res.status(400).json({ error: 'Invalid start block' });
    }
    
    // Return the requested portion of the chain
    const chainPortion = blockchain.chain.slice(startBlock);
    
    res.json(chainPortion);
  } catch (error) {
    console.error('Error getting blockchain:', error);
    res.status(500).json({ error: 'Failed to get blockchain' });
  }
});

// Sync blockchain from the network
router.post('/blockchain/sync', async (req, res) => {
  try {
    const syncResult = await blockchain.syncWithNetwork();
    res.json({ success: syncResult });
  } catch (error) {
    console.error('Error syncing blockchain:', error);
    res.status(500).json({ error: 'Failed to sync blockchain' });
  }
});

// Receive a new block from a peer
router.post('/blockchain/block', async (req, res) => {
  try {
    const { block, sender } = req.body;
    
    if (!block || !sender) {
      return res.status(400).json({ error: 'Missing block data or sender' });
    }
    
    // Process the received block
    const result = await blockchain.receiveBlock(block, sender);
    
    res.json(result);
  } catch (error) {
    console.error('Error receiving block:', error);
    res.status(500).json({ error: 'Failed to process received block' });
  }
});

// Submit a new transaction (vote)
router.post('/blockchain/transaction', async (req, res) => {
  try {
    const { transaction } = req.body;
    
    if (!transaction) {
      return res.status(400).json({ error: 'Missing transaction data' });
    }
    
    // Add the transaction to pending queue
    if (blockchain.node) {
      blockchain.node.addPendingTransaction(transaction);
      return res.json({ success: true, status: 'Transaction added to queue' });
    } else {
      // If node not initialized, add directly to blockchain
      await blockchain.addBlock(transaction);
      return res.json({ success: true, status: 'Transaction added to blockchain' });
    }
  } catch (error) {
    console.error('Error adding transaction:', error);
    res.status(500).json({ error: 'Failed to add transaction' });
  }
});

// Force process pending transactions
router.post('/blockchain/process-pending', async (req, res) => {
  try {
    if (!blockchain.node) {
      return res.status(500).json({ error: 'Node not initialized' });
    }
    
    // Get count of pending transactions before processing
    const pendingCount = blockchain.node.pendingTransactions.length;
    
    if (pendingCount === 0) {
      return res.json({ 
        success: true, 
        message: 'No pending transactions to process' 
      });
    }
    
    // Import the authority module
    const authorityNode = require('../blockchain/authority');
    
    // Force process pending transactions
    await authorityNode.processPendingTransactions();
    
    res.json({ 
      success: true, 
      message: `Processed pending transactions`, 
      processed: pendingCount - blockchain.node.pendingTransactions.length 
    });
  } catch (error) {
    console.error('Error processing transactions:', error);
    res.status(500).json({ error: 'Failed to process transactions: ' + error.message });
  }
});

// Get pending transactions (for debugging)
router.get('/blockchain/pending-transactions', (req, res) => {
  if (!blockchain.node) {
    return res.status(500).json({ error: 'Node not initialized' });
  }
  
  const pendingCount = blockchain.node.pendingTransactions.length;
  // Only send first 5 for security/performance, just to see what's there
  const pending = blockchain.node.pendingTransactions.slice(0, 5).map(tx => {
    // Create a simplified view that doesn't expose sensitive data
    return {
      type: tx.voteData ? 'vote' : 'transaction',
      timestamp: tx.voteData?.timestamp || new Date().toISOString(),
      electionId: tx.voteData?.electionId
    };
  });
  
  res.json({ 
    count: pendingCount,
    transactions: pending
  });
});

module.exports = router;