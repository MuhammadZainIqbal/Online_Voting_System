/**
 * Implementation of a simple Mixnet (Mix Network) for anonymizing votes
 * This helps break the connection between the voter and their vote
 */

class Mixnet {
  constructor() {
    this.buffer = [];
    this.minimumBatchSize = 3; // Setting to 3 for better anonymity
    this.processingInterval = null;
    this.isProcessing = false;
  }

  /**
   * Start the mixnet with periodic processing
   */
  start() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    
    // Process votes every 30 seconds if minimum batch size is reached
    // or if votes have been waiting too long (2 minutes)
    this.processingInterval = setInterval(() => {
      this.checkAndProcessVotes();
    }, 30000);
    
    console.log('Mixnet periodic processing started');
    return true;
  }

  /**
   * Stop the mixnet processing
   */
  stop() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      console.log('Mixnet processing stopped');
    }
    return true;
  }

  /**
   * Add a vote to the mixnet buffer
   * @param {Object} vote - The encrypted vote data
   * @returns {Boolean} - True if the vote was added successfully
   */
  addVote(vote) {
    if (!vote) return false;
    
    // Add timestamp when the vote was added to the buffer
    vote._mixnetTimestamp = Date.now();
    this.buffer.push(vote);
    console.log(`Vote added to mixnet buffer. Current buffer size: ${this.buffer.length}`);
    
    // Check if we've reached the minimum batch size
    if (this.buffer.length >= this.minimumBatchSize) {
      this.processVotes();
    }
    
    return true;
  }

  /**
   * Get the current buffer size (number of votes waiting to be mixed)
   * @returns {Number} - Number of votes in buffer
   */
  getBufferSize() {
    return this.buffer.length;
  }

  /**
   * Shuffle the votes in the buffer to break the order correlation
   * @param {Array} votes - The array of votes to shuffle
   * @returns {Array} - The shuffled array of votes
   */
  shuffleVotes(votes) {
    const result = [...votes];
    
    // Fisher-Yates shuffle algorithm
    for (let i = result.length - 1; i > 0; i--) {
      // Generate random index
      const j = Math.floor(Math.random() * (i + 1));
      
      // Swap elements
      [result[i], result[j]] = [result[j], result[i]];
    }
    
    return result;
  }
  
  /**
   * Check if votes have been waiting too long and process them
   * This is called periodically by the timer
   */
  checkAndProcessVotes() {
    if (this.buffer.length === 0) return [];
    
    // If we have minimum batch size, process normally
    if (this.buffer.length >= this.minimumBatchSize) {
      return this.processVotes();
    }
    
    // Otherwise, check if oldest vote has been waiting too long (2 minutes)
    const oldestVoteTime = Math.min(...this.buffer.map(v => v._mixnetTimestamp));
    const waitTime = Date.now() - oldestVoteTime;
    
    if (waitTime > 120000) { // 2 minutes
      console.log(`Some votes have been waiting for ${Math.round(waitTime/1000)} seconds. Force processing.`);
      return this.forceProcessVotes();
    }
    
    return [];
  }
  
  /**
   * Process votes if the minimum batch size is reached
   * Returns shuffled votes if batch size is met, otherwise returns empty array
   * @returns {Array} - Shuffled votes or empty array
   */
  processVotes() {
    if (this.isProcessing || this.buffer.length < this.minimumBatchSize) return [];
    
    this.isProcessing = true;
    
    try {
      console.log(`Processing ${this.buffer.length} votes through mixnet`);
      
      // Remove the _mixnetTimestamp from votes before sending them to blockchain
      const votesToProcess = this.buffer.map(vote => {
        const voteCopy = {...vote};
        delete voteCopy._mixnetTimestamp;
        return voteCopy;
      });
      
      // Shuffle the votes
      const shuffledVotes = this.shuffleVotes(votesToProcess);
      
      // Clear the buffer after processing
      this.buffer = [];
      
      return shuffledVotes;
    } finally {
      this.isProcessing = false;
    }
  }
  
  /**
   * Force process all votes in the buffer even if minimum batch size isn't met
   * Only use in specific cases like end of election or if votes have been waiting too long
   * @returns {Array} - Shuffled votes
   */
  forceProcessVotes() {
    if (this.buffer.length === 0) return [];
    
    console.log(`Force processing ${this.buffer.length} votes through mixnet`);
    
    // Remove the _mixnetTimestamp from votes before sending them to blockchain
    const votesToProcess = this.buffer.map(vote => {
      const voteCopy = {...vote};
      delete voteCopy._mixnetTimestamp;
      return voteCopy;
    });
    
    // Shuffle the votes
    const shuffledVotes = this.shuffleVotes(votesToProcess);
    
    // Clear the buffer after processing
    this.buffer = [];
    
    return shuffledVotes;
  }
}

// Create a singleton instance for the application
const mixnet = new Mixnet();

module.exports = mixnet;