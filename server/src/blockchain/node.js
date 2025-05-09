/**
 * Blockchain Node Implementation for Decentralized Vote Storage
 * Implements Proof of Authority consensus for lightweight, energy-efficient operation
 */

const axios = require('axios');
const crypto = require('crypto');
const EventEmitter = require('events');
const os = require('os');
const fs = require('fs').promises;
const path = require('path');

// Node status constants
const NODE_STATUS = {
  SYNCING: 'syncing',
  ACTIVE: 'active',
  VALIDATING: 'validating',
  INACTIVE: 'inactive'
};

class BlockchainNode {
  constructor(nodeId, nodeUrl, isAuthority = false) {
    this.nodeId = nodeId || crypto.randomBytes(16).toString('hex');
    this.url = nodeUrl;
    this.peers = new Map(); // URL -> {nodeId, isAuthority, lastSeen}
    this.status = NODE_STATUS.INACTIVE;
    this.isAuthority = isAuthority;
    this.events = new EventEmitter();
    this.pendingTransactions = []; // Votes waiting to be added to blockchain
    this.validationQueue = []; // Blocks waiting for validation
    
    // For PoA - if authority node, will have a signing key
    this.authorityKeyPair = null;
  }

  // Initialize authority status and keys if this is an authority node
  async initializeAuthority(keyPath = null) {
    if (!this.isAuthority) return false;
    
    try {
      if (keyPath) {
        // Load existing key
        const keyData = await fs.readFile(keyPath, 'utf8');
        this.authorityKeyPair = JSON.parse(keyData);
      } else {
        // Generate a new authority key for signing blocks
        const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
          modulusLength: 2048,
          publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
          },
          privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
          }
        });
        
        this.authorityKeyPair = { publicKey, privateKey };
        
        // Save key to file
        const keystorePath = path.join(os.tmpdir(), `authority_${this.nodeId}.json`);
        await fs.writeFile(keystorePath, JSON.stringify(this.authorityKeyPair));
        console.log(`Authority key saved to ${keystorePath}`);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to initialize authority status:', error);
      return false;
    }
  }

  // Register a peer node
  addPeer(nodeUrl, nodeId, isAuthority = false) {
    if (nodeUrl === this.url) return false; // Don't add self as peer
    
    this.peers.set(nodeUrl, {
      nodeId: nodeId || 'unknown',
      isAuthority,
      lastSeen: Date.now()
    });
    
    console.log(`Added peer: ${nodeUrl} (Authority: ${isAuthority ? 'Yes' : 'No'})`);
    return true;
  }

  // Remove a peer
  removePeer(nodeUrl) {
    return this.peers.delete(nodeUrl);
  }

  // Get all peers
  getPeers() {
    return Array.from(this.peers).map(([url, info]) => ({
      url,
      ...info
    }));
  }

  // Get authority peers
  getAuthorityPeers() {
    return this.getPeers().filter(peer => peer.isAuthority);
  }

  // Send data to all peers
  async broadcastToPeers(endpoint, data) {
    const promises = [];
    for (const [url, _] of this.peers) {
      const targetUrl = `${url}${endpoint}`;
      promises.push(
        axios.post(targetUrl, data)
          .catch(err => {
            console.error(`Failed to broadcast to ${targetUrl}:`, err.message);
            return null;
          })
      );
    }
    
    return Promise.all(promises);
  }

  // Send data to authority peers only
  async broadcastToAuthorities(endpoint, data) {
    const authorities = this.getAuthorityPeers();
    const promises = [];
    
    for (const auth of authorities) {
      const targetUrl = `${auth.url}${endpoint}`;
      promises.push(
        axios.post(targetUrl, data)
          .catch(err => {
            console.error(`Failed to broadcast to authority ${targetUrl}:`, err.message);
            return null;
          })
      );
    }
    
    return Promise.all(promises);
  }

  // Create a signature for a block (authority nodes only)
  signBlock(blockData) {
    if (!this.isAuthority || !this.authorityKeyPair) {
      throw new Error('This node is not authorized to sign blocks');
    }
    
    const blockHash = blockData.hash;
    const signature = crypto.sign(
      'sha256',
      Buffer.from(blockHash),
      this.authorityKeyPair.privateKey
    );
    
    return signature.toString('base64');
  }

  // Verify a block signature
  verifyBlockSignature(blockHash, signature, authorityPublicKey) {
    try {
      return crypto.verify(
        'sha256',
        Buffer.from(blockHash),
        authorityPublicKey,
        Buffer.from(signature, 'base64')
      );
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }

  // Add a pending transaction (vote)
  addPendingTransaction(transaction) {
    this.pendingTransactions.push(transaction);
    this.events.emit('newTransaction', transaction);
    return this.pendingTransactions.length;
  }

  // Check node status
  async checkPeersStatus() {
    // Update last seen timestamp and check for stale peers
    const now = Date.now();
    const stalePeers = [];
    
    for (const [url, info] of this.peers.entries()) {
      // If not seen in last 5 minutes, check status
      if (now - info.lastSeen > 5 * 60 * 1000) {
        try {
          const response = await axios.get(`${url}/api/node/status`);
          if (response.data && response.data.status) {
            // Update last seen
            this.peers.set(url, { ...info, lastSeen: now });
          }
        } catch (error) {
          // Mark for removal if unreachable
          stalePeers.push(url);
        }
      }
    }
    
    // Remove stale peers
    stalePeers.forEach(url => this.removePeer(url));
  }
}

module.exports = BlockchainNode;