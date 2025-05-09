const crypto = require('crypto');
const db = require('../database');
const BlockchainNode = require('./node');
const EventEmitter = require('events');
const config = require('../config/blockchain.config');

class Block {
  constructor(data, previousHash = '') {
    this.timestamp = new Date().toISOString();
    this.data = data; // This will be the encrypted vote
    this.previousHash = previousHash;
    this.nonce = 0;
    this.hash = this.calculateHash();
    this.signature = null; // Authority signature for PoA
    this.validatorId = null; // ID of authority node that validated this block
  }

  calculateHash() {
    return crypto
      .createHash('sha256')
      .update(
        this.timestamp + 
        JSON.stringify(this.data) + 
        this.previousHash + 
        this.nonce.toString()
      )
      .digest('hex');
  }

  // Simple Proof of Work implementation (can be adjusted for difficulty)
  mineBlock(difficulty = 2) {
    const target = Array(difficulty + 1).join('0');
    
    while (this.hash.substring(0, difficulty) !== target) {
      this.nonce++;
      this.hash = this.calculateHash();
    }

    console.log(`Block mined: ${this.hash}`);
    return this.hash;
  }
  
  // Set the authority signature on this block
  setSignature(signature, validatorId) {
    this.signature = signature;
    this.validatorId = validatorId;
    return this;
  }
}

class Blockchain {
  constructor() {
    this.chain = [];
    this.initialized = false;
    this.events = new EventEmitter();
    
    // Decentralized networking
    this.node = null;
    this.consensusMethod = 'poa'; // Proof of Authority
    this.authorityNodes = new Map(); // nodeId -> publicKey
    this.pendingBlocks = new Map(); // hash -> block
    this.requiredSignatures = 1; // Minimum required signatures to validate a block
  }

  async initialize(nodeUrl, isAuthority = false, nodeId = null) {
    if (this.initialized) return;
    
    // Create the node
    this.node = new BlockchainNode(nodeId, nodeUrl, isAuthority);
    
    // Initialize as authority if needed
    if (isAuthority) {
      await this.node.initializeAuthority();
      // Add self to authority list
      if (this.node.authorityKeyPair) {
        this.authorityNodes.set(this.node.nodeId, this.node.authorityKeyPair.publicKey);
      }
    }
    
    // Set node event handlers
    this.node.events.on('newTransaction', this._handleNewTransaction.bind(this));
    
    // Try to load the blockchain from the database
    const result = await db.query('SELECT * FROM blockchain ORDER BY block_id ASC');
    
    if (result.rows.length === 0) {
      // If no blocks exist, create genesis block
      await this.createGenesisBlock();
    } else {
      // Load existing chain
      this.chain = result.rows.map(row => {
        const block = {
          timestamp: row.timestamp,
          data: row.data,
          previousHash: row.previous_hash,
          hash: row.hash,
          nonce: row.nonce,
          signature: row.signature || null,
          validatorId: row.validator_id || null
        };
        
        // Add calculate hash method for validation
        block.calculateHash = () => {
          return crypto
            .createHash('sha256')
            .update(
              block.timestamp + 
              JSON.stringify(block.data) + 
              block.previousHash + 
              block.nonce.toString()
            )
            .digest('hex');
        };
        
        return block;
      });
    }
    
    this.initialized = true;
    return this;
  }

  async createGenesisBlock() {
    const genesisBlock = new Block({ message: "Genesis Block" }, "0");
    genesisBlock.mineBlock(2);
    
    // If this is an authority node, sign the genesis block
    if (this.node && this.node.isAuthority) {
      const signature = this.node.signBlock(genesisBlock);
      genesisBlock.setSignature(signature, this.node.nodeId);
    }
    
    // Save genesis block to database
    await db.query(
      'INSERT INTO blockchain (previous_hash, timestamp, data, hash, nonce, signature, validator_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [
        genesisBlock.previousHash, 
        genesisBlock.timestamp, 
        genesisBlock.data, 
        genesisBlock.hash, 
        genesisBlock.nonce,
        genesisBlock.signature,
        genesisBlock.validatorId
      ]
    );
    
