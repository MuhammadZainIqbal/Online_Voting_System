/**
 * Blockchain Authority Node Scheduler
 * Processes pending transactions and maintains blockchain integrity
 */

// Import required modules
const blockchain = require('../blockchain/blockchain');
const config = require('../config/blockchain.config');

class BlockchainAuthority {
  constructor() {
    this.processingInterval = null;
    this.syncInterval = null;
    this.isProcessing = false;
    this.syncInProgress = false;
  }

  /**
   * Start the authority node processing
   */
  async start() {
    if (!blockchain.node || !blockchain.node.isAuthority) {
      console.warn('Cannot start authority processing on a non-authority node');
      return false;
    }

    console.log(`Starting blockchain authority node processing (Node ID: ${blockchain.node.nodeId})`);
    
    // Start periodic transaction processing
    this.processingInterval = setInterval(() => {
      this.processPendingTransactions();
    }, config.blockchain.blockInterval || 10000); // Default to 10 seconds
    
    // Start periodic blockchain synchronization
    this.syncInterval = setInterval(() => {
      this.syncBlockchain();
    }, 60000); // Sync every minute
    
    return true;
  }

  /**
   * Stop the authority node processing
   */
  stop() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    console.log('Stopped blockchain authority node processing');
    return true;
  }

  /**
   * Process any pending transactions into blocks
   */
  async processPendingTransactions() {
    // Prevent concurrent processing
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    try {
      // Check if there are pending transactions
      if (!blockchain.node || blockchain.node.pendingTransactions.length === 0) {
        this.isProcessing = false;
        return;
      }
      
      console.log(`Processing ${blockchain.node.pendingTransactions.length} pending transactions`);
      
      // Get transactions to process (lowered from 10 to 1 to process votes immediately)
      const batchSize = 1;
      const transactions = blockchain.node.pendingTransactions.splice(0, batchSize);
      
      // Process transactions in batch if possible
      if (transactions.length > 1 && typeof blockchain.addBatch === 'function') {
        await blockchain.addBatch(transactions);
      } else {
        // Process transactions individually
        for (const transaction of transactions) {
          await blockchain.addBlock(transaction);
        }
      }
      
      console.log(`Successfully processed ${transactions.length} transactions`);
    } catch (error) {
      console.error('Error processing pending transactions:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Sync the blockchain with the network
   */
  async syncBlockchain() {
    // Prevent concurrent syncing
    if (this.syncInProgress) return;
    
    this.syncInProgress = true;
    
    try {
      if (!blockchain.node || blockchain.node.peers.size === 0) {
        this.syncInProgress = false;
        return;
      }
      
      console.log('Synchronizing blockchain with network peers...');
      await blockchain.syncWithNetwork();
    } catch (error) {
      console.error('Error synchronizing blockchain:', error);
    } finally {
      this.syncInProgress = false;
    }
  }
}

// Create a singleton instance
const authorityNode = new BlockchainAuthority();

module.exports = authorityNode;