    this.chain.push(genesisBlock);
  }

  async getLatestBlock() {
    if (!this.initialized) await this.initialize();
    return this.chain[this.chain.length - 1];
  }

  async addBlock(newBlockData) {
    if (!this.initialized) await this.initialize();
    
    const latestBlock = await this.getLatestBlock();
    const newBlock = new Block(newBlockData, latestBlock.hash);
    newBlock.mineBlock(2); // Mine with difficulty 2
    
    // For decentralized operation, broadcast the proposed block
    if (this.node) {
      // If this is an authority node, sign the block
      if (this.node.isAuthority) {
        try {
          const signature = this.node.signBlock(newBlock);
          newBlock.setSignature(signature, this.node.nodeId);
        } catch (error) {
          console.error('Failed to sign block:', error);
        }
      }
      
      // Broadcast to other nodes
      await this.broadcastBlock(newBlock);
      
      // If not enough authority nodes, proceed with adding the block
      // In a real network, we'd wait for consensus
      if (this.node.getAuthorityPeers().length < this.requiredSignatures) {
        console.log('Not enough authority nodes, proceeding with block addition');
        return await this._saveAndAddBlock(newBlock);
      } else {
        // Add to pending blocks and wait for signatures
        this.pendingBlocks.set(newBlock.hash, {
          block: newBlock,
          signatures: new Map(),
          timestamp: Date.now()
        });
        
        // In a real implementation, we'd wait for consensus before adding
        // For now, we'll add the block after a short delay
        setTimeout(async () => {
          const pending = this.pendingBlocks.get(newBlock.hash);
          if (pending) {
            this.pendingBlocks.delete(newBlock.hash);
            await this._saveAndAddBlock(pending.block);
          }
        }, 2000);
        
        return newBlock;
      }
    } else {
      // Legacy mode - directly save the block
      return await this._saveAndAddBlock(newBlock);
    }
  }
  
  async _saveAndAddBlock(newBlock) {
    // Save the new block to the database
    await db.query(
      'INSERT INTO blockchain (previous_hash, timestamp, data, hash, nonce, signature, validator_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [
        newBlock.previousHash, 
        newBlock.timestamp, 
        newBlock.data, 
        newBlock.hash, 
        newBlock.nonce,
        newBlock.signature,
        newBlock.validatorId
      ]
    );
    
    this.chain.push(newBlock);
    
    // Emit event
    this.events.emit('newBlock', newBlock);
    
    return newBlock;
  }

  // Broadcast a block to network
  async broadcastBlock(block) {
    if (!this.node) return false;
    
    try {
      // Broadcast to all peers
      await this.node.broadcastToPeers('/api/blockchain/block', {
        block,
        sender: this.node.nodeId
      });
      
      return true;
    } catch (error) {
      console.error('Block broadcast failed:', error);
      return false;
    }
  }
  
  // Process an incoming block from another node
  async receiveBlock(blockData, senderId) {
    if (!this.initialized) await this.initialize();
    
    const block = new Block(blockData.data, blockData.previousHash);
    block.timestamp = blockData.timestamp;
    block.nonce = blockData.nonce;
    block.hash = blockData.hash;
    block.signature = blockData.signature;
    block.validatorId = blockData.validatorId;
    
    // Verify the hash is valid
    if (block.calculateHash() !== block.hash) {
      console.error('Received block has invalid hash');
      return { success: false, error: 'Invalid block hash' };
    }
    
    // Verify the block links to our chain
    const latestBlock = await this.getLatestBlock();
    if (block.previousHash !== latestBlock.hash) {
      // This block doesn't connect to our chain
      // In a real implementation, we'd handle chain conflicts and forks
      console.error('Received block does not connect to the current chain');
      return { success: false, error: 'Block does not connect to chain' };
    }
    
    // If this is an authority node and the block doesn't have a signature,
    // sign it and broadcast again
    if (this.node && this.node.isAuthority && !block.signature) {
      try {
        const signature = this.node.signBlock(block);
        block.setSignature(signature, this.node.nodeId);
        
        // Broadcast the signed block
        await this.broadcastBlock(block);
      } catch (error) {
        console.error('Failed to sign received block:', error);
      }
    }
    
    // Add block to the chain
    await this._saveAndAddBlock(block);
    
    return { success: true, block };
  }
  
  // Verify signature on a block
  verifyBlockSignature(block) {
    if (!block.signature || !block.validatorId) return false;
    
    // Get the validator's public key
    const validatorPublicKey = this.authorityNodes.get(block.validatorId);
    if (!validatorPublicKey) return false;
    
    // Verify signature
    return this.node.verifyBlockSignature(
      block.hash,
      block.signature,
      validatorPublicKey
    );
  }

  async isChainValid() {
    if (!this.initialized) await this.initialize();
    
    // Check if chain has at least 2 blocks
    if (this.chain.length < 2) return true;
    
    // Start from the second block
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];
      
      // Validate hash
      if (currentBlock.hash !== currentBlock.calculateHash()) {
        return false;
      }
      
      // Validate chain linkage
      if (currentBlock.previousHash !== previousBlock.hash) {
        return false;
      }
      
      // Verify block signature if using PoA
      if (this.consensusMethod === 'poa' && 
          currentBlock.signature && 
          !this.verifyBlockSignature(currentBlock)) {
        return false;
      }
    }
    
    return true;
  }

  // Get all votes from the blockchain (for counting)
  async getAllVotes() {
    if (!this.initialized) await this.initialize();
    
    // Skip genesis block
    const votes = this.chain.slice(1).map(block => block.data);
    return votes;
  }
  
  // Get votes for a specific election
  async getVotesByElection(electionId) {
    if (!this.initialized) await this.initialize();
    
    // Skip genesis block and filter votes for the specified election
    const votes = this.chain.slice(1)
      .map(block => block.data)
      .filter(vote => 
        (vote.voteData && vote.voteData.electionId == electionId) ||
        (vote.plainVoteData && vote.plainVoteData.electionId == electionId)
      );
    
    return votes;
  }
  
  // Connect to the network
  async connectToNetwork(seedNodes = []) {
    if (!this.node) {
      console.error('Node not initialized, cannot connect to network');
      return false;
    }
    
    console.log(`Connecting to blockchain network with ${seedNodes.length} seed nodes`);
    
    // Connect to seed nodes
    for (const seedUrl of seedNodes) {
      try {
        const response = await fetch(`${seedUrl}/api/node/info`);
        if (response.ok) {
          const nodeInfo = await response.json();
          this.node.addPeer(seedUrl, nodeInfo.nodeId, nodeInfo.isAuthority);
          
          // If this is an authority node, add to our authority list
          if (nodeInfo.isAuthority && nodeInfo.publicKey) {
            this.authorityNodes.set(nodeInfo.nodeId, nodeInfo.publicKey);
          }
          
          // Fetch their peer list
          const peersResponse = await fetch(`${seedUrl}/api/node/peers`);
          if (peersResponse.ok) {
            const peers = await peersResponse.json();
            for (const peer of peers) {
              this.node.addPeer(peer.url, peer.nodeId, peer.isAuthority);
              
              if (peer.isAuthority) {
                // Get authority public key
                try {
                  const authResponse = await fetch(`${peer.url}/api/node/info`);
                  if (authResponse.ok) {
                    const authInfo = await authResponse.json();
                    if (authInfo.publicKey) {
                      this.authorityNodes.set(peer.nodeId, authInfo.publicKey);
                    }
                  }
                } catch (error) {
                  console.error(`Failed to get authority info from ${peer.url}:`, error);
                }
              }
            }
          }
        }
      } catch (error) {
        console.error(`Failed to connect to seed node ${seedUrl}:`, error);
      }
    }
    
    // Set node to active
    this.node.status = 'active';
    
    // Start periodic peer check
    setInterval(() => {
      this.node.checkPeersStatus();
    }, 60000); // Check every minute
    
    return true;
  }
  
  // Handle new transaction from node
  _handleNewTransaction(transaction) {
    console.log('New transaction received:', transaction);
    // Process the transaction and eventually add to blockchain
    // For votes, this would trigger adding to the blockchain
    this.addBlock(transaction).catch(error => {
      console.error('Failed to add transaction to blockchain:', error);
    });
  }
  
  // Sync chain with the network
  async syncWithNetwork() {
    if (!this.node || this.node.peers.size === 0) {
      return false;
    }
    
    const latestBlock = await this.getLatestBlock();
    let foundLongerChain = false;
    
    // Ask peers for their latest block
    for (const [url, _] of this.node.peers) {
      try {
        const response = await fetch(`${url}/api/blockchain/latestBlock`);
        if (response.ok) {
          const peerLatestBlock = await response.json();
          
          // If peer has longer chain, sync with them
          if (peerLatestBlock.blockNumber > this.chain.length) {
            await this.syncFromPeer(url);
            foundLongerChain = true;
            break;
          }
        }
      } catch (error) {
        console.error(`Failed to get latest block from ${url}:`, error);
      }
    }
    
    return foundLongerChain;
  }
  
  // Sync blockchain from a specific peer
  async syncFromPeer(peerUrl) {
    try {
      const response = await fetch(`${peerUrl}/api/blockchain/chain`);
      if (response.ok) {
        const peerChain = await response.json();
        
        // Verify the peer chain is valid
        if (this._verifyPeerChain(peerChain)) {
          // Replace our chain with peer chain
          await this._replaceChain(peerChain);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error(`Failed to sync from peer ${peerUrl}:`, error);
      return false;
    }
  }
  
  // Verify a chain received from a peer
  _verifyPeerChain(peerChain) {
    // Implement chain validation logic
    // For now, we'll just check if it's longer than our chain
    return peerChain.length > this.chain.length;
  }
  
  // Replace our chain with a new one
  async _replaceChain(newChain) {
    // Clear existing chain from database
    await db.query('TRUNCATE blockchain');
    
    // Insert new chain
    for (const block of newChain) {
      await db.query(
        'INSERT INTO blockchain (previous_hash, timestamp, data, hash, nonce, signature, validator_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [
          block.previousHash, 
          block.timestamp, 
          block.data, 
          block.hash, 
          block.nonce,
          block.signature,
          block.validatorId
        ]
      );
    }
    
    // Update in-memory chain
    this.chain = newChain;
  }
}

// Create a singleton instance
const blockchain = new Blockchain();

module.exports = blockchain;